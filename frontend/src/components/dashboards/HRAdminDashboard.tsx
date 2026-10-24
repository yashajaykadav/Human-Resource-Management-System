"use client";

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Users,
  Building,
  BookOpen,
  TrendingDown,
  Sparkles,
  FileCheck
} from 'lucide-react';
import Link from 'next/link';

export const HRAdminDashboard: React.FC<{ stats: any; onRefresh: () => void }> = ({ stats, onRefresh }) => {
  const { setCopilotOpen } = useAuth();
  const hrData = stats?.hr_admin_data;

  return (
    <div className="space-y-6">
      {/* Tactile HR Hero Panel */}
      <div className="skeuo-card p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="skeuo-pill px-2.5 py-0.5 text-[11px] font-bold text-blue-600 dark:text-blue-400">
                PEOPLE OPERATIONS COMMAND
              </span>
              <span className="text-xs text-[var(--text-muted)] font-mono">&bull; HR-1003</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
              Workforce Intelligence
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Enterprise headcount analytics, policy vault compliance, and department directories.
            </p>
          </div>

          <button
            onClick={() => setCopilotOpen(true)}
            className="skeuo-btn text-xs py-2 px-4 text-blue-600 dark:text-blue-400 font-bold"
          >
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>Launch HR Copilot</span>
          </button>
        </div>
      </div>

      {/* Tactile Dials */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
        <div className="skeuo-card p-5">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-blue-500" />
            <span>Total Headcount</span>
          </span>
          <div className="skeuo-inset my-3 p-3 text-center">
            <span className="font-mono text-3xl font-black text-[var(--text-primary)]">{hrData?.total_headcount || 6}</span>
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold text-center">+2 this quarter</p>
        </div>

        <div className="skeuo-card p-5">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
            <Building className="h-3.5 w-3.5 text-indigo-500" />
            <span>Departments</span>
          </span>
          <div className="skeuo-inset my-3 p-3 text-center">
            <span className="font-mono text-3xl font-black text-[var(--text-primary)]">{hrData?.total_departments || 4}</span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] text-center">Eng, HR, Sales, Finance</p>
        </div>

        <div className="skeuo-card p-5">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5 text-purple-500" />
            <span>Policy Vault (RAG)</span>
          </span>
          <div className="skeuo-inset my-3 p-3 text-center">
            <span className="font-mono text-3xl font-black text-[var(--text-primary)]">{hrData?.active_policies || 3}</span>
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold text-center">Vector Synced</p>
        </div>

        <div className="skeuo-card p-5">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
            <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />
            <span>Monthly Attrition</span>
          </span>
          <div className="skeuo-inset my-3 p-3 text-center">
            <span className="font-mono text-3xl font-black text-emerald-600 dark:text-emerald-400">1.4%</span>
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold text-center">Optimal retention</p>
        </div>
      </div>

      {/* Tactile Operations Nav Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/employees"
          className="skeuo-card p-6 hover:translate-y-[-2px] transition group block"
        >
          <div className="flex items-center gap-3">
            <div className="skeuo-card-soft flex h-10 w-10 items-center justify-center text-blue-600 dark:text-blue-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-[var(--text-primary)]">Employee Directory</h4>
              <p className="text-xs text-[var(--text-muted)]">Interactive hierarchy & profiles</p>
            </div>
          </div>
        </Link>

        <Link
          href="/policies"
          className="skeuo-card p-6 hover:translate-y-[-2px] transition group block"
        >
          <div className="flex items-center gap-3">
            <div className="skeuo-card-soft flex h-10 w-10 items-center justify-center text-purple-600 dark:text-purple-400">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-[var(--text-primary)]">Company Policies & RAG</h4>
              <p className="text-xs text-[var(--text-muted)]">Upload handbook clauses for AI</p>
            </div>
          </div>
        </Link>

        <Link
          href="/leaves"
          className="skeuo-card p-6 hover:translate-y-[-2px] transition group block"
        >
          <div className="flex items-center gap-3">
            <div className="skeuo-card-soft flex h-10 w-10 items-center justify-center text-amber-600 dark:text-amber-400">
              <FileCheck className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-[var(--text-primary)]">Global Leave Review</h4>
              <p className="text-xs text-[var(--text-muted)]">Company-wide absence workflow</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
};
