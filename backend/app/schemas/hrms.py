from typing import Optional, List, Dict, Any, Union
from datetime import datetime, date, time
from uuid import UUID
from pydantic import BaseModel, EmailStr, GetCoreSchemaHandler
from pydantic_core import CoreSchema, core_schema
from app.models.employee import EmploymentStatus
from app.models.attendance import AttendanceStatus
from app.models.leave import LeaveType, LeaveStatus
from app.models.payroll import PayrollStatus
from app.models.recruitment import JobStatus, ApplicationStage
from app.models.performance import GoalStatus

# --- Pydantic v2 Compatibility for SQLAlchemy Enums ---
def _enum_to_pydantic_schema(cls: type) -> CoreSchema:
    return core_schema.literal_schema([member.value for member in cls])

class EnumWithPydanticSupport:
    @classmethod
    def __get_pydantic_core_schema__(cls, source_type: Any, handler: GetCoreSchemaHandler) -> CoreSchema:
        return _enum_to_pydantic_schema(cls)

# Apply Pydantic support to all SQLAlchemy enums
for enum_cls in [EmploymentStatus, AttendanceStatus, LeaveType, LeaveStatus, PayrollStatus, JobStatus, ApplicationStage, GoalStatus]:
    enum_cls.__bases__ = (EnumWithPydanticSupport, *enum_cls.__bases__)

# Auth Schemas
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    role: str = "admin"

class UserResponse(BaseModel):
    id: UUID
    email: str
    first_name: str
    last_name: str
    role: str
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

# Employee Schemas
class DepartmentCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    manager_id: Optional[UUID] = None

class DepartmentResponse(BaseModel):
    id: UUID
    name: str
    code: str
    description: Optional[str] = None
    manager_id: Optional[UUID] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class DesignationCreate(BaseModel):
    title: str
    level: Optional[str] = "Mid"
    description: Optional[str] = None

class DesignationResponse(BaseModel):
    id: UUID
    title: str
    level: Optional[str]
    description: Optional[str]
    
    class Config:
        from_attributes = True

class EmployeeCreate(BaseModel):
    user_id: UUID
    employee_code: str
    department_id: Optional[UUID] = None
    designation_id: Optional[UUID] = None
    manager_id: Optional[UUID] = None
    phone: Optional[str] = None
    date_of_joining: Optional[date] = None
    annual_ctc: Optional[float] = 0.0

class EmployeeEnrollmentCreate(BaseModel):
    """Creates an employee's sign-in account and HR profile in one request."""
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    role: str = "admin"
    employee_code: str
    department_id: Optional[UUID] = None
    designation_id: Optional[UUID] = None
    manager_id: Optional[UUID] = None
    phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    date_of_joining: Optional[date] = None
    emergency_contact: Optional[str] = None
    annual_ctc: Optional[float] = 0.0

class EmployeeSelfUpdate(BaseModel):
    """Fields an employee may maintain on their own profile."""
    phone: Optional[str] = None
    emergency_contact: Optional[str] = None

class EmployeeAdminUpdate(BaseModel):
    """Fields an administrator or HR admin can update for an employee."""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    employee_code: Optional[str] = None
    department_id: Optional[UUID] = None
    designation_id: Optional[UUID] = None
    manager_id: Optional[UUID] = None
    phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    date_of_joining: Optional[date] = None
    emergency_contact: Optional[str] = None
    annual_ctc: Optional[float] = None
    employment_status: Optional[EmploymentStatus] = None

class EmployeeResponse(BaseModel):
    id: UUID
    user_id: UUID
    employee_code: str
    department_id: Optional[UUID]
    designation_id: Optional[UUID]
    manager_id: Optional[UUID]
    phone: Optional[str]
    date_of_joining: Optional[date]
    employment_status: EmploymentStatus
    annual_ctc: float
    user: Optional[UserResponse] = None
    
    class Config:
        from_attributes = True

# Attendance Schemas
class ClockInOutRequest(BaseModel):
    notes: Optional[str] = None
    location: Optional[str] = "Office / Remote"

class AttendanceResponse(BaseModel):
    id: UUID
    employee_id: UUID
    date: date
    check_in: Optional[datetime]
    check_out: Optional[datetime]
    total_hours: float
    status: AttendanceStatus
    notes: Optional[str]
    
    class Config:
        from_attributes = True


# Shift & Roster Schemas
class ShiftCreate(BaseModel):
    name: str
    code: str
    start_time: time  # Format: "HH:MM"
    end_time: time    # Format: "HH:MM"
    days: List[str]    # e.g., ["Mon", "Tue", "Wed", "Thu", "Fri"]
    break_duration_minutes: Optional[int] = 60
    grace_time_minutes: Optional[int] = 15
    half_day_threshold_hours: Optional[float] = 4.0
    absent_threshold_hours: Optional[float] = 2.0
    description: Optional[str] = None


# Permission Schemas
class PermissionCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None

class PermissionResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    category: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

class RolePermissionCreate(BaseModel):
    role: str
    permission_id: Optional[UUID] = None
    resource: str  # e.g., "employees", "leave_requests"
    actions: List[str]  # e.g., ["create", "read", "update", "delete"]

class RolePermissionResponse(BaseModel):
    id: UUID
    role: str
    permission_id: Optional[UUID]
    resource: str
    actions: List[str]
    permission: Optional[PermissionResponse] = None
    
    class Config:
        from_attributes = True


