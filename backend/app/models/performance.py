import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Float, Text, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

class GoalStatus(str, enum.Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    BLOCKED = "blocked"

class Goal(Base):
    __tablename__ = "goals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    quarter = Column(String(20), default="Q4-2026")
    
    progress = Column(Float, default=0.0) # 0 - 100%
    status = Column(Enum(GoalStatus), default=GoalStatus.IN_PROGRESS, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    employee = relationship("Employee", back_populates="goals")

class PerformanceReview(Base):
    __tablename__ = "performance_reviews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    reviewer_id = Column(UUID(as_uuid=True), ForeignKey("employees.id"), nullable=False)
    cycle_name = Column(String(100), default="Annual Review 2026")
    
    rating = Column(Float, default=0.0) # 1.0 - 5.0
    strengths = Column(Text, nullable=True)
    areas_of_improvement = Column(Text, nullable=True)
    manager_feedback = Column(Text, nullable=True)
    
    status = Column(String(30), default="SUBMITTED") # DRAFT, SUBMITTED, FINALIZED
    created_at = Column(DateTime, default=datetime.utcnow)

