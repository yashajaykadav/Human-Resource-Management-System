from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.api.deps import get_current_user, get_current_employee, require_roles, require_permission, get_user_permissions
from app.models.user import User
from app.models.employee import Employee
from app.models.asset import (
    Asset,
    AssetCategory,
    AssetStatus,
    AssetCondition,
    AssetHistory,
    AssetRequest,
    AssetRequestStatus
)
from app.schemas.asset import (
    AssetCreate,
    AssetUpdate,
    AssetAssign,
    AssetReturn,
    AssetMaintenance,
    AssetResponse,
    AssetHistoryResponse,
    AssetRequestCreate,
    AssetRequestReview,
    AssetRequestResponse,
    AssetStatsResponse
)

router = APIRouter(prefix="/assets", tags=["Enterprise Asset Management"])

MANAGEMENT_ROLES = ["super_admin", "admin", "hr_admin"]

def format_asset_response(asset: Asset) -> Dict[str, Any]:
    assigned_name = None
    assigned_email = None
    assigned_dept = None
    if asset.assigned_to and asset.assigned_to.user:
        assigned_name = f"{asset.assigned_to.user.first_name} {asset.assigned_to.user.last_name}"
        assigned_email = asset.assigned_to.user.email
        if asset.assigned_to.department:
            assigned_dept = asset.assigned_to.department.name

    return {
        "id": asset.id,
        "asset_tag": asset.asset_tag,
        "name": asset.name,
        "category": asset.category.value if hasattr(asset.category, 'value') else asset.category,
        "manufacturer": asset.manufacturer,
        "model_number": asset.model_number,
        "serial_number": asset.serial_number,
        "purchase_date": asset.purchase_date,
        "purchase_cost": asset.purchase_cost or 0.0,
        "warranty_expiry": asset.warranty_expiry,
        "status": asset.status.value if hasattr(asset.status, 'value') else asset.status,
        "condition": asset.condition.value if hasattr(asset.condition, 'value') else asset.condition,
        "location": asset.location,
        "specifications": asset.specifications,
        "notes": asset.notes,
        "assigned_to_id": asset.assigned_to_id,
        "assigned_to_name": assigned_name,
        "assigned_to_email": assigned_email,
        "assigned_to_dept": assigned_dept,
        "assigned_date": asset.assigned_date,
        "expected_return_date": asset.expected_return_date,
        "created_at": asset.created_at,
        "updated_at": asset.updated_at,
    }


@router.get("/stats", response_model=AssetStatsResponse)
async def get_asset_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Aggregate fleet metrics and valuation statistics."""
    query = select(Asset)
    result = await db.execute(query)
    assets = result.scalars().all()

    total = len(assets)
    in_stock = 0
    assigned = 0
    maintenance = 0
    retired = 0
    total_valuation = 0.0
    categories_breakdown: Dict[str, int] = {}
    expiring_warranties = 0
    today = date.today()
    thirty_days = today + timedelta(days=30)

    for a in assets:
        status_val = a.status.value if hasattr(a.status, 'value') else a.status
        cat_val = a.category.value if hasattr(a.category, 'value') else a.category
        
        categories_breakdown[cat_val] = categories_breakdown.get(cat_val, 0) + 1
        total_valuation += (a.purchase_cost or 0.0)

        if status_val == AssetStatus.IN_STOCK.value:
            in_stock += 1
        elif status_val == AssetStatus.ASSIGNED.value:
            assigned += 1
        elif status_val == AssetStatus.MAINTENANCE.value:
            maintenance += 1
        elif status_val in [AssetStatus.RETIRED.value, AssetStatus.LOST_STOLEN.value]:
            retired += 1

        if a.warranty_expiry and today <= a.warranty_expiry <= thirty_days:
            expiring_warranties += 1

    return {
        "total_assets": total,
        "in_stock": in_stock,
        "assigned": assigned,
        "maintenance": maintenance,
        "retired": retired,
        "total_valuation": round(total_valuation, 2),
        "categories_breakdown": categories_breakdown,
        "expiring_warranties": expiring_warranties
    }


@router.get("/my-assets", response_model=List[AssetResponse])
async def get_my_assets(
    emp: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    """Fetch assets assigned to the signed-in employee."""
    query = (
        select(Asset)
        .options(
            selectinload(Asset.assigned_to).selectinload(Employee.user),
            selectinload(Asset.assigned_to).selectinload(Employee.department)
        )
        .where(Asset.assigned_to_id == emp.id)
        .order_by(Asset.assigned_date.desc().nullslast())
    )
    result = await db.execute(query)
    assets = result.scalars().all()
    return [format_asset_response(a) for a in assets]


@router.get("", response_model=List[AssetResponse])
async def list_assets(
    category: Optional[AssetCategory] = None,
    status: Optional[AssetStatus] = None,
    search: Optional[str] = None,
    employee_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List assets with flexible searching and category/status filtering."""
    query = (
        select(Asset)
        .options(
            selectinload(Asset.assigned_to).selectinload(Employee.user),
            selectinload(Asset.assigned_to).selectinload(Employee.department)
        )
    )

    if category:
        query = query.where(Asset.category == category)
    if status:
        query = query.where(Asset.status == status)
    if employee_id:
        query = query.where(Asset.assigned_to_id == employee_id)
    if search:
        s = f"%{search.strip()}%"
        query = query.where(
            or_(
                Asset.asset_tag.ilike(s),
                Asset.name.ilike(s),
                Asset.serial_number.ilike(s),
                Asset.manufacturer.ilike(s),
                Asset.model_number.ilike(s),
                Asset.location.ilike(s),
            )
        )

    query = query.order_by(Asset.created_at.desc())
    result = await db.execute(query)
    assets = result.scalars().all()
    return [format_asset_response(a) for a in assets]


