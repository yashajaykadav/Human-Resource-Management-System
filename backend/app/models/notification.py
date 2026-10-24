"""
Notification Model for HRMS System
"""
from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base
import uuid
import enum


class NotificationType(str, enum.Enum):
    """Types of notifications in the system"""
    INFO = "info"
    WARNING = "warning"
    SUCCESS = "success"
    ERROR = "error"
    APPROVAL_REQUIRED = "approval_required"
    LEAVE_REQUEST = "leave_request"
    PAYROLL_PROCESSING = "payroll_processing"
    ATTENDANCE_ALERT = "attendance_alert"
    SYSTEM_ALERT = "system_alert"
    EMPLOYEE_ONBOARDED = "employee_onboarded"


class NotificationPriority(str, enum.Enum):
    """Priority levels for notifications"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class NotificationStatus(str, enum.Enum):
    """Status of notifications"""
    UNREAD = "unread"
    READ = "read"
    ARCHIVED = "archived"


class Notification(Base):
    """
    Notification model for storing system notifications
    """
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(Enum(NotificationType), default=NotificationType.INFO, nullable=False)
    priority = Column(Enum(NotificationPriority), default=NotificationPriority.MEDIUM, nullable=False)
    status = Column(Enum(NotificationStatus), default=NotificationStatus.UNREAD, nullable=False)
    data = Column(Text, nullable=True)  # JSON string for additional data
    action_url = Column(String(500), nullable=True)  # URL to navigate when clicked
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=True)
    is_global = Column(Boolean, default=False, nullable=False)  # Global notifications for all users

    # Relationships
    user = relationship("User", back_populates="notifications")

    def __repr__(self):
        return f"<Notification(id={self.id}, title='{self.title}', type={self.notification_type.value})>"


class UserNotificationPreference(Base):
    """
    User notification preferences for different notification types
    """
    __tablename__ = "user_notification_preferences"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    notification_type = Column(Enum(NotificationType), nullable=False)
    is_enabled = Column(Boolean, default=True, nullable=False)
    email_notification = Column(Boolean, default=False, nullable=False)
    push_notification = Column(Boolean, default=True, nullable=False)

    user = relationship("User", back_populates="notification_preferences")

    __table_args__ = (
        {
            'unique_constraints': [('user_id', 'notification_type')]
        },
    )
