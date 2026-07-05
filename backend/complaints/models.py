from django.db import models
from django.conf import settings
from django.utils import timezone


class Role(models.Model):
    name = models.CharField(max_length=50, unique=True)

    def __str__(self) -> str:
        return self.name


class UserRole(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    role = models.ForeignKey(Role, on_delete=models.CASCADE)

    class Meta:
        unique_together = ('user', 'role')

    def __str__(self) -> str:
        return f'{self.user_id}:{self.role.name}'


class Department(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    active = models.BooleanField(default=True)

    def __str__(self) -> str:
        return self.name


class UserProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    full_name = models.CharField(max_length=200)
    profile_image = models.ImageField(upload_to='profile_pictures/', blank=True, null=True)
    student_number = models.CharField(max_length=50, blank=True)
    staff_number = models.CharField(max_length=50, blank=True)
    program = models.CharField(max_length=120, blank=True)
    year_of_study = models.IntegerField(null=True, blank=True)
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self) -> str:
        return self.full_name


class LoginSecurityState(models.Model):
    username = models.CharField(max_length=50)
    role = models.CharField(max_length=50)
    failed_attempts = models.PositiveIntegerField(default=0)
    failure_reason = models.CharField(max_length=255, blank=True)
    locked_until = models.DateTimeField(null=True, blank=True)
    last_failed_at = models.DateTimeField(null=True, blank=True)
    admin_notified_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('username', 'role')
        indexes = [
            models.Index(fields=['username', 'role']),
            models.Index(fields=['locked_until']),
        ]

    def __str__(self) -> str:
        return f'{self.username}:{self.role}'


class LoginAuditLog(models.Model):
    EVENT_SUCCESS = 'success'
    EVENT_FAILURE = 'failure'
    EVENT_LOCKED = 'locked'

    EVENT_CHOICES = (
        (EVENT_SUCCESS, 'Success'),
        (EVENT_FAILURE, 'Failure'),
        (EVENT_LOCKED, 'Locked'),
    )

    username = models.CharField(max_length=50)
    role = models.CharField(max_length=50)
    event = models.CharField(max_length=20, choices=EVENT_CHOICES)
    failure_reason = models.CharField(max_length=255, blank=True)
    failed_attempts = models.PositiveIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['created_at']),
            models.Index(fields=['username', 'role']),
            models.Index(fields=['event']),
        ]

    def __str__(self) -> str:
        return f'{self.username}:{self.role}:{self.event}'


class EmailOTPChallenge(models.Model):
    PURPOSE_LOGIN = 'login'
    PURPOSE_PASSWORD_RESET = 'password_reset'

    PURPOSE_CHOICES = (
        (PURPOSE_LOGIN, 'Login'),
        (PURPOSE_PASSWORD_RESET, 'Password Reset'),
    )

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    purpose = models.CharField(max_length=30, choices=PURPOSE_CHOICES)
    role = models.CharField(max_length=50, blank=True)
    email = models.EmailField()
    code_hash = models.CharField(max_length=128)
    failed_attempts = models.PositiveIntegerField(default=0)
    max_attempts = models.PositiveIntegerField(default=5)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'purpose', 'role']),
            models.Index(fields=['expires_at']),
            models.Index(fields=['used_at']),
        ]

    def __str__(self) -> str:
        return f'{self.user_id}:{self.purpose}:{self.role}'


class ComplaintCategory(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True)
    active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('department', 'name')

    def __str__(self) -> str:
        return self.name


class ComplaintSource(models.Model):
    name = models.CharField(max_length=50, unique=True)

    def __str__(self) -> str:
        return self.name


class ComplaintPriority(models.Model):
    name = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)

    def __str__(self) -> str:
        return self.name


class ComplaintStatus(models.Model):
    name = models.CharField(max_length=50, unique=True)

    def __str__(self) -> str:
        return self.name


class Complaint(models.Model):
    complaint_code = models.CharField(max_length=32, unique=True, blank=True, null=True)
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='complaints')
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='submitted_complaints',
    )
    source = models.ForeignKey(ComplaintSource, on_delete=models.PROTECT)
    category = models.ForeignKey(ComplaintCategory, on_delete=models.PROTECT)
    priority = models.ForeignKey(ComplaintPriority, on_delete=models.PROTECT)
    status = models.ForeignKey(ComplaintStatus, on_delete=models.PROTECT)
    title = models.CharField(max_length=200, blank=True)
    description = models.TextField()
    original_text = models.TextField(blank=True, default='')
    translated_text = models.TextField(blank=True, default='')
    detected_language = models.CharField(max_length=20, blank=True, default='')
    sentiment = models.CharField(max_length=20, blank=True, default='')
    urgency = models.CharField(max_length=20, blank=True, default='')
    confidence_score = models.FloatField(null=True, blank=True)
    auto_priority = models.CharField(max_length=20, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['student']),
            models.Index(fields=['status']),
            models.Index(fields=['priority']),
            models.Index(fields=['category']),
            models.Index(fields=['source']),
            models.Index(fields=['created_at']),
        ]

    def save(self, *args, **kwargs):
        creating = self.pk is None
        super().save(*args, **kwargs)
        if creating and not self.complaint_code:
            year = self.created_at.year if self.created_at else timezone.now().year
            code = f'CMP-{year}-{self.id:06d}'
            Complaint.objects.filter(pk=self.pk).update(complaint_code=code)
            self.complaint_code = code

    def __str__(self) -> str:
        return self.complaint_code or f'Complaint {self.pk}'


