import calendar
from datetime import datetime, date, time, timedelta
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.api.deps import get_current_user, get_current_employee, require_roles, require_permission, get_user_permissions
from app.models.user import User
from app.models.employee import Employee
from app.models.attendance import AttendanceRecord, AttendanceStatus
from app.models.leave import LeaveRequest, LeaveStatus, LeaveCalendar
from app.schemas.hrms import AttendanceResponse, ClockInOutRequest

router = APIRouter(prefix="/attendance", tags=["Attendance & Timesheets"])


async def _resolve_accessible_employee(
    target_employee_id: Optional[UUID],
    current_emp: Employee,
    current_user: User,
    db: AsyncSession,
) -> Employee:
    """
    Resolve the target employee and verify that `current_user` is permitted to view their attendance.
    Allowed:
    - Self (any authenticated employee viewing their own attendance)
    - HR Admin & Super Admin (all employees)
    - Reporting Manager (any employee where Employee.manager_id == current_emp.id)
    """
    emp_id = target_employee_id or current_emp.id
    query = (
        select(Employee)
        .options(
            selectinload(Employee.user),
            selectinload(Employee.department),
            selectinload(Employee.designation),
            selectinload(Employee.manager).selectinload(Employee.user),
        )
        .where(Employee.id == emp_id)
    )
    res = await db.execute(query)
    target_emp = res.scalar_one_or_none()
    if not target_emp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    if target_emp.id == current_emp.id:
        return target_emp

    perms = await get_user_permissions(current_user, db)
    user_role = (current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)).lower()
    if current_user.is_superuser or user_role in ["super_admin", "admin"] or "*" in perms or "attendance" in perms:
        return target_emp

    if target_emp.manager_id == current_emp.id:
        return target_emp

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied: You can only view your own attendance or attendance of employees reporting to you.",
    )


def _format_iso(dt: Optional[datetime]) -> Optional[str]:
    if not dt:
        return None
    iso = dt.isoformat()
    return iso if dt.tzinfo or iso.endswith("Z") else f"{iso}Z"


