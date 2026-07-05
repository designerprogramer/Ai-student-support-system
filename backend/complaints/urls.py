from rest_framework.routers import DefaultRouter
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

router = DefaultRouter()
router.register('auth/register', views.RegistrationViewSet, basename='register')
router.register('roles', views.RoleViewSet)
router.register('users', views.UserViewSet, basename='users')
router.register('user-roles', views.UserRoleViewSet)
router.register('profiles', views.UserProfileViewSet)
router.register('login-security', views.LoginSecurityStateViewSet, basename='login-security')
router.register('login-audit-logs', views.LoginAuditLogViewSet, basename='login-audit-logs')
router.register('departments', views.DepartmentViewSet)
router.register('categories', views.ComplaintCategoryViewSet)
router.register('sources', views.ComplaintSourceViewSet)
router.register('priorities', views.ComplaintPriorityViewSet)
router.register('statuses', views.ComplaintStatusViewSet)
router.register('complaints', views.ComplaintViewSet, basename='complaints')
router.register('assignments', views.ComplaintAssignmentViewSet, basename='assignments')
router.register('transfers', views.ComplaintTransferViewSet, basename='transfers')
router.register('notes', views.ComplaintNoteViewSet)
router.register('attachments', views.ComplaintAttachmentViewSet)
router.register('status-history', views.ComplaintStatusHistoryViewSet)
router.register('sla-policies', views.SLAPolicyViewSet)
router.register('complaint-sla', views.ComplaintSLAViewSet)
router.register('notifications', views.NotificationViewSet, basename='notifications')
router.register('ai-analysis', views.ComplaintAIAnalysisViewSet)

urlpatterns = [
    path('public/landing/', views.PublicLandingView.as_view(), name='public_landing'),
    path('reports/summary/', views.ReportSummaryView.as_view(), name='reports_summary'),
    path('auth/login/student/', views.StudentLoginView.as_view(), name='auth_login_student'),
    path('auth/login/support/', views.SupportOfficerLoginView.as_view(), name='auth_login_support'),
    path('auth/login/affairs/', views.AffairsLoginView.as_view(), name='auth_login_affairs'),
    path('auth/login/admin/', views.AdminLoginView.as_view(), name='auth_login_admin'),
    path('auth/login/verify-otp/', views.OTPVerifyView.as_view(), name='auth_login_verify_otp'),
    path('auth/password-reset/request/', views.PasswordResetRequestView.as_view(), name='auth_password_reset_request'),
    path('auth/password-reset/confirm/', views.PasswordResetConfirmView.as_view(), name='auth_password_reset_confirm'),
    path('auth/me/email/', views.AccountEmailView.as_view(), name='auth_me_email'),
    path('auth/me/password/', views.AccountPasswordView.as_view(), name='auth_me_password'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='auth_token_refresh'),
    path('', include(router.urls)),
]
