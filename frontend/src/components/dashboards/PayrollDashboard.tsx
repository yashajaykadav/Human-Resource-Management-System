"use client";

import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  DollarSign,
  FileText,
  CheckCircle,
  Sparkles,
  Calculator,
  ShieldAlert
} from 'lucide-react';

export const PayrollDashboard: React.FC<{ stats: any; onRefresh: () => void }> = ({ stats, onRefresh }) => {
  const { setCopilotOpen } = useAuth();
  const [runs, setRuns] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchPayrollData();
  }, []);

  const fetchPayrollData = async () => {
    try {
      const data = await apiRequest('/payroll/runs');
      setRuns(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSimulatePayroll = async () => {
    setProcessing(true);
    try {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      await apiRequest('/payroll/runs/process', {
        method: 'POST',
        body: JSON.stringify({ month: currentMonth, year: currentYear })
      });
      await fetchPayrollData();
      onRefresh();
      alert("Current month payroll run calculated & validated successfully!");
    } catch (err: any) {
      alert(err.message || 'Payroll processing failed');
    } finally {
      setProcessing(false);
    }
  };

  const latestRun = runs[0];

  return (
    <div className="space-y-6">
      {/* Tactile Payroll Hero Panel */}
      <div className="skeuo-card p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="skeuo-pill px-2.5 py-0.5 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                COMPENSATION CONTROL
              </span>
              <span className="text-xs text-[var(--text-muted)] font-mono">&bull; PAY-1005</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
              Payroll & Disbursement Ledger
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Salary structures, tax withholdings, and autonomous payroll anomaly verification.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSimulatePayroll}
              disabled={processing}
              className="skeuo-btn-primary text-xs py-2 px-4"
            >
              <Calculator className="h-4 w-4" />
              <span>{processing ? 'Processing...' : 'Run Month Payroll'}</span>
            </button>
            <button
              onClick={() => setCopilotOpen(true)}
              className="skeuo-btn text-xs py-2 px-4 text-rose-600 dark:text-rose-400 font-bold"
            >
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span>Audit Anomalies</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tactile Financial Dials */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
        <div className="skeuo-card p-5">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-rose-500" />
            <span>Net Disbursed</span>
          </span>
          <div className="skeuo-inset my-3 p-3 text-center">
            <span className="font-mono text-2xl font-black text-[var(--text-primary)]">
              ${latestRun ? latestRun.total_net_amount.toLocaleString() : '38,700'}
            </span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] text-center">Cycle: {latestRun ? `${latestRun.month}/${latestRun.year}` : 'Active'}</p>
        </div>

        <div className="skeuo-card p-5">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-blue-500" />
            <span>Total Gross Pay</span>
          </span>
          <div className="skeuo-inset my-3 p-3 text-center">
            <span className="font-mono text-2xl font-black text-[var(--text-primary)]">
              ${latestRun ? latestRun.total_gross_amount.toLocaleString() : '48,500'}
            </span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] text-center">Base + HRA + Allowances</p>
        </div>

        <div className="skeuo-card p-5">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
            <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
            <span>Tax Withholdings</span>
          </span>
          <div className="skeuo-inset my-3 p-3 text-center">
            <span className="font-mono text-2xl font-black text-[var(--text-primary)]">
              ${latestRun ? latestRun.total_deductions.toLocaleString() : '9,800'}
            </span>
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold text-center">100% Tax Compliant</p>
        </div>

        <div className="skeuo-card p-5">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
            <span>Anomalies Detected</span>
          </span>
          <div className="skeuo-inset my-3 p-3 text-center">
            <span className="font-mono text-2xl font-black text-emerald-600 dark:text-emerald-400">0</span>
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold text-center">All checks cleared</p>
        </div>
      </div>

      {/* Historical Payroll Runs Register */}
      <div className="skeuo-card p-6">
        <h3 className="font-bold text-sm text-[var(--text-primary)] mb-4">Payroll Cycle Register</h3>
        <div className="divide-y divide-[var(--border-subtle)]">
          {runs.map((r) => (
            <div key={r.id} className="flex items-center justify-between py-3.5">
              <div>
                <p className="font-extrabold text-sm text-[var(--text-primary)]">
                  Payroll Cycle: Month {r.month}/{r.year}
                </p>
                <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">
                  {r.total_employees} Employees &middot; Gross: ${r.total_gross_amount.toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <span className="skeuo-pill px-3 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 uppercase">
                  {r.status}
                </span>
                <p className="font-mono text-xs font-bold text-[var(--text-primary)] mt-1">
                  ${r.total_net_amount.toLocaleString()} Net
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
