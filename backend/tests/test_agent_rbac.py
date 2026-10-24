import pytest
from app.models.user import UserRole
from app.agents.tools import AgentTools

def test_user_roles():
    assert UserRole.SUPER_ADMIN.value == "super_admin"
    assert UserRole.HR_ADMIN.value == "hr_admin"
    assert UserRole.MANAGER.value == "manager"
    assert UserRole.EMPLOYEE.value == "employee"
    assert UserRole.RECRUITER.value == "recruiter"
    assert UserRole.PAYROLL_SPECIALIST.value == "payroll_specialist"

