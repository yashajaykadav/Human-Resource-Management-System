"use client";

import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { AuthGuard } from '@/components/auth/AuthGuard';
import {
  Users,
  Network,
  Search,
  Building,
  Mail,
  Shield,
  UserPlus,
  X,
  Pencil
} from 'lucide-react';

type EnrollmentForm = {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  employee_code: string;
  role: string;
  department_id: string;
  designation_id: string;
  manager_id: string;
  phone: string;
  date_of_birth: string;
  date_of_joining: string;
  emergency_contact: string;
  annual_ctc: string;
};

type EditEmployeeForm = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  employee_code: string;
  role: string;
  department_id: string;
  designation_id: string;
  manager_id: string;
  phone: string;
  date_of_birth: string;
  date_of_joining: string;
  emergency_contact: string;
  annual_ctc: string;
  employment_status: string;
};

const EMPTY_ENROLLMENT: EnrollmentForm = {
  first_name: '', last_name: '', email: '', password: '', employee_code: '',
  role: 'admin', department_id: '', designation_id: '', manager_id: '',
  phone: '', date_of_birth: '', date_of_joining: '', emergency_contact: '', annual_ctc: '',
};

type EnrollmentFieldProps = {
  label: string;
  field: keyof EnrollmentForm;
  value: string;
  onChange: (field: keyof EnrollmentForm, value: string) => void;
  type?: string;
  required?: boolean;
  min?: string;
};

function EnrollmentInput({ label, field, value, onChange, type = 'text', required, min }: EnrollmentFieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">{label}{required ? ' *' : ''}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(field, event.target.value)}
        required={required}
        min={min}
        className="skeuo-inset w-full px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none"
      />
    </label>
  );
}

function EnrollmentSelect({ label, field, value, onChange, children }: EnrollmentFieldProps & { children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(field, event.target.value)}
        className="skeuo-inset w-full px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none"
      >
        {children}
      </select>
    </label>
  );
}

