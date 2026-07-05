from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('complaints', '0004_enforce_user_roles'),
    ]

    operations = [
        migrations.AddField(
            model_name='complaint',
            name='auto_priority',
            field=models.CharField(blank=True, default='', max_length=20),
        ),
        migrations.AddField(
            model_name='complaint',
            name='confidence_score',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='complaint',
            name='detected_language',
            field=models.CharField(blank=True, default='', max_length=20),
        ),
        migrations.AddField(
            model_name='complaint',
            name='original_text',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='complaint',
            name='sentiment',
            field=models.CharField(blank=True, default='', max_length=20),
        ),
        migrations.AddField(
            model_name='complaint',
            name='translated_text',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='complaint',
            name='urgency',
            field=models.CharField(blank=True, default='', max_length=20),
        ),
    ]
