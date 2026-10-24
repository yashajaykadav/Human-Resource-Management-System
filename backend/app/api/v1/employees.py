from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.api.deps import get_current_user, require_roles, require_permission, get_user_permissions
from app.core.security import get_password_hash
from app.models.user import User
from app.models.employee import Employee, Department, Designation, EmploymentStatus
from app.schemas.hrms import (
    EmployeeResponse, EmployeeCreate, EmployeeEnrollmentCreate, EmployeeSelfUpdate, EmployeeAdminUpdate,
    DepartmentResponse, DepartmentCreate,
    DesignationResponse, DesignationCreate
)

router = APIRouter(prefix="/employees", tags=["Employees & Organization"])

async def apply_employee_scope(query, current_user: User, db: AsyncSession, *, recruiter_directory: bool = False):
    """Limit employee records to the requester's permitted reporting scope."""
    perms = await get_user_permissions(current_user, db)
    user_role = (current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)).lower()
    
    # Administrator has overall control, or user has dynamic 'employees' permission
    if current_user.is_superuser or user_role in ["super_admin", "admin"] or "*" in perms or "employees" in perms:
        return query
    if ("recruitment" in perms or user_role == "recruiter") and recruiter_directory:
        return query

    current_employee_result = await db.execute(
        select(Employee).where(Employee.user_id == current_user.id)
    )
    current_employee = current_employee_result.scalar_one_or_none()
    if not current_employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee profile not found for this user")

    # If employee has direct reports, include both self and direct reports
    has_reports_res = await db.execute(
        select(Employee.id).where(Employee.manager_id == current_employee.id).limit(1)
    )
    if has_reports_res.scalar_one_or_none() or user_role == "manager":
        return query.where(or_(Employee.user_id == current_user.id, Employee.manager_id == current_employee.id))
    return query.where(Employee.user_id == current_user.id)

# Departments
@router.get("/departments", response_model=List[DepartmentResponse])
async def list_departments(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Department).order_by(Department.name))
    return result.scalars().all()

@router.post("/departments", response_model=DepartmentResponse)
async def create_department(
    dept_in: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "super_admin"], module="organization"))
):
    dept = Department(**dept_in.model_dump())
    db.add(dept)
    await db.commit()
    await db.refresh(dept)
    return dept

# Designations
@router.get("/designations", response_model=List[DesignationResponse])
async def list_designations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Designation).order_by(Designation.title))
    return result.scalars().all()

@router.post("/designations", response_model=DesignationResponse)
async def create_designation(
    desig_in: DesignationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "super_admin"], module="organization"))
):
    desig = Designation(**desig_in.model_dump())
    db.add(desig)
    await db.commit()
    await db.refresh(desig)
    return desig

# Employees
@router.post("/enroll", status_code=status.HTTP_201_CREATED)
async def enroll_employee(
    enrollment: EmployeeEnrollmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "super_admin"], module="employees"))
):
    """Provision an employee's user account and employment profile together."""
    existing_user = await db.execute(select(User).where(User.email == enrollment.email))
    if existing_user.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="An account with this email already exists")

    existing_employee = await db.execute(
        select(Employee).where(Employee.employee_code == enrollment.employee_code)
    )
    if existing_employee.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This employee code is already in use")

    if enrollment.department_id:
        department = await db.get(Department, enrollment.department_id)
        if not department:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected department was not found")
    if enrollment.designation_id:
        designation = await db.get(Designation, enrollment.designation_id)
        if not designation:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected designation was not found")
    if enrollment.manager_id:
        manager = await db.get(Employee, enrollment.manager_id)
        if not manager:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected manager was not found")

    user = User(
        email=enrollment.email,
        hashed_password=get_password_hash(enrollment.password),
        first_name=enrollment.first_name,
        last_name=enrollment.last_name,
        role=enrollment.role,
        is_active=True,
    )
    employee = Employee(
        user=user,
        employee_code=enrollment.employee_code,
        department_id=enrollment.department_id,
        designation_id=enrollment.designation_id,
        manager_id=enrollment.manager_id,
        phone=enrollment.phone,
        date_of_birth=enrollment.date_of_birth,
        date_of_joining=enrollment.date_of_joining,
        emergency_contact=enrollment.emergency_contact,
        annual_ctc=enrollment.annual_ctc or 0.0,
    )
    db.add(employee)
    await db.commit()
    await db.refresh(employee)

    return {"id": str(employee.id), "employee_code": employee.employee_code}

