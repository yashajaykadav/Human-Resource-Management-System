# Apryde AI HRMS

<div align="center">

![Apryde AI HRMS Banner](https://img.shields.io/badge/Enterprise-HRMS-indigo?style=for-the-badge)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%20+%20pgvector-336791?style=for-the-badge&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)

**An enterprise-grade Human Resource Management System powered by Dynamic Database RBAC, Autonomous Role-Based AI Copilots, and Tactile Skeuomorphic UI.**

[Features](#-key-features) • [Quick Start](#-quick-start) • [Architecture](#-architecture--tech-stack) • [Seeded Accounts](#-demo-accounts) • [API Docs](#-api-documentation)

</div>

---

## 🌟 Key Features

### 1. Dynamic Role-Based Access Control (RBAC)
- **100% Database-Driven Roles**: Zero hardcoded roles in Python or frontend. All roles, titles, and permission arrays (`dashboard`, `employees`, `attendance`, `leaves`, `payroll`, `recruitment`, `policies`, `organization`, `assets`) are defined and managed dynamically in PostgreSQL.
- **Granular Permissions & Guardrails**: System roles (Admin, HR Admin, Team Manager, ESS, Recruiter, Payroll) and custom organization-created roles with real-time UI guardrails.

### 2. Shift Master & Individual Employee Rostering
- **Shift Master Portal**: Define multi-shift schedules with presets for **General** (09:00 - 18:00), **Morning** (06:00 - 14:30), **Night** (22:00 - 06:30), and **Weekend** shifts.
- **Break Deduction Engine**: Configurable unpaid break duration (e.g. 60 min) auto-deducted to compute and display live **Net Productive Hours**.
- **Flexibility & Grace Periods**:
  - **Grace Arrival Window**: Permissible late-arrival minutes before flagging late attendance.
  - **Half-Day Threshold**: Minimum working hours for half-day credit (e.g., `< 4.0h` = Half Day).
  - **Absenteeism Threshold**: Minimum working hours for full-day presence (e.g., `< 2.0h` = Absent).
- **Individual Employee Rostering**: Directly assign specific shifts and date windows to individual employees with real-time scheduling preview.

### 3. Multi-Stage Leave & Holiday Management
- **Two-Stage Approval Workflow**: Leave requests require sequential approval:
  1. **Stage 1**: Direct Line Manager review and approval.
  2. **Stage 2**: HR Admin final sign-off.
- **Anti-Self-Approval Enforcement**: Strictly prevents self-approval across all leadership and HR tiers.
- **Dedicated Portals**: Complete physical separation between Shift/Roster management and Annual Leave Quotas / Corporate Holiday Calendars.

### 4. Organization Setup & Hierarchy Tree
- **Company Profile**: Legal entity naming, registration numbers, tax IDs, and corporate addresses.
- **Structure**: Multi-department and team management with department linkages.
- **Interactive Hierarchy Tree**: Visual employee organizational hierarchy showing direct reports, managers, and executive tiers.
- **Designations & Dynamic Roles**: Real-time management of job titles, pay bands, and permission templates.

### 5. Multi-Role Specialized Dashboards
- **Employee Self-Service (ESS)**: Clock-in/out terminal, daily time-tracker, leave balance cards, payslip downloads, and quick policy queries.
- **Team Manager Hub**: Live team attendance radar (who is in/late/absent), pending team leave approvals, and shift rosters.
- **HR Workforce Operations**: Company headcount metrics, attrition rates, employee directory, and onboarding pipelines.
- **Recruitment & ATS**: Requisitions, Kanban applicant pipeline, candidate resume parsing, and semantic match scoring.
- **Payroll & Finance**: Monthly payroll runs, salary components, deductions, tax withholdings, and disbursement reports.
- **Super Admin Infrastructure**: Live PostgreSQL + pgvector status, Redis task queues, container metrics, and runtime LLM provider switching.

### 6. Autonomous AI Copilot & Policy Vault (RAG)
- **Role-Aware HR Agent**: Slide-out copilot drawer offering context-aware assistance tailored to the authenticated user's role.
- **Interactive Human-in-the-Loop (HITL) Cards**: High-stakes actions (leave submissions, approvals, payroll runs) require explicit visual confirmation before execution.
- **Semantic Policy RAG**: Natural language retrieval over company handbooks and HR policies using `pgvector` embeddings.
- **Dual LLM Provider**: Runtime hot-switching between **Google Gemini** (`gemini-2.0-flash` / `gemini-1.5-pro`) and **Local Ollama** (`llama3.2:1b` / `llama3.1:8b`).

### 7. Modern Skeuomorphic & Tactile Soft UI
- Custom CSS design system with tactile depth tokens (`skeuo-card`, `skeuo-btn`, `skeuo-inset`, `skeuo-pill`).
- Instant **Light & Dark mode** toggle with high-contrast ambient glows.
- Fully responsive sidebar with global state synchronization (`SidebarContext`), navbar collapse toggle (`PanelLeftClose`/`PanelLeft`), and mobile slide-out drawer with dedicated close buttons.
- Real-time notification dropdown with priority color coding and 1-click dismissals.

---

## 🏗️ Architecture & Tech Stack

```
apryde-ai-hrms/
├── frontend/                # Next.js 15 (App Router, React 19, Tailwind CSS)
│   ├── src/app/             # Route pages (dashboard, organization, leaves, etc.)
│   ├── src/components/      # UI components, role dashboards, navigation
│   └── src/context/         # Auth, Notification, Sidebar, and Theme contexts
├── backend/                 # FastAPI (Python 3.11, Async SQLAlchemy 2.0)
│   ├── app/api/v1/          # Modular API endpoints (shifts, leaves, roles, etc.)
│   ├── app/models/          # SQLAlchemy ORM models (RBAC, attendance, leaves)
│   ├── app/schemas/         # Pydantic v2 validation schemas
│   ├── app/agents/          # Autonomous AI Orchestrator & Tool Registry
│   └── app/core/            # Config, security, async engine, database pool
├── docker/                  # Dockerfiles & PostgreSQL pgvector initialization
└── docker-compose.yml       # Production multi-service orchestration
```

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | Next.js 15, React 19, TypeScript | Tactile Skeuomorphic UI, Server/Client components |
| **Styling** | Tailwind CSS v4, Lucide React | Modern Soft UI design tokens, dark/light themes |
| **Backend API**| FastAPI, Pydantic v2, Python 3.11 | High-performance asynchronous REST API |
| **Database** | PostgreSQL 16 + `pgvector` | Relational tables + Vector embeddings for RAG |
| **Cache & Queue**| Redis 7 Alpine | Session caching and background worker queue |
| **AI Models** | Google Gemini & Local Ollama | Dual-engine role-based agent orchestrator |

---

## 🚀 Quick Start

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/) installed.

### 1. Clone & Configure
```bash
git clone https://github.com/yashajaykadav/Human-Resource-Management-System.git
cd Human-Resource-Management-System

# Create your environment file from the example
cp .env.example .env
```

### 2. Launch Stack with Docker Compose
```bash
docker compose up --build -d
```

### 3. Verify Services
Check running containers:
```bash
docker compose ps
```
- **Frontend App**: [http://localhost:3001](http://localhost:3001)
- **Backend API Docs**: [http://localhost:8001/api/v1/docs](http://localhost:8001/api/v1/docs)
- **Health Check**: [http://localhost:8001/health](http://localhost:8001/health)

---

## 👥 Demo Accounts

| Role | Email | Password | Primary Module |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@apryde.com` | `admin123` | Full System & AI Control |
| **HR Admin** | `hr@apryde.com` | `hr123` | Workforce, Leaves & ATS |
| **Team Manager** | `manager@apryde.com` | `manager123` | Team Rosters & Approvals |
| **Employee (ESS)** | `employee@apryde.com`| `emp123` | Self-Service & Check-in |
| **Recruiter** | `recruiter@apryde.com`| `recruiter123` | ATS & Job Pipeline |
| **Payroll Specialist**| `payroll@apryde.com` | `payroll123` | Compensation & Payslips |

---

## ⚙️ Environment Variables

Key parameters in `.env`:

```env
# Application Ports
FRONTEND_PORT=3001
BACKEND_PORT=8001
NEXT_PUBLIC_API_URL=http://localhost:8001

# PostgreSQL + pgvector
POSTGRES_USER=hrms_user
POSTGRES_PASSWORD=hrms_secure_password
POSTGRES_DB=hrms_db
DATABASE_URL=postgresql+asyncpg://hrms_user:hrms_secure_password@postgres:5432/hrms_db

# AI Provider (gemini or ollama)
DEFAULT_LLM_PROVIDER=gemini
GEMINI_API_KEY="your-google-gemini-api-key"
GEMINI_MODEL="gemini-2.0-flash"

# Optional Local Ollama
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=llama3.2:1b
```

---

## 🧪 Testing

Run automated tests inside the backend container:
```bash
docker compose exec backend pytest -v
```

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