# Dynamic Role Schemas
class RoleCreate(BaseModel):
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    permissions: List[str] = []

class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[List[str]] = None

class RoleResponse(BaseModel):
    id: UUID
    name: str
    code: str
    description: Optional[str] = None
    is_system: bool = False
    permissions: List[str] = []
    user_count: Optional[int] = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class UserRoleUpdate(BaseModel):
    role: str


# Leave Policy & Calendar Schemas
class LeavePolicyCreate(BaseModel):
    name: str
    leave_type: str  # Should match LeaveType enum values
    total_days: float
    accrual_rule: str = "monthly"  # "monthly", "yearly", "none"
    accrual_amount: float = 1.5
    max_carry_forward: Optional[float] = 0.0
    requires_approval: bool = True
    requires_document: bool = False
    min_service_years: float = 0.0
    gender_specific: bool = False
    applicable_genders: Optional[List[str]] = None
    description: Optional[str] = None

class LeavePolicyResponse(BaseModel):
    id: UUID
    name: str
    leave_type: str
    total_days: float
    accrual_rule: str
    accrual_amount: float
    max_carry_forward: Optional[float]
    requires_approval: bool
    requires_document: bool
    min_service_years: float
    gender_specific: bool
    applicable_genders: Optional[List[str]]
    description: Optional[str]
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class LeaveCalendarCreate(BaseModel):
    name: str
    date: date
    is_holiday: bool = True
    is_weekend: bool = False
    description: Optional[str] = None

class LeaveCalendarResponse(BaseModel):
    id: UUID
    name: str
    date: date
    is_holiday: bool
    is_weekend: bool
    description: Optional[str]
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class ShiftResponse(BaseModel):
    id: UUID
    name: str
    code: str
    start_time: time
    end_time: time
    days: List[str]
    break_duration_minutes: Optional[int] = 60
    grace_time_minutes: Optional[int] = 15
    half_day_threshold_hours: Optional[float] = 4.0
    absent_threshold_hours: Optional[float] = 2.0
    is_active: bool
    description: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

class RosterCreate(BaseModel):
    name: str
    shift_id: UUID
    employee_id: Optional[UUID] = None
    department_id: Optional[UUID] = None
    start_date: date
    end_date: Optional[date] = None
    description: Optional[str] = None

class RosterResponse(BaseModel):
    id: UUID
    name: str
    shift_id: UUID
    employee_id: Optional[UUID] = None
    employee_name: Optional[str] = None
    employee_code: Optional[str] = None
    department_id: Optional[UUID] = None
    department_name: Optional[str] = None
    start_date: date
    end_date: Optional[date]
    is_active: bool
    description: Optional[str]
    created_at: datetime
    shift: Optional[ShiftResponse] = None
    
    class Config:
        from_attributes = True

# Leave Schemas
class LeaveRequestCreate(BaseModel):
    leave_type: LeaveType
    start_date: date
    end_date: date
    reason: str

class LeaveApprovalUpdate(BaseModel):
    status: Union[LeaveStatus, str] # APPROVED or REJECTED
    comments: Optional[str] = None

class LeaveRequestResponse(BaseModel):
    id: UUID
    employee_id: UUID
    leave_type: LeaveType
    start_date: date
    end_date: date
    days_count: float
    reason: str
    status: LeaveStatus
    approver_comments: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

class LeaveBalanceResponse(BaseModel):
    id: UUID
    employee_id: UUID
    leave_type: LeaveType
    total_allocated: float
    used: float
    pending: float
    remaining: float
    
    class Config:
        from_attributes = True

# Payroll Schemas
class SalaryStructureCreate(BaseModel):
    employee_id: UUID
    basic_salary: float
    house_rent_allowance: float
    special_allowance: float
    provident_fund: float
    professional_tax: float
    income_tax_tds: float

class PayrollRunCreate(BaseModel):
    month: int
    year: int

class PayslipResponse(BaseModel):
    id: UUID
    employee_id: UUID
    month: int
    year: int
    basic_salary: float
    hra: float
    allowances: float
    gross_pay: float
    pf_deduction: float
    tax_deduction: float
    total_deductions: float
    net_pay: float
    payment_status: str
    is_anomaly_flagged: bool
    anomaly_reason: Optional[str]
    
    class Config:
        from_attributes = True

# Recruitment Schemas
class JobPostingCreate(BaseModel):
    title: str
    department_id: UUID
    description: str
    requirements: str
    min_experience_years: int = 2
    salary_range: Optional[str] = "$80k - $120k"
    job_type: str = "Full-time"

class CandidateCreate(BaseModel):
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    resume_text: str
    parsed_skills: Optional[str] = None
    experience_years: float = 0.0

class ApplicationUpdateStage(BaseModel):
    stage: ApplicationStage
    notes: Optional[str] = None

# AI Agent Schemas
class AgentMessageRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    confirmed_action: Optional[Dict[str, Any]] = None # When user confirms an HITL action

class AgentActionCard(BaseModel):
    action_type: str # e.g. "submit_leave", "approve_leave", "disburse_payroll"
    title: str
    description: str
    payload: Dict[str, Any]
    requires_confirmation: bool = True

class AgentMessageResponse(BaseModel):
    reply: str
    suggested_actions: Optional[List[str]] = []
    action_card: Optional[AgentActionCard] = None
    llm_provider_used: str = "gemini"

