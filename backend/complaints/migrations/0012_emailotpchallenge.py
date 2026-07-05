from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('complaints', '0011_complaintfeedback'),
    ]

    operations = [
        migrations.CreateModel(
            name='EmailOTPChallenge',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('purpose', models.CharField(choices=[('login', 'Login'), ('password_reset', 'Password Reset')], max_length=30)),
                ('role', models.CharField(blank=True, max_length=50)),
                ('email', models.EmailField(max_length=254)),
                ('code_hash', models.CharField(max_length=128)),
                ('failed_attempts', models.PositiveIntegerField(default=0)),
                ('max_attempts', models.PositiveIntegerField(default=5)),
                ('expires_at', models.DateTimeField()),
                ('used_at', models.DateTimeField(blank=True, null=True)),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('user_agent', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AddIndex(
            model_name='emailotpchallenge',
            index=models.Index(fields=['user', 'purpose', 'role'], name='complaints__user_id_1a7388_idx'),
        ),
        migrations.AddIndex(
            model_name='emailotpchallenge',
            index=models.Index(fields=['expires_at'], name='complaints__expires_24d677_idx'),
        ),
        migrations.AddIndex(
            model_name='emailotpchallenge',
            index=models.Index(fields=['used_at'], name='complaints__used_at_524db6_idx'),
        ),
    ]
