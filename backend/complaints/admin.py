from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from . import models
from .admin_forms import RoleAwareUserCreationForm


User = get_user_model()


def normalize_role_name(role_name: str) -> str:
    return (role_name or '').strip().lower().replace('-', '_').replace(' ', '_')


class UserRoleInline(admin.TabularInline):
    model = models.UserRole
    extra = 0


class UserAdmin(DjangoUserAdmin):
    add_form = RoleAwareUserCreationForm
    inlines = [UserRoleInline]
    list_display = ('username', 'email', 'is_staff', 'is_active', 'role_list')
    add_fieldsets = (
        (
            'Required details',
            {
                'classes': ('wide',),
                'fields': ('role', 'student_id', 'username', 'email', 'password1', 'password2'),
                'description': (
                    'Student: provide student ID + password. '
                    'Affairs/Admin/Support: provide username + email + password.'
                ),
            },
        ),
    )

    def role_list(self, obj):
        return ', '.join(obj.userrole_set.values_list('role__name', flat=True))

    role_list.short_description = 'Roles'

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        if change:
            return

        role = form.cleaned_data.get('role')
        if role:
            models.UserRole.objects.get_or_create(user=obj, role=role)
            role_name = normalize_role_name(role.name)
            student_id = (form.cleaned_data.get('student_id') or '').strip()
            if role_name == 'student' and student_id:
                profile, created = models.UserProfile.objects.get_or_create(
                    user=obj,
                    defaults={
                        'full_name': obj.username,
                        'student_number': student_id,
                    },
                )
                if not created:
                    if not profile.full_name:
                        profile.full_name = obj.username
                    if not profile.student_number:
                        profile.student_number = student_id
                    profile.save()


try:
    admin.site.unregister(User)
except admin.sites.NotRegistered:
    pass

admin.site.register(User, UserAdmin)


admin.site.register(models.Role)
admin.site.register(models.UserRole)
admin.site.register(models.UserProfile)
admin.site.register(models.LoginSecurityState)
admin.site.register(models.LoginAuditLog)
admin.site.register(models.EmailOTPChallenge)
admin.site.register(models.Department)
admin.site.register(models.ComplaintCategory)
admin.site.register(models.ComplaintSource)
admin.site.register(models.ComplaintPriority)
admin.site.register(models.ComplaintStatus)
admin.site.register(models.Complaint)
admin.site.register(models.ComplaintAssignment)
admin.site.register(models.ComplaintTransfer)
admin.site.register(models.ComplaintNote)
admin.site.register(models.ComplaintAttachment)
admin.site.register(models.ComplaintStatusHistory)
admin.site.register(models.SLAPolicy)
admin.site.register(models.ComplaintSLA)
admin.site.register(models.Notification)
admin.site.register(models.ComplaintAIAnalysis)
