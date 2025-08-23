from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ReadOnlyModelViewSet
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from rest_framework import status

from .models import Notification, GroupChatSubscription
from .serializers import NotificationSerializer, GroupChatSubscriptionSerializer


# ====== Notification API (list + mark-read) ======

class NotificationPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class NotificationViewSet(ReadOnlyModelViewSet):
    """
    Список уведомлений текущего пользователя + пометка как прочитанные.
    """
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = NotificationPagination

    def get_queryset(self):
        qs = Notification.objects.filter(user=self.request.user)
        is_read = self.request.query_params.get("is_read")
        if is_read is not None:
            val = is_read.lower()
            if val in ("1", "true", "yes"):
                qs = qs.filter(is_read=True)
            elif val in ("0", "false", "no"):
                qs = qs.filter(is_read=False)
        return qs

    @action(detail=False, methods=["post"], url_path="mark-read")
    def mark_read(self, request, *args, **kwargs):
        """
        Тело:
          {"ids":[1,2,3]}  -> отметить конкретные
          {"all":true}     -> отметить все
        """
        ids = request.data.get("ids") or []
        mark_all = bool(request.data.get("all"))
        qs = Notification.objects.filter(user=request.user)
        if mark_all:
            updated = qs.update(is_read=True)
        else:
            updated = qs.filter(id__in=ids).update(is_read=True)
        unread_count = qs.filter(is_read=False).count()
        return Response({"updated": updated, "unread_count": unread_count})


# ====== Group Chat Subscriptions: subscribe/unsubscribe/mute/status ======

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def group_chat_subscription_status(request, room_id: int):
    sub = GroupChatSubscription.objects.filter(user=request.user, room_id=room_id).first()
    return Response({
        "room_id": int(room_id),
        "is_subscribed": bool(sub),
        "muted": bool(sub.muted) if sub else False,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def group_chat_subscribe(request, room_id: int):
    sub, created = GroupChatSubscription.objects.get_or_create(
        user=request.user,
        room_id=int(room_id),
        defaults={"muted": False},
    )
    if not created:
        # уже подписан — просто вернём состояние
        pass
    ser = GroupChatSubscriptionSerializer(sub)
    return Response({"ok": True, "subscription": ser.data}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def group_chat_unsubscribe(request, room_id: int):
    GroupChatSubscription.objects.filter(user=request.user, room_id=int(room_id)).delete()
    return Response({"ok": True, "room_id": int(room_id), "is_subscribed": False, "muted": False})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def group_chat_mute(request, room_id: int):
    muted = bool(request.data.get("muted"))
    sub, _ = GroupChatSubscription.objects.get_or_create(
        user=request.user,
        room_id=int(room_id),
        defaults={"muted": muted},
    )
    if sub.muted != muted:
        sub.muted = muted
        sub.save(update_fields=["muted", "updated_at"])
    ser = GroupChatSubscriptionSerializer(sub)
    return Response({"ok": True, "subscription": ser.data})
