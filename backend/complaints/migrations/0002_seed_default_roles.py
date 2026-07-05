from django.db import migrations


def seed_default_roles(apps, schema_editor):
    Role = apps.get_model('complaints', 'Role')
    for role_name in ['student', 'support_officer', 'affairs', 'admin', 'staff']:
        Role.objects.get_or_create(name=role_name)


class Migration(migrations.Migration):

    dependencies = [
        ('complaints', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_default_roles, migrations.RunPython.noop),
    ]
