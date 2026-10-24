"use client";

import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { AuthGuard } from '@/components/auth/AuthGuard';
import {
  BookOpen,
  Sparkles,
  Plus,
  CheckCircle
} from 'lucide-react';

export default function PoliciesPage() {
  const { user, setCopilotOpen } = useAuth();
  const [policies, setPolicies] = useState<any[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<any>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('General');
  const [fullText, setFullText] = useState('');
  const [ingesting, setIngesting] = useState(false);

  useEffect(() => {
    // Only fetch data if user is authenticated
    if (user) {
      fetchPolicies();
    }
  }, [user]);

  const fetchPolicies = async () => {
    try {
      const list = await apiRequest('/policies');
      setPolicies(list);
      if (list.length > 0) {
        const full = await apiRequest(`/policies/${list[0].id}`);
        setSelectedPolicy(full);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectPolicy = async (id: string) => {
    try {
      const full = await apiRequest(`/policies/${id}`);
      setSelectedPolicy(full);
    } catch (err) {
      console.error(err);
    }
  };

  const handleIngestPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setIngesting(true);
    try {
      await apiRequest('/policies', {
        method: 'POST',
        body: JSON.stringify({
          title,
          category,
          full_text: fullText
        })
      });
      setShowUploadModal(false);
      setTitle('');
      setFullText('');
      await fetchPolicies();
      alert("Policy document ingested and indexed into pgvector!");
    } catch (err: any) {
      alert(err.message || 'Failed to ingest document');
    } finally {
      setIngesting(false);
    }
  };

  return (
    <AuthGuard module="policies">
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[var(--text-primary)]">Company Policy Vault & RAG Store</h1>
          <p className="text-xs text-[var(--text-secondary)]">Guidelines indexed with pgvector embeddings for AI Copilot grounding</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCopilotOpen(true)}
            className="skeuo-btn text-xs py-2 px-4 text-purple-600 dark:text-purple-400 font-bold"
          >
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>Search via AI</span>
          </button>
          {['super_admin', 'hr_admin'].includes(user?.role || '') && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="skeuo-btn-primary text-xs py-2 px-4"
            >
              <Plus className="h-4 w-4" />
              <span>Ingest Policy</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Policy Index List */}
        <div className="space-y-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
            INDEXED HANDBOOKS
          </span>
          {policies.map((p) => (
            <div
              key={p.id}
              onClick={() => handleSelectPolicy(p.id)}
              className={`cursor-pointer rounded-2xl p-4 transition ${
                selectedPolicy?.id === p.id
                  ? 'skeuo-inset border-indigo-500'
                  : 'skeuo-card hover:translate-y-[-1px]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-xs sm:text-sm text-[var(--text-primary)]">{p.title}</span>
                <span className="skeuo-pill px-2 py-0.5 text-[9px] uppercase font-bold text-[var(--text-muted)]">
                  {p.category}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-[var(--text-secondary)] line-clamp-2">{p.summary}</p>
            </div>
          ))}
        </div>

        {/* Selected Policy Viewer */}
        <div className="md:col-span-2 skeuo-card p-6 md:p-8">
          {selectedPolicy ? (
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]">
                <div>
                  <h2 className="text-xl font-black text-[var(--text-primary)]">{selectedPolicy.title}</h2>
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mt-1">
                    <span>Category: <strong>{selectedPolicy.category}</strong></span>
                    <span>&bull;</span>
                    <span>Version {selectedPolicy.version}</span>
                    <span>&bull;</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle className="h-3.5 w-3.5" /> pgvector Active
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setCopilotOpen(true)}
                  className="skeuo-btn text-xs py-1.5 px-3 text-indigo-600 dark:text-indigo-400 font-bold"
                >
                  Ask Question
                </button>
              </div>

              <div className="mt-6 skeuo-inset p-6 text-xs sm:text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-line font-serif">
                {selectedPolicy.full_text}
              </div>
            </div>
          ) : (
            <div className="skeuo-inset p-8 text-center text-xs text-[var(--text-muted)]">
              Select a policy to view clauses.
            </div>
          )}
        </div>
      </div>

      {/* Ingest Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="skeuo-card w-full max-w-lg p-6 shadow-2xl">
            <h3 className="font-black text-lg text-[var(--text-primary)]">Ingest New Policy Handbook</h3>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Document text will be chunked, embedded with pgvector, and queryable by AI Agents.
            </p>

            <form onSubmit={handleIngestPolicy} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Parental Leave and Childcare Assistance Policy"
                  className="skeuo-inset w-full p-2.5 text-xs sm:text-sm text-[var(--text-primary)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Category</label>
                <div className="skeuo-inset p-1">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-transparent p-2 text-xs sm:text-sm text-[var(--text-primary)] focus:outline-none"
                  >
                    <option value="General" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">General</option>
                    <option value="Absence Management" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">Absence Management</option>
                    <option value="Workplace" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">Workplace</option>
                    <option value="Finance" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">Finance</option>
                    <option value="Code of Conduct" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">Code of Conduct</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Full Document Text</label>
                <textarea
                  required
                  rows={6}
                  value={fullText}
                  onChange={(e) => setFullText(e.target.value)}
                  placeholder="Paste policy clauses here..."
                  className="skeuo-inset w-full p-2.5 text-xs font-mono text-[var(--text-primary)] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="skeuo-btn text-xs py-2 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={ingesting}
                  className="skeuo-btn-primary text-xs py-2 px-4"
                >
                  {ingesting ? 'Indexing...' : 'Ingest Document'}
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
