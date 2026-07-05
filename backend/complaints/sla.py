from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from .models import Complaint, ComplaintNote, ComplaintSLA, ComplaintStatus, ComplaintStatusHistory, Notification


SLA_ESCALATION_MARKER = '[SLA ESCALATION]'


def normalize_key(value) -> str:
    return str(value or '').strip().lower().replace(' ', '_')


def priority_resolution_days(priority) -> int:
    return {
        'critical': 2,
        'high': 2,
        'medium': 5,
        'low': 7,
    }.get(normalize_key(priority), 7)


def is_complaint_overdue(complaint, now=None) -> bool:
    if normalize_key(complaint.status) in {'resolved', 'closed'}:
        return False
    if not complaint.created_at:
        return False

    due_at = complaint.created_at + timezone.timedelta(
        days=priority_resolution_days(complaint.priority)
    )
    return due_at < (now or timezone.now())


def enforce_overdue_escalations(queryset=None) -> int:
    now = timezone.now()
    complaints = (
        queryset
        if queryset is not None
        else Complaint.objects.select_related('priority', 'status')
    )
    complaints = complaints.exclude(status__name__iexact='Resolved').exclude(status__name__iexact='Closed')
    escalated_status, _ = ComplaintStatus.objects.get_or_create(name='Escalated')
    escalated_count = 0

    for complaint in complaints:
        if not is_complaint_overdue(complaint, now):
            continue
        if ComplaintNote.objects.filter(
            complaint=complaint,
            note__contains=SLA_ESCALATION_MARKER,
        ).exists():
            ComplaintSLA.objects.filter(complaint=complaint).update(is_overdue=True)
            continue

        with transaction.atomic():
            if complaint.status_id != escalated_status.id:
                complaint.status = escalated_status
                complaint.save(update_fields=['status', 'updated_at'])
                ComplaintStatusHistory.objects.create(
                    complaint=complaint,
                    status=escalated_status,
                    changed_by=complaint.submitted_by or complaint.student,
                    note='Automatically escalated because the SLA deadline passed.',
                )

            ComplaintSLA.objects.filter(complaint=complaint).update(
                is_overdue=True,
                escalated_at=now,
            )
            ComplaintNote.objects.create(
                complaint=complaint,
                author=complaint.submitted_by or complaint.student,
                note_type='escalation',
                note=f'{SLA_ESCALATION_MARKER} Automatically escalated because the SLA deadline passed.',
            )

            recipients = get_user_model().objects.filter(
                userrole__role__name__in=['affairs', 'admin']
            ).distinct()
            for recipient in recipients:
                Notification.objects.create(
                    recipient=recipient,
                    type='sla_escalation',
                    payload={
                        'complaint_id': complaint.id,
                        'complaint_code': complaint.complaint_code or f'CMP-{complaint.id}',
                        'title': complaint.title,
                        'message': (
                            f"Complaint {complaint.complaint_code or f'CMP-{complaint.id}'} "
                            'is overdue and was escalated automatically.'
                        ),
                    },
                )
        escalated_count += 1

    return escalated_count
