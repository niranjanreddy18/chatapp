import logging
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    Standardize DRF exception responses into the project's envelope:
        {
            "success": false,
            "message": "<human-readable summary>",
            "errors": { ... }
        }
    """
    response = exception_handler(exc, context)

    if response is None:
        logger.exception('Unhandled exception in %s', context.get('view'))
        return Response(
            {
                'success': False,
                'message': 'An unexpected server error occurred.',
                'errors': {},
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    data = response.data
    if isinstance(data, dict) and 'success' in data:
        return response

    message = 'Request failed.'
    errors = {}

    if isinstance(data, dict):
        if 'detail' in data and len(data) == 1:
            message = str(data['detail'])
        else:
            errors = data
            first_messages = []
            for field_errors in data.values():
                if isinstance(field_errors, list) and field_errors:
                    first_messages.append(str(field_errors[0]))
                elif isinstance(field_errors, str):
                    first_messages.append(field_errors)
            if first_messages:
                message = first_messages[0]
    elif isinstance(data, list) and data:
        message = str(data[0])
        errors = {'non_field_errors': data}

    response.data = {
        'success': False,
        'message': message,
        'errors': errors,
    }
    return response
