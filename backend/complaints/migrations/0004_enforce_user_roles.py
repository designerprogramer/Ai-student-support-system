from django.db import migrations


def enforce_user_roles(apps, schema_editor):
    Role = apps.get_model('complaints', 'Role')
    UserRole = apps.get_model('complaints', 'UserRole')

    required_roles = ['admin', 'student', 'affairs', 'support_offcier']
    role_map = {}
    for role_name in required_roles:
        role_map[role_name], _ = Role.objects.get_or_create(name=role_name)

    support_officer_role = Role.objects.filter(name='support_officer').first()
    support_offcier_role = role_map['support_offcier']
    if support_officer_role:
        for user_id in UserRole.objects.filter(role=support_officer_role).values_list('user_id', flat=True):
            UserRole.objects.get_or_create(user_id=user_id, role=support_offcier_role)
        UserRole.objects.filter(role=support_officer_role).delete()

    Role.objects.filter(name='staff').delete()
    Role.objects.filter(name='support_officer').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('complaints', '0003_seed_requested_roles'),
    ]

    operations = [
        migrations.RunPython(enforce_user_roles, migrations.RunPython.noop),
    ]
