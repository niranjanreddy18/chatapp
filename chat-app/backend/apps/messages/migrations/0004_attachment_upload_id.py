from django.db import migrations, models


class Migration(migrations.Migration):
    """Add upload_id UUID to Attachment for idempotent media uploads.

    Existing rows receive NULL (null=True), so no data migration is needed.
    The unique constraint prevents duplicate Attachment rows when a client
    retries an upload whose first response was lost in transit.
    """

    dependencies = [
        ('chat_messages', '0003_alter_attachment_file'),
    ]

    operations = [
        migrations.AddField(
            model_name='attachment',
            name='upload_id',
            field=models.UUIDField(
                blank=True,
                db_index=True,
                help_text=(
                    'Client-generated idempotency key (UUID v4). '
                    'When present, a retry with the same upload_id returns the '
                    'existing Attachment without creating a duplicate or '
                    're-uploading to Cloudinary.'
                ),
                null=True,
                unique=True,
            ),
        ),
    ]
