"use client";

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { HelpCircle, BookOpen, Mail, Phone, LifeBuoy, ArrowUpRight,Sparkles } from 'lucide-react';

export default function HelpPage() {
  const { user } = useAuth();

  if (!user) {
    return <div className="text-center py-8">Please login to access help</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[var(--text-primary)]">Help & Support</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">We're here to help you get the most out of Apryde AI HRMS</p>
        </div>
      </div>

      {/* Help Content Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Getting Started Card */}
        <div className="skeuo-card p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="skeuo-inset flex h-12 w-12 items-center justify-center text-indigo-600 dark:text-indigo-400">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Getting Started</h2>
              <p className="text-xs text-[var(--text-muted)]">New to Apryde? Learn the basics</p>
            </div>
          </div>
          <div className="space-y-3">
            <button className="w-full skeuo-btn-primary text-xs justify-between">
              <span>Quick Start Guide</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
            <button className="w-full skeuo-btn text-xs justify-between">
              <span>Video Tutorials</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
            <button className="w-full skeuo-btn text-xs justify-between">
              <span>User Manual</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Common Questions Card */}
        <div className="skeuo-card p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="skeuo-inset flex h-12 w-12 items-center justify-center text-emerald-600 dark:text-emerald-400">
              <LifeBuoy className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Common Questions</h2>
              <p className="text-xs text-[var(--text-muted)]">Quick answers to frequent queries</p>
            </div>
          </div>
          <div className="space-y-3">
            <details className="skeuo-inset p-3">
              <summary className="cursor-pointer text-xs font-bold text-[var(--text-primary)]">How do I request leave?</summary>
              <p className="text-xs text-[var(--text-muted)] mt-2">Navigate to the Leave module and click on "Request Leave". Select the type, dates, and add a reason. Your manager will be notified for approval.</p>
            </details>
            <details className="skeuo-inset p-3">
              <summary className="cursor-pointer text-xs font-bold text-[var(--text-primary)]">How do I check my attendance?</summary>
              <p className="text-xs text-[var(--text-muted)] mt-2">Go to the Attendance module to view your daily check-in/check-out times. You can also see your monthly summary.</p>
            </details>
            <details className="skeuo-inset p-3">
              <summary className="cursor-pointer text-xs font-bold text-[var(--text-primary)]">How do I update my profile?</summary>
              <p className="text-xs text-[var(--text-muted)] mt-2">Visit the Settings page from your profile dropdown to update your personal information, contact details, and preferences.</p>
            </details>
          </div>
        </div>

        {/* Contact Support Card */}
        <div className="skeuo-card p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="skeuo-inset flex h-12 w-12 items-center justify-center text-amber-600 dark:text-amber-400">
              <Mail className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Contact Support</h2>
              <p className="text-xs text-[var(--text-muted)]">Reach out to our support team</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="skeuo-inset p-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="skeuo-btn h-8 w-8 p-0 flex items-center justify-center">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[var(--text-primary)]">Email Support</p>
                    <p className="text-[10px] text-[var(--text-muted)] font-mono">support@apryde.ai</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="skeuo-btn h-8 w-8 p-0 flex items-center justify-center">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[var(--text-primary)]">Phone Support</p>
                    <p className="text-[10px] text-[var(--text-muted)] font-mono">+1 (555) 123-4567</p>
                  </div>
                </div>
              </div>
            </div>
            <button className="w-full skeuo-btn-primary text-xs">
              Open Support Ticket
            </button>
          </div>
        </div>

        {/* AI Assistant Card */}
        <div className="skeuo-card p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="skeuo-inset flex h-12 w-12 items-center justify-center text-purple-600 dark:text-purple-400">
              <HelpCircle className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">AI Assistant</h2>
              <p className="text-xs text-[var(--text-muted)]">Get instant help from our AI</p>
            </div>
          </div>
          <div className="skeuo-inset p-4 bg-indigo-50 dark:bg-indigo-900/20">
            <p className="text-xs text-[var(--text-primary)] mb-3">
              Try asking our AI assistant for help! Click the AI Copilot button in the navbar to get started.
            </p>
            <div className="flex flex-wrap gap-1">
              {['leave policy', 'attendance', 'payroll', 'onboarding'].map(tag => (
                <span key={tag} className="skeuo-pill px-2 py-0.5 text-[10px] text-indigo-600 dark:text-indigo-400">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <button className="w-full skeuo-btn-primary text-xs mt-4">
            <Sparkles className="h-3.5 w-3.5 mr-2" />
            Ask AI Assistant
          </button>
        </div>
      </div>

      {/* Systems Status */}
      <div className="skeuo-card p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="h-3 w-3 rounded-full bg-emerald-500" />
          <h2 className="text-lg font-bold text-[var(--text-primary)]">System Status</h2>
        </div>
        <p className="text-xs text-[var(--text-muted)] mb-4">All systems are operating normally</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { name: 'AI Processing', status: 'Operational', color: 'emerald' },
            { name: 'Database', status: 'Operational', color: 'emerald' },
            { name: 'Authentication', status: 'Operational', color: 'emerald' },
          ].map(service => (
            <div key={service.name} className="skeuo-inset p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-primary)]">{service.name}</span>
                <span className={`h-2 w-2 rounded-full bg-${service.color}-500`} />
              </div>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">{service.status}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
