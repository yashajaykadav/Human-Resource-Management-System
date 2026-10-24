"use client";

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { AuthGuard } from '@/components/auth/AuthGuard';
import {
  User,
  Mail,
  Phone,
  CalendarDays,
  Building,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  DollarSign,
  Wallet,
  Laptop,
  Eye,
  EyeOff,
  X,
  Printer,
  MapPin,
  Briefcase,
  HeartHandshake,
  QrCode,
  ArrowRight,
  ShieldCheck,
  Check,
  Cpu,
  BadgeCheck,
  FileText
} from 'lucide-react';

function formatRole(role?: string | null): string {
  if (!role) return 'Employee';
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not Provided';
  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return value;
  }
}

type ProfileTab = 'overview' | 'assets' | 'compensation';

export default function ProfilePage() {
  const { user, setCopilotOpen } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');

  // Contact form state
  const [phone, setPhone] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [savingContact, setSavingContact] = useState(false);
  const [contactFeedback, setContactFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Live dynamic data streams from real DB APIs
  const [leaveBalances, setLeaveBalances] = useState<any[]>([]);
  const [attendanceToday, setAttendanceToday] = useState<any>(null);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [myAssets, setMyAssets] = useState<any[]>([]);
  const [clockLoading, setClockLoading] = useState(false);

  // UI state
  const [showCompensation, setShowCompensation] = useState(false);
  const [showIdCardModal, setShowIdCardModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    loadProfileData();
  }, [user]);

  const loadProfileData = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch Core Profile
      const empData = await apiRequest('/employees/me');
      setProfile(empData);
      setPhone(empData.phone || '');
      setEmergencyContact(empData.emergency_contact || '');

      // 2. Fetch Live Module Snapshots in parallel
      const [balancesRes, attendanceRes, payslipsRes, assetsRes] = await Promise.allSettled([
        apiRequest('/leaves/balances'),
        apiRequest('/attendance/today'),
        apiRequest('/payroll/my-payslips'),
        apiRequest('/assets/my-assets')
      ]);

      if (balancesRes.status === 'fulfilled') setLeaveBalances(balancesRes.value || []);
      if (attendanceRes.status === 'fulfilled') setAttendanceToday(attendanceRes.value || null);
      if (payslipsRes.status === 'fulfilled') setPayslips(payslipsRes.value || []);
      if (assetsRes.status === 'fulfilled') setMyAssets(assetsRes.value || []);
    } catch (err: any) {
      setError(err.message || 'Unable to load profile data.');
    } finally {
      setLoading(false);
    }
  };

  const handleClockAction = async () => {
    setClockLoading(true);
    try {
      if (attendanceToday?.clocked_in) {
        await apiRequest('/attendance/clock-out', { method: 'POST', body: JSON.stringify({}) });
      } else {
        await apiRequest('/attendance/clock-in', { method: 'POST', body: JSON.stringify({ location: 'Workstation' }) });
      }
      const updated = await apiRequest('/attendance/today');
      setAttendanceToday(updated);
    } catch (err: any) {
      alert(err.message || 'Clock action failed');
    } finally {
      setClockLoading(false);
    }
  };

  const saveContactDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingContact(true);
    setContactFeedback(null);
    try {
      await apiRequest('/employees/me', {
        method: 'PATCH',
        body: JSON.stringify({ phone, emergency_contact: emergencyContact }),
      });
      setProfile((prev: any) => ({ ...prev, phone, emergency_contact: emergencyContact }));
      setContactFeedback({ type: 'success', text: 'Contact details successfully saved to your HR record.' });
    } catch (err: any) {
      setContactFeedback({ type: 'error', text: err.message || 'Failed to update contact details.' });
    } finally {
      setSavingContact(false);
    }
  };

  const tenureText = useMemo(() => {
    if (!profile?.date_of_joining) return 'New Member';
    const joinDate = new Date(profile.date_of_joining);
    const now = new Date();
    const months = (now.getFullYear() - joinDate.getFullYear()) * 12 + (now.getMonth() - joinDate.getMonth());
    if (months < 1) return 'Joined this month';
    const years = Math.floor(months / 12);
    const remMonths = months % 12;
    if (years === 0) return `${months} month${months > 1 ? 's' : ''}`;
    return `${years} yr${years > 1 ? 's' : ''} ${remMonths > 0 ? `${remMonths} mo` : ''}`;
  }, [profile?.date_of_joining]);

  const totalRemainingLeaves = useMemo(() => {
    return leaveBalances.reduce((acc, b) => acc + (b.remaining || 0), 0);
  }, [leaveBalances]);

  const userInitials = useMemo(() => {
    if (!profile) return 'EMP';
    const f = profile.first_name?.[0] || '';
    const l = profile.last_name?.[0] || '';
    return (f + l).toUpperCase() || 'EMP';
  }, [profile]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-4">
        <div className="skeuo-inset h-12 w-12 rounded-full flex items-center justify-center animate-spin text-indigo-600">
          <Clock className="h-6 w-6" />
        </div>
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Loading Employee Profile...
        </p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="skeuo-card p-10 text-center max-w-lg mx-auto space-y-4">
        <div className="skeuo-inset h-12 w-12 rounded-full mx-auto flex items-center justify-center text-rose-500">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-black text-[var(--text-primary)]">Profile Unavailable</h2>
        <p className="text-xs text-[var(--text-muted)]">{error || 'Could not retrieve employee record.'}</p>
        <button onClick={loadProfileData} className="skeuo-btn text-xs font-bold">
          Try Reloading
        </button>
      </div>
    );
  }

  const roleTitle = formatRole(profile.role_name || profile.role);

  return (
    <AuthGuard>
      <div className="space-y-6 pb-12">
        {/* ==============================================================
            HERO WORKSTATION BANNER
            ============================================================== */}
        <div className="skeuo-card overflow-hidden relative border border-[var(--border-soft)]">
          {/* Header Banner */}
          <div className="h-32 sm:h-36 w-full bg-gradient-to-r from-indigo-500/15 via-purple-500/10 to-indigo-500/15 relative border-b border-[var(--border-subtle)]">
            <div className="absolute inset-0 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:16px_16px] opacity-20" />
            
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <span className="skeuo-pill px-3 py-1 text-xs font-bold bg-[var(--bg-surface)]/90 backdrop-blur text-[var(--text-primary)] shadow-xs">
                Emp Code: <span className="font-mono text-indigo-600 dark:text-indigo-400">{profile.employee_code}</span>
              </span>
              <span className="skeuo-pill px-3 py-1 text-xs font-extrabold bg-[var(--bg-surface)]/90 backdrop-blur text-indigo-600 dark:text-indigo-400">
                {roleTitle}
              </span>
            </div>
          </div>

          {/* Profile Header Content */}
          <div className="px-6 pb-6 pt-0 relative">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 -mt-14 sm:-mt-16">
              {/* Avatar + Main Details */}
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5">
                <div className="relative group">
                  <div className="skeuo-card h-28 w-28 sm:h-32 sm:w-32 rounded-3xl p-1.5 flex items-center justify-center bg-[var(--bg-surface)] shadow-2xl border-2 border-[var(--border-soft)]">
                    <div className="skeuo-inset h-full w-full rounded-2xl flex items-center justify-center bg-gradient-to-br from-indigo-500/10 to-purple-500/10">
                      <span className="text-3xl sm:text-4xl font-black text-indigo-600 dark:text-indigo-400 tracking-wider">
                        {userInitials}
                      </span>
                    </div>
                  </div>
                  <span
                    title="Employee active & enrolled"
                    className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-emerald-500 ring-4 ring-[var(--bg-surface)]"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight">
                      {profile.first_name} {profile.last_name}
                    </h1>
                    <span className="skeuo-pill text-[11px] font-bold px-2.5 py-0.5 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      {profile.employment_status?.toUpperCase() || 'ACTIVE'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)] font-medium flex-wrap">
                    <span className="flex items-center gap-1 font-bold text-[var(--text-primary)]">
                      <Briefcase className="h-3.5 w-3.5 text-indigo-500" />
                      {profile.designation_title || 'Designation Unassigned'}
                    </span>
                    <span>&bull;</span>
                    <span className="flex items-center gap-1">
                      <Building className="h-3.5 w-3.5 text-slate-400" />
                      {profile.department_name || 'Department Unassigned'}
                    </span>
                    {profile.manager_name && (
                      <>
                        <span>&bull;</span>
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5 text-indigo-400" />
                          Lead: <strong className="text-[var(--text-primary)]">{profile.manager_name}</strong>
                        </span>
                      </>
                    )}
                  </div>

                  <p className="text-xs text-[var(--text-muted)] font-mono flex items-center gap-2 pt-0.5">
                    <Mail className="h-3 w-3" />
                    <span>{profile.email}</span>
                  </p>
                </div>
              </div>

              {/* Action Buttons Toolbar */}
              <div className="flex flex-wrap items-center gap-2.5 pt-2 lg:pt-0">
                <button
                  onClick={() => setShowIdCardModal(true)}
                  className="skeuo-btn text-xs py-2 px-3.5 text-[var(--text-primary)] hover:text-indigo-600 dark:hover:text-indigo-400 font-bold flex items-center gap-1.5"
                >
                  <QrCode className="h-4 w-4 text-indigo-500" />
                  <span>Digital ID</span>
                </button>

                <button
                  onClick={handleClockAction}
                  disabled={clockLoading}
                  className={`text-xs py-2 px-3.5 font-bold transition-all flex items-center gap-1.5 ${
                    attendanceToday?.clocked_in ? 'skeuo-btn-danger' : 'skeuo-btn-success'
                  }`}
                >
                  <Clock className="h-4 w-4" />
                  <span>
                    {clockLoading
                      ? 'Updating...'
                      : attendanceToday?.clocked_in
                      ? 'Clock Out'
                      : 'Clock In'}
                  </span>
                </button>

                <button
                  onClick={() => setCopilotOpen(true)}
                  className="skeuo-btn-primary text-xs py-2 px-3.5 font-bold flex items-center gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                  <span>AI Copilot</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ==============================================================
            KEY REAL-TIME METRICS
            ============================================================== */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Gauge 1: Tenure */}
          <div className="skeuo-card p-4 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-indigo-500" />
              Company Tenure
            </span>
            <p className="text-lg font-black text-[var(--text-primary)]">{tenureText}</p>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Joined {formatDate(profile.date_of_joining)}
            </p>
          </div>

          {/* Gauge 2: Leave Quota */}
          <Link href="/leaves" className="skeuo-card p-4 space-y-1 hover:border-indigo-500/30 transition group">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                <HeartHandshake className="h-3.5 w-3.5 text-emerald-500" />
                Available Leaves
              </span>
              <ArrowRight className="h-3 w-3 text-[var(--text-muted)] group-hover:text-indigo-500 transition" />
            </div>
            <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">
              {totalRemainingLeaves} Days
            </p>
            <p className="text-[11px] text-[var(--text-secondary)]">Manage in Leaves Hub</p>
          </Link>

          {/* Gauge 3: Today's Shift */}
          <Link href="/attendance" className="skeuo-card p-4 space-y-1 hover:border-indigo-500/30 transition group">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                Today's Status
              </span>
              <ArrowRight className="h-3 w-3 text-[var(--text-muted)] group-hover:text-indigo-500 transition" />
            </div>
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${attendanceToday?.clocked_in ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              <p className="text-lg font-black text-[var(--text-primary)]">
                {attendanceToday?.clocked_in ? 'Clocked In' : 'Not Clocked In'}
              </p>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">
              {attendanceToday?.check_in
                ? `In at ${new Date(attendanceToday.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Timesheet records'}
            </p>
          </Link>

          {/* Gauge 4: Annual Compensation */}
          <div className="skeuo-card p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5 text-purple-500" />
                Annual Package
              </span>
              <button
                onClick={() => setShowCompensation(!showCompensation)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
                title={showCompensation ? 'Hide CTC' : 'Show CTC'}
              >
                {showCompensation ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="text-lg font-black text-[var(--text-primary)] font-mono">
              {showCompensation
                ? typeof profile.annual_ctc === 'number'
                  ? `$${profile.annual_ctc.toLocaleString()}`
                  : '—'
                : '••••••••••'}
            </p>
            <p className="text-[11px] text-[var(--text-secondary)]">
              {showCompensation ? 'Base CTC' : 'Confidential'}
            </p>
          </div>
        </div>

        {/* ==============================================================
            NAVIGATION TABS
            ============================================================== */}
        <div className="skeuo-card-soft p-1.5 flex items-center gap-1 overflow-x-auto scrollbar-none">
          <TabButton
            active={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
            icon={<User className="h-4 w-4" />}
            label="Overview & Organization"
          />
          <TabButton
            active={activeTab === 'assets'}
            onClick={() => setActiveTab('assets')}
            icon={<Laptop className="h-4 w-4" />}
            label={`Assigned Assets (${myAssets.length})`}
          />
          <TabButton
            active={activeTab === 'compensation'}
            onClick={() => setActiveTab('compensation')}
            icon={<DollarSign className="h-4 w-4" />}
            label="Compensation & Banking"
          />
        </div>

        {/* ==============================================================
            TAB 1: OVERVIEW & ORGANIZATION
            ============================================================== */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Personal Details */}
              <div className="skeuo-card p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="skeuo-inset flex h-10 w-10 items-center justify-center text-indigo-600 dark:text-indigo-400">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-extrabold text-[var(--text-primary)]">Personal Details</h2>
                      <p className="text-xs text-[var(--text-muted)]">Verified HR Identity Record</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <DetailItem label="Full Legal Name" value={`${profile.first_name} ${profile.last_name}`} />
                  <DetailItem label="Employee Code" value={profile.employee_code} />
                  <DetailItem label="Work Email" value={profile.email} icon={<Mail className="h-3.5 w-3.5 text-indigo-500" />} />
                  <DetailItem label="Personal Phone" value={profile.phone || 'Not Provided'} icon={<Phone className="h-3.5 w-3.5 text-emerald-500" />} />
                  <DetailItem label="Date of Birth" value={formatDate(profile.date_of_birth)} />
                  <DetailItem label="Emergency Contact" value={profile.emergency_contact || 'None registered'} />
                </div>
              </div>

              {/* Organizational Placement */}
              <div className="skeuo-card p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="skeuo-inset flex h-10 w-10 items-center justify-center text-emerald-600 dark:text-emerald-400">
                      <Building className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-extrabold text-[var(--text-primary)]">Organizational Placement</h2>
                      <p className="text-xs text-[var(--text-muted)]">Department, Reporting Line &amp; Title</p>
                    </div>
                  </div>
                  <Link href="/organization" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
                    <span>Org Structure</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <DetailItem label="Department" value={profile.department_name || 'General'} />
                  <DetailItem label="Official Designation" value={profile.designation_title || 'Staff'} />
                  <DetailItem
                    label="Reporting Manager"
                    value={profile.manager_name || 'Direct Leadership'}
                    highlight={Boolean(profile.manager_name)}
                  />
                  <DetailItem label="Employment Status" value={profile.employment_status?.toUpperCase() || 'ACTIVE'} />
                  <DetailItem label="Joining Date" value={formatDate(profile.date_of_joining)} icon={<CalendarDays className="h-3.5 w-3.5 text-indigo-500" />} />
                  <DetailItem label="Access Role" value={roleTitle} />
                </div>
              </div>
            </div>

            {/* Self-Service Contact Form */}
            <div className="space-y-6">
              <form onSubmit={saveContactDetails} className="skeuo-card p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="skeuo-inset flex h-10 w-10 items-center justify-center text-amber-600 dark:text-amber-400">
                    <Phone className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-extrabold text-[var(--text-primary)]">Update Contacts</h2>
                    <p className="text-xs text-[var(--text-muted)]">Self-service editable information</p>
                  </div>
                </div>

                {contactFeedback && (
                  <div
                    className={`skeuo-inset mb-4 p-3 text-xs font-bold flex items-center gap-2 ${
                      contactFeedback.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'
                    }`}
                  >
                    {contactFeedback.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    <span>{contactFeedback.text}</span>
                  </div>
                )}

                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">Direct Phone</span>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="skeuo-inset w-full px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">Emergency Contact &amp; Phone</span>
                    <input
                      type="text"
                      value={emergencyContact}
                      onChange={(e) => setEmergencyContact(e.target.value)}
                      placeholder="e.g., Jane Doe (Spouse) +1-555-0199"
                      className="skeuo-inset w-full px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={savingContact}
                    className="skeuo-btn-primary w-full text-xs py-2.5 font-bold shadow-md flex items-center justify-center gap-1.5"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{savingContact ? 'Saving...' : 'Save Contact Details'}</span>
                  </button>
                </div>
              </form>

              {/* Quick Links Card */}
              <div className="skeuo-card p-6 space-y-3">
                <h3 className="font-extrabold text-sm text-[var(--text-primary)]">Workstation Portals</h3>
                <div className="space-y-2 text-xs">
                  <Link
                    href="/leaves"
                    className="skeuo-card-soft p-3 flex items-center justify-between hover:text-indigo-600 transition"
                  >
                    <span className="flex items-center gap-2 font-bold">
                      <HeartHandshake className="h-4 w-4 text-emerald-500" />
                      <span>Leaves &amp; PTO Ledger</span>
                    </span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>

                  <Link
                    href="/attendance"
                    className="skeuo-card-soft p-3 flex items-center justify-between hover:text-indigo-600 transition"
                  >
                    <span className="flex items-center gap-2 font-bold">
                      <Clock className="h-4 w-4 text-amber-500" />
                      <span>Attendance &amp; Timesheets</span>
                    </span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>

                  <Link
                    href="/payroll"
                    className="skeuo-card-soft p-3 flex items-center justify-between hover:text-indigo-600 transition"
                  >
                    <span className="flex items-center gap-2 font-bold">
                      <FileText className="h-4 w-4 text-purple-500" />
                      <span>Payslips &amp; Tax Documents</span>
                    </span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==============================================================
            TAB 2: REAL ASSIGNED ASSETS (Live DB)
            ============================================================== */}
        {activeTab === 'assets' && (
          <div className="space-y-6">
            <div className="skeuo-card p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="skeuo-inset flex h-10 w-10 items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <Laptop className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-extrabold text-[var(--text-primary)]">Assigned IT Equipment &amp; Assets</h2>
                    <p className="text-xs text-[var(--text-muted)]">Official hardware &amp; equipment registered to your employee profile</p>
                  </div>
                </div>

                <Link
                  href="/assets"
                  className="skeuo-btn text-xs py-2 px-3.5 font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <Laptop className="h-3.5 w-3.5" />
                  <span>Request / Manage Assets</span>
                </Link>
              </div>

              {myAssets.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myAssets.map((asset) => (
                    <div key={asset.id} className="skeuo-card-soft p-4 space-y-2 border border-[var(--border-subtle)]">
                      <div className="flex items-center justify-between">
                        <span className="skeuo-pill font-mono text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                          {asset.asset_tag}
                        </span>
                        <span className="skeuo-pill text-[10px] text-emerald-600 capitalize font-bold">
                          {asset.condition || 'Good'} Condition
                        </span>
                      </div>

                      <div>
                        <h4 className="font-extrabold text-sm text-[var(--text-primary)]">
                          {asset.name}
                        </h4>
                        <p className="text-xs text-[var(--text-secondary)] font-medium">
                          {asset.manufacturer} {asset.model_number ? `• Model ${asset.model_number}` : ''}
                        </p>
                      </div>

                      {asset.specifications && (
                        <p className="text-[11px] text-[var(--text-muted)] bg-[var(--bg-canvas)] p-2 rounded-lg font-mono">
                          {asset.specifications}
                        </p>
                      )}

                      <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                        <span>Serial: <strong className="font-mono text-[var(--text-primary)]">{asset.serial_number || '—'}</strong></span>
                        <span>Assigned: {formatDate(asset.assigned_date)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="skeuo-inset p-8 text-center text-xs text-[var(--text-muted)] space-y-2">
                  <Laptop className="h-8 w-8 mx-auto text-slate-400" />
                  <p className="font-bold text-[var(--text-primary)]">No assets currently assigned</p>
                  <p>You can request hardware, laptops, or workstation peripherals via the Asset Hub.</p>
                  <div className="pt-2">
                    <Link href="/assets" className="skeuo-btn-primary text-xs py-1.5 px-3 font-bold inline-flex">
                      Submit Asset Request
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==============================================================
            TAB 3: COMPENSATION & BANKING (Live DB)
            ============================================================== */}
        {activeTab === 'compensation' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Compensation Summary */}
              <div className="skeuo-card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="skeuo-inset flex h-10 w-10 items-center justify-center text-purple-600 dark:text-purple-400">
                      <DollarSign className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-[var(--text-primary)]">Compensation Overview</h3>
                      <p className="text-xs text-[var(--text-muted)]">Salary structure from employee record</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCompensation(!showCompensation)}
                    className="skeuo-btn text-xs py-1.5 px-3 flex items-center gap-1.5"
                  >
                    {showCompensation ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    <span>{showCompensation ? 'Hide' : 'Reveal'}</span>
                  </button>
                </div>

                <div className="skeuo-inset p-5 rounded-xl text-center space-y-1">
                  <p className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">
                    Annual Base Cost to Company (CTC)
                  </p>
                  <p className="text-3xl font-black text-[var(--text-primary)] font-mono">
                    {showCompensation
                      ? typeof profile.annual_ctc === 'number'
                        ? `$${profile.annual_ctc.toLocaleString()}`
                        : '—'
                      : '••••••••••••'}
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                    100% Fixed Base &bull; Disbursed Monthly
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-2 border-b border-[var(--border-subtle)]">
                    <span className="text-[var(--text-muted)] font-medium">Estimated Monthly Gross</span>
                    <span className="font-bold font-mono text-[var(--text-primary)]">
                      {showCompensation && typeof profile.annual_ctc === 'number'
                        ? `$${Math.round(profile.annual_ctc / 12).toLocaleString()}`
                        : '••••••'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-[var(--text-muted)] font-medium">Payment Frequency</span>
                    <span className="font-bold text-[var(--text-primary)]">Monthly</span>
                  </div>
                </div>

                <div className="pt-2">
                  <Link href="/payroll" className="skeuo-btn w-full text-xs py-2 text-center font-bold flex items-center justify-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    <span>View Payslips in Payroll Portal</span>
                  </Link>
                </div>
              </div>

              {/* Direct Deposit & Banking */}
              <div className="skeuo-card p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="skeuo-inset flex h-10 w-10 items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-[var(--text-primary)]">Direct Deposit &amp; Banking</h3>
                    <p className="text-xs text-[var(--text-muted)]">Official bank details registered on file</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 text-sm">
                  <DetailItem label="Bank Name" value={profile.bank_name || 'Not Registered'} />
                  <DetailItem
                    label="Bank Account Number"
                    value={
                      profile.bank_account_number
                        ? showCompensation
                          ? profile.bank_account_number
                          : `•••• •••• •••• ${profile.bank_account_number.slice(-4)}`
                        : 'On File with Finance'
                    }
                  />
                  <DetailItem
                    label="Tax Identifier"
                    value={profile.tax_identifier || 'On File with HR'}
                  />
                </div>

                <div className="skeuo-card-soft p-3 text-xs text-[var(--text-muted)]">
                  To update banking details or tax withholding declarations, submit an inquiry to the Finance department or via the AI Copilot.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==============================================================
            DIGITAL ID CARD MODAL (Clean, accurate, printable)
            ============================================================== */}
        {showIdCardModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="skeuo-card max-w-sm w-full p-6 relative border border-[var(--border-soft)] shadow-2xl space-y-6">
              <button
                onClick={() => setShowIdCardModal(false)}
                className="absolute top-4 right-4 skeuo-btn h-8 w-8 p-0 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="skeuo-inset p-5 rounded-2xl relative overflow-hidden bg-gradient-to-br from-[var(--bg-surface-elevated)] to-[var(--bg-surface)] border border-[var(--border-soft)]">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                  <div className="flex items-center gap-2">
                    <div className="skeuo-pill p-1 text-indigo-600">
                      <Cpu className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-black text-xs tracking-tight text-[var(--text-primary)]">APRYDE HRMS</p>
                      <p className="text-[9px] uppercase tracking-widest text-[var(--text-muted)]">Employee Credential</p>
                    </div>
                  </div>
                  <span className="skeuo-pill px-2 py-0.5 text-[9px] font-mono text-emerald-600 font-bold">
                    ACTIVE
                  </span>
                </div>

                {/* Avatar & Photo Well */}
                <div className="my-5 flex flex-col items-center text-center space-y-2">
                  <div className="skeuo-card h-20 w-20 rounded-2xl flex items-center justify-center font-black text-2xl text-indigo-600 shadow-md">
                    {userInitials}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-base text-[var(--text-primary)]">
                      {profile.first_name} {profile.last_name}
                    </h4>
                    <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                      {profile.designation_title || 'Staff'}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)]">{profile.department_name || 'General'}</p>
                  </div>
                </div>

                {/* Badge Meta */}
                <div className="grid grid-cols-2 gap-2 text-[10px] border-t border-[var(--border-subtle)] pt-3 font-mono">
                  <div>
                    <span className="text-[var(--text-muted)] block">EMPLOYEE ID</span>
                    <span className="font-bold text-[var(--text-primary)]">{profile.employee_code}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[var(--text-muted)] block">ROLE TIER</span>
                    <span className="font-bold text-indigo-600">{roleTitle}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="skeuo-btn flex-1 text-xs py-2 font-bold flex items-center justify-center gap-1.5"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print Badge</span>
                </button>
                <button
                  onClick={() => setShowIdCardModal(false)}
                  className="skeuo-btn-primary flex-1 text-xs py-2 font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all whitespace-nowrap ${
        active
          ? 'skeuo-inset text-indigo-600 dark:text-indigo-400 font-extrabold shadow-inner'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)]'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function DetailItem({
  label,
  value,
  icon,
  highlight
}: {
  label: string;
  value: string | null | undefined;
  icon?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="skeuo-inset p-3 rounded-xl flex flex-col justify-between">
      <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </span>
      <span
        className={`flex items-center gap-1.5 text-xs font-bold mt-1 ${
          highlight ? 'text-indigo-600 dark:text-indigo-400' : 'text-[var(--text-primary)]'
        }`}
      >
        {icon}
        <span className="truncate">{value || '—'}</span>
      </span>
    </div>
  );
}
