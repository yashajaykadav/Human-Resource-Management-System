from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.models.employee import Employee
from app.agents.tools import AgentTools
from app.agents.llm_factory import llm_client
from app.api.deps import get_user_permissions
from app.schemas.hrms import AgentActionCard

class RoleAgentOrchestrator:
    @staticmethod
    async def process_user_turn(
        user: User,
        employee: Optional[Employee],
        message: str,
        confirmed_action: Optional[Dict[str, Any]],
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        Orchestrates role-based agent workflow:
        1. If user sent a confirmed action -> Execute the action, write audit, return result.
        2. If message intent is a dangerous action -> Propose ActionCard with confirmation.
        3. If message is a query or safe action -> Execute tool immediately, augment with LLM, return answer.
        """
        role = (user.role.value if hasattr(user.role, 'value') else str(user.role)).lower()
        perms = await get_user_permissions(user, db)
        is_admin = bool(user.is_superuser or role in ["admin", "super_admin"] or "*" in perms)
        lower_msg = message.lower().strip()
        
        # --- Handle Confirmed Action Execution ---
        if confirmed_action:
            action_type = confirmed_action.get("action_type")
            payload = confirmed_action.get("payload", {})
            
            if action_type == "submit_leave" and employee:
                res = await AgentTools.create_leave_request(
                    employee_id=employee.id,
                    leave_type_str=payload.get("leave_type", "casual"),
                    start_date_str=payload.get("start_date"),
                    end_date_str=payload.get("end_date"),
                    reason=payload.get("reason", "Requested via AI Copilot"),
                    db=db
                )
                return {
                    "reply": f"✅ **Leave Request Confirmed & Submitted!**\n\n- **Type**: {payload.get('leave_type', 'casual').capitalize()}\n- **Duration**: {payload.get('start_date')} to {payload.get('end_date')} ({res.get('days_count')} days)\n- **Status**: Pending Manager Approval.\n\nYour manager has been notified.",
                    "suggested_actions": ["View My Leave Balances", "Check Team Attendance"],
                    "action_card": None,
                    "llm_provider_used": llm_client.provider
                }
            elif action_type == "review_leave" and employee:
                res = await AgentTools.review_leave(
                    manager_emp_id=employee.id,
                    request_id=UUID(payload.get("request_id")),
                    decision=payload.get("decision", "approved"),
                    comments=payload.get("comments", "Approved via AI Agent"),
                    db=db
                )
                return {
                    "reply": f"✅ **Leave Request {payload.get('decision', 'approved').capitalize()}!**\n\nRequest ID `{payload.get('request_id')}` has been finalized.",
                    "suggested_actions": ["View Pending Approvals", "Team Roster"],
                    "action_card": None,
                    "llm_provider_used": llm_client.provider
                }

        # --- Intent Classification & Tool Execution ---
        
        # 1. Employee Leave Balance Query
        if any(w in lower_msg for w in ["leave balance", "leaves left", "how many leaves", "casual leave", "sick leave"]):
            if employee:
                bal_data = await AgentTools.get_leave_balance(employee.id, db)
                balances = bal_data.get("balances", {})
                
                reply_lines = ["Here is your current **Leave Balance breakdown**:"]
                for l_type, b in balances.items():
                    reply_lines.append(f"- **{l_type.capitalize()} Leave**: **{b['remaining']} days remaining** (Total: {b['total']}, Used: {b['used']}, Pending: {b['pending']})")
                reply_lines.append("\nWould you like me to prepare a leave application for you?")
                
                return {
                    "reply": "\n".join(reply_lines),
                    "suggested_actions": ["Apply for casual leave", "View Company Leave Policy", "Check Team Calendar"],
                    "action_card": None,
                    "llm_provider_used": llm_client.provider
                }

        # 2. Apply for Leave Intent (Generates Human-In-The-Loop Action Card)
        if any(w in lower_msg for w in ["apply for leave", "take leave", "request leave", "take day off", "apply leave"]):
            if employee:
                # Infer dates: default to next business day or Friday
                next_mon = date.today() + timedelta(days=(7 - date.today().weekday()) % 7 or 7)
                next_wed = next_mon + timedelta(days=2)
                
                # Check for explicit mention of sick or casual
                leave_type = "sick" if "sick" in lower_msg else "casual"
                start_iso = next_mon.isoformat()
                end_iso = next_wed.isoformat()
                
                action_card = AgentActionCard(
                    action_type="submit_leave",
                    title="Confirm Leave Application",
                    description=f"Submit a {leave_type.capitalize()} Leave request from {start_iso} to {end_iso} (3 days).",
                    payload={
                        "leave_type": leave_type,
                        "start_date": start_iso,
                        "end_date": end_iso,
                        "reason": "Family / personal commitment (Drafted via AI)"
                    },
                    requires_confirmation=True
                )
                
                return {
                    "reply": f"I have drafted your **{leave_type.capitalize()} Leave Application** for 3 days starting **{start_iso}** to **{end_iso}**.\n\nPlease review and confirm the action below:",
                    "suggested_actions": ["Modify dates to tomorrow", "Check my balance first", "Cancel request"],
                    "action_card": action_card,
                    "llm_provider_used": llm_client.provider
                }

        # 3. Manager: Team Attendance / Roster
        if any(w in lower_msg for w in ["team attendance", "who is in", "team roster", "who is out", "who is on leave"]):
            if employee and (is_admin or "attendance" in perms or role in ["manager", "hr_admin"]):
                roster_data = await AgentTools.get_team_attendance(employee.id, db)
                roster = roster_data.get("roster", [])
                
                lines = [f"**Team Attendance Overview** ({len(roster)} direct reports):"]
                for r in roster:
                    status_icon = "🟢" if r["status"] == "present" else ("🟡" if r["status"] == "late" else "🔴")
                    lines.append(f"- {status_icon} **{r['name']}**: {r['status'].capitalize()} (Check-in: {r['check_in']})")
                return {
                    "reply": "\n".join(lines),
                    "suggested_actions": ["View Pending Approvals", "View Team OKRs"],
                    "action_card": None,
                    "llm_provider_used": llm_client.provider
                }

        # 4. Payroll / Finance: Audit Anomalies
        if any(w in lower_msg for w in ["payroll audit", "payroll anomalies", "salary discrepancy", "audit payroll", "salary variance"]):
            if is_admin or "payroll" in perms or role in ["payroll_specialist", "hr_admin"]:
                audit_res = await AgentTools.audit_payroll(db)
                flags = audit_res.get("flagged_records", [])
                if not flags:
                    reply = "✅ **Payroll Audit Passed!**\nNo salary discrepancies, missing bank accounts, or negative net pay entries detected in current payroll runs."
                else:
                    lines = [f"⚠️ **Detected {len(flags)} Payroll Anomalies Requiring Attention**:"]
                    for f in flags:
                        lines.append(f"- **{f['employee']}** ({f['month_year']}): Net Pay ${f['net_pay']:.2f} — *{f['reason']}*")
                    reply = "\n".join(lines)
                return {
                    "reply": reply,
                    "suggested_actions": ["Simulate Current Month Payroll", "Download Payroll Register"],
                    "action_card": None,
                    "llm_provider_used": llm_client.provider
                }

        # 5. Policy Search / RAG Knowledge base
        if any(w in lower_msg for w in ["policy", "handbook", "code of conduct", "maternity", "paternity", "notice period", "wfh", "remote work"]):
            policies = await AgentTools.search_company_policies(lower_msg, db)
            policy_context = "\n\n".join([f"**{p['title']} ({p['category']})**:\n{p['excerpt']}" for p in policies])
            
            # Use LLM with policy context
            system_prompt = f"You are the Apryde HRMS AI Assistant. Answer the employee's query citing company policy:\n\n{policy_context}"
            llm_res = await llm_client.generate_response(system_prompt, message)
            
            if llm_res.get("text"):
                reply = llm_res["text"]
            else:
                reply = f"According to company policy:\n\n{policy_context}\n\nPlease reach out to your HR representative for specific exceptions."
                
            return {
                "reply": reply,
                "suggested_actions": ["How many casual leaves do I have?", "Submit leave request", "Contact HR"],
                "action_card": None,
                "llm_provider_used": llm_res.get("provider", llm_client.provider)
            }

        # 6. General Conversational Turn with LLM
        system_prompt = (
            f"You are the intelligent HRMS AI Assistant for Apryde AI HRMS. "
            f"The user is authenticated as '{user.first_name} {user.last_name}' with role '{role}'. "
            f"Provide concise, professional, and actionable HR assistance."
        )
        llm_res = await llm_client.generate_response(system_prompt, message)
        
        reply = llm_res.get("text") or (
            f"Hello {user.first_name}! I am your **{role.replace('_', ' ').title()} AI Assistant**.\n\n"
            f"I can help you with:\n"
            f"- Checking leave balances and submitting leave requests\n"
            f"- Searching company policies & benefits guidelines\n"
            f"- Viewing team attendance and pending approvals\n"
            f"- Auditing monthly payroll runs & anomalies"
        )
        
        suggested = ["Check my leave balance", "What is our WFH policy?", "Clock in for today"]
        if is_admin or any(p in perms for p in ["employees", "attendance", "leaves", "recruitment"]):
            suggested = ["Show team attendance today", "Check pending leave requests", "View hiring pipeline"]
            
        return {
            "reply": reply,
            "suggested_actions": suggested,
            "action_card": None,
            "llm_provider_used": llm_res.get("provider", llm_client.provider)
        }

