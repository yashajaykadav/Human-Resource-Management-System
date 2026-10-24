from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.api.deps import get_current_user, get_user_permissions
from app.models.user import User, Role
from app.models.employee import Employee
from app.schemas.hrms import Token, LoginRequest, UserCreate, UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=Token)
async def login(
    login_data: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    query = select(User).where(User.email == login_data.email)
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user account"
        )
        
    role_str = (user.role.value if hasattr(user.role, 'value') else str(user.role)).lower()
    access_token = create_access_token(subject=str(user.id), role=role_str)
    
    # Query employee profile if exists
    emp_query = select(Employee).where(Employee.user_id == user.id)
    emp_res = await db.execute(emp_query)
    emp = emp_res.scalar_one_or_none()
    
    # Query role definition
    role_res = await db.execute(select(Role).where(func.lower(Role.code) == role_str))
    role_obj = role_res.scalar_one_or_none()
    
    permissions = await get_user_permissions(user, db)
    is_admin = bool(user.is_superuser or role_str in ["admin", "super_admin"] or "*" in permissions)
    role_name = role_obj.name if role_obj else role_str.replace("_", " ").title()
    
    user_info = {
        "id": str(user.id),
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": role_str,
        "role_name": role_name,
        "permissions": permissions,
        "is_admin": is_admin,
        "employee_id": str(emp.id) if emp else None,
        "employee_code": emp.employee_code if emp else None,
    }
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_info
    }

@router.post("/register", response_model=UserResponse)
async def register(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    query = select(User).where(User.email == user_in.email)
    result = await db.execute(query)
    existing_user = result.scalar_one_or_none()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists"
        )
        
    user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        first_name=user_in.first_name,
        last_name=user_in.last_name,
        role=user_in.role,
        is_active=True
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

@router.get("/me")
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    emp_query = select(Employee).where(Employee.user_id == current_user.id)
    emp_res = await db.execute(emp_query)
    emp = emp_res.scalar_one_or_none()
    
    role_str = (current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)).lower()
    role_res = await db.execute(select(Role).where(func.lower(Role.code) == role_str))
    role_obj = role_res.scalar_one_or_none()
    
    permissions = await get_user_permissions(current_user, db)
    is_admin = bool(current_user.is_superuser or role_str in ["admin", "super_admin"] or "*" in permissions)
    role_name = role_obj.name if role_obj else role_str.replace("_", " ").title()
    
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "role": role_str,
        "role_name": role_name,
        "permissions": permissions,
        "is_admin": is_admin,
        "employee_id": str(emp.id) if emp else None,
        "employee_code": emp.employee_code if emp else None,
    }

