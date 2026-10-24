import asyncio
from datetime import date, datetime, timedelta
from sqlalchemy import select, text
from app.core.database import engine, Base, AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.user import User, Role
from app.models.employee import Department, Designation, Employee, EmploymentStatus
from app.models.leave import LeaveType, LeaveBalance, LeaveRequest, LeaveStatus
from app.models.payroll import SalaryStructure, PayrollRun, Payslip, PayrollStatus
from app.models.recruitment import JobPosting, Candidate, Application, JobStatus, ApplicationStage
from app.models.policy import PolicyDocument, PolicyChunk
from app.models.performance import Goal, GoalStatus
from app.models.asset import Asset, AssetCategory, AssetStatus, AssetCondition, AssetHistory, AssetRequest, AssetRequestStatus

INITIAL_ROLES = [
    {
        "name": "Administrator",
        "code": "admin",
        "description": "Super Administrator with unrestricted overall access to all system modules and settings.",
        "is_system": True,
        "permissions": ["*"]
    },
    {
        "name": "HR Administrator",
        "code": "hr_admin",
        "description": "Human Resources management across employee records, leaves, recruitment, policies, and departments.",
        "is_system": False,
        "permissions": ["dashboard", "employees", "attendance", "leaves", "recruitment", "policies", "organization", "assets"]
    },
    {
        "name": "Team Manager",
        "code": "manager",
        "description": "Line manager with access to direct report roster, timesheets, and leave approvals.",
        "is_system": False,
        "permissions": ["dashboard", "employees", "attendance", "leaves"]
    },
    {
        "name": "Employee (ESS)",
        "code": "employee",
        "description": "Employee self-service for personal profile, daily check-in, leave requests, and policies.",
        "is_system": False,
        "permissions": ["dashboard", "attendance", "leaves", "policies", "assets"]
    },
    {
        "name": "Recruiter / ATS",
        "code": "recruiter",
        "description": "Talent acquisition specialist managing job postings, candidate applications, and hiring pipeline.",
        "is_system": False,
        "permissions": ["dashboard", "recruitment", "employees"]
    },
    {
        "name": "Payroll Specialist",
        "code": "payroll_specialist",
        "description": "Finance and payroll specialist managing salary structures, monthly payroll runs, and slips.",
        "is_system": False,
        "permissions": ["dashboard", "payroll", "employees"]
    }
]

async def seed_initial_roles_if_missing(session):
    for r_data in INITIAL_ROLES:
        existing = await session.execute(select(Role).where(Role.code == r_data["code"]))
        if not existing.scalar_one_or_none():
            new_role = Role(
                name=r_data["name"],
                code=r_data["code"],
                description=r_data["description"],
                is_system=r_data["is_system"],
                permissions=r_data["permissions"]
            )
            session.add(new_role)
    await session.commit()

async def check_and_pull_ollama_model():
    """Trigger background pull for lightweight Ollama model if container is live."""
    import httpx
    from app.core.config import settings
    ollama_url = (settings.OLLAMA_BASE_URL or "http://ollama:11434").rstrip("/")
    target_model = settings.OLLAMA_MODEL or "llama3.2:1b"
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{ollama_url}/api/tags")
            if resp.status_code == 200:
                models = [m.get("name") for m in resp.json().get("models", [])]
                if not any(target_model in m for m in models):
                    print(f"[Setup] Ollama is live! Starting pull of lightweight model '{target_model}'...")
                    asyncio.create_task(
                        client.post(f"{ollama_url}/api/pull", json={"name": target_model, "stream": False})
                    )
    except Exception:
        pass

