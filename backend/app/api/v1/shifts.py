from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID
from datetime import date

from app.core.database import get_db
from app.models.attendance import Shift, Roster
from app.models.employee import Employee, Department
from app.schemas.hrms import (
    ShiftCreate, ShiftResponse,
    RosterCreate, RosterResponse
)

router = APIRouter(prefix="/shifts", tags=["Shifts & Rosters"])


# ==============================================================
# Roster Endpoints (Must be defined BEFORE /{shift_id} to prevent route shadowing)
# ==============================================================

@router.post("/rosters", response_model=RosterResponse, status_code=status.HTTP_201_CREATED)
async def create_roster(
    roster_data: RosterCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new roster."""
    # Verify shift exists
    shift_result = await db.execute(
        select(Shift).where(Shift.id == roster_data.shift_id)
    )
    if not shift_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Shift not found"
        )
    
    roster = Roster(
        name=roster_data.name,
        shift_id=roster_data.shift_id,
        employee_id=roster_data.employee_id,
        department_id=roster_data.department_id,
        start_date=roster_data.start_date,
        end_date=roster_data.end_date,
        description=roster_data.description
    )
    db.add(roster)
    await db.commit()
    await db.refresh(roster)
    
    # Eager-load the shift, employee, and department relationships
    result = await db.execute(
        select(Roster)
        .options(
            selectinload(Roster.shift),
            selectinload(Roster.employee).selectinload(Employee.user),
            selectinload(Roster.department)
        )
        .where(Roster.id == roster.id)
    )
    r = result.scalar_one()
    emp_name = f"{r.employee.user.first_name} {r.employee.user.last_name}" if r.employee and r.employee.user else None
    emp_code = r.employee.employee_code if r.employee else None
    dept_name = r.department.name if r.department else None

    return RosterResponse(
        id=r.id,
        name=r.name,
        shift_id=r.shift_id,
        employee_id=r.employee_id,
        employee_name=emp_name,
        employee_code=emp_code,
        department_id=r.department_id,
        department_name=dept_name,
        start_date=r.start_date,
        end_date=r.end_date,
        is_active=r.is_active,
        description=r.description,
        created_at=r.created_at,
        shift=ShiftResponse.model_validate(r.shift) if r.shift else None
    )


@router.get("/rosters", response_model=List[RosterResponse])
@router.get("/rosters/", response_model=List[RosterResponse])
async def get_all_rosters(
    db: AsyncSession = Depends(get_db)
):
    """Get all rosters with their shift and employee details."""
    result = await db.execute(
        select(Roster)
        .options(
            selectinload(Roster.shift),
            selectinload(Roster.employee).selectinload(Employee.user),
            selectinload(Roster.department)
        )
        .order_by(Roster.start_date.desc(), Roster.name)
    )
    rosters = result.scalars().all()
    
    response = []
    for r in rosters:
        emp_name = f"{r.employee.user.first_name} {r.employee.user.last_name}" if r.employee and r.employee.user else None
        emp_code = r.employee.employee_code if r.employee else None
        dept_name = r.department.name if r.department else None
        response.append(
            RosterResponse(
                id=r.id,
                name=r.name,
                shift_id=r.shift_id,
                employee_id=r.employee_id,
                employee_name=emp_name,
                employee_code=emp_code,
                department_id=r.department_id,
                department_name=dept_name,
                start_date=r.start_date,
                end_date=r.end_date,
                is_active=r.is_active,
                description=r.description,
                created_at=r.created_at,
                shift=ShiftResponse.model_validate(r.shift) if r.shift else None
            )
        )
    return response


@router.get("/rosters/{roster_id}", response_model=RosterResponse)
async def get_roster(
    roster_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific roster by ID."""
    result = await db.execute(
        select(Roster)
        .options(selectinload(Roster.shift))
        .where(Roster.id == roster_id)
    )
    roster = result.scalar_one_or_none()
    if not roster:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Roster not found"
        )
    return roster


@router.put("/rosters/{roster_id}", response_model=RosterResponse)
async def update_roster(
    roster_id: UUID,
    roster_data: RosterCreate,
    db: AsyncSession = Depends(get_db)
):
    """Update a roster."""
    result = await db.execute(
        select(Roster)
        .options(selectinload(Roster.shift))
        .where(Roster.id == roster_id)
    )
    roster = result.scalar_one_or_none()
    if not roster:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Roster not found"
        )
    
    for key, value in roster_data.model_dump().items():
        setattr(roster, key, value)
    
    await db.commit()
    await db.refresh(roster)
    return roster


@router.delete("/rosters/{roster_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_roster(
    roster_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Delete a roster."""
    result = await db.execute(
        select(Roster).where(Roster.id == roster_id)
    )
    roster = result.scalar_one_or_none()
    if not roster:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Roster not found"
        )
    
    await db.delete(roster)
    await db.commit()


# ==============================================================
# Shift Endpoints
# ==============================================================

@router.post("", response_model=ShiftResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=ShiftResponse, status_code=status.HTTP_201_CREATED)
async def create_shift(
    shift_data: ShiftCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new shift."""
    # Check if shift with same code already exists
    existing_shift = await db.execute(
        select(Shift).where(Shift.code == shift_data.code)
    )
    if existing_shift.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Shift with code '{shift_data.code}' already exists"
        )
    
    shift = Shift(
        name=shift_data.name,
        code=shift_data.code,
        start_time=shift_data.start_time,
        end_time=shift_data.end_time,
        days=shift_data.days,
        break_duration_minutes=shift_data.break_duration_minutes if shift_data.break_duration_minutes is not None else 60,
        grace_time_minutes=shift_data.grace_time_minutes if shift_data.grace_time_minutes is not None else 15,
        half_day_threshold_hours=shift_data.half_day_threshold_hours if shift_data.half_day_threshold_hours is not None else 4.0,
        absent_threshold_hours=shift_data.absent_threshold_hours if shift_data.absent_threshold_hours is not None else 2.0,
        description=shift_data.description
    )
    db.add(shift)
    await db.commit()
    await db.refresh(shift)
    return shift


@router.get("", response_model=List[ShiftResponse])
@router.get("/", response_model=List[ShiftResponse])
async def get_all_shifts(
    db: AsyncSession = Depends(get_db)
):
    """Get all shifts."""
    result = await db.execute(select(Shift).order_by(Shift.name))
    shifts = result.scalars().all()
    return shifts


@router.get("/{shift_id}", response_model=ShiftResponse)
async def get_shift(
    shift_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific shift by ID."""
    result = await db.execute(
        select(Shift).where(Shift.id == shift_id)
    )
    shift = result.scalar_one_or_none()
    if not shift:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shift not found"
        )
    return shift


@router.put("/{shift_id}", response_model=ShiftResponse)
async def update_shift(
    shift_id: UUID,
    shift_data: ShiftCreate,
    db: AsyncSession = Depends(get_db)
):
    """Update a shift."""
    result = await db.execute(
        select(Shift).where(Shift.id == shift_id)
    )
    shift = result.scalar_one_or_none()
    if not shift:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shift not found"
        )
    
    for key, value in shift_data.model_dump().items():
        setattr(shift, key, value)
    
    await db.commit()
    await db.refresh(shift)
    return shift


@router.delete("/{shift_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_shift(
    shift_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Delete a shift."""
    result = await db.execute(
        select(Shift).where(Shift.id == shift_id)
    )
    shift = result.scalar_one_or_none()
    if not shift:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shift not found"
        )
    
    await db.delete(shift)
    await db.commit()
