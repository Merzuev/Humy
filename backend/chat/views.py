from __future__ import annotations

from typing import Any

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.http import QueryDict
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets, generics, mixins
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticatedOrReadOnly, IsAuthenticated
from rest_framework.pagination import CursorPagination
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from .models import (
    Folder, Chat, Message, HiddenMessage, ChatType,
    FriendRequest, FriendRequestStatus, Friendship, Block,
)
from .serializers import (
    FolderSerializer,
    FolderListSerializer,
    ChatSerializer,
    MessageSerializer,
    ConversationSerializer,
    ConversationCreateSerializer,
    # — друзья / блок —
    FriendRequestSerializer, FriendRequestCreateSerializer,
    FriendshipSerializer, BlockSerializer, UserMiniSerializer,
)
from .permissions import IsChatParticipant
from .services import (
    get_or_create_private_chat,
    mark_conversation_read,
    inc_unread_for_others,
    maybe_set_expires_at,
    # — друзья / блок —
    are_friends, block_exists,
    send_friend_request, accept_friend_request, reject_friend_request,
    remove_friend, block_user, unblock_user,
)

User = get_user_model()

# ======================= FOLDER =======================

class FolderViewSet(viewsets.ModelViewSet):
    queryset = (
        Folder.objects.all()
        .select_related("parent")
        .prefetch_related("children", "labels", "chats")
    )
    serializer_class = FolderListSerializer  # по умолчанию — лёгкий

    def get_queryset(self):
        qs = super().get_queryset()
        parent = self.request.query_params.get("parent")
        root = self.request.query_params.get("root")

        if (parent is not None and parent == "null") or (
            root and root.lower() in ("1", "true", "yes")
        ):
            return qs.filter(parent__isnull=True)

        if parent is not None:
            return qs.filter(parent_id=parent)

        return qs

    def get_serializer_class(self):
        if self.action in ["retrieve", "create", "update", "partial_update"]:
            return FolderSerializer
        return FolderListSerializer


# ======================= CHAT (публичные комнаты) =======================

class ChatViewSet(viewsets.ModelViewSet):
    queryset = Chat.objects.all().prefetch_related("folders", "labels")
    serializer_class = ChatSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        folder = self.request.query_params.get("folder") or self.request.query_params.get("folders")
        if folder:
            qs = qs.filter(folders__id=folder)
        return qs.distinct()


# ======================= MESSAGE (в комнатах) =======================

class MessageCursorPagination(CursorPagination):
    page_size = 30
    ordering = "-created_at"  # новые сначала


