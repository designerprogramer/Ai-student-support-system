import hashlib
import secrets

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .analysis import AttachmentContext, analyze_complaint
from .models import (
    Role,
    UserRole,
    UserProfile,
    LoginSecurityState,
    LoginAuditLog,
    EmailOTPChallenge,
    Department,
    ComplaintCategory,
    ComplaintSource,
    ComplaintPriority,
    ComplaintStatus,
    Complaint,
    ComplaintAssignment,
    ComplaintTransfer,
    ComplaintNote,
    ComplaintAttachment,
    ComplaintFeedback,
    ComplaintStatusHistory,
    SLAPolicy,
    ComplaintSLA,
    Notification,
    ComplaintAIAnalysis,
)
from .serializers import (
    RoleSerializer,
    UserSerializer,
    UserRoleSerializer,
    UserProfileSerializer,
    LoginSecurityStateSerializer,
    LoginAuditLogSerializer,
    DepartmentSerializer,
    ComplaintCategorySerializer,
    ComplaintSourceSerializer,
    ComplaintPrioritySerializer,
    ComplaintStatusSerializer,
    ComplaintSerializer,
    ComplaintAssignmentSerializer,
    ComplaintTransferSerializer,
    ComplaintNoteSerializer,
    ComplaintAttachmentSerializer,
    ComplaintStatusHistorySerializer,
    SLAPolicySerializer,
    ComplaintSLASerializer,
    NotificationSerializer,
    ComplaintAIAnalysisSerializer,
    RegistrationSerializer,
    RoleLoginSerializer,
    clean_plain_text,
    validate_uploaded_file,
    ALLOWED_ATTACHMENT_TYPES,
    MAX_ATTACHMENT_BYTES,
)
from .filters import ComplaintFilter
from .permissions import IsAdmin, IsStaff, user_has_any_role, user_has_role
from .sla import enforce_overdue_escalations
from .throttles import OTPVerifyRateThrottle, PasswordResetRateThrottle, RoleLoginRateThrottle


STAFF_ROLES = ['support_officer', 'support_offcier', 'affairs', 'admin']
SAFE_SOURCE_NAMES = {'web'}
SAFE_STATUS_NAMES = {'pending'}
SAFE_PRIORITY_NAMES = {'low', 'medium', 'high', 'critical'}
SAFE_CATEGORY_NAMES = {'finance', 'academics', 'housing', 'it services', 'faculty', 'facilities', 'other'}
OTP_TTL_MINUTES = 10
OTP_MAX_ATTEMPTS = 5


def user_is_admin(user) -> bool:
    return user_has_role(user, 'admin')


def user_is_affairs(user) -> bool:
    return user_has_role(user, 'affairs')


def user_is_support(user) -> bool:
    return user_has_any_role(user, ['support_officer', 'support_offcier'])


def user_is_staff(user) -> bool:
    return user_has_any_role(user, STAFF_ROLES)


def hash_otp_code(code: str) -> str:
    return hashlib.sha256(f'{settings.SECRET_KEY}:{code}'.encode('utf-8')).hexdigest()


def mask_email(email: str) -> str:
    local, _, domain = (email or '').partition('@')
    if not local or not domain:
        return ''
    visible = local[:2] if len(local) > 2 else local[:1]
    return f'{visible}***@{domain}'


def serialize_login_success(user, required_role: str, dashboard_route: str, request=None) -> dict:
    refresh = RefreshToken.for_user(user)
    roles = list(UserRole.objects.filter(user=user).values_list('role__name', flat=True))
    profile = UserProfile.objects.filter(user=user).first()
    profile_name = (profile.full_name if profile and profile.full_name else '').strip()
    if profile_name.isdigit():
        profile_name = ''
    account_name = (user.get_full_name() or '').strip()
    resolved_full_name = profile_name or account_name or user.username
    profile_image_url = ''
    if profile and profile.profile_image:
        profile_image_url = (
            request.build_absolute_uri(profile.profile_image.url)
            if request
            else profile.profile_image.url
        )

    return {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'role': required_role,
        'roles': roles,
        'dashboard_route': dashboard_route,
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'full_name': resolved_full_name,
            'profile_image_url': profile_image_url,
            'student_id': (
                profile.student_number if profile and profile.student_number else user.username
            ) if user_has_role(user, 'student') else '',
        },
    }


class RegistrationViewSet(viewsets.ViewSet):
    permission_classes = [AllowAny]

    def create(self, request):
        serializer = RegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        return Response(
            {
                'user_id': result['user'].id,
                'profile_id': result['profile'].id,
                'role': result['role'].name,
            },
            status=status.HTTP_201_CREATED,
        )


class BaseRoleLoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [RoleLoginRateThrottle]
    required_role = ''
    role_label = ''
    dashboard_route = '/'

    def _client_ip(self, request):
        forwarded_for = (request.META.get('HTTP_X_FORWARDED_FOR') or '').split(',')[0].strip()
        return forwarded_for or request.META.get('REMOTE_ADDR')

    def _record_login_audit(
        self,
        request,
        username: str,
        event: str,
        failure_reason: str = '',
        failed_attempts: int = 0,
        locked_until=None,
        user=None,
    ):
        LoginAuditLog.objects.create(
            username=(username or '').lower(),
            role=self.required_role,
            event=event,
            failure_reason=failure_reason,
            failed_attempts=failed_attempts,
            locked_until=locked_until,
            ip_address=self._client_ip(request),
            user_agent=(request.META.get('HTTP_USER_AGENT') or '')[:1000],
            user=user,
        )

    def _lock_minutes_for_attempts(self, failed_attempts: int) -> int:
        if failed_attempts >= 15:
            return 60
        if failed_attempts >= 10:
            return 30
        if failed_attempts >= 5:
            return 15
        return 0

    def _notify_admins_about_lock(self, state: LoginSecurityState):
        if state.failed_attempts < 15 or state.admin_notified_at:
            return

        admins = get_user_model().objects.filter(userrole__role__name='admin').distinct()
        for admin_user in admins:
            Notification.objects.create(
                recipient=admin_user,
                type='login_lockout_alert',
                payload={
                    'title': 'Login lockout alert',
                    'message': (
                        f"Account '{state.username}' for role '{state.role}' reached "
                        f"{state.failed_attempts} failed login attempts and was locked for 1 hour."
                    ),
                    'username': state.username,
                    'role': state.role,
                    'failed_attempts': state.failed_attempts,
                },
            )
        state.admin_notified_at = timezone.now()
        state.save(update_fields=['admin_notified_at', 'updated_at'])

    def _record_login_failure(self, request, username: str, failure_reason: str) -> LoginSecurityState:
        state, _ = LoginSecurityState.objects.get_or_create(
            username=username.lower(),
            role=self.required_role,
            defaults={'failure_reason': failure_reason},
        )
        state.failed_attempts += 1
        state.failure_reason = failure_reason
        state.last_failed_at = timezone.now()

        lock_minutes = self._lock_minutes_for_attempts(state.failed_attempts)
        if lock_minutes:
            state.locked_until = timezone.now() + timezone.timedelta(minutes=lock_minutes)
        state.save()
        self._notify_admins_about_lock(state)
        event = LoginAuditLog.EVENT_LOCKED if state.locked_until and state.locked_until > timezone.now() else LoginAuditLog.EVENT_FAILURE
        self._record_login_audit(
            request,
            username=username,
            event=event,
            failure_reason=failure_reason,
            failed_attempts=state.failed_attempts,
            locked_until=state.locked_until,
        )
        return state

    def _reset_login_failures(self, username: str):
        LoginSecurityState.objects.filter(username=username.lower(), role=self.required_role).update(
            failed_attempts=0,
            failure_reason='',
            locked_until=None,
            admin_notified_at=None,
            updated_at=timezone.now(),
        )

    def _locked_response(self, state: LoginSecurityState):
        seconds = max(0, int((state.locked_until - timezone.now()).total_seconds())) if state.locked_until else 0
        return Response(
            {
                'detail': 'Too many failed login attempts. Please try again later.',
                'failed_attempts': state.failed_attempts,
                'failure_reason': 'too_many_failed_attempts',
                'locked_until': state.locked_until,
                'retry_after_seconds': seconds,
            },
            status=423,
        )

    def _create_otp_challenge(self, request, user):
        email = (getattr(user, 'email', '') or '').strip()
        if not email:
            raise AuthenticationFailed({
                'detail': 'This account has no registered email address for OTP verification.'
            })

        code = f'{secrets.randbelow(1000000):06d}'
        EmailOTPChallenge.objects.filter(
            user=user,
            purpose=EmailOTPChallenge.PURPOSE_LOGIN,
            role=self.required_role,
            used_at__isnull=True,
        ).update(used_at=timezone.now())
        challenge = EmailOTPChallenge.objects.create(
            user=user,
            purpose=EmailOTPChallenge.PURPOSE_LOGIN,
            role=self.required_role,
            email=email,
            code_hash=hash_otp_code(code),
            max_attempts=OTP_MAX_ATTEMPTS,
            expires_at=timezone.now() + timezone.timedelta(minutes=OTP_TTL_MINUTES),
            ip_address=self._client_ip(request),
            user_agent=(request.META.get('HTTP_USER_AGENT') or '')[:1000],
        )

        try:
            send_mail(
                subject='Student Support: login OTP code',
                message=(
                    f'Your Student Support login OTP code is {code}. '
                    f'This code expires in {OTP_TTL_MINUTES} minutes and can only be used once.'
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False,
            )
        except Exception as exc:
            challenge.used_at = timezone.now()
            challenge.save(update_fields=['used_at'])
            raise AuthenticationFailed({
                'detail': f'Could not send OTP email. Please check the registered email or SMTP settings. ({exc})'
            })
        return challenge

    def post(self, request):
        serializer = RoleLoginSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        username = serializer.validated_data['username']
        password = serializer.validated_data['password']
        state = LoginSecurityState.objects.filter(username=username.lower(), role=self.required_role).first()
        if state and state.locked_until and state.locked_until > timezone.now():
            state = self._record_login_failure(request, username, 'account_locked')
            return self._locked_response(state)

        user = authenticate(request, username=username, password=password)
        if user is None:
            state = self._record_login_failure(request, username, 'invalid_credentials')
            if state.locked_until and state.locked_until > timezone.now():
                return self._locked_response(state)
            raise AuthenticationFailed(
                {
                    'detail': 'Invalid username or password.',
                    'failed_attempts': state.failed_attempts,
                    'failure_reason': 'invalid_credentials',
                }
            )
        if not user.is_active:
            state = self._record_login_failure(request, username, 'inactive_account')
            if state.locked_until and state.locked_until > timezone.now():
                return self._locked_response(state)
            raise AuthenticationFailed(
                {
                    'detail': 'Invalid username or password.',
                    'failed_attempts': state.failed_attempts,
                    'failure_reason': 'invalid_credentials',
                }
            )
        if not user_has_role(user, self.required_role):
            state = self._record_login_failure(request, username, 'role_not_allowed')
            if state.locked_until and state.locked_until > timezone.now():
                return self._locked_response(state)
            raise AuthenticationFailed(
                {
                    'detail': 'Invalid username or password.',
                    'failed_attempts': state.failed_attempts,
                    'failure_reason': 'invalid_credentials',
                }
            )

        challenge = self._create_otp_challenge(request, user)
        return Response(
            {
                'otp_required': True,
                'challenge_id': challenge.id,
                'role': self.required_role,
                'dashboard_route': self.dashboard_route,
                'email_hint': mask_email(user.email),
                'expires_in_seconds': OTP_TTL_MINUTES * 60,
                'detail': 'OTP sent to your registered email.',
            },
            status=status.HTTP_200_OK,
        )


class StudentLoginView(BaseRoleLoginView):
    required_role = 'student'
    role_label = 'student'
    dashboard_route = '/student/dashboard'


class SupportOfficerLoginView(BaseRoleLoginView):
    required_role = 'support_officer'
    role_label = 'support officer'
    dashboard_route = '/support/dashboard'


class AffairsLoginView(BaseRoleLoginView):
    required_role = 'affairs'
    role_label = 'affairs'
    dashboard_route = '/affairs/dashboard'


class AdminLoginView(BaseRoleLoginView):
    required_role = 'admin'
    role_label = 'admin'
    dashboard_route = '/admin/dashboard'


class OTPVerifyView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [OTPVerifyRateThrottle]

    def _client_ip(self, request):
        forwarded_for = (request.META.get('HTTP_X_FORWARDED_FOR') or '').split(',')[0].strip()
        return forwarded_for or request.META.get('REMOTE_ADDR')

    def post(self, request):
        challenge_id = request.data.get('challenge_id')
        code = str(request.data.get('otp') or request.data.get('code') or '').strip()
        if not challenge_id or not code:
            raise ValidationError({'detail': 'challenge_id and otp are required.'})

        try:
            with transaction.atomic():
                challenge = EmailOTPChallenge.objects.select_for_update().select_related('user').get(
                    pk=challenge_id,
                    purpose=EmailOTPChallenge.PURPOSE_LOGIN,
                )
                if challenge.used_at:
                    raise ValidationError({'detail': 'This OTP has already been used.'})
                if challenge.expires_at <= timezone.now():
                    challenge.used_at = timezone.now()
                    challenge.save(update_fields=['used_at'])
                    raise ValidationError({'detail': 'This OTP has expired.'})
                if challenge.failed_attempts >= challenge.max_attempts:
                    challenge.used_at = timezone.now()
                    challenge.save(update_fields=['used_at'])
                    raise ValidationError({'detail': 'Too many failed OTP attempts. Please login again.'})
                if hash_otp_code(code) != challenge.code_hash:
                    challenge.failed_attempts += 1
                    update_fields = ['failed_attempts']
                    if challenge.failed_attempts >= challenge.max_attempts:
                        challenge.used_at = timezone.now()
                        update_fields.append('used_at')
                    challenge.save(update_fields=update_fields)
                    LoginAuditLog.objects.create(
                        username=challenge.user.username.lower(),
                        role=challenge.role,
                        event=LoginAuditLog.EVENT_FAILURE,
                        failure_reason='otp_invalid',
                        failed_attempts=challenge.failed_attempts,
                        ip_address=self._client_ip(request),
                        user_agent=(request.META.get('HTTP_USER_AGENT') or '')[:1000],
                        user=challenge.user,
                    )
                    raise ValidationError({'detail': 'Invalid OTP code.'})

                challenge.used_at = timezone.now()
                challenge.save(update_fields=['used_at'])

                LoginSecurityState.objects.filter(
                    username=challenge.user.username.lower(),
                    role=challenge.role,
                ).update(
                    failed_attempts=0,
                    failure_reason='',
                    locked_until=None,
                    admin_notified_at=None,
                    updated_at=timezone.now(),
                )
                LoginAuditLog.objects.create(
                    username=challenge.user.username.lower(),
                    role=challenge.role,
                    event=LoginAuditLog.EVENT_SUCCESS,
                    ip_address=self._client_ip(request),
                    user_agent=(request.META.get('HTTP_USER_AGENT') or '')[:1000],
                    user=challenge.user,
                )
        except EmailOTPChallenge.DoesNotExist:
            raise ValidationError({'detail': 'Invalid OTP challenge.'})

        dashboard_route = {
            'student': '/student/dashboard',
            'support_officer': '/support/dashboard',
            'support_offcier': '/support/dashboard',
            'affairs': '/affairs/dashboard',
            'admin': '/admin/dashboard',
        }.get(challenge.role, '/')
        return Response(serialize_login_success(challenge.user, challenge.role, dashboard_route, request), status=200)


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetRateThrottle]

    def _client_ip(self, request):
        forwarded_for = (request.META.get('HTTP_X_FORWARDED_FOR') or '').split(',')[0].strip()
        return forwarded_for or request.META.get('REMOTE_ADDR')

    def post(self, request):
        email = str(request.data.get('email') or '').strip().lower()
        username = str(request.data.get('username') or '').strip()
        User = get_user_model()
        user = None
        if email:
            user = User.objects.filter(email__iexact=email, is_active=True).first()
        elif username:
            user = User.objects.filter(username__iexact=username, is_active=True).first()

        if user and user.email:
            code = f'{secrets.randbelow(1000000):06d}'
            EmailOTPChallenge.objects.filter(
                user=user,
                purpose=EmailOTPChallenge.PURPOSE_PASSWORD_RESET,
                used_at__isnull=True,
            ).update(used_at=timezone.now())
            EmailOTPChallenge.objects.create(
                user=user,
                purpose=EmailOTPChallenge.PURPOSE_PASSWORD_RESET,
                role='',
                email=user.email,
                code_hash=hash_otp_code(code),
                max_attempts=OTP_MAX_ATTEMPTS,
                expires_at=timezone.now() + timezone.timedelta(minutes=OTP_TTL_MINUTES),
                ip_address=self._client_ip(request),
                user_agent=(request.META.get('HTTP_USER_AGENT') or '')[:1000],
            )
            try:
                send_mail(
                    subject='Student Support: password reset OTP code',
                    message=(
                        f'Your Student Support password reset OTP code is {code}. '
                        f'This code expires in {OTP_TTL_MINUTES} minutes and can only be used once.'
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                    fail_silently=False,
                )
            except Exception:
                EmailOTPChallenge.objects.filter(
                    user=user,
                    purpose=EmailOTPChallenge.PURPOSE_PASSWORD_RESET,
                    used_at__isnull=True,
                ).update(used_at=timezone.now())

        return Response({
            'detail': 'If the account exists, a password reset OTP has been sent to the registered email.'
        })


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [OTPVerifyRateThrottle]

    def post(self, request):
        email = str(request.data.get('email') or '').strip().lower()
        username = str(request.data.get('username') or '').strip()
        code = str(request.data.get('otp') or request.data.get('code') or '').strip()
        new_password = str(request.data.get('new_password') or '')
        if not code or not new_password:
            raise ValidationError({'detail': 'otp and new_password are required.'})

        User = get_user_model()
        user = None
        if email:
            user = User.objects.filter(email__iexact=email, is_active=True).first()
        elif username:
            user = User.objects.filter(username__iexact=username, is_active=True).first()
        if not user:
            raise ValidationError({'detail': 'Invalid or expired password reset OTP.'})

        validate_password(new_password, user=user)

        with transaction.atomic():
            challenge = EmailOTPChallenge.objects.select_for_update().filter(
                user=user,
                purpose=EmailOTPChallenge.PURPOSE_PASSWORD_RESET,
                used_at__isnull=True,
            ).order_by('-created_at').first()
            if not challenge or challenge.expires_at <= timezone.now():
                if challenge:
                    challenge.used_at = timezone.now()
                    challenge.save(update_fields=['used_at'])
                raise ValidationError({'detail': 'Invalid or expired password reset OTP.'})
            if challenge.failed_attempts >= challenge.max_attempts:
                challenge.used_at = timezone.now()
                challenge.save(update_fields=['used_at'])
                raise ValidationError({'detail': 'Too many failed OTP attempts. Request a new reset code.'})
            if hash_otp_code(code) != challenge.code_hash:
                challenge.failed_attempts += 1
                update_fields = ['failed_attempts']
                if challenge.failed_attempts >= challenge.max_attempts:
                    challenge.used_at = timezone.now()
                    update_fields.append('used_at')
                challenge.save(update_fields=update_fields)
                raise ValidationError({'detail': 'Invalid or expired password reset OTP.'})

            user.set_password(new_password)
            user.save(update_fields=['password'])
            challenge.used_at = timezone.now()
            challenge.save(update_fields=['used_at'])
            LoginSecurityState.objects.filter(username=user.username.lower()).update(
                failed_attempts=0,
                failure_reason='',
                locked_until=None,
                admin_notified_at=None,
                updated_at=timezone.now(),
            )

        return Response({'detail': 'Password reset successful. You can login with your new password.'})


class AccountEmailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        email = str(request.data.get('email') or '').strip().lower()
        if not email:
            raise ValidationError({'email': 'Email is required.'})

        serializer = UserSerializer(
            request.user,
            data={'email': email},
            partial=True,
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response({
            'email': request.user.email,
            'detail': 'Email updated successfully.',
        })


class AccountPasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        current_password = str(request.data.get('current_password') or '')
        new_password = str(request.data.get('new_password') or '')
        confirm_password = str(request.data.get('confirm_password') or '')

        if not current_password or not new_password or not confirm_password:
            raise ValidationError({'detail': 'Current password, new password, and confirm password are required.'})
        if not request.user.check_password(current_password):
            raise ValidationError({'current_password': 'Current password is incorrect.'})
        if new_password != confirm_password:
            raise ValidationError({'confirm_password': 'New passwords do not match.'})

        validate_password(new_password, user=request.user)
        request.user.set_password(new_password)
        request.user.save(update_fields=['password'])
        LoginSecurityState.objects.filter(username=request.user.username.lower()).update(
            failed_attempts=0,
            failure_reason='',
            locked_until=None,
            admin_notified_at=None,
            updated_at=timezone.now(),
        )

        return Response({'detail': 'Password updated successfully.'})


class PublicLandingView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        complaints = Complaint.objects.select_related('status', 'priority', 'category')
        total = complaints.count()
        resolved = complaints.filter(status__name__iexact='resolved').count() + complaints.filter(status__name__iexact='closed').count()
        satisfaction = round((resolved / total) * 100) if total else 0

        return Response(
            {
                'stats': {
                    'complaints': total,
                    'resolved': resolved,
                    'satisfaction': satisfaction,
                },
                'statuses': list(ComplaintStatus.objects.order_by('id').values_list('name', flat=True)),
                'priorities': list(ComplaintPriority.objects.order_by('id').values_list('name', flat=True)),
                'categories': list(
                    ComplaintCategory.objects.filter(active=True).order_by('name').values_list('name', flat=True)
                ),
            }
        )


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsAdmin]


class UserViewSet(viewsets.ModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    http_method_names = ['get', 'patch', 'head', 'options']
    search_fields = ['username', 'email', 'first_name', 'last_name', 'userprofile__full_name']
    ordering_fields = ['username', 'email', 'is_active', 'id']
    ordering = ['username']

    def get_queryset(self):
        return get_user_model().objects.prefetch_related('userrole_set__role').select_related('userprofile')

    def partial_update(self, request, *args, **kwargs):
        user = self.get_object()
        if user.id == request.user.id and request.data.get('is_active') is False:
            raise ValidationError({'is_active': 'You cannot deactivate your own admin account.'})
        return super().partial_update(request, *args, **kwargs)


class UserRoleViewSet(viewsets.ModelViewSet):
    queryset = UserRole.objects.all()
    serializer_class = UserRoleSerializer
    permission_classes = [IsAdmin]


class UserProfileViewSet(viewsets.ModelViewSet):
    queryset = UserProfile.objects.all()
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = UserProfile.objects.select_related('user', 'department')
        if user_is_admin(self.request.user) or user_is_affairs(self.request.user):
            return qs
        return qs.filter(user=self.request.user)

    def perform_create(self, serializer):
        if user_is_admin(self.request.user) and self.request.data.get('user'):
            serializer.save()
            return
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        profile = self.get_object()
        if profile.user_id != self.request.user.id and not (user_is_admin(self.request.user) or user_is_affairs(self.request.user)):
            raise PermissionDenied('You do not have permission to update this profile.')
        serializer.save()

    def perform_destroy(self, instance):
        if instance.user_id != self.request.user.id and not (user_is_admin(self.request.user) or user_is_affairs(self.request.user)):
            raise PermissionDenied('You do not have permission to delete this profile.')
        instance.delete()


class LoginSecurityStateViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = LoginSecurityState.objects.all().order_by('-updated_at')
    serializer_class = LoginSecurityStateSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    search_fields = ['username', 'role', 'failure_reason']
    ordering_fields = ['updated_at', 'failed_attempts', 'locked_until', 'last_failed_at']
    ordering = ['-updated_at']


class LoginAuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = LoginAuditLog.objects.select_related('user').all().order_by('-created_at')
    serializer_class = LoginAuditLogSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    search_fields = ['username', 'role', 'event', 'failure_reason', 'ip_address']
    ordering_fields = ['created_at', 'failed_attempts', 'locked_until']
    ordering = ['-created_at']


class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        permission_classes = [IsAuthenticated] if self.action in ['list', 'retrieve'] else [IsAuthenticated, IsAdmin]
        return [permission() for permission in permission_classes]


class ComplaintCategoryViewSet(viewsets.ModelViewSet):
    queryset = ComplaintCategory.objects.all()
    serializer_class = ComplaintCategorySerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        permission_classes = [IsAuthenticated] if self.action in ['list', 'retrieve'] else [IsAuthenticated, IsAdmin]
        return [permission() for permission in permission_classes]


class ComplaintSourceViewSet(viewsets.ModelViewSet):
    queryset = ComplaintSource.objects.all()
    serializer_class = ComplaintSourceSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        permission_classes = [IsAuthenticated] if self.action in ['list', 'retrieve'] else [IsAuthenticated, IsAdmin]
        return [permission() for permission in permission_classes]


class ComplaintPriorityViewSet(viewsets.ModelViewSet):
    queryset = ComplaintPriority.objects.all()
    serializer_class = ComplaintPrioritySerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        permission_classes = [IsAuthenticated] if self.action in ['list', 'retrieve'] else [IsAuthenticated, IsAdmin]
        return [permission() for permission in permission_classes]


class ComplaintStatusViewSet(viewsets.ModelViewSet):
    queryset = ComplaintStatus.objects.all()
    serializer_class = ComplaintStatusSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        permission_classes = [IsAuthenticated] if self.action in ['list', 'retrieve'] else [IsAuthenticated, IsAdmin]
        return [permission() for permission in permission_classes]


class ComplaintViewSet(viewsets.ModelViewSet):
    serializer_class = ComplaintSerializer
    permission_classes = [IsAuthenticated]
    filterset_class = ComplaintFilter
    search_fields = ['complaint_code', 'title', 'description']
    ordering_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']

    def list(self, request, *args, **kwargs):
        if user_is_staff(request.user) or user_is_admin(request.user):
            enforce_overdue_escalations()
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        if user_is_staff(request.user) or user_is_admin(request.user):
            enforce_overdue_escalations()
        return super().retrieve(request, *args, **kwargs)

    def get_queryset(self):
        qs = Complaint.objects.select_related(
            'student', 'submitted_by', 'source', 'category', 'priority', 'status'
        )
        user = self.request.user
        if user_has_role(user, 'student'):
            return qs.filter(student=user)
        if user_is_support(user):
            assigned_to_others = ComplaintAssignment.objects.filter(
                unassigned_at__isnull=True
            ).exclude(assigned_to=user).values_list('complaint_id', flat=True)
            return qs.filter(
                Q(complaintassignment__assigned_to=user, complaintassignment__unassigned_at__isnull=True)
                | Q(complaintnote__author=user)
                | Q(complaintassignment__isnull=True)
            ).exclude(id__in=assigned_to_others).distinct()
        if user_is_affairs(user) or user_is_admin(user):
            return qs
        return qs.none()

    @staticmethod
    def _resolve_lookup_by_name(model_cls, preferred_name: str, fallback_name: str, allow_create: bool = False) -> object:
        name = (preferred_name or fallback_name or '').strip()
        if not name:
            raise ValidationError({'detail': f'{model_cls.__name__} name cannot be blank.'})

        existing = model_cls.objects.filter(name__iexact=name).first()
        if existing is not None:
            return existing

        if not allow_create:
            raise ValidationError({'detail': f'{model_cls.__name__} "{name}" does not exist.'})

        if name.islower():
            name = name.capitalize()
        return model_cls.objects.create(name=name)

    @staticmethod
    def _resolve_existing_category(name: str | None) -> ComplaintCategory | None:
        cleaned = (name or '').strip()
        if not cleaned:
            return None
        return ComplaintCategory.objects.filter(name__iexact=cleaned).first()

    @staticmethod
    def _resolve_category(preferred_name: str | None, allow_create: bool = False) -> ComplaintCategory:
        cleaned = (preferred_name or '').strip() or 'Other'
        existing = ComplaintCategory.objects.filter(name__iexact=cleaned).first()
        if existing is not None:
            return existing
        if not allow_create:
            raise ValidationError({'category': f'Category "{cleaned}" does not exist.'})
        return ComplaintCategory.objects.create(
            name=cleaned,
            description='Auto-created from complaint submission.',
            active=True,
        )

    def _resolve_student_user(self, student_id_hint: str | None):
        if user_has_role(self.request.user, 'student'):
            cleaned = (student_id_hint or '').strip()
            if cleaned:
                allowed_values = {self.request.user.username.lower()}
                profile = UserProfile.objects.filter(user=self.request.user).first()
                if profile and profile.student_number:
                    allowed_values.add(profile.student_number.lower())
                if cleaned.lower() not in allowed_values:
                    raise PermissionDenied('Students can only submit complaints for their own account.')
            return self.request.user

        if not user_is_staff(self.request.user):
            raise PermissionDenied('You do not have permission to submit complaints for other users.')

        cleaned = (student_id_hint or '').strip()
        if not cleaned:
            raise ValidationError({'student_id': 'student_id is required for non-student submissions.'})

        User = get_user_model()
        user = User.objects.filter(username__iexact=cleaned).first()
        if user is None:
            user = User.objects.filter(userprofile__student_number__iexact=cleaned).first()
        if user is None:
            raise ValidationError({'student_id': f'No user matches student_id "{cleaned}".'})
        return user

    def perform_create(self, serializer):
        if not (user_has_role(self.request.user, 'student') or user_is_staff(self.request.user)):
            raise PermissionDenied('You do not have permission to create complaints.')

        attachment_files = list(self.request.FILES.getlist('attachments'))
        for file_obj in attachment_files:
            validate_uploaded_file(
                file_obj,
                ALLOWED_ATTACHMENT_TYPES,
                MAX_ATTACHMENT_BYTES,
                'Attachment',
            )
        attachment_context = [
            AttachmentContext(
                name=getattr(file_obj, 'name', ''),
                mime_type=getattr(file_obj, 'content_type', ''),
                size_bytes=int(getattr(file_obj, 'size', 0) or 0),
            )
            for file_obj in attachment_files
        ]

        provided_category_name = (serializer.validated_data.get('category') or '').strip()
        analysis = analyze_complaint(
            title=serializer.validated_data.get('title', ''),
            description=serializer.validated_data.get('description', ''),
            submitted_category=provided_category_name,
            attachments=attachment_context,
        )

        provided_source_name = (serializer.validated_data.get('source') or '').strip()
        provided_status_name = (serializer.validated_data.get('status') or '').strip()
        requested_source = (provided_source_name or 'Web').strip()
        requested_status = (provided_status_name or 'Pending').strip()
        requested_priority = (analysis.auto_priority or 'Medium').strip()
        requested_category = (provided_category_name or analysis.suggested_category or 'Other').strip()
        can_manage_lookups = user_is_admin(self.request.user)

        source = self._resolve_lookup_by_name(
            ComplaintSource,
            requested_source,
            'Web',
            allow_create=can_manage_lookups or requested_source.lower() in SAFE_SOURCE_NAMES,
        )
        status_obj = self._resolve_lookup_by_name(
            ComplaintStatus,
            requested_status,
            'Pending',
            allow_create=can_manage_lookups or requested_status.lower() in SAFE_STATUS_NAMES,
        )
        priority = self._resolve_lookup_by_name(
            ComplaintPriority,
            requested_priority,
            'Medium',
            allow_create=can_manage_lookups or requested_priority.lower() in SAFE_PRIORITY_NAMES,
        )
        category = self._resolve_category(
            requested_category,
            allow_create=can_manage_lookups or requested_category.lower() in SAFE_CATEGORY_NAMES,
        )
        student = self._resolve_student_user(serializer.validated_data.get('student_id'))
        suggested_category_name = (analysis.suggested_category or 'Other').strip()
        suggested_category = self._resolve_category(
            suggested_category_name,
            allow_create=can_manage_lookups or suggested_category_name.lower() in SAFE_CATEGORY_NAMES,
        )

        with transaction.atomic():
            complaint = serializer.save(
                student=student,
                submitted_by=self.request.user,
                source=source,
                category=category,
                priority=priority,
                status=status_obj,
                original_text=analysis.original_text,
                translated_text=analysis.translated_text,
                detected_language=analysis.detected_language,
                sentiment=analysis.sentiment,
                urgency=analysis.urgency,
                confidence_score=analysis.confidence_score,
                auto_priority=analysis.auto_priority,
            )
            for file_obj in attachment_files:
                ComplaintAttachment.objects.create(
                    complaint=complaint,
                    uploaded_by=self.request.user,
                    file=file_obj,
                    file_name=(getattr(file_obj, 'name', '') or '')[:255],
                    mime_type=(getattr(file_obj, 'content_type', '') or '')[:100],
                    file_size_bytes=getattr(file_obj, 'size', None),
                )
            ComplaintStatusHistory.objects.create(
                complaint=complaint,
                status=complaint.status,
                changed_by=self.request.user,
                note='Created',
            )
            ComplaintAIAnalysis.objects.create(
                complaint=complaint,
                predicted_category=suggested_category,
                predicted_priority=priority,
                routing_department=(
                    suggested_category.department if suggested_category else getattr(category, 'department', None)
                ),
                confidence=analysis.confidence_score,
                model_version=analysis.model_version,
                raw_output=analysis.to_raw_output(),
            )
            
            # Dynamic Notification triggers
            Notification.objects.create(
                recipient=student,
                type='complaint_created',
                payload={
                    'complaint_id': complaint.id,
                    'complaint_code': complaint.complaint_code or f'CMP-{complaint.id}',
                    'title': complaint.title,
                    'message': f"Your complaint {complaint.complaint_code or f'CMP-{complaint.id}'} was submitted successfully."
                }
            )
            affairs_users = get_user_model().objects.filter(userrole__role__name='affairs')
            for a_user in affairs_users:
                Notification.objects.create(
                    recipient=a_user,
                    type='complaint_created',
                    payload={
                        'complaint_id': complaint.id,
                        'complaint_code': complaint.complaint_code or f'CMP-{complaint.id}',
                        'title': complaint.title,
                        'message': f"A new complaint {complaint.complaint_code or f'CMP-{complaint.id}'} has been submitted."
                    }
                )

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def assign(self, request, pk=None):
        if not (user_is_staff(request.user) or user_is_admin(request.user)):
            raise PermissionDenied('You do not have permission to assign complaints.')
        complaint = self.get_object()
        assigned_to = request.data.get('assigned_to')
        auto_assigned = bool(request.data.get('auto_assigned', False))
        if not assigned_to:
            return Response({'detail': 'assigned_to is required'}, status=400)
        
        with transaction.atomic():
            assignment = ComplaintAssignment.objects.create(
                complaint=complaint,
                assigned_to_id=assigned_to,
                assigned_by=request.user,
                auto_assigned=auto_assigned,
            )
            
            Notification.objects.create(
                recipient=assignment.assigned_to,
                type='complaint_assigned',
                payload={
                    'complaint_id': complaint.id,
                    'complaint_code': complaint.complaint_code or f'CMP-{complaint.id}',
                    'title': complaint.title,
                    'message': f"Complaint {complaint.complaint_code or f'CMP-{complaint.id}'} has been assigned to you for investigation."
                }
            )
            Notification.objects.create(
                recipient=complaint.student,
                type='complaint_assigned',
                payload={
                    'complaint_id': complaint.id,
                    'complaint_code': complaint.complaint_code or f'CMP-{complaint.id}',
                    'title': complaint.title,
                    'message': f"A support officer has been assigned to investigate your complaint {complaint.complaint_code or f'CMP-{complaint.id}'}."
                }
            )
        return Response(ComplaintAssignmentSerializer(assignment).data, status=201)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def add_note(self, request, pk=None):
        if not (user_is_staff(request.user) or user_is_admin(request.user)):
            raise PermissionDenied('You do not have permission to add notes.')
        complaint = self.get_object()
        note_type = request.data.get('note_type', 'response')
        note = clean_plain_text(request.data.get('note'), 5000, 'Note')
        if not note:
            return Response({'detail': 'note is required'}, status=400)

        note_text = note or ''
        if '[INVESTIGATION RESULT]' in note_text:
            latest_investigation = ComplaintNote.objects.filter(
                complaint=complaint,
                note__contains='[INVESTIGATION RESULT]',
            ).order_by('-created_at').first()
            latest_return_request = ComplaintNote.objects.filter(
                complaint=complaint,
                note__contains='[AFFAIRS REVIEW]',
            ).filter(
                note__contains='NEEDS MORE INVESTIGATION',
            ).order_by('-created_at').first()

            can_add_investigation = (
                latest_investigation is None or
                (
                    latest_return_request is not None and
                    latest_return_request.created_at > latest_investigation.created_at
                )
            )

            if not can_add_investigation:
                return Response(ComplaintNoteSerializer(latest_investigation).data, status=200)
        
        with transaction.atomic():
            created = ComplaintNote.objects.create(
                complaint=complaint,
                author=request.user,
                note_type=note_type,
                note=note,
            )
            
            if '[INVESTIGATION RESULT]' in note_text:
                affairs_users = get_user_model().objects.filter(userrole__role__name='affairs')
                for a_user in affairs_users:
                    Notification.objects.create(
                        recipient=a_user,
                        type='investigation_submitted',
                        payload={
                            'complaint_id': complaint.id,
                            'complaint_code': complaint.complaint_code or f'CMP-{complaint.id}',
                            'title': complaint.title,
                            'message': f"Support officer has submitted investigation result for {complaint.complaint_code or f'CMP-{complaint.id}'}."
                        }
                    )
            elif '[AFFAIRS REVIEW]' in note_text:
                sent_to_admin = ComplaintNote.objects.filter(
                    complaint=complaint,
                    note__contains='[SEND TO ADMIN]',
                ).exists()
                admin_answered = ComplaintNote.objects.filter(
                    complaint=complaint,
                    note__contains='[ADMIN RESPONSE]',
                ).exists()
                if sent_to_admin or admin_answered:
                    created.delete()
                    latest_review = ComplaintNote.objects.filter(
                        complaint=complaint,
                        note__contains='[AFFAIRS REVIEW]',
                    ).order_by('-created_at').first()
                    if latest_review:
                        return Response(ComplaintNoteSerializer(latest_review).data, status=200)
                    return Response({'detail': 'Complaint has already been sent to admin.'}, status=200)

                verdict_is_true = 'TRUE' in note_text
                if verdict_is_true and ComplaintNote.objects.filter(
                    complaint=complaint,
                    note__contains='[AFFAIRS REVIEW] TRUE',
                ).exclude(id=created.id).exists():
                    created.delete()
                    existing = ComplaintNote.objects.filter(
                        complaint=complaint,
                        note__contains='[AFFAIRS REVIEW] TRUE',
                    ).latest('created_at')
                    return Response(ComplaintNoteSerializer(existing).data, status=200)

                active_assignment = ComplaintAssignment.objects.filter(
                    complaint=complaint, unassigned_at__isnull=True
                ).first()
                verdict = 'Approved' if verdict_is_true else 'Needs More Investigation'
                if active_assignment:
                    Notification.objects.create(
                        recipient=active_assignment.assigned_to,
                        type='affairs_review',
                        payload={
                            'complaint_id': complaint.id,
                            'complaint_code': complaint.complaint_code or f'CMP-{complaint.id}',
                            'title': complaint.title,
                            'message': f"Affairs reviewed complaint {complaint.complaint_code or f'CMP-{complaint.id}'}. Verdict: {verdict}."
                        }
                    )
                Notification.objects.create(
                    recipient=complaint.student,
                    type='affairs_review',
                    payload={
                        'complaint_id': complaint.id,
                        'complaint_code': complaint.complaint_code or f'CMP-{complaint.id}',
                        'title': complaint.title,
                        'message': f"Your complaint {complaint.complaint_code or f'CMP-{complaint.id}'} review update: {verdict}."
                    }
                )
            elif '[SEND TO ADMIN]' in note_text:
                admin_users = get_user_model().objects.filter(userrole__role__name='admin')
                for ad_user in admin_users:
                    Notification.objects.create(
                        recipient=ad_user,
                        type='complaint_escalated',
                        payload={
                            'complaint_id': complaint.id,
                            'complaint_code': complaint.complaint_code or f'CMP-{complaint.id}',
                            'title': complaint.title,
                            'message': f"Complaint {complaint.complaint_code or f'CMP-{complaint.id}'} has been escalated to admin."
                        }
                    )
            elif '[ADMIN RESPONSE]' in note_text:
                resolved_status = ComplaintStatus.objects.filter(name__iexact='Resolved').first()
                if resolved_status and complaint.status_id != resolved_status.id:
                    complaint.status = resolved_status
                    complaint.resolved_at = timezone.now()
                    complaint.save()
                    ComplaintStatusHistory.objects.create(
                        complaint=complaint,
                        status=resolved_status,
                        changed_by=request.user,
                        note='Resolved by admin response.',
                    )
                Notification.objects.create(
                    recipient=complaint.student,
                    type='admin_response',
                    payload={
                        'complaint_id': complaint.id,
                        'complaint_code': complaint.complaint_code or f'CMP-{complaint.id}',
                        'title': complaint.title,
                        'message': f"Admin has responded to your escalated complaint {complaint.complaint_code or f'CMP-{complaint.id}'}."
                    }
                )
                affairs_users = get_user_model().objects.filter(userrole__role__name='affairs')
                for a_user in affairs_users:
                    Notification.objects.create(
                        recipient=a_user,
                        type='admin_response',
                        payload={
                            'complaint_id': complaint.id,
                            'complaint_code': complaint.complaint_code or f'CMP-{complaint.id}',
                            'title': complaint.title,
                            'message': f"Admin has responded to escalated complaint {complaint.complaint_code or f'CMP-{complaint.id}'}."
                        }
                    )
        return Response(ComplaintNoteSerializer(created).data, status=201)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def set_status(self, request, pk=None):
        if not (user_is_staff(request.user) or user_is_admin(request.user)):
            raise PermissionDenied('You do not have permission to change complaint status.')
        complaint = self.get_object()
        status_id = request.data.get('status')
        note = clean_plain_text(request.data.get('note'), 5000, 'Resolution note')
        if not status_id:
            return Response({'detail': 'status is required'}, status=400)
        try:
            new_status = ComplaintStatus.objects.get(pk=status_id)
        except ComplaintStatus.DoesNotExist:
            return Response({'detail': 'Invalid status'}, status=400)

        is_final_status = new_status.name.lower() in {'resolved', 'closed'}
        if is_final_status and not note:
            raise ValidationError({
                'note': 'Write the final resolution proof before marking this complaint resolved or closed.'
            })
        
        with transaction.atomic():
            complaint.status = new_status
            if is_final_status:
                complaint.resolved_at = timezone.now()
            else:
                complaint.resolved_at = None
            complaint.save()
            
            ComplaintStatusHistory.objects.create(
                complaint=complaint,
                status=new_status,
                changed_by=request.user,
                note=note,
            )
            
            Notification.objects.create(
                recipient=complaint.student,
                type='status_changed',
                payload={
                    'complaint_id': complaint.id,
                    'complaint_code': complaint.complaint_code or f'CMP-{complaint.id}',
                    'title': complaint.title,
                    'message': f"The status of your complaint {complaint.complaint_code or f'CMP-{complaint.id}'} has been changed to '{new_status.name}'."
                }
            )
            active_assignment = ComplaintAssignment.objects.filter(
                complaint=complaint, unassigned_at__isnull=True
            ).first()
            if active_assignment:
                Notification.objects.create(
                    recipient=active_assignment.assigned_to,
                    type='status_changed',
                    payload={
                        'complaint_id': complaint.id,
                        'complaint_code': complaint.complaint_code or f'CMP-{complaint.id}',
                        'title': complaint.title,
                        'message': f"Complaint {complaint.complaint_code or f'CMP-{complaint.id}'} status changed to '{new_status.name}'."
                    }
                )
        return Response(ComplaintSerializer(complaint).data, status=200)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def confirm_resolution(self, request, pk=None):
        complaint = self.get_object()
        if not user_has_role(request.user, 'student') or complaint.student_id != request.user.id:
            raise PermissionDenied('Only the complaint owner can confirm resolution.')

        status_key = str(complaint.status or '').strip().lower().replace(' ', '_')
        effective_status = ComplaintSerializer(complaint).data.get('effective_status', '')
        effective_status_key = str(effective_status or '').strip().lower().replace(' ', '_')
        if status_key not in {'resolved', 'closed'} and effective_status_key not in {'resolved', 'closed'}:
            raise ValidationError({'detail': 'Only resolved complaints can be confirmed.'})

        closed_status, _ = ComplaintStatus.objects.get_or_create(name='Closed')
        note = clean_plain_text(
            request.data.get('note') or 'Student confirmed the complaint is solved.',
            1000,
            'Confirmation note',
        )

        with transaction.atomic():
            complaint.status = closed_status
            if not complaint.resolved_at:
                complaint.resolved_at = timezone.now()
            complaint.save(update_fields=['status', 'resolved_at', 'updated_at'])
            ComplaintStatusHistory.objects.create(
                complaint=complaint,
                status=closed_status,
                changed_by=request.user,
                note=note,
            )
            ComplaintNote.objects.create(
                complaint=complaint,
                author=request.user,
                note_type='response',
                note=f'[STUDENT CONFIRMED] {note}',
            )

            staff_recipients = get_user_model().objects.filter(
                Q(userrole__role__name__in=['support_officer', 'support_offcier', 'affairs', 'admin'])
            ).distinct()
            for recipient in staff_recipients:
                Notification.objects.create(
                    recipient=recipient,
                    type='resolution_confirmed',
                    payload={
                        'complaint_id': complaint.id,
                        'complaint_code': complaint.complaint_code or f'CMP-{complaint.id}',
                        'title': complaint.title,
                        'message': f"Student confirmed complaint {complaint.complaint_code or f'CMP-{complaint.id}'} is solved.",
                    },
                )

        return Response(ComplaintSerializer(complaint).data, status=200)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def reopen(self, request, pk=None):
        complaint = self.get_object()
        if not user_has_role(request.user, 'student') or complaint.student_id != request.user.id:
            raise PermissionDenied('Only the complaint owner can reopen this complaint.')

        status_key = str(complaint.status or '').strip().lower().replace(' ', '_')
        effective_status = ComplaintSerializer(complaint).data.get('effective_status', '')
        effective_status_key = str(effective_status or '').strip().lower().replace(' ', '_')
        if status_key not in {'resolved', 'closed'} and effective_status_key not in {'resolved', 'closed'}:
            raise ValidationError({'detail': 'Only resolved or closed complaints can be reopened.'})

        reason = clean_plain_text(request.data.get('reason'), 1000, 'Reopen reason')
        if not reason:
            raise ValidationError({'reason': 'Please explain why the problem is not solved.'})

        reopened_status, _ = ComplaintStatus.objects.get_or_create(name='Reopened')
        with transaction.atomic():
            complaint.status = reopened_status
            complaint.resolved_at = None
            complaint.save(update_fields=['status', 'resolved_at', 'updated_at'])
            ComplaintStatusHistory.objects.create(
                complaint=complaint,
                status=reopened_status,
                changed_by=request.user,
                note=f'Reopened by student: {reason}',
            )
            ComplaintNote.objects.create(
                complaint=complaint,
                author=request.user,
                note_type='response',
                note=f'[STUDENT REOPENED] {reason}',
            )

            recipients = get_user_model().objects.filter(
                Q(userrole__role__name__in=['support_officer', 'support_offcier', 'affairs', 'admin'])
            ).distinct()
            for recipient in recipients:
                Notification.objects.create(
                    recipient=recipient,
                    type='complaint_reopened',
                    payload={
                        'complaint_id': complaint.id,
                        'complaint_code': complaint.complaint_code or f'CMP-{complaint.id}',
                        'title': complaint.title,
                        'message': f"Student reopened complaint {complaint.complaint_code or f'CMP-{complaint.id}'}: {reason}",
                    },
                )

        return Response(ComplaintSerializer(complaint).data, status=200)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def set_priority(self, request, pk=None):
        if not user_is_admin(request.user):
            raise PermissionDenied('Only admins can change complaint priority.')

        complaint = self.get_object()
        priority_id = request.data.get('priority')
        note = clean_plain_text(request.data.get('note'), 1000, 'Priority note')
        if not priority_id:
            return Response({'detail': 'priority is required'}, status=400)

        try:
            new_priority = ComplaintPriority.objects.get(pk=priority_id)
        except ComplaintPriority.DoesNotExist:
            return Response({'detail': 'Invalid priority'}, status=400)

        old_priority = complaint.priority
        with transaction.atomic():
            complaint.priority = new_priority
            complaint.save(update_fields=['priority', 'updated_at'])

            ComplaintNote.objects.create(
                complaint=complaint,
                author=request.user,
                note_type='internal',
                note=(
                    f'[PRIORITY CHANGE] {old_priority} -> {new_priority}. '
                    f'{note or "Priority updated by admin."}'
                ),
            )

            Notification.objects.create(
                recipient=complaint.student,
                type='priority_changed',
                payload={
                    'complaint_id': complaint.id,
                    'complaint_code': complaint.complaint_code or f'CMP-{complaint.id}',
                    'title': complaint.title,
                    'message': f"Priority for your complaint {complaint.complaint_code or f'CMP-{complaint.id}'} was updated to '{new_priority.name}'."
                }
            )

            active_assignment = ComplaintAssignment.objects.filter(
                complaint=complaint, unassigned_at__isnull=True
            ).first()
            if active_assignment:
                Notification.objects.create(
                    recipient=active_assignment.assigned_to,
                    type='priority_changed',
                    payload={
                        'complaint_id': complaint.id,
                        'complaint_code': complaint.complaint_code or f'CMP-{complaint.id}',
                        'title': complaint.title,
                        'message': f"Complaint {complaint.complaint_code or f'CMP-{complaint.id}'} priority changed to '{new_priority.name}'."
                    }
                )

        return Response(ComplaintSerializer(complaint).data, status=200)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def feedback(self, request, pk=None):
        complaint = self.get_object()
        if not user_has_role(request.user, 'student') or complaint.student_id != request.user.id:
            raise PermissionDenied('Only the complaint owner can rate this complaint.')

        status_key = str(complaint.status or '').strip().lower().replace(' ', '_')
        effective_status = ComplaintSerializer(complaint).data.get('effective_status', '')
        effective_status_key = str(effective_status or '').strip().lower().replace(' ', '_')
        if status_key not in {'resolved', 'closed'} and effective_status_key not in {'resolved', 'closed'}:
            raise ValidationError({'detail': 'You can rate a complaint after it is resolved or closed.'})

        try:
            rating = int(request.data.get('rating'))
        except (TypeError, ValueError):
            raise ValidationError({'rating': 'Rating must be a number from 1 to 5.'})
        if rating < 1 or rating > 5:
            raise ValidationError({'rating': 'Rating must be between 1 and 5.'})

        comment = clean_plain_text(request.data.get('comment'), 1000, 'Feedback comment')
        with transaction.atomic():
            feedback, created = ComplaintFeedback.objects.update_or_create(
                complaint=complaint,
                defaults={
                    'student': request.user,
                    'rating': rating,
                    'comment': comment,
                },
            )
            admins = get_user_model().objects.filter(userrole__role__name='admin').distinct()
            for admin_user in admins:
                Notification.objects.create(
                    recipient=admin_user,
                    type='complaint_feedback',
                    payload={
                        'complaint_id': complaint.id,
                        'complaint_code': complaint.complaint_code or f'CMP-{complaint.id}',
                        'title': complaint.title,
                        'rating': rating,
                        'message': f"Student rated complaint {complaint.complaint_code or f'CMP-{complaint.id}'} {rating}/5.",
                    },
                )
            ComplaintNote.objects.create(
                complaint=complaint,
                author=request.user,
                note_type='response',
                note=f'[STUDENT FEEDBACK] Rating {rating}/5. {comment or "No comment."}',
            )

        return Response(
            {
                'id': feedback.id,
                'rating': feedback.rating,
                'comment': feedback.comment,
                'created_at': feedback.created_at,
                'updated_at': feedback.updated_at,
                'created': created,
            },
            status=201 if created else 200,
        )

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def transfer(self, request, pk=None):
        if not (user_is_staff(request.user) or user_is_admin(request.user)):
            raise PermissionDenied('You do not have permission to transfer complaints.')

        complaint = self.get_object()
        target_role_name = (request.data.get('target_role') or '').strip()
        target_user_id = request.data.get('target_user')
        reason = clean_plain_text(request.data.get('reason'), 1000, 'Transfer reason')
        target_role = None
        target_user = None

        if target_role_name:
            target_role = Role.objects.filter(name__iexact=target_role_name).first()
            if target_role is None:
                raise ValidationError({'target_role': f'Role "{target_role_name}" does not exist.'})

        if target_user_id:
            target_user = get_user_model().objects.filter(pk=target_user_id).first()
            if target_user is None:
                raise ValidationError({'target_user': 'Target user does not exist.'})

        if target_role is None and target_user is None:
            raise ValidationError({'detail': 'target_role or target_user is required.'})

        target_role_key = (target_role.name if target_role else '').lower()
        if target_role_key == 'admin':
            existing_admin_request = ComplaintNote.objects.filter(
                complaint=complaint,
                note__contains='[SEND TO ADMIN]',
            ).exists()
            existing_admin_transfer = ComplaintTransfer.objects.filter(
                complaint=complaint,
                transferred_to_role=target_role,
                status='open',
            ).first()

            if existing_admin_request or existing_admin_transfer:
                existing_transfer = existing_admin_transfer or ComplaintTransfer.objects.filter(
                    complaint=complaint,
                    transferred_to_role=target_role,
                ).order_by('-created_at').first()
                if existing_transfer:
                    return Response(ComplaintTransferSerializer(existing_transfer).data, status=200)
                return Response({'detail': 'Complaint already sent to admin.'}, status=200)

        from_roles = list(UserRole.objects.filter(user=request.user).values_list('role__name', flat=True))
        with transaction.atomic():
            ComplaintTransfer.objects.filter(complaint=complaint, status='open').update(status='accepted')
            transfer = ComplaintTransfer.objects.create(
                complaint=complaint,
                transferred_by=request.user,
                transferred_to_user=target_user,
                transferred_to_role=target_role,
                from_role=from_roles[0] if from_roles else '',
                reason=reason,
            )

            if target_role_key == 'admin':
                escalated_status = ComplaintStatus.objects.filter(name__iexact='Escalated').first()
                if escalated_status:
                    complaint.status = escalated_status
                    complaint.save()
                    ComplaintStatusHistory.objects.create(
                        complaint=complaint,
                        status=escalated_status,
                        changed_by=request.user,
                        note='Transferred to admin.',
                    )
                ComplaintNote.objects.create(
                    complaint=complaint,
                    author=request.user,
                    note_type='escalation',
                    note=f'[SEND TO ADMIN] {reason or "Transferred to admin for higher-level review."}',
                )

            recipients = []
            if target_user:
                recipients = [target_user]
            elif target_role:
                recipients = list(get_user_model().objects.filter(userrole__role=target_role).distinct())

            for recipient in recipients:
                Notification.objects.create(
                    recipient=recipient,
                    type='complaint_transferred',
                    payload={
                        'complaint_id': complaint.id,
                        'complaint_code': complaint.complaint_code or f'CMP-{complaint.id}',
                        'title': complaint.title,
                        'message': f"Complaint {complaint.complaint_code or f'CMP-{complaint.id}'} was transferred to you.",
                    },
                )

            Notification.objects.create(
                recipient=complaint.student,
                type='complaint_transferred',
                payload={
                    'complaint_id': complaint.id,
                    'complaint_code': complaint.complaint_code or f'CMP-{complaint.id}',
                    'title': complaint.title,
                    'message': f"Your complaint {complaint.complaint_code or f'CMP-{complaint.id}'} was transferred for higher-level review.",
                },
            )

        return Response(ComplaintTransferSerializer(transfer).data, status=201)


class ComplaintAssignmentViewSet(viewsets.ModelViewSet):
    serializer_class = ComplaintAssignmentSerializer
    permission_classes = [IsAuthenticated, IsStaff]

    def get_queryset(self):
        qs = ComplaintAssignment.objects.select_related('complaint', 'assigned_to', 'assigned_by')
        user = self.request.user
        if user_is_support(user):
            return qs.filter(assigned_to=user)
        if user_is_affairs(user) or user_is_admin(user):
            return qs
        return qs.none()

    def perform_create(self, serializer):
        if not (user_is_affairs(self.request.user) or user_is_admin(self.request.user)):
            raise PermissionDenied('You do not have permission to create assignments.')
        serializer.save(assigned_by=self.request.user)

    def perform_update(self, serializer):
        if not (user_is_affairs(self.request.user) or user_is_admin(self.request.user)):
            raise PermissionDenied('You do not have permission to update assignments.')
        serializer.save()

    def perform_destroy(self, instance):
        if not (user_is_affairs(self.request.user) or user_is_admin(self.request.user)):
            raise PermissionDenied('You do not have permission to delete assignments.')
        instance.delete()


class ComplaintTransferViewSet(viewsets.ModelViewSet):
    serializer_class = ComplaintTransferSerializer
    permission_classes = [IsAuthenticated, IsStaff]

    def get_queryset(self):
        qs = ComplaintTransfer.objects.select_related(
            'complaint', 'transferred_by', 'transferred_to_user', 'transferred_to_role'
        ).order_by('-created_at')
        user = self.request.user
        if user_is_admin(user) or user_is_affairs(user):
            return qs
        if user_is_support(user):
            return qs.filter(Q(transferred_by=user) | Q(transferred_to_user=user)).distinct()
        return qs.none()

    def perform_create(self, serializer):
        if not (user_is_staff(self.request.user) or user_is_admin(self.request.user)):
            raise PermissionDenied('You do not have permission to create transfers.')
        serializer.save(transferred_by=self.request.user)


class ComplaintNoteViewSet(viewsets.ModelViewSet):
    queryset = ComplaintNote.objects.all()
    serializer_class = ComplaintNoteSerializer
    permission_classes = [IsAuthenticated, IsStaff]

    def get_queryset(self):
        qs = ComplaintNote.objects.select_related('complaint', 'author')
        user = self.request.user
        if user_is_admin(user) or user_is_affairs(user):
            return qs
        if user_is_support(user):
            assigned_to_others = ComplaintAssignment.objects.filter(
                unassigned_at__isnull=True
            ).exclude(assigned_to=user).values_list('complaint_id', flat=True)
            return qs.filter(
                Q(complaint__complaintassignment__assigned_to=user, complaint__complaintassignment__unassigned_at__isnull=True)
                | Q(complaint__complaintnote__author=user)
                | Q(complaint__complaintassignment__isnull=True)
            ).exclude(complaint_id__in=assigned_to_others).distinct()
        return qs.none()

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


class ComplaintAttachmentViewSet(viewsets.ModelViewSet):
    queryset = ComplaintAttachment.objects.all()
    serializer_class = ComplaintAttachmentSerializer
    permission_classes = [IsAuthenticated, IsStaff]

    def get_queryset(self):
        qs = ComplaintAttachment.objects.select_related('complaint', 'uploaded_by')
        user = self.request.user
        if user_is_admin(user) or user_is_affairs(user):
            return qs
        if user_is_support(user):
            assigned_to_others = ComplaintAssignment.objects.filter(
                unassigned_at__isnull=True
            ).exclude(assigned_to=user).values_list('complaint_id', flat=True)
            return qs.filter(
                Q(complaint__complaintassignment__assigned_to=user, complaint__complaintassignment__unassigned_at__isnull=True)
                | Q(complaint__complaintnote__author=user)
                | Q(complaint__complaintassignment__isnull=True)
            ).exclude(complaint_id__in=assigned_to_others).distinct()
        return qs.none()

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)


class ComplaintStatusHistoryViewSet(viewsets.ModelViewSet):
    queryset = ComplaintStatusHistory.objects.all()
    serializer_class = ComplaintStatusHistorySerializer
    permission_classes = [IsAuthenticated, IsStaff]

    def get_queryset(self):
        qs = ComplaintStatusHistory.objects.select_related('complaint', 'status', 'changed_by')
        user = self.request.user
        if user_is_admin(user) or user_is_affairs(user):
            return qs
        if user_is_support(user):
            assigned_to_others = ComplaintAssignment.objects.filter(
                unassigned_at__isnull=True
            ).exclude(assigned_to=user).values_list('complaint_id', flat=True)
            return qs.filter(
                Q(complaint__complaintassignment__assigned_to=user, complaint__complaintassignment__unassigned_at__isnull=True)
                | Q(complaint__complaintnote__author=user)
                | Q(complaint__complaintassignment__isnull=True)
            ).exclude(complaint_id__in=assigned_to_others).distinct()
        return qs.none()

    def perform_create(self, serializer):
        serializer.save(changed_by=self.request.user)


class SLAPolicyViewSet(viewsets.ModelViewSet):
    queryset = SLAPolicy.objects.all()
    serializer_class = SLAPolicySerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        permission_classes = [IsAuthenticated, IsStaff] if self.action in ['list', 'retrieve'] else [IsAuthenticated, IsAdmin]
        return [permission() for permission in permission_classes]


class ComplaintSLAViewSet(viewsets.ModelViewSet):
    queryset = ComplaintSLA.objects.all()
    serializer_class = ComplaintSLASerializer
    permission_classes = [IsAuthenticated, IsStaff]

    def get_queryset(self):
        qs = ComplaintSLA.objects.select_related('complaint', 'policy')
        user = self.request.user
        if user_is_admin(user) or user_is_affairs(user):
            return qs
        if user_is_support(user):
            assigned_to_others = ComplaintAssignment.objects.filter(
                unassigned_at__isnull=True
            ).exclude(assigned_to=user).values_list('complaint_id', flat=True)
            return qs.filter(
                Q(complaint__complaintassignment__assigned_to=user, complaint__complaintassignment__unassigned_at__isnull=True)
                | Q(complaint__complaintnote__author=user)
                | Q(complaint__complaintassignment__isnull=True)
            ).exclude(complaint_id__in=assigned_to_others).distinct()
        return qs.none()


class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        permission_classes = [IsAuthenticated] if self.action in ['list', 'retrieve', 'partial_update', 'update', 'mark_all_read'] else [IsAuthenticated, IsAdmin]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        if user_is_admin(self.request.user):
            return Notification.objects.all().order_by('-created_at')
        return Notification.objects.filter(recipient=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save()

    @action(detail=False, methods=['post'], url_path='mark_all_read')
    def mark_all_read(self, request):
        Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
        return Response({'detail': 'All notifications marked as read.'}, status=200)


class ComplaintAIAnalysisViewSet(viewsets.ModelViewSet):
    queryset = ComplaintAIAnalysis.objects.all()
    serializer_class = ComplaintAIAnalysisSerializer
    permission_classes = [IsAuthenticated, IsStaff]

    def get_queryset(self):
        qs = ComplaintAIAnalysis.objects.select_related(
            'complaint', 'predicted_category', 'predicted_priority', 'routing_department'
        )
        user = self.request.user
        if user_is_admin(user) or user_is_affairs(user):
            return qs
        if user_is_support(user):
            assigned_to_others = ComplaintAssignment.objects.filter(
                unassigned_at__isnull=True
            ).exclude(assigned_to=user).values_list('complaint_id', flat=True)
            return qs.filter(
                Q(complaint__complaintassignment__assigned_to=user, complaint__complaintassignment__unassigned_at__isnull=True)
                | Q(complaint__complaintnote__author=user)
                | Q(complaint__complaintassignment__isnull=True)
            ).exclude(complaint_id__in=assigned_to_others).distinct()
        return qs.none()


class ReportSummaryView(APIView):
    permission_classes = [IsAuthenticated, IsStaff]

    def _complaint_row(self, complaint):
        return {
            'id': complaint.id,
            'complaint_code': complaint.complaint_code or f'CMP-{complaint.id}',
            'title': complaint.title,
            'category': str(complaint.category or ''),
            'priority': str(complaint.priority or ''),
            'status': str(complaint.status or ''),
            'student': complaint.student_id,
            'created_at': complaint.created_at,
            'updated_at': complaint.updated_at,
        }

    def get(self, request):
        enforce_overdue_escalations()
        complaints = Complaint.objects.select_related('student', 'status', 'priority', 'category')
        if not (user_is_admin(request.user) or user_is_affairs(request.user)):
            complaints = complaints.filter(
                Q(complaintassignment__assigned_to=request.user, complaintassignment__unassigned_at__isnull=True)
                | Q(complaintnote__author=request.user)
                | Q(complaintassignment__isnull=True)
            ).distinct()

        notes = ComplaintNote.objects.filter(complaint__in=complaints)
        transfers = ComplaintTransfer.objects.select_related(
            'complaint', 'transferred_by', 'transferred_to_user', 'transferred_to_role'
        ).filter(complaint__in=complaints)

        closed_keys = {'resolved', 'closed'}
        solved = []
        treated = []
        difficult = []
        overdue = []
        recurrent_groups = {}

        for complaint in complaints:
            status_key = str(complaint.status or '').strip().lower().replace(' ', '_')
            priority_key = str(complaint.priority or '').strip().lower().replace(' ', '_')
            is_closed = status_key in closed_keys
            allowed_days = {'critical': 2, 'high': 2, 'medium': 5, 'low': 7}.get(priority_key, 7)
            is_overdue = bool(
                not is_closed
                and complaint.created_at
                and complaint.created_at + timezone.timedelta(days=allowed_days) < timezone.now()
            )
            has_notes = notes.filter(complaint=complaint).exists()

            if is_closed:
                solved.append(complaint)
            if has_notes or status_key in {'in_progress', 'escalated', 'resolved', 'closed'}:
                treated.append(complaint)
            if priority_key in {'critical', 'high'} or is_overdue or transfers.filter(complaint=complaint).exists():
                difficult.append(complaint)
            if is_overdue:
                overdue.append(complaint)

            recurrent_key = f'{complaint.category_id}:{complaint.student_id}'
            group = recurrent_groups.setdefault(
                recurrent_key,
                {
                    'category': str(complaint.category or 'Other'),
                    'student': complaint.student_id,
                    'count': 0,
                    'latest': complaint,
                },
            )
            group['count'] += 1
            if complaint.created_at > group['latest'].created_at:
                group['latest'] = complaint

        recurrent = [
            {
                'category': group['category'],
                'student': group['student'],
                'count': group['count'],
                'latest': self._complaint_row(group['latest']),
            }
            for group in recurrent_groups.values()
            if group['count'] > 1
        ]

        return Response(
            {
                'stats': {
                    'submitted': complaints.count(),
                    'solved': len(solved),
                    'treated': len(treated),
                    'difficult': len(difficult),
                    'recurrent': len(recurrent),
                    'transferred': transfers.count(),
                    'overdue': len(overdue),
                    'escalated': complaints.filter(status__name__iexact='Escalated').count(),
                },
                'solved_complaints': [self._complaint_row(item) for item in solved[:25]],
                'treated_complaints': [self._complaint_row(item) for item in treated[:25]],
                'difficult_complaints': [self._complaint_row(item) for item in difficult[:25]],
                'recurrent_complaints': recurrent[:25],
                'transferred_complaints': ComplaintTransferSerializer(transfers[:25], many=True).data,
            }
        )
