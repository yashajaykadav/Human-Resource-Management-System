import uuid
import enum
from datetime import datetime, date
from sqlalchemy import Column, String, Float, Date, DateTime, ForeignKey, Text, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

class EmploymentStatus(str, enum.Enum):
    ACTIVE = "active"
    PROBATION = "probation"
    ON_LEAVE = "on_leave"
    TERMINATED = "terminated"
    RESIGNED = "resigned"

class Department(Base):
    __tablename__ = "departments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(100), unique=True, nullable=False)
    code = Column(String(20), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    manager_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    employees = relationship("Employee", back_populates="department")
    job_postings = relationship("JobPosting", back_populates="department")

class Designation(Base):
    __tablename__ = "designations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    title = Column(String(100), unique=True, nullable=False)
    level = Column(String(20), nullable=True) # Junior, Mid, Senior, Lead, Executive
    description = Column(Text, nullable=True)

    employees = relationship("Employee", back_populates="designation")

class Employee(Base):
    __tablename__ = "employees"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    employee_code = Column(String(50), unique=True, nullable=False, index=True)
    
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
    designation_id = Column(UUID(as_uuid=True), ForeignKey("designations.id"), nullable=True)
    manager_id = Column(UUID(as_uuid=True), ForeignKey("employees.id"), nullable=True)
    
    phone = Column(String(30), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    date_of_joining = Column(Date, default=date.today)
    employment_status = Column(Enum(EmploymentStatus), default=EmploymentStatus.ACTIVE, nullable=False)
    
    bank_account_number = Column(String(50), nullable=True)
    bank_name = Column(String(100), nullable=True)
    tax_identifier = Column(String(50), nullable=True)
    emergency_contact = Column(String(100), nullable=True)
    
    annual_ctc = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="employee_profile")
    department = relationship("Department", back_populates="employees")
    designation = relationship("Designation", back_populates="employees")
    
    # Self-referencing manager / direct reports
    manager = relationship("Employee", remote_side=[id], backref="direct_reports")
    
    attendance_records = relationship("AttendanceRecord", back_populates="employee", cascade="all, delete-orphan")
    leave_balances = relationship("LeaveBalance", back_populates="employee", cascade="all, delete-orphan")
    leave_requests = relationship("LeaveRequest", foreign_keys="LeaveRequest.employee_id", back_populates="employee", cascade="all, delete-orphan")
    salary_structure = relationship("SalaryStructure", back_populates="employee", uselist=False, cascade="all, delete-orphan")
    payslips = relationship("Payslip", back_populates="employee", cascade="all, delete-orphan")
    goals = relationship("Goal", back_populates="employee", cascade="all, delete-orphan")