@router.get("")
async def list_employees(
    department_id: Optional[UUID] = None,
    status: Optional[EmploymentStatus] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Employee).options(
        selectinload(Employee.user),
        selectinload(Employee.department),
        selectinload(Employee.designation)
    )
    if department_id:
        query = query.where(Employee.department_id == department_id)
    if status:
        query = query.where(Employee.employment_status == status)
    query = await apply_employee_scope(
        query, current_user, db, recruiter_directory=True
    )

    result = await db.execute(query)
    employees = result.scalars().all()
    
    perms = await get_user_permissions(current_user, db)
    user_role = (current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)).lower()
    is_admin = current_user.is_superuser or user_role in ["super_admin", "admin"] or "*" in perms
    can_view_ctc = is_admin or "payroll" in perms or "employees" in perms
    is_recruiter = (not is_admin) and ("recruitment" in perms or user_role == "recruiter") and ("employees" not in perms)

    response = []
    for emp in employees:
        response.append({
            "id": str(emp.id),
            "user_id": str(emp.user_id) if not is_recruiter else None,
            "employee_code": emp.employee_code if not is_recruiter else None,
            "first_name": emp.user.first_name if emp.user else "",
            "last_name": emp.user.last_name if emp.user else "",
            "full_name": f"{emp.user.first_name} {emp.user.last_name}" if emp.user else "Unknown",
            "email": emp.user.email if emp.user and not is_recruiter else None,
            "role": (emp.user.role.value if hasattr(emp.user.role, 'value') else str(emp.user.role)) if emp.user else "",
            "department": emp.department.name if emp.department else "Unassigned",
            "department_id": str(emp.department_id) if emp.department_id else "",
            "designation": emp.designation.title if emp.designation else "Unassigned",
            "designation_id": str(emp.designation_id) if emp.designation_id else "",
            "manager_id": str(emp.manager_id) if emp.manager_id else "",
            "phone": emp.phone or "",
            "date_of_birth": emp.date_of_birth.isoformat() if emp.date_of_birth else "",
            "emergency_contact": emp.emergency_contact or "",
            "employment_status": emp.employment_status.value if hasattr(emp.employment_status, 'value') else str(emp.employment_status),
            "date_of_joining": emp.date_of_joining.isoformat() if emp.date_of_joining else None,
            "annual_ctc": emp.annual_ctc if can_view_ctc else None
        })
    return response

