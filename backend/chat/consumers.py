import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.chat_id = self.scope['url_route']['kwargs']['chat_id']
        self.room_group_name = f'chat_{self.chat_id}'
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        history = await self.get_history(self.chat_id)
        await self.send(text_data=json.dumps({
            'type': 'history',
            'messages': history
        }))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        message = data.get('message')
        user = self.scope['user']
        chat_id = self.chat_id

        if not message or not user or not user.is_authenticated:
            return

        chat = await self.get_chat(chat_id)
        msg = await self.create_message(chat, user, message)

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message': msg.text,
                'sender': user.email,
                'created_at': msg.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            }
        )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'message': event['message'],
            'sender': event['sender'],
            'created_at': event['created_at'],
        }))

    @database_sync_to_async
    def get_user(self, user_id):
        from users.models import User
        return User.objects.get(id=user_id)

    @database_sync_to_async
    def get_chat(self, chat_id):
        from .models import ChatRoom
        return ChatRoom.objects.get(id=chat_id)

    @database_sync_to_async
    def create_message(self, chat, sender, text):
        from .models import Message
        return Message.objects.create(chat=chat, sender=sender, text=text)

    @database_sync_to_async
    def get_history(self, chat_id):
        from .models import Message
        # Берём 50 последних сообщений
        messages = Message.objects.filter(chat_id=chat_id, deleted=False).order_by('-created_at')[:150]
        # Возвращаем список сообщений в виде словаря
        return [
            {
                'id': msg.id,
                'sender': str(msg.sender),
                'text': msg.text,
                'created_at': msg.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            } for msg in reversed(messages)
        ]