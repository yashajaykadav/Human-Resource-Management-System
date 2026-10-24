import pytest
from datetime import date, datetime
from app.core.security import verify_password, get_password_hash
from app.models.leave import LeaveType, LeaveStatus
from app.models.attendance import AttendanceStatus

def test_password_hashing():
    pwd = "secret-password-123"
    hashed = get_password_hash(pwd)
    assert verify_password(pwd, hashed) is True
    assert verify_password("wrong-password", hashed) is False

def test_leave_types():
    assert LeaveType.CASUAL.value == "casual"
    assert LeaveType.SICK.value == "sick"
    assert LeaveType.ANNUAL.value == "annual"
    assert LeaveStatus.PENDING.value == "pending"

def test_attendance_status():
    assert AttendanceStatus.PRESENT.value == "present"
    assert AttendanceStatus.LATE.value == "late"
    assert AttendanceStatus.HALF_DAY.value == "half_day"

