from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Complaint',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('complaint_code', models.CharField(blank=True, max_length=32, null=True, unique=True)),
                ('title', models.CharField(blank=True, max_length=200)),
                ('description', models.TextField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('resolved_at', models.DateTimeField(blank=True, null=True)),
            ],
        ),
        migrations.CreateModel(
            name='ComplaintPriority',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=50, unique=True)),
                ('description', models.TextField(blank=True)),
            ],
        ),
        migrations.CreateModel(
            name='ComplaintSource',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=50, unique=True)),
            ],
        ),
        migrations.CreateModel(
            name='ComplaintStatus',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=50, unique=True)),
            ],
        ),
        migrations.CreateModel(
            name='Department',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, unique=True)),
                ('description', models.TextField(blank=True)),
                ('active', models.BooleanField(default=True)),
            ],
        ),
        migrations.CreateModel(
            name='Notification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('type', models.CharField(max_length=50)),
                ('channel', models.CharField(default='in_app', max_length=30)),
                ('payload', models.JSONField()),
                ('is_read', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('recipient', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='Role',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=50, unique=True)),
            ],
        ),
        migrations.CreateModel(
            name='ComplaintCategory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('description', models.TextField(blank=True)),
                ('active', models.BooleanField(default=True)),
                ('department', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='complaints.department')),
            ],
            options={
                'unique_together': {('department', 'name')},
            },
        ),
        migrations.CreateModel(
            name='ComplaintAIAnalysis',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('confidence', models.FloatField(blank=True, null=True)),
                ('model_version', models.CharField(blank=True, max_length=50)),
                ('processed_at', models.DateTimeField(auto_now_add=True)),
                ('raw_output', models.JSONField(blank=True, null=True)),
                ('predicted_category', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='complaints.complaintcategory')),
                ('predicted_priority', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='complaints.complaintpriority')),
                ('routing_department', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='complaints.department')),
            ],
        ),
        migrations.CreateModel(
            name='SLAPolicy',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=120, unique=True)),
                ('target_response_hours', models.IntegerField()),
                ('target_resolution_hours', models.IntegerField()),
                ('escalation_hours', models.IntegerField()),
                ('active', models.BooleanField(default=True)),
                ('category', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='complaints.complaintcategory')),
                ('priority', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='complaints.complaintpriority')),
            ],
        ),
        migrations.CreateModel(
            name='UserProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('full_name', models.CharField(max_length=200)),
                ('student_number', models.CharField(blank=True, max_length=50)),
                ('staff_number', models.CharField(blank=True, max_length=50)),
                ('program', models.CharField(blank=True, max_length=120)),
                ('year_of_study', models.IntegerField(blank=True, null=True)),
                ('department', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='complaints.department')),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='UserRole',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('role', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='complaints.role')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'unique_together': {('user', 'role')},
            },
        ),
        migrations.AddField(
            model_name='complaint',
            name='category',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='complaints.complaintcategory'),
        ),
        migrations.AddField(
            model_name='complaint',
            name='priority',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='complaints.complaintpriority'),
        ),
        migrations.AddField(
            model_name='complaint',
            name='source',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='complaints.complaintsource'),
        ),
        migrations.AddField(
            model_name='complaint',
            name='status',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='complaints.complaintstatus'),
        ),
        migrations.AddField(
            model_name='complaint',
            name='student',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='complaints', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='complaint',
            name='submitted_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='submitted_complaints', to=settings.AUTH_USER_MODEL),
        ),
        migrations.CreateModel(
            name='ComplaintAssignment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('assigned_at', models.DateTimeField(auto_now_add=True)),
                ('unassigned_at', models.DateTimeField(blank=True, null=True)),
                ('auto_assigned', models.BooleanField(default=False)),
                ('assigned_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='assigned_complaints', to=settings.AUTH_USER_MODEL)),
                ('assigned_to', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='assignments', to=settings.AUTH_USER_MODEL)),
                ('complaint', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='complaints.complaint')),
            ],
        ),
        migrations.CreateModel(
            name='ComplaintAttachment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('file', models.FileField(upload_to='complaints/')),
                ('file_name', models.CharField(blank=True, max_length=255)),
                ('mime_type', models.CharField(blank=True, max_length=100)),
                ('file_size_bytes', models.BigIntegerField(blank=True, null=True)),
                ('uploaded_at', models.DateTimeField(auto_now_add=True)),
                ('complaint', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='complaints.complaint')),
                ('uploaded_by', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='ComplaintNote',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('note_type', models.CharField(choices=[('response', 'Response'), ('internal', 'Internal'), ('escalation', 'Escalation')], max_length=20)),
                ('note', models.TextField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('author', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to=settings.AUTH_USER_MODEL)),
                ('complaint', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='complaints.complaint')),
            ],
        ),
        migrations.CreateModel(
            name='ComplaintSLA',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('response_due_at', models.DateTimeField()),
                ('resolution_due_at', models.DateTimeField()),
                ('escalated_at', models.DateTimeField(blank=True, null=True)),
                ('is_overdue', models.BooleanField(default=False)),
                ('complaint', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, to='complaints.complaint')),
                ('policy', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='complaints.slapolicy')),
            ],
        ),
        migrations.CreateModel(
            name='ComplaintStatusHistory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('changed_at', models.DateTimeField(auto_now_add=True)),
                ('note', models.TextField(blank=True)),
                ('changed_by', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to=settings.AUTH_USER_MODEL)),
                ('complaint', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='complaints.complaint')),
                ('status', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='complaints.complaintstatus')),
            ],
        ),
        migrations.AddField(
            model_name='complaintaianalysis',
            name='complaint',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='complaints.complaint'),
        ),
        migrations.AddIndex(
            model_name='complaint',
            index=models.Index(fields=['student'], name='complaints__student_3a6e8c_idx'),
        ),
        migrations.AddIndex(
            model_name='complaint',
            index=models.Index(fields=['status'], name='complaints__status__486882_idx'),
        ),
        migrations.AddIndex(
            model_name='complaint',
            index=models.Index(fields=['priority'], name='complaints__priorit_2e4550_idx'),
        ),
        migrations.AddIndex(
            model_name='complaint',
            index=models.Index(fields=['category'], name='complaints__categor_4067df_idx'),
        ),
        migrations.AddIndex(
            model_name='complaint',
            index=models.Index(fields=['source'], name='complaints__source__0ffb49_idx'),
        ),
        migrations.AddIndex(
            model_name='complaint',
            index=models.Index(fields=['created_at'], name='complaints__created_efda5f_idx'),
        ),
    ]