@router.get("/today")
async def get_today_status(
    emp: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    today = date.today()
    query = select(AttendanceRecord).where(
        and_(
            AttendanceRecord.employee_id == emp.id,
            AttendanceRecord.date == today
        )
    )
    result = await db.execute(query)
    record = result.scalar_one_or_none()
    
    if not record:
        return {
            "employee_id": str(emp.id),
            "date": today.isoformat(),
            "date_of_joining": emp.date_of_joining.isoformat() if emp.date_of_joining else None,
            "clocked_in": False,
            "check_in": None,
            "check_out": None,
            "total_hours": 0.0,
            "status": "not_started",
            "location": None,
            "notes": None,
        }
    return {
        "employee_id": str(emp.id),
        "date": today.isoformat(),
        "date_of_joining": emp.date_of_joining.isoformat() if emp.date_of_joining else None,
        "clocked_in": record.check_in is not None and record.check_out is None,
        "check_in": _format_iso(record.check_in),
        "check_out": _format_iso(record.check_out),
        "total_hours": record.total_hours,
        "status": record.status.value,
        "location": record.location,
        "notes": record.notes,
    }

@router.post("/clock-in")
async def clock_in(
    data: ClockInOutRequest,
    emp: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    today = date.today()
    now = datetime.utcnow()
    
    query = select(AttendanceRecord).where(
        and_(
            AttendanceRecord.employee_id == emp.id,
            AttendanceRecord.date == today
        )
    )
    result = await db.execute(query)
    record = result.scalar_one_or_none()
    
    if record and record.check_in:
        raise HTTPException(status_code=400, detail="Already clocked in for today")
        
    status_val = AttendanceStatus.PRESENT
    # Late arrival threshold: after 9:30 AM
    if now.hour > 9 or (now.hour == 9 and now.minute > 30):
        status_val = AttendanceStatus.LATE
        
    if not record:
        record = AttendanceRecord(
            employee_id=emp.id,
            date=today,
            check_in=now,
            status=status_val,
            location=data.location,
            notes=data.notes
        )
        db.add(record)
    else:
        record.check_in = now
        record.status = status_val
        record.location = data.location
        if data.notes:
            record.notes = data.notes
            
    await db.commit()
    await db.refresh(record)
    return {"message": "Clocked in successfully", "check_in": _format_iso(record.check_in), "status": record.status.value}

@router.post("/clock-out")
async def clock_out(
    data: ClockInOutRequest,
    emp: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    today = date.today()
    now = datetime.utcnow()
    
    query = select(AttendanceRecord).where(
        and_(
            AttendanceRecord.employee_id == emp.id,
            AttendanceRecord.date == today
        )
    )
    result = await db.execute(query)
    record = result.scalar_one_or_none()
    
    if not record or not record.check_in:
        raise HTTPException(status_code=400, detail="Cannot clock out without clocking in first")
    if record.check_out:
        raise HTTPException(status_code=400, detail="Already clocked out for today")
        
    record.check_out = now
    duration = (now - record.check_in).total_seconds() / 3600.0
    record.total_hours = round(duration, 2)
    
    if record.total_hours < 4.0:
        record.status = AttendanceStatus.HALF_DAY
        
    await db.commit()
    await db.refresh(record)
    return {
        "message": "Clocked out successfully",
        "check_out": _format_iso(record.check_out),
        "total_hours": record.total_hours,
        "status": record.status.value
    }

@router.get("/team")
async def get_team_attendance(
    target_date: Optional[date] = Query(None, description="Date for daily attendance snapshot (defaults to today)"),
    include_self: bool = Query(False, description="Include current user's own employee record in the list"),
    emp: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Returns daily attendance summary for team members reporting to current user or all if HR/Admin."""
    query_date = target_date or date.today()
    
    base_options = [
        selectinload(Employee.user),
        selectinload(Employee.department),
        selectinload(Employee.designation),
        selectinload(Employee.manager).selectinload(Employee.user),
    ]
    perms = await get_user_permissions(user, db)
    user_role = (user.role.value if hasattr(user.role, 'value') else str(user.role)).lower()
    if user.is_superuser or user_role in ["super_admin", "admin"] or "*" in perms or "attendance" in perms:
        emp_query = select(Employee).options(*base_options)
    else:
        if include_self:
            emp_query = select(Employee).options(*base_options).where(
                or_(Employee.manager_id == emp.id, Employee.id == emp.id)
            )
        else:
            emp_query = select(Employee).options(*base_options).where(Employee.manager_id == emp.id)
        
    emp_res = await db.execute(emp_query)
    team_members = emp_res.scalars().all()
    
    if not team_members:
        return []

    member_ids = [m.id for m in team_members]

    att_query = select(AttendanceRecord).where(
        and_(
            AttendanceRecord.employee_id.in_(member_ids),
            AttendanceRecord.date == query_date
        )
    )
    att_res = await db.execute(att_query)
    att_by_emp = {a.employee_id: a for a in att_res.scalars().all()}

    leave_query = select(LeaveRequest).where(
        and_(
            LeaveRequest.employee_id.in_(member_ids),
            LeaveRequest.status == LeaveStatus.APPROVED,
            LeaveRequest.start_date <= query_date,
            LeaveRequest.end_date >= query_date,
        )
    )
    leave_res = await db.execute(leave_query)
    leave_by_emp = {l.employee_id: l for l in leave_res.scalars().all()}

    records = []
    for member in team_members:
        att = att_by_emp.get(member.id)
        leave = leave_by_emp.get(member.id)

        if att:
            resolved_status = att.status.value
        elif leave:
            resolved_status = AttendanceStatus.ON_LEAVE.value
        elif member.date_of_joining and query_date < member.date_of_joining:
            resolved_status = "not_joined"
        elif query_date.weekday() >= 5:
            resolved_status = "weekend"
        else:
            resolved_status = AttendanceStatus.ABSENT.value

        manager_name = (
            f"{member.manager.user.first_name} {member.manager.user.last_name}"
            if member.manager and member.manager.user
            else None
        )

        records.append({
            "employee_id": str(member.id),
            "employee_code": member.employee_code,
            "name": f"{member.user.first_name} {member.user.last_name}" if member.user else member.employee_code,
            "email": member.user.email if member.user else None,
            "role": (member.user.role.value if hasattr(member.user.role, 'value') else str(member.user.role)) if member.user else "employee",
            "department": member.department.name if member.department else "General",
            "designation": member.designation.title if member.designation else "Staff",
            "date_of_joining": member.date_of_joining.isoformat() if member.date_of_joining else None,
            "manager_id": str(member.manager_id) if member.manager_id else None,
            "manager_name": manager_name,
            "is_self": member.id == emp.id,
            "date": query_date.isoformat(),
            "status": resolved_status,
            "check_in": att.check_in.strftime("%H:%M:%S") if (att and att.check_in) else None,
            "check_out": att.check_out.strftime("%H:%M:%S") if (att and att.check_out) else None,
            "check_in_iso": att.check_in.isoformat() if (att and att.check_in) else None,
            "check_out_iso": att.check_out.isoformat() if (att and att.check_out) else None,
            "hours": att.total_hours if att else 0.0,
            "location": att.location if att else None,
            "notes": att.notes if att else (f"Approved {leave.leave_type.value} leave" if leave else None),
            "leave_type": leave.leave_type.value if leave else None,
        })
    return records


@router.get("/history")
async def get_attendance_history(
    employee_id: Optional[UUID] = Query(None, description="Target employee ID (defaults to logged-in employee)"),
    mode: str = Query("month", pattern="^(month|from_join|custom)$", description="Range mode: month, from_join, or custom"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Month number (1-12) when mode='month'"),
    year: Optional[int] = Query(None, ge=2000, le=2100, description="Four-digit year when mode='month'"),
    start_date: Optional[date] = Query(None, description="Start date when mode='custom'"),
    end_date: Optional[date] = Query(None, description="End date when mode='custom'"),
    emp: Employee = Depends(get_current_employee),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns complete day-by-day attendance history and summary statistics for the logged-in employee
    or a permitted employee (for Reporting Managers, HR Admins, and Super Admins).
    Supports monthly view ('month'), full history since joining date ('from_join'), or custom date range ('custom').
    """
    target_emp = await _resolve_accessible_employee(employee_id, emp, user, db)
    today = date.today()
    join_date = target_emp.date_of_joining or date(today.year, 1, 1)

    if mode == "from_join":
        range_start = min(join_date, today)
        range_end = today
    elif mode == "custom":
        range_start = start_date or min(join_date, today)
        range_end = end_date or today
        if range_end < range_start:
            raise HTTPException(status_code=400, detail="end_date cannot be earlier than start_date")
    else:
        target_year = year or today.year
        target_month = month or today.month
        _, last_day_num = calendar.monthrange(target_year, target_month)
        range_start = date(target_year, target_month, 1)
        range_end = date(target_year, target_month, last_day_num)

    att_query = (
        select(AttendanceRecord)
        .where(
            and_(
                AttendanceRecord.employee_id == target_emp.id,
                AttendanceRecord.date >= range_start,
                AttendanceRecord.date <= range_end,
            )
        )
        .order_by(AttendanceRecord.date.asc())
    )
    att_res = await db.execute(att_query)
    att_map = {rec.date: rec for rec in att_res.scalars().all()}

    leave_query = select(LeaveRequest).where(
        and_(
            LeaveRequest.employee_id == target_emp.id,
            LeaveRequest.status == LeaveStatus.APPROVED,
            LeaveRequest.start_date <= range_end,
            LeaveRequest.end_date >= range_start,
        )
    )
    leave_res = await db.execute(leave_query)
    approved_leaves = leave_res.scalars().all()

    leave_date_map = {}
    for lv in approved_leaves:
        cur = max(lv.start_date, range_start)
        end = min(lv.end_date, range_end)
        while cur <= end:
            leave_date_map[cur] = lv
            cur += timedelta(days=1)

    hol_query = select(LeaveCalendar).where(
        and_(
            LeaveCalendar.is_active == True,
            LeaveCalendar.is_holiday == True,
            LeaveCalendar.date >= range_start,
            LeaveCalendar.date <= range_end,
        )
    )
    hol_res = await db.execute(hol_query)
    holiday_map = {h.date: h for h in hol_res.scalars().all()}


    days_list = []
    summary = {
        "total_days": 0,
        "working_days": 0,
        "present": 0,
        "late": 0,
        "half_day": 0,
        "on_leave": 0,
        "absent": 0,
        "weekend": 0,
        "holiday": 0,
        "total_hours": 0.0,
        "attendance_rate": 0.0,
    }

    cur_date = range_start
    while cur_date <= range_end:
        is_weekend = cur_date.weekday() >= 5
        day_name = cur_date.strftime("%A")
        day_short = cur_date.strftime("%a")
        att = att_map.get(cur_date)
        lv = leave_date_map.get(cur_date)
        hol = holiday_map.get(cur_date)

        check_in_str = att.check_in.strftime("%H:%M:%S") if (att and att.check_in) else None
        check_out_str = att.check_out.strftime("%H:%M:%S") if (att and att.check_out) else None
        check_in_iso = att.check_in.isoformat() if (att and att.check_in) else None
        check_out_iso = att.check_out.isoformat() if (att and att.check_out) else None
        hours = round(float(att.total_hours or 0.0), 2) if att else 0.0
        location = att.location if att else None
        notes = att.notes if att else None
        leave_type = lv.leave_type.value if lv else None

        if cur_date < join_date:
            day_status = "not_joined"
        elif att:
            day_status = att.status.value
            if not notes and lv:
                notes = f"Approved {lv.leave_type.value} leave"
        elif hol:
            day_status = AttendanceStatus.HOLIDAY.value
            notes = hol.name
        elif lv:
            day_status = AttendanceStatus.ON_LEAVE.value
            notes = lv.reason or f"Approved {lv.leave_type.value} leave"
        elif cur_date > today:
            day_status = "weekend" if is_weekend else "upcoming"
        else:
            day_status = "weekend" if is_weekend else AttendanceStatus.ABSENT.value

        if join_date <= cur_date <= today:
            summary["total_days"] += 1
            summary["total_hours"] = round(summary["total_hours"] + hours, 2)
            if day_status == AttendanceStatus.PRESENT.value:
                summary["present"] += 1
                summary["working_days"] += 1
            elif day_status == AttendanceStatus.LATE.value:
                summary["late"] += 1
                summary["working_days"] += 1
            elif day_status == AttendanceStatus.HALF_DAY.value:
                summary["half_day"] += 1
                summary["working_days"] += 1
            elif day_status == AttendanceStatus.ON_LEAVE.value:
                summary["on_leave"] += 1
                summary["working_days"] += 1
            elif day_status == AttendanceStatus.ABSENT.value:
                summary["absent"] += 1
                summary["working_days"] += 1
            elif day_status == AttendanceStatus.HOLIDAY.value:
                summary["holiday"] += 1
            elif day_status == "weekend":
                summary["weekend"] += 1

        days_list.append({
            "date": cur_date.isoformat(),
            "day_name": day_name,
            "day_short": day_short,
            "day_number": cur_date.day,
            "month": cur_date.month,
            "year": cur_date.year,
            "is_weekend": is_weekend,
            "is_today": cur_date == today,
            "status": day_status,
            "check_in": check_in_str,
            "check_out": check_out_str,
            "check_in_iso": check_in_iso,
            "check_out_iso": check_out_iso,
            "total_hours": hours,
            "location": location,
            "notes": notes,
            "leave_type": leave_type,
        })

        cur_date += timedelta(days=1)

    if summary["working_days"] > 0:
        attended_equiv = summary["present"] + summary["late"] + (0.5 * summary["half_day"])
        summary["attendance_rate"] = round((attended_equiv / summary["working_days"]) * 100.0, 1)
    else:
        summary["attendance_rate"] = 100.0

    available_months = []
    m_cursor = date(today.year, today.month, 1)
    join_month_start = date(min(join_date, today).year, min(join_date, today).month, 1)
    while m_cursor >= join_month_start:
        available_months.append({
            "year": m_cursor.year,
            "month": m_cursor.month,
            "label": m_cursor.strftime("%B %Y"),
        })
        if m_cursor.month == 1:
            m_cursor = date(m_cursor.year - 1, 12, 1)
        else:
            m_cursor = date(m_cursor.year, m_cursor.month - 1, 1)

    manager_name = (
        f"{target_emp.manager.user.first_name} {target_emp.manager.user.last_name}"
        if target_emp.manager and target_emp.manager.user
        else None
    )

    return {
        "employee": {
            "id": str(target_emp.id),
            "employee_code": target_emp.employee_code,
            "name": f"{target_emp.user.first_name} {target_emp.user.last_name}" if target_emp.user else target_emp.employee_code,
            "email": target_emp.user.email if target_emp.user else None,
            "role": (target_emp.user.role.value if hasattr(target_emp.user.role, 'value') else str(target_emp.user.role)) if target_emp.user else "employee",
            "department": target_emp.department.name if target_emp.department else "General",
            "designation": target_emp.designation.title if target_emp.designation else "Staff",
            "date_of_joining": join_date.isoformat(),
            "manager_id": str(target_emp.manager_id) if target_emp.manager_id else None,
            "manager_name": manager_name,
            "is_self": target_emp.id == emp.id,
        },
        "period": {
            "mode": mode,
            "start_date": range_start.isoformat(),
            "end_date": range_end.isoformat(),
            "month": range_start.month if mode == "month" else None,
            "year": range_start.year if mode == "month" else None,
        },
        "available_months": available_months,
        "summary": summary,
        "records": days_list,
    }
