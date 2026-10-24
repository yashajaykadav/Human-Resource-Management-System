"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import {
  X,
  Send,
  Sparkles,
  Bot,
  User as UserIcon,
  CheckCircle,
  Zap
} from 'lucide-react';

interface ActionCard {
  action_type: string;
  title: string;
  description: string;
  payload: Record<string, any>;
  requires_confirmation: boolean;
}

interface Message {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  suggested_actions?: string[];
  action_card?: ActionCard | null;
  llm_provider?: string;
  timestamp: string;
}

export const AgentDrawer: React.FC = () => {
  const { user, copilotOpen, setCopilotOpen } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'agent',
      text: `Hello ${user?.first_name || 'there'}! I am your **Role-Based HRMS Copilot**.\n\nI can inspect balances, query policy handbooks (RAG), and prepare authorized actions for you.`,
      suggested_actions: [
        'Check my leave balance',
        'Apply for casual leave',
        'What is our remote work policy?',
        'Show team attendance today'
      ],
      timestamp: 'Just now'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (textToSend?: string, confirmedAction?: ActionCard) => {
    const text = textToSend || input;
    if (!text.trim() && !confirmedAction) return;

    if (!confirmedAction) {
      const userMsg: Message = {
        id: Date.now().toString(),
        sender: 'user',
        text: text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
    }

    setLoading(true);
    try {
      const res = await apiRequest<{
        reply: string;
        suggested_actions: string[];
        action_card: ActionCard | null;
        llm_provider_used: string;
      }>('/agent/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: text,
          confirmed_action: confirmedAction ? {
            action_type: confirmedAction.action_type,
            payload: confirmedAction.payload
          } : null
        })
      });

      const agentMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'agent',
        text: res.reply,
        suggested_actions: res.suggested_actions,
        action_card: res.action_card,
        llm_provider: res.llm_provider_used,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, agentMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: 'agent',
          text: `⚠️ **Agent Execution Error**: ${err.message || 'Unable to connect to agent service.'}`,
          timestamp: 'Just now'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!copilotOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-[var(--bg-surface)] border-l border-[var(--border-soft)] shadow-[-12px_0_30px_rgba(0,0,0,0.15)] dark:shadow-[-12px_0_40px_rgba(0,0,0,0.6)] transition-all">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-5 py-4 bg-[var(--bg-surface-elevated)]">
        <div className="flex items-center gap-3">
          <div className="skeuo-card-soft flex h-9 w-9 items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-[var(--text-primary)]">Tactile HR Copilot</h3>
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_#34d399]" />
              <span>ROLE: <strong className="text-[var(--text-primary)] uppercase">{user?.role?.replace('_', ' ')}</strong></span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setCopilotOpen(false)}
          className="skeuo-btn h-8 w-8 p-0 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[var(--bg-canvas)]">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[90%] p-4 text-xs sm:text-sm ${
                m.sender === 'user'
                  ? 'skeuo-btn-primary rounded-2xl rounded-br-xs !text-left'
                  : 'skeuo-card rounded-2xl rounded-bl-xs text-[var(--text-primary)]'
              }`}
            >
              <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>

              {/* Action Card: Tactile Cassette */}
              {m.action_card && (
                <div className="mt-3.5 rounded-xl skeuo-inset p-3.5 text-[var(--text-primary)] border border-indigo-200/50 dark:border-indigo-900/50">
                  <div className="flex items-center gap-2 font-bold text-xs text-indigo-600 dark:text-indigo-400">
                    <Zap className="h-3.5 w-3.5" />
                    <span>{m.action_card.title}</span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">{m.action_card.description}</p>
                  
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => handleSendMessage(undefined, m.action_card!)}
                      className="skeuo-btn-primary text-xs py-1 px-3"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      <span>Confirm & Execute</span>
                    </button>
                    <button
                      onClick={() => {
                        setMessages((prev) => [
                          ...prev,
                          {
                            id: Date.now().toString(),
                            sender: 'agent',
                            text: "Action cancelled.",
                            timestamp: 'Just now'
                          }
                        ]);
                      }}
                      className="skeuo-btn text-xs py-1 px-2.5 text-[var(--text-muted)]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--text-muted)] opacity-80">
                <span>{m.timestamp}</span>
                {m.llm_provider && (
                  <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-md bg-[var(--bg-canvas)] border border-[var(--border-subtle)] flex items-center gap-1 font-semibold">
                    {m.llm_provider === 'gemini' && <span>✨ Gemini</span>}
                    {m.llm_provider === 'ollama' && <span>🦙 Ollama</span>}
                    {m.llm_provider !== 'gemini' && m.llm_provider !== 'ollama' && <span>⚡ {m.llm_provider}</span>}
                  </span>
                )}
              </div>
            </div>

            {/* Suggested Action Pills */}
            {m.suggested_actions && m.suggested_actions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5 max-w-[92%]">
                {m.suggested_actions.map((act) => (
                  <button
                    key={act}
                    onClick={() => handleSendMessage(act)}
                    className="skeuo-pill px-3 py-1 text-[11px] text-indigo-600 dark:text-indigo-400 bg-[var(--bg-surface)] hover:brightness-105 transition"
                  >
                    {act}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="skeuo-card-soft flex items-center gap-2 text-xs text-[var(--text-muted)] p-2.5 w-fit">
            <Sparkles className="h-3.5 w-3.5 animate-spin text-indigo-600" />
            <span>Agent reasoning & querying tools...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Tray */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="border-t border-[var(--border-soft)] bg-[var(--bg-surface)] p-3"
      >
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask tactile copilot as ${user?.role?.replace('_', ' ')}...`}
            className="skeuo-inset flex-1 px-3.5 py-2 text-xs sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="skeuo-btn-primary h-9 w-9 p-0 flex items-center justify-center disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
