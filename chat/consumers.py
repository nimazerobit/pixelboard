import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import ChatMessage

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.group_name = "chat_group"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        
        # Send initial chats on connect
        await self.send_initial_chats()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        action = data.get("action")

        if action == "chat":
            await self.handle_chat(data)

    async def handle_chat(self, data):
        user = self.scope["user"]
        if not user.is_authenticated:
            await self.send(text_data=json.dumps({"error": "Only registered users can chat."}))
            return

        message = data.get("message")
        if message:
            await self.save_chat(user, message)
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "chat_message",
                    "username": user.username,
                    "message": message
                }
            )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            "action": "chat",
            "username": event["username"],
            "message": event["message"]
        }))

    @database_sync_to_async
    def get_recent_chats(self):
        chats = ChatMessage.objects.select_related('user').order_by('-timestamp')[:50]
        return [{"username": chat.user.username, "message": chat.message} for chat in reversed(chats)]

    async def send_initial_chats(self):
        chats = await self.get_recent_chats()
        await self.send(text_data=json.dumps({
            "action": "init",
            "chats": chats
        }))

    @database_sync_to_async
    def save_chat(self, user, message):
        ChatMessage.objects.create(user=user, message=message)
