import re
from typing import List, Optional, Dict, Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_

from app.core.database import get_db
from app.models.user import User, Role
from app.schemas.hrms import RoleCreate, RoleUpdate, RoleResponse, UserRoleUpdate
from app.api.deps import get_current_user, require_roles

router = APIRouter(prefix="/roles", tags=["Roles & RBAC"])

SYSTEM_MODULES = [
    {
        "id": "dashboard",
        "name": "Dashboard & Analytics",
        "description": "Executive metrics, departmental headcount, real-time quick actions, and copilot insights."
    },
    {
        "id": "employees",
        "name": "Employees Directory",
        "description": "View employee directory, enroll new staff, manage employee profiles and hierarchy."
    },
    {
        "id": "attendance",
        "name": "Attendance & Timesheets",
        "description": "Clock in/out timesheet tracking, calendar matrix, and presence verification logs."
    },
    {
        "id": "leaves",
        "name": "Leaves & Time Off",
        "description": "Submit leave applications, track balances, and approve/reject employee time off."
    },
    {
        "id": "payroll",
        "name": "Payroll & Compensation",
        "description": "Salary structure configuration, monthly payroll generation, and employee payslips."
    },
    {
        "id": "recruitment",
        "name": "Recruitment & ATS",
        "description": "Job openings management, candidate applicant tracking, and recruitment pipeline."
    },
    {
        "id": "assets",
        "name": "Asset Management",
        "description": "Enterprise IT asset tracking, hardware allocation, return requests, and repair logs."
    },
    {
        "id": "policies",
        "name": "Policy Vault (RAG)",
        "description": "Company policy documents repository and interactive AI policy guidance."
    },
    {
        "id": "organization",
        "name": "Organization Structure",
        "description": "Departments, designations, shifts, and RBAC roles configuration."
    },
    {
        "id": "settings",
        "name": "System Settings",
        "description": "Application preferences, theme configuration, and company profile info."
    }
]

def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_-]+', '_', text)
    return text.strip('_')


@router.get("/meta/modules", response_model=List[Dict[str, str]])
async def get_system_modules():
    """Return available system modules for granular permission assignment."""
    return SYSTEM_MODULES


@router.get("", response_model=List[RoleResponse])
@router.get("/", response_model=List[RoleResponse])
async def list_roles(
    db: AsyncSession = Depends(get_db)
):
    """List all roles in the system with their active user counts."""
    roles_res = await db.execute(select(Role).order_by(Role.created_at.asc()))
    roles = roles_res.scalars().all()

    # User counts per role code
    counts_res = await db.execute(
        select(User.role, func.count(User.id)).group_by(User.role)
    )
    counts_map = {str(row[0]).lower(): row[1] for row in counts_res.all()}

    results = []
    for r in roles:
        results.append(RoleResponse(
            id=r.id,
            name=r.name,
            code=r.code,
            description=r.description,
            is_system=r.is_system,
            permissions=r.permissions or [],
            user_count=counts_map.get(r.code.lower(), 0),
            created_at=r.created_at,
            updated_at=r.updated_at
        ))
    return results


@router.post("", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
    role_in: RoleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "super_admin"]))
):
    """Create a new custom role with selected module permissions (Admin only)."""
    code = slugify(role_in.code if role_in.code else role_in.name)
    if not code:
        raise HTTPException(status_code=400, detail="Invalid role name or code provided")

    # Check duplicate
    existing = await db.execute(
        select(Role).where(or_(func.lower(Role.name) == role_in.name.lower(), func.lower(Role.code) == code))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"A role with name '{role_in.name}' or code '{code}' already exists")

    new_role = Role(
        name=role_in.name.strip(),
        code=code,
        description=role_in.description,
        is_system=False,
        permissions=role_in.permissions
    )
    db.add(new_role)
    await db.commit()
    await db.refresh(new_role)

    return RoleResponse(
        id=new_role.id,
        name=new_role.name,
        code=new_role.code,
        description=new_role.description,
        is_system=new_role.is_system,
        permissions=new_role.permissions or [],
        user_count=0,
        created_at=new_role.created_at,
        updated_at=new_role.updated_at
    )


@router.get("/{role_id}", response_model=RoleResponse)
async def get_role(
    role_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get details for a specific role."""
    role = await db.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    user_count_res = await db.execute(
        select(func.count(User.id)).where(func.lower(User.role) == role.code.lower())
    )
    user_count = user_count_res.scalar_one()

    return RoleResponse(
        id=role.id,
        name=role.name,
        code=role.code,
        description=role.description,
        is_system=role.is_system,
        permissions=role.permissions or [],
        user_count=user_count,
        created_at=role.created_at,
        updated_at=role.updated_at
    )


@router.put("/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: UUID,
    role_in: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "super_admin"]))
):
    """Update role details and permissions (Admin only)."""
    role = await db.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    if role_in.name is not None:
        role.name = role_in.name.strip()
    if role_in.description is not None:
        role.description = role_in.description.strip()
    if role_in.permissions is not None:
        if role.is_system and role.code == "admin":
            role.permissions = ["*"]
        else:
            role.permissions = role_in.permissions

    await db.commit()
    await db.refresh(role)

    user_count_res = await db.execute(
        select(func.count(User.id)).where(func.lower(User.role) == role.code.lower())
    )
    user_count = user_count_res.scalar_one()

    return RoleResponse(
        id=role.id,
        name=role.name,
        code=role.code,
        description=role.description,
        is_system=role.is_system,
        permissions=role.permissions or [],
        user_count=user_count,
        created_at=role.created_at,
        updated_at=role.updated_at
    )


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "super_admin"]))
):
    """Delete a custom role (Admin only). System roles cannot be deleted."""
    role = await db.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    if role.is_system:
        raise HTTPException(status_code=400, detail="System default roles (such as Administrator) cannot be deleted")

    # If users are assigned to this role, reassign them to 'employee'
    assigned_res = await db.execute(
        select(User).where(func.lower(User.role) == role.code.lower())
    )
    assigned_users = assigned_res.scalars().all()
    for u in assigned_users:
        u.role = "employee"

    await db.delete(role)
    await db.commit()
    return None


@router.put("/users/{user_id}/role", status_code=status.HTTP_200_OK)
async def assign_user_role(
    user_id: UUID,
    role_update: UserRoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "super_admin"]))
):
    """Assign an existing user to a role (Admin only)."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Verify role exists
    role_res = await db.execute(
        select(Role).where(func.lower(Role.code) == role_update.role.lower())
    )
    role = role_res.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=400, detail=f"Role '{role_update.role}' does not exist")

    user.role = role.code
    await db.commit()
    return {
        "message": f"User {user.email} successfully assigned to role {role.name}",
        "user_id": str(user.id),
        "role": role.code,
        "role_name": role.name
    }

