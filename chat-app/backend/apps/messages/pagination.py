from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class MessagePagination(PageNumberPagination):
    """
    Returns 20 messages per page.

    Response envelope matches the project-wide convention:
        {
            "success": true,
            "message": "Messages fetched successfully",
            "data": {
                "count":    <total messages>,
                "next":     <url | null>,
                "previous": <url | null>,
                "results":  [...]
            }
        }
    """

    page_size              = 20
    page_size_query_param  = 'page_size'   # allows ?page_size=10 override
    max_page_size          = 100
    page_query_param       = 'page'

    def get_paginated_response(self, data):
        return Response({
            'success': True,
            'message': 'Messages fetched successfully',
            'data': {
                'count':    self.page.paginator.count,
                'next':     self.get_next_link(),
                'previous': self.get_previous_link(),
                'results':  data,
            },
        })

    def get_paginated_response_schema(self, schema):
        return {
            'type': 'object',
            'properties': {
                'count':    {'type': 'integer'},
                'next':     {'type': 'string', 'nullable': True},
                'previous': {'type': 'string', 'nullable': True},
                'results':  schema,
            },
        }
