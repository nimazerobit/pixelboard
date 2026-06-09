import json
import time
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Pixel

class BoardConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.group_name = "board"
        self.last_paint_time = 0
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        
        await self.send_initial_pixels()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        action = data.get("action")

        if action == "paint":
            await self.handle_paint(data)

    async def handle_paint(self, data):
        user = self.scope["user"]
        
        if user.is_authenticated and user.is_staff:
            cooldown = 0
        else:
            cooldown = 1.0 if user.is_authenticated else 5.0

        current_time = time.time()
        if current_time - self.last_paint_time < cooldown:
            await self.send(text_data=json.dumps({"error": f"Slow down! Cooldown is {cooldown}s."}))
            return

        self.last_paint_time = current_time

        x = data.get("x")
        y = data.get("y")
        color = data.get("color")

        await self.save_pixel(x, y, color)

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "pixel_update",
                "x": x,
                "y": y,
                "color": color
            }
        )

    async def pixel_update(self, event):
        await self.send(text_data=json.dumps({
            "action": "paint",
            "x": event["x"],
            "y": event["y"],
            "color": event["color"]
        }))

    @database_sync_to_async
    def get_all_pixels(self):
        return list(Pixel.objects.values('x', 'y', 'color'))

    async def send_initial_pixels(self):
        pixels = await self.get_all_pixels()
        await self.send(text_data=json.dumps({
            "action": "init",
            "pixels": pixels
        }))

    @database_sync_to_async
    def save_pixel(self, x, y, color):
        Pixel.objects.update_or_create(x=x, y=y, defaults={'color': color})
