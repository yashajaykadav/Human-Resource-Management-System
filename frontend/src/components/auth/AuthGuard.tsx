"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useEffect } from "react";
import { ShieldAlert } from "lucide-react";

// Pages that don't require authentication
const publicRoutes = ["/login", "/forgot-password", "/reset-password"];

export function AuthGuard({
  children,
  module,
  allowedRoles
}: {
  children: React.ReactNode;
  module?: string;
  allowedRoles?: string[];
}) {
  const { user, loading, isAdmin, hasPermission } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Redirect to /login if not authenticated and not on a public route
    if (!loading && !user && !publicRoutes.includes(pathname)) {
      router.replace("/login");
    }
  }, [user, loading, pathname, router]);

  // Show loading state or null while checking auth
  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[var(--bg-canvas)]">
        <div className="skeuo-card p-6 text-center">
          <p className="text-sm font-bold text-[var(--text-secondary)]">Loading...</p>
        </div>
      </div>
    );
  }

  // Block access if not authenticated and not on a public route
  if (!user && !publicRoutes.includes(pathname)) {
    return null;
  }

  // Admin always has full access to all pages and modules
  if (user && !isAdmin) {
    // If module is specified, check permissions
    if (module && !hasPermission(module)) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-[var(--bg-canvas)] p-4">
          <div className="skeuo-card p-8 text-center max-w-md">
            <div className="skeuo-inset mx-auto flex h-14 w-14 items-center justify-center text-rose-500 mb-4">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <h3 className="text-base font-black text-[var(--text-primary)]">Access Restricted</h3>
            <p className="text-xs text-[var(--text-muted)] mt-2 leading-relaxed">
              Your role <span className="font-bold text-indigo-600 dark:text-indigo-400">({user.role_name || user.role})</span> does not have access permissions for the <strong>{module}</strong> module.
            </p>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              Please contact your HRMS Administrator to modify role permissions.
            </p>
          </div>
        </div>
      );
    }

    // Check allowedRoles fallback if specified
    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-[var(--bg-canvas)] p-4">
          <div className="skeuo-card p-8 text-center max-w-md">
            <div className="skeuo-inset mx-auto flex h-14 w-14 items-center justify-center text-rose-500 mb-4">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <h3 className="text-base font-black text-[var(--text-primary)]">Access Restricted</h3>
            <p className="text-xs text-[var(--text-muted)] mt-2 leading-relaxed">
              You do not have the required role tier to view this section.
            </p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
