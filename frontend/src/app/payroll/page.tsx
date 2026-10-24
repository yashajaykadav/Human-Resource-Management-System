"use client";

import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { AuthGuard } from '@/components/auth/AuthGuard';
import {
  Sparkles
} from 'lucide-react';

export default function PayrollPage() {
  const { user, setCopilotOpen } = useAuth();
  const [payslips, setPayslips] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only fetch data if user is authenticated
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const pList = await apiRequest('/payroll/my-payslips');
      setPayslips(pList);

      if (['super_admin', 'hr_admin', 'payroll_specialist'].includes(user?.role || '')) {
        const rList = await apiRequest('/payroll/runs');
        setRuns(rList);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthGuard module="payroll">
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[var(--text-primary)]">Payroll & Compensation</h1>
          <p className="text-xs text-[var(--text-secondary)]">Compensation statements, tax breakdowns, and disbursement registers</p>
        </div>
        <button
          onClick={() => setCopilotOpen(true)}
          className="skeuo-btn text-xs py-2 px-4 text-rose-600 dark:text-rose-400 font-bold"
        >
          <Sparkles className="h-4 w-4 text-amber-500" />
          <span>Audit Payroll with AI</span>
        </button>
      </div>

      {/* Payslips Table Card */}
      <div className="skeuo-card overflow-hidden p-6">
        <h3 className="font-extrabold text-base text-[var(--text-primary)] mb-4">My Digital Payslips</h3>
        {payslips.length === 0 ? (
          <div className="skeuo-inset p-8 text-center text-xs text-[var(--text-muted)]">
            No payslips generated for your profile yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--border-subtle)] text-left text-sm">
              <thead className="bg-[var(--bg-surface-elevated)] text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
                <tr>
                  <th className="px-5 py-3">Pay Period</th>
                  <th className="px-5 py-3">Basic Salary</th>
                  <th className="px-5 py-3">HRA & Allowances</th>
                  <th className="px-5 py-3">Gross Pay</th>
                  <th className="px-5 py-3">Deductions (Tax + PF)</th>
                  <th className="px-5 py-3">Net Take-Home</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {payslips.map((p) => (
                  <tr key={p.id} className="hover:bg-[var(--bg-surface-elevated)] transition">
                    <td className="px-5 py-4 font-extrabold text-[var(--text-primary)]">Month {p.month}/{p.year}</td>
                    <td className="px-5 py-4 font-mono text-xs text-[var(--text-secondary)]">${p.basic_salary.toLocaleString()}</td>
                    <td className="px-5 py-4 font-mono text-xs text-[var(--text-secondary)]">${(p.hra + p.allowances).toLocaleString()}</td>
                    <td className="px-5 py-4 font-mono text-xs font-bold text-[var(--text-primary)]">${p.gross_pay.toLocaleString()}</td>
                    <td className="px-5 py-4 font-mono text-xs text-rose-500 font-bold">-${p.total_deductions.toLocaleString()}</td>
                    <td className="px-5 py-4 font-mono text-sm font-black text-emerald-600 dark:text-emerald-400">${p.net_pay.toLocaleString()}</td>
                    <td className="px-5 py-4">
                      <span className="skeuo-pill px-2.5 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                        {p.payment_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Enterprise Runs */}
      {runs.length > 0 && (
        <div className="skeuo-card p-6">
          <h3 className="font-extrabold text-base text-[var(--text-primary)] mb-4">Enterprise Payroll Runs</h3>
          <div className="space-y-3">
            {runs.map((r) => (
              <div key={r.id} className="skeuo-card-soft p-4 flex items-center justify-between">
                <div>
                  <p className="font-extrabold text-sm text-[var(--text-primary)]">Payroll Cycle: {r.month}/{r.year}</p>
                  <p className="text-xs text-[var(--text-muted)] font-mono">{r.total_employees} Employees &middot; Gross: ${r.total_gross_amount.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <span className="skeuo-pill px-2.5 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 uppercase">
                    {r.status}
                  </span>
                  <p className="font-mono text-xs font-black text-[var(--text-primary)] mt-1">${r.total_net_amount.toLocaleString()} Net</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </AuthGuard>
  );
}
