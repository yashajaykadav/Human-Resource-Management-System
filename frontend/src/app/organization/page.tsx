"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { AuthGuard } from '@/components/auth/AuthGuard';
import {
  Building2, BriefcaseBusiness, CalendarDays, Clock3, Plus, ShieldCheck,
  Users, X, Check, ChevronRight, SlidersHorizontal, Shield, Edit3, Trash2,
  KeyRound, Sparkles, UserCheck, AlertTriangle, CheckSquare, Square,
  GitFork, Network, ChevronDown, Search, Globe, Mail, Phone, MapPin,
  DollarSign, Flag, UserPlus, ArrowRight, UserCog, RefreshCw, Layers,
  Coffee, Timer, AlertCircle, CalendarRange, UserCheck2, SunMedium, Moon,
  Sunrise, Calendar
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

type TabType =
  | 'overview'
  | 'company'
  | 'structure'
  | 'hierarchy'
  | 'roles'
  | 'designations'
  | 'shifts'
  | 'leaves';

type CompanyProfile = {
  name: string;
  legal_name?: string;
  domain?: string;
  email?: string;
  phone?: string;
  website?: string;
  tax_id?: string;
  currency: string;
  timezone: string;
  address_street?: string;
  address_city?: string;
  address_state?: string;
  address_country?: string;
  address_postal_code?: string;
};

type Department = {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  manager_id?: string | null;
  manager_name?: string | null;
  employee_count?: number;
};

type TeamItem = {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  department_id?: string | null;
  department_name?: string | null;
  lead_id?: string | null;
  lead_name?: string | null;
  member_count?: number;
};

type Designation = {
  id: string;
  title: string;
  level?: string | null;
  description?: string | null;
  employee_count?: number;
};

type OrgNode = {
  id: string;
  name: string;
  role: string;
  title: string;
  department: string;
  manager_id: string | null;
  email?: string | null;
  employee_code?: string | null;
};

type TreeNode = OrgNode & {
  children: TreeNode[];
};

type Shift = {
  id: string;
  name: string;
  code: string;
  start_time: string;
  end_time: string;
  days: string[];
  break_duration_minutes?: number;
  grace_time_minutes?: number;
  half_day_threshold_hours?: number;
  absent_threshold_hours?: number;
  is_active?: boolean;
  description?: string | null;
};

type Roster = {
  id: string;
  name: string;
  shift_id: string;
  employee_id?: string | null;
  employee_name?: string | null;
  employee_code?: string | null;
  department_id?: string | null;
  department_name?: string | null;
  start_date: string;
  end_date?: string | null;
  is_active?: boolean;
  description?: string | null;
  shift?: Shift;
};

type LeavePolicy = {
  id: string;
  name: string;
  leave_type: string;
  total_days: number;
  accrual_rule: string;
  requires_approval: boolean;
  is_active?: boolean;
  description?: string | null;
};

type LeaveCalendar = {
  id: string;
  name: string;
  date: string;
  is_holiday: boolean;
  is_active?: boolean;
  description?: string | null;
};

type RoleItem = {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  is_system: boolean;
  permissions: string[];
  user_count?: number;
  created_at?: string;
  updated_at?: string;
};

type SystemModule = {
  id: string;
  name: string;
  description: string;
};

const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: Building2 },
  { id: 'company', label: 'Company Profile', icon: Globe },
  { id: 'structure', label: 'Departments & Teams', icon: Layers },
  { id: 'hierarchy', label: 'Org Hierarchy Tree', icon: GitFork },
  { id: 'roles', label: 'Dynamic Roles & RBAC', icon: ShieldCheck },
  { id: 'designations', label: 'Designations', icon: BriefcaseBusiness },
  { id: 'shifts', label: 'Shift Master & Rosters', icon: Clock3 },
  { id: 'leaves', label: 'Leave & Holidays', icon: CalendarDays },
];

const defaultCompany: CompanyProfile = {
  name: 'Apryde Technologies Inc.',
  legal_name: 'Apryde Technologies Inc.',
  domain: 'apryde.io',
  email: 'contact@apryde.io',
  phone: '+1 (555) 019-2834',
  website: 'https://apryde.io',
  tax_id: 'US-EIN-98-7654321',
  currency: 'USD',
  timezone: 'America/New_York',
  address_street: '100 Innovation Way, Suite 400',
  address_city: 'San Francisco',
  address_state: 'CA',
  address_country: 'United States',
  address_postal_code: '94105',
};

/* ------------------------------------------------------------------ */
/*  Helper Calculations                                               */
/* ------------------------------------------------------------------ */

function calculateNetHours(
  startTime: string,
  endTime: string,
  breakMinutes: number = 60
): { gross: string; net: string } {
  if (!startTime || !endTime) return { gross: '—', net: '—' };
  try {
    const [sH, sM] = startTime.split(':').map(Number);
    const [eH, eM] = endTime.split(':').map(Number);
    let startMin = sH * 60 + (sM || 0);
    let endMin = eH * 60 + (eM || 0);
    if (endMin <= startMin) endMin += 24 * 60; // overnight shift
    const grossMin = endMin - startMin;
    const netMin = Math.max(0, grossMin - (breakMinutes || 0));
    return {
      gross: `${(grossMin / 60).toFixed(1)}h`,
      net: `${(netMin / 60).toFixed(1)}h`,
    };
  } catch {
    return { gross: '—', net: '—' };
  }
}

/* ------------------------------------------------------------------ */
/*  Helper UI Components                                              */
/* ------------------------------------------------------------------ */

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="skeuo-inset w-full px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:ring-1 focus:ring-indigo-500 rounded-xl"
      />
    </label>
  );
}

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
  action,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="skeuo-card p-5 sm:p-6">
      <div className="mb-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="skeuo-inset flex h-10 w-10 shrink-0 items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-black text-[var(--text-primary)]">{title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{description}</p>
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Recursive Org Hierarchy Tree Component                            */
/* ------------------------------------------------------------------ */

