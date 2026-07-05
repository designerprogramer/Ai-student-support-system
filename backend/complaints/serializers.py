from django.contrib.auth import get_user_model
from django.utils import timezone
from django.utils.html import strip_tags
import os
import re
from rest_framework import serializers
from .models import (
    Role,
    UserRole,
    UserProfile,
    LoginSecurityState,
    LoginAuditLog,
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

User = get_user_model()
ALLOWED_ROLES = {'student'}
MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
MAX_PROFILE_IMAGE_BYTES = 2 * 1024 * 1024
ALLOWED_ATTACHMENT_TYPES = {
    'image/jpeg': {'.jpg', '.jpeg'},
    'image/png': {'.png'},
    'application/pdf': {'.pdf'},
    'application/msword': {'.doc'},
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {'.docx'},
}
ALLOWED_PROFILE_IMAGE_TYPES = {
    'image/jpeg': {'.jpg', '.jpeg'},
    'image/png': {'.png'},
}


def normalize_role_name(role_name: str) -> str:
    return (role_name or '').strip().lower().replace('-', '_').replace(' ', '_')


def validate_uploaded_file(file_obj, allowed_types, max_bytes, field_name):
    if not file_obj:
        return file_obj

    size = int(getattr(file_obj, 'size', 0) or 0)
    if size <= 0:
        raise serializers.ValidationError(f'{field_name} cannot be empty.')
    if size > max_bytes:
        mb = max_bytes // (1024 * 1024)
        raise serializers.ValidationError(f'{field_name} must be {mb}MB or smaller.')

    content_type = (getattr(file_obj, 'content_type', '') or '').lower()
    extension = os.path.splitext(getattr(file_obj, 'name', '') or '')[1].lower()
    allowed_extensions = allowed_types.get(content_type)
    if not allowed_extensions or extension not in allowed_extensions:
        raise serializers.ValidationError(f'{field_name} file type is not allowed.')

    return file_obj


class CaseInsensitiveSlugRelatedField(serializers.SlugRelatedField):
    default_error_messages = {
        'does_not_exist': 'Object with {slug_name}="{value}" does not exist.',
        'invalid': 'Invalid value. Expected a non-empty string or an existing id.',
    }

    def to_internal_value(self, data):
        queryset = self.get_queryset()
        if queryset is None:
            self.fail('invalid')

        text = str(data).strip()
        if not text:
            self.fail('invalid')

        by_pk = None
        try:
            by_pk = queryset.filter(pk=text).first()
        except (TypeError, ValueError):
            by_pk = None
        if by_pk is not None:
            return by_pk

        lookup = {f'{self.slug_field}__iexact': text}
        by_slug = queryset.filter(**lookup).first()
        if by_slug is not None:
            return by_slug

        self.fail('does_not_exist', slug_name=self.slug_field, value=data)


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ['id', 'name']


class UserProfileSerializer(serializers.ModelSerializer):
    profile_image_url = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = [
            'id',
            'user',
            'full_name',
            'profile_image',
            'profile_image_url',
            'student_number',
            'staff_number',
            'program',
            'year_of_study',
            'department',
        ]
        read_only_fields = ['profile_image_url']

    def get_profile_image_url(self, obj):
        if not obj.profile_image:
            return ''
        request = self.context.get('request')
        url = obj.profile_image.url
        return request.build_absolute_uri(url) if request else url

    def validate_full_name(self, value):
        cleaned = clean_plain_text(value, 200, 'Full name')
        if not cleaned:
            raise serializers.ValidationError('Full name is required.')
        return cleaned

    def validate_student_number(self, value):
        return clean_plain_text(value, 50, 'Student number')

    def validate_staff_number(self, value):
        return clean_plain_text(value, 50, 'Staff number')

    def validate_program(self, value):
        return clean_plain_text(value, 120, 'Program')

    def validate_profile_image(self, value):
        return validate_uploaded_file(
            value,
            ALLOWED_PROFILE_IMAGE_TYPES,
            MAX_PROFILE_IMAGE_BYTES,
            'Profile picture',
        )


class UserSerializer(serializers.ModelSerializer):
    roles = serializers.SerializerMethodField()
    profile = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'is_active',
            'roles',
            'profile',
        ]

    def validate_username(self, value):
        username = (value or '').strip()
        if len(username) > 50:
            raise serializers.ValidationError('Username must be 50 characters or fewer.')
        return username

    def validate_email(self, value):
        email = (value or '').strip().lower()
        if email and User.objects.filter(email__iexact=email).exclude(pk=getattr(self.instance, 'pk', None)).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return email

    def get_roles(self, obj):
        return list(obj.userrole_set.select_related('role').values_list('role__name', flat=True))

    def get_profile(self, obj):
        profile = getattr(obj, 'userprofile', None)
        if not profile:
            return None
        request = self.context.get('request')
        profile_image_url = ''
        if profile.profile_image:
            profile_image_url = (
                request.build_absolute_uri(profile.profile_image.url)
                if request
                else profile.profile_image.url
            )
        return {
            'full_name': profile.full_name,
            'profile_image_url': profile_image_url,
            'student_number': profile.student_number,
            'staff_number': profile.staff_number,
            'program': profile.program,
            'year_of_study': profile.year_of_study,
            'department': profile.department_id,
        }


class UserRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserRole
        fields = ['id', 'user', 'role']


class LoginSecurityStateSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoginSecurityState
        fields = [
            'id',
            'username',
            'role',
            'failed_attempts',
            'failure_reason',
            'locked_until',
            'last_failed_at',
            'admin_notified_at',
            'updated_at',
        ]


class LoginAuditLogSerializer(serializers.ModelSerializer):
    user_display = serializers.SerializerMethodField()

    class Meta:
        model = LoginAuditLog
        fields = [
            'id',
            'username',
            'role',
            'event',
            'failure_reason',
            'failed_attempts',
            'locked_until',
            'ip_address',
            'user_agent',
            'user',
            'user_display',
            'created_at',
        ]

    def get_user_display(self, obj):
        if not obj.user:
            return ''
        profile = getattr(obj.user, 'userprofile', None)
        if profile and profile.full_name:
            return profile.full_name
        return obj.user.get_full_name() or obj.user.username


class RegistrationSerializer(serializers.Serializer):
    email = serializers.EmailField()
    username = serializers.CharField(max_length=50)
    password = serializers.CharField(write_only=True)
    full_name = serializers.CharField()
    role = serializers.CharField(default='student')

    def create(self, validated_data):
        role_name = normalize_role_name(validated_data.pop('role', 'student'))
        if role_name not in ALLOWED_ROLES:
            raise serializers.ValidationError({'role': 'Invalid role selected.'})

        full_name = validated_data.pop('full_name')
        password = validated_data.pop('password')
        validated_data['email'] = validated_data.get('email', '').strip().lower()
        validated_data['username'] = validated_data.get('username', '').strip()

        if User.objects.filter(username__iexact=validated_data['username']).exists():
            raise serializers.ValidationError({'username': 'A user with this student ID already exists.'})
        if User.objects.filter(email__iexact=validated_data['email']).exists():
            raise serializers.ValidationError({'email': 'A user with this email already exists.'})

        user = User(**validated_data)
        user.set_password(password)
        user.save()

        profile = UserProfile.objects.create(user=user, full_name=full_name)

        role, _ = Role.objects.get_or_create(name=role_name)
        UserRole.objects.get_or_create(user=user, role=role)

        return {
            'user': user,
            'profile': profile,
            'role': role,
        }


class RoleLoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=50)
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        username = attrs.get('username', '').strip()
        password = attrs.get('password')

        if not username:
            raise serializers.ValidationError({'username': 'Username is required.'})
        if not password:
            raise serializers.ValidationError({'password': 'Password is required.'})
        if len(username) > 50:
            raise serializers.ValidationError({'username': 'Username must be 50 characters or fewer.'})

        attrs['username'] = username
        return attrs


def clean_plain_text(value: str, max_length: int, field_name: str) -> str:
    text = strip_tags(str(value or '')).replace('\x00', '').strip()
    text = re.sub(r'[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
    if len(text) > max_length:
        raise serializers.ValidationError(f'{field_name} must be {max_length} characters or fewer.')
    return text


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'name', 'description', 'active']

    def validate_name(self, value):
        cleaned = clean_plain_text(value, 100, 'Department name')
        if not cleaned:
            raise serializers.ValidationError('Department name is required.')
        return cleaned

    def validate_description(self, value):
        return clean_plain_text(value, 1000, 'Department description')


class ComplaintCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ComplaintCategory
        fields = ['id', 'name', 'description', 'department', 'active']

    def validate_name(self, value):
        cleaned = clean_plain_text(value, 100, 'Category name')
        if not cleaned:
            raise serializers.ValidationError('Category name is required.')
        return cleaned

    def validate_description(self, value):
        return clean_plain_text(value, 1000, 'Category description')


class ComplaintSourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = ComplaintSource
        fields = ['id', 'name']

    def validate_name(self, value):
        cleaned = clean_plain_text(value, 50, 'Source name')
        if not cleaned:
            raise serializers.ValidationError('Source name is required.')
        return cleaned


class ComplaintPrioritySerializer(serializers.ModelSerializer):
    class Meta:
        model = ComplaintPriority
        fields = ['id', 'name', 'description']

    def validate_name(self, value):
        cleaned = clean_plain_text(value, 50, 'Priority name')
        if not cleaned:
            raise serializers.ValidationError('Priority name is required.')
        return cleaned

    def validate_description(self, value):
        return clean_plain_text(value, 1000, 'Priority description')


class ComplaintStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = ComplaintStatus
        fields = ['id', 'name']

    def validate_name(self, value):
        cleaned = clean_plain_text(value, 50, 'Status name')
        if not cleaned:
            raise serializers.ValidationError('Status name is required.')
        return cleaned


