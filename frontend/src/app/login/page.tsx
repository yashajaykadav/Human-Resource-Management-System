"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Bot, Sparkles, Sun, Moon } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (em: string, pw: string) => {
    setLoading(true);
    setError('');
    try {
      await login(em, pw);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[85vh] flex-col items-center justify-center py-10 px-4 sm:px-6 lg:px-8">
      {/* Theme Toggle in top right */}
      <div className="fixed top-6 right-6">
        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          className="skeuo-btn h-10 w-10 p-0 text-[var(--text-secondary)]"
        >
          {theme === 'light' ? <Moon className="h-4 w-4 text-slate-700" /> : <Sun className="h-4 w-4 text-amber-400" />}
        </button>
      </div>

      <div className="w-full max-w-xl space-y-6">
        <div className="text-center">
          <div className="mx-auto skeuo-card-soft flex h-14 w-14 items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Bot className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-2xl sm:text-3xl font-black tracking-tight text-[var(--text-primary)]">
            Sign In to Apryde HRMS
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-[var(--text-muted)]">
            Tactile Role-Based Autonomous Agent Intelligence & Workstation
          </p>
        </div>

        {/* Quick Demo Access Roles */}
        <div className="skeuo-card p-6">
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-[var(--text-muted)]">
                Demo Accounts (1-Click Instant Login)
              </h3>
            </div>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">Seeded Credentials</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {[
              { name: 'Alex Admin', role: 'Super Admin', email: 'admin@company.com', pw: 'admin123', badge: 'Full Root' },
              { name: 'Helen HR', role: 'HR Admin', email: 'hr@company.com', pw: 'hr123', badge: 'HR Command' },
              { name: 'Marcus Manager', role: 'Team Manager', email: 'manager@company.com', pw: 'manager123', badge: 'Team Hub' },
              { name: 'Alice Chen', role: 'Employee (ESS)', email: 'employee@company.com', pw: 'emp123', badge: 'Self-Service' },
              { name: 'Rachel Recruiter', role: 'Recruiter', email: 'recruiter@company.com', pw: 'recruiter123', badge: 'Talent / ATS' },
              { name: 'Peter Payroll', role: 'Payroll Specialist', email: 'payroll@company.com', pw: 'payroll123', badge: 'Finance' },
            ].map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => handleQuickLogin(acc.email, acc.pw)}
                disabled={loading}
                className="skeuo-btn p-3 text-left flex items-center justify-between group hover:border-indigo-500 transition-all text-xs"
              >
                <div className="min-w-0 pr-2">
                  <div className="font-extrabold text-[var(--text-primary)] truncate">{acc.name}</div>
                  <div className="text-[10px] text-[var(--text-muted)] font-mono truncate">{acc.email}</div>
                  <div className="text-[9px] text-indigo-600 dark:text-indigo-400 font-semibold">{acc.role}</div>
                </div>
                <span className="skeuo-pill px-2 py-0.5 text-[9px] font-black uppercase tracking-wider shrink-0 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  Sign In →
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Standard Login */}
        <form onSubmit={handleSubmit} className="skeuo-card p-6 space-y-4">
          {error && (
            <div className="skeuo-inset p-3 text-xs text-rose-600 font-bold">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Corporate Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="skeuo-inset w-full px-4 py-2.5 text-xs sm:text-sm text-[var(--text-primary)] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="skeuo-inset w-full px-4 py-2.5 text-xs sm:text-sm text-[var(--text-primary)] focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="skeuo-btn-primary w-full py-2.5 text-xs sm:text-sm font-bold"
          >
            {loading ? 'Authenticating...' : 'Sign In to Console'}
          </button>
        </form>
      </div>
    </div>
  );
}
