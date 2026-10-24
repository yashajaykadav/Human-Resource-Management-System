"use client";

import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  Clock,
  CalendarCheck,
  FileText,
  Target,
  Sparkles,
  MapPin,
  CheckCircle2
} from 'lucide-react';

function parseCheckInTime(isoStr: string | null | undefined): Date | null {
  if (!isoStr) return null;
  const hasTimezone = isoStr.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(isoStr);
  const normalized = hasTimezone ? isoStr : `${isoStr}Z`;
  const date = new Date(normalized);
  return isNaN(date.getTime()) ? new Date(isoStr) : date;
}

function formatCheckInTime(isoStr: string | null | undefined): string {
  const d = parseCheckInTime(isoStr);
  if (!d || isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const EmployeeDashboard: React.FC<{ stats: any; onRefresh: () => void }> = ({ stats, onRefresh }) => {
  const { setCopilotOpen } = useAuth();
  const [clockLoading, setClockLoading] = useState(false);
  const [clockStatus, setClockStatus] = useState<any>(null);
  const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');

  useEffect(() => {
    fetchTodayAttendance();
  }, []);

  useEffect(() => {
    if (!clockStatus?.clocked_in || !clockStatus?.check_in) {
      setElapsedTime('00:00:00');
      return;
    }

    const calculateElapsed = () => {
      const checkInDate = parseCheckInTime(clockStatus.check_in);
      if (!checkInDate) return;
      const diffMs = Math.max(0, Date.now() - checkInDate.getTime());
      const totalSeconds = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      setElapsedTime(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      );
    };

    calculateElapsed();
    const interval = setInterval(calculateElapsed, 1000);
    return () => clearInterval(interval);
  }, [clockStatus?.clocked_in, clockStatus?.check_in]);

  const fetchTodayAttendance = async () => {
    try {
      const data = await apiRequest('/attendance/today');
      setClockStatus(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleClockInOut = async () => {
    setClockLoading(true);
    try {
      if (clockStatus?.clocked_in) {
        await apiRequest('/attendance/clock-out', { method: 'POST', body: JSON.stringify({}) });
      } else {
        await apiRequest('/attendance/clock-in', { method: 'POST', body: JSON.stringify({ location: 'Remote / HQ' }) });
      }
      await fetchTodayAttendance();
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Clock action failed');
    } finally {
      setClockLoading(false);
    }
  };

  const empData = stats?.employee_data;

  return (
    <div className="space-y-6">
      {/* Tactile Instrument Hero Panel */}
      <div className="skeuo-card p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="skeuo-pill px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                ACTIVE WORKSTATION
              </span>
              <span className="text-xs text-[var(--text-muted)] font-mono">&bull; ESS-1002</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
              Welcome, {stats?.user_name || 'Team Member'}
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Personal time tracking, leave balances, compensation, and autonomous HR assistant.
            </p>
          </div>

          <button
            onClick={() => setCopilotOpen(true)}
            className="skeuo-btn text-xs py-2 px-4 text-indigo-600 dark:text-indigo-400 font-bold"
          >
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>Launch ESS Copilot</span>
          </button>
        </div>
      </div>

      {/* Tactile Gauges Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Physical Time Clock Terminal */}
        <div className="skeuo-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-indigo-500" />
                <span>Attendance Chrono</span>
              </span>
              <span className={`skeuo-pill px-2 py-0.5 text-[10px] flex items-center gap-1.5 ${
                clockStatus?.clocked_in ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-500'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${
                  clockStatus?.clocked_in ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                }`} />
                <span>{clockStatus?.clocked_in ? 'Session Active' : 'Off Duty'}</span>
              </span>
            </div>

            <div className="skeuo-inset my-4 p-4 text-center">
              {clockStatus?.clocked_in ? (
                <div>
                  <div className="flex items-center justify-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="font-mono text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                      {elapsedTime}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
                    {clockStatus?.check_in
                      ? `Checked in at ${formatCheckInTime(clockStatus.check_in)}`
                      : 'Session in progress'}
                  </p>
                </div>
              ) : (
                <div>
                  <span className="font-mono text-3xl sm:text-4xl font-black text-[var(--text-primary)] tracking-tight">
                    {clockStatus?.total_hours ? `${Number(clockStatus.total_hours).toFixed(2)} hrs` : '0.00 hrs'}
                  </span>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    {clockStatus?.check_out
                      ? `Shift ended at ${formatCheckInTime(clockStatus.check_out)}`
                      : (clockStatus?.check_in
                          ? `Checked in at ${formatCheckInTime(clockStatus.check_in)}`
                          : 'Shift starts 9:00 AM')}
                  </p>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleClockInOut}
            disabled={clockLoading}
            className={`w-full py-2.5 text-xs font-bold transition active:scale-98 ${
              clockStatus?.clocked_in ? 'skeuo-btn-danger' : 'skeuo-btn-primary'
            }`}
          >
            {clockLoading ? 'Connecting...' : (clockStatus?.clocked_in ? 'Stop Session (Clock Out)' : 'Start Session (Clock In)')}
          </button>
        </div>

        {/* Leave Balances Extruded Dial Card */}
        <div className="skeuo-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                <CalendarCheck className="h-3.5 w-3.5 text-emerald-500" />
                <span>Available Leaves</span>
              </span>
              <button
                onClick={() => setCopilotOpen(true)}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Apply via AI &rarr;
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5 my-4">
              {empData?.leave_balances?.map((b: any) => (
                <div key={b.type} className="skeuo-inset p-3 text-center">
                  <span className="font-mono text-xl font-black text-[var(--text-primary)]">{b.remaining}</span>
                  <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mt-0.5">{b.type}</p>
                </div>
              )) || (
                <p className="text-xs text-[var(--text-muted)] col-span-3 text-center py-4">Syncing balances...</p>
              )}
            </div>
          </div>

          <div className="pt-2 text-[11px] text-[var(--text-muted)] flex items-center justify-between border-t border-[var(--border-subtle)]">
            <span>Accrual cycle: 2026 Annual</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">100% Up-to-date</span>
          </div>
        </div>

        {/* Compensation & Payslip Gauge */}
        <div className="skeuo-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-amber-500" />
                <span>Net Compensation</span>
              </span>
              <span className="skeuo-pill px-2 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                Disbursed
              </span>
            </div>

            <div className="skeuo-inset my-4 p-4 text-center">
              <span className="font-mono text-3xl font-black text-emerald-600 dark:text-emerald-400">
                {empData?.latest_payslip ? `$${empData.latest_payslip.net_pay.toLocaleString()}` : '$8,392.00'}
              </span>
              <p className="text-[11px] text-[var(--text-muted)] mt-1">Take-home &middot; Past Period</p>
            </div>
          </div>

          <div className="pt-2 text-[11px] text-[var(--text-muted)] flex items-center justify-between border-t border-[var(--border-subtle)]">
            <span>Tax & 401k/PF verified</span>
            <span className="text-indigo-600 dark:text-indigo-400 font-bold cursor-pointer hover:underline">
              Digital Payslip &rarr;
            </span>
          </div>
        </div>
      </div>

      {/* Tactile OKR Goal Progress Panel */}
      <div className="skeuo-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-purple-500" />
            <h3 className="font-bold text-sm text-[var(--text-primary)]">Quarterly OKRs & Objectives (Q4)</h3>
          </div>
          <span className="skeuo-pill px-2.5 py-0.5 text-xs text-[var(--text-muted)]">
            {empData?.goals_count || 1} Goal Assigned
          </span>
        </div>

        <div className="skeuo-card-soft p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">
              Architect & Ship Agentic HRMS Workstation UI
            </h4>
            <span className="font-mono text-xs font-black text-indigo-600 dark:text-indigo-400">85%</span>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Deliver tactile skeuomorphic dual-mode design with interactive HITL action cards.
          </p>
          <div className="skeuo-inset h-3 w-full p-0.5 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500 shadow-sm"
              style={{ width: '85%' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
