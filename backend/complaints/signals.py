from django.conf import settings
from django.core.mail import send_mail
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Notification


@receiver(post_save, sender=Notification)
def send_notification_email(sender, instance, created, **kwargs):
    if not created:
        return

    recipient_email = getattr(instance.recipient, 'email', '') or ''
    if not recipient_email:
        return

    payload = instance.payload or {}
    subject = payload.get('title') or 'Student support notification'
    message = payload.get('message') or 'You have a new notification in the student support system.'

    send_mail(
        subject=f'Student Support: {subject}',
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[recipient_email],
        fail_silently=True,
    )
