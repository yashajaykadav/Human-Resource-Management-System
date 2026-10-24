from typing import Optional, List, Dict, Any
from datetime import datetime, date
from uuid import UUID
from pydantic import BaseModel
from app.models.asset import AssetCategory, AssetStatus, AssetCondition, AssetRequestStatus

class AssetCreate(BaseModel):
    asset_tag: str
    name: str
    category: AssetCategory = AssetCategory.HARDWARE
    manufacturer: Optional[str] = None
    model_number: Optional[str] = None
    serial_number: Optional[str] = None
    purchase_date: Optional[date] = None
    purchase_cost: Optional[float] = 0.0
    warranty_expiry: Optional[date] = None
    status: AssetStatus = AssetStatus.IN_STOCK
    condition: AssetCondition = AssetCondition.GOOD
    location: Optional[str] = "HQ Depot"
    specifications: Optional[str] = None
    notes: Optional[str] = None
    assigned_to_id: Optional[UUID] = None

class AssetUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[AssetCategory] = None
    manufacturer: Optional[str] = None
    model_number: Optional[str] = None
    serial_number: Optional[str] = None
    purchase_date: Optional[date] = None
    purchase_cost: Optional[float] = None
    warranty_expiry: Optional[date] = None
    status: Optional[AssetStatus] = None
    condition: Optional[AssetCondition] = None
    location: Optional[str] = None
    specifications: Optional[str] = None
    notes: Optional[str] = None

class AssetAssign(BaseModel):
    employee_id: UUID
    assigned_date: Optional[date] = None
    expected_return_date: Optional[date] = None
    notes: Optional[str] = None

class AssetReturn(BaseModel):
    condition: AssetCondition = AssetCondition.GOOD
    location: Optional[str] = "HQ Depot"
    notes: Optional[str] = None

class AssetMaintenance(BaseModel):
    issue_description: str
    notes: Optional[str] = None

class AssetHistoryResponse(BaseModel):
    id: UUID
    asset_id: UUID
    action: str
    notes: Optional[str] = None
    employee_name: Optional[str] = None
    performed_by_name: Optional[str] = None
    created_at: datetime

class AssetResponse(BaseModel):
    id: UUID
    asset_tag: str
    name: str
    category: str
    manufacturer: Optional[str]
    model_number: Optional[str]
    serial_number: Optional[str]
    purchase_date: Optional[date]
    purchase_cost: float
    warranty_expiry: Optional[date]
    status: str
    condition: str
    location: Optional[str]
    specifications: Optional[str]
    notes: Optional[str]
    assigned_to_id: Optional[UUID]
    assigned_to_name: Optional[str] = None
    assigned_to_email: Optional[str] = None
    assigned_to_dept: Optional[str] = None
    assigned_date: Optional[date]
    expected_return_date: Optional[date]
    created_at: datetime
    updated_at: datetime

class AssetRequestCreate(BaseModel):
    category: AssetCategory
    item_name: str
    priority: Optional[str] = "normal"  # low, normal, urgent
    reason: str

class AssetRequestReview(BaseModel):
    status: AssetRequestStatus
    approver_comments: Optional[str] = None
    assigned_asset_id: Optional[UUID] = None

class AssetRequestResponse(BaseModel):
    id: UUID
    employee_id: UUID
    employee_name: str
    employee_email: str
    department_name: Optional[str] = None
    category: str
    item_name: str
    priority: str
    reason: str
    status: str
    approver_comments: Optional[str] = None
    assigned_asset_id: Optional[UUID] = None
    assigned_asset_tag: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class AssetStatsResponse(BaseModel):
    total_assets: int
    in_stock: int
    assigned: int
    maintenance: int
    retired: int
    total_valuation: float
    categories_breakdown: Dict[str, int]
    expiring_warranties: int