export default function EmployeesPage() {
  const { user, isAdmin, hasPermission } = useAuth();
  const isRecruiter = !isAdmin && !hasPermission('employees') && (user?.role === 'recruiter' || hasPermission('recruitment'));
  const canViewCompensation = isAdmin || hasPermission('payroll') || hasPermission('employees');
  const [employees, setEmployees] = useState<any[]>([]);
  const [orgNodes, setOrgNodes] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [availableRoles, setAvailableRoles] = useState<{ id: string; name: string; code: string }[]>([]);
  const [viewMode, setViewMode] = useState<'directory' | 'orgChart'>('directory');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [enrollmentOpen, setEnrollmentOpen] = useState(false);
  const [enrollment, setEnrollment] = useState<EnrollmentForm>(EMPTY_ENROLLMENT);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollmentError, setEnrollmentError] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditEmployeeForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  useEffect(() => {
    // Only fetch data if user is authenticated
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [empList, chartList, departmentList, designationList, rolesList] = await Promise.all([
        apiRequest('/employees'),
        apiRequest('/employees/org-chart'),
        apiRequest('/employees/departments'),
        apiRequest('/employees/designations'),
        apiRequest('/roles').catch(() => []),
      ]);
      setEmployees(empList);
      setOrgNodes(chartList);
      setDepartments(departmentList);
      setDesignations(designationList);
      const fetchedRoles = rolesList || [];
      setAvailableRoles(fetchedRoles);
      if (fetchedRoles.length > 0) {
        setEnrollment((prev) => ({ ...prev, role: fetchedRoles[0].code }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateEnrollment = (field: keyof EnrollmentForm, value: string) => {
    setEnrollment((current) => ({ ...current, [field]: value }));
  };

  const closeEnrollment = () => {
    if (!enrolling) {
      setEnrollmentOpen(false);
      setEnrollmentError('');
    }
  };

  const enrollEmployee = async (event: React.FormEvent) => {
    event.preventDefault();
    setEnrolling(true);
    setEnrollmentError('');
    try {
      await apiRequest('/employees/enroll', {
        method: 'POST',
        body: JSON.stringify({
          ...enrollment,
          department_id: enrollment.department_id || null,
          designation_id: enrollment.designation_id || null,
          manager_id: enrollment.manager_id || null,
          phone: enrollment.phone || null,
          date_of_birth: enrollment.date_of_birth || null,
          date_of_joining: enrollment.date_of_joining || null,
          emergency_contact: enrollment.emergency_contact || null,
          annual_ctc: Number(enrollment.annual_ctc || 0),
        }),
      });
      setEnrollment(EMPTY_ENROLLMENT);
      setEnrollmentOpen(false);
      await fetchData();
    } catch (err: any) {
      setEnrollmentError(err.message || 'Unable to enroll this employee.');
    } finally {
      setEnrolling(false);
    }
  };

  const handleOpenEdit = (emp: any) => {
    const firstName = emp.first_name || (emp.full_name ? emp.full_name.split(' ')[0] : '');
    const lastName = emp.last_name || (emp.full_name ? emp.full_name.split(' ').slice(1).join(' ') : '');

    setEditForm({
      id: emp.id,
      first_name: firstName,
      last_name: lastName,
      email: emp.email || '',
      employee_code: emp.employee_code || '',
      role: emp.role || 'employee',
      department_id: emp.department_id || '',
      designation_id: emp.designation_id || '',
      manager_id: emp.manager_id || '',
      phone: emp.phone || '',
      date_of_birth: emp.date_of_birth ? emp.date_of_birth.slice(0, 10) : '',
      date_of_joining: emp.date_of_joining ? emp.date_of_joining.slice(0, 10) : '',
      emergency_contact: emp.emergency_contact || '',
      annual_ctc: emp.annual_ctc !== null && emp.annual_ctc !== undefined ? String(emp.annual_ctc) : '',
      employment_status: emp.employment_status || 'active',
    });
    setEditError('');
    setEditOpen(true);
  };

  const handleOpenEditById = async (empId: string) => {
    const found = employees.find((e) => e.id === empId);
    if (found) {
      handleOpenEdit(found);
      return;
    }
    try {
      const details = await apiRequest(`/employees/${empId}`);
      handleOpenEdit(details);
    } catch (err) {
      console.error('Failed to load employee details for edit:', err);
    }
  };

  const updateEditField = (field: keyof EditEmployeeForm, value: string) => {
    setEditForm((current) => (current ? { ...current, [field]: value } : null));
  };

  const closeEdit = () => {
    if (!savingEdit) {
      setEditOpen(false);
      setEditForm(null);
      setEditError('');
    }
  };

  const saveEmployeeEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editForm) return;

    setSavingEdit(true);
    setEditError('');
    try {
      await apiRequest(`/employees/${editForm.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          email: editForm.email,
          employee_code: editForm.employee_code,
          role: editForm.role,
          department_id: editForm.department_id || null,
          designation_id: editForm.designation_id || null,
          manager_id: editForm.manager_id || null,
          phone: editForm.phone || null,
          date_of_birth: editForm.date_of_birth || null,
          date_of_joining: editForm.date_of_joining || null,
          emergency_contact: editForm.emergency_contact || null,
          annual_ctc: editForm.annual_ctc ? Number(editForm.annual_ctc) : 0,
          employment_status: editForm.employment_status || 'active',
        }),
      });
      setEditOpen(false);
      setEditForm(null);
      await fetchData();
    } catch (err: any) {
      setEditError(err.message || 'Unable to update employee details.');
    } finally {
      setSavingEdit(false);
    }
  };

  const filtered = employees.filter((e) =>
    e.full_name.toLowerCase().includes(search.toLowerCase()) ||
    e.department.toLowerCase().includes(search.toLowerCase()) ||
    e.designation.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AuthGuard module="employees">
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[var(--text-primary)]">Employees & Organization</h1>
          <p className="text-xs text-[var(--text-secondary)]">
            {isRecruiter ? 'Organization directory — contact and payroll details are restricted.' : 'Corporate directory and reporting hierarchy chart'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {(isAdmin || hasPermission('employees')) && (
            <button
              onClick={() => setEnrollmentOpen(true)}
              className="skeuo-btn-primary text-xs"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Enroll employee
            </button>
          )}
          {/* Tactile View Toggle */}
          <div className="skeuo-inset flex items-center p-1">
          <button
            onClick={() => setViewMode('directory')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              viewMode === 'directory' ? 'skeuo-card-soft text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Directory</span>
          </button>
          <button
            onClick={() => setViewMode('orgChart')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              viewMode === 'orgChart' ? 'skeuo-card-soft text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Network className="h-3.5 w-3.5" />
            <span>Org Chart</span>
          </button>
          </div>
        </div>
      </div>

      {enrollmentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="enrollment-title">
          <form onSubmit={enrollEmployee} className="skeuo-card max-h-[90vh] w-full max-w-3xl overflow-y-auto p-5 sm:p-7">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 id="enrollment-title" className="text-lg font-black text-[var(--text-primary)]">Enroll new employee</h2>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Creates a sign-in account and employment profile.</p>
              </div>
              <button type="button" onClick={closeEnrollment} disabled={enrolling} className="skeuo-btn h-8 w-8 p-0" aria-label="Close enrollment form">
                <X className="h-4 w-4" />
              </button>
            </div>

            {enrollmentError && <div className="skeuo-inset mb-5 p-3 text-xs font-bold text-rose-600">{enrollmentError}</div>}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <EnrollmentInput label="First name" field="first_name" value={enrollment.first_name} onChange={updateEnrollment} required />
              <EnrollmentInput label="Last name" field="last_name" value={enrollment.last_name} onChange={updateEnrollment} required />
              <EnrollmentInput label="Work email" field="email" type="email" value={enrollment.email} onChange={updateEnrollment} required />
              <EnrollmentInput label="Temporary password" field="password" type="password" value={enrollment.password} onChange={updateEnrollment} required />
              <EnrollmentInput label="Employee code" field="employee_code" value={enrollment.employee_code} onChange={updateEnrollment} required />
              <EnrollmentInput label="Phone" field="phone" type="tel" value={enrollment.phone} onChange={updateEnrollment} />
              <EnrollmentInput label="Date of birth" field="date_of_birth" type="date" value={enrollment.date_of_birth} onChange={updateEnrollment} />
              <EnrollmentInput label="Joining date" field="date_of_joining" type="date" value={enrollment.date_of_joining} onChange={updateEnrollment} />
              <EnrollmentInput label="Emergency contact" field="emergency_contact" value={enrollment.emergency_contact} onChange={updateEnrollment} />
              <EnrollmentInput label="Annual CTC" field="annual_ctc" type="number" value={enrollment.annual_ctc} onChange={updateEnrollment} min="0" />
              <EnrollmentSelect label="Access role" field="role" value={enrollment.role} onChange={updateEnrollment}>
                {availableRoles.length > 0 ? (
                  availableRoles.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name}
                    </option>
                  ))
                ) : (
                  <option value="admin">Administrator</option>
                )}
              </EnrollmentSelect>
              <EnrollmentSelect label="Department" field="department_id" value={enrollment.department_id} onChange={updateEnrollment}>
                <option value="">Unassigned</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </EnrollmentSelect>
              <EnrollmentSelect label="Designation" field="designation_id" value={enrollment.designation_id} onChange={updateEnrollment}>
                <option value="">Unassigned</option>{designations.map((designation) => <option key={designation.id} value={designation.id}>{designation.title}</option>)}
              </EnrollmentSelect>
              <EnrollmentSelect label="Reporting manager" field="manager_id" value={enrollment.manager_id} onChange={updateEnrollment}>
                <option value="">No manager assigned</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name} ({employee.employee_code})</option>)}
              </EnrollmentSelect>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={closeEnrollment} disabled={enrolling} className="skeuo-btn text-xs">Cancel</button>
              <button type="submit" disabled={enrolling} className="skeuo-btn-primary text-xs">{enrolling ? 'Enrolling...' : 'Create employee'}</button>
            </div>
          </form>
        </div>
      )}

      {editOpen && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="edit-employee-title">
          <form onSubmit={saveEmployeeEdit} className="skeuo-card max-h-[90vh] w-full max-w-3xl overflow-y-auto p-5 sm:p-7">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 id="edit-employee-title" className="text-lg font-black text-[var(--text-primary)]">
                  Edit employee details
                </h2>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Modify profile, assignment, access role, and employment status.
                </p>
              </div>
              <button
                type="button"
                onClick={closeEdit}
                disabled={savingEdit}
                className="skeuo-btn h-8 w-8 p-0"
                aria-label="Close edit form"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {editError && (
              <div className="skeuo-inset mb-5 p-3 text-xs font-bold text-rose-600">
                {editError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">First name *</span>
                <input
                  type="text"
                  value={editForm.first_name}
                  onChange={(e) => updateEditField('first_name', e.target.value)}
                  required
                  className="skeuo-inset w-full px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">Last name *</span>
                <input
                  type="text"
                  value={editForm.last_name}
                  onChange={(e) => updateEditField('last_name', e.target.value)}
                  required
                  className="skeuo-inset w-full px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">Work email *</span>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => updateEditField('email', e.target.value)}
                  required
                  className="skeuo-inset w-full px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">Employee code *</span>
                <input
                  type="text"
                  value={editForm.employee_code}
                  onChange={(e) => updateEditField('employee_code', e.target.value)}
                  required
                  className="skeuo-inset w-full px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">Phone</span>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => updateEditField('phone', e.target.value)}
                  className="skeuo-inset w-full px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">Date of birth</span>
                <input
                  type="date"
                  value={editForm.date_of_birth}
                  onChange={(e) => updateEditField('date_of_birth', e.target.value)}
                  className="skeuo-inset w-full px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">Joining date</span>
                <input
                  type="date"
                  value={editForm.date_of_joining}
                  onChange={(e) => updateEditField('date_of_joining', e.target.value)}
                  className="skeuo-inset w-full px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">Emergency contact</span>
                <input
                  type="text"
                  value={editForm.emergency_contact}
                  onChange={(e) => updateEditField('emergency_contact', e.target.value)}
                  className="skeuo-inset w-full px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">Access role</span>
                <select
                  value={editForm.role}
                  onChange={(e) => updateEditField('role', e.target.value)}
                  className="skeuo-inset w-full px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none"
                >
                  {availableRoles.length > 0 ? (
                    availableRoles.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.name}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="admin">Administrator</option>
                      <option value="super_admin">Super Administrator</option>
                      <option value="hr_admin">HR Admin</option>
                      <option value="manager">Manager</option>
                      <option value="employee">Employee</option>
                      <option value="recruiter">Recruiter</option>
                      <option value="payroll_specialist">Payroll Specialist</option>
                    </>
                  )}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">Employment status</span>
                <select
                  value={editForm.employment_status}
                  onChange={(e) => updateEditField('employment_status', e.target.value)}
                  className="skeuo-inset w-full px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none capitalize"
                >
                  <option value="active">Active</option>
                  <option value="probation">Probation</option>
                  <option value="on_leave">On Leave</option>
                  <option value="resigned">Resigned</option>
                  <option value="terminated">Terminated</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">Department</span>
                <select
                  value={editForm.department_id}
                  onChange={(e) => updateEditField('department_id', e.target.value)}
                  className="skeuo-inset w-full px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none"
                >
                  <option value="">Unassigned</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">Designation</span>
                <select
                  value={editForm.designation_id}
                  onChange={(e) => updateEditField('designation_id', e.target.value)}
                  className="skeuo-inset w-full px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none"
                >
                  <option value="">Unassigned</option>
                  {designations.map((designation) => (
                    <option key={designation.id} value={designation.id}>
                      {designation.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">Reporting manager</span>
                <select
                  value={editForm.manager_id}
                  onChange={(e) => updateEditField('manager_id', e.target.value)}
                  className="skeuo-inset w-full px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none"
                >
                  <option value="">No manager assigned</option>
                  {employees
                    .filter((employee) => employee.id !== editForm.id)
                    .map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.full_name} ({employee.employee_code})
                      </option>
                    ))}
                </select>
              </label>

              {canViewCompensation && (
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">Annual CTC</span>
                  <input
                    type="number"
                    value={editForm.annual_ctc}
                    onChange={(e) => updateEditField('annual_ctc', e.target.value)}
                    min="0"
                    className="skeuo-inset w-full px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none"
                  />
                </label>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeEdit}
                disabled={savingEdit}
                className="skeuo-btn text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="skeuo-btn-primary text-xs"
              >
                {savingEdit ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {viewMode === 'directory' ? (
        <div className="space-y-4">
          {/* Search bar with skeuo-inset */}
          <div className="relative max-w-md">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-[var(--text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, department, role..."
              className="skeuo-inset w-full py-2.5 pl-10 pr-4 text-xs sm:text-sm text-[var(--text-primary)] focus:outline-none"
            />
          </div>

          {/* Directory Table */}
          <div className="skeuo-card overflow-hidden">
            <table className="min-w-full divide-y divide-[var(--border-subtle)] text-left text-sm">
              <thead className="bg-[var(--bg-surface-elevated)] text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
                <tr>
                  <th className="px-6 py-3.5">Employee</th>
                  <th className="px-6 py-3.5">Department</th>
                  <th className="px-6 py-3.5">Title / Designation</th>
                  <th className="px-6 py-3.5">Access Role</th>
                  {canViewCompensation && <th className="px-6 py-3.5">Annual CTC</th>}
                  <th className="px-6 py-3.5">Status</th>
                  {(isAdmin || hasPermission('employees')) && (
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filtered.map((emp) => (
                  <tr key={emp.id} className="hover:bg-[var(--bg-surface-elevated)] transition">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-extrabold text-[var(--text-primary)] text-sm">{emp.full_name}</p>
                        {(emp.employee_code || emp.email) && (
                          <p className="text-[11px] text-[var(--text-muted)] font-mono">
                            {[emp.employee_code, emp.email].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-[var(--text-secondary)] font-medium">{emp.department}</td>
                    <td className="px-6 py-4 text-xs font-bold text-[var(--text-primary)]">{emp.designation}</td>
                    <td className="px-6 py-4">
                      <span className="skeuo-pill px-2.5 py-0.5 text-[10px] font-mono text-indigo-600 dark:text-indigo-400 uppercase">
                        {emp.role.replace('_', ' ')}
                      </span>
                    </td>
                    {canViewCompensation && (
                      <td className="px-6 py-4 font-mono text-xs font-bold text-[var(--text-primary)]">
                        {typeof emp.annual_ctc === 'number' ? emp.annual_ctc.toLocaleString() : '—'}
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <span className="skeuo-pill px-2.5 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 capitalize">
                        {emp.employment_status}
                      </span>
                    </td>
                    {(isAdmin || hasPermission('employees')) && (
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleOpenEdit(emp)}
                          className="skeuo-btn text-xs py-1.5 px-3 text-indigo-600 dark:text-indigo-400 font-bold inline-flex items-center gap-1.5"
                          title="Edit employee details"
                        >
                          <Pencil className="h-3 w-3" />
                          <span>Edit</span>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Hierarchical Org Chart View */
        <div className="skeuo-card p-6 md:p-8">
          <div className="mb-6">
            <h3 className="font-extrabold text-base text-[var(--text-primary)]">Organizational Hierarchy Tree</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Tactile visual mapping of reporting relationships.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {orgNodes.map((node) => (
              <div
                key={node.id}
                className="skeuo-card-soft p-5 hover:translate-y-[-2px] transition"
              >
                <div className="flex items-center gap-3">
                  <div className="skeuo-inset flex h-10 w-10 items-center justify-center font-black text-indigo-600 dark:text-indigo-400">
                    {node.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-[var(--text-primary)]">{node.name}</h4>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">{node.title}</p>
                  </div>
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-[var(--text-muted)] pt-3 border-t border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2">
                    <Building className="h-3.5 w-3.5" />
                    <span>Dept: <strong className="text-[var(--text-primary)]">{node.department}</strong></span>
                  </div>
                  {node.email && (
                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      <Mail className="h-3.5 w-3.5" />
                      <span>{node.email}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5" />
                    <span className="capitalize">Role: {node.role.replace('_', ' ')}</span>
                  </div>
                </div>
                {(isAdmin || hasPermission('employees')) && (
                  <div className="mt-4 pt-3 flex justify-end border-t border-[var(--border-subtle)]">
                    <button
                      onClick={() => handleOpenEditById(node.id)}
                      className="skeuo-btn text-xs py-1 px-2.5 text-indigo-600 dark:text-indigo-400 font-bold inline-flex items-center gap-1.5"
                      title="Edit employee details"
                    >
                      <Pencil className="h-3 w-3" />
                      <span>Edit</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </AuthGuard>
  );
}
