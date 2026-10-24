from typing import List, Optional
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.core.database import get_db
from app.api.deps import get_current_user, require_roles
from app.models.user import User
from app.models.employee import Department, Designation, Employee
from app.models.organization import CompanyProfile, Team

router = APIRouter(prefix="/organization", tags=["Organization & Structure"])

# Schemas
class CompanyProfileUpdate(BaseModel):
    name: Optional[str] = None
    legal_name: Optional[str] = None
    domain: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    tax_id: Optional[str] = None
    currency: Optional[str] = None
    timezone: Optional[str] = None
    address_street: Optional[str] = None
    address_city: Optional[str] = None
    address_state: Optional[str] = None
    address_country: Optional[str] = None
    address_postal_code: Optional[str] = None

class TeamCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    department_id: Optional[UUID] = None
    lead_id: Optional[UUID] = None

# Company Endpoints
@router.get("/company")
async def get_company_profile(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CompanyProfile).limit(1))
    profile = result.scalar_one_or_none()
    if not profile:
        profile = CompanyProfile()
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
    return profile

@router.put("/company")
async def update_company_profile(
    data: CompanyProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "super_admin"], module="organization"))
):
    result = await db.execute(select(CompanyProfile).limit(1))
    profile = result.scalar_one_or_none()
    if not profile:
        profile = CompanyProfile()
        db.add(profile)

    update_dict = data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        if value is not None:
            setattr(profile, key, value)

    profile.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(profile)
    return profile

# Teams Endpoints
@router.get("/teams")
async def list_teams(db: AsyncSession = Depends(get_db)):
    query = (
        select(Team)
        .options(
            selectinload(Team.department),
            selectinload(Team.lead).selectinload(Employee.user)
        )
        .order_by(Team.name)
    )
    result = await db.execute(query)
    teams = result.scalars().all()
    
    return [
        {
            "id": str(t.id),
            "name": t.name,
            "code": t.code,
            "description": t.description,
            "department_id": str(t.department_id) if t.department_id else None,
            "department_name": t.department.name if t.department else None,
            "lead_id": str(t.lead_id) if t.lead_id else None,
            "lead_name": f"{t.lead.user.first_name} {t.lead.user.last_name}" if t.lead and t.lead.user else None,
            "created_at": t.created_at.isoformat() if t.created_at else None
        }
        for t in teams
    ]

@router.post("/teams")
async def create_team(
    data: TeamCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "super_admin"], module="organization"))
):
    # Check code uniqueness
    existing = await db.execute(select(Team).where(Team.code == data.code.upper()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Team code already exists")

    team = Team(
        name=data.name,
        code=data.code.upper(),
        description=data.description,
        department_id=data.department_id,
        lead_id=data.lead_id
    )
    db.add(team)
    await db.commit()
    await db.refresh(team)
    return {
        "id": str(team.id),
        "name": team.name,
        "code": team.code,
        "description": team.description,
        "department_id": str(team.department_id) if team.department_id else None,
        "lead_id": str(team.lead_id) if team.lead_id else None
    }

@router.delete("/teams/{team_id}")
async def delete_team(
    team_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "super_admin"], module="organization"))
):
    team = await db.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    await db.delete(team)
    await db.commit()
    return {"message": "Team deleted successfully"}

@router.delete("/departments/{dept_id}")
async def delete_department(
    dept_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "super_admin"], module="organization"))
):
    dept = await db.get(Department, dept_id)
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    
    # Check if employees are assigned
    emp_check = await db.execute(select(Employee.id).where(Employee.department_id == dept_id).limit(1))
    if emp_check.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Cannot delete department with assigned employees. Reassign employees first.")
    
    await db.delete(dept)
    await db.commit()
    return {"message": "Department deleted successfully"}

@router.delete("/designations/{desig_id}")
async def delete_designation(
    desig_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "super_admin"], module="organization"))
):
    desig = await db.get(Designation, desig_id)
    if not desig:
        raise HTTPException(status_code=404, detail="Designation not found")
    
    emp_check = await db.execute(select(Employee.id).where(Employee.designation_id == desig_id).limit(1))
    if emp_check.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Cannot delete designation with assigned employees. Reassign employees first.")
    
    await db.delete(desig)
    await db.commit()
    return {"message": "Designation deleted successfully"}

