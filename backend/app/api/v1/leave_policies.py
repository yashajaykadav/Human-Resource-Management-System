from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from typing import List, Optional
from uuid import UUID
from datetime import date

from app.core.database import get_db
from app.models.leave import LeavePolicy, LeaveCalendar, LeaveType
from app.schemas.hrms import (
    LeavePolicyCreate, LeavePolicyResponse,
    LeaveCalendarCreate, LeaveCalendarResponse
)

router = APIRouter(prefix="/leave-policies", tags=["Leave Policies"])


# Leave Calendar Endpoints (Placed before /{policy_id} to prevent route shadowing)
@router.post("/calendars", response_model=LeaveCalendarResponse, status_code=status.HTTP_201_CREATED)
async def create_leave_calendar(
    calendar_data: LeaveCalendarCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new leave calendar entry (holiday, weekend, etc.)."""
    leave_calendar = LeaveCalendar(
        name=calendar_data.name,
        date=calendar_data.date,
        is_holiday=calendar_data.is_holiday,
        is_weekend=calendar_data.is_weekend,
        description=calendar_data.description
    )
    db.add(leave_calendar)
    await db.commit()
    await db.refresh(leave_calendar)
    return leave_calendar


@router.get("/calendars", response_model=List[LeaveCalendarResponse])
async def get_all_leave_calendars(
    year: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get all leave calendar entries, optionally filtered by year."""
    query = select(LeaveCalendar).order_by(LeaveCalendar.date)
    
    if year:
        query = query.where(
            and_(
                LeaveCalendar.date >= date(year, 1, 1),
                LeaveCalendar.date <= date(year, 12, 31)
            )
        )
    
    result = await db.execute(query)
    leave_calendars = result.scalars().all()
    return leave_calendars


@router.get("/calendars/{calendar_id}", response_model=LeaveCalendarResponse)
async def get_leave_calendar(
    calendar_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific leave calendar entry by ID."""
    result = await db.execute(
        select(LeaveCalendar).where(LeaveCalendar.id == calendar_id)
    )
    leave_calendar = result.scalar_one_or_none()
    if not leave_calendar:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave calendar entry not found"
        )
    return leave_calendar


@router.delete("/calendars/{calendar_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_leave_calendar(
    calendar_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Delete a leave calendar entry."""
    result = await db.execute(
        select(LeaveCalendar).where(LeaveCalendar.id == calendar_id)
    )
    leave_calendar = result.scalar_one_or_none()
    if not leave_calendar:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave calendar entry not found"
        )
    
    await db.delete(leave_calendar)
    await db.commit()


# Leave Policy Endpoints
@router.post("/", response_model=LeavePolicyResponse, status_code=status.HTTP_201_CREATED)
async def create_leave_policy(
    leave_policy_data: LeavePolicyCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new leave policy."""
    # Validate leave_type
    valid_leave_types = [lt.value for lt in LeaveType]
    if leave_policy_data.leave_type not in valid_leave_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid leave_type. Must be one of: {valid_leave_types}"
        )
    
    # Check for duplicate policy name
    existing_policy = await db.execute(
        select(LeavePolicy).where(LeavePolicy.name == leave_policy_data.name)
    )
    if existing_policy.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Leave policy with name '{leave_policy_data.name}' already exists"
        )
    
    leave_policy = LeavePolicy(
        name=leave_policy_data.name,
        leave_type=leave_policy_data.leave_type,
        total_days=leave_policy_data.total_days,
        accrual_rule=leave_policy_data.accrual_rule,
        accrual_amount=leave_policy_data.accrual_amount,
        max_carry_forward=leave_policy_data.max_carry_forward,
        requires_approval=leave_policy_data.requires_approval,
        requires_document=leave_policy_data.requires_document,
        min_service_years=leave_policy_data.min_service_years,
        gender_specific=leave_policy_data.gender_specific,
        applicable_genders=leave_policy_data.applicable_genders,
        description=leave_policy_data.description
    )
    db.add(leave_policy)
    await db.commit()
    await db.refresh(leave_policy)
    return leave_policy


@router.get("", response_model=List[LeavePolicyResponse])
@router.get("/", response_model=List[LeavePolicyResponse])
async def get_all_leave_policies(
    db: AsyncSession = Depends(get_db)
):
    """Get all leave policies."""
    result = await db.execute(select(LeavePolicy).order_by(LeavePolicy.name))
    leave_policies = result.scalars().all()
    return leave_policies


@router.get("/by-type/{leave_type}", response_model=List[LeavePolicyResponse])
async def get_leave_policies_by_type(
    leave_type: str,
    db: AsyncSession = Depends(get_db)
):
    """Get all leave policies of a specific type."""
    result = await db.execute(
        select(LeavePolicy).where(LeavePolicy.leave_type == leave_type)
    )
    leave_policies = result.scalars().all()
    return leave_policies


@router.get("/{policy_id}", response_model=LeavePolicyResponse)
async def get_leave_policy(
    policy_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific leave policy by ID."""
    result = await db.execute(
        select(LeavePolicy).where(LeavePolicy.id == policy_id)
    )
    leave_policy = result.scalar_one_or_none()
    if not leave_policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave policy not found"
        )
    return leave_policy


@router.put("/{policy_id}", response_model=LeavePolicyResponse)
async def update_leave_policy(
    policy_id: UUID,
    leave_policy_data: LeavePolicyCreate,
    db: AsyncSession = Depends(get_db)
):
    """Update a leave policy."""
    result = await db.execute(
        select(LeavePolicy).where(LeavePolicy.id == policy_id)
    )
    leave_policy = result.scalar_one_or_none()
    if not leave_policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave policy not found"
        )
    
    for key, value in leave_policy_data.model_dump().items():
        setattr(leave_policy, key, value)
    
    await db.commit()
    await db.refresh(leave_policy)
    return leave_policy


@router.delete("/{policy_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_leave_policy(
    policy_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Delete a leave policy."""
    result = await db.execute(
        select(LeavePolicy).where(LeavePolicy.id == policy_id)
    )
    leave_policy = result.scalar_one_or_none()
    if not leave_policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave policy not found"
        )
    
    await db.delete(leave_policy)
    await db.commit()