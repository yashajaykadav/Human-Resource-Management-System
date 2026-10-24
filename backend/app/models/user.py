import enum
import uuid
from datetime import datetime
from sqlalchemy import Column, String, ForeignKey, Boolean, DateTime, Enum, JSON, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, foreign
from app.core.database import Base

class Role(Base):
    __tablename__ = "roles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(100), unique=True, nullable=False)
    code = Column(String(50), unique=True, nullable=False, index=True)
    description = Column(String(255), nullable=True)
    is_system = Column(Boolean, default=False)
    permissions = Column(JSON, default=list, nullable=False)  # List of module identifiers e.g. ["*"] or ["dashboard", "employees", ...]
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    role = Column(String(50), default="admin", nullable=False, index=True)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    employee_profile = relationship("Employee", back_populates="user", uselist=False, cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user")
    notifications = relationship("Notification", back_populates="user", foreign_keys="Notification.user_id")
    notification_preferences = relationship("UserNotificationPreference", back_populates="user")
    role_obj = relationship("Role", primaryjoin="foreign(User.role) == Role.code", uselist=False, viewonly=True)


class Permission(Base):
    __tablename__ = "permissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False)  # e.g., "manage_employees", "approve_leaves"
    description = Column(String(255), nullable=True)
    category = Column(String(50), nullable=True)  # e.g., "employees", "leaves", "payroll"
    created_at = Column(DateTime, default=datetime.utcnow)


class RolePermission(Base):
    __tablename__ = "role_permissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role = Column(String(50), nullable=False)  # The role code this permission applies to
    permission_id = Column(UUID(as_uuid=True), ForeignKey("permissions.id", ondelete="CASCADE"))
    resource = Column(String(100), nullable=False)  # e.g., "employees", "leave_requests", "payroll"
    actions = Column(JSON, nullable=False)  # List of actions: ["create", "read", "update", "delete"]
    
    # Relationships
    permission = relationship("Permission")
