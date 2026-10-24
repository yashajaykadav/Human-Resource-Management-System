
"use client";

import React, { useMemo, useState } from "react";
import {
  UserRound,
  Bell,
  ShieldCheck,
  KeyRound,
  ChevronRight,
  Mail,
  Building2,
  CircleCheck,
  CircleAlert,
  LockKeyhole,
  Settings2,
  Info,
  Copy,
  Check,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

type Section = "profile" | "notifications" | "security" | "permissions";

const NAV_ITEMS = [
  {
    id: "profile" as const,
    label: "My profile",
    description: "Account information",
    icon: UserRound,
  },
  {
    id: "notifications" as const,
    label: "Notifications",
    description: "Communication preferences",
    icon: Bell,
  },
  {
    id: "security" as const,
    label: "Security",
    description: "Account protection",
    icon: LockKeyhole,
  },
  {
    id: "permissions" as const,
    label: "Access & permissions",
    description: "Your assigned access",
    icon: ShieldCheck,
  },
];

function formatRole(role?: string | null) {
  if (!role) return "Not assigned";

  return role
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function initials(first?: string, last?: string) {
  return `${first?.trim().charAt(0) ?? ""}${last?.trim().charAt(0) ?? ""}`
    .toUpperCase() || "U";
}

function SettingCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="skeuo-card min-w-0 overflow-hidden rounded-2xl p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="skeuo-inset flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-indigo-600 dark:text-indigo-400">
          <Icon size={20} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-[var(--text-primary)]">
            {title}
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {description}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

function DetailRow({
  label,
  value,
  copyable = false,
}: {
  label: string;
  value: string;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copyValue = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex min-w-0 items-start justify-between gap-4 border-b border-[var(--border-subtle)] py-3 last:border-b-0">
      <dt className="shrink-0 text-sm text-[var(--text-secondary)]">
        {label}
      </dt>
      <dd className="flex min-w-0 items-center gap-2 text-right text-sm font-medium text-[var(--text-primary)]">
        <span className="break-all">{value || "Not available"}</span>
        {copyable && value && (
          <button
            type="button"
            onClick={copyValue}
            title={copied ? "Copied" : `Copy ${label.toLowerCase()}`}
            aria-label={`Copy ${label.toLowerCase()}`}
            className="shrink-0 rounded-lg p-1.5 hover:bg-[var(--bg-surface-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            {copied ? (
              <Check size={15} className="text-emerald-500" />
            ) : (
              <Copy size={15} />
            )}
          </button>
        )}
      </dd>
    </div>
  );
}