@router.post("", response_model=AssetResponse, status_code=status.HTTP_201_CREATED)
async def create_asset(
    asset_in: AssetCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(MANAGEMENT_ROLES, module="assets"))
):
    """Provision a new hardware or digital asset into inventory."""
    existing = await db.execute(select(Asset).where(Asset.asset_tag == asset_in.asset_tag))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Asset tag '{asset_in.asset_tag}' already exists")

    if asset_in.serial_number:
        ser_chk = await db.execute(select(Asset).where(Asset.serial_number == asset_in.serial_number))
        if ser_chk.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Serial number is already registered to another asset")

    data = asset_in.model_dump()
    assigned_to_id = data.pop("assigned_to_id", None)
    
    asset = Asset(**data)
    if assigned_to_id:
        emp = await db.get(Employee, assigned_to_id)
        if not emp:
            raise HTTPException(status_code=404, detail="Assigned employee not found")
        asset.assigned_to_id = assigned_to_id
        asset.status = AssetStatus.ASSIGNED
        asset.assigned_date = date.today()

    db.add(asset)
    await db.flush()

    # Record history
    history = AssetHistory(
        asset_id=asset.id,
        action="PROVISIONED",
        notes=f"Initial asset registration into inventory at {asset.location}",
        performed_by_id=current_user.id
    )
    db.add(history)

    await db.commit()
    
    # Reload with relationships
    query = (
        select(Asset)
        .options(
            selectinload(Asset.assigned_to).selectinload(Employee.user),
            selectinload(Asset.assigned_to).selectinload(Employee.department)
        )
        .where(Asset.id == asset.id)
    )
    res = await db.execute(query)
    asset_loaded = res.scalar_one()
    return format_asset_response(asset_loaded)


