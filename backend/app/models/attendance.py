import uuid
import enum
from datetime import datetime, date, time
from sqlalchemy import Column, String, Date, Time, DateTime, ForeignKey, Float, Integer, Enum, Boolean, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

class AttendanceStatus(str, enum.Enum):
    PRESENT = "present"
    LATE = "late"
    HALF_DAY = "half_day"
    ABSENT = "absent"
    ON_LEAVE = "on_leave"
    HOLIDAY = "holiday"

class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, default=date.today, nullable=False, index=True)
    
    check_in = Column(DateTime, nullable=True)
    check_out = Column(DateTime, nullable=True)
    total_hours = Column(Float, default=0.0)
    
    status = Column(Enum(AttendanceStatus), default=AttendanceStatus.PRESENT, nullable=False)
    notes = Column(String(255), nullable=True)
    
    ip_address = Column(String(50), nullable=True)
    location = Column(String(100), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    employee = relationship("Employee", back_populates="attendance_records")


class Shift(Base):
    __tablename__ = "shifts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)  # e.g., "General Shift", "Night Shift"
    code = Column(String(20), unique=True, nullable=False)  # e.g., "GEN", "NIGHT"
    start_time = Column(Time, nullable=False)  # e.g., 09:00:00
    end_time = Column(Time, nullable=False)  # e.g., 18:00:00
    days = Column(JSON, nullable=False)  # e.g., ["Mon", "Tue", "Wed", "Thu", "Fri"]
    
    # Break Configuration
    break_duration_minutes = Column(Integer, default=60, nullable=False)  # Unpaid break duration deducted from work hours

    # Flexibility & Grace Periods
    grace_time_minutes = Column(Integer, default=15, nullable=False)  # Allowed late arrival minutes
    half_day_threshold_hours = Column(Float, default=4.0, nullable=False)  # Minimum hours for half-day
    absent_threshold_hours = Column(Float, default=2.0, nullable=False)  # Minimum hours for full-day (< this = absent)

    is_active = Column(Boolean, default=True)
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Roster(Base):
    __tablename__ = "rosters"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)  # e.g., "Q4 Schedule" or employee name schedule
    shift_id = Column(UUID(as_uuid=True), ForeignKey("shifts.id", ondelete="CASCADE"), nullable=False)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=True)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)  # Optional for ongoing rosters
    is_active = Column(Boolean, default=True)
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    shift = relationship("Shift")
    employee = relationship("Employee", foreign_keys=[employee_id])
    department = relationship("Department", foreign_keys=[department_id])

