import os
import cloudinary
import cloudinary.uploader
from django.utils.deconstruct import deconstructible
from cloudinary_storage.storage import MediaCloudinaryStorage, RESOURCE_TYPES


@deconstructible
class ChatAttachmentCloudinaryStorage(MediaCloudinaryStorage):
    """
    Custom Cloudinary storage backend for chat attachments.

    Unlike default MediaCloudinaryStorage which hardcodes RESOURCE_TYPE = 'image',
    this storage dynamically detects the correct Cloudinary resource_type ('image',
    'video', or 'raw') based on file extension, MIME type, or database metadata.
    """

    VIDEO_EXTENSIONS = frozenset({
        'mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv', '3gp', '3g2', 'ogv', 'mpeg', 'm4v'
    })
    IMAGE_EXTENSIONS = frozenset({
        'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tif', 'tiff', 'ico', 'svg', 'heic', 'heif'
    })
    AUDIO_EXTENSIONS = frozenset({
        'mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'
    })

    def _get_resource_type(self, name):
        """
        Determine Cloudinary resource_type from file extension or fallback to DB lookup.
        Audio files are handled under Cloudinary's 'video' resource type.
        """
        ext = os.path.splitext(name)[1].lstrip('.').lower()
        if ext in self.VIDEO_EXTENSIONS or ext in self.AUDIO_EXTENSIONS:
            return RESOURCE_TYPES['VIDEO']
        if ext in self.IMAGE_EXTENSIONS:
            return RESOURCE_TYPES['IMAGE']

        # Fallback to database lookup if name has no extension
        try:
            from django.apps import apps
            Attachment = apps.get_model('chat_messages', 'Attachment')
            clean_name = name.removeprefix('media/').lstrip('/')
            att = (
                Attachment.objects.filter(file__in=[name, clean_name, f'media/{clean_name}', f'chat/{clean_name}'])
                .only('file_type', 'file_name')
                .first()
            )
            if not att:
                att = (
                    Attachment.objects.filter(file__startswith=name)
                    .only('file_type', 'file_name')
                    .first()
                )
            if att:
                ft = (att.file_type or '').lower()
                if ft.startswith('image/'):
                    return RESOURCE_TYPES['IMAGE']
                if ft.startswith(('video/', 'audio/')):
                    return RESOURCE_TYPES['VIDEO']
                orig_ext = os.path.splitext(att.file_name)[1].lstrip('.').lower()
                if orig_ext in self.IMAGE_EXTENSIONS:
                    return RESOURCE_TYPES['IMAGE']
                if orig_ext in self.VIDEO_EXTENSIONS or orig_ext in self.AUDIO_EXTENSIONS:
                    return RESOURCE_TYPES['VIDEO']
        except Exception:
            pass

        return RESOURCE_TYPES['RAW']

    def _get_url(self, name, resource_type=None):
        name = self._prepend_prefix(name)
        if resource_type is None:
            resource_type = self._get_resource_type(name)
        cloudinary_resource = cloudinary.CloudinaryResource(name, default_resource_type=resource_type)
        return cloudinary_resource.url

    def url(self, name, resource_type=None):
        return self._get_url(name, resource_type=resource_type)

    def delete(self, name):
        res_type = self._get_resource_type(name)
        # Cloudinary public_ids for image and video are stored without file extension
        clean_name = name
        if res_type in (RESOURCE_TYPES['IMAGE'], RESOURCE_TYPES['VIDEO']):
            clean_name = os.path.splitext(name)[0]

        response = cloudinary.uploader.destroy(clean_name, invalidate=True, resource_type=res_type)
        if response.get('result') == 'ok':
            return True
        if clean_name != name:
            response = cloudinary.uploader.destroy(name, invalidate=True, resource_type=res_type)
            if response.get('result') == 'ok':
                return True
        return response.get('result') == 'ok'

    def _save(self, name, content):
        name = self._normalise_name(name)
        name = self._prepend_prefix(name)
        uploaded_file = content if hasattr(content, 'chunks') else content
        response = self._upload(name, uploaded_file)

        # Preserve the extension in public_id so subsequent url() and delete()
        # calls on the saved attachment can correctly resolve resource_type.
        public_id = response['public_id']
        ext = os.path.splitext(name)[1]
        if ext and not public_id.lower().endswith(ext.lower()):
            fmt = response.get('format')
            if fmt:
                public_id = f'{public_id}.{fmt}'
            else:
                public_id = f'{public_id}{ext}'
        return public_id