class MessageViewSet(viewsets.ModelViewSet):
    """
    Сообщения в ПУБЛИЧНЫХ/ГРУППОВЫХ чатах.
    """
    serializer_class = MessageSerializer
    pagination_class = MessageCursorPagination
    permission_classes = [IsAuthenticatedOrReadOnly]
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        qs = (
            Message.objects.select_related("room", "author")
            .filter(deleted_at__isnull=True)
        )
        room_id = self.request.query_params.get("room")
        if room_id:
            qs = qs.filter(room_id=room_id)

        # Скрытые «у себя»
        user = self.request.user
        if user and getattr(user, "is_authenticated", False):
            hidden_ids = HiddenMessage.objects.filter(user=user).values_list("message_id", flat=True)
            qs = qs.exclude(id__in=hidden_ids)

        return qs.order_by("-created_at")

    def perform_create(self, serializer: MessageSerializer) -> None:
        user = self.request.user
        is_auth = bool(getattr(user, "is_authenticated", False))

        display_name = (
            getattr(user, "username", None)
            or getattr(user, "email", None)
            or "User"
        ) if is_auth else "User"

        attachment_file = self.request.FILES.get("attachment")
        attachment_type = ""
        attachment_name = ""
        meta: dict[str, Any] = {}

        if attachment_file:
            ct = (getattr(attachment_file, "content_type", "") or "").lower()
            if ct:
                meta["mime"] = ct
            if ct.startswith("image/"):
                attachment_type = Message.ATTACHMENT_TYPE_IMAGE
            else:
                attachment_type = Message.ATTACHMENT_TYPE_FILE
            attachment_name = getattr(attachment_file, "name", "") or ""

        serializer.save(
            author=user if is_auth else None,
            display_name=display_name,
            attachment_type=attachment_type,
            attachment_name=attachment_name,
            meta=meta or {},
        )

    def destroy(self, request, *args, **kwargs):
        """
        DELETE /api/messages/{id}/?for_all=true — удалить у всех.
        """
        instance: Message = self.get_object()
        for_all = str(request.query_params.get("for_all", "")).lower() in ("1", "true", "yes")

        if not for_all:
            return Response(
                {"detail": "Для удаления у себя используйте POST /api/messages/{id}/hide/"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user
        if not (user and user.is_authenticated):
            return Response(status=status.HTTP_401_UNAUTHORIZED)

        is_author = instance.author_id == user.id if instance.author_id else False
        if not (is_author or user.is_staff or user.is_superuser):
            return Response(status=status.HTTP_403_FORBIDDEN)

        room_id = instance.room_id
        msg_id = str(instance.id)

        instance.hard_delete()

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"chat_{room_id}",
            {"type": "chat_delete", "id": msg_id},
        )

        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def hide(self, request, pk=None):
        """
        POST /api/messages/{id}/hide/ — «Удалить у себя».
        """
        user = request.user
        if not user or not user.is_authenticated:
            return Response(status=status.HTTP_401_UNAUTHORIZED)

        try:
            msg = Message.objects.get(pk=pk)
        except Message.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        HiddenMessage.objects.get_or_create(user=user, message=msg)
        return Response({"status": "hidden"}, status=status.HTTP_200_OK)


# ======================= CONVERSATIONS (Личные сообщения) =======================

class ConversationsViewSet(viewsets.GenericViewSet,
                           mixins.ListModelMixin,
                           mixins.RetrieveModelMixin):
    """
    /api/conversations/  [GET, POST]
    /api/conversations/{id}/ [GET, PATCH]
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ConversationSerializer

    def get_queryset(self):
        # только приватные чаты, где участвует текущий пользователь
        return (
            Chat.objects
            .filter(type=ChatType.PRIVATE, participants=self.request.user)
            .select_related("last_message")
            .prefetch_related("participants")
        )

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset().order_by("-last_message__created_at", "-id")
        page = self.paginate_queryset(qs)
        if page is not None:
            ser = self.get_serializer(page, many=True)
            return self.get_paginated_response(ser.data)
        ser = self.get_serializer(qs, many=True)
        return Response(ser.data)

    def create(self, request, *args, **kwargs):
        ser = ConversationCreateSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        other_user = get_object_or_404(User, pk=ser.validated_data["other_user_id"])

        # Чёрный список — запрет
        if block_exists(request.user, other_user):
            return Response({"detail": "Пользователь недоступен для диалога."}, status=status.HTTP_403_FORBIDDEN)

        # (опционально) ЛС только между друзьями
        if getattr(settings, "FRIENDS_REQUIRED_FOR_DM", False) and not are_friends(request.user, other_user):
            return Response({"detail": "Личные сообщения доступны только между друзьями."}, status=status.HTTP_403_FORBIDDEN)

        chat, created = get_or_create_private_chat(request.user, other_user)
        data = ConversationSerializer(chat, context={"request": request}).data
        return Response(data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    def retrieve(self, request, *args, **kwargs):
        chat = get_object_or_404(self.get_queryset(), pk=kwargs["pk"])
        ser = ConversationSerializer(chat, context={"request": request})
        return Response(ser.data)

    def partial_update(self, request, *args, **kwargs):
        """
        Настройки: is_secret, self_destruct_timer.
        """
        chat = get_object_or_404(self.get_queryset(), pk=kwargs["pk"])
        allowed = {"is_secret", "self_destruct_timer"}
        payload = {k: v for k, v in request.data.items() if k in allowed}

        updated = False
        if "is_secret" in payload:
            chat.is_secret = bool(payload["is_secret"])
            updated = True
        if "self_destruct_timer" in payload:
            timer = payload["self_destruct_timer"]
            chat.self_destruct_timer = int(timer) if timer not in (None, "", 0) else None
            updated = True
        if updated:
            chat.save(update_fields=["is_secret", "self_destruct_timer"])
        ser = ConversationSerializer(chat, context={"request": request})
        return Response(ser.data)


class ConversationMessagesView(generics.ListCreateAPIView):
    """
    /api/conversations/{pk}/messages/  [GET, POST]
    """
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated, IsChatParticipant]
    pagination_class = None  # если у тебя была CursorPagination — верни её
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    # ---- helpers ----
    def get_chat(self) -> Chat:
        chat_id = self.kwargs["pk"]
        return get_object_or_404(
            Chat.objects.filter(type=ChatType.PRIVATE).prefetch_related("participants"),
            pk=chat_id
        )

    # для IsChatParticipant
    def get_object(self):
        return self.get_chat()

    def get_queryset(self):
        chat = self.get_chat()
        return (
            Message.objects
            .filter(room=chat, deleted_at__isnull=True)
            .select_related("author")
            .order_by("created_at")
        )

    def list(self, request, *args, **kwargs):
        chat = self.get_chat()
        resp = super().list(request, *args, **kwargs)
        mark_conversation_read(chat, request.user)
        return resp

    # --------- ВАЖНО: подставляем room до валидации ---------
    def create(self, request, *args, **kwargs):
        chat = self.get_chat()

        # Корректно формируем изменяемые данные и подставляем room
        incoming = request.data
        if isinstance(incoming, QueryDict):
            data = incoming.copy()
            data["room"] = str(chat.id)  # QueryDict хранит строки
        else:
            # JSON-случай
            data = dict(incoming)
            data["room"] = chat.id

        serializer = self.get_serializer(data=data, context={"request": request})
        try:
            serializer.is_valid(raise_exception=True)
        except ValidationError as exc:
            # На редкий случай, когда валидация всё равно упёрлась в room.
            # Даём «partial=True», но room всё равно передадим в save(...)
            if isinstance(exc.detail, dict) and "room" in exc.detail:
                serializer = self.get_serializer(data=data, context={"request": request}, partial=True)
                serializer.is_valid(raise_exception=True)
            else:
                raise

        # Создаём сообщение (room и author гарантированно проставляем на сервере)
        msg: Message = serializer.save(room=chat, author=request.user)
        maybe_set_expires_at(msg)

        # обновим last_message + unread для собеседника
        chat.last_message = msg
        chat.save(update_fields=["last_message"])
        inc_unread_for_others(chat, request.user)

        # разошлём по WS в группу chat_<id>
        try:
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f"chat_{chat.id}",
                {
                    "type": "chat_message",
                    "message": MessageSerializer(msg, context={"request": request}).data,
                },
            )
        except Exception:
            pass

        return Response(MessageSerializer(msg, context={"request": request}).data, status=status.HTTP_201_CREATED)


# ======================= FRIENDS / BLOCK =======================

class FriendRequestViewSet(viewsets.GenericViewSet, mixins.ListModelMixin):
    """
    /api/friends/requests/             [GET, POST]
    /api/friends/requests/{id}/accept  [POST]
    /api/friends/requests/{id}/reject  [POST]
    """
    permission_classes = [IsAuthenticated]
    serializer_class = FriendRequestSerializer

    def get_queryset(self):
        u = self.request.user
        qs = FriendRequest.objects.filter(Q(from_user=u) | Q(to_user=u)).select_related("from_user", "to_user")
        typ = (self.request.query_params.get("type") or "all").lower()
        if typ == "incoming":
            qs = qs.filter(to_user=u)
        elif typ == "outgoing":
            qs = qs.filter(from_user=u)
        return qs.order_by("-created_at")

    def create(self, request, *args, **kwargs):
        ser = FriendRequestCreateSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        to_user = get_object_or_404(User, pk=ser.validated_data["to_user_id"])

        if block_exists(request.user, to_user):
            return Response({"detail": "Вы не можете отправить заявку этому пользователю."}, status=403)

        if are_friends(request.user, to_user):
            return Response({"detail": "Вы уже друзья."}, status=200)

        fr = send_friend_request(request.user, to_user)
        out = FriendRequestSerializer(fr, context={"request": request}).data
        return Response(out, status=201)

    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        fr = get_object_or_404(FriendRequest.objects.select_related("from_user", "to_user"), pk=pk)
        if fr.to_user_id != request.user.id:
            return Response(status=403)
        accept_friend_request(fr)
        return Response(FriendRequestSerializer(fr, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        fr = get_object_or_404(FriendRequest.objects.select_related("from_user", "to_user"), pk=pk)
        if fr.to_user_id != request.user.id:
            return Response(status=403)
        reject_friend_request(fr)
        return Response(FriendRequestSerializer(fr, context={"request": request}).data)


class FriendsViewSet(viewsets.ViewSet):
    """
    /api/friends/ [GET, DELETE /api/friends/{user_id}/]
    """
    permission_classes = [IsAuthenticated]

    def list(self, request):
        u = request.user
        pairs = Friendship.objects.filter(Q(user1=u) | Q(user2=u)).select_related("user1", "user2")
        others = []
        for f in pairs:
            other = f.user2 if f.user1_id == u.id else f.user1
            others.append(other)
        data = [UserMiniSerializer(o, context={"request": request}).data for o in others]
        return Response(data)

    def destroy(self, request, pk=None):
        other = get_object_or_404(User, pk=pk)
        remove_friend(request.user, other)
        return Response(status=204)


class BlockViewSet(viewsets.ViewSet):
    """
    /api/block/           [GET, POST]
    /api/block/{user_id}/ [DELETE]
    """
    permission_classes = [IsAuthenticated]

    def list(self, request):
        qs = Block.objects.filter(blocker=request.user).select_related("blocked").order_by("-created_at")
        data = [BlockSerializer(b, context={"request": request}).data for b in qs]
        return Response(data)

    def create(self, request):
        uid = int(request.data.get("user_id", 0))
        other = get_object_or_404(User, pk=uid)
        block_user(request.user, other)
        return Response({"status": "blocked"}, status=201)

    def destroy(self, request, pk=None):
        other = get_object_or_404(User, pk=pk)
        unblock_user(request.user, other)
        return Response(status=204)


# ======================= USER SEARCH (для модалок «Новый диалог» и «Добавить в друзья») =======================

class UserSearchView(generics.ListAPIView):
    """
    GET /api/users/search/?q=....  (минимум 4 символа)
    Ищем только по тем полям, которые реально есть в кастомной модели пользователя.
    Себя всегда исключаем.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = UserMiniSerializer

    def get_queryset(self):
        UserModel = get_user_model()
        q = (self.request.query_params.get("q") or "").strip()
        if len(q) < 4:
            return UserModel.objects.none()

        # Собираем список доступных полей у кастомной модели
        field_names = {f.name for f in UserModel._meta.get_fields()}

        # Динамически добавляем условия только по существующим полям
        cond = Q()
        added = False
        for fname in ("nickname", "username", "email", "first_name", "last_name"):
            if fname in field_names:
                cond |= Q(**{f"{fname}__icontains": q})
                added = True

        # Если ни одно из ожидаемых полей не нашлось — отдаём пустой набор
        if not added:
            return UserModel.objects.none()

        return (
            UserModel.objects
            .filter(cond)
            .exclude(pk=self.request.user.pk)
            .order_by("id")
        )
