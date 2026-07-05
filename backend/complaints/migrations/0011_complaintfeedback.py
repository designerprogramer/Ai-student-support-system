from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('complaints', '0010_username_max_50'),
    ]

    operations = [
        migrations.CreateModel(
            name='ComplaintFeedback',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('rating', models.PositiveSmallIntegerField()),
                ('comment', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('complaint', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='feedback', to='complaints.complaint')),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AddIndex(
            model_name='complaintfeedback',
            index=models.Index(fields=['student'], name='complaints__student_8e12a3_idx'),
        ),
        migrations.AddIndex(
            model_name='complaintfeedback',
            index=models.Index(fields=['rating'], name='complaints__rating_5b55c7_idx'),
        ),
        migrations.AddIndex(
            model_name='complaintfeedback',
            index=models.Index(fields=['created_at'], name='complaints__created_7529f8_idx'),
        ),
    ]
