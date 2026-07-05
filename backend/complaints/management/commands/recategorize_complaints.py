from django.core.management.base import BaseCommand
from django.db import transaction

from complaints.analysis import AttachmentContext, analyze_complaint
from complaints.models import (
    Complaint,
    ComplaintAIAnalysis,
    ComplaintAttachment,
    ComplaintCategory,
    ComplaintNote,
)


SAFE_CATEGORY_NAMES = {
    'finance',
    'academics',
    'housing',
    'it services',
    'faculty',
    'facilities',
    'other',
}


class Command(BaseCommand):
    help = 'Re-analyze existing complaints and update categories from complaint text.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--apply',
            action='store_true',
            help='Apply category changes. Without this flag, the command only previews changes.',
        )
        parser.add_argument(
            '--only-forced',
            action='store_true',
            help='Only update complaints currently categorized as Finance.',
        )

    def handle(self, *args, **options):
        apply_changes = options['apply']
        only_forced = options['only_forced']
        complaints = Complaint.objects.select_related('category', 'priority').order_by('id')
        if only_forced:
            complaints = complaints.filter(category__name__iexact='Finance')

        changed = 0
        checked = 0

        for complaint in complaints:
            checked += 1
            attachments = [
                AttachmentContext(
                    name=attachment.file_name or attachment.file.name,
                    mime_type=attachment.mime_type,
                    size_bytes=attachment.file_size_bytes or 0,
                )
                for attachment in ComplaintAttachment.objects.filter(complaint=complaint)
            ]
            analysis = analyze_complaint(
                title=complaint.title,
                description=complaint.description,
                submitted_category=None,
                attachments=attachments,
            )
            suggested_name = (analysis.suggested_category or 'Other').strip()
            category = ComplaintCategory.objects.filter(name__iexact=suggested_name).first()
            if category is None and suggested_name.lower() in SAFE_CATEGORY_NAMES:
                category = ComplaintCategory.objects.create(
                    name=suggested_name,
                    description='Auto-created during complaint recategorization.',
                    active=True,
                )
            if category is None:
                self.stdout.write(
                    self.style.WARNING(
                        f'Skip {complaint.complaint_code or complaint.id}: category "{suggested_name}" does not exist.'
                    )
                )
                continue

            current_name = complaint.category.name if complaint.category else ''
            if current_name.lower() == category.name.lower():
                continue

            changed += 1
            preview = (
                f'{complaint.complaint_code or complaint.id}: '
                f'{current_name or "None"} -> {category.name} '
                f'({analysis.auto_priority}, {analysis.sentiment}, {analysis.urgency})'
            )

            if not apply_changes:
                self.stdout.write(preview)
                continue

            with transaction.atomic():
                complaint.category = category
                complaint.original_text = analysis.original_text
                complaint.translated_text = analysis.translated_text
                complaint.detected_language = analysis.detected_language
                complaint.sentiment = analysis.sentiment
                complaint.urgency = analysis.urgency
                complaint.confidence_score = analysis.confidence_score
                complaint.auto_priority = analysis.auto_priority
                complaint.save(
                    update_fields=[
                        'category',
                        'original_text',
                        'translated_text',
                        'detected_language',
                        'sentiment',
                        'urgency',
                        'confidence_score',
                        'auto_priority',
                        'updated_at',
                    ]
                )
                ComplaintAIAnalysis.objects.create(
                    complaint=complaint,
                    predicted_category=category,
                    predicted_priority=complaint.priority,
                    routing_department=getattr(category, 'department', None),
                    confidence=analysis.confidence_score,
                    model_version=analysis.model_version,
                    raw_output=analysis.to_raw_output(),
                )
                ComplaintNote.objects.create(
                    complaint=complaint,
                    author=complaint.submitted_by or complaint.student,
                    note_type='internal',
                    note=f'[AUTO CATEGORY UPDATE] {current_name or "None"} -> {category.name}.',
                )
            self.stdout.write(self.style.SUCCESS(preview))

        mode = 'updated' if apply_changes else 'would update'
        self.stdout.write(self.style.SUCCESS(f'Checked {checked} complaints; {mode} {changed}.'))