class ComplaintSerializer(serializers.ModelSerializer):
    source = serializers.CharField(required=False, allow_blank=True)
    category = serializers.CharField(required=False, allow_blank=True)
    priority = serializers.CharField(required=False, allow_blank=True)
    status = serializers.CharField(required=False, allow_blank=True)
    effective_status = serializers.SerializerMethodField()
    effective_status_reason = serializers.SerializerMethodField()
    student_number = serializers.SerializerMethodField()
    student_name = serializers.SerializerMethodField()
    feedback_rating = serializers.SerializerMethodField()
    feedback_comment = serializers.SerializerMethodField()
    feedback_created_at = serializers.SerializerMethodField()
    feedback_updated_at = serializers.SerializerMethodField()
    student_id = serializers.CharField(write_only=True, required=False, allow_blank=True)
    attachments = serializers.FileField(required=False, write_only=True)

    class Meta:
        model = Complaint
        fields = [
            'id',
            'complaint_code',
            'student',
            'submitted_by',
            'source',
            'category',
            'priority',
            'status',
            'effective_status',
            'effective_status_reason',
            'student_number',
            'student_name',
            'feedback_rating',
            'feedback_comment',
            'feedback_created_at',
            'feedback_updated_at',
            'title',
            'description',
            'original_text',
            'translated_text',
            'detected_language',
            'sentiment',
            'urgency',
            'confidence_score',
            'auto_priority',
            'created_at',
            'updated_at',
            'resolved_at',
            'student_id',
            'attachments',
        ]
        read_only_fields = [
            'complaint_code',
            'created_at',
            'updated_at',
            'original_text',
            'translated_text',
            'detected_language',
            'sentiment',
            'urgency',
            'confidence_score',
            'auto_priority',
            'feedback_rating',
            'feedback_comment',
            'feedback_created_at',
            'feedback_updated_at',
        ]
        extra_kwargs = {
            'student': {'required': False},
            'submitted_by': {'required': False},
            'source': {'required': False},
            'category': {'required': False},
            'priority': {'required': False},
            'status': {'required': False},
        }

    def _is_sent_to_admin(self, obj):
        return ComplaintNote.objects.filter(
            complaint=obj,
            note__contains='[SEND TO ADMIN]',
        ).exists()

    def _has_admin_response(self, obj):
        return ComplaintNote.objects.filter(
            complaint=obj,
            note__contains='[ADMIN RESPONSE]',
        ).exists()

    def _is_overdue(self, obj):
        status_key = str(obj.status or '').strip().lower().replace(' ', '_')
        if status_key in {'resolved', 'closed'}:
            return False

        priority_days = {
            'critical': 2,
            'high': 2,
            'medium': 5,
            'low': 7,
        }
        priority_key = str(obj.priority or '').strip().lower().replace(' ', '_')
        allowed_days = priority_days.get(priority_key, 7)
        return bool(obj.created_at and obj.created_at + timezone.timedelta(days=allowed_days) < timezone.now())

    def _looks_like_student_id(self, value, student_number=''):
        text = str(value or '').strip()
        id_text = str(student_number or '').strip()
        if not text:
            return True
        if id_text and text == id_text:
            return True
        if re.fullmatch(r'\d+', text):
            return True
        return bool(re.fullmatch(r'[A-Za-z0-9_-]+', text) and re.search(r'\d', text) and len(text) >= 4)

    def get_effective_status(self, obj):
        status_name = str(obj.status or '').strip()
        status_key = status_name.lower().replace(' ', '_')
        if status_key in {'resolved', 'closed'}:
            return status_name

        if self._has_admin_response(obj):
            return 'Resolved'

        if self._is_sent_to_admin(obj):
            return 'Escalated'

        if self._is_overdue(obj):
            return 'Escalated'

        return status_name

    def get_effective_status_reason(self, obj):
        if self._has_admin_response(obj):
            return 'admin_response'
        if self._is_sent_to_admin(obj):
            return 'sent_to_admin'
        if self._is_overdue(obj):
            return 'overdue'
        return ''

    def get_student_number(self, obj):
        profile = getattr(obj.student, 'userprofile', None)
        if profile and profile.student_number:
            return profile.student_number
        return obj.student.username if obj.student else ''

    def get_student_name(self, obj):
        profile = getattr(obj.student, 'userprofile', None)
        student_number = self.get_student_number(obj)
        if profile and profile.full_name and not self._looks_like_student_id(profile.full_name, student_number):
            return profile.full_name
        if not obj.student:
            return ''
        account_name = obj.student.get_full_name()
        if account_name and not self._looks_like_student_id(account_name, student_number):
            return account_name
        first_name = getattr(obj.student, 'first_name', '')
        if first_name and not self._looks_like_student_id(first_name, student_number):
            return first_name
        return ''

    def get_feedback_rating(self, obj):
        feedback = getattr(obj, 'feedback', None)
        return feedback.rating if feedback else None

    def get_feedback_comment(self, obj):
        feedback = getattr(obj, 'feedback', None)
        return feedback.comment if feedback else ''

    def get_feedback_created_at(self, obj):
        feedback = getattr(obj, 'feedback', None)
        return feedback.created_at if feedback else None

    def get_feedback_updated_at(self, obj):
        feedback = getattr(obj, 'feedback', None)
        return feedback.updated_at if feedback else None

    def create(self, validated_data):
        attachments = validated_data.pop('attachments', None)
        validated_data.pop('student_id', None)
        for relation_name in ('source', 'category', 'priority', 'status'):
            if isinstance(validated_data.get(relation_name), str):
                validated_data.pop(relation_name, None)
        complaint = super().create(validated_data)
        self._attachments = attachments
        return complaint

    @property
    def attachments_data(self):
        return getattr(self, '_attachments', [])

    def validate_title(self, value):
        return clean_plain_text(value, 200, 'Title')

    def validate_description(self, value):
        cleaned = clean_plain_text(value, 5000, 'Description')
        if not cleaned:
            raise serializers.ValidationError('Description is required.')
        return cleaned

    def validate_attachments(self, value):
        return validate_uploaded_file(
            value,
            ALLOWED_ATTACHMENT_TYPES,
            MAX_ATTACHMENT_BYTES,
            'Attachment',
        )


class ComplaintAssignmentSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.SerializerMethodField()
    assigned_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ComplaintAssignment
        fields = [
            'id',
            'complaint',
            'assigned_to',
            'assigned_to_name',
            'assigned_by',
            'assigned_by_name',
            'assigned_at',
            'unassigned_at',
            'auto_assigned',
        ]

    def get_assigned_to_name(self, obj):
        profile = getattr(obj.assigned_to, 'userprofile', None)
        if profile and profile.full_name:
            return profile.full_name
        return obj.assigned_to.get_full_name() or obj.assigned_to.username

    def get_assigned_by_name(self, obj):
        if not obj.assigned_by:
            return "System"
        profile = getattr(obj.assigned_by, 'userprofile', None)
        if profile and profile.full_name:
            return profile.full_name
        return obj.assigned_by.get_full_name() or obj.assigned_by.username


class ComplaintTransferSerializer(serializers.ModelSerializer):
    complaint_code = serializers.SerializerMethodField()
    transferred_by_name = serializers.SerializerMethodField()
    transferred_to_name = serializers.SerializerMethodField()
    transferred_to_role_name = serializers.SerializerMethodField()

    class Meta:
        model = ComplaintTransfer
        fields = [
            'id',
            'complaint',
            'complaint_code',
            'transferred_by',
            'transferred_by_name',
            'transferred_to_user',
            'transferred_to_name',
            'transferred_to_role',
            'transferred_to_role_name',
            'from_role',
            'reason',
            'status',
            'created_at',
        ]
        read_only_fields = ['created_at']

    def get_complaint_code(self, obj):
        return obj.complaint.complaint_code or f'CMP-{obj.complaint_id}'

    def get_transferred_by_name(self, obj):
        profile = getattr(obj.transferred_by, 'userprofile', None)
        if profile and profile.full_name:
            return profile.full_name
        return obj.transferred_by.get_full_name() or obj.transferred_by.username

    def get_transferred_to_name(self, obj):
        if not obj.transferred_to_user:
            return ''
        profile = getattr(obj.transferred_to_user, 'userprofile', None)
        if profile and profile.full_name:
            return profile.full_name
        return obj.transferred_to_user.get_full_name() or obj.transferred_to_user.username

    def get_transferred_to_role_name(self, obj):
        return obj.transferred_to_role.name if obj.transferred_to_role else ''

    def validate_reason(self, value):
        return clean_plain_text(value, 1000, 'Transfer reason')


class ComplaintNoteSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = ComplaintNote
        fields = ['id', 'complaint', 'author', 'author_name', 'note_type', 'note', 'created_at']

    def get_author_name(self, obj):
        profile = getattr(obj.author, 'userprofile', None)
        if profile and profile.full_name:
            return profile.full_name
        return obj.author.get_full_name() or obj.author.username

    def validate_note(self, value):
        cleaned = clean_plain_text(value, 5000, 'Note')
        if not cleaned:
            raise serializers.ValidationError('Note is required.')
        return cleaned


class ComplaintAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ComplaintAttachment
        fields = [
            'id',
            'complaint',
            'uploaded_by',
            'file',
            'file_name',
            'mime_type',
            'file_size_bytes',
            'uploaded_at',
        ]
        read_only_fields = ['uploaded_at']

    def validate_file(self, value):
        return validate_uploaded_file(
            value,
            ALLOWED_ATTACHMENT_TYPES,
            MAX_ATTACHMENT_BYTES,
            'Attachment',
        )


class ComplaintStatusHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ComplaintStatusHistory
        fields = ['id', 'complaint', 'status', 'changed_by', 'changed_at', 'note']


class SLAPolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = SLAPolicy
        fields = [
            'id',
            'name',
            'priority',
            'category',
            'target_response_hours',
            'target_resolution_hours',
            'escalation_hours',
            'active',
        ]


class ComplaintSLASerializer(serializers.ModelSerializer):
    class Meta:
        model = ComplaintSLA
        fields = [
            'id',
            'complaint',
            'policy',
            'response_due_at',
            'resolution_due_at',
            'escalated_at',
            'is_overdue',
        ]


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'recipient', 'type', 'channel', 'payload', 'is_read', 'created_at']


class ComplaintAIAnalysisSerializer(serializers.ModelSerializer):
    class Meta:
        model = ComplaintAIAnalysis
        fields = [
            'id',
            'complaint',
            'predicted_category',
            'predicted_priority',
            'routing_department',
            'confidence',
            'model_version',
            'processed_at',
            'raw_output',
        ]
