# AI Student Support System

**Author/Developer**: Hassan Husein Omar  
**University**: Hormuud University  

An intelligent, multi-channel, role-based student support and complaint management system designed to streamline communication and tracking of issues across university departments.

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Key Features](#key-features)
3. [Architecture & Technology Stack](#architecture--technology-stack)
4. [Project Directory Structure](#project-directory-structure)
5. [Prerequisites](#prerequisites)
6. [Getting Started (Installation & Setup)](#getting-started-installation--setup)
   - [Backend Setup](#backend-setup)
   - [Frontend Setup](#frontend-setup)
7. [Running the Application](#running-the-application)
8. [API Endpoints](#api-endpoints)
9. [User Roles and Workflows](#user-roles-and-workflows)

---

## System Overview🎓 AI Student Support System

Author/Developer: Hassan Husein Omar
University: Hormuud University

A smart, role-based student support system that helps universities manage student complaints and support requests from multiple channels (web, email, WhatsApp, walk-ins) in one place.

It improves communication, speeds up issue resolution, and gives full visibility into what’s happening with each case.

📌 What this system does (in simple terms)

Think of it as a central help desk for students and staff.

Instead of complaints getting lost in emails or messages, everything goes into one system where:

Students submit issues easily
Staff can track and manage them
Admins can monitor everything
The system automatically helps prioritize urgent problems
✨ Key Features
👥 Multiple dashboards for different users
Students, Support Officers, Student Affairs, Admins
🤖 Smart complaint handling
Automatically categorizes and routes issues to the right department
⏱️ SLA tracking
Highlights urgent cases and deadlines so nothing gets ignored
🔔 Real-time updates
Students can see status changes and progress updates instantly
📝 Internal notes & timelines
Staff can collaborate and document investigation steps
🔐 Security & audit logs
Tracks important system actions like login, escalation, and changes
🏗️ System Architecture
Backend (Server side)
Django 5 + Django REST Framework
PostgreSQL database
JWT authentication (secure login system)
Extra tools:
CORS handling
Filtering support
File uploads (Pillow)
Frontend (Client side)
React (Vite setup)
TailwindCSS for styling
Axios for API requests
Lucide + Heroicons for icons
📁 Project Structure
student_support_system/
├── backend/        → Django API (core logic)
│   ├── complaints/  → Main app (models, views, APIs)
│   ├── student_support/ → Settings & config
│   └── manage.py
│
├── frontend/       → React app (UI)
│   ├── src/
│   │   ├── components/ → Reusable UI parts
│   │   ├── pages/      → Dashboards & login pages
│   │   ├── lib/        → API helpers & auth logic
│   │   └── App.jsx
│
└── docs/           → Documentation & diagrams
🧰 Requirements

Make sure you have:

Python 3.10+
Node.js 18+
PostgreSQL running (port 5432)
🚀 Getting Started
⚙️ Backend Setup
cd backend
python -m venv venv

Activate environment:

Windows:
.\venv\Scripts\activate
Mac/Linux:
source venv/bin/activate

Install dependencies:

pip install -r requirements.txt

Create environment file:

cp .env.example .env

Update database settings inside .env.

Run migrations:

python manage.py migrate

Create admin user:

python manage.py createsuperuser
🎨 Frontend Setup
cd frontend
npm install
▶️ Running the Project
Start backend
python manage.py runserver

Runs on:

http://localhost:8000/
Start frontend
npm run dev

Runs on:

http://localhost:5173/
🔌 API Overview

Base URL:

/api/
Authentication
POST /auth/register/ → Create account
POST /auth/token/ → Login
POST /auth/token/refresh/ → Refresh session
Complaints System
GET /complaints/ → List all complaints
POST /complaints/ → Create new complaint
GET /complaints/{id}/ → View single complaint
PATCH /complaints/{id}/ → Update complaint
DELETE /complaints/{id}/ → Delete complaint
Workflow Actions
POST /complaints/{id}/assign/ → Assign staff
POST /complaints/{id}/add_note/ → Add progress note
POST /complaints/{id}/set_status/ → Update status
👤 User Roles
🎓 Student
Submit complaints
Track status updates
View responses and progress
🛠 Support Officer
Handle incoming complaints
Categorize and assign issues
Manage communication from different channels
🧑‍💼 Student Affairs Officer
Investigate cases
Add detailed review notes
Handle escalations
🧑‍💻 Admin
Full system control
Manage users and roles
Monitor system activity and logs
💡 Final Note

This system is designed to make student support faster, clearer, and more organized by bringing everything into one platform and reducing manual work.
The AI Student Support System acts as a central hub for student support operations. It ingests complaints from multiple sources (Web forms, Email, WhatsApp, and Walk-in entries), processes them, computes urgency levels based on SLA definitions, and distributes them to the correct personnel for investigation and resolution.

---

## Key Features
- **Multi-Role Dashboards**: Customized user experiences and distinct control sets for **Students**, **Support Officers**, **Student Affairs Officers**, and **System Administrators**.
- **Intelligent Processing**: Classification of category and routing of complaints to appropriate departments with priority calculation.
- **SLA Management**: Tracking of deadlines with automatic visual indicators for critical, high, medium, and low priority issues.
- **Audit Logs & Security**: Logs authentication events, role changes, and escalation events.
- **Interactive Timelines & Notes**: Rich collaboration tools for internal notes, investigation tracking, and response records.

---

## Architecture & Technology Stack

### Backend
- **Framework**: Django 5.0 & Django REST Framework (DRF)
- **Database**: PostgreSQL (via `psycopg` driver)
- **Authentication**: JWT (JSON Web Tokens) via `simplejwt`
- **Other Libs**: `django-cors-headers`, `django-filter`, `Pillow` (for file attachment handling)

### Frontend
- **Bundler & Server**: Vite + React (ES6 Modules)
- **Styling**: TailwindCSS & Vanilla CSS
- **State & HTTP**: Axios (with token injection and auto-refresh interceptors)
- **Icons**: Lucide React & Heroicons

---

## Project Directory Structure
```text
student_support_system/
├── backend/                  # Django REST API
│   ├── student_support/      # Settings, URL routing, WSGI/ASGI configurations
│   ├── complaints/           # Main application logic (Models, Views, Serializers, Routing)
│   ├── manage.py             # Django entry point
│   ├── requirements.txt      # Python dependencies
│   └── .env.example          # Environment variable template
├── frontend/                 # React Single Page Application (SPA)
│   ├── src/
│   │   ├── assets/           # Logos, icons, graphics
│   │   ├── components/       # Reusable layout and role elements (Sidebar, RoleLayout, Layout)
│   │   ├── lib/              # Auth session helpers, API/Axios configuration, workflows
│   │   ├── pages/            # Student, Support, Affairs, and Admin dashboards and logins
│   │   ├── App.jsx           # Main React component & router config
│   │   └── main.jsx          # App entry point
│   ├── package.json          # Node dependencies & npm scripts
│   ├── vite.config.js        # Vite configurations
│   └── tailwind.config.js    # Tailwind styling tokens
└── docs/                     # Design documentations, ERDs, and database schemas
```

---

## Prerequisites
Ensure the following are installed on your environment:
- **Python**: 3.10 or higher
- **Node.js**: v18 or higher (along with npm)
- **PostgreSQL**: Local database running on default port `5432`

---

## Getting Started (Installation & Setup)

### Backend Setup
1. **Navigate to the backend folder**:
   ```bash
   cd backend
   ```
2. **Create a virtual environment**:
   ```bash
   python -m venv venv
   ```
3. **Activate the virtual environment**:
   - Windows:
     ```powershell
     .\venv\Scripts\activate
     ```
   - macOS/Linux:
     ```bash
     source venv/bin/activate
     ```
4. **Install backend dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
5. **Configure Environment Variables**:
   Create a `.env` file in the `backend/` directory by copying `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Modify `.env` to match your local PostgreSQL database credentials:
   ```env
   POSTGRES_DB=student_support
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=your_postgres_password
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5432
   ```
6. **Apply migrations**:
   ```bash
   python manage.py migrate
   ```
7. **Create a superuser** (for administrative access):
   ```bash
   python manage.py createsuperuser
   ```

### Frontend Setup
1. **Navigate to the frontend folder**:
   ```bash
   cd ../frontend
   ```
2. **Install frontend dependencies**:
   ```bash
   npm install
   ```

---

## Running the Application

### 1. Start the Backend Server
From the `backend/` directory (with your virtual environment active):
```bash
python manage.py runserver
```
The Django API server will start at `http://localhost:8000/`.

### 2. Start the Frontend Server
From the `frontend/` directory:
```bash
npm run dev
```
The Vite development server will start at `http://localhost:5173/` (or check terminal output for port details). Open this URL in your web browser.

---

## API Endpoints
Base URL: `/api/`

- **Authentication**:
  - `POST /api/auth/register/` - Register new user account
  - `POST /api/auth/token/` - JWT login
  - `POST /api/auth/token/refresh/` - Refresh expired token

- **Complaints**:
  - `GET /api/complaints/` - List all complaints (supports filtering by `?status=`, `?priority=`, etc.)
  - `POST /api/complaints/` - Create a complaint
  - `GET/PATCH/DELETE /api/complaints/{id}/` - Manage a specific complaint
  - `POST /api/complaints/{id}/assign/` - Assign to staff
  - `POST /api/complaints/{id}/add_note/` - Add timeline update notes
  - `POST /api/complaints/{id}/set_status/` - Transition complaint lifecycle status

---

## User Roles and Workflows

1. **Student**:
   - Accesses dashboard at `/student/dashboard`.
   - Submits new complaints and uploads optional attachments.
   - Monitors live status updates, resolution notes, and SLA progress.
2. **Support Officer**:
   - Accesses dashboard at `/support/dashboard`.
   - Manages and triages inbound complaints.
   - Transcribes issues received through offline channels (WhatsApp, Walk-in, Email).
3. **Student Affairs Officer**:
   - Accesses dashboard at `/affairs/dashboard`.
   - Performs investigations and records detailed review notes.
   - Collaborates on status escalations.
4. **Admin**:
   - Accesses control center at `/admin/dashboard`.
   - Oversees system metrics, department settings, user configurations, and audit security logs.
#   A I - p o w e r e d _ s t u d e n t _ s u p p o r t _ s y s t e m  
 