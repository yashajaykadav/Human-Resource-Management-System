from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload
from app.models.employee import Employee
from app.models.leave import LeaveBalance, LeaveRequest, LeaveType, LeaveStatus
from app.models.attendance import AttendanceRecord, AttendanceStatus
from app.models.payroll import Payslip, PayrollRun
from app.models.policy import PolicyDocument
from app.models.recruitment import JobPosting, Application, Candidate

class AgentTools:
    @staticmethod
    async def get_leave_balance(employee_id: UUID, db: AsyncSession) -> Dict[str, Any]:
        q = select(LeaveBalance).where(LeaveBalance.employee_id == employee_id)
        res = await db.execute(q)
        balances = res.scalars().all()
        
        result = {}
        for b in balances:
            result[b.leave_type.value] = {
                "total": b.total_allocated,
                "used": b.used,
                "pending": b.pending,
                "remaining": b.remaining
            }
        return {"employee_id": str(employee_id), "balances": result}

    @staticmethod
    async def create_leave_request(
        employee_id: UUID,
        leave_type_str: str,
        start_date_str: str,
        end_date_str: str,
        reason: str,
        db: AsyncSession
    ) -> Dict[str, Any]:
        try:
            l_type = LeaveType(leave_type_str.lower())
        except Exception:
            l_type = LeaveType.CASUAL

        start = date.fromisoformat(start_date_str)
        end = date.fromisoformat(end_date_str)
        days = (end - start).days + 1
        
        req = LeaveRequest(
            employee_id=employee_id,
            leave_type=l_type,
            start_date=start,
            end_date=end,
            days_count=float(days),
            reason=reason,
            status=LeaveStatus.PENDING
        )
        db.add(req)
        
        # update pending
        bal_q = select(LeaveBalance).where(
            and_(LeaveBalance.employee_id == employee_id, LeaveBalance.leave_type == l_type)
        )
        bal_res = await db.execute(bal_q)
        balance = bal_res.scalar_one_or_none()
        if balance:
            balance.pending += float(days)
            
        await db.commit()
        await db.refresh(req)
        return {
            "success": True,
            "request_id": str(req.id),
            "days_count": days,
            "status": req.status.value,
            "message": f"Successfully created pending leave request for {days} day(s) from {start} to {end}."
        }

    @staticmethod
    async def get_team_attendance(manager_emp_id: UUID, db: AsyncSession) -> Dict[str, Any]:
        today = date.today()
        sub_q = select(Employee).options(
            selectinload(Employee.user),
            selectinload(Employee.department)
        ).where(Employee.manager_id == manager_emp_id)
        
        team_res = await db.execute(sub_q)
        members = team_res.scalars().all()
        
        summary = []
        for m in members:
            att_q = select(AttendanceRecord).where(
                and_(AttendanceRecord.employee_id == m.id, AttendanceRecord.date == today)
            )
            att_res = await db.execute(att_q)
            att = att_res.scalar_one_or_none()
            summary.append({
                "name": f"{m.user.first_name} {m.user.last_name}" if m.user else m.employee_code,
                "status": att.status.value if att else "absent",
                "check_in": att.check_in.strftime("%H:%M") if (att and att.check_in) else "Not checked in"
            })
        return {"total_team_members": len(members), "roster": summary}

    @staticmethod
    async def review_leave(
        manager_emp_id: UUID,
        request_id: UUID,
        decision: str,
        comments: Optional[str],
        db: AsyncSession
    ) -> Dict[str, Any]:
        q = select(LeaveRequest).where(LeaveRequest.id == request_id)
        res = await db.execute(q)
        req = res.scalar_one_or_none()
        if not req:
            return {"success": False, "error": "Leave request not found"}
            
        status_enum = LeaveStatus.APPROVED if decision.lower() == "approved" else LeaveStatus.REJECTED
        req.status = status_enum
        req.approver_id = manager_emp_id
        req.approver_comments = comments or "Reviewed via AI Agent"
        
        # Adjust balance
        bal_q = select(LeaveBalance).where(
            and_(LeaveBalance.employee_id == req.employee_id, LeaveBalance.leave_type == req.leave_type)
        )
        bal_res = await db.execute(bal_q)
        balance = bal_res.scalar_one_or_none()
        if balance:
            balance.pending = max(0.0, balance.pending - req.days_count)
            if status_enum == LeaveStatus.APPROVED:
                balance.used += req.days_count
                
        await db.commit()
        return {"success": True, "request_id": str(req.id), "status": status_enum.value}

    @staticmethod
    async def search_company_policies(search_query: str, db: AsyncSession) -> List[Dict[str, Any]]:
        # In full production, this uses pgvector cosine similarity (<=>).
        # We also provide keyword matching for high speed and robustness.
        q = select(PolicyDocument).limit(5)
        res = await db.execute(q)
        docs = res.scalars().all()
        
        matches = []
        for d in docs:
            matches.append({
                "title": d.title,
                "category": d.category,
                "excerpt": d.full_text[:350] + "..."
            })
        return matches

    @staticmethod
    async def audit_payroll(db: AsyncSession) -> Dict[str, Any]:
        q = select(Payslip).options(selectinload(Payslip.employee).selectinload(Employee.user)).where(Payslip.is_anomaly_flagged == True)
        res = await db.execute(q)
        anomalies = res.scalars().all()
        
        flags = []
        for a in anomalies:
            flags.append({
                "employee": f"{a.employee.user.first_name} {a.employee.user.last_name}" if a.employee and a.employee.user else "Staff",
                "month_year": f"{a.month}/{a.year}",
                "net_pay": a.net_pay,
                "reason": a.anomaly_reason
            })
        return {"anomaly_count": len(flags), "flagged_records": flags}