@router.get("/{id}")
async def get_asset(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve full details and lifecycle history of an asset."""
    query = (
        select(Asset)
        .options(
            selectinload(Asset.assigned_to).selectinload(Employee.user),
            selectinload(Asset.assigned_to).selectinload(Employee.department),
            selectinload(Asset.history).selectinload(AssetHistory.employee).selectinload(Employee.user),
            selectinload(Asset.history).selectinload(AssetHistory.performed_by)
        )
        .where(Asset.id == id)
    )
    result = await db.execute(query)
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    base = format_asset_response(asset)
    history_list = []
    for h in asset.history:
        emp_name = None
        if h.employee and h.employee.user:
            emp_name = f"{h.employee.user.first_name} {h.employee.user.last_name}"
        perf_name = None
        if h.performed_by:
            perf_name = f"{h.performed_by.first_name} {h.performed_by.last_name}"
        
        history_list.append({
            "id": str(h.id),
            "asset_id": str(h.asset_id),
            "action": h.action,
            "notes": h.notes,
            "employee_name": emp_name,
            "performed_by_name": perf_name,
            "created_at": h.created_at.isoformat()
        })

    base["history"] = history_list
    return base


@router.patch("/{id}", response_model=AssetResponse)
async def update_asset(
    id: UUID,
    update_in: AssetUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(MANAGEMENT_ROLES, module="assets"))
):
    """Update asset specifications or parameters."""
    asset = await db.get(Asset, id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    for k, v in update_in.model_dump(exclude_unset=True).items():
        setattr(asset, k, v)

    await db.commit()

    query = (
        select(Asset)
        .options(
            selectinload(Asset.assigned_to).selectinload(Employee.user),
            selectinload(Asset.assigned_to).selectinload(Employee.department)
        )
        .where(Asset.id == id)
    )
    res = await db.execute(query)
    return format_asset_response(res.scalar_one())


@router.post("/{id}/assign", response_model=AssetResponse)
async def assign_asset(
    id: UUID,
    assign_in: AssetAssign,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(MANAGEMENT_ROLES, module="assets"))
):
    """Allocate an asset to an employee."""
    asset = await db.get(Asset, id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    employee = await db.get(Employee, assign_in.employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    asset.assigned_to_id = employee.id
    asset.status = AssetStatus.ASSIGNED
    asset.assigned_date = assign_in.assigned_date or date.today()
    asset.expected_return_date = assign_in.expected_return_date
    asset.location = f"Assigned to {employee.employee_code}"

    # Log history
    emp_user_res = await db.execute(select(User).where(User.id == employee.user_id))
    emp_user = emp_user_res.scalar_one_or_none()
    emp_name = f"{emp_user.first_name} {emp_user.last_name}" if emp_user else employee.employee_code

    history = AssetHistory(
        asset_id=asset.id,
        employee_id=employee.id,
        action="ALLOCATED",
        notes=assign_in.notes or f"Handed over to {emp_name}",
        performed_by_id=current_user.id
    )
    db.add(history)
    await db.commit()

    query = (
        select(Asset)
        .options(
            selectinload(Asset.assigned_to).selectinload(Employee.user),
            selectinload(Asset.assigned_to).selectinload(Employee.department)
        )
        .where(Asset.id == id)
    )
    res = await db.execute(query)
    return format_asset_response(res.scalar_one())


@router.post("/{id}/return", response_model=AssetResponse)
async def return_asset(
    id: UUID,
    return_in: AssetReturn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(MANAGEMENT_ROLES, module="assets"))
):
    """Return an allocated asset back to depot stock."""
    asset = await db.get(Asset, id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    prev_employee_id = asset.assigned_to_id
    asset.assigned_to_id = None
    asset.status = AssetStatus.IN_STOCK
    asset.condition = return_in.condition
    asset.location = return_in.location or "HQ Depot"
    asset.expected_return_date = None

    history = AssetHistory(
        asset_id=asset.id,
        employee_id=prev_employee_id,
        action="RETURNED",
        notes=return_in.notes or f"Returned in {return_in.condition.value} condition to {asset.location}",
        performed_by_id=current_user.id
    )
    db.add(history)
    await db.commit()

    query = (
        select(Asset)
        .options(
            selectinload(Asset.assigned_to).selectinload(Employee.user),
            selectinload(Asset.assigned_to).selectinload(Employee.department)
        )
        .where(Asset.id == id)
    )
    res = await db.execute(query)
    return format_asset_response(res.scalar_one())


@router.post("/{id}/maintenance", response_model=AssetResponse)
async def set_asset_maintenance(
    id: UUID,
    maint_in: AssetMaintenance,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(MANAGEMENT_ROLES, module="assets"))
):
    """Mark an asset as under repair or diagnostics."""
    asset = await db.get(Asset, id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    asset.status = AssetStatus.MAINTENANCE
    asset.location = "IT Service Repair Depot"

    history = AssetHistory(
        asset_id=asset.id,
        employee_id=asset.assigned_to_id,
        action="REPAIR_STARTED",
        notes=f"Issue: {maint_in.issue_description}. {maint_in.notes or ''}",
        performed_by_id=current_user.id
    )
    db.add(history)
    await db.commit()

    query = (
        select(Asset)
        .options(
            selectinload(Asset.assigned_to).selectinload(Employee.user),
            selectinload(Asset.assigned_to).selectinload(Employee.department)
        )
        .where(Asset.id == id)
    )
    res = await db.execute(query)
    return format_asset_response(res.scalar_one())


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(MANAGEMENT_ROLES, module="assets"))
):
    """Decommission or remove an asset record."""
    asset = await db.get(Asset, id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    await db.delete(asset)
    await db.commit()
    return None


# ==============================================================
# ASSET REQUISITION / REQUESTS
# ==============================================================

@router.get("/requests/all", response_model=List[AssetRequestResponse])
async def list_asset_requests(
    status_filter: Optional[AssetRequestStatus] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List asset requisitions. Scoped to employee unless management role."""
    query = (
        select(AssetRequest)
        .options(
            selectinload(AssetRequest.employee).selectinload(Employee.user),
            selectinload(AssetRequest.employee).selectinload(Employee.department),
            selectinload(AssetRequest.assigned_asset)
        )
    )

    perms = await get_user_permissions(current_user, db)
    user_role = (current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)).lower()
    is_admin_or_asset_mgr = (
        current_user.is_superuser
        or user_role in ["super_admin", "admin"]
        or "*" in perms
        or "assets" in perms
    )
    if not is_admin_or_asset_mgr:
        emp_res = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
        emp = emp_res.scalar_one_or_none()
        if not emp:
            return []
        query = query.where(AssetRequest.employee_id == emp.id)

    if status_filter:
        query = query.where(AssetRequest.status == status_filter)

    query = query.order_by(AssetRequest.created_at.desc())
    result = await db.execute(query)
    reqs = result.scalars().all()

    response = []
    for r in reqs:
        emp_name = "Unknown"
        emp_email = ""
        dept_name = None
        if r.employee and r.employee.user:
            emp_name = f"{r.employee.user.first_name} {r.employee.user.last_name}"
            emp_email = r.employee.user.email
            if r.employee.department:
                dept_name = r.employee.department.name

        response.append({
            "id": r.id,
            "employee_id": r.employee_id,
            "employee_name": emp_name,
            "employee_email": emp_email,
            "department_name": dept_name,
            "category": r.category.value if hasattr(r.category, 'value') else r.category,
            "item_name": r.item_name,
            "priority": r.priority,
            "reason": r.reason,
            "status": r.status.value if hasattr(r.status, 'value') else r.status,
            "approver_comments": r.approver_comments,
            "assigned_asset_id": r.assigned_asset_id,
            "assigned_asset_tag": r.assigned_asset.asset_tag if r.assigned_asset else None,
            "created_at": r.created_at,
            "updated_at": r.updated_at,
        })

    return response


