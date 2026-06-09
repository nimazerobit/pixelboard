from django.db import models

class Pixel(models.Model):
    x = models.IntegerField()
    y = models.IntegerField()
    color = models.CharField(max_length=7)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('x', 'y')

    def __str__(self):
        return f"({self.x}, {self.y}) - {self.color}"
