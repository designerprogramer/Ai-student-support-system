# Student Support System - Requirements

## 1. Overview

**Purpose**
Provide a web-based system for students to submit complaints and for staff/admins to process, track, and resolve them across multiple channels.

**Scope**
Covers user management, complaint intake, intelligent processing, assignment and tracking, SLA management, notifications, dashboards, and reporting.

**Roles**
- **Student**: submits complaints and views status.
- **Staff**: registers and manages complaints, updates status, adds notes, and resolves.
- **Admin**: manages system oversight, escalations, and reporting.

**Key Definitions**
- **Complaint**: a student issue submitted through any supported channel.
- **SLA**: response time targets and escalation rules.
- **Status**: lifecycle state of a complaint.

## 2. Functional Requirements

### 2.1 User Management (FR-UM)
- **FR-UM-1**: System shall allow student registration and login.
- **FR-UM-2**: System shall allow admin login.
- **FR-UM-3**: System shall allow staff login.
- **FR-UM-4**: System shall support role-based access control.
- **FR-UM-5**: System shall manage user profiles.

### 2.2 Complaint Submission (FR-CS)
- **FR-CS-1**: Students shall submit complaints through a web form.
- **FR-CS-2**: Staff shall register complaints from WhatsApp manually.
- **FR-CS-3**: Staff shall register complaints from Email manually.
- **FR-CS-4**: System shall allow selecting a complaint category.
- **FR-CS-5**: System shall allow complaint description.
- **FR-CS-6**: System shall allow file attachment (optional).
- **FR-CS-7**: System shall generate a complaint ID automatically.

### 2.3 Multi-Channel Input Handling (FR-MC)
- **FR-MC-1**: System shall support Web complaints.
- **FR-MC-2**: System shall support Email complaints (manual entry).
- **FR-MC-3**: System shall support WhatsApp complaints (manual entry).
- **FR-MC-4**: System shall support Walk-in complaints.
- **FR-MC-5**: System shall store complaint source.

### 2.4 Intelligent Complaint Processing (FR-IP)
- **FR-IP-1**: System shall analyze complaint text.
- **FR-IP-2**: System shall determine complaint priority.
- **FR-IP-3**: System shall classify complaint category.
- **FR-IP-4**: System shall support smart routing.
- **FR-IP-5**: System shall assign complaints automatically (optional AI).
- **FR-IP-6**: System shall allow manual assignment.

### 2.5 Complaint Management (FR-CM)
- **FR-CM-1**: Staff shall view assigned complaints.
- **FR-CM-2**: Staff shall update complaint status.
- **FR-CM-3**: Staff shall add response notes.
- **FR-CM-4**: Staff shall mark complaints resolved.
- **FR-CM-5**: System shall track complaint history.

### 2.6 Complaint Status Tracking (FR-ST)
- **FR-ST-1**: System shall support statuses: Pending, In Progress, Escalated, Resolved, Closed.
- **FR-ST-2**: Students shall view complaint status.
- **FR-ST-3**: System shall show complaint timeline.

### 2.7 SLA Management (FR-SLA)
- **FR-SLA-1**: System shall set response time targets.
- **FR-SLA-2**: System shall track complaint deadlines.
- **FR-SLA-3**: System shall escalate overdue complaints.
- **FR-SLA-4**: System shall notify admin on delays.

### 2.8 Dashboard and Reports (FR-DR)
- **FR-DR-1**: Admin shall view complaint statistics.
- **FR-DR-2**: System shall show complaints by source.
- **FR-DR-3**: System shall show complaints by status.
- **FR-DR-4**: System shall show priority distribution.
- **FR-DR-5**: System shall show response time summary.
- **FR-DR-6**: System shall generate reports.

### 2.9 Notification System (FR-NS)
- **FR-NS-1**: System shall notify staff on assignment.
- **FR-NS-2**: System shall notify students on updates.
- **FR-NS-3**: System shall notify admin on escalation.
- **FR-NS-4**: System shall support in-system notifications.

### 2.10 Search and Filter (FR-SF)
- **FR-SF-1**: System shall search complaints.
- **FR-SF-2**: System shall filter by status.
- **FR-SF-3**: System shall filter by priority.
- **FR-SF-4**: System shall filter by source.
- **FR-SF-5**: System shall filter by date.

## 3. Non-Functional Requirements

### 3.1 Performance (NFR-P)
- **NFR-P-1**: System shall respond within 3 seconds.
- **NFR-P-2**: System shall handle multiple users concurrently.
- **NFR-P-3**: Dashboard shall load quickly.

### 3.2 Usability (NFR-U)
- **NFR-U-1**: System shall have a clean UI.
- **NFR-U-2**: System shall be easy to use.
- **NFR-U-3**: System shall support mobile devices.
- **NFR-U-4**: System shall provide clear navigation.

### 3.3 Reliability (NFR-R)
- **NFR-R-1**: System shall save complaints correctly.
- **NFR-R-2**: System shall avoid data loss.
- **NFR-R-3**: System shall support database backup.

### 3.4 Security (NFR-S)
- **NFR-S-1**: System shall require authentication.
- **NFR-S-2**: System shall use role-based access.
- **NFR-S-3**: System shall protect complaint data.
- **NFR-S-4**: System shall validate inputs.
- **NFR-S-5**: System shall prevent unauthorized access.

### 3.5 Scalability (NFR-SC)
- **NFR-SC-1**: System shall support future expansion.
- **NFR-SC-2**: System shall allow adding new departments.
- **NFR-SC-3**: System shall allow adding new complaint types.

### 3.6 Maintainability (NFR-M)
- **NFR-M-1**: System shall use modular architecture.
- **NFR-M-2**: System shall support easy updates.
- **NFR-M-3**: System shall support open-source technologies.

### 3.7 Availability (NFR-A)
- **NFR-A-1**: System shall be available 24/7.
- **NFR-A-2**: System shall support deployment on a server.
- **NFR-A-3**: System shall allow online access.

### 3.8 Compatibility (NFR-C)
- **NFR-C-1**: System shall support modern browsers.
- **NFR-C-2**: System shall support desktop and mobile.
- **NFR-C-3**: System shall work on the university network.

### 3.9 Deployment (NFR-D)
- **NFR-D-1**: System shall be deployable on a web server.
- **NFR-D-2**: System shall use an open-source stack.
- **NFR-D-3**: System shall support real-world deployment.

## 4. Assumptions
- Manual entry for Email and WhatsApp implies staff will transcribe or import details into the web system.
- Smart routing and auto-assignment are optional and can be enabled later without blocking manual workflows.

## 5. Open Decisions (for later refinement)
- SLA response time targets and escalation thresholds.
- Priority levels definition and calculation rules.
- Notification channels beyond in-system (email/SMS/push).
- Data retention and archival policy for closed complaints.
