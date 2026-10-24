"use client";

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSidebar } from '@/context/SidebarContext';
import {
  LayoutDashboard,
  Users,
  Clock,
  CalendarDays,
  DollarSign,
  Briefcase,
  BookOpen,
  ShieldCheck,
  Settings2,
  Laptop,
  ChevronLeft,
  ChevronRight,
  X,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { user, hasPermission } = useAuth();
  const { isCollapsed, toggleCollapse, isMobileOpen, closeMobile } = useSidebar();

  // Close mobile sidebar on route change
  useEffect(() => {
    closeMobile();
  }, [pathname, closeMobile]);

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard, module: 'dashboard' },
    { name: 'Employees & Org', href: '/employees', icon: Users, module: 'employees' },
    { name: 'Asset Management', href: '/assets', icon: Laptop, module: 'assets' },
    { name: 'Attendance & Time', href: '/attendance', icon: Clock, module: 'attendance' },
    { name: 'Leave Management', href: '/leaves', icon: CalendarDays, module: 'leaves' },
    { name: 'Payroll & CTC', href: '/payroll', icon: DollarSign, module: 'payroll' },
    { name: 'Recruitment & ATS', href: '/recruitment', icon: Briefcase, module: 'recruitment' },
    { name: 'Policy Vault (RAG)', href: '/policies', icon: BookOpen, module: 'policies' },
    { name: 'Organization Setup', href: '/organization', icon: Settings2, module: 'organization' },
  ].filter((item) => hasPermission(item.module));

  if (!user) {
    return null;
  }

  const roleText = user.role_name || user.role.replace(/_/g, ' ');

  const renderNavItems = (collapsed: boolean) => (
    <nav className="space-y-1">
      {navigation.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.name}
            href={item.href}
            onClick={closeMobile}
            title={collapsed ? item.name : undefined}
            className={`flex items-center rounded-xl text-xs font-bold transition-all ${
              collapsed
                ? 'justify-center h-11 w-11 mx-auto'
                : 'gap-3 px-3.5 py-2.5'
            } ${
              isActive
                ? 'skeuo-inset text-indigo-600 dark:text-indigo-400 font-extrabold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)]'
            }`}
          >
            <Icon
              className={`h-4 w-4 shrink-0 ${
                isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-[var(--text-muted)]'
              }`}
            />
            <span className={collapsed ? 'sr-only' : 'truncate'}>{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      {/* Mobile Drawer (small screens) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-[var(--bg-surface)] border-r border-[var(--border-soft)] shadow-2xl flex flex-col justify-between p-4 transform transition-transform duration-300 ease-in-out lg:hidden ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-primary)]">
              Navigation Menu
            </span>
            {/* Close Button */}
            <button
              type="button"
              onClick={closeMobile}
              className="skeuo-btn h-8 w-8 p-0 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              title="Close menu"
              aria-label="Close navigation menu"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
          {renderNavItems(false)}
        </div>

        <div className="skeuo-card-soft p-3.5 space-y-1 mt-4">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
            <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
            <span className="truncate">Role Guardrails Active</span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] leading-relaxed truncate">
            Active Role: <span className="font-bold text-indigo-600 dark:text-indigo-400">{roleText}</span>
          </p>
        </div>
      </aside>

      {/* Desktop Persistent Sidebar */}
      <aside
        className={`hidden lg:flex border-r border-[var(--border-soft)] bg-[var(--bg-surface)] flex-col justify-between py-5 select-none transition-all duration-300 ease-in-out shrink-0 ${
          isCollapsed ? 'w-[72px] px-2' : 'w-64 px-3'
        }`}
      >
        <div className="space-y-1.5">
          {/* Header with Title & Collapse Toggle */}
          <div className={`flex items-center pb-2 pt-1 ${isCollapsed ? 'justify-center' : 'justify-between px-2'}`}>
            {!isCollapsed && (
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--text-muted)] truncate">
                Command Center
              </p>
            )}
            <button
              type="button"
              onClick={toggleCollapse}
              className="skeuo-btn h-7 w-7 p-0 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!isCollapsed}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Navigation links */}
          {renderNavItems(isCollapsed)}
        </div>

        {/* Tactile Security / Guardrails Card */}
        {isCollapsed ? (
          <div
            className="skeuo-card-soft p-2.5 flex items-center justify-center cursor-default mx-auto h-11 w-11"
            title={`Role Guardrails Active • Role: ${roleText}`}
          >
            <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
          </div>
        ) : (
          <div className="skeuo-card-soft p-3.5 space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
              <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
              <span className="truncate">Role Guardrails Active</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed truncate">
              Active Role: <span className="font-bold text-indigo-600 dark:text-indigo-400">{roleText}</span>
            </p>
          </div>
        )}
      </aside>
    </>
  );
};
