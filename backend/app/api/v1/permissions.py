from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from typing import List, Dict, Any
from uuid import UUID

from app.core.database import get_db
from app.models.user import Permission, RolePermission
from app.schemas.hrms import (
    PermissionCreate, PermissionResponse,
    RolePermissionCreate, RolePermissionResponse
)

router = APIRouter(prefix="/permissions", tags=["Permissions"])


# Permission Endpoints
@router.post("/", response_model=PermissionResponse, status_code=status.HTTP_201_CREATED)
async def create_permission(
    permission_data: PermissionCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new permission."""
    # Check for duplicate permission name
    existing_permission = await db.execute(
        select(Permission).where(Permission.name == permission_data.name)
    )
    if existing_permission.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Permission with name '{permission_data.name}' already exists"
        )
    
    permission = Permission(
        name=permission_data.name,
        description=permission_data.description,
        category=permission_data.category
    )
    db.add(permission)
    await db.commit()
    await db.refresh(permission)
    return permission


@router.get("", response_model=List[PermissionResponse])
@router.get("/", response_model=List[PermissionResponse])
async def get_all_permissions(
    db: AsyncSession = Depends(get_db)
):
    """Get all permissions."""
    result = await db.execute(select(Permission).order_by(Permission.name))
    permissions = result.scalars().all()
    return permissions


# Role-Permission Endpoints
@router.post("/role-permissions", response_model=RolePermissionResponse, status_code=status.HTTP_201_CREATED)
@router.post("/role-permissions/", response_model=RolePermissionResponse, status_code=status.HTTP_201_CREATED)
async def assign_permission_to_role(
    role_permission_data: RolePermissionCreate,
    db: AsyncSession = Depends(get_db)
):
    """Assign a permission to a role."""
    role_permission = RolePermission(
        role=role_permission_data.role,
        permission_id=role_permission_data.permission_id,
        resource=role_permission_data.resource,
        actions=role_permission_data.actions
    )
    db.add(role_permission)
    await db.commit()
    await db.refresh(role_permission)
    return role_permission


@router.get("/role-permissions", response_model=List[RolePermissionResponse])
@router.get("/role-permissions/", response_model=List[RolePermissionResponse])
async def get_all_role_permissions(
    db: AsyncSession = Depends(get_db)
):
    """Get all role-permission mappings."""
    result = await db.execute(select(RolePermission))
    role_permissions = result.scalars().all()
    return role_permissions


@router.get("/role-permissions/{role}", response_model=List[RolePermissionResponse])
async def get_permissions_by_role(
    role: str,
    db: AsyncSession = Depends(get_db)
):
    """Get all permissions for a specific role."""
    result = await db.execute(
        select(RolePermission).where(RolePermission.role == role)
    )
    role_permissions = result.scalars().all()
    return role_permissions


@router.get("/role-permissions/by-role-and-resource/{role}/{resource}", response_model=List[RolePermissionResponse])
async def get_role_permissions_for_resource(
    role: str,
    resource: str,
    db: AsyncSession = Depends(get_db)
):
    """Get permissions for a role on a specific resource."""
    result = await db.execute(
        select(RolePermission).where(
            and_(
                RolePermission.role == role,
                RolePermission.resource == resource
            )
        )
    )
    role_permissions = result.scalars().all()
    return role_permissions


@router.put("/role-permissions/{role_permission_id}", response_model=RolePermissionResponse)
async def update_role_permission(
    role_permission_id: UUID,
    role_permission_data: RolePermissionCreate,
    db: AsyncSession = Depends(get_db)
):
    """Update a role-permission mapping."""
    result = await db.execute(
        select(RolePermission).where(RolePermission.id == role_permission_id)
    )
    role_permission = result.scalar_one_or_none()
    if not role_permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role permission not found"
        )
    
    for key, value in role_permission_data.model_dump().items():
        setattr(role_permission, key, value)
    
    await db.commit()
    await db.refresh(role_permission)
    return role_permission


@router.delete("/role-permissions/{role_permission_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role_permission(
    role_permission_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Remove a permission from a role."""
    result = await db.execute(
        select(RolePermission).where(RolePermission.id == role_permission_id)
    )
    role_permission = result.scalar_one_or_none()
    if not role_permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role permission not found"
        )
    
    await db.delete(role_permission)
    await db.commit()


# Utility Endpoint: Check if a user has permission
@router.get("/can-access/{role}/{resource}/{action}", response_model=Dict[str, Any])
async def check_permission(
    role: str,
    resource: str,
    action: str,
    db: AsyncSession = Depends(get_db)
):
    """Check if a role has a specific permission on a resource."""
    result = await db.execute(
        select(RolePermission).where(
            and_(
                RolePermission.role == role,
                RolePermission.resource == resource
            )
        )
    )
    role_permissions = result.scalars().all()
    
    # Check if any permission grants the required action
    has_permission = any(
        action in rp.actions for rp in role_permissions
    )
    
    return {
        "role": role,
        "resource": resource,
        "action": action,
        "has_permission": has_permission,
        "permissions": [rp.actions for rp in role_permissions]
    }


# Individual Permission by ID (Defined last so literal subpaths like 'role-permissions' match first)
@router.get("/{permission_id}", response_model=PermissionResponse)
async def get_permission(
    permission_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific permission by ID."""
    result = await db.execute(
        select(Permission).where(Permission.id == permission_id)
    )
    permission = result.scalar_one_or_none()
    if not permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission not found"
        )
    return permission
