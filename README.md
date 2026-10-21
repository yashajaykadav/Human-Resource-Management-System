# Apryde AI HRMS

An enterprise-grade **Human Resource Management System (HRMS)** combining traditional end-to-end HR management with autonomous, **Role-Based (RB) AI Agents** capable of reasoning, querying data, and executing authorized tasks with **Human-in-the-Loop (HITL)** safeguards.

Engineered **100% in Docker** — zero local development or dependencies required on your host machine.

---

## 🌟 Core Highlights

### 1. Dedicated Multi-Dashboards by Role
- **Employee Self-Service (ESS)**: Clock-in/out terminal, live work timer, leave balances, recent payslips, active OKRs, quick policy AI chat.
- **Team Manager Hub**: Live team attendance roster (who is in/late/absent), pending leave approvals queue with 1-click decision cards, team timeline.
- **HR Operations Command**: Enterprise headcount KPIs, attrition rate, department directory, compliance policy vault status.
- **Recruiter / ATS Command**: Open job requisitions, candidate pipeline Kanban board, AI ATS semantic match scores (0-100%).
- **Payroll & Finance**: Monthly payroll cycle progress, gross/net disbursements, tax withholdings, AI payroll anomaly radar.
- **Super Admin Infrastructure**: System user matrix, PostgreSQL + pgvector status, Redis status, runtime LLM provider configuration.

### 2. Role-Based Agentic AI Copilot
- **Persistent Slide-Out Drawer**: Accessible across all pages with streaming responses and suggested action pills.
- **Interactive Action Cards (HITL)**: High-stakes actions (such as submitting leave requests, approving leaves, or running payroll) generate interactive visual confirmation cards inside the chat before execution.
- **Policy Vault & RAG**: Semantic vector retrieval over company policy handbooks and guidelines using `pgvector`.
- **Dual LLM Provider**: Runtime support for **Google Gemini** (`gemini-2.0-flash` / `gemini-1.5-pro`) and containerized **Local Ollama** (`llama3.1:8b`).

---

## 🚀 Quick Start (Docker-Only)

Everything runs inside Docker. Ensure Docker and Docker Compose are installed and running.

### 1. Launch the Stack
```bash
./scripts/run.sh up
# Or directly via docker compose:
docker compose up --build -d
```

### 2. Access the Application
- **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)
- **Interactive API Documentation (Swagger)**: [http://localhost:8000/api/v1/docs](http://localhost:8000/api/v1/docs)
- **Alternative ReDoc**: [http://localhost:8000/api/v1/redoc](http://localhost:8000/api/v1/redoc)

---

## 👥 Seeded Demo Accounts (1-Click Switcher Available on Navbar & Login)

| Role | Email | Password | Primary Dashboard |
| :--- | :--- | :--- | :--- |
| **Employee (ESS)** | `employee@company.com` | `emp123` | Employee Self-Service (ESS) |
| **Team Manager** | `manager@company.com` | `manager123` | Manager Operations Hub |
| **HR Admin** | `hr@company.com` | `hr123` | HR Workforce Command |
| **Recruiter / ATS** | `recruiter@company.com` | `recruiter123` | Talent Acquisition & ATS |
| **Payroll Specialist** | `payroll@company.com` | `payroll123` | Payroll & Compensation |
| **Super Admin** | `admin@company.com` | `admin123` | Executive & System Admin |

*Note: You can switch active role views at any time from the top dropdown in the navigation bar.*

---

## 🤖 LLM Provider Configuration

Configuration is managed via `.env` and can also be updated directly from the **Super Admin Dashboard**:

### Using Google Gemini (Cloud)
In `.env`:
```env
DEFAULT_LLM_PROVIDER=gemini
GEMINI_API_KEY="your-gemini-api-key"
GEMINI_MODEL="gemini-2.0-flash"
```

### Using Local Ollama (Docker Container)
Start with the Ollama profile enabled:
```bash
docker compose --profile ollama up -d
```
In `.env`:
```env
DEFAULT_LLM_PROVIDER=ollama
OLLAMA_BASE_URL="http://ollama:11434"
OLLAMA_MODEL="llama3.1:8b"
```

---

## 🧪 Testing

Run backend tests inside the Docker container:
```bash
./scripts/run.sh test
# Or:
docker compose run --rm backend pytest -v
```

---

## 🏗️ Architecture Stack
- **Frontend**: Next.js 14/15, React 18/19, Tailwind CSS, Lucide React, Recharts
- **Backend API**: FastAPI (Python 3.11), SQLAlchemy 2.0 Async, Pydantic v2
- **Vector & Relational DB**: PostgreSQL 16 with `pgvector`
- **Cache & Queue**: Redis 7 Alpine
- **AI Engine**: Google Gemini API & Ollama integration with Role-Based Agent Orchestrator

