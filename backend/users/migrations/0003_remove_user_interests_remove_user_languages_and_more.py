# Generated by Django 5.2.4 on 2025-07-17 16:35

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0002_interest_language_remove_user_nickname_and_more'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='user',
            name='interests',
        ),
        migrations.RemoveField(
            model_name='user',
            name='languages',
        ),
        migrations.AlterField(
            model_name='user',
            name='avatar',
            field=models.ImageField(blank=True, null=True, upload_to='avatars/'),
        ),
        migrations.AlterField(
            model_name='user',
            name='birth_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='user',
            name='city',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AlterField(
            model_name='user',
            name='country',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AlterField(
            model_name='user',
            name='first_name',
            field=models.CharField(blank=True, max_length=30),
        ),
        migrations.AlterField(
            model_name='user',
            name='interface_language',
            field=models.CharField(default='Русский', max_length=50),
        ),
        migrations.AlterField(
            model_name='user',
            name='last_name',
            field=models.CharField(blank=True, max_length=30),
        ),
        migrations.AlterField(
            model_name='user',
            name='theme',
            field=models.CharField(default='Светлая', max_length=50),
        ),
        migrations.DeleteModel(
            name='Interest',
        ),
        migrations.AddField(
            model_name='user',
            name='interests',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.DeleteModel(
            name='Language',
        ),
        migrations.AddField(
            model_name='user',
            name='languages',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