async def init_db():
    print("[Setup] Initializing database tables...")
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'))
        await conn.run_sync(Base.metadata.create_all)
    print("[Setup] Database tables created or verified.")

    # Trigger lightweight model check in background
    asyncio.create_task(check_and_pull_ollama_model())

    async with AsyncSessionLocal() as session:
        # 0. Ensure initial RBAC roles exist in DB
        await seed_initial_roles_if_missing(session)

        # Check if already seeded
        res = await session.execute(select(User).where(User.email == "admin@company.com"))
        if res.scalar_one_or_none():
            print("[Setup] User seed data exists. Checking asset inventory...")
            await seed_assets_if_empty(session)
            print("[Setup] Setup verified.")
            return

        print("[Setup] Seeding initial HRMS data...")

        # 1. Departments
        eng_dept = Department(name="Engineering", code="ENG", description="Software & Systems Engineering")
        hr_dept = Department(name="Human Resources", code="HR", description="People & Culture")
        sales_dept = Department(name="Sales & Growth", code="SALES", description="Business Development")
        fin_dept = Department(name="Finance & Accounting", code="FIN", description="Financial Planning & Payroll")
        session.add_all([eng_dept, hr_dept, sales_dept, fin_dept])
        await session.flush()

        # 2. Designations
        des_em = Designation(title="Engineering Manager", level="Lead", description="Leads engineering team")
        des_swe = Designation(title="Senior Full-Stack Engineer", level="Senior", description="Full stack developer")
        des_hr = Designation(title="Senior HR Business Partner", level="Senior", description="People operations")
        des_rec = Designation(title="Talent Acquisition Specialist", level="Mid", description="Hiring & recruitment")
        des_pay = Designation(title="Payroll Specialist", level="Mid", description="Compensation & benefits")
        des_adm = Designation(title="System Administrator", level="Executive", description="Super admin")
        session.add_all([des_em, des_swe, des_hr, des_rec, des_pay, des_adm])
        await session.flush()

        # 3. Users
        users_data = [
            ("admin@company.com", "admin123", "Alex", "Admin", "super_admin", True, des_adm, hr_dept),
            ("hr@company.com", "hr123", "Sarah", "Jenkins", "hr_admin", False, des_hr, hr_dept),
            ("manager@company.com", "manager123", "David", "Miller", "manager", False, des_em, eng_dept),
            ("employee@company.com", "emp123", "Alice", "Chen", "employee", False, des_swe, eng_dept),
            ("recruiter@company.com", "recruiter123", "Rachel", "Green", "recruiter", False, des_rec, hr_dept),
            ("payroll@company.com", "payroll123", "Paul", "Vance", "payroll_specialist", False, des_pay, fin_dept),
        ]

        created_users = {}
        for email, pwd, first, last, role, is_super, desig, dept in users_data:
            user = User(
                email=email,
                hashed_password=get_password_hash(pwd),
                first_name=first,
                last_name=last,
                role=role,
                is_active=True,
                is_superuser=is_super
            )
            session.add(user)
            await session.flush()
            created_users[role] = (user, desig, dept)

        # 4. Employees & Manager hierarchy
        # Manager employee
        mgr_user, mgr_des, mgr_dep = created_users["manager"]
        emp_manager = Employee(
            user_id=mgr_user.id,
            employee_code="EMP-1001",
            department_id=mgr_dep.id,
            designation_id=mgr_des.id,
            phone="+1-555-0101",
            annual_ctc=165000.0,
            date_of_joining=date(2023, 1, 15)
        )
        session.add(emp_manager)
        await session.flush()

        # Alice Chen (Employee) reporting to David Miller (Manager)
        emp_user, emp_des, emp_dep = created_users["employee"]
        emp_alice = Employee(
            user_id=emp_user.id,
            employee_code="EMP-1002",
            department_id=emp_dep.id,
            designation_id=emp_des.id,
            manager_id=emp_manager.id, # Reports to David Miller
            phone="+1-555-0102",
            bank_account_number="US98273641209",
            bank_name="Silicon Valley Bank",
            annual_ctc=125000.0,
            date_of_joining=date(2024, 3, 1)
        )
        session.add(emp_alice)

        # HR Admin profile
        hr_user, hr_des, hr_dep = created_users["hr_admin"]
        emp_hr = Employee(
            user_id=hr_user.id,
            employee_code="EMP-1003",
            department_id=hr_dep.id,
            designation_id=hr_des.id,
            phone="+1-555-0103",
            annual_ctc=110000.0,
            date_of_joining=date(2023, 6, 1)
        )
        session.add(emp_hr)

        # Recruiter profile
        rec_user, rec_des, rec_dep = created_users["recruiter"]
        emp_rec = Employee(
            user_id=rec_user.id,
            employee_code="EMP-1004",
            department_id=rec_dep.id,
            designation_id=rec_des.id,
            phone="+1-555-0104",
            annual_ctc=95000.0,
            date_of_joining=date(2024, 1, 10)
        )
        session.add(emp_rec)

        # Payroll specialist profile
        pay_user, pay_des, pay_dep = created_users["payroll_specialist"]
        emp_pay = Employee(
            user_id=pay_user.id,
            employee_code="EMP-1005",
            department_id=pay_dep.id,
            designation_id=pay_des.id,
            phone="+1-555-0105",
            bank_account_number="US19283746501",
            bank_name="Chase Manhattan",
            annual_ctc=105000.0,
            date_of_joining=date(2023, 8, 20)
        )
        session.add(emp_pay)

        # Admin profile
        adm_user, adm_des, adm_dep = created_users["super_admin"]
        emp_adm = Employee(
            user_id=adm_user.id,
            employee_code="EMP-1000",
            department_id=hr_dep.id,
            designation_id=adm_des.id,
            phone="+1-555-0100",
            annual_ctc=200000.0,
            date_of_joining=date(2022, 1, 1)
        )
        session.add(emp_adm)
        await session.flush()

        # 5. Leave Balances for Alice and team
        for emp_record in [emp_alice, emp_manager, emp_hr, emp_rec, emp_pay]:
            session.add_all([
                LeaveBalance(employee_id=emp_record.id, leave_type=LeaveType.CASUAL, total_allocated=12.0, used=2.0, pending=0.0),
                LeaveBalance(employee_id=emp_record.id, leave_type=LeaveType.SICK, total_allocated=10.0, used=1.0, pending=0.0),
                LeaveBalance(employee_id=emp_record.id, leave_type=LeaveType.ANNUAL, total_allocated=18.0, used=3.0, pending=0.0),
            ])

        # 6. Sample Pending Leave Request for Alice (so Manager can review)
        next_week = date.today() + timedelta(days=5)
        leave_req = LeaveRequest(
            employee_id=emp_alice.id,
            leave_type=LeaveType.CASUAL,
            start_date=next_week,
            end_date=next_week + timedelta(days=2),
            days_count=3.0,
            reason="Attending family reunion in Chicago.",
            status=LeaveStatus.PENDING
        )
        session.add(leave_req)

        # 7. Salary Structures
        sal_alice = SalaryStructure(
            employee_id=emp_alice.id,
            basic_salary=5200.0,
            house_rent_allowance=2080.0,
            special_allowance=2136.0,
            conveyance_allowance=1000.0,
            provident_fund=624.0,
            professional_tax=200.0,
            income_tax_tds=1200.0
        )
        session.add(sal_alice)

        # 8. Initial Payroll Run
        last_month = (date.today().replace(day=1) - timedelta(days=1))
        pay_run = PayrollRun(
            month=last_month.month,
            year=last_month.year,
            status=PayrollStatus.VALIDATED,
            total_employees=5,
            total_gross_amount=48500.0,
            total_deductions=9800.0,
            total_net_amount=38700.0
        )
        session.add(pay_run)
        await session.flush()

        # Payslip for Alice
        payslip_alice = Payslip(
            payroll_run_id=pay_run.id,
            employee_id=emp_alice.id,
            month=last_month.month,
            year=last_month.year,
            basic_salary=5200.0,
            hra=2080.0,
            allowances=3136.0,
            gross_pay=10416.0,
            pf_deduction=624.0,
            tax_deduction=1400.0,
            total_deductions=2024.0,
            net_pay=8392.0,
            payment_status="PAID"
        )
        session.add(payslip_alice)

        # 9. Company Policies for RAG
        p1 = PolicyDocument(
            title="Leave and Attendance Guidelines",
            category="Absence Management",
            full_text=(
                "Employees are entitled to 12 Casual Leaves, 10 Sick Leaves, and 18 Annual Leaves per calendar year. "
                "Casual leaves must be submitted at least 2 working days in advance. Sick leaves of more than 2 consecutive "
                "days require a physician's medical certificate. Paternity leave provides 10 business days of paid time off, "
                "while maternity leave provides 26 weeks of paid time off in accordance with labor guidelines."
            )
        )
        p2 = PolicyDocument(
            title="Remote Work & Hybrid Guidelines",
            category="Workplace",
            full_text=(
                "Apryde operates on a flexible hybrid model. Team members can work remotely up to 3 days per week "
                "with manager alignment. Core collaborative hours are 10:00 AM to 4:00 PM in the employee's local timezone. "
                "Internet stipend of up to $75/month is reimbursable through the ESS Expense portal."
            )
        )
        p3 = PolicyDocument(
            title="Travel & Expense Reimbursement Policy",
            category="Finance",
            full_text=(
                "All business-related expenses including client dinners, software tools, and travel accommodation "
                "must be accompanied by tax invoices. Meals during domestic travel are capped at $80/day. "
                "Reimbursements submitted before the 20th of the month will be credited in that month's payroll cycle."
            )
        )
        session.add_all([p1, p2, p3])

        # 10. Job Postings & Candidates for ATS
        job1 = JobPosting(
            title="Senior Full-Stack Engineer (AI/Next.js)",
            department_id=eng_dept.id,
            location="San Francisco / Hybrid",
            job_type="Full-time",
            description="Seeking a versatile full-stack engineer to lead core AI agentic features using Python, FastAPI, and Next.js.",
            requirements="5+ years in Python/Typescript. Strong experience with Docker, PostgreSQL, and LLM APIs.",
            salary_range="$140,000 - $175,000",
            status=JobStatus.ACTIVE
        )
        session.add(job1)
        await session.flush()

        cand1 = Candidate(
            full_name="Jordan Reed",
            email="jordan.reed@example.com",
            phone="+1-555-0812",
            resume_text="Senior engineer with 6 years experience in FastAPI, Docker, Next.js, and pgvector embeddings.",
            parsed_skills="Python, FastAPI, TypeScript, Next.js, Docker, PostgreSQL, LLMs",
            experience_years=6.0,
            current_company="CloudScale AI"
        )
        session.add(cand1)
        await session.flush()

        app1 = Application(
            job_id=job1.id,
            candidate_id=cand1.id,
            stage=ApplicationStage.INTERVIEW,
            ai_match_score=94.5,
            ai_screening_summary="Exceptional fit: 6 years production Python/FastAPI and modern Next.js experience with containerized deployments."
        )
        session.add(app1)

        # 11. Goals / OKRs
        goal1 = Goal(
            employee_id=emp_alice.id,
            title="Architect & Ship Agentic HRMS Chat Drawer",
            description="Deliver streaming LLM copilot with interactive HITL action cards by end of Q4.",
            progress=85.0,
            status=GoalStatus.IN_PROGRESS
        )
        session.add(goal1)

        await session.commit()
        await seed_assets_if_empty(session)
        print("[Setup] Seeding completed successfully! Default accounts ready.")


