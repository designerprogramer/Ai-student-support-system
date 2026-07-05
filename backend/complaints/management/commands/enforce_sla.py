from django.core.management.base import BaseCommand

from complaints.sla import enforce_overdue_escalations


class Command(BaseCommand):
    help = 'Escalate overdue complaints and notify Affairs/Admin users.'

    def handle(self, *args, **options):
        escalated_count = enforce_overdue_escalations()
        self.stdout.write(
            self.style.SUCCESS(f'Escalated {escalated_count} overdue complaint(s).')
        )
