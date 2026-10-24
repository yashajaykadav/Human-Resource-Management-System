from typing import List, Optional
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.api.deps import get_current_user, get_current_employee, require_roles, require_permission
from app.models.user import User
from app.models.employee import Employee
from app.models.payroll import SalaryStructure, PayrollRun, Payslip, PayrollStatus
from app.schemas.hrms import PayrollRunCreate, PayslipResponse

router = APIRouter(prefix="/payroll", tags=["Payroll & Compensation"])

@router.get("/my-payslips")
async def get_my_payslips(
    emp: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    query = select(Payslip).where(Payslip.employee_id == emp.id).order_by(Payslip.year.desc(), Payslip.month.desc())
    result = await db.execute(query)
    payslips = result.scalars().all()
    
    return [
        {
            "id": str(p.id),
            "month": p.month,
            "year": p.year,
            "basic_salary": p.basic_salary,
            "hra": p.hra,
            "allowances": p.allowances,
            "gross_pay": p.gross_pay,
            "pf_deduction": p.pf_deduction,
            "tax_deduction": p.tax_deduction,
            "total_deductions": p.total_deductions,
            "net_pay": p.net_pay,
            "payment_status": p.payment_status,
            "created_at": p.created_at.isoformat()
        }
        for p in payslips
    ]

@router.get("/runs")
async def list_payroll_runs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("payroll"))
):
    query = select(PayrollRun).order_by(PayrollRun.year.desc(), PayrollRun.month.desc())
    result = await db.execute(query)
    runs = result.scalars().all()
    
    return [
        {
            "id": str(r.id),
            "month": r.month,
            "year": r.year,
            "status": r.status.value,
            "total_employees": r.total_employees,
            "total_gross_amount": r.total_gross_amount,
            "total_deductions": r.total_deductions,
            "total_net_amount": r.total_net_amount,
            "disbursed_at": r.disbursed_at.isoformat() if r.disbursed_at else None,
            "created_at": r.created_at.isoformat()
        }
        for r in runs
    ]

@router.post("/runs/process")
async def process_payroll_run(
    data: PayrollRunCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("payroll"))
):
    """Processes or simulates monthly payroll for all active employees with salary structures"""
    # Check if run exists
    run_q = select(PayrollRun).where(and_(PayrollRun.month == data.month, PayrollRun.year == data.year))
    run_res = await db.execute(run_q)
    existing_run = run_res.scalar_one_or_none()
    
    if existing_run and existing_run.status == PayrollStatus.DISBURSED:
        raise HTTPException(status_code=400, detail="Payroll already disbursed for this period")
        
    if not existing_run:
        payroll_run = PayrollRun(
            month=data.month,
            year=data.year,
            status=PayrollStatus.DRAFT
        )
        db.add(payroll_run)
        await db.flush()
    else:
        payroll_run = existing_run
        
    # Fetch active employees with salary structure
    emp_q = select(Employee).options(selectinload(Employee.salary_structure))
    emp_res = await db.execute(emp_q)
    employees = emp_res.scalars().all()
    
    total_gross = 0.0
    total_deductions = 0.0
    total_net = 0.0
    processed_count = 0
    
    for emp in employees:
        struct = emp.salary_structure
        if not struct:
            # Fallback based on annual CTC
            base = round((emp.annual_ctc / 12.0) * 0.5, 2)
            hra = round(base * 0.4, 2)
            allowances = round((emp.annual_ctc / 12.0) - base - hra, 2)
            pf = round(base * 0.12, 2)
            tax = round(base * 0.10, 2)
        else:
            base = struct.basic_salary
            hra = struct.house_rent_allowance
            allowances = struct.special_allowance + struct.conveyance_allowance
            pf = struct.provident_fund
            tax = struct.income_tax_tds + struct.professional_tax
            
        gross = base + hra + allowances
        deductions = pf + tax
        net = gross - deductions
        
        # Check anomaly
        anomaly = False
        reason = None
        if not emp.bank_account_number:
            anomaly = True
            reason = "Missing bank account number for employee"
        elif net <= 0:
            anomaly = True
            reason = "Negative or zero net pay calculated"
            
        payslip = Payslip(
            payroll_run_id=payroll_run.id,
            employee_id=emp.id,
            month=data.month,
            year=data.year,
            basic_salary=base,
            hra=hra,
            allowances=allowances,
            gross_pay=gross,
            pf_deduction=pf,
            tax_deduction=tax,
            total_deductions=deductions,
            net_pay=net,
            is_anomaly_flagged=anomaly,
            anomaly_reason=reason
        )
        db.add(payslip)
        
        total_gross += gross
        total_deductions += deductions
        total_net += net
        processed_count += 1
        
    payroll_run.total_employees = processed_count
    payroll_run.total_gross_amount = round(total_gross, 2)
    payroll_run.total_deductions = round(total_deductions, 2)
    payroll_run.total_net_amount = round(total_net, 2)
    payroll_run.status = PayrollStatus.VALIDATED
    
    await db.commit()
    return {
        "message": "Payroll calculated successfully",
        "run_id": str(payroll_run.id),
        "total_employees": processed_count,
        "total_net_amount": payroll_run.total_net_amount,
        "status": payroll_run.status.value
    }

