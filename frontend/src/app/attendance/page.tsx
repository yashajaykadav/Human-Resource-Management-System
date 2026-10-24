"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock,
  Calendar,
  CalendarOff,
  Users,
  ChevronLeft,
  ChevronRight,
  Play,
  Square,
  BarChart,
  List,
  Sparkles,
  MapPin,
  X,
  CheckCircle2,
  CalendarDays,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { AuthGuard } from '@/components/auth/AuthGuard';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isWeekend,
  parseISO,
} from 'date-fns';

/* ------------------------------------------------------------------ */
/*  Types & constants                                                  */
/* ------------------------------------------------------------------ */

type ViewMode = 'calendar' | 'list';

const STATUS_CARD_STYLES: Record<
  string,
  {
    cardBg: string;
    border: string;
    badgeBg: string;
    badgeText: string;
    label: string;
    short: string;
  }
> = {
  present: {
    cardBg: 'bg-emerald-500/15 hover:bg-emerald-500/25 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60',
    border: 'border-emerald-500/40 dark:border-emerald-500/50',
    badgeBg: 'bg-emerald-500/30 dark:bg-emerald-500/35',
    badgeText: 'text-emerald-800 dark:text-emerald-200',
    label: 'Present',
    short: 'P',
  },
  late: {
    cardBg: 'bg-amber-500/15 hover:bg-amber-500/25 dark:bg-amber-950/40 dark:hover:bg-amber-950/60',
    border: 'border-amber-500/40 dark:border-amber-500/50',
    badgeBg: 'bg-amber-500/30 dark:bg-amber-500/35',
    badgeText: 'text-amber-800 dark:text-amber-200',
    label: 'Late',
    short: 'L',
  },
  half_day: {
    cardBg: 'bg-sky-500/15 hover:bg-sky-500/25 dark:bg-sky-950/40 dark:hover:bg-sky-950/60',
    border: 'border-sky-500/40 dark:border-sky-500/50',
    badgeBg: 'bg-sky-500/30 dark:bg-sky-500/35',
    badgeText: 'text-sky-800 dark:text-sky-200',
    label: 'Half Day',
    short: '½',
  },
  on_leave: {
    cardBg: 'bg-purple-500/15 hover:bg-purple-500/25 dark:bg-purple-950/40 dark:hover:bg-purple-950/60',
    border: 'border-purple-500/40 dark:border-purple-500/50',
    badgeBg: 'bg-purple-500/30 dark:bg-purple-500/35',
    badgeText: 'text-purple-800 dark:text-purple-200',
    label: 'On Leave',
    short: 'LV',
  },
  absent: {
    cardBg: 'bg-rose-500/15 hover:bg-rose-500/25 dark:bg-rose-950/40 dark:hover:bg-rose-950/60',
    border: 'border-rose-500/40 dark:border-rose-500/50',
    badgeBg: 'bg-rose-500/30 dark:bg-rose-500/35',
    badgeText: 'text-rose-800 dark:text-rose-200',
    label: 'Absent',
    short: 'A',
  },
  weekend: {
    cardBg: 'bg-[var(--bg-canvas)]/70 hover:bg-[var(--bg-canvas)]',
    border: 'border-[var(--border-subtle)]',
    badgeBg: 'bg-slate-500/15',
    badgeText: 'text-slate-500 dark:text-slate-400',
    label: 'Weekend',
    short: '—',
  },
  holiday: {
    cardBg: 'bg-fuchsia-500/15 hover:bg-fuchsia-500/25 dark:bg-fuchsia-950/40 dark:hover:bg-fuchsia-950/60',
    border: 'border-fuchsia-500/40 dark:border-fuchsia-500/50',
    badgeBg: 'bg-fuchsia-500/30 dark:bg-fuchsia-500/35',
    badgeText: 'text-fuchsia-800 dark:text-fuchsia-200',
    label: 'Holiday',
    short: 'H',
  },
  upcoming: {
    cardBg: 'bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)]',
    border: 'border-[var(--border-subtle)]',
    badgeBg: 'bg-slate-500/10',
    badgeText: 'text-slate-400',
    label: 'Upcoming',
    short: '·',
  },
};

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function parseCheckInTime(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const hasTimezone = iso.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(iso);
  const normalized = hasTimezone ? iso : `${iso}Z`;
  const date = new Date(normalized);
  return isNaN(date.getTime()) ? new Date(iso) : date;
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = parseCheckInTime(iso);
    if (!d || isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

/** Local-date key — NEVER use toISOString().slice(0,10) for date keys. */
function localDateKey(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AttendancePage() {
  const { user, isAdmin, hasPermission, setCopilotOpen } = useAuth();
  const canViewOthers =
    isAdmin ||
    hasPermission('attendance');

  const [todayStatus, setTodayStatus] = useState<any>(null);
  const [liveElapsed, setLiveElapsed] = useState<string>('00:00:00');
  const [teamRoster, setTeamRoster] = useState<any[]>([]);
  const [viewableEmployees, setViewableEmployees] = useState<any[]>([]);
  const [viewedEmployeeId, setViewedEmployeeId] = useState<string | null>(null);
  const [viewedEmployee, setViewedEmployee] = useState<any>(null);
  const [attendanceData, setAttendanceData] = useState<any>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [calendarViewDate, setCalendarViewDate] = useState<Date>(new Date());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [dayDetail, setDayDetail] = useState<any>(null);
  const [rosterDate, setRosterDate] = useState<Date>(new Date());
  const [confirmClockOut, setConfirmClockOut] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isViewingSelf = !viewedEmployeeId;

  const historyUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (viewedEmployeeId) params.set('employee_id', viewedEmployeeId);
    params.set('mode', 'month');
    params.set('month', String(calendarViewDate.getMonth() + 1));
    params.set('year', String(calendarViewDate.getFullYear()));
    return `/attendance/history?${params.toString()}`;
  }, [viewedEmployeeId, calendarViewDate]);

  /* --------------------------- Data fetching --------------------------- */

  const fetchToday = useCallback(async () => {
    if (!user) return;
    try {
      const data = await apiRequest('/attendance/today');
      setTodayStatus(data);
    } catch (err) {
      console.error('Failed to fetch today attendance:', err);
    }
  }, [user]);

  const fetchTeamRoster = useCallback(
    async (targetDate?: Date) => {
      if (!user || !canViewOthers) return;
      try {
        const params = new URLSearchParams();
        params.set('include_self', 'true');
        // FIX: local date key, not UTC slice
        if (targetDate) params.set('target_date', localDateKey(targetDate));
        const data = await apiRequest(`/attendance/team?${params.toString()}`);
        setTeamRoster(data || []);
        setViewableEmployees(data || []);
      } catch (err) {
        console.error('Failed to fetch team roster:', err);
      }
    },
    [user, canViewOthers]
  );

  const fetchAttendanceHistory = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await apiRequest(historyUrl);
      setAttendanceData(data);
      if (data?.employee) setViewedEmployee(data.employee);
    } catch (err) {
      console.error('Failed to fetch attendance history:', err);
      setAttendanceData(null);
    } finally {
      setLoading(false);
    }
  }, [user, historyUrl]);

  /* --------------------------- Effects --------------------------- */

  // Live elapsed timer
  useEffect(() => {
    if (!todayStatus?.clocked_in || !todayStatus?.check_in) {
      setLiveElapsed('00:00:00');
      return;
    }
    const calculateElapsed = () => {
      const checkInDate = parseCheckInTime(todayStatus.check_in);
      if (!checkInDate) return;
      const diffMs = Math.max(0, Date.now() - checkInDate.getTime());
      const totalSeconds = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      setLiveElapsed(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      );
    };
    calculateElapsed();
    const interval = setInterval(calculateElapsed, 1000);
    return () => clearInterval(interval);
  }, [todayStatus?.clocked_in, todayStatus?.check_in]);

  // Initial + roster date
  useEffect(() => {
    if (user) {
      fetchToday();
      if (canViewOthers) fetchTeamRoster(rosterDate);
    }
  }, [user, fetchToday, canViewOthers, fetchTeamRoster, rosterDate]);

  // History (refetches when month or viewed employee changes)
  useEffect(() => {
    if (user) fetchAttendanceHistory();
  }, [historyUrl, user, fetchAttendanceHistory]);

  // FIX: reset the filter when switching views so it can't reference a
  // status that doesn't exist in the current view's pill list.
  useEffect(() => {
    setStatusFilter('all');
  }, [viewMode]);

  // Close modal on Escape
  useEffect(() => {
    if (!dayDetail && !confirmClockOut) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDayDetail(null);
        setConfirmClockOut(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dayDetail, confirmClockOut]);

  /* --------------------------- Actions --------------------------- */

  const runClockAction = async (action: 'in' | 'out') => {
    setActionLoading(true);
    setActionError(null);
    try {
      await apiRequest(`/attendance/clock-${action}`, {
        method: 'POST',
        body: JSON.stringify({ location: 'HQ / Remote Workstation' }),
      });
      await fetchToday();
      await fetchAttendanceHistory();
    } catch (err: any) {
      setActionError(err?.message || `Failed to clock ${action}. Please try again.`);
    } finally {
      setActionLoading(false);
      setConfirmClockOut(false);
    }
  };

  const handleClockIn = () => runClockAction('in');
  const handleClockOutConfirmed = () => runClockAction('out');

  const handleSelectEmployee = (empId: string) => {
    if (!empId) {
      setViewedEmployeeId(null);
      setViewedEmployee(null);
    } else {
      setViewedEmployeeId(empId);
      const matched = viewableEmployees.find((e) => e.employee_id === empId);
      if (matched) setViewedEmployee(matched);
    }
    setCalendarViewDate(new Date());
    setStatusFilter('all');
    setDayDetail(null);
  };

  /* --------------------------- Derived data --------------------------- */

  const recordsByDate = useMemo(() => {
    const map: Record<string, any> = {};
    (attendanceData?.records || []).forEach((r: any) => {
      map[r.date] = r;
    });
    return map;
  }, [attendanceData]);

  const listPresentRecords = useMemo(() => {
    const allRecords = attendanceData?.records || [];
    return allRecords.filter((r: any) => {
      const isPresent =
        r.status === 'present' ||
        r.status === 'late' ||
        r.status === 'half_day' ||
        (typeof r.total_hours === 'number' && r.total_hours > 0) ||
        Boolean(r.check_in);
      if (!isPresent) return false;
      if (statusFilter !== 'all') return r.status === statusFilter;
      return true;
    });
  }, [attendanceData, statusFilter]);

  const summary = attendanceData?.summary || {};
  const currentViewedName = isViewingSelf
    ? 'My Personal Timesheet'
    : viewedEmployee
    ? `${viewedEmployee.name} (${viewedEmployee.department || 'Staff'})`
    : 'Team Member Timesheet';

  /* --------------------------- Calendar grid --------------------------- */

  const calendarGridDays = useMemo(() => {
    const monthStart = startOfMonth(calendarViewDate);
    const monthEnd = endOfMonth(calendarViewDate);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const today = new Date();
    const firstDayIndex = monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1;
    const paddedDays: (Date | null)[] = [];

    for (let i = 0; i < firstDayIndex; i++) paddedDays.push(null);
    days.forEach((d) => paddedDays.push(d));
    const trailing = 7 - (paddedDays.length % 7);
    if (trailing && trailing < 7) {
      for (let i = 0; i < trailing; i++) paddedDays.push(null);
    }

    return paddedDays.map((day, idx) => {
      if (!day) {
        return (
          <div
            key={idx}
            aria-hidden="true"
            className="min-h-[85px] sm:min-h-[105px] rounded-2xl opacity-0"
          />
        );
      }

      // FIX: local date key — do NOT use toISOString().slice(0,10)
      const dateStr = localDateKey(day);
      const rec = recordsByDate[dateStr];
      const isToday = isSameDay(day, today);
      const isCurrentMonth = isSameMonth(day, calendarViewDate);
      const isPastOrToday = day <= today;
      const status = rec
        ? rec.status
        : isWeekend(day)
        ? 'weekend'
        : isPastOrToday
        ? 'absent'
        : 'upcoming';
      const cardStyle = STATUS_CARD_STYLES[status] || STATUS_CARD_STYLES.absent;
      const isFilteredOut = statusFilter !== 'all' && status !== statusFilter;

      const cellClass = [
        'min-h-[85px] sm:min-h-[105px] rounded-2xl p-2 sm:p-2.5 flex flex-col justify-between transition-all duration-150 border text-left',
        cardStyle.cardBg,
        cardStyle.border,
        isToday
          ? 'ring-2 ring-indigo-500 shadow-md font-black scale-[1.02]'
          : 'shadow-sm',
        !isCurrentMonth ? 'opacity-25' : '',
        // FIX: dim less aggressively (was 20% — invisible)
        isFilteredOut ? 'opacity-40' : '',
        // Affordance: only interactive cells get hover + pointer
        rec
          ? 'cursor-pointer hover:scale-[1.02] hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500'
          : 'cursor-default',
      ]
        .filter(Boolean)
        .join(' ');

      const inner = (
        <>
          <div className="flex items-center justify-between w-full gap-1">
            <span
              className={`text-sm sm:text-base font-black ${
                isToday
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-[var(--text-primary)]'
              }`}
            >
              {day.getDate()}
            </span>
            {isToday && (
              // FIX: py-0.2 was invalid Tailwind; use py-0.5
              <span className="skeuo-pill px-1.5 py-0.5 text-[9px] font-black bg-indigo-500 text-white tracking-wider whitespace-nowrap">
                TODAY
              </span>
            )}
          </div>

          <div className="w-full my-1">
            {/* FIX: icon/short label conveys status without relying on color alone */}
            <span
              className={`px-1.5 py-0.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wide inline-flex items-center justify-center gap-1 w-full text-center truncate ${cardStyle.badgeBg} ${cardStyle.badgeText}`}
              title={cardStyle.label}
            >
              <span aria-hidden="true" className="hidden sm:inline opacity-80">
                {cardStyle.short}
              </span>
              <span className="truncate">{cardStyle.label}</span>
            </span>
          </div>

          <div className="w-full flex items-center justify-between text-[10px] font-mono gap-1">
            {rec && rec.total_hours > 0 ? (
              <span className="font-extrabold text-[var(--text-primary)]">
                {rec.total_hours}h
              </span>
            ) : (
              <span className="text-[var(--text-muted)] text-[9px]">
                {status === 'weekend' ? 'Off' : '—'}
              </span>
            )}
            {rec?.check_in && (
              <span className="text-[var(--text-muted)] text-[9px] hidden sm:inline">
                {formatTime(rec.check_in)}
              </span>
            )}
          </div>
        </>
      );

      // FIX: use <button> only when there is something to open, so keyboard
      // users can reach it and the affordance is honest.
      if (rec) {
        return (
          <button
            type="button"
            key={idx}
            onClick={() => setDayDetail(rec)}
            className={cellClass}
            aria-label={`${format(day, 'EEEE, MMMM d')} — ${cardStyle.label}${
              rec.total_hours ? `, ${rec.total_hours} hours` : ''
            }`}
          >
            {inner}
          </button>
        );
      }

      return (
        <div key={idx} className={cellClass} aria-label={`${format(day, 'EEEE, MMMM d')} — ${cardStyle.label}`}>
          {inner}
        </div>
      );
    });
  }, [calendarViewDate, recordsByDate, statusFilter]);

  /* --------------------------- Render --------------------------- */

  return (
    <AuthGuard module="attendance">
      <div className="space-y-6 pb-12">
        {/* ======================= HEADER ======================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
              Attendance &amp; Timesheets
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Daily clock-in/out, monthly timesheets, and team presence.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {canViewOthers && (
              <div className="flex items-center gap-2">
                <label htmlFor="view-employee" className="text-xs font-bold text-[var(--text-muted)] hidden md:inline">
                  Viewing:
                </label>
                <select
                  id="view-employee"
                  value={viewedEmployeeId || ''}
                  onChange={(e) => handleSelectEmployee(e.target.value)}
                  className="skeuo-inset px-3 py-2 text-xs font-bold text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-xl max-w-[220px]"
                >
                  <option value="">👤 My Attendance (Self)</option>
                  {viewableEmployees.map((emp) => (
                    <option key={emp.employee_id} value={emp.employee_id}>
                      {emp.name} ({emp.department || 'Staff'})
                    </option>
                  ))}
                </select>

                {!isViewingSelf && (
                  <button
                    onClick={() => handleSelectEmployee('')}
                    className="skeuo-btn text-xs py-2 px-2.5 font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1"
                    aria-label="Switch back to my attendance"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Self</span>
                  </button>
                )}
              </div>
            )}

            <button
              onClick={() => setCopilotOpen(true)}
              className="skeuo-btn text-xs py-2 px-3.5 text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>Copilot</span>
            </button>
          </div>
        </div>

        {/* ======================= CHRONO TERMINAL ======================= */}
        <div className="skeuo-card p-6 md:p-8 border border-[var(--border-soft)]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-indigo-500" />
                  TODAY&apos;S SESSION &bull; {format(new Date(), 'EEEE, MMMM d, yyyy')}
                </span>
              </div>

              <div className="mt-2 flex items-baseline gap-4 flex-wrap">
                <span className="font-mono text-4xl sm:text-5xl font-black text-[var(--text-primary)] tracking-tight tabular-nums">
                  {todayStatus?.clocked_in
                    ? liveElapsed
                    : todayStatus?.total_hours
                    ? `${Number(todayStatus.total_hours).toFixed(2)} hrs`
                    : '0.00 hrs'}
                </span>
                <span
                  className={`skeuo-pill px-3 py-1 text-xs font-bold flex items-center gap-1.5 ${
                    todayStatus?.clocked_in
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-500'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      todayStatus?.clocked_in ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                    }`}
                    aria-hidden="true"
                  />
                  {todayStatus?.clocked_in ? 'Session Active' : 'Not Clocked In'}
                </span>
              </div>

              <p className="mt-2 text-xs text-[var(--text-muted)] flex items-center gap-1.5 font-medium">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                <span>Standard Shift: 9:00 AM &ndash; 6:00 PM (HQ / Flexible Remote)</span>
              </p>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <button
                onClick={handleClockIn}
                disabled={actionLoading || todayStatus?.clocked_in}
                className="skeuo-btn-success flex-1 md:flex-none px-6 py-3 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed disabled:saturate-50 flex items-center justify-center gap-2 shadow-md"
              >
                <Play className="h-4 w-4" />
                <span>{actionLoading && !todayStatus?.clocked_in ? 'Clocking in…' : 'Clock In'}</span>
              </button>

              <button
                onClick={() => setConfirmClockOut(true)}
                disabled={actionLoading || !todayStatus?.clocked_in}
                className="skeuo-btn-danger flex-1 md:flex-none px-6 py-3 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed disabled:saturate-50 flex items-center justify-center gap-2 shadow-md"
              >
                <Square className="h-4 w-4" />
                <span>{actionLoading && todayStatus?.clocked_in ? 'Clocking out…' : 'Clock Out'}</span>
              </button>
            </div>
          </div>

          {actionError && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="font-medium">{actionError}</span>
              <button
                onClick={() => setActionError(null)}
                className="ml-auto text-rose-600/70 hover:text-rose-600"
                aria-label="Dismiss error"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5 border-t border-[var(--border-subtle)]">
            <div className="skeuo-inset p-3 rounded-xl text-center">
              <p className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Check In</p>
              <p className="font-mono text-sm font-black text-[var(--text-primary)] mt-0.5 tabular-nums">
                {todayStatus?.check_in ? formatTime(todayStatus.check_in) : '—'}
              </p>
            </div>
            <div className="skeuo-inset p-3 rounded-xl text-center">
              <p className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Check Out</p>
              <p className="font-mono text-sm font-black text-[var(--text-primary)] mt-0.5 tabular-nums">
                {todayStatus?.check_out ? formatTime(todayStatus.check_out) : '—'}
              </p>
            </div>
            <div className="skeuo-inset p-3 rounded-xl text-center">
              <p className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Session Time</p>
              <p className="font-mono text-sm font-black text-indigo-600 dark:text-indigo-400 mt-0.5 tabular-nums">
                {todayStatus?.clocked_in
                  ? liveElapsed
                  : todayStatus?.total_hours
                  ? `${Number(todayStatus.total_hours).toFixed(2)} hrs`
                  : '0.00 hrs'}
              </p>
            </div>
            <div className="skeuo-inset p-3 rounded-xl text-center">
              <p className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Status</p>
              <span
                className={`skeuo-pill mt-1 px-2.5 py-0.5 text-[10px] uppercase font-black inline-block ${
                  todayStatus?.status === 'present'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : todayStatus?.status === 'late'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-slate-500'
                }`}
              >
                {todayStatus?.status || '—'}
              </span>
            </div>
          </div>
        </div>

        {/* ======================= TIMESHEET TOOLBAR ======================= */}
        <div className="skeuo-card p-5 space-y-4 border border-[var(--border-soft)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-indigo-500" />
                <h3 className="font-extrabold text-base text-[var(--text-primary)]">
                  Monthly Timesheet Record
                </h3>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{currentViewedName}</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCalendarViewDate(subMonths(calendarViewDate, 1))}
                disabled={loading}
                className="skeuo-btn text-xs h-8 w-8 p-0 flex items-center justify-center text-[var(--text-secondary)] disabled:opacity-40"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <span
                className="font-bold text-sm text-[var(--text-primary)] min-w-[130px] text-center tabular-nums"
                aria-live="polite"
              >
                {format(calendarViewDate, 'MMMM yyyy')}
              </span>

              <button
                onClick={() => setCalendarViewDate(addMonths(calendarViewDate, 1))}
                disabled={loading}
                className="skeuo-btn text-xs h-8 w-8 p-0 flex items-center justify-center text-[var(--text-secondary)] disabled:opacity-40"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              <button
                onClick={() => setCalendarViewDate(new Date())}
                className="skeuo-btn text-xs py-1.5 px-2.5 font-bold text-[var(--text-secondary)]"
              >
                Today
              </button>
            </div>

            <div className="skeuo-card-soft p-1 flex items-center gap-1 rounded-xl">
              <button
                onClick={() => setViewMode('calendar')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  viewMode === 'calendar'
                    ? 'skeuo-inset text-indigo-600 dark:text-indigo-400 font-extrabold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                aria-pressed={viewMode === 'calendar'}
              >
                <Calendar className="h-3.5 w-3.5" />
                <span>Calendar</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  viewMode === 'list'
                    ? 'skeuo-inset text-indigo-600 dark:text-indigo-400 font-extrabold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                aria-pressed={viewMode === 'list'}
              >
                <List className="h-3.5 w-3.5" />
                <span>Present Days</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-[var(--border-subtle)] pb-1">
            <span className="text-[11px] font-bold text-[var(--text-muted)] pr-1 shrink-0">Filter:</span>
            {(viewMode === 'calendar'
              ? ['all', 'present', 'late', 'half_day', 'on_leave', 'absent']
              : ['all', 'present', 'late', 'half_day']
            ).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`skeuo-pill px-3 py-1 text-[11px] font-bold transition-all shrink-0 ${
                  statusFilter === st
                    ? 'skeuo-btn-primary text-white shadow-sm'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-elevated)]'
                }`}
                aria-pressed={statusFilter === st}
              >
                {st === 'all'
                  ? viewMode === 'calendar'
                    ? 'All Days'
                    : 'All Present'
                  : STATUS_CARD_STYLES[st]?.label || st}
              </button>
            ))}
          </div>
        </div>

        {/* ======================= KPI SUMMARY ======================= */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="skeuo-card p-4 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              Days Present
            </span>
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {summary.present || 0}
            </p>
            <p className="text-[11px] text-[var(--text-secondary)]">
              of {summary.working_days || 0} working days
            </p>
          </div>

          <div className="skeuo-card p-4 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-indigo-500" />
              Hours Logged
            </span>
            <p className="text-xl font-black text-[var(--text-primary)] tabular-nums">
              {summary.total_hours || 0} hrs
            </p>
            <p className="text-[11px] text-[var(--text-secondary)]">Recorded this month</p>
          </div>

          <div className="skeuo-card p-4 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              {/* FIX: semantic icon — CalendarOff instead of Calendar */}
              <CalendarOff className="h-3.5 w-3.5 text-purple-500" />
              Leaves &amp; Absences
            </span>
            <p className="text-xl font-black text-purple-600 dark:text-purple-400 tabular-nums">
              {(summary.on_leave || 0) + (summary.absent || 0)} d
            </p>
            <p className="text-[11px] text-[var(--text-secondary)]">
              {summary.on_leave || 0} on leave &bull; {summary.absent || 0} absent
            </p>
          </div>

          <div className="skeuo-card p-4 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <BarChart className="h-3.5 w-3.5 text-amber-500" />
              Attendance Health
            </span>
            <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
              {summary.attendance_rate || 0}%
            </p>
            <p className="text-[11px] text-[var(--text-secondary)]">
              {summary.late || 0} late arrivals
            </p>
          </div>
        </div>

        {/* ======================= CALENDAR / LIST ======================= */}
        {viewMode === 'calendar' ? (
          <div className="skeuo-card p-3 sm:p-6 border border-[var(--border-soft)] space-y-4">
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5 text-center pb-2 border-b border-[var(--border-subtle)]">
              {DAYS_OF_WEEK.map((day) => (
                <div
                  key={day}
                  className="text-[10px] sm:text-xs font-black uppercase text-[var(--text-muted)] tracking-wider"
                >
                  <span className="sm:hidden">{day.charAt(0)}</span>
                  <span className="hidden sm:inline">{day}</span>
                </div>
              ))}
            </div>

            {loading && !attendanceData ? (
              // FIX: skeleton so the grid doesn't flash stale/empty
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
                {Array.from({ length: 35 }).map((_, i) => (
                  <div
                    key={i}
                    className="min-h-[85px] sm:min-h-[105px] rounded-2xl bg-[var(--bg-surface-elevated)] animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5">{calendarGridDays}</div>
            )}

            <div className="pt-4 border-t border-[var(--border-subtle)] flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-bold">
              <span className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider font-extrabold">
                Legend:
              </span>
              {Object.entries(STATUS_CARD_STYLES)
                .filter(([k]) => k !== 'upcoming')
                .map(([k, cfg]) => (
                  <span
                    key={k}
                    className={`px-2.5 py-1 rounded-xl border text-[11px] font-extrabold flex items-center gap-1.5 ${cfg.cardBg} ${cfg.border} ${cfg.badgeText}`}
                  >
                    <span aria-hidden="true" className="opacity-70">{cfg.short}</span>
                    {cfg.label}
                  </span>
                ))}
            </div>
          </div>
        ) : (
          <div className="skeuo-card p-6 border border-[var(--border-soft)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
              <div>
                <h4 className="font-extrabold text-sm text-[var(--text-primary)] flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>Present Days</span>
                </h4>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Present, late, or worked sessions in {format(calendarViewDate, 'MMMM yyyy')} ({listPresentRecords.length} shown).
                </p>
              </div>
              <span className="skeuo-pill px-3 py-1 text-xs font-black text-emerald-600 dark:text-emerald-400 w-fit">
                {listPresentRecords.length} days
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)]">
                    <th className="py-3 font-bold">Date &amp; Day</th>
                    <th className="py-3 font-bold">Status</th>
                    <th className="py-3 font-bold">Check In</th>
                    <th className="py-3 font-bold">Check Out</th>
                    <th className="py-3 font-bold">Hours</th>
                    <th className="py-3 font-bold">Location</th>
                    <th className="py-3 font-bold text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {listPresentRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="skeuo-inset p-8 text-center text-xs text-[var(--text-muted)] rounded-xl">
                        No present days found for {format(calendarViewDate, 'MMMM yyyy')}.
                      </td>
                    </tr>
                  ) : (
                    listPresentRecords.map((r: any) => {
                      const d = parseISO(r.date);
                      const isToday = isSameDay(d, new Date());
                      const cardStyle = STATUS_CARD_STYLES[r.status] || STATUS_CARD_STYLES.present;
                      return (
                        <tr
                          key={r.date}
                          onClick={() => setDayDetail(r)}
                          className={`hover:bg-[var(--bg-surface-elevated)] cursor-pointer transition ${
                            isToday ? 'bg-indigo-500/5' : ''
                          }`}
                        >
                          <td className="py-3.5 font-bold text-[var(--text-primary)]">
                            <span className="text-sm font-black">{format(d, 'MMM d, yyyy')}</span>
                            <span className="block text-[11px] font-medium text-[var(--text-muted)]">
                              {format(d, 'EEEE')}
                              {isToday && <span className="text-indigo-600 font-extrabold"> • Today</span>}
                            </span>
                          </td>
                          <td className="py-3.5">
                            <span
                              className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 ${cardStyle.badgeBg} ${cardStyle.badgeText}`}
                            >
                              <span aria-hidden="true" className="opacity-70">{cardStyle.short}</span>
                              {cardStyle.label}
                            </span>
                          </td>
                          <td className="py-3.5 font-mono text-sm font-black text-[var(--text-primary)] tabular-nums">
                            {r.check_in ? formatTime(r.check_in) : '—'}
                          </td>
                          <td className="py-3.5 font-mono text-sm font-black text-[var(--text-primary)] tabular-nums">
                            {r.check_out ? formatTime(r.check_out) : '—'}
                          </td>
                          <td className="py-3.5 font-mono text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {r.total_hours > 0 ? `${r.total_hours} hrs` : '—'}
                          </td>
                          <td className="py-3.5 text-xs text-[var(--text-secondary)] font-medium">
                            <div className="flex items-center gap-1.5">
                              <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[220px]">
                                {r.location || r.notes || 'HQ / Remote'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDayDetail(r);
                              }}
                              className="skeuo-btn text-xs py-1 px-2.5 font-bold text-indigo-600 dark:text-indigo-400"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================= DAY DETAIL MODAL ======================= */}
        {dayDetail && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="day-detail-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setDayDetail(null);
            }}
          >
            <div className="skeuo-card max-w-sm w-full p-6 relative space-y-5 border-2 border-[var(--border-soft)]">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-indigo-500" />
                  <h3 id="day-detail-title" className="font-extrabold text-sm text-[var(--text-primary)]">
                    Day Session Detail
                  </h3>
                </div>
                <button
                  onClick={() => setDayDetail(null)}
                  className="skeuo-btn h-8 w-8 p-0 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center"
                  aria-label="Close"
                >
                  {/* FIX: X instead of XCircle (which reads as an error state) */}
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between skeuo-inset p-3 rounded-xl gap-3">
                  <span className="font-bold text-[var(--text-muted)] shrink-0">Date</span>
                  <span className="font-bold text-[var(--text-primary)] text-right">
                    {format(parseISO(dayDetail.date), 'EEEE, MMMM d, yyyy')}
                  </span>
                </div>

                <div className="flex items-center justify-between skeuo-inset p-3 rounded-xl gap-3">
                  <span className="font-bold text-[var(--text-muted)] shrink-0">Status</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold uppercase inline-flex items-center gap-1.5 ${
                      STATUS_CARD_STYLES[dayDetail.status]?.badgeBg || 'bg-slate-200'
                    } ${STATUS_CARD_STYLES[dayDetail.status]?.badgeText || 'text-slate-700'}`}
                  >
                    <span aria-hidden="true" className="opacity-70">
                      {STATUS_CARD_STYLES[dayDetail.status]?.short}
                    </span>
                    {STATUS_CARD_STYLES[dayDetail.status]?.label || dayDetail.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="skeuo-inset p-3 rounded-xl text-center">
                    <span className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Check In</span>
                    <p className="font-mono text-sm font-black text-[var(--text-primary)] mt-0.5 tabular-nums">
                      {/* FIX: format consistently with the terminal */}
                      {dayDetail.check_in ? formatTime(dayDetail.check_in) : '—'}
                    </p>
                  </div>
                  <div className="skeuo-inset p-3 rounded-xl text-center">
                    <span className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Check Out</span>
                    <p className="font-mono text-sm font-black text-[var(--text-primary)] mt-0.5 tabular-nums">
                      {dayDetail.check_out ? formatTime(dayDetail.check_out) : '—'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between skeuo-inset p-3 rounded-xl gap-3">
                  <span className="font-bold text-[var(--text-muted)] shrink-0">Total Logged</span>
                  <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                    {dayDetail.total_hours || 0} hrs
                  </span>
                </div>

                {dayDetail.notes && (
                  <div className="skeuo-inset p-3 rounded-xl space-y-1">
                    <span className="font-bold text-[var(--text-muted)] block">Notes</span>
                    <p className="text-[var(--text-primary)] font-medium">{dayDetail.notes}</p>
                  </div>
                )}
              </div>

              <button
                onClick={() => setDayDetail(null)}
                className="skeuo-btn-primary w-full text-xs py-2 font-bold"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* ======================= CONFIRM CLOCK OUT ======================= */}
        {confirmClockOut && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-out-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setConfirmClockOut(false);
            }}
          >
            <div className="skeuo-card max-w-sm w-full p-6 relative space-y-4 border-2 border-[var(--border-soft)]">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                <h3 id="confirm-out-title" className="font-extrabold text-sm text-[var(--text-primary)]">
                  End this session?
                </h3>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                You&apos;ve been clocked in for <span className="font-mono font-black text-[var(--text-primary)]">{liveElapsed}</span>. Clocking out ends the session and cannot be undone.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => setConfirmClockOut(false)}
                  className="skeuo-btn flex-1 text-xs py-2 font-bold text-[var(--text-secondary)]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClockOutConfirmed}
                  disabled={actionLoading}
                  className="skeuo-btn-danger flex-1 text-xs py-2 font-bold disabled:opacity-40"
                >
                  {actionLoading ? 'Clocking out…' : 'Yes, Clock Out'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================= TEAM ROSTER ======================= */}
        {canViewOthers && (
          <div className="skeuo-card p-6 border border-[var(--border-soft)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-500" />
                <h3 className="font-extrabold text-base text-[var(--text-primary)]">
                  Daily Team Presence
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={localDateKey(rosterDate)}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const d = parseISO(e.target.value);
                    setRosterDate(d);
                    fetchTeamRoster(d);
                  }}
                  className="skeuo-inset text-xs px-2.5 py-1.5 rounded-xl text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 font-bold"
                  aria-label="Roster date"
                />
                <button
                  onClick={() => {
                    const d = new Date();
                    setRosterDate(d);
                    fetchTeamRoster(d);
                  }}
                  className="skeuo-btn text-xs py-1.5 px-2.5 font-bold text-[var(--text-secondary)]"
                >
                  Today
                </button>
              </div>
            </div>

            <div className="divide-y divide-[var(--border-subtle)]">
              {teamRoster.map((m) => (
                <div key={m.employee_id} className="flex items-center justify-between py-3 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                        m.status === 'present'
                          ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]'
                          : m.status === 'late'
                          ? 'bg-amber-500'
                          : m.status === 'on_leave'
                          ? 'bg-purple-500'
                          : 'bg-slate-400'
                      }`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-[var(--text-primary)] truncate">{m.name}</p>
                      <p className="text-xs text-[var(--text-muted)] truncate">
                        {m.department} &bull; {m.designation}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-right shrink-0">
                    <div className="text-right">
                      <span
                        className={`skeuo-pill px-2.5 py-0.5 text-[10px] uppercase font-bold ${
                          m.status === 'present'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : m.status === 'late'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-[var(--text-secondary)]'
                        }`}
                      >
                        {m.status || '—'}
                      </span>
                      <p className="text-[11px] text-[var(--text-muted)] font-mono mt-0.5">
                        {m.check_in
                          ? `In: ${formatTime(m.check_in)}`
                          : m.status === 'on_leave'
                          ? 'On Leave'
                          : 'Not In'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleSelectEmployee(m.employee_id)}
                      className="skeuo-btn text-xs py-1 px-2.5 text-indigo-600 dark:text-indigo-400 font-bold"
                    >
                      Timesheet
                    </button>
                  </div>
                </div>
              ))}

              {teamRoster.length === 0 && (
                <div className="skeuo-inset p-8 text-center text-xs text-[var(--text-muted)] rounded-xl">
                  No roster records for this date.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}