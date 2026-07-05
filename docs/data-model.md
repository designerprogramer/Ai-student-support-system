# Student Support System - Data Model (Draft)

## 1. Overview
This document proposes a logical data model aligned to the requirements in `docs/requirements.md`. It focuses on core entities, key fields, and relationships needed for complaint intake, routing, SLA tracking, and notifications.

**ID Strategy**
- Use UUIDs for primary keys (or BIGINT if preferred). The examples assume UUID.
- `complaints.complaint_code` is a human-readable ID (e.g., CMP-2026-000123).

## 2. Core Entities

### 2.1 Users and Access
**users**
- `id` (PK)
- `email` (unique)
- `phone` (optional)
- `username` (unique, optional)
- `password_hash`
- `status` (active, suspended, archived)
- `created_at`, `updated_at`

**roles**
- `id` (PK)
- `name` (student, staff, admin)

**user_roles**
- `user_id` (FK -> users.id)
- `role_id` (FK -> roles.id)
- PK: (`user_id`, `role_id`)

**user_profiles**
- `user_id` (PK/FK -> users.id)
- `full_name`
- `student_number` (optional)
- `staff_number` (optional)
- `program` (optional)
- `year_of_study` (optional)
- `department_id` (optional FK -> departments.id)

### 2.2 Organization
**departments**
- `id` (PK)
- `name`
- `description` (optional)
- `active` (bool)

### 2.3 Complaints
**complaint_categories**
- `id` (PK)
- `name`
- `description` (optional)
- `department_id` (FK -> departments.id)  // supports routing
- `active` (bool)

**complaint_sources**
- `id` (PK)
- `name` (web, email, whatsapp, walk-in)

**complaint_priorities**
- `id` (PK)
- `name` (low, medium, high, critical)
- `description` (optional)

**complaint_statuses**
- `id` (PK)
- `name` (pending, in_progress, escalated, resolved, closed)

**complaints**
- `id` (PK)
- `complaint_code` (unique)
- `student_id` (FK -> users.id)  // complaint owner
- `submitted_by_user_id` (FK -> users.id, optional)  // staff for manual entry
- `source_id` (FK -> complaint_sources.id)
- `category_id` (FK -> complaint_categories.id)
- `priority_id` (FK -> complaint_priorities.id)
- `status_id` (FK -> complaint_statuses.id)
- `title` (optional)
- `description`
- `created_at`, `updated_at`
- `resolved_at` (optional)

**complaint_assignments**
- `id` (PK)
- `complaint_id` (FK -> complaints.id)
- `assigned_to_user_id` (FK -> users.id)
- `assigned_by_user_id` (FK -> users.id)
- `assigned_at`
- `unassigned_at` (optional)
- `auto_assigned` (bool)

**complaint_notes**
- `id` (PK)
- `complaint_id` (FK -> complaints.id)
- `author_user_id` (FK -> users.id)
- `note_type` (response, internal, escalation)
- `note`
- `created_at`

**complaint_attachments**
- `id` (PK)
- `complaint_id` (FK -> complaints.id)
- `uploaded_by_user_id` (FK -> users.id)
- `file_name`
- `storage_path` (or `storage_key` for object storage)
- `mime_type`
- `file_size_bytes`
- `uploaded_at`

**complaint_status_history**
- `id` (PK)
- `complaint_id` (FK -> complaints.id)
- `status_id` (FK -> complaint_statuses.id)
- `changed_by_user_id` (FK -> users.id)
- `changed_at`
- `note` (optional)

### 2.4 SLA Management
**sla_policies**
- `id` (PK)
- `name`
- `priority_id` (FK -> complaint_priorities.id, optional)
- `category_id` (FK -> complaint_categories.id, optional)
- `target_response_hours`
- `target_resolution_hours`
- `escalation_hours`
- `active` (bool)

**complaint_sla**
- `complaint_id` (PK/FK -> complaints.id)
- `policy_id` (FK -> sla_policies.id)
- `response_due_at`
- `resolution_due_at`
- `escalated_at` (optional)
- `is_overdue` (bool)

### 2.5 Notifications
**notifications**
- `id` (PK)
- `recipient_user_id` (FK -> users.id)
- `type` (assignment, update, escalation)
- `channel` (in_app)
- `payload_json`
- `is_read` (bool)
- `created_at`

### 2.6 Intelligent Processing (Optional AI)
**complaint_ai_analysis**
- `id` (PK)
- `complaint_id` (FK -> complaints.id)
- `predicted_category_id` (FK -> complaint_categories.id, optional)
- `predicted_priority_id` (FK -> complaint_priorities.id, optional)
- `routing_department_id` (FK -> departments.id, optional)
- `confidence` (0.0 - 1.0)
- `model_version` (optional)
- `processed_at`
- `raw_output` (optional JSON)

## 3. Key Relationships (Summary)
- A **user** can have many **roles** via `user_roles`.
- A **student user** can have many **complaints**.
- A **complaint** has one **category**, **priority**, **status**, and **source**.
- A **complaint** can have many **assignments**, **notes**, **attachments**, and **status history** entries.
- A **complaint** has one **SLA record** in `complaint_sla`.
- A **complaint category** can be linked to a **department** for routing.
- **Notifications** are linked to recipients (users).
- **AI analysis** is optional and linked to complaints.

## 4. Suggested Indexes
- `users.email` (unique)
- `users.username` (unique)
- `complaints.complaint_code` (unique)
- `complaints.student_id`, `complaints.status_id`, `complaints.priority_id`, `complaints.category_id`, `complaints.source_id`
- `complaint_assignments.complaint_id`, `complaint_assignments.assigned_to_user_id`
- `complaint_status_history.complaint_id`, `complaint_status_history.changed_at`
- `notifications.recipient_user_id`, `notifications.is_read`, `notifications.created_at`

## 5. Notes / Open Decisions
- Whether a user can have multiple roles (model supports it).
- Whether complaint priority is fully AI-driven or can be overridden manually.
- Exact SLA rules per priority vs per category.
- Storage strategy for attachments (local filesystem vs object storage).
