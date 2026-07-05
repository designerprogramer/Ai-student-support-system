-- Student Support System - PostgreSQL Schema (Draft)
-- Generated from docs/data-model.md

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- USERS & ACCESS
CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL UNIQUE,
    phone text,
    username text UNIQUE,
    password_hash text NOT NULL,
    status text NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS departments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    description text,
    active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS user_profiles (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    full_name text NOT NULL,
    student_number text,
    staff_number text,
    program text,
    year_of_study int,
    department_id uuid REFERENCES departments(id) ON DELETE SET NULL
);

-- COMPLAINT LOOKUPS
CREATE TABLE IF NOT EXISTS complaint_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
    active boolean NOT NULL DEFAULT true,
    UNIQUE (department_id, name)
);

CREATE TABLE IF NOT EXISTS complaint_sources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS complaint_priorities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    description text
);

CREATE TABLE IF NOT EXISTS complaint_statuses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE
);

-- COMPLAINTS
CREATE TABLE IF NOT EXISTS complaints (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_code text NOT NULL UNIQUE,
    student_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    submitted_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    source_id uuid NOT NULL REFERENCES complaint_sources(id) ON DELETE RESTRICT,
    category_id uuid NOT NULL REFERENCES complaint_categories(id) ON DELETE RESTRICT,
    priority_id uuid NOT NULL REFERENCES complaint_priorities(id) ON DELETE RESTRICT,
    status_id uuid NOT NULL REFERENCES complaint_statuses(id) ON DELETE RESTRICT,
    title text,
    description text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS complaint_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id uuid NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    assigned_to_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assigned_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    assigned_at timestamptz NOT NULL DEFAULT now(),
    unassigned_at timestamptz,
    auto_assigned boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS complaint_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id uuid NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    author_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    note_type text NOT NULL,
    note text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS complaint_attachments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id uuid NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    uploaded_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    file_name text NOT NULL,
    storage_path text NOT NULL,
    mime_type text NOT NULL,
    file_size_bytes bigint NOT NULL,
    uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS complaint_status_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id uuid NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    status_id uuid NOT NULL REFERENCES complaint_statuses(id) ON DELETE RESTRICT,
    changed_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    changed_at timestamptz NOT NULL DEFAULT now(),
    note text
);

-- SLA
CREATE TABLE IF NOT EXISTS sla_policies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    priority_id uuid REFERENCES complaint_priorities(id) ON DELETE SET NULL,
    category_id uuid REFERENCES complaint_categories(id) ON DELETE SET NULL,
    target_response_hours int NOT NULL,
    target_resolution_hours int NOT NULL,
    escalation_hours int NOT NULL,
    active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS complaint_sla (
    complaint_id uuid PRIMARY KEY REFERENCES complaints(id) ON DELETE CASCADE,
    policy_id uuid NOT NULL REFERENCES sla_policies(id) ON DELETE RESTRICT,
    response_due_at timestamptz NOT NULL,
    resolution_due_at timestamptz NOT NULL,
    escalated_at timestamptz,
    is_overdue boolean NOT NULL DEFAULT false
);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type text NOT NULL,
    channel text NOT NULL DEFAULT 'in_app',
    payload_json jsonb NOT NULL,
    is_read boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- OPTIONAL AI ANALYSIS
CREATE TABLE IF NOT EXISTS complaint_ai_analysis (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id uuid NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    predicted_category_id uuid REFERENCES complaint_categories(id) ON DELETE SET NULL,
    predicted_priority_id uuid REFERENCES complaint_priorities(id) ON DELETE SET NULL,
    routing_department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
    confidence double precision,
    model_version text,
    processed_at timestamptz NOT NULL DEFAULT now(),
    raw_output jsonb
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_complaints_student_id ON complaints(student_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status_id ON complaints(status_id);
CREATE INDEX IF NOT EXISTS idx_complaints_priority_id ON complaints(priority_id);
CREATE INDEX IF NOT EXISTS idx_complaints_category_id ON complaints(category_id);
CREATE INDEX IF NOT EXISTS idx_complaints_source_id ON complaints(source_id);

CREATE INDEX IF NOT EXISTS idx_assignments_complaint_id ON complaint_assignments(complaint_id);
CREATE INDEX IF NOT EXISTS idx_assignments_assigned_to ON complaint_assignments(assigned_to_user_id);

CREATE INDEX IF NOT EXISTS idx_status_history_complaint_id ON complaint_status_history(complaint_id);
CREATE INDEX IF NOT EXISTS idx_status_history_changed_at ON complaint_status_history(changed_at);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read ON notifications(recipient_user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- UPDATED_AT TRIGGERS
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER complaints_set_updated_at
BEFORE UPDATE ON complaints
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
