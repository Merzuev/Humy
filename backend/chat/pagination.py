from rest_framework.pagination import CursorPagination


class ChatMessageCursorPagination(CursorPagination):
    page_size = 30
    ordering = "-created_at"
    page_size_query_param = "page_size"
    max_page_size = 100
