from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('complaints', '0012_emailotpchallenge'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='profile_image',
            field=models.ImageField(blank=True, null=True, upload_to='profile_pictures/'),
        ),
    ]
