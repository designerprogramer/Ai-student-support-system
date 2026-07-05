-- Seed data for Student Support System

-- Roles
INSERT INTO roles (name) VALUES
  ('student'),
  ('staff'),
  ('admin')
ON CONFLICT (name) DO NOTHING;

-- Complaint sources
INSERT INTO complaint_sources (name) VALUES
  ('web'),
  ('email'),
  ('whatsapp'),
  ('walk-in')
ON CONFLICT (name) DO NOTHING;

-- Complaint statuses
INSERT INTO complaint_statuses (name) VALUES
  ('pending'),
  ('in_progress'),
  ('escalated'),
  ('resolved'),
  ('closed')
ON CONFLICT (name) DO NOTHING;

-- Complaint priorities
INSERT INTO complaint_priorities (name, description) VALUES
  ('low', 'Low urgency'),
  ('medium', 'Normal urgency'),
  ('high', 'High urgency'),
  ('critical', 'Immediate attention required')
ON CONFLICT (name) DO NOTHING;

-- Departments (minimal default)
INSERT INTO departments (name, description, active) VALUES
  ('General', 'Default department', true)
ON CONFLICT (name) DO NOTHING;

-- Complaint categories (minimal default)
INSERT INTO complaint_categories (name, description, department_id, active)
SELECT 'General', 'Default category', d.id, true
FROM departments d
WHERE d.name = 'General'
ON CONFLICT (department_id, name) DO NOTHING;

-- Optional: Default SLA policy (medium priority, general category)
INSERT INTO sla_policies (
    name,
    priority_id,
    category_id,
    target_response_hours,
    target_resolution_hours,
    escalation_hours,
    active
)
SELECT
    'Default - Medium/General',
    p.id,
    c.id,
    24,
    72,
    48,
    true
FROM complaint_priorities p
JOIN complaint_categories c ON c.name = 'General'
WHERE p.name = 'medium'
ON CONFLICT (name) DO NOTHING;
