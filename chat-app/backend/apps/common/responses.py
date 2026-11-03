from rest_framework import status
from rest_framework.response import Response


def success_response(message: str, data=None, status_code: int = status.HTTP_200_OK) -> Response:
    """Return a standardized successful API response envelope."""
    payload = {'success': True, 'message': message}
    if data is not None:
        payload['data'] = data
    return Response(payload, status=status_code)


def error_response(message: str, errors=None, status_code: int = status.HTTP_400_BAD_REQUEST) -> Response:
    """Return a standardized error API response envelope."""
    payload = {
        'success': False,
        'message': message,
        'errors': errors if errors is not None else {},
    }
    return Response(payload, status=status_code)


class APIResponseMixin:
    """Mixin providing standardized response helper methods for DRF views."""

    def _success_response(self, message: str, data=None, status_code: int = status.HTTP_200_OK) -> Response:
        return success_response(message, data=data, status_code=status_code)

    def _error_response(self, message: str, errors=None, status_code: int = status.HTTP_400_BAD_REQUEST) -> Response:
        return error_response(message, errors=errors, status_code=status_code)

    def _err(self, message: str, status_code: int = status.HTTP_400_BAD_REQUEST, errors=None) -> Response:
        return error_response(message, errors=errors, status_code=status_code)