@router.get("/org-chart")
async def get_org_chart(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns organizational hierarchy for org-chart tree rendering"""
    query = select(Employee).options(
        selectinload(Employee.user),
        selectinload(Employee.department),
        selectinload(Employee.designation)
    )
    query = await apply_employee_scope(
        query, current_user, db, recruiter_directory=True
    )
    result = await db.execute(query)
    employees = result.scalars().all()
    
    nodes = []
    for emp in employees:
        nodes.append({
            "id": str(emp.id),
            "name": f"{emp.user.first_name} {emp.user.last_name}" if emp.user else emp.employee_code,
            "role": (emp.user.role.value if hasattr(emp.user.role, 'value') else str(emp.user.role)) if emp.user else "employee",
            "title": emp.designation.title if emp.designation else "Staff",
            "department": emp.department.name if emp.department else "General",
            "manager_id": str(emp.manager_id) if emp.manager_id else None,
            "email": emp.user.email if emp.user and str(current_user.role).lower() != "recruiter" else None
        })
    return nodes

@router.get("/me")
async def get_my_employee_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Return the signed-in user's own employee profile and self-service details."""
    query = select(Employee).options(
        selectinload(Employee.user),
        selectinload(Employee.department),
        selectinload(Employee.designation),
        selectinload(Employee.manager).selectinload(Employee.user),
    ).where(Employee.user_id == current_user.id)
    result = await db.execute(query)
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee profile not found for this user")

    return {
        "id": str(emp.id),
        "employee_code": emp.employee_code,
        "first_name": emp.user.first_name,
        "last_name": emp.user.last_name,
        "email": emp.user.email,
        "role": emp.user.role.value if hasattr(emp.user.role, 'value') else str(emp.user.role),
        "department_name": emp.department.name if emp.department else "Unassigned",
        "designation_title": emp.designation.title if emp.designation else "Unassigned",
        "manager_name": f"{emp.manager.user.first_name} {emp.manager.user.last_name}" if emp.manager and emp.manager.user else None,
        "phone": emp.phone,
        "date_of_birth": emp.date_of_birth.isoformat() if emp.date_of_birth else None,
        "date_of_joining": emp.date_of_joining.isoformat() if emp.date_of_joining else None,
        "employment_status": emp.employment_status.value,
        "emergency_contact": emp.emergency_contact,
        "bank_name": emp.bank_name,
        "annual_ctc": emp.annual_ctc,
    }

@router.patch("/me")
async def update_my_employee_profile(
    update: EmployeeSelfUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Allow an employee to maintain only their own contact information."""
    result = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee profile not found for this user")

    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(emp, field, value)
    await db.commit()
    await db.refresh(emp)
    return {"message": "Profile updated", "phone": emp.phone, "emergency_contact": emp.emergency_contact}

@router.get("/{id}")
async def get_employee_details(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Employee).options(
        selectinload(Employee.user),
        selectinload(Employee.department),
        selectinload(Employee.designation),
        selectinload(Employee.manager).selectinload(Employee.user)
    ).where(Employee.id == id)
    query = await apply_employee_scope(query, current_user, db)
    
    result = await db.execute(query)
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    return {
        "id": str(emp.id),
        "user_id": str(emp.user_id),
        "employee_code": emp.employee_code,
        "first_name": emp.user.first_name if emp.user else "",
        "last_name": emp.user.last_name if emp.user else "",
        "email": emp.user.email if emp.user else "",
        "role": (emp.user.role.value if hasattr(emp.user.role, 'value') else str(emp.user.role)) if emp.user else "",
        "department_id": str(emp.department_id) if emp.department_id else None,
        "department_name": emp.department.name if emp.department else None,
        "designation_id": str(emp.designation_id) if emp.designation_id else None,
        "designation_title": emp.designation.title if emp.designation else None,
        "manager_id": str(emp.manager_id) if emp.manager_id else None,
        "manager_name": f"{emp.manager.user.first_name} {emp.manager.user.last_name}" if emp.manager and emp.manager.user else None,
        "phone": emp.phone,
        "date_of_birth": emp.date_of_birth.isoformat() if emp.date_of_birth else None,
        "emergency_contact": emp.emergency_contact,
        "employment_status": emp.employment_status.value if hasattr(emp.employment_status, 'value') else str(emp.employment_status),
        "date_of_joining": emp.date_of_joining.isoformat() if emp.date_of_joining else None,
        "bank_name": emp.bank_name if (
            current_user.id == emp.user_id
            or current_user.is_superuser
            or str(current_user.role).lower() in ["super_admin", "admin"]
            or "*" in (await get_user_permissions(current_user, db))
            or "payroll" in (await get_user_permissions(current_user, db))
            or "employees" in (await get_user_permissions(current_user, db))
        ) else None,
        "annual_ctc": emp.annual_ctc if (
            current_user.id == emp.user_id
            or current_user.is_superuser
            or str(current_user.role).lower() in ["super_admin", "admin"]
            or "*" in (await get_user_permissions(current_user, db))
            or "payroll" in (await get_user_permissions(current_user, db))
            or "employees" in (await get_user_permissions(current_user, db))
        ) else None,
    }


@router.put("/{id}")
@router.patch("/{id}")
async def update_employee_details(
    id: UUID,
    update_data: EmployeeAdminUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "super_admin"], module="employees"))
):
    """Update employee information including personal, contact, organization, and compensation fields."""
    query = (
        select(Employee)
        .options(
            selectinload(Employee.user),
            selectinload(Employee.department),
            selectinload(Employee.designation),
        )
        .where(Employee.id == id)
    )
    result = await db.execute(query)
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    # If employee_code is changing, check uniqueness
    if update_data.employee_code is not None and update_data.employee_code != emp.employee_code:
        code_check = await db.execute(
            select(Employee).where(Employee.employee_code == update_data.employee_code, Employee.id != id)
        )
        if code_check.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="This employee code is already in use")
        emp.employee_code = update_data.employee_code

    # If email is changing, check user uniqueness
    if update_data.email is not None and emp.user and update_data.email != emp.user.email:
        email_check = await db.execute(
            select(User).where(User.email == update_data.email, User.id != emp.user.id)
        )
        if email_check.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="An account with this email already exists")
        emp.user.email = update_data.email

    if update_data.first_name is not None and emp.user:
        emp.user.first_name = update_data.first_name
    if update_data.last_name is not None and emp.user:
        emp.user.last_name = update_data.last_name
    if update_data.role is not None and emp.user:
        emp.user.role = update_data.role

    if update_data.department_id is not None:
        if update_data.department_id:
            dept = await db.get(Department, update_data.department_id)
            if not dept:
                raise HTTPException(status_code=400, detail="Selected department was not found")
            emp.department_id = update_data.department_id
        else:
            emp.department_id = None

    if update_data.designation_id is not None:
        if update_data.designation_id:
            desig = await db.get(Designation, update_data.designation_id)
            if not desig:
                raise HTTPException(status_code=400, detail="Selected designation was not found")
            emp.designation_id = update_data.designation_id
        else:
            emp.designation_id = None

    if update_data.manager_id is not None:
        if update_data.manager_id:
            if update_data.manager_id == emp.id:
                raise HTTPException(status_code=400, detail="An employee cannot be their own manager")
            manager = await db.get(Employee, update_data.manager_id)
            if not manager:
                raise HTTPException(status_code=400, detail="Selected manager was not found")
            emp.manager_id = update_data.manager_id
        else:
            emp.manager_id = None

    if update_data.phone is not None:
        emp.phone = update_data.phone
    if update_data.date_of_birth is not None:
        emp.date_of_birth = update_data.date_of_birth
    if update_data.date_of_joining is not None:
        emp.date_of_joining = update_data.date_of_joining
    if update_data.emergency_contact is not None:
        emp.emergency_contact = update_data.emergency_contact
    if update_data.annual_ctc is not None:
        emp.annual_ctc = update_data.annual_ctc
    if update_data.employment_status is not None:
        emp.employment_status = update_data.employment_status

    await db.commit()
    await db.refresh(emp)
    if emp.user:
        await db.refresh(emp.user)

    return {"message": "Employee updated successfully", "id": str(emp.id)}

