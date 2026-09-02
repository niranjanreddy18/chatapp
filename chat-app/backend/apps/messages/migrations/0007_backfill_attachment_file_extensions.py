import os
from django.db import migrations


def backfill_file_extensions(apps, schema_editor):
    Attachment = apps.get_model('chat_messages', 'Attachment')
    for att in Attachment.objects.all():
        if not att.file or not att.file.name:
            continue
        curr_name = att.file.name
        _, ext = os.path.splitext(curr_name)
        if not ext and att.file_name:
            _, orig_ext = os.path.splitext(att.file_name)
            if orig_ext:
                att.file.name = f"{curr_name}{orig_ext}"
                att.save(update_fields=['file'])


def reverse_backfill(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('chat_messages', '0006_alter_attachment_file'),
    ]

    operations = [
        migrations.RunPython(backfill_file_extensions, reverse_backfill),
    ]
