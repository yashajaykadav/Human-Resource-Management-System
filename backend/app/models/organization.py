import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

class CompanyProfile(Base):
    __tablename__ = "company_profile"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(255), nullable=False, default="Apryde Technologies Inc.")
    legal_name = Column(String(255), nullable=True, default="Apryde Technologies Inc.")
    domain = Column(String(100), nullable=True, default="apryde.io")
    email = Column(String(255), nullable=True, default="contact@apryde.io")
    phone = Column(String(50), nullable=True, default="+1 (555) 019-2834")
    website = Column(String(255), nullable=True, default="https://apryde.io")
    tax_id = Column(String(100), nullable=True, default="US-EIN-98-7654321")
    currency = Column(String(10), nullable=False, default="USD")
    timezone = Column(String(50), nullable=False, default="America/New_York")
    address_street = Column(String(255), nullable=True, default="100 Innovation Way, Suite 400")
    address_city = Column(String(100), nullable=True, default="San Francisco")
    address_state = Column(String(100), nullable=True, default="CA")
    address_country = Column(String(100), nullable=True, default="United States")
    address_postal_code = Column(String(20), nullable=True, default="94105")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Team(Base):
    __tablename__ = "teams"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(50), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    department = relationship("Department", foreign_keys=[department_id])
    lead = relationship("Employee", foreign_keys=[lead_id])

