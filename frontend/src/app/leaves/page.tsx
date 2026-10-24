"use client";

import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { AuthGuard } from '@/components/auth/AuthGuard';
import {
  CalendarDays,
  Plus,
  Sparkles,
  CalendarCheck
} from 'lucide-react';

export default function LeavesPage() {
  const { user, isAdmin, hasPermission, setCopilotOpen } = useAuth();
  const [balances, setBalances] = useState<any[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [teamRequests, setTeamRequests] = useState<any[]>([]);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [leaveType, setLeaveType] = useState('casual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Only fetch data if user is authenticated
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const [bList, mList] = await Promise.all([
        apiRequest('/leaves/balances'),
        apiRequest('/leaves/requests')
      ]);
      setBalances(bList);
      setMyRequests(mList);

      try {
        const tList = await apiRequest('/leaves/team-requests');
        setTeamRequests(tList || []);
      } catch {
        setTeamRequests([]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiRequest('/leaves/requests', {
        method: 'POST',
        body: JSON.stringify({
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate,
          reason
        })
      });
      setShowApplyModal(false);
      setReason('');
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to submit leave request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await apiRequest(`/leaves/requests/${id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ status, comments: `Reviewed via Leave Manager` })
      });
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to review request');
    }
  };

  return (
    <AuthGuard module="leaves">
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[var(--text-primary)]">Leave Management</h1>
          <p className="text-xs text-[var(--text-secondary)]">Balances, application workflow, and manager approvals</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCopilotOpen(true)}
            className="skeuo-btn text-xs py-2 px-4 text-purple-600 dark:text-purple-400 font-bold"
          >
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>Apply via AI</span>
          </button>
          <button
            onClick={() => setShowApplyModal(true)}
            className="skeuo-btn-primary text-xs py-2 px-4"
          >
            <Plus className="h-4 w-4" />
            <span>Apply for Leave</span>
          </button>
        </div>
      </div>

      {/* Leave Balances Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {balances.map((b) => (
          <div key={b.id} className="skeuo-card p-6">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-sm text-[var(--text-primary)] capitalize">{b.leave_type} Leave</span>
              <CalendarCheck className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="skeuo-inset my-3 p-3 text-center">
              <span className="font-mono text-3xl font-black text-[var(--text-primary)]">{b.remaining}</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] text-center font-medium">
              Days Left (Total: {b.total_allocated}, Used: {b.used})
            </p>
          </div>
        ))}
      </div>

      {/* Team Approval Queue for Managers/Admins */}
      {teamRequests.length > 0 && (
        <div className="skeuo-card p-6">
          <h3 className="font-bold text-sm text-[var(--text-primary)] mb-4">Team Leave Approval Queue</h3>
          <div className="space-y-3">
            {teamRequests.map((req) => (
              <div
                key={req.id}
                className="skeuo-card-soft p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-[var(--text-primary)]">{req.employee_name}</span>
                    <span className="skeuo-pill px-2 py-0.5 text-[10px] text-indigo-600 dark:text-indigo-400 uppercase">
                      {req.leave_type}
                    </span>
                    <span className={`skeuo-pill px-2 py-0.5 text-[10px] font-bold uppercase ${
                      req.status === 'approved' ? 'text-emerald-600 dark:text-emerald-400' : (req.status === 'pending' ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600')
                    }`}>
                      {req.status}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    {req.start_date} to {req.end_date} &middot; {req.days_count} days &middot; "{req.reason}"
                  </p>
                </div>

                {req.status === 'pending' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleReview(req.id, 'approved')}
                      className="skeuo-btn-success text-xs py-1.5 px-3"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReview(req.id, 'rejected')}
                      className="skeuo-btn-danger text-xs py-1.5 px-3"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My Leave Requests */}
      <div className="skeuo-card p-6">
        <h3 className="font-bold text-sm text-[var(--text-primary)] mb-4">My Leave History</h3>
        {myRequests.length === 0 ? (
          <div className="skeuo-inset p-8 text-center text-xs text-[var(--text-muted)]">
            No leave requests recorded.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {myRequests.map((req) => (
              <div key={req.id} className="flex items-center justify-between py-3.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[var(--text-primary)] capitalize">{req.leave_type} Leave</span>
                    <span className={`skeuo-pill px-2 py-0.5 text-[10px] uppercase font-bold ${
                      req.status === 'approved' ? 'text-emerald-600 dark:text-emerald-400' : (req.status === 'pending' ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600')
                    }`}>
                      {req.status}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    {req.start_date} to {req.end_date} ({req.days_count} days) &middot; Reason: {req.reason}
                  </p>
                </div>
                <div className="text-xs font-mono text-[var(--text-muted)]">
                  {req.created_at.split('T')[0]}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Apply Leave Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="skeuo-card w-full max-w-md p-6 shadow-2xl">
            <h3 className="font-black text-lg text-[var(--text-primary)]">Submit Leave Application</h3>
            <form onSubmit={handleApply} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Leave Type</label>
                <div className="skeuo-inset p-1">
                  <select
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value)}
                    className="w-full bg-transparent p-2 text-xs sm:text-sm text-[var(--text-primary)] focus:outline-none"
                  >
                    <option value="casual" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">Casual Leave</option>
                    <option value="sick" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">Sick Leave</option>
                    <option value="annual" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">Annual Leave</option>
                    <option value="unpaid" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">Unpaid Leave</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="skeuo-inset w-full p-2 text-xs sm:text-sm text-[var(--text-primary)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="skeuo-inset w-full p-2 text-xs sm:text-sm text-[var(--text-primary)] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Reason</label>
                <textarea
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="State the reason for absence..."
                  className="skeuo-inset w-full p-2.5 text-xs sm:text-sm text-[var(--text-primary)] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="skeuo-btn text-xs py-2 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="skeuo-btn-primary text-xs py-2 px-4"
                >
                  {submitting ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </AuthGuard>
  );
}
