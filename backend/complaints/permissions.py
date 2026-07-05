from rest_framework.permissions import BasePermission
from .models import UserRole


ROLE_ALIASES = {
    'student': {'student'},
    'support_officer': {'support_officer', 'support_offcier', 'support officer', 'support'},
    'support_offcier': {'support_officer', 'support_offcier', 'support officer', 'support'},
    'affairs': {'affairs', 'affairs_officer', 'affairs officer', 'student_affairs'},
    'admin': {'admin', 'administrator'},
}


def normalize_role_name(role_name: str) -> str:
    return (role_name or '').strip().lower().replace('-', '_').replace(' ', '_')


def role_alias_set(role_name: str) -> set[str]:
    canonical = normalize_role_name(role_name)
    aliases = ROLE_ALIASES.get(canonical, {canonical})
    return {normalize_role_name(alias) for alias in aliases}


def user_has_role(user, role_name: str) -> bool:
    if not user or not user.is_authenticated:
        return False

    user_roles = {
        normalize_role_name(name)
        for name in UserRole.objects.filter(user=user).values_list('role__name', flat=True)
    }
    return any(alias in user_roles for alias in role_alias_set(role_name))


def user_has_any_role(user, role_names: list[str]) -> bool:
    return any(user_has_role(user, role_name) for role_name in role_names)


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return user_has_role(request.user, 'admin')


class IsStaff(BasePermission):
    def has_permission(self, request, view):
        return user_has_any_role(request.user, ['support_offcier', 'support_officer', 'affairs', 'admin'])


class IsStudent(BasePermission):
    def has_permission(self, request, view):
        return user_has_role(request.user, 'student')
