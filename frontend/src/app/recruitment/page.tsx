"use client";

import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { AuthGuard } from '@/components/auth/AuthGuard';
import {
  Sparkles
} from 'lucide-react';

const STAGES = [
  { id: 'applied', label: 'Applied' },
  { id: 'screened', label: 'Screened' },
  { id: 'interview', label: 'Interview' },
  { id: 'offer', label: 'Offer' },
  { id: 'hired', label: 'Hired' },
];

export default function RecruitmentPage() {
  const { user, setCopilotOpen } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only fetch data if user is authenticated
    if (user) {
      fetchATS();
    }
  }, [user]);

  const fetchATS = async () => {
    setLoading(true);
    try {
      const [jList, aList] = await Promise.all([
        apiRequest('/recruitment/jobs'),
        apiRequest('/recruitment/applications')
      ]);
      setJobs(jList);
      setApplications(aList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStageChange = async (appId: string, newStage: string) => {
    try {
      await apiRequest(`/recruitment/applications/${appId}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({ stage: newStage })
      });
      await fetchATS();
    } catch (err: any) {
      alert(err.message || 'Failed to update stage');
    }
  };

  return (
    <AuthGuard module="recruitment">
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[var(--text-primary)]">Recruitment & ATS Kanban Pipeline</h1>
          <p className="text-xs text-[var(--text-secondary)]">Applicant pipeline with AI ATS semantic scoring and interview stages</p>
        </div>
        <button
          onClick={() => setCopilotOpen(true)}
          className="skeuo-btn text-xs py-2 px-4 text-amber-600 dark:text-amber-400 font-bold"
        >
          <Sparkles className="h-4 w-4 text-amber-500" />
          <span>Screen Candidates with AI</span>
        </button>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-4">
        {STAGES.map((col) => {
          const colApps = applications.filter((a) => a.stage === col.id);
          return (
            <div key={col.id} className="skeuo-card-soft p-3 flex flex-col min-w-[240px]">
              <div className="flex items-center justify-between px-2 py-1 mb-3">
                <span className="font-extrabold text-[11px] uppercase tracking-wider text-[var(--text-muted)]">{col.label}</span>
                <span className="skeuo-pill px-2 py-0.5 text-[10px] font-black text-[var(--text-primary)]">
                  {colApps.length}
                </span>
              </div>

              <div className="space-y-3 flex-1">
                {colApps.map((app) => (
                  <div
                    key={app.id}
                    className="skeuo-card p-4 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-extrabold text-xs sm:text-sm text-[var(--text-primary)]">{app.candidate_name}</h4>
                      <span className="skeuo-pill px-2 py-0.5 text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                        {app.ai_match_score}%
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] mt-1">{app.job_title}</p>

                    {app.parsed_skills && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {app.parsed_skills.split(',').slice(0, 3).map((skill: string) => (
                          <span key={skill} className="skeuo-pill px-1.5 py-0.5 text-[9px] text-[var(--text-secondary)] font-mono">
                            {skill.trim()}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 pt-2.5 border-t border-[var(--border-subtle)] flex items-center justify-between">
                      <span className="text-[10px] text-[var(--text-muted)]">Stage:</span>
                      <div className="skeuo-inset px-1.5 py-0.5">
                        <select
                          value={app.stage}
                          onChange={(e) => handleStageChange(app.id, e.target.value)}
                          className="bg-transparent text-[11px] font-bold text-[var(--text-primary)] focus:outline-none cursor-pointer"
                        >
                          {STAGES.map((s) => (
                            <option key={s.id} value={s.id} className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </AuthGuard>
  );
}
