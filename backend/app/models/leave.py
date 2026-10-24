import uuid
import enum
from datetime import datetime, date
from sqlalchemy import Column, String, Date, DateTime, ForeignKey, Float, Text, Enum, Integer, Boolean, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

class LeaveType(str, enum.Enum):
    CASUAL = "casual"
    SICK = "sick"
    ANNUAL = "annual"
    MATERNITY = "maternity"
    PATERNITY = "paternity"
    UNPAID = "unpaid"
    BEREAVEMENT = "bereavement"

class LeaveStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"

class LeaveBalance(Base):
    __tablename__ = "leave_balances"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    leave_type = Column(Enum(LeaveType), nullable=False)
    year = Column(Integer, default=2026, nullable=False)
    
    total_allocated = Column(Float, default=12.0)
    used = Column(Float, default=0.0)
    pending = Column(Float, default=0.0)

    @property
    def remaining(self) -> Float:
        return self.total_allocated - self.used - self.pending

    employee = relationship("Employee", back_populates="leave_balances")

class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    leave_type = Column(Enum(LeaveType), nullable=False)
    
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    days_count = Column(Float, nullable=False, default=1.0)
    
    reason = Column(Text, nullable=False)
    status = Column(Enum(LeaveStatus), default=LeaveStatus.PENDING, nullable=False, index=True)
    
    approver_id = Column(UUID(as_uuid=True), ForeignKey("employees.id"), nullable=True)
    approver_comments = Column(Text, nullable=True)

    manager_id = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    manager_approval_status = Column(String(50), default="pending", nullable=True)
    manager_comments = Column(Text, nullable=True)
    manager_action_at = Column(DateTime, nullable=True)

    hr_id = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    hr_approval_status = Column(String(50), default="pending", nullable=True)
    hr_comments = Column(Text, nullable=True)
    hr_action_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    employee = relationship("Employee", foreign_keys=[employee_id], back_populates="leave_requests")
    approver = relationship("Employee", foreign_keys=[approver_id])
    manager = relationship("Employee", foreign_keys=[manager_id])
    hr = relationship("Employee", foreign_keys=[hr_id])


class LeavePolicy(Base):
    __tablename__ = "leave_policies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)  # e.g., "Annual Leave"
    leave_type = Column(Enum(LeaveType), nullable=False)  # e.g., LeaveType.ANNUAL
    total_days = Column(Float, nullable=False, default=18.0)  # Total days allowed per year
    accrual_rule = Column(String(50), nullable=False, default="monthly")  # "monthly", "yearly", "none"
    accrual_amount = Column(Float, nullable=False, default=1.5)  # Days accrued per period
    max_carry_forward = Column(Float, nullable=True, default=0.0)  # Max days that can be carried forward
    requires_approval = Column(Boolean, default=True)
    requires_document = Column(Boolean, default=False)  # e.g., medical certificate for sick leave
    min_service_years = Column(Float, default=0.0)  # Minimum years of service to avail
    gender_specific = Column(Boolean, default=False)  # For maternity/paternity
    applicable_genders = Column(JSON, nullable=True)  # e.g., ["female"] for maternity
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class LeaveCalendar(Base):
    __tablename__ = "leave_calendars"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)  # e.g., "2026 Holidays"
    date = Column(Date, nullable=False)
    is_holiday = Column(Boolean, default=True)
    is_weekend = Column(Boolean, default=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

