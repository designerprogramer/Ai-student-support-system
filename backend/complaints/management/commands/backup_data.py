from pathlib import Path

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = 'Create a JSON backup of users, complaints, reports data, logs, and workflow records.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--output-dir',
            default='backups',
            help='Directory where the backup JSON file will be written.',
        )

    def handle(self, *args, **options):
        output_dir = Path(options['output_dir'])
        output_dir.mkdir(parents=True, exist_ok=True)
        timestamp = timezone.now().strftime('%Y%m%d-%H%M%S')
        output_path = output_dir / f'student-support-backup-{timestamp}.json'

        call_command(
            'dumpdata',
            'auth.User',
            'complaints',
            indent=2,
            output=str(output_path),
        )

        self.stdout.write(self.style.SUCCESS(f'Backup created: {output_path}'))