async def seed_assets_if_empty(session):
    res = await session.execute(select(Asset))
    if res.scalars().first():
        return

    print("[Setup] Seeding initial hardware & enterprise assets...")
    alice_res = await session.execute(select(Employee).join(User).where(User.email == "employee@company.com"))
    emp_alice = alice_res.scalar_one_or_none()

    mgr_res = await session.execute(select(Employee).join(User).where(User.email == "manager@company.com"))
    emp_manager = mgr_res.scalar_one_or_none()

    demo_assets = [
        Asset(
            asset_tag="AST-8821",
            name='MacBook Pro 16" M3 Max',
            category=AssetCategory.HARDWARE,
            manufacturer="Apple",
            model_number="A2991 - 36GB RAM / 1TB SSD",
            serial_number="C02XG788MD6T",
            purchase_date=date(2024, 3, 1),
            purchase_cost=3499.00,
            warranty_expiry=date(2027, 3, 1),
            status=AssetStatus.ASSIGNED if emp_alice else AssetStatus.IN_STOCK,
            condition=AssetCondition.EXCELLENT,
            assigned_to_id=emp_alice.id if emp_alice else None,
            assigned_date=date(2024, 3, 5) if emp_alice else None,
            location="Remote / Employee Workstation",
            specifications="Apple M3 Max 14-core CPU, 30-core GPU, 36GB Unified Memory, Space Black",
            notes="Assigned for Senior Engineering development workflows."
        ),
        Asset(
            asset_tag="AST-8822",
            name='Dell UltraSharp 32" 4K USB-C Hub Monitor',
            category=AssetCategory.PERIPHERALS,
            manufacturer="Dell",
            model_number="U3223QE",
            serial_number="CN-0F9M7K-74445",
            purchase_date=date(2024, 3, 10),
            purchase_cost=899.00,
            warranty_expiry=date(2027, 3, 10),
            status=AssetStatus.ASSIGNED if emp_alice else AssetStatus.IN_STOCK,
            condition=AssetCondition.EXCELLENT,
            assigned_to_id=emp_alice.id if emp_alice else None,
            assigned_date=date(2024, 3, 12) if emp_alice else None,
            location="Remote / Employee Home Office",
            specifications="32-inch 4K UHD (3840 x 2160) IPS Black with 90W Power Delivery",
            notes="Shipped to employee home address."
        ),
        Asset(
            asset_tag="AST-492",
            name="YubiKey 5C NFC Security Key",
            category=AssetCategory.SECURITY,
            manufacturer="Yubico",
            model_number="Y-5C-NFC",
            serial_number="YK-9842109",
            purchase_date=date(2024, 1, 15),
            purchase_cost=55.00,
            warranty_expiry=date(2026, 1, 15),
            status=AssetStatus.ASSIGNED if emp_alice else AssetStatus.IN_STOCK,
            condition=AssetCondition.NEW,
            assigned_to_id=emp_alice.id if emp_alice else None,
            assigned_date=date(2024, 3, 5) if emp_alice else None,
            location="Assigned to Employee",
            specifications="FIDO2, WebAuthn, U2F, Smart Card, OTP over USB-C and NFC",
            notes="Primary enterprise 2FA token."
        ),
        Asset(
            asset_tag="AST-8830",
            name='MacBook Pro 14" M3 Pro',
            category=AssetCategory.HARDWARE,
            manufacturer="Apple",
            model_number="A2992 - 18GB RAM / 512GB SSD",
            serial_number="C02FL981MD6R",
            purchase_date=date(2023, 2, 1),
            purchase_cost=1999.00,
            warranty_expiry=date(2026, 2, 1),
            status=AssetStatus.ASSIGNED if emp_manager else AssetStatus.IN_STOCK,
            condition=AssetCondition.EXCELLENT,
            assigned_to_id=emp_manager.id if emp_manager else None,
            assigned_date=date(2023, 2, 5) if emp_manager else None,
            location="HQ / Manager Workstation",
            specifications="Apple M3 Pro 11-core CPU, 14-core GPU, 18GB RAM, Silver",
            notes="Standard engineering management deployment."
        ),
        Asset(
            asset_tag="AST-8831",
            name="Logitech MX Master 3S Wireless Mouse",
            category=AssetCategory.PERIPHERALS,
            manufacturer="Logitech",
            model_number="MX-M3S-GR",
            serial_number="LZ-8829104",
            purchase_date=date(2023, 2, 1),
            purchase_cost=99.00,
            warranty_expiry=date(2025, 2, 1),
            status=AssetStatus.ASSIGNED if emp_manager else AssetStatus.IN_STOCK,
            condition=AssetCondition.GOOD,
            assigned_to_id=emp_manager.id if emp_manager else None,
            assigned_date=date(2023, 2, 5) if emp_manager else None,
            location="HQ - Floor 3",
            specifications="8K DPI sensor with Quiet Clicks and MagSpeed scrolling",
            notes="Ergonomic accessory."
        ),
        Asset(
            asset_tag="AST-9001",
            name="Dell Latitude 7440 Ultrabook",
            category=AssetCategory.HARDWARE,
            manufacturer="Dell",
            model_number="Latitude 7440 - i7 / 32GB",
            serial_number="DL-88192301",
            purchase_date=date(2024, 6, 1),
            purchase_cost=1650.00,
            warranty_expiry=date(2027, 6, 1),
            status=AssetStatus.IN_STOCK,
            condition=AssetCondition.NEW,
            location="HQ IT Depot - Locker B-04",
            specifications="Intel Core i7-1365U, 32GB LPDDR5, 512GB NVMe SSD, 14-inch FHD+",
            notes="Prepared for upcoming engineering new hire."
        ),
        Asset(
            asset_tag="AST-9002",
            name='MacBook Air 15" M3',
            category=AssetCategory.HARDWARE,
            manufacturer="Apple",
            model_number="A3114 - 16GB / 512GB",
            serial_number="C02GQ774MD6U",
            purchase_date=date(2024, 5, 20),
            purchase_cost=1499.00,
            warranty_expiry=date(2027, 5, 20),
            status=AssetStatus.IN_STOCK,
            condition=AssetCondition.NEW,
            location="HQ IT Depot - Locker A-02",
            specifications="Apple M3 8-core CPU, 10-core GPU, 16GB RAM, Midnight",
            notes="In stock, unallocated."
        ),
        Asset(
            asset_tag="AST-9003",
            name="Lenovo ThinkPad X1 Carbon Gen 11",
            category=AssetCategory.HARDWARE,
            manufacturer="Lenovo",
            model_number="21HM001WUS",
            serial_number="PF-4481023",
            purchase_date=date(2023, 8, 15),
            purchase_cost=1799.00,
            warranty_expiry=date(2026, 8, 15),
            status=AssetStatus.MAINTENANCE,
            condition=AssetCondition.FAIR,
            location="IT Service Repair Depot",
            specifications="Intel Core i7-1355U, 16GB RAM, 512GB SSD",
            notes="Undergoing diagnostics for display backlight flicker."
        ),
        Asset(
            asset_tag="AST-493",
            name="YubiKey 5C NFC Security Key",
            category=AssetCategory.SECURITY,
            manufacturer="Yubico",
            model_number="Y-5C-NFC",
            serial_number="YK-9842110",
            purchase_date=date(2024, 1, 15),
            purchase_cost=55.00,
            warranty_expiry=date(2026, 1, 15),
            status=AssetStatus.IN_STOCK,
            condition=AssetCondition.NEW,
            location="IT Security Safe",
            specifications="Hardware 2FA / Passkey token",
            notes="Unassigned backup token."
        ),
        Asset(
            asset_tag="AST-7001",
            name="Herman Miller Aeron Ergonomic Chair",
            category=AssetCategory.OFFICE_FURNITURE,
            manufacturer="Herman Miller",
            model_number="Aeron Size B",
            serial_number="HM-AERON-2024-09",
            purchase_date=date(2024, 2, 10),
            purchase_cost=1395.00,
            warranty_expiry=date(2036, 2, 10),
            status=AssetStatus.ASSIGNED if emp_alice else AssetStatus.IN_STOCK,
            condition=AssetCondition.EXCELLENT,
            assigned_to_id=emp_alice.id if emp_alice else None,
            assigned_date=date(2024, 3, 5) if emp_alice else None,
            location="HQ - Floor 3 Desk 314",
            specifications="PostureFit SL, Fully Adjustable Arms, Standard Tilt",
            notes="Ergonomic workstation equipment."
        ),
    ]

    session.add_all(demo_assets)
    await session.flush()

    if emp_alice:
        req1 = AssetRequest(
            employee_id=emp_alice.id,
            category=AssetCategory.PERIPHERALS,
            item_name="CalDigit TS4 Thunderbolt 4 Dock",
            priority="normal",
            reason="Need multi-port Thunderbolt 4 dock for dual-monitor engineering setup and 98W charging.",
            status=AssetRequestStatus.PENDING
        )
        session.add(req1)

    await session.commit()
    print("[Setup] Asset inventory seeded successfully!")

if __name__ == "__main__":
    asyncio.run(init_db())

