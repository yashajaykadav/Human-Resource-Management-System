"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useSidebar } from '@/context/SidebarContext';
import { NotificationDropdown } from '@/components/notifications';
import {
  Bot,
  Sparkles,
  Sun,
  Moon,
  LogOut,
  ChevronDown,
  User,
  Settings,
  HelpCircle,
  PanelLeft,
  PanelLeftClose,
} from 'lucide-react';

function formatRole(role?: string | null): string {
  if (!role) return 'Employee';
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function getInitials(name?: string | null, email?: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return 'U';
}

export const Navbar: React.FC = () => {
  const { user, logout, copilotOpen, setCopilotOpen } = useAuth();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { isCollapsed, toggleCollapse, toggleMobileOpen } = useSidebar();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdown on click outside or escape key
  useEffect(() => {
    if (!dropdownOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDropdownOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dropdownOpen]);

  if (!user) {
    return (
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between px-6 bg-[var(--bg-surface)] border-b border-[var(--border-soft)]">
        <div className="h-9 w-28 rounded-lg bg-[var(--bg-surface-elevated)] animate-pulse" />
        <div className="h-9 w-24 rounded-full bg-[var(--bg-surface-elevated)] animate-pulse" />
      </header>
    );
  }

  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
  const userRole = formatRole(user.role_name || user.role);
  const initials = getInitials(fullName, user.email);

  const handleLogout = async () => {
    setDropdownOpen(false);
    try {
      await logout();
    } finally {
      router.replace('/login');
    }
  };

  const navigateTo = (path: string) => {
    setDropdownOpen(false);
    router.push(path);
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between px-3 sm:px-6 bg-[var(--bg-surface)] border-b border-[var(--border-soft)] shadow-xs">
      {/* Brand & Sidebar Collapse Toggle */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Navbar Sidebar Collapse Button */}
        <button
          type="button"
          onClick={() => {
            if (typeof window !== 'undefined' && window.innerWidth < 1024) {
              toggleMobileOpen();
            } else {
              toggleCollapse();
            }
          }}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="skeuo-btn h-9 w-9 p-0 flex items-center justify-center text-[var(--text-primary)] hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shrink-0"
        >
          {isCollapsed ? (
            <PanelLeft className="h-4.5 w-4.5" />
          ) : (
            <PanelLeftClose className="h-4.5 w-4.5" />
          )}
        </button>

        {/* Brand */}
        <div
          className="flex items-center gap-2.5 cursor-pointer select-none"
          onClick={() => router.push('/')}
        >
          <div className="skeuo-card-soft flex h-9 w-9 items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <Bot className="h-5 w-5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-base tracking-tight text-[var(--text-primary)]">
              Apryde
            </span>
            <span className="skeuo-pill px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
              HRMS
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        <NotificationDropdown />

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          className="skeuo-btn h-9 w-9 p-0 flex items-center justify-center text-[var(--text-primary)] hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shrink-0"
        >
          {mounted && theme === 'dark' ? (
            <Sun className="h-4.5 w-4.5 text-amber-400 fill-amber-400/25 transition-transform duration-200" />
          ) : (
            <Moon className="h-4.5 w-4.5 text-indigo-600 dark:text-indigo-400 fill-indigo-500/20 transition-transform duration-200" />
          )}
        </button>

        {/* AI Copilot Toggle */}
        <button
          type="button"
          onClick={() => setCopilotOpen(!copilotOpen)}
          className="skeuo-btn-primary text-xs flex items-center gap-1.5 py-2 px-3"
        >
          <Sparkles className="h-3.5 w-3.5 text-amber-300" />
          <span className="hidden sm:inline">AI Copilot</span>
          {copilotOpen && (
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
          )}
        </button>

        {/* Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen((prev) => !prev)}
            aria-expanded={dropdownOpen}
            aria-label="User menu"
            className="flex items-center gap-2 skeuo-btn px-2.5 py-1.5 h-auto rounded-full hover:bg-[var(--bg-surface-elevated)] transition-all"
          >
            <div className="skeuo-inset flex h-7 w-7 items-center justify-center rounded-full font-black text-xs text-indigo-600 dark:text-indigo-400">
              {initials}
            </div>

            <div className="hidden md:flex flex-col text-left max-w-[140px]">
              <span className="text-xs font-bold text-[var(--text-primary)] leading-tight truncate">
                {fullName}
              </span>
              <span className="text-[10px] text-[var(--text-muted)] leading-tight truncate">
                {userRole}
              </span>
            </div>

            <ChevronDown
              className={`h-3 w-3 text-[var(--text-muted)] transition-transform duration-200 ${
                dropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-60 skeuo-card shadow-2xl z-50 p-2 border border-[var(--border-soft)] animate-in fade-in slide-in-from-top-1 duration-150">
              {/* User info */}
              <div className="p-2.5 border-b border-[var(--border-subtle)] space-y-1">
                <p className="font-extrabold text-sm text-[var(--text-primary)] truncate">
                  {fullName}
                </p>
                <p className="text-[11px] text-[var(--text-muted)] font-mono truncate">
                  {user.email}
                </p>
                <div className="pt-1">
                  <span className="skeuo-pill px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                    {userRole}
                  </span>
                </div>
              </div>

              {/* Menu items */}
              <div className="py-1 space-y-0.5">
                <button
                  type="button"
                  onClick={() => navigateTo('/profile')}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-[var(--bg-canvas)] rounded-xl transition text-[var(--text-primary)] font-medium"
                >
                  <User className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                  <span>My Profile</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigateTo('/settings')}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-[var(--bg-canvas)] rounded-xl transition text-[var(--text-primary)] font-medium"
                >
                  <Settings className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                  <span>Settings</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigateTo('/help')}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-[var(--bg-canvas)] rounded-xl transition text-[var(--text-primary)] font-medium"
                >
                  <HelpCircle className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                  <span>Help &amp; Docs</span>
                </button>

                <div className="pt-1 border-t border-[var(--border-subtle)] mt-1">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-rose-500/10 rounded-xl transition text-rose-600 dark:text-rose-400 font-semibold"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
