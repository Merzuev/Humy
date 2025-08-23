from __future__ import annotations

from typing import Tuple

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from django.db.models import Q

from .models import Chat, ChatParticipant, ChatType, Message
from .models import FriendRequest, FriendRequestStatus, Friendship, Block

User = get_user_model()


def build_private_key(u1_id: int, u2_id: int) -> str:
    a, b = sorted([int(u1_id), int(u2_id)])
    return f"{a}:{b}"


@transaction.atomic
def get_or_create_private_chat(current_user: User, other_user: User) -> Tuple[Chat, bool]:
    """
    Возвращает существующий приватный чат между пользователями или создаёт новый.
    Уникальность обеспечиваем через Chat.private_key = "min:max".
    """
    key = build_private_key(current_user.id, other_user.id)
    chat = Chat.objects.filter(type=ChatType.PRIVATE, private_key=key).first()
    created = False
    if not chat:
        chat = Chat(type=ChatType.PRIVATE, name=f"dm:{key}", private_key=key)
        chat.save()
        ChatParticipant.objects.bulk_create([
            ChatParticipant(chat=chat, user=current_user),
            ChatParticipant(chat=chat, user=other_user),
        ])
        created = True
    return chat, created


def mark_conversation_read(chat: Chat, user: User) -> None:
    ChatParticipant.objects.filter(chat=chat, user=user).update(
        last_read_at=timezone.now(), unread_count=0
    )


def inc_unread_for_others(chat: Chat, author: User) -> None:
    ChatParticipant.objects.filter(chat=chat).exclude(user=author).update(
        unread_count=F("unread_count") + 1
    )


def maybe_set_expires_at(message: Message) -> None:
    """Если чат секретный с таймером — проставляем expires_at."""
    chat = message.room
    if chat.is_secret and chat.self_destruct_timer:
        message.expires_at = timezone.now() + timezone.timedelta(seconds=int(chat.self_destruct_timer))
        message.save(update_fields=["expires_at"])


# ------------------ Друзья / блокировки ------------------

def _pair(a_id: int, b_id: int):
    x, y = sorted([int(a_id), int(b_id)])
    return x, y

def are_friends(a, b) -> bool:
    x, y = _pair(a.id, b.id)
    return Friendship.objects.filter(user1_id=x, user2_id=y).exists()

def block_exists(a, b) -> bool:
    return Block.objects.filter(Q(blocker=a, blocked=b) | Q(blocker=b, blocked=a)).exists()

def send_friend_request(from_user, to_user) -> FriendRequest:
    if from_user.id == to_user.id:
        raise ValueError("Нельзя отправить заявку самому себе.")
    fr, created = FriendRequest.objects.get_or_create(
        from_user=from_user, to_user=to_user,
        defaults={"status": FriendRequestStatus.PENDING}
    )
    if not created and fr.status != FriendRequestStatus.PENDING:
        fr.status = FriendRequestStatus.PENDING
        fr.responded_at = None
        fr.save(update_fields=["status", "responded_at"])
    return fr

def accept_friend_request(fr: FriendRequest) -> None:
    fr.status = FriendRequestStatus.ACCEPTED
    fr.responded_at = timezone.now()
    fr.save(update_fields=["status", "responded_at"])

    x, y = _pair(fr.from_user_id, fr.to_user_id)
    Friendship.objects.get_or_create(user1_id=x, user2_id=y)

def reject_friend_request(fr: FriendRequest) -> None:
    fr.status = FriendRequestStatus.REJECTED
    fr.responded_at = timezone.now()
    fr.save(update_fields=["status", "responded_at"])

def remove_friend(a: User, b: User) -> None:
    x, y = _pair(a.id, b.id)
    Friendship.objects.filter(user1_id=x, user2_id=y).delete()

def block_user(blocker: User, blocked: User) -> None:
    Block.objects.get_or_create(blocker=blocker, blocked=blocked)

def unblock_user(blocker: User, blocked: User) -> None:
    Block.objects.filter(blocker=blocker, blocked=blocked).delete()
