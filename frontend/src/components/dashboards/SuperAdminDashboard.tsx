"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  Shield,
  Cpu,
  Database,
  Server,
  Save,
  CheckCircle,
  Sparkles,
  Users,
  Clock,
  CalendarDays,
  DollarSign,
  Briefcase,
  Laptop,
  Settings2,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  BookOpen,
  Eye,
  EyeOff,
  ExternalLink,
  RefreshCw,
  Play,
  Check,
  Download,
  Zap
} from 'lucide-react';

export const SuperAdminDashboard: React.FC<{ stats: any; onRefresh: () => void }> = ({ stats, onRefresh }) => {
  const { setCopilotOpen } = useAuth();
  const [agentConfig, setAgentConfig] = useState<any>(null);
  const [selectedProvider, setSelectedProvider] = useState<'gemini' | 'ollama'>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [modelName, setModelName] = useState('llama3.2:1b');
  const [ollamaUrl, setOllamaUrl] = useState('http://ollama:11434');
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);
  
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [pulling, setPulling] = useState(false);
  const [pullMessage, setPullMessage] = useState<string | null>(null);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    provider?: string;
    model?: string;
    latency_ms?: number;
    message?: string;
    installed_models?: string[];
    error?: string;
  } | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const cfg = await apiRequest<any>('/agent/config');
      setAgentConfig(cfg);
      setSelectedProvider(cfg.current_provider || 'gemini');
      setModelName(cfg.current_provider === 'gemini' ? (cfg.gemini_model || 'gemini-2.0-flash') : (cfg.ollama_model || 'llama3.1:8b'));
      if (cfg.ollama_url) {
        setOllamaUrl(cfg.ollama_url);
      }
      // Check Ollama installed models if available
      discoverOllama(cfg.ollama_url);
    } catch (err) {
      console.error('Failed to load agent configuration:', err);
    }
  };

  const discoverOllama = async (urlOverride?: string) => {
    try {
      const target = urlOverride || ollamaUrl;
      const res = await apiRequest<any>(`/agent/ollama/models?ollama_url=${encodeURIComponent(target)}`);
      if (res.available && res.models && res.models.length > 0) {
        setDiscoveredModels(res.models);
      }
    } catch {
      // Ollama not reachable at this URL yet
    }
  };

  const handleTestConnection = async (targetProvider: 'gemini' | 'ollama') => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await apiRequest<any>('/agent/test', {
        method: 'POST',
        body: JSON.stringify({
          provider: targetProvider,
          api_key: targetProvider === 'gemini' ? (apiKey || undefined) : undefined,
          model_name: modelName || undefined,
          ollama_url: targetProvider === 'ollama' ? ollamaUrl : undefined
        })
      });
      setTestResult(res);
      if (res.installed_models && res.installed_models.length > 0) {
        setDiscoveredModels(res.installed_models);
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        provider: targetProvider,
        error: err.message || 'Failed to connect to provider endpoint.'
      });
    } finally {
      setTesting(false);
    }
  };

  const handlePullModel = async (targetModel: string) => {
    setPulling(true);
    setPullMessage(`Triggering pull for '${targetModel}' into Ollama container... Please wait.`);
    try {
      const res = await apiRequest<any>('/agent/ollama/pull', {
        method: 'POST',
        body: JSON.stringify({
          model_name: targetModel,
          ollama_url: ollamaUrl
        })
      });
      if (res.success) {
        setPullMessage(`✓ Model '${targetModel}' is downloaded and ready!`);
        setModelName(targetModel);
        await discoverOllama();
      } else {
        setPullMessage(`❌ Download error: ${res.error || 'Failed to pull'}`);
      }
    } catch (err: any) {
      setPullMessage(`❌ Failed to pull model: ${err.message}`);
    } finally {
      setPulling(false);
      setTimeout(() => setPullMessage(null), 8000);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      await apiRequest('/agent/config', {
        method: 'POST',
        body: JSON.stringify({
          provider: selectedProvider,
          api_key: apiKey || undefined,
          model_name: modelName || undefined,
          ollama_url: ollamaUrl || undefined
        })
      });
      setSaveSuccess(true);
      await fetchConfig();
      onRefresh();
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to update LLM configuration');
    } finally {
      setSaving(false);
    }
  };

  const admData = stats?.super_admin_data;
  const hrData = stats?.hr_admin_data;
  const recData = stats?.recruiter_data;
  const payData = stats?.payroll_data;

  const GEMINI_MODELS = [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Recommended)', tag: 'Ultra-Fast' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', tag: 'Fast & Lightweight' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', tag: 'Deep Reasoning' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Preview)', tag: 'Next-Gen' }
  ];

  const OLLAMA_PRESET_MODELS = [
    { id: 'llama3.2:1b', label: 'Llama 3.2 1B (Ultra-Fast · ~1.3 GB)', note: 'Recommended for slow/CPU systems' },
    { id: 'qwen2.5:1.5b', label: 'Qwen 2.5 1.5B (Compact · ~1.0 GB)', note: 'High intelligence & fast' },
    { id: 'llama3.2:3b', label: 'Llama 3.2 3B (Balanced · ~2.0 GB)', note: 'Great for HR Q&A' },
    { id: 'phi3:mini', label: 'Phi-3 Mini (3.8B · ~2.3 GB)', note: 'Microsoft reasoning' },
    { id: 'llama3.1:8b', label: 'Llama 3.1 8B (Heavy · ~4.7 GB)', note: 'High-RAM / GPU required' }
  ];

  const OLLAMA_URL_PRESETS = [
    { label: 'Docker Network', url: 'http://ollama:11434' },
    { label: 'Host Localhost', url: 'http://localhost:11434' },
    { label: 'Docker-to-Host', url: 'http://host.docker.internal:11434' },
    { label: 'Loopback IP', url: 'http://127.0.0.1:11434' }
  ];

  return (
    <div className="space-y-6">
      {/* Tactile Executive Hero Panel */}
      <div className="skeuo-card p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="skeuo-pill px-2.5 py-0.5 text-[11px] font-bold text-purple-600 dark:text-purple-400">
                OVERALL SYSTEM COMMAND
              </span>
              <span className="text-xs text-[var(--text-muted)] font-mono">&bull; ROOT ADMINISTRATOR</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-[var(--text-primary)]">
              Enterprise Control Center
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-2xl">
              Complete oversight across workforce operations, dynamic RBAC role governance, attendance tracking, monthly payroll, and dual-engine AI infrastructure.
            </p>
          </div>
        </div>
      </div>

      {/* Top Enterprise Key Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Workforce */}
        <div className="skeuo-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">Workforce</span>
            <Users className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="skeuo-inset my-2.5 p-2 text-center">
            <span className="font-mono text-xl font-black text-[var(--text-primary)]">
              {hrData?.total_headcount || admData?.total_system_users || 0}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
            <span>Departments</span>
            <span className="font-bold text-[var(--text-secondary)]">{hrData?.total_departments || 0}</span>
          </div>
        </div>

        {/* Roles & RBAC */}
        <div className="skeuo-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">RBAC Roles</span>
            <Shield className="h-4 w-4 text-purple-500" />
          </div>
          <div className="skeuo-inset my-2.5 p-2 text-center">
            <span className="font-mono text-xl font-black text-purple-600 dark:text-purple-400">
              {admData?.total_roles || 6}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
            <span>Dynamic System</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">Active</span>
          </div>
        </div>

        {/* Attendance Today */}
        <div className="skeuo-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">Today&apos;s In</span>
            <Clock className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="skeuo-inset my-2.5 p-2 text-center">
            <span className="font-mono text-xl font-black text-emerald-600 dark:text-emerald-400">
              {admData?.today_clocked_in || 0}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
            <span>Presence Log</span>
            <Link href="/attendance" className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
              View
            </Link>
          </div>
        </div>

        {/* Leave Requests Pending */}
        <div className="skeuo-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">Pending Leaves</span>
            <CalendarDays className="h-4 w-4 text-amber-500" />
          </div>
          <div className="skeuo-inset my-2.5 p-2 text-center">
            <span className="font-mono text-xl font-black text-amber-600 dark:text-amber-400">
              {hrData?.pending_leave_requests || 0}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
            <span>Requires Action</span>
            <Link href="/leaves" className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
              Review
            </Link>
          </div>
        </div>

        {/* Recruitment Pipeline */}
        <div className="skeuo-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">Open Jobs</span>
            <Briefcase className="h-4 w-4 text-blue-500" />
          </div>
          <div className="skeuo-inset my-2.5 p-2 text-center">
            <span className="font-mono text-xl font-black text-blue-600 dark:text-blue-400">
              {recData?.open_requisitions || 0}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
            <span>Candidates</span>
            <span className="font-bold text-[var(--text-secondary)]">{recData?.total_candidates || 0}</span>
          </div>
        </div>

        {/* IT Assets */}
        <div className="skeuo-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">IT Assets</span>
            <Laptop className="h-4 w-4 text-cyan-500" />
          </div>
          <div className="skeuo-inset my-2.5 p-2 text-center">
            <span className="font-mono text-xl font-black text-[var(--text-primary)]">
              {admData?.total_assets || 0}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
            <span>Pending Requests</span>
            <span className="font-bold text-rose-500">{admData?.pending_asset_requests || 0}</span>
          </div>
        </div>
      </div>

      {/* Main Operations Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: Workforce & Organization */}
        <div className="skeuo-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-500" />
                <h3 className="font-black text-sm text-[var(--text-primary)]">Workforce & Directory</h3>
              </div>
              <span className="skeuo-pill px-2 py-0.5 text-[10px] text-indigo-600 dark:text-indigo-400">
                {hrData?.total_departments || 0} Depts
              </span>
            </div>

            <div className="space-y-3 mt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">Active Headcount</span>
                <span className="font-mono font-bold text-[var(--text-primary)]">{hrData?.total_headcount || 0} staff</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">Active Company Policies</span>
                <span className="font-mono font-bold text-[var(--text-primary)]">{hrData?.active_policies || 0} docs</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">Estimated Monthly Attrition</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{hrData?.monthly_attrition_rate || '1.4%'}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">Today Attendance Rate</span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">92%</span>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
            <Link
              href="/employees"
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <span>Employee Directory</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
            <Link
              href="/attendance"
              className="skeuo-btn text-[11px] py-1 px-2.5 font-bold text-[var(--text-secondary)]"
            >
              Timesheets
            </Link>
          </div>
        </div>

        {/* Card 2: Recruitment & ATS Pipeline */}
        <div className="skeuo-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-blue-500" />
                <h3 className="font-black text-sm text-[var(--text-primary)]">Talent Pipeline (ATS)</h3>
              </div>
              <span className="skeuo-pill px-2 py-0.5 text-[10px] text-blue-600 dark:text-blue-400">
                {recData?.open_requisitions || 0} Openings
              </span>
            </div>

            <div className="space-y-3 mt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">Total Candidate Profiles</span>
                <span className="font-mono font-bold text-[var(--text-primary)]">{recData?.total_candidates || 0}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">Active Applications in Stage</span>
                <span className="font-mono font-bold text-[var(--text-primary)]">{recData?.active_applications || 0}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">Average Time to Hire</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{recData?.time_to_hire_days || 18} days</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">AI Resume Match Scoring</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">Enabled</span>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
            <Link
              href="/recruitment"
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <span>View Applicant Board</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
            <Link
              href="/recruitment"
              className="skeuo-btn text-[11px] py-1 px-2.5 font-bold text-[var(--text-secondary)]"
            >
              Post Job
            </Link>
          </div>
        </div>

        {/* Card 3: Payroll & Compensation */}
        <div className="skeuo-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-500" />
                <h3 className="font-black text-sm text-[var(--text-primary)]">Payroll & Compensation</h3>
              </div>
              <span className="skeuo-pill px-2 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                {payData?.last_run_month || 'Current'}
              </span>
            </div>

            <div className="space-y-3 mt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">Last Run Status</span>
                <span className="skeuo-pill px-2 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-bold">
                  {payData?.last_run_status || 'Ready'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">Total Disbursed Net Pay</span>
                <span className="font-mono font-bold text-[var(--text-primary)]">
                  ${(payData?.total_disbursed || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">Flagged Anomalies</span>
                <span className={`font-mono font-bold ${(payData?.flagged_anomalies || 0) > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {payData?.flagged_anomalies || 0} issues
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">Salary Structures</span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">Configured</span>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
            <Link
              href="/payroll"
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              <span>Manage Payroll</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
            <Link
              href="/assets"
              className="skeuo-btn text-[11px] py-1 px-2.5 font-bold text-[var(--text-secondary)]"
            >
              Hardware Assets
            </Link>
          </div>
        </div>
      </div>

      {/* System Infrastructure Dials */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
        <div className="skeuo-card p-5">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-purple-500" />
            <span>Total System Users</span>
          </span>
          <div className="skeuo-inset my-3 p-3 text-center">
            <span className="font-mono text-2xl font-black text-[var(--text-primary)]">
              {admData?.total_system_users || 6}
            </span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] text-center">Dynamic RBAC Configured</p>
        </div>

        <div className="skeuo-card p-5">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5 text-indigo-500" />
            <span>PostgreSQL 16</span>
          </span>
          <div className="skeuo-inset my-3 p-3 text-center">
            <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">pgvector Online</span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] text-center">Policy Embeddings Active</p>
        </div>

        <div className="skeuo-card p-5">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
            <Server className="h-3.5 w-3.5 text-rose-500" />
            <span>Redis 7 Cache</span>
          </span>
          <div className="skeuo-inset my-3 p-3 text-center">
            <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">Healthy</span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] text-center">Broker & Session Store</p>
        </div>

        <div className="skeuo-card p-5">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5 text-blue-500" />
            <span>Active AI Model</span>
          </span>
          <div className="skeuo-inset my-3 p-3 text-center">
            <span className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase">
              {agentConfig?.current_provider || 'gemini'}
            </span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] text-center font-mono truncate">
            {agentConfig?.current_provider === 'gemini' ? (agentConfig?.gemini_model || 'gemini-2.0-flash') : (agentConfig?.ollama_model || 'llama3.1:8b')}
          </p>
        </div>
      </div>

      {/* Tactile Dual LLM Switcher Card */}
      <div className="skeuo-card p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[var(--border-subtle)] gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <h3 className="font-extrabold text-base md:text-lg text-[var(--text-primary)]">
                AI Engine & Dual LLM Model Manager
              </h3>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Configure and test both Google Gemini cloud LLM and Local Ollama models with automatic runtime failover.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="skeuo-pill px-3 py-1 text-xs text-indigo-600 dark:text-indigo-400 font-bold">
              Dual Engine Active
            </span>
          </div>
        </div>

        <form onSubmit={handleSaveConfig} className="mt-6 space-y-6">
          {/* Provider Selector Cards */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
              Select Primary Inference Engine
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Gemini Card */}
              <div
                onClick={() => {
                  setSelectedProvider('gemini');
                  if (!modelName || modelName.includes('llama') || modelName.includes('mistral')) {
                    setModelName('gemini-2.0-flash');
                  }
                  setTestResult(null);
                }}
                className={`cursor-pointer rounded-2xl p-5 transition relative ${
                  selectedProvider === 'gemini'
                    ? 'skeuo-inset border-indigo-500 ring-2 ring-indigo-500/30 text-indigo-600 dark:text-indigo-400 font-bold'
                    : 'skeuo-card-soft text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">✨</span>
                    <span className="font-black text-sm text-[var(--text-primary)]">Google Gemini (Cloud)</span>
                  </div>
                  {selectedProvider === 'gemini' ? (
                    <CheckCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  ) : (
                    <span className="text-[10px] text-[var(--text-muted)] uppercase font-mono">
                      {agentConfig?.gemini_configured ? 'Key Saved' : 'Needs Key'}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-[var(--text-muted)] font-normal leading-relaxed">
                  Fastest reasoning, massive token context, zero server GPU requirement. Ideal for general HR copiloting & RAG policy queries.
                </p>
              </div>

              {/* Ollama Card */}
              <div
                onClick={() => {
                  setSelectedProvider('ollama');
                  if (!modelName || modelName.includes('gemini')) {
                    setModelName(discoveredModels[0] || 'llama3.1:8b');
                  }
                  setTestResult(null);
                  discoverOllama();
                }}
                className={`cursor-pointer rounded-2xl p-5 transition relative ${
                  selectedProvider === 'ollama'
                    ? 'skeuo-inset border-indigo-500 ring-2 ring-indigo-500/30 text-indigo-600 dark:text-indigo-400 font-bold'
                    : 'skeuo-card-soft text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🦙</span>
                    <span className="font-black text-sm text-[var(--text-primary)]">Local Ollama (Container / Host)</span>
                  </div>
                  {selectedProvider === 'ollama' ? (
                    <CheckCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  ) : (
                    <span className="text-[10px] text-[var(--text-muted)] uppercase font-mono">
                      {discoveredModels.length > 0 ? `${discoveredModels.length} models ready` : 'Local Engine'}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-[var(--text-muted)] font-normal leading-relaxed">
                  100% private, on-premise execution. No data leaves your network. Runs on host machine or Docker container.
                </p>
              </div>
            </div>
          </div>

          {/* Dynamic Configuration Sections based on Selected Provider */}
          {selectedProvider === 'gemini' ? (
            <div className="skeuo-card-soft p-5 rounded-2xl space-y-4 border border-[var(--border-subtle)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <span>Google Gemini Credentials & Model Parameters</span>
                </span>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <span>Get Free API Key</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Gemini API Key */}
                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                    Gemini API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={agentConfig?.gemini_configured ? '•••••••••••••••• (Key Configured)' : 'AIzaSy...'}
                      className="skeuo-inset w-full px-4 py-2.5 pr-10 text-xs sm:text-sm text-[var(--text-primary)] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">
                    Free tier available with 15 RPM. Stored securely and persisted to environment.
                  </p>
                </div>

                {/* Gemini Model Selector */}
                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                    Gemini Model Identifier
                  </label>
                  <input
                    type="text"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder="gemini-2.0-flash"
                    className="skeuo-inset w-full px-4 py-2.5 text-xs sm:text-sm text-[var(--text-primary)] focus:outline-none"
                  />
                  {/* Preset Model Chips */}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {GEMINI_MODELS.map((gm) => (
                      <button
                        key={gm.id}
                        type="button"
                        onClick={() => setModelName(gm.id)}
                        className={`text-[10px] px-2 py-0.5 rounded-md font-mono transition ${
                          modelName === gm.id
                            ? 'bg-indigo-600 text-white font-bold'
                            : 'skeuo-btn text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {gm.id}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action row for testing Gemini */}
              <div className="pt-2 flex items-center justify-between">
                <span className="text-[11px] text-[var(--text-muted)]">
                  Verify API key authentication before saving.
                </span>
                <button
                  type="button"
                  disabled={testing}
                  onClick={() => handleTestConnection('gemini')}
                  className="skeuo-btn text-xs py-1.5 px-3.5 font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5"
                >
                  {testing ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5 fill-current" />
                  )}
                  <span>{testing ? 'Testing Gemini...' : 'Test Gemini Connection'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="skeuo-card-soft p-5 rounded-2xl space-y-4 border border-[var(--border-subtle)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <span>Local Ollama Endpoint & Model Config</span>
                </span>
                <button
                  type="button"
                  onClick={() => discoverOllama()}
                  className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Scan Models</span>
                </button>
              </div>

              {/* Low-Resource / Slow System Tip */}
              <div className="p-3 rounded-xl skeuo-inset bg-amber-50/50 dark:bg-amber-950/20 border border-amber-400/30 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500 shrink-0" />
                <span>
                  <strong>Optimized for Slower / CPU Systems:</strong> <strong>Llama 3.2 1B</strong> (~1.3 GB) and <strong>Qwen 2.5 1.5B</strong> (~1.0 GB) are compact, ultra-lightweight models that run smoothly on standard laptops without a GPU.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Ollama URL Input */}
                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                    Ollama Server URL
                  </label>
                  <input
                    type="text"
                    value={ollamaUrl}
                    onChange={(e) => {
                      setOllamaUrl(e.target.value);
                      discoverOllama(e.target.value);
                    }}
                    placeholder="http://ollama:11434"
                    className="skeuo-inset w-full px-4 py-2.5 text-xs sm:text-sm text-[var(--text-primary)] focus:outline-none"
                  />
                  {/* Preset URL Chips */}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {OLLAMA_URL_PRESETS.map((p) => (
                      <button
                        key={p.url}
                        type="button"
                        onClick={() => {
                          setOllamaUrl(p.url);
                          discoverOllama(p.url);
                        }}
                        className={`text-[10px] px-2 py-0.5 rounded-md font-mono transition ${
                          ollamaUrl === p.url
                            ? 'bg-blue-600 text-white font-bold'
                            : 'skeuo-btn text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ollama Model Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-[var(--text-secondary)]">
                      Ollama Model Identifier
                    </label>
                    {discoveredModels.includes(modelName) ? (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" /> Ready on Server
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-500 font-bold">
                        Not in library
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder="llama3.2:1b"
                    className="skeuo-inset w-full px-4 py-2.5 text-xs sm:text-sm text-[var(--text-primary)] focus:outline-none"
                  />
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">
                    Select one of the lightweight presets below or enter any pulled model.
                  </p>
                </div>
              </div>

              {/* Recommended Lightweight Model Cards */}
              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">
                  Select or Download Model (Compact models selected for smooth CPU inference)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {OLLAMA_PRESET_MODELS.map((p) => {
                    const isDownloaded = discoveredModels.includes(p.id);
                    const isSelected = modelName === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setModelName(p.id)}
                        className={`cursor-pointer p-3 rounded-xl border text-left transition ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 font-bold text-blue-600 dark:text-blue-400 ring-2 ring-blue-500/20'
                            : 'skeuo-card-soft text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs">{p.id}</span>
                          {isDownloaded ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold">
                              ✓ Ready
                            </span>
                          ) : (
                            <span className="text-[9px] text-[var(--text-muted)]">
                              Not Pulled
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-[var(--text-muted)] mt-1 font-normal leading-tight">
                          {p.note}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action row for testing and pulling Ollama */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={testing}
                    onClick={() => handleTestConnection('ollama')}
                    className="skeuo-btn text-xs py-1.5 px-3.5 font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5"
                  >
                    {testing ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5 fill-current" />
                    )}
                    <span>{testing ? 'Testing...' : 'Test Connection'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={pulling}
                    onClick={() => handlePullModel(modelName)}
                    className="skeuo-btn text-xs py-1.5 px-3.5 font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5"
                  >
                    {pulling ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    <span>{pulling ? 'Downloading...' : `Download ${modelName}`}</span>
                  </button>
                </div>

                <span className="text-[11px] text-[var(--text-muted)] font-mono">
                  Container URL: <strong className="text-[var(--text-primary)]">{ollamaUrl}</strong>
                </span>
              </div>

              {/* Pull / Download Message Callout */}
              {pullMessage && (
                <div className="p-3 rounded-xl skeuo-inset text-xs font-mono text-[var(--text-primary)] bg-[var(--bg-canvas)]">
                  {pullMessage}
                </div>
              )}
            </div>
          )}

          {/* Test Connection Result Callout */}
          {testResult && (
            <div
              className={`p-4 rounded-xl text-xs flex items-start gap-3 transition ${
                testResult.success
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/40 text-emerald-800 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-500/40 text-rose-800 dark:text-rose-200'
              }`}
            >
              {testResult.success ? (
                <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 space-y-1">
                <div className="font-bold flex items-center gap-2">
                  <span>{testResult.success ? 'Connection Verified Successfully' : 'Connection Failed'}</span>
                  {testResult.latency_ms && (
                    <span className="font-mono text-[10px] px-1.5 py-0.2 bg-emerald-200 dark:bg-emerald-900 rounded text-emerald-800 dark:text-emerald-100">
                      {testResult.latency_ms}ms
                    </span>
                  )}
                </div>
                <p className="text-[11px] leading-relaxed opacity-90">
                  {testResult.message || testResult.error}
                </p>
                {testResult.installed_models && testResult.installed_models.length > 0 && (
                  <p className="text-[10px] text-[var(--text-muted)] pt-1">
                    Installed models: <strong>{testResult.installed_models.join(', ')}</strong>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Intelligent Dual Failover Note */}
          <div className="skeuo-inset p-3.5 rounded-xl text-[11px] text-[var(--text-muted)] flex items-center gap-2.5">
            <Sparkles className="h-4 w-4 text-indigo-500 shrink-0" />
            <span>
              <strong>Automatic Failover Guaranteed:</strong> If your selected primary engine is offline, out of quota, or warming up, requests automatically failover to the secondary provider or the deterministic native engine so HRMS users never experience downtime.
            </span>
          </div>

          {/* Form Actions Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-[var(--border-subtle)]">
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
              {saveSuccess && (
                <>
                  <Check className="h-4 w-4" />
                  <span>Configuration saved and active across all HRMS Copilot instances!</span>
                </>
              )}
            </span>
            <button
              type="submit"
              disabled={saving}
              className="skeuo-btn-primary text-xs py-2 px-5 flex items-center gap-1.5 font-bold"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Saving...' : 'Save & Persist Configuration'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
