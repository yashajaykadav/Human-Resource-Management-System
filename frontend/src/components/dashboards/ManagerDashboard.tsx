"use client";

import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  Users,
  CheckCircle,
  XCircle,
  Calendar,
  Clock,
  Sparkles,
  UserCheck
} from 'lucide-react';

export const ManagerDashboard: React.FC<{ stats: any; onRefresh: () => void }> = ({ stats, onRefresh }) => {
  const { setCopilotOpen } = useAuth();
  const [teamRequests, setTeamRequests] = useState<any[]>([]);
  const [teamRoster, setTeamRoster] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchTeamData();
  }, []);

  const fetchTeamData = async () => {
    try {
      const [reqs, roster] = await Promise.all([
        apiRequest('/leaves/team-requests'),
        apiRequest('/attendance/team')
      ]);
      setTeamRequests(reqs);
      setTeamRoster(roster);
    } catch (err) {
      console.error(err);
    }
  };

  const handleReviewLeave = async (id: string, status: 'approved' | 'rejected') => {
    setActionLoading(id);
    try {
      await apiRequest(`/leaves/requests/${id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ status, comments: `Reviewed by manager` })
      });
      await fetchTeamData();
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const pendingRequests = teamRequests.filter((r) => r.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Tactile Manager Hero Panel */}
      <div className="skeuo-card p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="skeuo-pill px-2.5 py-0.5 text-[11px] font-bold text-teal-600 dark:text-teal-400">
                TEAM COMMAND HUB
              </span>
              <span className="text-xs text-[var(--text-muted)] font-mono">&bull; MGR-1001</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
              Department Operations
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Direct report supervision, pending leave approvals queue, and shift presence.
            </p>
          </div>

          <button
            onClick={() => setCopilotOpen(true)}
            className="skeuo-btn text-xs py-2 px-4 text-emerald-600 dark:text-emerald-400 font-bold"
          >
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>Launch Manager Copilot</span>
          </button>
        </div>
      </div>

      {/* Tactile Metric Dials */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="skeuo-card p-6">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-emerald-500" />
              <span>Direct Reports</span>
            </span>
            <span className="skeuo-pill px-2 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">Team</span>
          </div>
          <div className="skeuo-inset my-3 p-3 text-center">
            <span className="font-mono text-3xl font-black text-[var(--text-primary)]">
              {stats?.manager_data?.team_size || teamRoster.length}
            </span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] text-center">Assigned Engineering Staff</p>
        </div>

        <div className="skeuo-card p-6">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-teal-500" />
              <span>Attendance Rate</span>
            </span>
            <span className="skeuo-pill px-2 py-0.5 text-[10px] text-teal-600 dark:text-teal-400">Today</span>
          </div>
          <div className="skeuo-inset my-3 p-3 text-center">
            <span className="font-mono text-3xl font-black text-teal-600 dark:text-teal-400">92%</span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] text-center">Coverage above SLA threshold</p>
        </div>

        <div className="skeuo-card p-6">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-amber-500" />
              <span>Pending Reviews</span>
            </span>
            <span className="skeuo-pill px-2 py-0.5 text-[10px] text-amber-600 dark:text-amber-400">Action Req</span>
          </div>
          <div className="skeuo-inset my-3 p-3 text-center">
            <span className="font-mono text-3xl font-black text-amber-600 dark:text-amber-400">
              {pendingRequests.length}
            </span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] text-center">Awaiting Manager Sign-off</p>
        </div>
      </div>

      {/* Pending Leave Approval Queue */}
      <div className="skeuo-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-indigo-500" />
            <h3 className="font-bold text-sm text-[var(--text-primary)]">Pending Team Approvals Queue</h3>
          </div>
          <span className="skeuo-pill px-2.5 py-0.5 text-xs text-amber-600 dark:text-amber-400">
            {pendingRequests.length} Items
          </span>
        </div>

        {pendingRequests.length === 0 ? (
          <div className="skeuo-inset p-8 text-center text-xs text-[var(--text-muted)]">
            ✨ All team leave applications have been reviewed.
          </div>
        ) : (
          <div className="space-y-3">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="skeuo-card-soft p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-[var(--text-primary)]">{req.employee_name}</span>
                    <span className="skeuo-pill px-2 py-0.5 text-[10px] text-indigo-600 dark:text-indigo-400 uppercase">
                      {req.leave_type} Leave
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    <strong>{req.start_date}</strong> to <strong>{req.end_date}</strong> ({req.days_count} days)
                  </p>
                  <p className="text-xs text-[var(--text-muted)] italic mt-0.5">"{req.reason}"</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    disabled={actionLoading === req.id}
                    onClick={() => handleReviewLeave(req.id, 'approved')}
                    className="skeuo-btn-success text-xs py-1.5 px-3"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span>Approve</span>
                  </button>
                  <button
                    disabled={actionLoading === req.id}
                    onClick={() => handleReviewLeave(req.id, 'rejected')}
                    className="skeuo-btn-danger text-xs py-1.5 px-3"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Team Roster Well */}
      <div className="skeuo-card p-6">
        <h3 className="font-bold text-sm text-[var(--text-primary)] mb-4">Today's Team Attendance Roster</h3>
        <div className="divide-y divide-[var(--border-subtle)]">
          {teamRoster.map((m, idx) => (
            <div key={idx} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className={`h-2.5 w-2.5 rounded-full ${
                  m.status === 'present' ? 'bg-emerald-500 shadow-[0_0_5px_#10b981]' : (m.status === 'late' ? 'bg-amber-500' : 'bg-rose-500')
                }`} />
                <div>
                  <p className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">{m.name}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">{m.department}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="skeuo-pill px-2 py-0.5 text-[10px] uppercase font-bold text-[var(--text-secondary)]">
                  {m.status}
                </span>
                <p className="text-[11px] text-[var(--text-muted)] font-mono mt-0.5">
                  {m.check_in ? `In: ${m.check_in}` : 'Absent'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
