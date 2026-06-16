from django.db.models.signals import post_delete
from django.dispatch import receiver
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import Pixel

@receiver(post_delete, sender=Pixel)
def pixel_deleted(sender, instance, **kwargs):
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        "board",
        {
            "type": "pixel_delete",
            "x": instance.x,
            "y": instance.y,
        }
    )