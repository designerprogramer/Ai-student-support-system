# Student Support System - API Endpoints (Draft)

Base URL: `/api/`

## Auth
- `POST /api/auth/register/` - Register user (student/staff/admin)
- `POST /api/auth/token/` - JWT login (access/refresh)
- `POST /api/auth/token/refresh/` - Refresh JWT

## Core Resources
- `GET/POST /api/complaints/`
- `GET/PATCH/DELETE /api/complaints/{id}/`
- `POST /api/complaints/{id}/assign/`
- `POST /api/complaints/{id}/add_note/`
- `POST /api/complaints/{id}/set_status/`

## Lookups
- `GET/POST /api/departments/`
- `GET/POST /api/categories/`
- `GET/POST /api/sources/`
- `GET/POST /api/priorities/`
- `GET/POST /api/statuses/`

## Workflow Tables
- `GET/POST /api/assignments/`
- `GET/POST /api/notes/`
- `GET/POST /api/attachments/`
- `GET/POST /api/status-history/`
- `GET/POST /api/sla-policies/`
- `GET/POST /api/complaint-sla/`

## User & Roles
- `GET/POST /api/roles/`
- `GET/POST /api/user-roles/`
- `GET/POST /api/profiles/`

## AI & Notifications
- `GET/POST /api/ai-analysis/`
- `GET/POST /api/notifications/`

## Filtering & Search
- Complaints support: `?status=`, `?priority=`, `?source=`, `?category=`, `?student=`, `?created_from=`, `?created_to=`
- Search: `?search=` (complaint code, title, description)
- Ordering: `?ordering=created_at` or `?ordering=-created_at`
