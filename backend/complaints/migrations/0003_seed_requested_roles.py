from django.db import migrations


def seed_requested_roles(apps, schema_editor):
    Role = apps.get_model('complaints', 'Role')
    for role_name in ['admin', 'student', 'affairs', 'support_offcier']:
        Role.objects.get_or_create(name=role_name)


class Migration(migrations.Migration):

    dependencies = [
        ('complaints', '0002_seed_default_roles'),
    ]

    operations = [
        migrations.RunPython(seed_requested_roles, migrations.RunPython.noop),
    ]