function Notice({
  children,
  type = "info",
}: {
  children: React.ReactNode;
  type?: "info" | "warning";
}) {
  const Icon = type === "warning" ? CircleAlert : Info;

  return (
    <div
      role="note"
      className={`flex items-start gap-3 rounded-xl border p-4 ${
        type === "warning"
          ? "border-amber-500/30 bg-amber-500/5"
          : "border-indigo-500/20 bg-indigo-500/5"
      }`}
    >
      <Icon
        size={18}
        className={`mt-0.5 shrink-0 ${
          type === "warning" ? "text-amber-500" : "text-indigo-500"
        }`}
      />
      <div className="text-sm leading-6 text-[var(--text-secondary)]">
        {children}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user, loading, isAdmin, hasPermission } = useAuth();
  const [activeSection, setActiveSection] =
    useState<Section>("profile");

  const fullName = useMemo(
    () =>
      [user?.first_name, user?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() || "User",
    [user?.first_name, user?.last_name]
  );

  const role = formatRole(user?.role_name || user?.role);

  const permissions = useMemo(
    () => [...new Set(user?.permissions ?? [])].sort(),
    [user?.permissions]
  );

  const sections = {
    profile: {
      title: "My profile",
      subtitle: "View your account information and employee details.",
    },
    notifications: {
      title: "Notifications",
      subtitle: "Notification preferences for your HRMS account.",
    },
    security: {
      title: "Security",
      subtitle: "Review your account security information.",
    },
    permissions: {
      title: "Access & permissions",
      subtitle: "Understand which modules your account can access.",
    },
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-[var(--bg-surface-elevated)]" />
        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="skeuo-card h-72 animate-pulse rounded-2xl" />
          <div className="skeuo-card h-96 animate-pulse rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="skeuo-card mx-auto max-w-xl rounded-2xl p-8 text-center">
        <LockKeyhole className="mx-auto mb-4 text-[var(--text-secondary)]" size={32} />
        <h1 className="text-lg font-bold text-[var(--text-primary)]">
          Sign in required
        </h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Please sign in to view your account settings.
        </p>
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 pb-8">
      {/* Page heading */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <Settings2 size={14} />
            <span>Workspace</span>
            <ChevronRight size={13} />
            <span>Settings</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            Account settings
          </h1>

          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">
            Manage your account information, review security details, and
            understand your HRMS access.
          </p>
        </div>

        <div className="flex w-fit items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <CircleCheck size={15} />
          Signed in
        </div>
      </header>

      {/* Account overview */}
      <section className="skeuo-card overflow-hidden rounded-2xl">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 text-xl font-bold text-indigo-600 dark:text-indigo-400">
            {initials(user.first_name, user.last_name)}
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="break-words text-lg font-bold text-[var(--text-primary)]">
              {fullName}
            </h2>
            <p className="mt-1 break-all text-sm text-[var(--text-secondary)]">
              {user.email}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                {role}
              </span>
              {user.employee_code && (
                <span className="rounded-full bg-[var(--bg-surface-elevated)] px-3 py-1 text-xs text-[var(--text-secondary)]">
                  Employee ID: {user.employee_code}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main settings layout */}
      <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav
          aria-label="Settings navigation"
          className="skeuo-card rounded-2xl p-3"
        >
          <p className="px-3 pb-3 pt-2 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            Preferences
          </p>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-w-0 items-center gap-3 rounded-xl p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    active
                      ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-elevated)]"
                  }`}
                >
                  <Icon size={19} className="shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      {item.label}
                    </span>
                    <span className="mt-1 hidden text-xs opacity-75 sm:block">
                      {item.description}
                    </span>
                  </span>
                  {active && (
                    <ChevronRight size={16} className="hidden shrink-0 lg:block" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="min-w-0 space-y-5">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">
              {sections[activeSection].title}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {sections[activeSection].subtitle}
            </p>
          </div>

          {activeSection === "profile" && (
            <>
              <SettingCard
                icon={UserRound}
                title="Personal information"
                description="Information associated with your signed-in account."
              >
                <dl>
                  <DetailRow label="First name" value={user.first_name} />
                  <DetailRow label="Last name" value={user.last_name} />
                  <DetailRow label="Email address" value={user.email} copyable />
                  <DetailRow label="Account role" value={role} />
                </dl>
              </SettingCard>

              <SettingCard
                icon={Building2}
                title="Employee information"
                description="Your HRMS employee identity."
              >
                <dl>
                  <DetailRow
                    label="Employee code"
                    value={user.employee_code || ""}
                    copyable
                  />
                  <DetailRow
                    label="Employee record"
                    value={user.employee_id ? "Linked" : "Not linked"}
                  />
                  <DetailRow
                    label="Account ID"
                    value={user.id}
                    copyable
                  />
                </dl>
              </SettingCard>

              <Notice>
                Profile details are currently read-only because the supplied
                backend does not include a profile update endpoint. Contact
                your HR or system administrator to request a change.
              </Notice>
            </>
          )}

          {activeSection === "notifications" && (
            <>
              <SettingCard
                icon={Mail}
                title="Email notifications"
                description="Receive HRMS updates at your registered email address."
              >
                <div className="flex items-start gap-3 rounded-xl bg-[var(--bg-surface-elevated)] p-4">
                  <Mail size={20} className="mt-0.5 shrink-0 text-[var(--text-secondary)]" />
                  <div className="min-w-0">
                    <p className="break-all text-sm font-semibold text-[var(--text-primary)]">
                      {user.email}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      Registered email address
                    </p>
                  </div>
                </div>
              </SettingCard>

              <SettingCard
                icon={Bell}
                title="Notification preferences"
                description="Email, push, and SMS delivery settings."
              >
                <Notice type="warning">
                  Notification preference APIs have not been provided. No
                  notification switches are shown as saved or active until
                  preferences can be loaded and persisted by the backend.
                </Notice>
              </SettingCard>
            </>
          )}

          {activeSection === "security" && (
            <>
              <SettingCard
                icon={LockKeyhole}
                title="Account authentication"
                description="Your current sign-in method."
              >
                <dl>
                  <DetailRow label="Sign-in method" value="Email and password" />
                  <DetailRow label="Session authentication" value="Bearer token" />
                  <DetailRow
                    label="Password last changed"
                    value="Not provided by the API"
                  />
                  <DetailRow
                    label="Two-factor authentication"
                    value="Status unavailable"
                  />
                </dl>
              </SettingCard>

              <SettingCard
                icon={KeyRound}
                title="Password and account protection"
                description="Manage your credentials securely."
              >
                <Notice type="warning">
                  Password-change and two-factor authentication endpoints were
                  not present in the supplied backend router. These actions
                  cannot safely be enabled yet.
                </Notice>
              </SettingCard>
            </>
          )}

          {activeSection === "permissions" && (
            <>
              <SettingCard
                icon={ShieldCheck}
                title="Your access"
                description="Permissions returned by the authentication service."
              >
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                    {role}
                  </span>
                  <span className="rounded-full bg-[var(--bg-surface-elevated)] px-3 py-1.5 text-xs text-[var(--text-secondary)]">
                    {isAdmin ? "Administrator access" : "Role-based access"}
                  </span>
                </div>

                {permissions.length === 0 ? (
                  <p className="rounded-xl bg-[var(--bg-surface-elevated)] p-4 text-sm text-[var(--text-secondary)]">
                    No individual permissions were returned for this account.
                  </p>
                ) : (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {permissions.map((permission) => (
                      <li
                        key={permission}
                        className="flex min-w-0 items-center gap-2 rounded-xl border border-[var(--border-subtle)] p-3"
                      >
                        <CircleCheck
                          size={16}
                          className="shrink-0 text-emerald-500"
                        />
                        <span className="break-words text-sm font-medium text-[var(--text-primary)]">
                          {permission === "*"
                            ? "All modules (*)"
                            : formatRole(permission)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </SettingCard>

              <SettingCard
                icon={ShieldCheck}
                title="Access control"
                description="How HRMS determines your permissions."
              >
                <p className="text-sm leading-6 text-[var(--text-secondary)]">
                  Access is determined by your assigned role and the permissions
                  returned by the authentication service. Only an authorized
                  administrator can change your assigned access.
                </p>
              </SettingCard>
            </>
          )}

          <p className="px-1 text-xs leading-5 text-[var(--text-secondary)]">
            Account information is supplied by your HRMS authentication
            service. Contact your administrator if any details are incorrect.
          </p>
        </div>
      </div>
    </main>
  );
}
