from typing import Generator, Optional, List, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User, Role
from app.models.employee import Employee

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

# Default fallback permissions for legacy role strings if not yet in Role table
DEFAULT_ROLE_PERMISSIONS: dict[str, list[str]] = {
    "admin": ["*"],
    "super_admin": ["*"],
    "hr_admin": ["dashboard", "employees", "attendance", "leaves", "recruitment", "policies", "organization", "assets"],
    "manager": ["dashboard", "employees", "attendance", "leaves"],
    "recruiter": ["dashboard", "recruitment", "employees"],
    "payroll_specialist": ["dashboard", "payroll", "employees"],
    "employee": ["dashboard", "attendance", "leaves", "policies", "assets"],
}

async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
        
    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception
        
    query = select(User).where(User.id == user_id)
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    return user

async def get_user_permissions(current_user: User, db: AsyncSession) -> List[str]:
    """Dynamically resolve all permissions for a user from the database roles table."""
    role_str = (current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)).lower()
    
    # Administrator always has unrestricted overall control
    if current_user.is_superuser or role_str in ["super_admin", "admin"]:
        return ["*"]
        
    role_res = await db.execute(select(Role).where(func.lower(Role.code) == role_str))
    role_obj = role_res.scalar_one_or_none()
    
    if role_obj:
        if role_obj.is_system and role_obj.code == "admin":
            return ["*"]
        perms = role_obj.permissions or []
        if "*" in perms:
            return ["*"]
        return perms
        
    # Fallback for standard seed roles before dynamic role record exists
    return DEFAULT_ROLE_PERMISSIONS.get(role_str, ["dashboard", "attendance", "leaves"])

async def get_current_employee(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Employee:
    query = select(Employee).where(Employee.user_id == current_user.id)
    result = await db.execute(query)
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not found for this user"
        )
    return emp

def require_permission(module: str):
    """FastAPI dependency to enforce dynamic module permission. Admin always passes."""
    async def permission_checker(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
    ) -> User:
        perms = await get_user_permissions(current_user, db)
        if "*" in perms or module in perms:
            return current_user
            
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: '{module}' permission required"
        )
    return permission_checker

def require_roles(allowed_roles: List[Any], module: Optional[str] = None):
    """
    Checks roles or dynamic module permissions.
    Admin (superuser or admin role) always has overall control.
    """
    async def role_checker(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
    ) -> User:
        user_role = (current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)).lower()
        if current_user.is_superuser or user_role in ["super_admin", "admin"]:
            return current_user
            
        perms = await get_user_permissions(current_user, db)
        if "*" in perms:
            return current_user
            
        if module and module in perms:
            return current_user
            
        allowed_str = [
            (r.value if hasattr(r, 'value') else str(r)).lower()
            for r in allowed_roles
        ]
        if user_role in allowed_str:
            return current_user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: Required permission or role"
        )
    return role_checker

