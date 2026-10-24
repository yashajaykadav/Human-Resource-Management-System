"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { apiRequest } from '@/lib/api';
import { EmployeeDashboard } from '@/components/dashboards/EmployeeDashboard';
import { ManagerDashboard } from '@/components/dashboards/ManagerDashboard';
import { HRAdminDashboard } from '@/components/dashboards/HRAdminDashboard';
import { RecruiterDashboard } from '@/components/dashboards/RecruiterDashboard';
import { PayrollDashboard } from '@/components/dashboards/PayrollDashboard';
import { SuperAdminDashboard } from '@/components/dashboards/SuperAdminDashboard';
import { RefreshCw } from 'lucide-react';

export default function DashboardPage() {
  const { user, loading, isAdmin, hasPermission } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, router, user]);

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const data = await apiRequest('/dashboards/stats');
      setStats(data);
    } catch (err) {
      console.error("Failed to load dashboard metrics:", err);
    } finally {
      setStatsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <RefreshCw className="h-5 w-5 animate-spin text-indigo-600" />
          <span>Loading dashboard experience...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // 1. Administrator overall control
  if (isAdmin || user.role === 'super_admin' || user.role === 'admin') {
    return <SuperAdminDashboard stats={stats} onRefresh={fetchStats} />;
  }

  // 2. Dynamic permission & role-based dashboard resolution
  if (hasPermission('recruitment') && !hasPermission('payroll') && !hasPermission('employees')) {
    return <RecruiterDashboard stats={stats} onRefresh={fetchStats} />;
  }
  if (hasPermission('payroll') && !hasPermission('employees')) {
    return <PayrollDashboard stats={stats} onRefresh={fetchStats} />;
  }
  if (hasPermission('employees') || hasPermission('organization') || user.role === 'hr_admin') {
    return <HRAdminDashboard stats={stats} onRefresh={fetchStats} />;
  }
  if (user.role === 'manager' || (stats?.manager_data && stats.manager_data.team_size > 0)) {
    return <ManagerDashboard stats={stats} onRefresh={fetchStats} />;
  }
  if (user.role === 'recruiter') {
    return <RecruiterDashboard stats={stats} onRefresh={fetchStats} />;
  }
  if (user.role === 'payroll_specialist') {
    return <PayrollDashboard stats={stats} onRefresh={fetchStats} />;
  }

  // 3. Default Employee Self-Service (ESS)
  return <EmployeeDashboard stats={stats} onRefresh={fetchStats} />;
}

