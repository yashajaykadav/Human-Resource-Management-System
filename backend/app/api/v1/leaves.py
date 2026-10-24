from datetime import datetime, date
from typing import List, Optional, Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.api.deps import get_current_user, get_current_employee, require_roles, require_permission, get_user_permissions
from app.models.user import User
from app.models.employee import Employee
from app.models.leave import LeaveRequest, LeaveBalance, LeaveType, LeaveStatus
from app.schemas.hrms import LeaveRequestCreate, LeaveApprovalUpdate, LeaveRequestResponse

router = APIRouter(prefix="/leaves", tags=["Leave Management"])

def get_enum_val(val: Any) -> str:
    if hasattr(val, "value"):
        return str(val.value)
    return str(val)

@router.get("/balances")
async def get_my_leave_balances(
    emp: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    query = select(LeaveBalance).where(LeaveBalance.employee_id == emp.id)
    result = await db.execute(query)
    balances = result.scalars().all()
    
    return [
        {
            "id": str(b.id),
            "leave_type": get_enum_val(b.leave_type).lower(),
            "total_allocated": b.total_allocated,
            "used": b.used,
            "pending": b.pending,
            "remaining": b.remaining
        }
        for b in balances
    ]

@router.get("/requests")
async def get_my_leave_requests(
    emp: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(LeaveRequest)
        .options(
            selectinload(LeaveRequest.manager).selectinload(Employee.user),
            selectinload(LeaveRequest.hr).selectinload(Employee.user)
        )
        .where(LeaveRequest.employee_id == emp.id)
        .order_by(LeaveRequest.created_at.desc())
    )
    result = await db.execute(query)
    requests = result.scalars().all()
    
    return [
        {
            "id": str(r.id),
            "leave_type": get_enum_val(r.leave_type).lower(),
            "start_date": r.start_date.isoformat(),
            "end_date": r.end_date.isoformat(),
            "days_count": r.days_count,
            "reason": r.reason,
            "status": "manager_approved" if ((r.manager_approval_status or "").lower() == "approved" and get_enum_val(r.status).lower() == "pending") else get_enum_val(r.status).lower(),
            "manager_approval_status": r.manager_approval_status or "pending",
            "manager_name": f"{r.manager.user.first_name} {r.manager.user.last_name}" if r.manager and r.manager.user else None,
            "manager_comments": r.manager_comments,
            "manager_action_at": r.manager_action_at.isoformat() if r.manager_action_at else None,
            "hr_approval_status": r.hr_approval_status or "pending",
            "hr_name": f"{r.hr.user.first_name} {r.hr.user.last_name}" if r.hr and r.hr.user else None,
            "hr_comments": r.hr_comments,
            "hr_action_at": r.hr_action_at.isoformat() if r.hr_action_at else None,
            "approver_comments": r.approver_comments,
            "created_at": r.created_at.isoformat()
        }
        for r in requests
    ]

@router.post("/requests")
async def submit_leave_request(
    data: LeaveRequestCreate,
    emp: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    if data.end_date < data.start_date:
        raise HTTPException(status_code=400, detail="End date cannot be earlier than start date")
        
    days = (data.end_date - data.start_date).days + 1
    
    raw_type = get_enum_val(data.leave_type).lower().strip()
    try:
        leave_type_enum = LeaveType(raw_type)
    except Exception:
        try:
            leave_type_enum = LeaveType[raw_type.upper()]
        except Exception:
            leave_type_enum = LeaveType.CASUAL
    
    # Check leave balance
    bal_query = select(LeaveBalance).where(
        and_(
            LeaveBalance.employee_id == emp.id,
            LeaveBalance.leave_type == leave_type_enum
        )
    )
    bal_res = await db.execute(bal_query)
    balance = bal_res.scalar_one_or_none()
    
    if balance and balance.remaining < days and leave_type_enum != LeaveType.UNPAID:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient leave balance. You have {balance.remaining} days remaining, but requested {days} days."
        )
        
    request = LeaveRequest(
        employee_id=emp.id,
        leave_type=leave_type_enum,
        start_date=data.start_date,
        end_date=data.end_date,
        days_count=float(days),
        reason=data.reason,
        status=LeaveStatus.PENDING,
        manager_approval_status="pending",
        hr_approval_status="pending"
    )
    db.add(request)
    
    # Update pending balance
    if balance:
        balance.pending += float(days)
        
    await db.commit()
    await db.refresh(request)
    return {
        "message": "Leave request submitted successfully. Awaiting reporting manager approval.",
        "id": str(request.id),
        "days": days,
        "status": get_enum_val(request.status).lower()
    }

@router.get("/team-requests")
async def get_team_leave_requests(
    emp: Employee = Depends(get_current_employee),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns pending/historical leave requests for team members or all if HR/Admin.
    Rule: Self leave requests are excluded from the approval queue.
    """
    user_role = (user.role.value if hasattr(user.role, 'value') else str(user.role)).lower()
    is_hr = bool(user.is_superuser or user_role in ["super_admin", "admin", "hr_admin"])

    base_options = [
        selectinload(LeaveRequest.employee).selectinload(Employee.user),
        selectinload(LeaveRequest.employee).selectinload(Employee.department),
        selectinload(LeaveRequest.employee).selectinload(Employee.manager).selectinload(Employee.user),
        selectinload(LeaveRequest.manager).selectinload(Employee.user),
        selectinload(LeaveRequest.hr).selectinload(Employee.user),
    ]

    if is_hr:
        # HR sees all employee requests, excluding their own self requests
        query = (
            select(LeaveRequest)
            .options(*base_options)
            .where(LeaveRequest.employee_id != emp.id)
            .order_by(LeaveRequest.created_at.desc())
        )
    else:
        # Line manager sees direct reports, excluding self
        sub_query = select(Employee.id).where(Employee.manager_id == emp.id)
        query = (
            select(LeaveRequest)
            .options(*base_options)
            .where(and_(LeaveRequest.employee_id.in_(sub_query), LeaveRequest.employee_id != emp.id))
            .order_by(LeaveRequest.created_at.desc())
        )
        
    result = await db.execute(query)
    requests = result.scalars().all()
    
    response_items = []
    for r in requests:
        req_emp = r.employee
        mgr_status = (r.manager_approval_status or "pending").lower()
        hr_status = (r.hr_approval_status or "pending").lower()
        curr_status = get_enum_val(r.status).lower()

        # Manager approval check:
        # Is the current user this employee's reporting manager?
        is_my_direct_report = bool(req_emp and req_emp.manager_id == emp.id)
        can_approve_manager = is_my_direct_report and mgr_status == "pending" and curr_status in ["pending", "manager_approved"]

        # HR approval check:
        # HR can approve only if manager has already approved (or employee has no reporting manager assigned)
        manager_approved_or_none = (req_emp.manager_id is None) or (mgr_status == "approved")
        can_approve_hr = is_hr and manager_approved_or_none and hr_status == "pending" and curr_status in ["pending", "manager_approved"]

        # Next pending stage descriptor
        if req_emp and req_emp.manager_id is not None and mgr_status != "approved" and curr_status not in ["rejected", "cancelled"]:
            next_stage = "manager"
        elif hr_status != "approved" and curr_status not in ["rejected", "cancelled"]:
            next_stage = "hr"
        else:
            next_stage = "completed"

        response_items.append({
            "id": str(r.id),
            "employee_id": str(r.employee_id),
            "employee_name": f"{req_emp.user.first_name} {req_emp.user.last_name}" if req_emp and req_emp.user else "Staff",
            "department": req_emp.department.name if req_emp and req_emp.department else "General",
            "reporting_manager_name": (
                f"{req_emp.manager.user.first_name} {req_emp.manager.user.last_name}"
                if req_emp and req_emp.manager and req_emp.manager.user
                else "None / Direct Leadership"
            ),
            "leave_type": get_enum_val(r.leave_type).lower(),
            "start_date": r.start_date.isoformat(),
            "end_date": r.end_date.isoformat(),
            "days_count": r.days_count,
            "reason": r.reason,
            "status": "manager_approved" if (mgr_status == "approved" and curr_status == "pending") else curr_status,
            "manager_approval_status": mgr_status,
            "manager_name": f"{r.manager.user.first_name} {r.manager.user.last_name}" if r.manager and r.manager.user else None,
            "manager_comments": r.manager_comments,
            "hr_approval_status": hr_status,
            "hr_name": f"{r.hr.user.first_name} {r.hr.user.last_name}" if r.hr and r.hr.user else None,
            "hr_comments": r.hr_comments,
            "can_approve_manager": can_approve_manager,
            "can_approve_hr": can_approve_hr,
            "next_stage": next_stage,
            "created_at": r.created_at.isoformat()
        })

    return response_items

@router.patch("/requests/{request_id}/review")
async def review_leave_request(
    request_id: UUID,
    data: LeaveApprovalUpdate,
    emp: Employee = Depends(get_current_employee),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Two-stage leave approval workflow:
    1. Reporting Person (Manager) must approve first.
    2. HR (HR Admin / Super Admin) approves next to finalize the leave.
    Strict Rule: Self leave requests CANNOT be approved or rejected by the applicant.
    """
    query = (
        select(LeaveRequest)
        .options(
            selectinload(LeaveRequest.employee).selectinload(Employee.user),
            selectinload(LeaveRequest.employee).selectinload(Employee.manager).selectinload(Employee.user)
        )
        .where(LeaveRequest.id == request_id)
    )
    result = await db.execute(query)
    req = result.scalar_one_or_none()
    
    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found")

    # RULE 1: Self-approval is strictly forbidden
    if req.employee_id == emp.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Self-approval is not permitted. You cannot approve or reject your own leave request."
        )

    # RULE 2: Cannot review an already finalized request
    curr_status = get_enum_val(req.status).lower()
    if curr_status in ["approved", "rejected", "cancelled"]:
        raise HTTPException(
            status_code=400,
            detail=f"This leave request is already finalized with status '{curr_status}'."
        )

    # Role and relationship determination
    user_role = (user.role.value if hasattr(user.role, 'value') else str(user.role)).lower()
    is_hr = bool(user.is_superuser or user_role in ["super_admin", "admin", "hr_admin"])

    req_emp = req.employee
    is_reporting_manager = bool(req_emp and req_emp.manager_id is not None and req_emp.manager_id == emp.id)
    has_reporting_manager = bool(req_emp and req_emp.manager_id is not None)

    if not is_reporting_manager and not is_hr:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to review this leave request. Only the employee's reporting manager or HR can review it."
        )

    raw_decision = get_enum_val(data.status).lower().strip()
    is_approve = "approve" in raw_decision

    # Fetch LeaveBalance to adjust pending / used days
    bal_query = select(LeaveBalance).where(
        and_(
            LeaveBalance.employee_id == req.employee_id,
            LeaveBalance.leave_type == req.leave_type
        )
    )
    bal_res = await db.execute(bal_query)
    balance = bal_res.scalar_one_or_none()

    mgr_status = (req.manager_approval_status or "pending").lower()

    # STAGE 1: Reporting Manager Approval
    # If the employee has a reporting manager and manager approval has not been given yet
    if has_reporting_manager and mgr_status != "approved":
        if not is_reporting_manager:
            mgr_name = (
                f"{req_emp.manager.user.first_name} {req_emp.manager.user.last_name}"
                if req_emp.manager and req_emp.manager.user
                else "their line manager"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Reporting manager approval is required first. This request must be reviewed by {mgr_name} before HR can approve."
            )

        if is_approve:
            req.manager_approval_status = "approved"
            req.manager_id = emp.id
            req.manager_comments = data.comments or "Approved by Reporting Manager"
            req.manager_action_at = datetime.utcnow()
            req.status = LeaveStatus.PENDING
            await db.commit()
            return {
                "message": "Leave request approved by reporting manager. Pending HR final approval.",
                "id": str(req.id),
                "status": "manager_approved",
                "stage": "manager"
            }
        else:
            req.manager_approval_status = "rejected"
            req.manager_id = emp.id
            req.manager_comments = data.comments or "Rejected by Reporting Manager"
            req.manager_action_at = datetime.utcnow()
            req.status = LeaveStatus.REJECTED
            if balance:
                balance.pending = max(0.0, balance.pending - req.days_count)
            await db.commit()
            return {
                "message": "Leave request rejected by reporting manager.",
                "id": str(req.id),
                "status": "rejected",
                "stage": "manager"
            }

    # STAGE 2: HR Final Approval
    # Triggered when manager has approved OR employee does not have a reporting manager assigned
    if not is_hr:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The reporting manager has already approved this request. Final approval must be granted by HR."
        )

    if is_approve:
        req.hr_approval_status = "approved"
        req.hr_id = emp.id
        req.hr_comments = data.comments or "Approved by HR"
        req.hr_action_at = datetime.utcnow()
        req.approver_id = emp.id
        req.approver_comments = data.comments
        req.status = LeaveStatus.APPROVED

        # Final deduction of leave balance
        if balance:
            balance.pending = max(0.0, balance.pending - req.days_count)
            balance.used += req.days_count

        await db.commit()
        return {
            "message": "Leave request fully approved by HR.",
            "id": str(req.id),
            "status": "approved",
            "stage": "hr"
        }
    else:
        req.hr_approval_status = "rejected"
        req.hr_id = emp.id
        req.hr_comments = data.comments or "Rejected by HR"
        req.hr_action_at = datetime.utcnow()
        req.approver_id = emp.id
        req.approver_comments = data.comments
        req.status = LeaveStatus.REJECTED

        # Release pending leave days
        if balance:
            balance.pending = max(0.0, balance.pending - req.days_count)

        await db.commit()
        return {
            "message": "Leave request rejected by HR.",
            "id": str(req.id),
            "status": "rejected",
            "stage": "hr"
        }