@router.post("/requests", response_model=AssetRequestResponse, status_code=status.HTTP_201_CREATED)
async def submit_asset_request(
    request_in: AssetRequestCreate,
    emp: Employee = Depends(get_current_employee),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Submit a requisition for hardware, peripherals, or licenses."""
    req = AssetRequest(
        employee_id=emp.id,
        category=request_in.category,
        item_name=request_in.item_name,
        priority=request_in.priority or "normal",
        reason=request_in.reason,
        status=AssetRequestStatus.PENDING
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)

    return {
        "id": req.id,
        "employee_id": req.employee_id,
        "employee_name": f"{current_user.first_name} {current_user.last_name}",
        "employee_email": current_user.email,
        "department_name": None,
        "category": req.category.value if hasattr(req.category, 'value') else req.category,
        "item_name": req.item_name,
        "priority": req.priority,
        "reason": req.reason,
        "status": req.status.value if hasattr(req.status, 'value') else req.status,
        "approver_comments": None,
        "assigned_asset_id": None,
        "assigned_asset_tag": None,
        "created_at": req.created_at,
        "updated_at": req.updated_at,
    }


@router.patch("/requests/{request_id}", response_model=AssetRequestResponse)
async def review_asset_request(
    request_id: UUID,
    review_in: AssetRequestReview,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(MANAGEMENT_ROLES, module="assets"))
):
    """Approve, reject, or fulfill an employee's asset requisition."""
    req = await db.get(AssetRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Asset request not found")

    req.status = review_in.status
    req.approver_comments = review_in.approver_comments

    # If fulfilled and asset assigned
    if review_in.assigned_asset_id:
        asset = await db.get(Asset, review_in.assigned_asset_id)
        if asset:
            req.assigned_asset_id = asset.id
            asset.assigned_to_id = req.employee_id
            asset.status = AssetStatus.ASSIGNED
            asset.assigned_date = date.today()

            # Record history
            history = AssetHistory(
                asset_id=asset.id,
                employee_id=req.employee_id,
                action="ALLOCATED",
                notes=f"Requisition #{str(req.id)[:8]} fulfilled by {current_user.first_name}",
                performed_by_id=current_user.id
            )
            db.add(history)

    await db.commit()

    query = (
        select(AssetRequest)
        .options(
            selectinload(AssetRequest.employee).selectinload(Employee.user),
            selectinload(AssetRequest.employee).selectinload(Employee.department),
            selectinload(AssetRequest.assigned_asset)
        )
        .where(AssetRequest.id == request_id)
    )
    res = await db.execute(query)
    updated_req = res.scalar_one()

    emp_name = "Unknown"
    emp_email = ""
    dept_name = None
    if updated_req.employee and updated_req.employee.user:
        emp_name = f"{updated_req.employee.user.first_name} {updated_req.employee.user.last_name}"
        emp_email = updated_req.employee.user.email
        if updated_req.employee.department:
            dept_name = updated_req.employee.department.name

    return {
        "id": updated_req.id,
        "employee_id": updated_req.employee_id,
        "employee_name": emp_name,
        "employee_email": emp_email,
        "department_name": dept_name,
        "category": updated_req.category.value if hasattr(updated_req.category, 'value') else updated_req.category,
        "item_name": updated_req.item_name,
        "priority": updated_req.priority,
        "reason": updated_req.reason,
        "status": updated_req.status.value if hasattr(updated_req.status, 'value') else updated_req.status,
        "approver_comments": updated_req.approver_comments,
        "assigned_asset_id": updated_req.assigned_asset_id,
        "assigned_asset_tag": updated_req.assigned_asset.asset_tag if updated_req.assigned_asset else None,
        "created_at": updated_req.created_at,
        "updated_at": updated_req.updated_at,
    }

