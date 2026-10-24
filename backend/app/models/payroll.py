import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Float, Text, Enum, Integer, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

class PayrollStatus(str, enum.Enum):
    DRAFT = "draft"
    PROCESSING = "processing"
    VALIDATED = "validated"
    DISBURSED = "disbursed"
    FAILED = "failed"

class SalaryStructure(Base):
    __tablename__ = "salary_structures"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), unique=True, nullable=False)
    
    basic_salary = Column(Float, nullable=False, default=0.0)
    house_rent_allowance = Column(Float, nullable=False, default=0.0)
    special_allowance = Column(Float, nullable=False, default=0.0)
    conveyance_allowance = Column(Float, nullable=False, default=0.0)
    
    provident_fund = Column(Float, nullable=False, default=0.0)
    professional_tax = Column(Float, nullable=False, default=0.0)
    income_tax_tds = Column(Float, nullable=False, default=0.0)
    
    currency = Column(String(10), default="USD")
    effective_from = Column(DateTime, default=datetime.utcnow)

    employee = relationship("Employee", back_populates="salary_structure")

class PayrollRun(Base):
    __tablename__ = "payroll_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    month = Column(Integer, nullable=False)  # 1-12
    year = Column(Integer, nullable=False)
    
    status = Column(Enum(PayrollStatus), default=PayrollStatus.DRAFT, nullable=False)
    total_employees = Column(Integer, default=0)
    total_gross_amount = Column(Float, default=0.0)
    total_deductions = Column(Float, default=0.0)
    total_net_amount = Column(Float, default=0.0)
    
    disbursed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    payslips = relationship("Payslip", back_populates="payroll_run", cascade="all, delete-orphan")

class Payslip(Base):
    __tablename__ = "payslips"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    payroll_run_id = Column(UUID(as_uuid=True), ForeignKey("payroll_runs.id", ondelete="CASCADE"), nullable=False)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    
    basic_salary = Column(Float, default=0.0)
    hra = Column(Float, default=0.0)
    allowances = Column(Float, default=0.0)
    bonus = Column(Float, default=0.0)
    gross_pay = Column(Float, default=0.0)
    
    pf_deduction = Column(Float, default=0.0)
    tax_deduction = Column(Float, default=0.0)
    other_deductions = Column(Float, default=0.0)
    total_deductions = Column(Float, default=0.0)
    
    net_pay = Column(Float, default=0.0)
    payment_status = Column(String(30), default="PAID")
    is_anomaly_flagged = Column(Boolean, default=False)
    anomaly_reason = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    payroll_run = relationship("PayrollRun", back_populates="payslips")
    employee = relationship("Employee", back_populates="payslips")

