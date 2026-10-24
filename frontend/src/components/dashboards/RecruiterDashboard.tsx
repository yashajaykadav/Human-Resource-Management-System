"use client";

import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  Briefcase,
  UserCheck,
  Award,
  Sparkles,
  Clock,
  Layers
} from 'lucide-react';
import Link from 'next/link';

export const RecruiterDashboard: React.FC<{ stats: any; onRefresh: () => void }> = ({ stats, onRefresh }) => {
  const { setCopilotOpen } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);

  useEffect(() => {
    fetchATSData();
  }, []);

  const fetchATSData = async () => {
    try {
      const [jList, aList] = await Promise.all([
        apiRequest('/recruitment/jobs'),
        apiRequest('/recruitment/applications')
      ]);
      setJobs(jList);
      setApplications(aList);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tactile ATS Hero Panel */}
      <div className="skeuo-card p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="skeuo-pill px-2.5 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                TALENT ACQUISITION WORKSTATION
              </span>
              <span className="text-xs text-[var(--text-muted)] font-mono">&bull; REC-1004</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
              Recruitment & ATS Pipeline
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Active job requisitions, AI candidate-to-JD match scoring, and interview workflow.
            </p>
          </div>

          <button
            onClick={() => setCopilotOpen(true)}
            className="skeuo-btn text-xs py-2 px-4 text-amber-600 dark:text-amber-400 font-bold"
          >
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>Screen Resumes with AI</span>
          </button>
        </div>
      </div>

      {/* Tactile Dials */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
        <div className="skeuo-card p-5">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
            <Briefcase className="h-3.5 w-3.5 text-amber-500" />
            <span>Active Roles</span>
          </span>
          <div className="skeuo-inset my-3 p-3 text-center">
            <span className="font-mono text-3xl font-black text-[var(--text-primary)]">{jobs.length || 1}</span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] text-center">Open Requisitions</p>
        </div>

        <div className="skeuo-card p-5">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
            <UserCheck className="h-3.5 w-3.5 text-indigo-500" />
            <span>Active Candidates</span>
          </span>
          <div className="skeuo-inset my-3 p-3 text-center">
            <span className="font-mono text-3xl font-black text-[var(--text-primary)]">{applications.length || 1}</span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] text-center">In Kanban Pipeline</p>
        </div>

        <div className="skeuo-card p-5">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
            <Award className="h-3.5 w-3.5 text-emerald-500" />
            <span>Top Match Score</span>
          </span>
          <div className="skeuo-inset my-3 p-3 text-center">
            <span className="font-mono text-3xl font-black text-emerald-600 dark:text-emerald-400">94.5%</span>
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold text-center">Jordan Reed</p>
        </div>

        <div className="skeuo-card p-5">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-purple-500" />
            <span>Time to Hire</span>
          </span>
          <div className="skeuo-inset my-3 p-3 text-center">
            <span className="font-mono text-3xl font-black text-[var(--text-primary)]">18d</span>
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold text-center">Fast-track cycle</p>
        </div>
      </div>

      {/* Candidate Pipeline Tactile Card */}
      <div className="skeuo-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-amber-500" />
            <h3 className="font-bold text-sm text-[var(--text-primary)]">Candidate Pipeline & AI Match Highlights</h3>
          </div>
          <Link href="/recruitment" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
            Open Full Kanban Board &rarr;
          </Link>
        </div>

        <div className="divide-y divide-[var(--border-subtle)]">
          {applications.map((app) => (
            <div key={app.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-[var(--text-primary)]">{app.candidate_name}</span>
                  <span className="skeuo-pill px-2.5 py-0.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                    {app.ai_match_score}% Match
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-1 font-mono">{app.job_title} &middot; {app.candidate_email}</p>
                {app.ai_screening_summary && (
                  <p className="mt-2 text-xs text-[var(--text-secondary)] skeuo-inset p-2.5">
                    💡 <em>{app.ai_screening_summary}</em>
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="skeuo-pill px-3 py-1 text-xs uppercase text-indigo-600 dark:text-indigo-400">
                  {app.stage}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
