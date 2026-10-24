import uuid
import enum
from datetime import datetime, date
from sqlalchemy import Column, String, Float, Date, DateTime, ForeignKey, Text, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

class AssetCategory(str, enum.Enum):
    HARDWARE = "hardware"
    PERIPHERALS = "peripherals"
    MOBILE_DEVICES = "mobile_devices"
    SECURITY = "security"
    SOFTWARE_LICENSE = "software_license"
    OFFICE_FURNITURE = "office_furniture"

class AssetStatus(str, enum.Enum):
    IN_STOCK = "in_stock"
    ASSIGNED = "assigned"
    MAINTENANCE = "maintenance"
    RETIRED = "retired"
    LOST_STOLEN = "lost_stolen"

class AssetCondition(str, enum.Enum):
    NEW = "new"
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"

class AssetRequestStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    FULFILLED = "fulfilled"

class Asset(Base):
    __tablename__ = "assets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    asset_tag = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    category = Column(Enum(AssetCategory), nullable=False, default=AssetCategory.HARDWARE, index=True)
    manufacturer = Column(String(100), nullable=True)
    model_number = Column(String(100), nullable=True)
    serial_number = Column(String(100), unique=True, nullable=True, index=True)
    
    purchase_date = Column(Date, nullable=True)
    purchase_cost = Column(Float, default=0.0)
    warranty_expiry = Column(Date, nullable=True)
    
    status = Column(Enum(AssetStatus), nullable=False, default=AssetStatus.IN_STOCK, index=True)
    condition = Column(Enum(AssetCondition), nullable=False, default=AssetCondition.GOOD)
    
    assigned_to_id = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True)
    assigned_date = Column(Date, nullable=True)
    expected_return_date = Column(Date, nullable=True)
    
    location = Column(String(100), default="HQ Depot")
    specifications = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    assigned_to = relationship("Employee", foreign_keys=[assigned_to_id], backref="assigned_assets")
    history = relationship("AssetHistory", back_populates="asset", cascade="all, delete-orphan", order_by="desc(AssetHistory.created_at)")

class AssetHistory(Base):
    __tablename__ = "asset_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(50), nullable=False)  # ALLOCATED, RETURNED, REPAIR_STARTED, REPAIR_COMPLETED, RETIRED
    notes = Column(Text, nullable=True)
    performed_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    asset = relationship("Asset", back_populates="history")
    employee = relationship("Employee", foreign_keys=[employee_id])
    performed_by = relationship("User", foreign_keys=[performed_by_id])

class AssetRequest(Base):
    __tablename__ = "asset_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(Enum(AssetCategory), nullable=False)
    item_name = Column(String(100), nullable=False)
    priority = Column(String(20), default="normal")  # low, normal, urgent
    reason = Column(Text, nullable=False)
    status = Column(Enum(AssetRequestStatus), default=AssetRequestStatus.PENDING, nullable=False)
    approver_comments = Column(Text, nullable=True)
    assigned_asset_id = Column(UUID(as_uuid=True), ForeignKey("assets.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    employee = relationship("Employee", foreign_keys=[employee_id])
    assigned_asset = relationship("Asset", foreign_keys=[assigned_asset_id])