class ComplaintAssignment(models.Model):
    complaint = models.ForeignKey(Complaint, on_delete=models.CASCADE)
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='assignments')
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_complaints',
    )
    assigned_at = models.DateTimeField(auto_now_add=True)
    unassigned_at = models.DateTimeField(null=True, blank=True)
    auto_assigned = models.BooleanField(default=False)

    def __str__(self) -> str:
        return f'{self.complaint_id} -> {self.assigned_to_id}'


class ComplaintTransfer(models.Model):
    STATUS_CHOICES = (
        ('open', 'Open'),
        ('accepted', 'Accepted'),
        ('resolved', 'Resolved'),
    )

    complaint = models.ForeignKey(Complaint, on_delete=models.CASCADE, related_name='transfers')
    transferred_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='complaint_transfers_made',
    )
    transferred_to_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='complaint_transfers_received',
    )
    transferred_to_role = models.ForeignKey(Role, on_delete=models.PROTECT, null=True, blank=True)
    from_role = models.CharField(max_length=50, blank=True)
    reason = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['complaint']),
            models.Index(fields=['transferred_to_user']),
            models.Index(fields=['transferred_to_role']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self) -> str:
        target = self.transferred_to_user_id or getattr(self.transferred_to_role, 'name', 'unassigned')
        return f'{self.complaint_id} -> {target}'


class ComplaintNote(models.Model):
    NOTE_TYPES = (
        ('response', 'Response'),
        ('internal', 'Internal'),
        ('escalation', 'Escalation'),
    )

    complaint = models.ForeignKey(Complaint, on_delete=models.CASCADE)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    note_type = models.CharField(max_length=20, choices=NOTE_TYPES)
    note = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f'{self.complaint_id} - {self.note_type}'


class ComplaintAttachment(models.Model):
    complaint = models.ForeignKey(Complaint, on_delete=models.CASCADE)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    file = models.FileField(upload_to='complaints/')
    file_name = models.CharField(max_length=255, blank=True)
    mime_type = models.CharField(max_length=100, blank=True)
    file_size_bytes = models.BigIntegerField(null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.file_name or self.file.name


class ComplaintStatusHistory(models.Model):
    complaint = models.ForeignKey(Complaint, on_delete=models.CASCADE)
    status = models.ForeignKey(ComplaintStatus, on_delete=models.PROTECT)
    changed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    changed_at = models.DateTimeField(auto_now_add=True)
    note = models.TextField(blank=True)

    def __str__(self) -> str:
        return f'{self.complaint_id} -> {self.status.name}'


class ComplaintFeedback(models.Model):
    complaint = models.OneToOneField(Complaint, on_delete=models.CASCADE, related_name='feedback')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    rating = models.PositiveSmallIntegerField()
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['student']),
            models.Index(fields=['rating']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self) -> str:
        return f'{self.complaint_id}: {self.rating}'


class SLAPolicy(models.Model):
    name = models.CharField(max_length=120, unique=True)
    priority = models.ForeignKey(ComplaintPriority, on_delete=models.SET_NULL, null=True, blank=True)
    category = models.ForeignKey(ComplaintCategory, on_delete=models.SET_NULL, null=True, blank=True)
    target_response_hours = models.IntegerField()
    target_resolution_hours = models.IntegerField()
    escalation_hours = models.IntegerField()
    active = models.BooleanField(default=True)

    def __str__(self) -> str:
        return self.name


class ComplaintSLA(models.Model):
    complaint = models.OneToOneField(Complaint, on_delete=models.CASCADE)
    policy = models.ForeignKey(SLAPolicy, on_delete=models.PROTECT)
    response_due_at = models.DateTimeField()
    resolution_due_at = models.DateTimeField()
    escalated_at = models.DateTimeField(null=True, blank=True)
    is_overdue = models.BooleanField(default=False)

    def __str__(self) -> str:
        return f'SLA {self.complaint_id}'


class Notification(models.Model):
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    type = models.CharField(max_length=50)
    channel = models.CharField(max_length=30, default='in_app')
    payload = models.JSONField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f'{self.type} -> {self.recipient_id}'


class ComplaintAIAnalysis(models.Model):
    complaint = models.ForeignKey(Complaint, on_delete=models.CASCADE)
    predicted_category = models.ForeignKey(ComplaintCategory, on_delete=models.SET_NULL, null=True, blank=True)
    predicted_priority = models.ForeignKey(ComplaintPriority, on_delete=models.SET_NULL, null=True, blank=True)
    routing_department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True)
    confidence = models.FloatField(null=True, blank=True)
    model_version = models.CharField(max_length=50, blank=True)
    processed_at = models.DateTimeField(auto_now_add=True)
    raw_output = models.JSONField(null=True, blank=True)

    def __str__(self) -> str:
        return f'AI {self.complaint_id}'