function OrgTreeNodeItem({
  node,
  collapsedMap,
  onToggleCollapse,
  onReassignManager,
  searchQuery,
  depth = 0,
}: {
  node: TreeNode;
  collapsedMap: Record<string, boolean>;
  onToggleCollapse: (id: string) => void;
  onReassignManager: (node: TreeNode) => void;
  searchQuery: string;
  depth?: number;
}) {
  const isCollapsed = Boolean(collapsedMap[node.id]);
  const hasChildren = node.children && node.children.length > 0;

  const isMatched =
    searchQuery.trim().length > 0 &&
    (node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.department.toLowerCase().includes(searchQuery.toLowerCase()));

  const isExecutive = node.role === 'super_admin' || node.title.toLowerCase().includes('ceo') || depth === 0;
  const isManager = node.role === 'manager' || hasChildren;

  return (
    <div className="relative group">
      <div
        className={`skeuo-card p-4 transition-all duration-200 relative ${
          isMatched
            ? 'ring-2 ring-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/20'
            : isExecutive
            ? 'border-purple-500/30 dark:border-purple-500/20'
            : 'hover:border-indigo-500/40'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`h-11 w-11 rounded-2xl flex items-center justify-center font-black text-sm uppercase shrink-0 shadow-inner ${
                isExecutive
                  ? 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white'
                  : isManager
                  ? 'bg-gradient-to-tr from-indigo-500 to-blue-500 text-white'
                  : 'skeuo-inset text-indigo-600 dark:text-indigo-400 font-mono'
              }`}
            >
              {node.name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-black text-[var(--text-primary)]">{node.name}</h4>
                {isExecutive && (
                  <span className="skeuo-pill px-2 py-0.5 text-[9px] font-black uppercase text-purple-600 dark:text-purple-400 bg-purple-500/10">
                    Executive / Head
                  </span>
                )}
                {isManager && !isExecutive && (
                  <span className="skeuo-pill px-2 py-0.5 text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10">
                    Lead / Manager
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-[var(--text-muted)] flex-wrap">
                <span className="font-semibold text-[var(--text-secondary)]">{node.title}</span>
                <span>&bull;</span>
                <span className="skeuo-pill px-2 py-0.2 text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                  {node.department}
                </span>
                {node.email && (
                  <>
                    <span>&bull;</span>
                    <span className="font-mono text-[11px] opacity-80">{node.email}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            {hasChildren && (
              <button
                type="button"
                onClick={() => onToggleCollapse(node.id)}
                className="skeuo-pill px-2.5 py-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 flex items-center gap-1.5 transition"
                title={isCollapsed ? 'Expand direct reports' : 'Collapse direct reports'}
              >
                <Users className="h-3.5 w-3.5" />
                <span>
                  {node.children.length} {node.children.length === 1 ? 'Report' : 'Reports'}
                </span>
                <ChevronDown className={`h-3 w-3 transition-transform ${isCollapsed ? '-rotate-90' : 'rotate-0'}`} />
              </button>
            )}

            <button
              type="button"
              onClick={() => onReassignManager(node)}
              className="skeuo-btn text-[11px] py-1 px-2.5 text-[var(--text-secondary)] hover:text-indigo-600 dark:hover:text-indigo-400 font-bold flex items-center gap-1"
              title="Change or set reporting manager"
            >
              <UserCog className="h-3 w-3" />
              <span>Manager</span>
            </button>
          </div>
        </div>
      </div>

      {hasChildren && !isCollapsed && (
        <div className="ml-6 sm:ml-10 mt-3 pl-4 sm:pl-6 border-l-2 border-indigo-500/30 dark:border-indigo-500/20 space-y-3 relative">
          {node.children.map((child) => (
            <div key={child.id} className="relative">
              <div className="absolute -left-4 sm:-left-6 top-6 w-4 sm:w-6 h-0.5 bg-indigo-500/30 dark:border-indigo-500/20" />
              <OrgTreeNodeItem
                node={child}
                collapsedMap={collapsedMap}
                onToggleCollapse={onToggleCollapse}
                onReassignManager={onReassignManager}
                searchQuery={searchQuery}
                depth={depth + 1}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Organization Page Component                                  */
/* ------------------------------------------------------------------ */

export default function OrganizationPage() {
  const { user, isAdmin, hasPermission } = useAuth();
  const [tab, setTab] = useState<TabType>('overview');

  // Core Organization State
  const [company, setCompany] = useState<CompanyProfile>(defaultCompany);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [orgNodes, setOrgNodes] = useState<OrgNode[]>([]);

  // Shifts & Rosters State
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [rosters, setRosters] = useState<Roster[]>([]);

  // Leaves & Calendars State
  const [leavePolicies, setLeavePolicies] = useState<LeavePolicy[]>([]);
  const [leaveCalendars, setLeaveCalendars] = useState<LeaveCalendar[]>([]);

  // RBAC Roles & System Modules
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [modules, setModules] = useState<SystemModule[]>([]);

  // Modals state
  const [showEditCompany, setShowEditCompany] = useState(false);
  const [showDepartment, setShowDepartment] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showDesignation, setShowDesignation] = useState(false);
  const [showShift, setShowShift] = useState(false);
  const [showRoster, setShowRoster] = useState(false);
  const [showLeavePolicy, setShowLeavePolicy] = useState(false);
  const [showLeaveCalendar, setShowLeaveCalendar] = useState(false);
  const [showReassignManagerModal, setShowReassignManagerModal] = useState(false);
  const [reassignTargetNode, setReassignTargetNode] = useState<TreeNode | null>(null);
  const [selectedNewManagerId, setSelectedNewManagerId] = useState<string>('');

  // Role Modals state
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null);
  const [deletingRole, setDeletingRole] = useState<RoleItem | null>(null);
  const [showAssignUserModal, setShowAssignUserModal] = useState(false);

  // Form states
  const [companyForm, setCompanyForm] = useState<CompanyProfile>(defaultCompany);
  const [department, setDepartment] = useState({ name: '', code: '', description: '', manager_id: '' });
  const [teamForm, setTeamForm] = useState({ name: '', code: '', description: '', department_id: '', lead_id: '' });
  const [designation, setDesignation] = useState({ title: '', level: 'Mid', description: '' });

  // Shift Master Form State
  const [shiftForm, setShiftForm] = useState({
    name: 'General Shift',
    code: 'GEN',
    start_time: '09:00',
    end_time: '18:00',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as string[],
    break_duration_minutes: 60,
    grace_time_minutes: 15,
    half_day_threshold_hours: 4.0,
    absent_threshold_hours: 2.0,
    description: 'Standard 9-hour shift with 1 hour unpaid lunch break',
  });

  // Individual Employee Roster Form State
  const [rosterForm, setRosterForm] = useState({
    name: '',
    shift_id: '',
    employee_id: '',
    department_id: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    description: '',
  });

  // Leave Policy & Holiday Form State
  const [leavePolicy, setLeavePolicy] = useState({
    name: '',
    leave_type: 'annual',
    total_days: 18,
    accrual_rule: 'monthly',
    requires_approval: true,
    description: '',
  });
  const [leaveCalendar, setLeaveCalendar] = useState({
    name: '',
    date: new Date().toISOString().split('T')[0],
    is_holiday: true,
    description: '',
  });

  // Role Form State
  const [roleForm, setRoleForm] = useState({
    name: '',
    code: '',
    description: '',
    permissions: [] as string[],
  });

  // Assign user state
  const [assignState, setAssignState] = useState({
    userId: '',
    roleCode: 'admin',
  });

  // Hierarchy Tree Controls
  const [treeSearch, setTreeSearch] = useState('');
  const [treeDeptFilter, setTreeDeptFilter] = useState('ALL');
  const [treeCollapsedMap, setTreeCollapsedMap] = useState<Record<string, boolean>>({});

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const canAccessOrg = isAdmin || hasPermission('organization');

  // Fetch Organization Data
  const fetchOrganizationData = async () => {
    setLoading(true);
    try {
      const [
        depts,
        rolesList,
        people,
        shiftsData,
        rostersData,
        leavePoliciesData,
        leaveCalendarsData,
        rolesData,
        modulesData,
      ] = await Promise.all([
        apiRequest<Department[]>('/employees/departments').catch(() => []),
        apiRequest<Designation[]>('/employees/designations').catch(() => []),
        apiRequest<any[]>('/employees').catch(() => []),
        apiRequest<Shift[]>('/shifts').catch(() => []),
        apiRequest<Roster[]>('/shifts/rosters').catch(() => []),
        apiRequest<LeavePolicy[]>('/leave-policies').catch(() => []),
        apiRequest<LeaveCalendar[]>('/leave-policies/calendars').catch(() => []),
        apiRequest<RoleItem[]>('/roles').catch(() => []),
        apiRequest<SystemModule[]>('/roles/meta/modules').catch(() => []),
      ]);

      setDepartments(depts);
      setDesignations(rolesList);
      setEmployees(people);
      setShifts(shiftsData);
      setRosters(rostersData);
      setLeavePolicies(leavePoliciesData);
      setLeaveCalendars(leaveCalendarsData);
      setRoles(rolesData);
      setModules(modulesData);

      // Company Profile
      try {
        const comp = await apiRequest<CompanyProfile>('/organization/company');
        if (comp && comp.name) {
          setCompany(comp);
          setCompanyForm(comp);
          localStorage.setItem('hrms_company_profile', JSON.stringify(comp));
        }
      } catch {
        const cached = localStorage.getItem('hrms_company_profile');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            setCompany(parsed);
            setCompanyForm(parsed);
          } catch {}
        }
      }

      // Teams
      try {
        const teamsData = await apiRequest<TeamItem[]>('/organization/teams');
        if (Array.isArray(teamsData)) {
          setTeams(teamsData);
          localStorage.setItem('hrms_org_teams', JSON.stringify(teamsData));
        }
      } catch {
        const cachedTeams = localStorage.getItem('hrms_org_teams');
        if (cachedTeams) {
          try {
            setTeams(JSON.parse(cachedTeams));
          } catch {}
        }
      }

      // Org Chart
      try {
        const chartNodes = await apiRequest<OrgNode[]>('/employees/org-chart');
        if (Array.isArray(chartNodes) && chartNodes.length > 0) {
          setOrgNodes(chartNodes);
        } else if (Array.isArray(people) && people.length > 0) {
          const fallbackNodes: OrgNode[] = people.map((emp) => ({
            id: emp.id,
            name: emp.full_name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Employee',
            role: emp.role || 'employee',
            title: emp.designation || 'Staff Member',
            department: emp.department || 'General',
            manager_id: emp.manager_id || null,
            email: emp.email || null,
            employee_code: emp.employee_code || null,
          }));
          setOrgNodes(fallbackNodes);
        }
      } catch {
        if (Array.isArray(people)) {
          const fallbackNodes: OrgNode[] = people.map((emp) => ({
            id: emp.id,
            name: emp.full_name || 'Employee',
            role: emp.role || 'employee',
            title: emp.designation || 'Staff Member',
            department: emp.department || 'General',
            manager_id: emp.manager_id || null,
            email: emp.email || null,
            employee_code: emp.employee_code || null,
          }));
          setOrgNodes(fallbackNodes);
        }
      }
    } catch (error: any) {
      setMessage(error.message || 'Unable to load complete organization dataset.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && canAccessOrg) {
      fetchOrganizationData();
    }
  }, [user, canAccessOrg]);

  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.employment_status === 'active').length,
    [employees]
  );

  // Hierarchy Tree Builder
  const hierarchyTree = useMemo(() => {
    const filteredNodes =
      treeDeptFilter === 'ALL'
        ? orgNodes
        : orgNodes.filter((n) => n.department?.toLowerCase() === treeDeptFilter.toLowerCase());

    const map = new Map<string, TreeNode>();
    const roots: TreeNode[] = [];

    filteredNodes.forEach((node) => {
      map.set(node.id, { ...node, children: [] });
    });

    filteredNodes.forEach((node) => {
      const treeNode = map.get(node.id)!;
      if (node.manager_id && map.has(node.manager_id)) {
        map.get(node.manager_id)!.children.push(treeNode);
      } else {
        roots.push(treeNode);
      }
    });

    return roots;
  }, [orgNodes, treeDeptFilter]);

  const allDepartmentNames = useMemo(() => {
    const set = new Set<string>();
    orgNodes.forEach((n) => {
      if (n.department) set.add(n.department);
    });
    return Array.from(set).sort();
  }, [orgNodes]);

  const handleToggleCollapse = (nodeId: string) => {
    setTreeCollapsedMap((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  const handleExpandAll = () => setTreeCollapsedMap({});
  const handleCollapseAll = () => {
    const newMap: Record<string, boolean> = {};
    orgNodes.forEach((n) => {
      newMap[n.id] = true;
    });
    setTreeCollapsedMap(newMap);
  };

  // Company Profile Handlers
  const saveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      localStorage.setItem('hrms_company_profile', JSON.stringify(companyForm));
      const updated = await apiRequest<CompanyProfile>('/organization/company', {
        method: 'PUT',
        body: JSON.stringify(companyForm),
      });
      setCompany(updated || companyForm);
      setShowEditCompany(false);
      setMessage('Company details updated successfully.');
    } catch {
      setCompany(companyForm);
      setShowEditCompany(false);
      setMessage('Company details saved locally.');
    } finally {
      setSaving(false);
    }
  };

  // Departments Handlers
  const saveDepartment = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: department.name,
        code: department.code.toUpperCase(),
        description: department.description,
        manager_id: department.manager_id || undefined,
      };
      const created = await apiRequest<Department>('/employees/departments', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setDepartments((items) => [...items, created].sort((a, b) => a.name.localeCompare(b.name)));
      setDepartment({ name: '', code: '', description: '', manager_id: '' });
      setShowDepartment(false);
      setMessage(`Department "${created.name}" created successfully.`);
    } catch (error: any) {
      setMessage(error.message || 'Unable to add department.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDepartment = async (deptId: string, deptName: string) => {
    if (!confirm(`Are you sure you want to remove department "${deptName}"?`)) return;
    try {
      await apiRequest(`/organization/departments/${deptId}`, { method: 'DELETE' });
      setDepartments((prev) => prev.filter((d) => d.id !== deptId));
      setMessage(`Department "${deptName}" removed.`);
    } catch (err: any) {
      setMessage(err.message || 'Cannot delete department.');
    }
  };

  // Teams Handlers
  const saveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: teamForm.name,
        code: teamForm.code.toUpperCase(),
        description: teamForm.description,
        department_id: teamForm.department_id || undefined,
        lead_id: teamForm.lead_id || undefined,
      };
      let createdTeam: TeamItem;
      try {
        createdTeam = await apiRequest<TeamItem>('/organization/teams', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } catch {
        createdTeam = {
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
          name: teamForm.name,
          code: teamForm.code.toUpperCase(),
          description: teamForm.description,
          department_id: teamForm.department_id || undefined,
          department_name: departments.find((d) => d.id === teamForm.department_id)?.name,
          lead_id: teamForm.lead_id || undefined,
          lead_name: employees.find((emp) => emp.id === teamForm.lead_id)?.full_name,
        };
      }
      setTeams((prev) => {
        const updated = [...prev, createdTeam];
        localStorage.setItem('hrms_org_teams', JSON.stringify(updated));
        return updated;
      });
      setTeamForm({ name: '', code: '', description: '', department_id: '', lead_id: '' });
      setShowTeamModal(false);
      setMessage(`Team "${createdTeam.name}" created successfully.`);
    } catch (err: any) {
      setMessage(err.message || 'Unable to create team.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    if (!confirm(`Delete team "${teamName}"?`)) return;
    try {
      await apiRequest(`/organization/teams/${teamId}`, { method: 'DELETE' }).catch(() => {});
      setTeams((prev) => {
        const updated = prev.filter((t) => t.id !== teamId);
        localStorage.setItem('hrms_org_teams', JSON.stringify(updated));
        return updated;
      });
      setMessage(`Team "${teamName}" deleted.`);
    } catch (err: any) {
      setMessage(err.message || 'Unable to delete team.');
    }
  };

  // Designations Handlers
  const saveDesignation = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const created = await apiRequest<Designation>('/employees/designations', {
        method: 'POST',
        body: JSON.stringify(designation),
      });
      setDesignations((items) => [...items, created].sort((a, b) => a.title.localeCompare(b.title)));
      setDesignation({ title: '', level: 'Mid', description: '' });
      setShowDesignation(false);
      setMessage(`Designation "${created.title}" added.`);
    } catch (error: any) {
      setMessage(error.message || 'Unable to add designation.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDesignation = async (desigId: string, desigTitle: string) => {
    if (!confirm(`Remove designation "${desigTitle}"?`)) return;
    try {
      await apiRequest(`/organization/designations/${desigId}`, { method: 'DELETE' });
      setDesignations((prev) => prev.filter((d) => d.id !== desigId));
      setMessage(`Designation "${desigTitle}" removed.`);
    } catch (err: any) {
      setMessage(err.message || 'Cannot delete designation.');
    }
  };

  // Reassign Manager in Hierarchy
  const handleOpenReassignManager = (node: TreeNode) => {
    setReassignTargetNode(node);
    setSelectedNewManagerId(node.manager_id || '');
    setShowReassignManagerModal(true);
  };

  const submitReassignManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignTargetNode) return;
    setSaving(true);
    try {
      await apiRequest(`/employees/${reassignTargetNode.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          manager_id: selectedNewManagerId || null,
        }),
      });
      setMessage(`Manager for "${reassignTargetNode.name}" updated successfully.`);
      setShowReassignManagerModal(false);
      setReassignTargetNode(null);
      const chartNodes = await apiRequest<OrgNode[]>('/employees/org-chart');
      setOrgNodes(chartNodes);
    } catch (err: any) {
      setMessage(err.message || 'Unable to reassign manager.');
    } finally {
      setSaving(false);
    }
  };

  // RBAC Roles Handlers
  const openCreateRole = () => {
    setRoleForm({
      name: '',
      code: '',
      description: '',
      permissions: ['dashboard', 'attendance', 'leaves'],
    });
    setShowCreateRole(true);
  };

  const openEditRole = (r: RoleItem) => {
    setEditingRole(r);
    setRoleForm({
      name: r.name,
      code: r.code,
      description: r.description || '',
      permissions: r.permissions || [],
    });
  };

  const toggleModulePermission = (modId: string) => {
    setRoleForm((prev) => {
      const exists = prev.permissions.includes(modId);
      return {
        ...prev,
        permissions: exists ? prev.permissions.filter((p) => p !== modId) : [...prev.permissions, modId],
      };
    });
  };

  const selectAllModules = () => {
    setRoleForm((prev) => ({
      ...prev,
      permissions: modules.map((m) => m.id),
    }));
  };

  const clearAllModules = () => {
    setRoleForm((prev) => ({
      ...prev,
      permissions: [],
    }));
  };

  const saveRole = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editingRole) {
        const updated = await apiRequest<RoleItem>(`/roles/${editingRole.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: roleForm.name,
            description: roleForm.description,
            permissions: roleForm.permissions,
          }),
        });
        setRoles((items) => items.map((r) => (r.id === updated.id ? updated : r)));
        setEditingRole(null);
        setMessage(`Role "${updated.name}" updated successfully.`);
      } else {
        const created = await apiRequest<RoleItem>('/roles', {
          method: 'POST',
          body: JSON.stringify(roleForm),
        });
        setRoles((items) => [...items, created]);
        setShowCreateRole(false);
        setMessage(`Role "${created.name}" created successfully.`);
      }
    } catch (err: any) {
      setMessage(err.message || 'Unable to save role configuration.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!deletingRole) return;
    setSaving(true);
    try {
      await apiRequest(`/roles/${deletingRole.id}`, { method: 'DELETE' });
      setRoles((items) => items.filter((r) => r.id !== deletingRole.id));
      setMessage(`Role "${deletingRole.name}" deleted. Any assigned users were reassigned.`);
      setDeletingRole(null);
      const people = await apiRequest<any[]>('/employees');
      setEmployees(people);
    } catch (err: any) {
      setMessage(err.message || 'Unable to delete role.');
    } finally {
      setSaving(false);
    }
  };

  const handleAssignUserRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignState.userId || !assignState.roleCode) return;
    setSaving(true);
    try {
      await apiRequest(`/roles/users/${assignState.userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role: assignState.roleCode }),
      });
      setMessage('User role assigned successfully.');
      setShowAssignUserModal(false);
      const [rolesData, people] = await Promise.all([
        apiRequest<RoleItem[]>('/roles'),
        apiRequest<any[]>('/employees'),
      ]);
      setRoles(rolesData);
      setEmployees(people);
    } catch (err: any) {
      setMessage(err.message || 'Unable to assign user role.');
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------------------------------------------
  // SHIFT MASTER HANDLERS (Presets, Break deduction & Grace periods)
  // ------------------------------------------------------------------
  const applyShiftPreset = (presetType: 'general' | 'morning' | 'night' | 'weekend') => {
    if (presetType === 'general') {
      setShiftForm({
        name: 'General Shift',
        code: 'GEN',
        start_time: '09:00',
        end_time: '18:00',
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        break_duration_minutes: 60,
        grace_time_minutes: 15,
        half_day_threshold_hours: 4.0,
        absent_threshold_hours: 2.0,
        description: 'Standard full-time core operating hours with 1 hour unpaid meal break.',
      });
    } else if (presetType === 'morning') {
      setShiftForm({
        name: 'Morning Shift',
        code: 'MOR',
        start_time: '06:00',
        end_time: '14:30',
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        break_duration_minutes: 30,
        grace_time_minutes: 10,
        half_day_threshold_hours: 4.0,
        absent_threshold_hours: 2.0,
        description: 'Early coverage shift with 30-minute unpaid lunch break.',
      });
    } else if (presetType === 'night') {
      setShiftForm({
        name: 'Night Shift',
        code: 'NGT',
        start_time: '22:00',
        end_time: '06:30',
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        break_duration_minutes: 30,
        grace_time_minutes: 15,
        half_day_threshold_hours: 4.0,
        absent_threshold_hours: 2.0,
        description: 'Overnight operations shift with 30-minute unpaid meal interval.',
      });
    } else if (presetType === 'weekend') {
      setShiftForm({
        name: 'Weekend Shift',
        code: 'WKD',
        start_time: '10:00',
        end_time: '19:00',
        days: ['Sat', 'Sun'],
        break_duration_minutes: 60,
        grace_time_minutes: 15,
        half_day_threshold_hours: 4.0,
        absent_threshold_hours: 2.0,
        description: 'Dedicated Saturday-Sunday weekend on-call coverage.',
      });
    }
  };

  const saveShift = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: shiftForm.name,
        code: shiftForm.code.toUpperCase(),
        start_time: shiftForm.start_time,
        end_time: shiftForm.end_time,
        days: shiftForm.days,
        break_duration_minutes: Number(shiftForm.break_duration_minutes) || 0,
        grace_time_minutes: Number(shiftForm.grace_time_minutes) || 0,
        half_day_threshold_hours: Number(shiftForm.half_day_threshold_hours) || 4.0,
        absent_threshold_hours: Number(shiftForm.absent_threshold_hours) || 2.0,
        description: shiftForm.description,
      };

      const created = await apiRequest<Shift>('/shifts', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setShifts((items) => [...items, created]);
      setShowShift(false);
      setMessage(`Shift type "${created.name}" configured in Shift Master.`);
    } catch (error: any) {
      setMessage(error.message || 'Unable to save shift pattern.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteShift = async (shiftId: string, shiftName: string) => {
    if (!confirm(`Delete shift "${shiftName}"?`)) return;
    try {
      await apiRequest(`/shifts/${shiftId}`, { method: 'DELETE' });
      setShifts((prev) => prev.filter((s) => s.id !== shiftId));
      setMessage(`Shift "${shiftName}" removed.`);
    } catch (err: any) {
      setMessage(err.message || 'Unable to delete shift.');
    }
  };

  // ------------------------------------------------------------------
  // INDIVIDUAL EMPLOYEE ROSTER HANDLERS
  // ------------------------------------------------------------------
  const handleOpenAssignRoster = (empId?: string) => {
    const defaultEmp = empId ? employees.find((e) => e.id === empId) : employees[0];
    const defaultShift = shifts[0];
    setRosterForm({
      name: defaultEmp ? `${defaultEmp.full_name} - Shift Roster` : 'Individual Employee Roster',
      shift_id: defaultShift?.id || '',
      employee_id: defaultEmp?.id || '',
      department_id: defaultEmp?.department_id || '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      description: '',
    });
    setShowRoster(true);
  };

  const saveRoster = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!rosterForm.shift_id) {
      setMessage('Please choose a shift from Shift Master.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: rosterForm.name || 'Individual Employee Roster',
        shift_id: rosterForm.shift_id,
        employee_id: rosterForm.employee_id || undefined,
        department_id: rosterForm.department_id || undefined,
        start_date: rosterForm.start_date,
        end_date: rosterForm.end_date || undefined,
        description: rosterForm.description,
      };

      const created = await apiRequest<Roster>('/shifts/rosters', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setRosters((items) => [created, ...items]);
      setShowRoster(false);
      setMessage(`Roster schedule successfully assigned for employee.`);
    } catch (error: any) {
      setMessage(error.message || 'Unable to assign roster schedule.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRoster = async (rosterId: string, rosterName: string) => {
    if (!confirm(`Remove roster schedule "${rosterName}"?`)) return;
    try {
      await apiRequest(`/shifts/rosters/${rosterId}`, { method: 'DELETE' });
      setRosters((prev) => prev.filter((r) => r.id !== rosterId));
      setMessage(`Roster schedule removed.`);
    } catch (err: any) {
      setMessage(err.message || 'Unable to delete roster schedule.');
    }
  };

  // ------------------------------------------------------------------
  // LEAVE POLICIES & HOLIDAY CALENDAR HANDLERS
  // ------------------------------------------------------------------
  const saveLeavePolicy = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const created = await apiRequest<LeavePolicy>('/leave-policies', {
        method: 'POST',
        body: JSON.stringify(leavePolicy),
      });
      setLeavePolicies((items) => [...items, created]);
      setLeavePolicy({
        name: '',
        leave_type: 'annual',
        total_days: 18,
        accrual_rule: 'monthly',
        requires_approval: true,
        description: '',
      });
      setShowLeavePolicy(false);
      setMessage(`Leave entitlement policy "${created.name}" configured.`);
    } catch (error: any) {
      setMessage(error.message || 'Unable to save leave policy.');
    } finally {
      setSaving(false);
    }
  };

  const saveLeaveCalendar = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const created = await apiRequest<LeaveCalendar>('/leave-policies/calendars', {
        method: 'POST',
        body: JSON.stringify(leaveCalendar),
      });
      setLeaveCalendars((items) => [...items, created]);
      setLeaveCalendar({
        name: '',
        date: new Date().toISOString().split('T')[0],
        is_holiday: true,
        description: '',
      });
      setShowLeaveCalendar(false);
      setMessage(`Holiday date "${created.name}" added to calendar.`);
    } catch (error: any) {
      setMessage(error.message || 'Unable to save calendar entry.');
    } finally {
      setSaving(false);
    }
  };

  if (!user || !canAccessOrg) {
    return (
      <div className="skeuo-card p-8 text-center text-sm font-bold text-[var(--text-secondary)]">
        You do not have administrative access to Organization Setup.
      </div>
    );
  }

  const metrics: { icon: React.ElementType; value: string | number; label: string }[] = [
    { icon: Building2, value: departments.length, label: 'Departments' },
    { icon: Layers, value: teams.length, label: 'Teams' },
    { icon: BriefcaseBusiness, value: designations.length, label: 'Designations' },
    { icon: ShieldCheck, value: roles.length, label: 'Active Roles' },
    { icon: Clock3, value: shifts.length, label: 'Shift Masters' },
    { icon: CalendarRange, value: rosters.length, label: 'Active Rosters' },
    { icon: CalendarDays, value: leavePolicies.length, label: 'Leave Policies' },
    { icon: Users, value: activeEmployees, label: 'Staff Count' },
  ];

  return (
    <AuthGuard module="organization">
      <div className="space-y-6">
        {/* Header with Company Identity */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-indigo-500">
              <ShieldCheck className="h-3.5 w-3.5" /> Corporate Management Center
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-[var(--text-primary)]">
              {company.name || 'Organization Setup'}
            </h1>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Configure company branding, department structures, cross-functional teams, dynamic RBAC roles, Shift Master & individual rosters, and leave policies.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                setCompanyForm(company);
                setShowEditCompany(true);
              }}
              className="skeuo-btn text-xs font-bold py-2 px-3 flex items-center gap-1.5"
            >
              <Globe className="h-3.5 w-3.5 text-indigo-500" />
              <span>Edit Company Profile</span>
            </button>
            <span className="skeuo-pill px-3 py-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Dynamic RBAC Active</span>
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="skeuo-inset flex flex-wrap gap-1 p-1.5">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                tab === id
                  ? 'skeuo-card-soft text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-500/30'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Global Feedback Banner */}
        {message && (
          <div className="skeuo-inset flex items-center justify-between p-3.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 rounded-xl">
            <span>{message}</span>
            <button onClick={() => setMessage('')} aria-label="Dismiss message">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 1: OVERVIEW                                                */}
        {/* ============================================================== */}
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {metrics.map(({ icon: Icon, value, label }) => (
                <div key={label} className="skeuo-card p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">{label}</span>
                    <Icon className="h-3.5 w-3.5 text-indigo-500" />
                  </div>
                  <p className="mt-2 text-xl font-black text-[var(--text-primary)] font-mono">{value}</p>
                </div>
              ))}
            </div>

            {/* Company Details Snapshot Card */}
            <div className="skeuo-card p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[var(--border-soft)] gap-3">
                <div className="flex items-center gap-3">
                  <div className="skeuo-inset h-12 w-12 rounded-2xl flex items-center justify-center font-black text-lg text-indigo-600 dark:text-indigo-400">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-[var(--text-primary)]">{company.name}</h2>
                    <p className="text-xs text-[var(--text-muted)]">
                      {company.legal_name} &bull; Tax ID: <span className="font-mono font-bold">{company.tax_id || '—'}</span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setCompanyForm(company);
                    setShowEditCompany(true);
                  }}
                  className="skeuo-btn-primary text-xs py-2 px-4 font-bold flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Update Details</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                <div className="skeuo-inset p-3.5 rounded-xl">
                  <span className="text-[10px] font-extrabold uppercase text-[var(--text-muted)] flex items-center gap-1">
                    <Globe className="h-3 w-3 text-indigo-500" /> Domain & Web
                  </span>
                  <p className="text-xs font-bold text-[var(--text-primary)] mt-1 truncate">{company.website || company.domain || '—'}</p>
                </div>

                <div className="skeuo-inset p-3.5 rounded-xl">
                  <span className="text-[10px] font-extrabold uppercase text-[var(--text-muted)] flex items-center gap-1">
                    <Mail className="h-3 w-3 text-indigo-500" /> Primary Email
                  </span>
                  <p className="text-xs font-bold text-[var(--text-primary)] mt-1 font-mono truncate">{company.email || '—'}</p>
                </div>

                <div className="skeuo-inset p-3.5 rounded-xl">
                  <span className="text-[10px] font-extrabold uppercase text-[var(--text-muted)] flex items-center gap-1">
                    <DollarSign className="h-3 w-3 text-emerald-500" /> Currency & Zone
                  </span>
                  <p className="text-xs font-bold text-[var(--text-primary)] mt-1">
                    {company.currency} &bull; <span className="text-[11px] font-mono">{company.timezone}</span>
                  </p>
                </div>

                <div className="skeuo-inset p-3.5 rounded-xl">
                  <span className="text-[10px] font-extrabold uppercase text-[var(--text-muted)] flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-rose-500" /> Headquarters
                  </span>
                  <p className="text-xs font-bold text-[var(--text-primary)] mt-1 truncate">
                    {company.address_city ? `${company.address_city}, ${company.address_country}` : 'Not Specified'}
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: COMPANY PROFILE                                         */}
        {/* ============================================================== */}
        {tab === 'company' && (
          <div className="space-y-6 max-w-5xl">
            <SectionCard
              icon={Building2}
              title="Company Identity & Settings"
              description="Manage official entity name, contact details, headquarters address, and financial settings."
              action={
                <button
                  type="button"
                  onClick={() => {
                    setCompanyForm(company);
                    setShowEditCompany(true);
                  }}
                  className="skeuo-btn-primary px-3.5 py-2 text-xs font-bold flex items-center gap-1.5"
                >
                  <Edit3 className="h-3.5 w-3.5" /> Edit Company Profile
                </button>
              }
            >
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
                    Corporate Identity
                  </h3>
                  <div className="skeuo-inset p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--text-muted)]">Company Display Name</span>
                      <span className="font-bold text-[var(--text-primary)]">{company.name}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--text-muted)]">Legal Registered Entity</span>
                      <span className="font-bold text-[var(--text-primary)]">{company.legal_name || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--text-muted)]">Business Domain</span>
                      <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{company.domain || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--text-muted)]">Tax / EIN Number</span>
                      <span className="font-mono font-bold text-[var(--text-primary)]">{company.tax_id || '—'}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
                    Contact & Financial Locale
                  </h3>
                  <div className="skeuo-inset p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--text-muted)]">Official Email</span>
                      <span className="font-mono font-bold text-[var(--text-primary)]">{company.email || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--text-muted)]">Telephone</span>
                      <span className="font-bold text-[var(--text-primary)]">{company.phone || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--text-muted)]">Operating Currency</span>
                      <span className="skeuo-pill px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                        {company.currency}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--text-muted)]">Corporate Timezone</span>
                      <span className="font-mono text-[11px] text-[var(--text-secondary)]">{company.timezone}</span>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 space-y-4">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
                    Headquarters Address
                  </h3>
                  <div className="skeuo-inset p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Street Address</span>
                      <span className="font-bold text-[var(--text-primary)] mt-0.5 block">{company.address_street || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)] block uppercase font-bold">City & State</span>
                      <span className="font-bold text-[var(--text-primary)] mt-0.5 block">
                        {company.address_city ? `${company.address_city}, ${company.address_state || ''}` : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Country & Postal Code</span>
                      <span className="font-bold text-[var(--text-primary)] mt-0.5 block">
                        {company.address_country ? `${company.address_country} (${company.address_postal_code || ''})` : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: DEPARTMENTS & TEAMS                                     */}
        {/* ============================================================== */}
        {tab === 'structure' && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2 items-start">
              <SectionCard
                icon={Building2}
                title="Departments"
                description="Business units used across workforce grouping, budgets, and reporting."
                action={
                  <button
                    onClick={() => setShowDepartment(true)}
                    className="skeuo-btn-primary px-3 py-2 text-xs font-bold flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Department
                  </button>
                }
              >
                <div className="space-y-2.5">
                  {departments.map((item) => {
                    const memberCount = employees.filter((e) => e.department_id === item.id || e.department === item.name).length;
                    const managerEmp = employees.find((e) => e.id === item.manager_id);
                    return (
                      <div key={item.id} className="skeuo-card-soft p-3.5 flex items-center justify-between gap-3 rounded-xl">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-black text-[var(--text-primary)]">{item.name}</p>
                            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-slate-200/50 dark:bg-slate-800 text-[var(--text-secondary)] font-bold">
                              {item.code}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                            {item.description || 'No description configured.'}
                          </p>
                          {managerEmp && (
                            <p className="mt-1 text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                              Head: {managerEmp.full_name}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="skeuo-pill px-2.5 py-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                            {memberCount} {memberCount === 1 ? 'member' : 'members'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteDepartment(item.id, item.name)}
                            className="p-1.5 text-[var(--text-muted)] hover:text-rose-500 transition rounded"
                            title="Delete department"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {departments.length === 0 && <Empty text="No departments configured yet." />}
                </div>
              </SectionCard>

              <SectionCard
                icon={Layers}
                title="Cross-Functional Teams"
                description="Squads, working groups, and pods aligned under specific departments."
                action={
                  <button
                    onClick={() => setShowTeamModal(true)}
                    className="skeuo-btn-primary px-3 py-2 text-xs font-bold flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Create Team
                  </button>
                }
              >
                <div className="space-y-2.5">
                  {teams.map((t) => (
                    <div key={t.id} className="skeuo-card-soft p-3.5 flex items-center justify-between gap-3 rounded-xl">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-black text-[var(--text-primary)]">{t.name}</p>
                          <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold">
                            {t.code}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                          {t.description || 'Cross-functional team unit'}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-[var(--text-secondary)]">
                          {t.department_name && (
                            <span className="skeuo-pill px-2 py-0.2 font-bold text-indigo-600 dark:text-indigo-400">
                              Dept: {t.department_name}
                            </span>
                          )}
                          {t.lead_name && <span>&bull; Lead: <strong>{t.lead_name}</strong></span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDeleteTeam(t.id, t.name)}
                          className="p-1.5 text-[var(--text-muted)] hover:text-rose-500 transition rounded"
                          title="Delete team"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {teams.length === 0 && <Empty text="No teams created yet. Click 'Create Team' to add one." />}
                </div>
              </SectionCard>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: TREE-LIKE EMPLOYEES HIERARCHY                           */}
        {/* ============================================================== */}
        {tab === 'hierarchy' && (
          <div className="space-y-6">
            <SectionCard
              icon={GitFork}
              title="Organizational Reporting Hierarchy"
              description="Visual tree structure mapping reporting lines from company leadership down to individual contributors. Click 'Manager' on any card to reassign reporting line."
              action={
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleExpandAll}
                    className="skeuo-btn text-xs font-bold py-1.5 px-3"
                  >
                    Expand All
                  </button>
                  <button
                    type="button"
                    onClick={handleCollapseAll}
                    className="skeuo-btn text-xs font-bold py-1.5 px-3"
                  >
                    Collapse All
                  </button>
                </div>
              }
            >
              {/* Tree Filter and Search Bar */}
              <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl skeuo-inset">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    value={treeSearch}
                    onChange={(e) => setTreeSearch(e.target.value)}
                    placeholder="Search name, title, department..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-transparent text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-[11px] font-bold text-[var(--text-secondary)] whitespace-nowrap">Filter Dept:</span>
                  <select
                    value={treeDeptFilter}
                    onChange={(e) => setTreeDeptFilter(e.target.value)}
                    className="skeuo-card-soft px-3 py-1.5 text-xs text-[var(--text-primary)] outline-none font-bold rounded-lg"
                  >
                    <option value="ALL">All Departments ({orgNodes.length})</option>
                    {allDepartmentNames.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Hierarchy Tree Rendering */}
              {hierarchyTree.length > 0 ? (
                <div className="space-y-4">
                  {hierarchyTree.map((rootNode) => (
                    <OrgTreeNodeItem
                      key={rootNode.id}
                      node={rootNode}
                      collapsedMap={treeCollapsedMap}
                      onToggleCollapse={handleToggleCollapse}
                      onReassignManager={handleOpenReassignManager}
                      searchQuery={treeSearch}
                      depth={0}
                    />
                  ))}
                </div>
              ) : (
                <Empty text="No employees found for the current department filter." />
              )}
            </SectionCard>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 5: DYNAMIC ROLES & RBAC ACCESS CONTROL                     */}
        {/* ============================================================== */}
        {tab === 'roles' && (
          <div className="space-y-6">
            <SectionCard
              icon={Shield}
              title="Role-Based Access Control (RBAC)"
              description="Create and manage dynamic custom roles with granular module permissions. Define specialized access profiles and assign users on the fly."
              action={
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      if (employees.length > 0) {
                        setAssignState({ userId: employees[0]?.user_id || '', roleCode: roles[0]?.code || 'admin' });
                      }
                      setShowAssignUserModal(true);
                    }}
                    className="skeuo-btn px-3 py-2 text-xs font-bold flex items-center gap-1.5"
                  >
                    <UserCheck className="h-3.5 w-3.5" /> Assign Role
                  </button>
                  <button onClick={openCreateRole} className="skeuo-btn-primary px-3 py-2 text-xs font-bold flex items-center gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Create New Role
                  </button>
                </div>
              }
            >
              <div className="grid gap-4 md:grid-cols-2">
                {roles.map((r) => {
                  const isWildcard = r.permissions?.includes('*') || r.is_system;
                  return (
                    <div
                      key={r.id}
                      className="skeuo-card-soft p-5 flex flex-col justify-between border border-[var(--border-soft)] relative transition hover:shadow-md rounded-2xl"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-black text-[var(--text-primary)]">{r.name}</h3>
                              {r.is_system && (
                                <span className="skeuo-pill px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 bg-purple-500/10">
                                  System Default
                                </span>
                              )}
                            </div>
                            <span className="inline-block mt-1 font-mono text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-200/50 dark:bg-slate-800 px-2 py-0.5 rounded">
                              code: {r.code}
                            </span>
                          </div>

                          <div className="skeuo-pill px-2.5 py-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                            {r.user_count || 0} {(r.user_count || 0) === 1 ? 'user' : 'users'}
                          </div>
                        </div>

                        <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-4">
                          {r.description || 'No description configured for this role.'}
                        </p>

                        <div className="mb-4">
                          <p className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--text-muted)] mb-2">
                            Authorized Modules
                          </p>
                          {isWildcard ? (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              <Sparkles className="h-3.5 w-3.5" />
                              <span>Full Access — Unrestricted Root Permissions</span>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {r.permissions && r.permissions.length > 0 ? (
                                r.permissions.map((p) => {
                                  const modInfo = modules.find((m) => m.id === p);
                                  return (
                                    <span
                                      key={p}
                                      className="skeuo-inset px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)] rounded-md"
                                    >
                                      {modInfo ? modInfo.name : p}
                                    </span>
                                  );
                                })
                              ) : (
                                <span className="text-[11px] italic text-[var(--text-muted)]">
                                  No module permissions assigned
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-[var(--border-soft)] flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditRole(r)}
                          className="skeuo-btn px-3 py-1.5 text-xs font-bold flex items-center gap-1.5"
                        >
                          <Edit3 className="h-3 w-3 text-indigo-500" /> Edit Permissions
                        </button>
                        {!r.is_system && (
                          <button
                            type="button"
                            onClick={() => setDeletingRole(r)}
                            className="skeuo-btn text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1.5 px-3 py-1.5"
                          >
                            <Trash2 className="h-3 w-3" /> Delete
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 6: DESIGNATIONS                                            */}
        {/* ============================================================== */}
        {tab === 'designations' && (
          <div className="space-y-6 max-w-5xl">
            <SectionCard
              icon={BriefcaseBusiness}
              title="Career Designations & Job Titles"
              description="Maintain career levels and titles that determine job responsibilities and organizational bands."
              action={
                <button
                  onClick={() => setShowDesignation(true)}
                  className="skeuo-btn-primary px-3 py-2 text-xs font-bold flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Designation
                </button>
              }
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {designations.map((item) => {
                  const empCount = employees.filter((e) => e.designation_id === item.id || e.designation === item.title).length;
                  return (
                    <div key={item.id} className="skeuo-card-soft p-4 flex items-center justify-between gap-3 rounded-xl">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-black text-[var(--text-primary)]">{item.title}</p>
                          <span className="skeuo-pill px-2 py-0.5 text-[9px] font-bold text-indigo-600 dark:text-indigo-400">
                            {item.level || 'Mid'}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                          {item.description || 'Career level designation'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="skeuo-inset px-2.5 py-1 text-[10px] font-bold text-[var(--text-secondary)] font-mono">
                          {empCount} staff
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteDesignation(item.id, item.title)}
                          className="p-1.5 text-[var(--text-muted)] hover:text-rose-500 transition rounded"
                          title="Delete designation"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {designations.length === 0 && <Empty text="No designations configured yet." />}
              </div>
            </SectionCard>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 7: SHIFT MASTER & INDIVIDUAL ROSTERS (SEPARATED TAB)       */}
        {/* ============================================================== */}
        {tab === 'shifts' && (
          <div className="space-y-6">
            {/* Quick Shift Master Setup Banner */}
            <div className="skeuo-card p-5 border-l-4 border-indigo-500">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="skeuo-inset p-2.5 rounded-xl text-indigo-600 dark:text-indigo-400">
                    <Clock3 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[var(--text-primary)]">
                      Shift Master & Individual Employee Rostering Engine
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Configure precise shift windows with automatic unpaid break deduction, late-arrival grace windows, half-day thresholds, and map individual employees to their working rosters.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      applyShiftPreset('general');
                      setShowShift(true);
                    }}
                    className="skeuo-btn-primary px-3 py-2 text-xs font-bold flex items-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" /> Define Shift Master
                  </button>
                  <button
                    onClick={() => handleOpenAssignRoster()}
                    className="skeuo-btn px-3 py-2 text-xs font-bold flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Assign Employee Roster
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2 items-start">
              {/* 1. Shift Master Portal */}
              <SectionCard
                icon={Clock3}
                title="Shift Master Types"
                description="Manage working hours, unpaid meal breaks (auto-deducted), and attendance grace periods."
                action={
                  <button
                    onClick={() => {
                      applyShiftPreset('general');
                      setShowShift(true);
                    }}
                    className="skeuo-btn text-xs font-bold py-1.5 px-3 flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Shift
                  </button>
                }
              >
                <div className="space-y-3">
                  {shifts.map((s) => {
                    const hours = calculateNetHours(s.start_time, s.end_time, s.break_duration_minutes || 60);
                    return (
                      <div key={s.id} className="skeuo-card-soft p-4 rounded-xl border border-[var(--border-soft)]">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-black text-[var(--text-primary)]">{s.name}</h4>
                              <span className="font-mono text-[9px] px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold">
                                {s.code}
                              </span>
                            </div>
                            <p className="text-xs font-bold text-[var(--text-secondary)] mt-1 flex items-center gap-1.5">
                              <span>
                                {s.start_time} &ndash; {s.end_time}
                              </span>
                              <span className="text-[var(--text-muted)]">&bull;</span>
                              <span className="text-indigo-600 dark:text-indigo-400 font-mono text-[11px]">
                                {hours.net} Net ({hours.gross} Gross)
                              </span>
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteShift(s.id, s.name)}
                            className="p-1 text-[var(--text-muted)] hover:text-rose-500 rounded transition"
                            title="Delete shift"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Working Days */}
                        <div className="flex flex-wrap gap-1 mt-2.5">
                          {s.days &&
                            s.days.map((d) => (
                              <span
                                key={d}
                                className="skeuo-inset px-1.5 py-0.5 text-[9px] font-bold text-[var(--text-secondary)] rounded"
                              >
                                {d}
                              </span>
                            ))}
                        </div>

                        {/* Break & Threshold Rules */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-[var(--border-subtle)] text-[10px]">
                          <div className="skeuo-inset p-1.5 text-center rounded">
                            <span className="text-[var(--text-muted)] block">Unpaid Break</span>
                            <span className="font-bold text-[var(--text-primary)]">
                              {s.break_duration_minutes ?? 60} mins
                            </span>
                          </div>

                          <div className="skeuo-inset p-1.5 text-center rounded">
                            <span className="text-[var(--text-muted)] block">Grace Window</span>
                            <span className="font-bold text-amber-600 dark:text-amber-400">
                              {s.grace_time_minutes ?? 15} mins
                            </span>
                          </div>

                          <div className="skeuo-inset p-1.5 text-center rounded">
                            <span className="text-[var(--text-muted)] block">Half-Day &lt;</span>
                            <span className="font-bold text-blue-600 dark:text-blue-400">
                              {s.half_day_threshold_hours ?? 4.0}h worked
                            </span>
                          </div>

                          <div className="skeuo-inset p-1.5 text-center rounded">
                            <span className="text-[var(--text-muted)] block">Absent &lt;</span>
                            <span className="font-bold text-rose-500">
                              {s.absent_threshold_hours ?? 2.0}h worked
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {shifts.length === 0 && <Empty text="No shift types defined in Shift Master yet." />}
                </div>
              </SectionCard>

              {/* 2. Individual Employee Roster Assignments */}
              <SectionCard
                icon={CalendarRange}
                title="Individual Employee Rosters"
                description="Assign shifts directly to individual employees with effective date ranges and ongoing schedules."
                action={
                  <button
                    onClick={() => handleOpenAssignRoster()}
                    className="skeuo-btn text-xs font-bold py-1.5 px-3 flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Assign Roster
                  </button>
                }
              >
                <div className="space-y-3">
                  {rosters.map((ros) => {
                    const shiftObj = shifts.find((s) => s.id === ros.shift_id) || ros.shift;
                    const empObj = employees.find((e) => e.id === ros.employee_id);
                    const empName = ros.employee_name || empObj?.full_name || 'Individual Employee';
                    const empCode = ros.employee_code || empObj?.employee_code;
                    const shiftHours = shiftObj
                      ? calculateNetHours(shiftObj.start_time, shiftObj.end_time, shiftObj.break_duration_minutes || 60)
                      : null;

                    return (
                      <div key={ros.id} className="skeuo-card-soft p-3.5 rounded-xl border border-[var(--border-soft)]">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-black text-[var(--text-primary)]">{empName}</h4>
                              {empCode && (
                                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-slate-200/50 dark:bg-slate-800 text-[var(--text-secondary)] font-bold">
                                  {empCode}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                              {ros.name}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="skeuo-pill px-2 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                              Active Roster
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteRoster(ros.id, ros.name)}
                              className="p-1 text-[var(--text-muted)] hover:text-rose-500 rounded transition"
                              title="Delete roster schedule"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-2.5 p-2 rounded-lg skeuo-inset flex flex-wrap items-center justify-between text-xs gap-2">
                          <div>
                            <span className="text-[10px] text-[var(--text-muted)] block">Assigned Shift</span>
                            <span className="font-bold text-[var(--text-primary)]">
                              {shiftObj ? `${shiftObj.name} (${shiftObj.start_time} - ${shiftObj.end_time})` : 'Custom Shift'}
                            </span>
                          </div>

                          {shiftHours && (
                            <div>
                              <span className="text-[10px] text-[var(--text-muted)] block">Net Production</span>
                              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                {shiftHours.net} / day
                              </span>
                            </div>
                          )}

                          <div>
                            <span className="text-[10px] text-[var(--text-muted)] block">Effective Window</span>
                            <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                              {ros.start_date} {ros.end_date ? `to ${ros.end_date}` : '(Ongoing)'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {rosters.length === 0 && (
                    <Empty text="No individual employee rosters assigned yet. Click 'Assign Roster' to schedule an employee." />
                  )}
                </div>
              </SectionCard>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 8: LEAVE & HOLIDAYS (SEPARATED TAB)                         */}
        {/* ============================================================== */}
        {tab === 'leaves' && (
          <div className="space-y-6">
            {/* Quick Header Banner */}
            <div className="skeuo-card p-5 border-l-4 border-emerald-500">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="skeuo-inset p-2.5 rounded-xl text-emerald-600 dark:text-emerald-400">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[var(--text-primary)]">
                      Leave Policy Entitlements & Corporate Holiday Calendars
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Configure statutory leave categories, annual day quotas, monthly/yearly accrual rules, manager approval gates, and paid company holidays.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setShowLeavePolicy(true)}
                    className="skeuo-btn-primary px-3 py-2 text-xs font-bold flex items-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Leave Policy
                  </button>
                  <button
                    onClick={() => setShowLeaveCalendar(true)}
                    className="skeuo-btn px-3 py-2 text-xs font-bold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Holiday Date
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2 items-start">
              {/* Leave Entitlement Policies */}
              <SectionCard
                icon={CalendarDays}
                title="Leave Entitlement Policies"
                description="Statutory and optional leave categories, annual quotas, and approval chains."
                action={
                  <button
                    onClick={() => setShowLeavePolicy(true)}
                    className="skeuo-btn text-xs font-bold py-1.5 px-3 flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Policy
                  </button>
                }
              >
                <div className="space-y-3">
                  {leavePolicies.map((p) => (
                    <div key={p.id} className="skeuo-card-soft p-4 rounded-xl border border-[var(--border-soft)]">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-black text-[var(--text-primary)]">{p.name}</h4>
                            <span className="skeuo-pill px-2 py-0.5 text-[9px] font-bold text-indigo-600 dark:text-indigo-400 capitalize">
                              {p.leave_type}
                            </span>
                          </div>
                          <p className="text-[11px] text-[var(--text-muted)] mt-1">
                            {p.description || 'Statutory employee leave entitlement'}
                          </p>
                        </div>

                        <span className="skeuo-inset px-2.5 py-1 text-xs font-black text-[var(--text-primary)] font-mono">
                          {p.total_days} Days / Yr
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[var(--border-subtle)] text-[10px]">
                        <span className="text-[var(--text-secondary)]">
                          Accrual: <strong className="capitalize">{p.accrual_rule}</strong>
                        </span>
                        <span>&bull;</span>
                        <span className={p.requires_approval ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-emerald-600'}>
                          {p.requires_approval ? 'Manager Approval Required' : 'Self-Approved'}
                        </span>
                      </div>
                    </div>
                  ))}
                  {leavePolicies.length === 0 && <Empty text="No leave policies configured yet." />}
                </div>
              </SectionCard>

              {/* Corporate Holidays & Calendar */}
              <SectionCard
                icon={Calendar}
                title="Corporate Holiday Calendar"
                description="Company-wide non-working days, national holidays, and designated corporate events."
                action={
                  <button
                    onClick={() => setShowLeaveCalendar(true)}
                    className="skeuo-btn text-xs font-bold py-1.5 px-3 flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Holiday
                  </button>
                }
              >
                <div className="space-y-2.5">
                  {leaveCalendars.map((cal) => (
                    <div key={cal.id} className="skeuo-card-soft p-3.5 rounded-xl flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-black text-[var(--text-primary)]">{cal.name}</p>
                          <span
                            className={`skeuo-pill px-2 py-0.5 text-[9px] font-bold ${
                              cal.is_holiday
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {cal.is_holiday ? 'Paid Holiday' : 'Special Event'}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                          {cal.description || 'Observed corporate day off'}
                        </p>
                      </div>

                      <span className="skeuo-inset px-3 py-1 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {cal.date}
                      </span>
                    </div>
                  ))}
                  {leaveCalendars.length === 0 && <Empty text="No holiday dates recorded for this calendar cycle." />}
                </div>
              </SectionCard>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODALS                                                         */}
        {/* ============================================================== */}

        {/* MODAL 1: Edit Company Profile */}
        {showEditCompany && (
          <Modal title="Configure Company Profile" onClose={() => setShowEditCompany(false)}>
            <form onSubmit={saveCompany} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
              <Field
                label="Company Display Name"
                required
                value={companyForm.name}
                onChange={(val) => setCompanyForm({ ...companyForm, name: val })}
                placeholder="e.g. Apryde Technologies Inc."
              />
              <Field
                label="Legal Registered Name"
                value={companyForm.legal_name || ''}
                onChange={(val) => setCompanyForm({ ...companyForm, legal_name: val })}
                placeholder="Legal corporate entity name"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field
                  label="Work Email"
                  type="email"
                  value={companyForm.email || ''}
                  onChange={(val) => setCompanyForm({ ...companyForm, email: val })}
                  placeholder="contact@company.com"
                />
                <Field
                  label="Phone Number"
                  value={companyForm.phone || ''}
                  onChange={(val) => setCompanyForm({ ...companyForm, phone: val })}
                  placeholder="+1 (555) 000-0000"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field
                  label="Website URL"
                  value={companyForm.website || ''}
                  onChange={(val) => setCompanyForm({ ...companyForm, website: val })}
                  placeholder="https://company.com"
                />
                <Field
                  label="Domain Name"
                  value={companyForm.domain || ''}
                  onChange={(val) => setCompanyForm({ ...companyForm, domain: val })}
                  placeholder="company.com"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field
                  label="Tax / EIN ID"
                  value={companyForm.tax_id || ''}
                  onChange={(val) => setCompanyForm({ ...companyForm, tax_id: val })}
                  placeholder="Tax ID"
                />
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">Currency</span>
                  <select
                    value={companyForm.currency}
                    onChange={(e) => setCompanyForm({ ...companyForm, currency: e.target.value })}
                    className="skeuo-inset w-full px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none rounded-xl"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="INR">INR (₹)</option>
                    <option value="CAD">CAD ($)</option>
                    <option value="AUD">AUD ($)</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">Timezone</span>
                  <select
                    value={companyForm.timezone}
                    onChange={(e) => setCompanyForm({ ...companyForm, timezone: e.target.value })}
                    className="skeuo-inset w-full px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none rounded-xl"
                  >
                    <option value="America/New_York">Eastern (US)</option>
                    <option value="America/Chicago">Central (US)</option>
                    <option value="America/Denver">Mountain (US)</option>
                    <option value="America/Los_Angeles">Pacific (US)</option>
                    <option value="UTC">UTC Universal</option>
                    <option value="Europe/London">London (GMT/BST)</option>
                    <option value="Asia/Kolkata">India (IST)</option>
                    <option value="Asia/Singapore">Singapore (SGT)</option>
                  </select>
                </label>
              </div>

              <div className="border-t border-[var(--border-soft)] pt-3">
                <h4 className="text-xs font-bold text-[var(--text-secondary)] mb-2">Headquarters Address</h4>
                <div className="space-y-3">
                  <Field
                    label="Street Address"
                    value={companyForm.address_street || ''}
                    onChange={(val) => setCompanyForm({ ...companyForm, address_street: val })}
                    placeholder="123 Corporate Blvd"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field
                      label="City"
                      value={companyForm.address_city || ''}
                      onChange={(val) => setCompanyForm({ ...companyForm, address_city: val })}
                      placeholder="City"
                    />
                    <Field
                      label="State / Province"
                      value={companyForm.address_state || ''}
                      onChange={(val) => setCompanyForm({ ...companyForm, address_state: val })}
                      placeholder="State"
                    />
                    <Field
                      label="Country"
                      value={companyForm.address_country || ''}
                      onChange={(val) => setCompanyForm({ ...companyForm, address_country: val })}
                      placeholder="Country"
                    />
                  </div>
                </div>
              </div>

              <FormActions saving={saving} onClose={() => setShowEditCompany(false)} />
            </form>
          </Modal>
        )}

        {/* MODAL 2: Reassign Manager */}
        {showReassignManagerModal && reassignTargetNode && (
          <Modal
            title={`Set Manager for ${reassignTargetNode.name}`}
            onClose={() => {
              setShowReassignManagerModal(false);
              setReassignTargetNode(null);
            }}
          >
            <form onSubmit={submitReassignManager} className="space-y-4">
              <div className="skeuo-inset p-3.5 rounded-xl text-xs space-y-1">
                <p>
                  <strong>Employee:</strong> {reassignTargetNode.name}
                </p>
                <p>
                  <strong>Title:</strong> {reassignTargetNode.title} &bull; {reassignTargetNode.department}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                  Select Reporting Manager
                </label>
                <select
                  value={selectedNewManagerId}
                  onChange={(e) => setSelectedNewManagerId(e.target.value)}
                  className="skeuo-inset w-full px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none rounded-xl"
                >
                  <option value="">-- No Direct Manager (Top Executive / Root) --</option>
                  {employees
                    .filter((e) => e.id !== reassignTargetNode.id)
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.designation || 'Staff'} &bull; {emp.department || 'General'})
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
                  Changing the manager immediately reorganizes the tree branch and leave approval routing.
                </p>
              </div>

              <FormActions
                saving={saving}
                onClose={() => {
                  setShowReassignManagerModal(false);
                  setReassignTargetNode(null);
                }}
              />
            </form>
          </Modal>
        )}

        {/* MODAL 3: Add Department */}
        {showDepartment && (
          <Modal title="Add Department" onClose={() => setShowDepartment(false)}>
            <form onSubmit={saveDepartment} className="space-y-4">
              <Field
                label="Department Name *"
                required
                value={department.name}
                onChange={(value) => setDepartment({ ...department, name: value })}
                placeholder="e.g. Engineering, Human Resources, Finance"
              />
              <Field
                label="Department Code *"
                required
                value={department.code}
                onChange={(value) => setDepartment({ ...department, code: value.toUpperCase() })}
                placeholder="e.g. ENG, HR, FIN"
              />
              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                  Department Head / Lead (Optional)
                </label>
                <select
                  value={department.manager_id}
                  onChange={(e) => setDepartment({ ...department, manager_id: e.target.value })}
                  className="skeuo-inset w-full px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none rounded-xl"
                >
                  <option value="">-- Select department head --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.designation || 'Staff'})
                    </option>
                  ))}
                </select>
              </div>
              <Field
                label="Description"
                value={department.description}
                onChange={(value) => setDepartment({ ...department, description: value })}
                placeholder="What responsibilities does this department own?"
              />
              <FormActions saving={saving} onClose={() => setShowDepartment(false)} />
            </form>
          </Modal>
        )}

        {/* MODAL 4: Create Team */}
        {showTeamModal && (
          <Modal title="Create Team" onClose={() => setShowTeamModal(false)}>
            <form onSubmit={saveTeam} className="space-y-4">
              <Field
                label="Team Name *"
                required
                value={teamForm.name}
                onChange={(value) => setTeamForm({ ...teamForm, name: value })}
                placeholder="e.g. Core Frontend, Talent Acquisition, Platform SRE"
              />
              <Field
                label="Team Code *"
                required
                value={teamForm.code}
                onChange={(value) => setTeamForm({ ...teamForm, code: value.toUpperCase() })}
                placeholder="e.g. TEAM-FE, TEAM-TA"
              />
              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                  Parent Department (Optional)
                </label>
                <select
                  value={teamForm.department_id}
                  onChange={(e) => setTeamForm({ ...teamForm, department_id: e.target.value })}
                  className="skeuo-inset w-full px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none rounded-xl"
                >
                  <option value="">-- Select department --</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                  Team Lead (Optional)
                </label>
                <select
                  value={teamForm.lead_id}
                  onChange={(e) => setTeamForm({ ...teamForm, lead_id: e.target.value })}
                  className="skeuo-inset w-full px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none rounded-xl"
                >
                  <option value="">-- Select team lead --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.designation || 'Staff'})
                    </option>
                  ))}
                </select>
              </div>
              <Field
                label="Description"
                value={teamForm.description}
                onChange={(value) => setTeamForm({ ...teamForm, description: value })}
                placeholder="Purpose and scope of this team"
              />
              <FormActions saving={saving} onClose={() => setShowTeamModal(false)} />
            </form>
          </Modal>
        )}

        {/* MODAL 5: Add Designation */}
        {showDesignation && (
          <Modal title="Add Designation" onClose={() => setShowDesignation(false)}>
            <form onSubmit={saveDesignation} className="space-y-4">
              <Field
                label="Title *"
                required
                value={designation.title}
                onChange={(value) => setDesignation({ ...designation, title: value })}
                placeholder="e.g. Senior Software Engineer, People Partner"
              />
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">Career Level</span>
                <select
                  value={designation.level || 'Mid'}
                  onChange={(e) => setDesignation({ ...designation, level: e.target.value })}
                  className="skeuo-inset w-full px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none rounded-xl"
                >
                  <option value="Associate">Associate (L1-L2)</option>
                  <option value="Mid">Mid Level (L3)</option>
                  <option value="Senior">Senior (L4-L5)</option>
                  <option value="Lead">Lead / Principal (L6)</option>
                  <option value="Executive">Executive / Director (L7+)</option>
                </select>
              </label>
              <Field
                label="Description"
                value={designation.description || ''}
                onChange={(value) => setDesignation({ ...designation, description: value })}
                placeholder="Role scope and responsibilities"
              />
              <FormActions saving={saving} onClose={() => setShowDesignation(false)} />
            </form>
          </Modal>
        )}

        {/* MODAL 6: SHIFT MASTER CONFIGURATION PORTAL */}
        {showShift && (
          <Modal title="Shift Master & Policy Configuration" onClose={() => setShowShift(false)}>
            <form onSubmit={saveShift} className="space-y-4 max-h-[78vh] overflow-y-auto pr-1">
              {/* Shift Presets Quick Buttons */}
              <div>
                <span className="mb-1.5 block text-xs font-bold text-[var(--text-secondary)]">
                  Quick Shift Presets
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => applyShiftPreset('general')}
                    className="skeuo-btn text-[11px] font-bold py-2 px-2.5 text-center flex flex-col items-center gap-1 text-indigo-600 dark:text-indigo-400"
                  >
                    <SunMedium className="h-4 w-4" />
                    <span>General (9-6)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyShiftPreset('morning')}
                    className="skeuo-btn text-[11px] font-bold py-2 px-2.5 text-center flex flex-col items-center gap-1 text-amber-600 dark:text-amber-400"
                  >
                    <Sunrise className="h-4 w-4" />
                    <span>Morning (6-2:30)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyShiftPreset('night')}
                    className="skeuo-btn text-[11px] font-bold py-2 px-2.5 text-center flex flex-col items-center gap-1 text-purple-600 dark:text-purple-400"
                  >
                    <Moon className="h-4 w-4" />
                    <span>Night (10-6:30)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyShiftPreset('weekend')}
                    className="skeuo-btn text-[11px] font-bold py-2 px-2.5 text-center flex flex-col items-center gap-1 text-emerald-600 dark:text-emerald-400"
                  >
                    <Calendar className="h-4 w-4" />
                    <span>Weekend (Sat-Sun)</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field
                  label="Shift Name *"
                  required
                  value={shiftForm.name}
                  onChange={(value) => setShiftForm({ ...shiftForm, name: value })}
                  placeholder="e.g. General Shift, Night Shift"
                />
                <Field
                  label="Shift Code *"
                  required
                  value={shiftForm.code}
                  onChange={(value) => setShiftForm({ ...shiftForm, code: value.toUpperCase() })}
                  placeholder="e.g. GEN, MOR, NGT"
                />
              </div>

              {/* Timings */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">Start Time *</span>
                  <input
                    type="time"
                    required
                    value={shiftForm.start_time}
                    onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.target.value })}
                    className="skeuo-inset w-full px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none rounded-xl"
                  />
                </div>
                <div>
                  <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">End Time *</span>
                  <input
                    type="time"
                    required
                    value={shiftForm.end_time}
                    onChange={(e) => setShiftForm({ ...shiftForm, end_time: e.target.value })}
                    className="skeuo-inset w-full px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none rounded-xl"
                  />
                </div>
              </div>

              {/* Working Days Multi-Select */}
              <div>
                <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">Working Days</span>
                <div className="flex flex-wrap gap-1.5">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                    const isSelected = shiftForm.days.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() =>
                          setShiftForm({
                            ...shiftForm,
                            days: isSelected
                              ? shiftForm.days.filter((d) => d !== day)
                              : [...shiftForm.days, day],
                          })
                        }
                        className={`px-3 py-1.5 text-xs rounded-lg transition font-bold ${
                          isSelected
                            ? 'skeuo-card-soft text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-500/30'
                            : 'skeuo-inset text-[var(--text-muted)]'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Break Configuration */}
              <div className="p-3.5 rounded-xl skeuo-inset bg-indigo-50/20 dark:bg-indigo-950/20 border border-indigo-500/20 space-y-2">
                <div className="flex items-center gap-2">
                  <Coffee className="h-4 w-4 text-indigo-500 shrink-0" />
                  <span className="text-xs font-black text-[var(--text-primary)]">
                    Break Configuration (Automatic Deduction)
                  </span>
                </div>
                <div>
                  <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">
                    Unpaid Break Duration (Minutes)
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={shiftForm.break_duration_minutes}
                    onChange={(e) =>
                      setShiftForm({ ...shiftForm, break_duration_minutes: parseInt(e.target.value) || 0 })
                    }
                    className="skeuo-inset w-full px-3 py-2 text-sm text-[var(--text-primary)] outline-none rounded-lg"
                  />
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">
                    Calculated Net Working Time: &nbsp;
                    <strong className="text-indigo-600 dark:text-indigo-400 font-mono">
                      {calculateNetHours(shiftForm.start_time, shiftForm.end_time, shiftForm.break_duration_minutes).net}
                    </strong>
                    &nbsp; (automatically deducted from {calculateNetHours(shiftForm.start_time, shiftForm.end_time, shiftForm.break_duration_minutes).gross} gross duration).
                  </p>
                </div>
              </div>

              {/* Flexibility & Grace Periods */}
              <div className="p-3.5 rounded-xl skeuo-inset bg-amber-50/20 dark:bg-amber-950/20 border border-amber-500/20 space-y-3">
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-amber-500 shrink-0" />
                  <span className="text-xs font-black text-[var(--text-primary)]">
                    Flexibility & Grace Attendance Thresholds
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <span className="mb-1 block text-[11px] font-bold text-[var(--text-secondary)]">
                      Grace Time (Mins)
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={shiftForm.grace_time_minutes}
                      onChange={(e) =>
                        setShiftForm({ ...shiftForm, grace_time_minutes: parseInt(e.target.value) || 0 })
                      }
                      className="skeuo-inset w-full px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none rounded-lg"
                    />
                    <span className="text-[9px] text-[var(--text-muted)] block mt-0.5">
                      Allowed late arrival window
                    </span>
                  </div>

                  <div>
                    <span className="mb-1 block text-[11px] font-bold text-[var(--text-secondary)]">
                      Half-Day Threshold (Hrs)
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={shiftForm.half_day_threshold_hours}
                      onChange={(e) =>
                        setShiftForm({ ...shiftForm, half_day_threshold_hours: parseFloat(e.target.value) || 0 })
                      }
                      className="skeuo-inset w-full px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none rounded-lg"
                    />
                    <span className="text-[9px] text-[var(--text-muted)] block mt-0.5">
                      Less than this = Half Day
                    </span>
                  </div>

                  <div>
                    <span className="mb-1 block text-[11px] font-bold text-[var(--text-secondary)]">
                      Absent Threshold (Hrs)
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={shiftForm.absent_threshold_hours}
                      onChange={(e) =>
                        setShiftForm({ ...shiftForm, absent_threshold_hours: parseFloat(e.target.value) || 0 })
                      }
                      className="skeuo-inset w-full px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none rounded-lg"
                    />
                    <span className="text-[9px] text-[var(--text-muted)] block mt-0.5">
                      Less than this = Absent
                    </span>
                  </div>
                </div>
              </div>

              <Field
                label="Description"
                value={shiftForm.description}
                onChange={(value) => setShiftForm({ ...shiftForm, description: value })}
                placeholder="Shift schedule guidelines or notes"
              />

              <FormActions saving={saving} onClose={() => setShowShift(false)} />
            </form>
          </Modal>
        )}

        {/* MODAL 7: ASSIGN INDIVIDUAL EMPLOYEE ROSTER */}
        {showRoster && (
          <Modal title="Assign Individual Employee Roster" onClose={() => setShowRoster(false)}>
            <form onSubmit={saveRoster} className="space-y-4">
              <div>
                <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">
                  Target Employee *
                </span>
                <select
                  required
                  value={rosterForm.employee_id}
                  onChange={(e) => {
                    const emp = employees.find((x) => x.id === e.target.value);
                    setRosterForm({
                      ...rosterForm,
                      employee_id: e.target.value,
                      name: emp ? `${emp.full_name} - Shift Roster` : rosterForm.name,
                      department_id: emp?.department_id || rosterForm.department_id,
                    });
                  }}
                  className="skeuo-inset w-full px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none rounded-xl"
                >
                  <option value="">-- Choose employee to roster --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.employee_code}) &bull; {emp.department || 'General'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">
                  Shift Master Type *
                </span>
                <select
                  required
                  value={rosterForm.shift_id}
                  onChange={(e) => setRosterForm({ ...rosterForm, shift_id: e.target.value })}
                  className="skeuo-inset w-full px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none rounded-xl"
                >
                  <option value="">-- Choose Shift Master Type --</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.start_time} - {s.end_time} &bull; {s.days.join(',')})
                    </option>
                  ))}
                </select>
              </div>

              <Field
                label="Roster Schedule Title"
                value={rosterForm.name}
                onChange={(value) => setRosterForm({ ...rosterForm, name: value })}
                placeholder="e.g. Alice Chen - Core Roster"
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">Start Date *</span>
                  <input
                    type="date"
                    required
                    value={rosterForm.start_date}
                    onChange={(e) => setRosterForm({ ...rosterForm, start_date: e.target.value })}
                    className="skeuo-inset w-full px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none rounded-xl"
                  />
                </div>
                <div>
                  <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">
                    End Date (Optional)
                  </span>
                  <input
                    type="date"
                    value={rosterForm.end_date}
                    onChange={(e) => setRosterForm({ ...rosterForm, end_date: e.target.value })}
                    className="skeuo-inset w-full px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none rounded-xl"
                  />
                  <span className="text-[10px] text-[var(--text-muted)] mt-0.5 block">
                    Leave blank for permanent/ongoing
                  </span>
                </div>
              </div>

              <Field
                label="Notes / Instructions"
                value={rosterForm.description}
                onChange={(value) => setRosterForm({ ...rosterForm, description: value })}
                placeholder="Special notes regarding this employee's schedule"
              />

              <FormActions saving={saving} onClose={() => setShowRoster(false)} />
            </form>
          </Modal>
        )}

        {/* MODAL 8: Add Leave Policy */}
        {showLeavePolicy && (
          <Modal title="Add Leave Policy" onClose={() => setShowLeavePolicy(false)}>
            <form onSubmit={saveLeavePolicy} className="space-y-4">
              <Field
                label="Policy Name *"
                required
                value={leavePolicy.name}
                onChange={(value) => setLeavePolicy({ ...leavePolicy, name: value })}
                placeholder="e.g. Annual Vacation, Sick Leave"
              />
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">Leave Type</span>
                <select
                  value={leavePolicy.leave_type}
                  onChange={(e) => setLeavePolicy({ ...leavePolicy, leave_type: e.target.value })}
                  className="skeuo-inset w-full px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none rounded-xl"
                >
                  <option value="annual">Annual</option>
                  <option value="casual">Casual</option>
                  <option value="sick">Sick</option>
                  <option value="maternity">Maternity</option>
                  <option value="paternity">Paternity</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="bereavement">Bereavement</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">Total Days / Year</span>
                  <input
                    type="number"
                    value={leavePolicy.total_days}
                    onChange={(e) => setLeavePolicy({ ...leavePolicy, total_days: parseFloat(e.target.value) || 0 })}
                    className="skeuo-inset w-full px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none rounded-xl"
                    min="0"
                    step="0.5"
                  />
                </div>
                <div>
                  <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">Accrual Rule</span>
                  <select
                    value={leavePolicy.accrual_rule}
                    onChange={(e) => setLeavePolicy({ ...leavePolicy, accrual_rule: e.target.value })}
                    className="skeuo-inset w-full px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none rounded-xl"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                    <option value="none">None</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={leavePolicy.requires_approval}
                  onChange={(e) => setLeavePolicy({ ...leavePolicy, requires_approval: e.target.checked })}
                  className="h-4 w-4"
                />
                <span className="text-xs font-bold text-[var(--text-secondary)]">Requires manager approval</span>
              </label>
              <Field
                label="Description"
                value={leavePolicy.description || ''}
                onChange={(value) => setLeavePolicy({ ...leavePolicy, description: value })}
                placeholder="e.g. 18 days accrued monthly, requires reporting manager sign-off"
              />
              <FormActions saving={saving} onClose={() => setShowLeavePolicy(false)} />
            </form>
          </Modal>
        )}

        {/* MODAL 9: Add Holiday */}
        {showLeaveCalendar && (
          <Modal title="Add Holiday / Special Event" onClose={() => setShowLeaveCalendar(false)}>
            <form onSubmit={saveLeaveCalendar} className="space-y-4">
              <Field
                label="Event Name *"
                required
                value={leaveCalendar.name}
                onChange={(value) => setLeaveCalendar({ ...leaveCalendar, name: value })}
                placeholder="e.g. New Year's Day, Founder's Day"
              />
              <div>
                <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">Date *</span>
                <input
                  type="date"
                  required
                  value={leaveCalendar.date}
                  onChange={(e) => setLeaveCalendar({ ...leaveCalendar, date: e.target.value })}
                  className="skeuo-inset w-full px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none rounded-xl"
                />
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">Type</span>
                <select
                  value={leaveCalendar.is_holiday ? 'holiday' : 'special'}
                  onChange={(e) => setLeaveCalendar({ ...leaveCalendar, is_holiday: e.target.value === 'holiday' })}
                  className="skeuo-inset w-full px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none rounded-xl"
                >
                  <option value="holiday">Paid Corporate Holiday</option>
                  <option value="special">Special Work Event</option>
                </select>
              </label>
              <Field
                label="Description"
                value={leaveCalendar.description || ''}
                onChange={(value) => setLeaveCalendar({ ...leaveCalendar, description: value })}
                placeholder="e.g. Office closed for public holiday"
              />
              <FormActions saving={saving} onClose={() => setShowLeaveCalendar(false)} />
            </form>
          </Modal>
        )}

        {/* MODAL 10: Create or Edit Role */}
        {(showCreateRole || editingRole) && (
          <Modal
            title={editingRole ? `Edit Role: ${editingRole.name}` : 'Create Dynamic Custom Role'}
            onClose={() => {
              setShowCreateRole(false);
              setEditingRole(null);
            }}
          >
            <form onSubmit={saveRole} className="space-y-4">
              <Field
                label="Role Name *"
                required
                value={roleForm.name}
                onChange={(value) => {
                  setRoleForm((prev) => ({
                    ...prev,
                    name: value,
                    code: editingRole ? prev.code : value.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_'),
                  }));
                }}
                placeholder="e.g. HR Operations Partner, Tech Lead"
              />

              <div>
                <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">System Slug / Code</span>
                <input
                  value={roleForm.code}
                  disabled={Boolean(editingRole)}
                  onChange={(e) => setRoleForm((prev) => ({ ...prev, code: e.target.value }))}
                  placeholder="e.g. hr_operations_partner"
                  className={`skeuo-inset w-full px-3 py-2.5 text-sm text-[var(--text-primary)] font-mono outline-none rounded-xl ${
                    editingRole ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                />
                <p className="text-[10px] text-[var(--text-muted)] mt-1">Unique identifier used for authorization checks.</p>
              </div>

              <Field
                label="Role Description"
                value={roleForm.description}
                onChange={(value) => setRoleForm((prev) => ({ ...prev, description: value }))}
                placeholder="Responsibilities, scope, and access privileges"
              />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[var(--text-secondary)]">Module Permissions</span>
                  <div className="flex gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={selectAllModules}
                      className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-[var(--text-muted)]">&bull;</span>
                    <button
                      type="button"
                      onClick={clearAllModules}
                      className="text-slate-500 font-bold hover:underline"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {editingRole?.is_system && (
                  <div className="skeuo-card-soft p-3 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2 mb-2 font-medium">
                    <Sparkles className="h-4 w-4 shrink-0" />
                    <span>The Administrator role retains permanent root permissions across all system modules.</span>
                  </div>
                )}

                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                  {modules.map((m) => {
                    const isChecked = roleForm.permissions.includes(m.id) || editingRole?.is_system;
                    return (
                      <div
                        key={m.id}
                        onClick={() => {
                          if (!editingRole?.is_system) {
                            toggleModulePermission(m.id);
                          }
                        }}
                        className={`p-2.5 rounded-xl cursor-pointer transition flex items-start gap-3 select-none ${
                          isChecked
                            ? 'skeuo-card-soft border-indigo-500/40'
                            : 'skeuo-inset opacity-80 hover:opacity-100'
                        }`}
                      >
                        <div className="mt-0.5">
                          {isChecked ? (
                            <CheckSquare className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                          ) : (
                            <Square className="h-4 w-4 text-[var(--text-muted)]" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-[var(--text-primary)]">{m.name}</p>
                          <p className="text-[10px] text-[var(--text-muted)] leading-tight mt-0.5">{m.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <FormActions
                saving={saving}
                onClose={() => {
                  setShowCreateRole(false);
                  setEditingRole(null);
                }}
              />
            </form>
          </Modal>
        )}

        {/* MODAL 11: Delete Role Confirmation */}
        {deletingRole && (
          <Modal title={`Delete Role: ${deletingRole.name}`} onClose={() => setDeletingRole(null)}>
            <div className="space-y-4">
              <div className="skeuo-inset p-4 flex items-start gap-3 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <p className="font-bold">Are you sure you want to remove this role?</p>
                  <p className="text-[var(--text-muted)] mt-1">
                    Any users currently assigned to <strong>{deletingRole.name}</strong> will be safely reassigned to the default Administrator role.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingRole(null)}
                  className="skeuo-btn text-xs font-bold"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteRole}
                  disabled={saving}
                  className="skeuo-btn text-xs font-bold bg-rose-600 text-white hover:bg-rose-700"
                >
                  {saving ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* MODAL 12: Assign Role to User */}
        {showAssignUserModal && (
          <Modal title="Assign Role to Employee" onClose={() => setShowAssignUserModal(false)}>
            <form onSubmit={handleAssignUserRole} className="space-y-4">
              <div>
                <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">Select Employee</span>
                <select
                  value={assignState.userId}
                  onChange={(e) => setAssignState({ ...assignState, userId: e.target.value })}
                  className="skeuo-inset w-full px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none rounded-xl"
                  required
                >
                  <option value="">-- Choose an employee --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.user_id}>
                      {emp.full_name} ({emp.employee_code}) &bull; Current Role: {emp.role?.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">Select Target Role</span>
                <select
                  value={assignState.roleCode}
                  onChange={(e) => setAssignState({ ...assignState, roleCode: e.target.value })}
                  className="skeuo-inset w-full px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none rounded-xl"
                  required
                >
                  {roles.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name} {r.is_system ? '(System Root)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <FormActions saving={saving} onClose={() => setShowAssignUserModal(false)} />
            </form>
          </Modal>
        )}
      </div>
    </AuthGuard>
  );
}

/* ------------------------------------------------------------------ */
/*  Presentational Utilities                                          */
/* ------------------------------------------------------------------ */

function Empty({ text }: { text: string }) {
  return <div className="skeuo-inset p-8 text-center text-xs text-[var(--text-muted)] rounded-xl">{text}</div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="skeuo-card w-full max-w-lg p-6 max-h-[90vh] flex flex-col justify-between">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-black text-[var(--text-primary)]">{title}</h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">Configuration updates take effect immediately across all sessions.</p>
          </div>
          <button onClick={onClose} className="skeuo-btn h-8 w-8 p-0 flex items-center justify-center" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto pr-1">{children}</div>
      </div>
    </div>
  );
}

function FormActions({ saving, onClose }: { saving: boolean; onClose: () => void }) {
  return (
    <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border-soft)]">
      <button type="button" onClick={onClose} className="skeuo-btn text-xs font-bold py-2 px-4">
        Cancel
      </button>
      <button type="submit" disabled={saving} className="skeuo-btn-primary text-xs font-bold py-2 px-5 flex items-center gap-1.5">
        {saving ? 'Saving...' : 'Save Configuration'}
      </button>
    </div>
  );
}
