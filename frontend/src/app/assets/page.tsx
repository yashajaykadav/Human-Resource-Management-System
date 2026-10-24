"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { AuthGuard } from '@/components/auth/AuthGuard';
import {
  Laptop,
  Monitor,
  Smartphone,
  Key,
  Armchair,
  Code2,
  Package,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  Wrench,
  RotateCcw,
  UserCheck,
  QrCode,
  FileText,
  Printer,
  ChevronDown,
  X,
  Send,
  Cpu,
  Layers,
  ArrowRight,
  ShieldCheck,
  DollarSign,
  TrendingUp,
  Tag,
  Building,
  User,
  LayoutGrid,
  List
} from 'lucide-react';

interface Asset {
  id: string;
  asset_tag: string;
  name: string;
  category: string;
  manufacturer: string | null;
  model_number: string | null;
  serial_number: string | null;
  purchase_date: string | null;
  purchase_cost: number;
  warranty_expiry: string | null;
  status: string;
  condition: string;
  location: string | null;
  specifications: string | null;
  notes: string | null;
  assigned_to_id: string | null;
  assigned_to_name?: string | null;
  assigned_to_email?: string | null;
  assigned_to_dept?: string | null;
  assigned_date: string | null;
  expected_return_date: string | null;
  created_at: string;
  updated_at: string;
}

interface AssetStats {
  total_assets: number;
  in_stock: number;
  assigned: number;
  maintenance: number;
  retired: number;
  total_valuation: number;
  categories_breakdown: Record<string, number>;
  expiring_warranties: number;
}

interface AssetRequestItem {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_email: string;
  department_name?: string | null;
  category: string;
  item_name: string;
  priority: string;
  reason: string;
  status: string;
  approver_comments?: string | null;
  assigned_asset_id?: string | null;
  assigned_asset_tag?: string | null;
  created_at: string;
  updated_at: string;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  hardware: <Laptop className="h-4 w-4 text-indigo-500" />,
  peripherals: <Monitor className="h-4 w-4 text-blue-500" />,
  mobile_devices: <Smartphone className="h-4 w-4 text-emerald-500" />,
  security: <Key className="h-4 w-4 text-amber-500" />,
  software_license: <Code2 className="h-4 w-4 text-purple-500" />,
  office_furniture: <Armchair className="h-4 w-4 text-rose-500" />,
};

const CATEGORY_LABELS: Record<string, string> = {
  hardware: 'Compute & Laptops',
  peripherals: 'Monitors & Peripherals',
  mobile_devices: 'Mobile Fleet',
  security: 'Security Keys & Tokens',
  software_license: 'Software Licenses',
  office_furniture: 'Ergonomic Furniture',
};

const STATUS_STYLES: Record<string, { label: string; badge: string; dot: string }> = {
  in_stock: { label: 'In Stock (Depot)', badge: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' },
  assigned: { label: 'Allocated (Active)', badge: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  maintenance: { label: 'In Diagnostics / Repair', badge: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  retired: { label: 'Decommissioned', badge: 'text-slate-500', dot: 'bg-slate-400' },
  lost_stolen: { label: 'Reported Missing', badge: 'text-rose-600', dot: 'bg-rose-500' },
};

export default function AssetsPage() {
  const { user, isAdmin: isSystemAdmin, hasPermission } = useAuth();
  const isAdmin = isSystemAdmin || user?.is_admin || hasPermission('assets');

  // Data state
  const [assets, setAssets] = useState<Asset[]>([]);
  const [stats, setStats] = useState<AssetStats | null>(null);
  const [requests, setRequests] = useState<AssetRequestItem[]>([]);
  const [employeesList, setEmployeesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'inventory' | 'my_assets' | 'requests' | 'maintenance'>('inventory');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState<Asset | null>(null);
  const [showReturnModal, setShowReturnModal] = useState<Asset | null>(null);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState<Asset | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<any | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states for modals
  const [newAssetForm, setNewAssetForm] = useState({
    asset_tag: '',
    name: '',
    category: 'hardware',
    manufacturer: '',
    model_number: '',
    serial_number: '',
    purchase_date: '',
    purchase_cost: 0,
    warranty_expiry: '',
    condition: 'new',
    location: 'HQ Depot - Locker A',
    specifications: '',
    notes: '',
    assigned_to_id: '',
  });

  const [assignForm, setAssignForm] = useState({
    employee_id: '',
    assigned_date: new Date().toISOString().split('T')[0],
    expected_return_date: '',
    notes: '',
  });

  const [returnForm, setReturnForm] = useState({
    condition: 'good',
    location: 'HQ Depot',
    notes: '',
  });

  const [maintenanceForm, setMaintenanceForm] = useState({
    issue_description: '',
    notes: '',
  });

  const [requestForm, setRequestForm] = useState({
    category: 'hardware',
    item_name: '',
    priority: 'normal',
    reason: '',
  });

  useEffect(() => {
    loadAllAssetData();
  }, [user]);

  const loadAllAssetData = async () => {
    setLoading(true);
    setFeedbackMsg(null);
    try {
      const [assetsRes, statsRes, requestsRes, empsRes] = await Promise.allSettled([
        apiRequest('/assets'),
        apiRequest('/assets/stats'),
        apiRequest('/assets/requests/all'),
        apiRequest('/employees'),
      ]);

      if (assetsRes.status === 'fulfilled') setAssets(assetsRes.value || []);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value || null);
      if (requestsRes.status === 'fulfilled') setRequests(requestsRes.value || []);
      if (empsRes.status === 'fulfilled') setEmployeesList(empsRes.value || []);
    } catch (err: any) {
      console.error('Failed to load asset data', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtered Assets
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      // Category filter
      if (selectedCategory !== 'all' && asset.category !== selectedCategory) {
        return false;
      }
      // Status filter
      if (selectedStatus !== 'all' && asset.status !== selectedStatus) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTag = asset.asset_tag.toLowerCase().includes(q);
        const matchesName = asset.name.toLowerCase().includes(q);
        const matchesSerial = (asset.serial_number || '').toLowerCase().includes(q);
        const matchesMfg = (asset.manufacturer || '').toLowerCase().includes(q);
        const matchesAssigned = (asset.assigned_to_name || '').toLowerCase().includes(q);
        const matchesLoc = (asset.location || '').toLowerCase().includes(q);
        if (!matchesTag && !matchesName && !matchesSerial && !matchesMfg && !matchesAssigned && !matchesLoc) {
          return false;
        }
      }
      return true;
    });
  }, [assets, selectedCategory, selectedStatus, searchQuery]);

  // My Assets subset
  const myAssets = useMemo(() => {
    if (!user) return [];
    return assets.filter((a) => a.assigned_to_email === user.email);
  }, [assets, user]);

  // Maintenance Assets subset
  const maintenanceAssets = useMemo(() => {
    return assets.filter((a) => a.status === 'maintenance');
  }, [assets]);

  // ==============================================================
  // ACTION HANDLERS
  // ==============================================================

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setFeedbackMsg(null);
    try {
      const payload: any = {
        ...newAssetForm,
        purchase_cost: Number(newAssetForm.purchase_cost) || 0,
        purchase_date: newAssetForm.purchase_date || null,
        warranty_expiry: newAssetForm.warranty_expiry || null,
        assigned_to_id: newAssetForm.assigned_to_id || null,
      };

      await apiRequest('/assets', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setShowAddModal(false);
      setNewAssetForm({
        asset_tag: '',
        name: '',
        category: 'hardware',
        manufacturer: '',
        model_number: '',
        serial_number: '',
        purchase_date: '',
        purchase_cost: 0,
        warranty_expiry: '',
        condition: 'new',
        location: 'HQ Depot - Locker A',
        specifications: '',
        notes: '',
        assigned_to_id: '',
      });
      setFeedbackMsg({ type: 'success', text: 'Asset successfully registered into enterprise inventory.' });
      await loadAllAssetData();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to register asset.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAssignModal) return;
    setActionLoading(true);
    setFeedbackMsg(null);
    try {
      await apiRequest(`/assets/${showAssignModal.id}/assign`, {
        method: 'POST',
        body: JSON.stringify({
          employee_id: assignForm.employee_id,
          assigned_date: assignForm.assigned_date || null,
          expected_return_date: assignForm.expected_return_date || null,
          notes: assignForm.notes || null,
        }),
      });

      setShowAssignModal(null);
      setFeedbackMsg({ type: 'success', text: `Asset ${showAssignModal.asset_tag} allocated to team member.` });
      await loadAllAssetData();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to allocate asset.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReturnAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showReturnModal) return;
    setActionLoading(true);
    setFeedbackMsg(null);
    try {
      await apiRequest(`/assets/${showReturnModal.id}/return`, {
        method: 'POST',
        body: JSON.stringify(returnForm),
      });

      setShowReturnModal(null);
      setFeedbackMsg({ type: 'success', text: `Asset ${showReturnModal.asset_tag} returned to inventory.` });
      await loadAllAssetData();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to return asset.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleMaintenanceAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showMaintenanceModal) return;
    setActionLoading(true);
    setFeedbackMsg(null);
    try {
      await apiRequest(`/assets/${showMaintenanceModal.id}/maintenance`, {
        method: 'POST',
        body: JSON.stringify(maintenanceForm),
      });

      setShowMaintenanceModal(null);
      setFeedbackMsg({ type: 'success', text: `Asset ${showMaintenanceModal.asset_tag} flagged for diagnostics/repair.` });
      await loadAllAssetData();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to send for maintenance.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setFeedbackMsg(null);
    try {
      await apiRequest('/assets/requests', {
        method: 'POST',
        body: JSON.stringify(requestForm),
      });

      setShowRequestModal(false);
      setRequestForm({
        category: 'hardware',
        item_name: '',
        priority: 'normal',
        reason: '',
      });
      setFeedbackMsg({ type: 'success', text: 'Hardware requisition submitted for administrative review.' });
      await loadAllAssetData();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to submit requisition.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReviewRequest = async (requestId: string, statusDecision: 'approved' | 'rejected') => {
    setActionLoading(true);
    setFeedbackMsg(null);
    try {
      await apiRequest(`/assets/requests/${requestId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: statusDecision,
          approver_comments: `Requisition ${statusDecision} by ${user?.first_name || 'Admin'}`,
        }),
      });

      setFeedbackMsg({ type: 'success', text: `Requisition ${statusDecision} successfully.` });
      await loadAllAssetData();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to update requisition.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenDetailModal = async (asset: Asset) => {
    try {
      const detailed = await apiRequest(`/assets/${asset.id}`);
      setShowDetailModal(detailed);
    } catch {
      setShowDetailModal(asset);
    }
  };

  return (
    <AuthGuard module="assets">
      <div className="space-y-6 pb-12">
        {/* ==============================================================
            HERO WORKSTATION HEADER
            ============================================================== */}
        <div className="skeuo-card p-6 md:p-8 relative overflow-hidden border border-[var(--border-soft)]">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="skeuo-pill px-3 py-0.5 text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                  <Laptop className="h-3.5 w-3.5" />
                  ENTERPRISE ASSET FLEET &bull; IT DEPOT
                </span>
                <span className="skeuo-pill px-2.5 py-0.5 text-[10px] text-emerald-600 font-bold">
                  {stats?.in_stock || 0} IN STOCK
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--text-primary)]">
                Workstation &amp; Asset Management
              </h1>
              <p className="text-xs text-[var(--text-secondary)] mt-1.5 max-w-2xl leading-relaxed">
                Centralized lifecycle inventory for computing equipment, digital licenses, security tokens, and employee workstation hardware provisioning.
              </p>
            </div>

            {/* Action Buttons Toolbar */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => window.print()}
                className="skeuo-btn text-xs py-2 px-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-bold flex items-center gap-1.5"
                title="Print Asset Registry"
              >
                <Printer className="h-4 w-4" />
                <span className="hidden sm:inline">Export Audit</span>
              </button>

              <button
                onClick={() => setShowRequestModal(true)}
                className="skeuo-btn text-xs py-2 px-3.5 text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1.5"
                title="Submit requisition for hardware or tools"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Requisition Equipment</span>
              </button>

              {isAdmin && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="skeuo-btn-primary text-xs py-2 px-4 font-bold flex items-center gap-1.5 shadow-md"
                  title="Provision and register new asset"
                >
                  <Plus className="h-4 w-4" />
                  <span>Register Asset</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {feedbackMsg && (
          <div
            className={`skeuo-inset p-3.5 rounded-xl text-xs font-bold flex items-center justify-between ${
              feedbackMsg.type === 'success'
                ? 'text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : 'text-rose-600 border border-rose-500/20'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackMsg.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <span>{feedbackMsg.text}</span>
            </div>
            <button onClick={() => setFeedbackMsg(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* ==============================================================
            FLEET METRICS GAUGES STRIP
            ============================================================== */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="skeuo-card p-4 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-indigo-500" />
              Total Fleet
            </span>
            <p className="text-xl font-black text-[var(--text-primary)]">{stats?.total_assets || 0}</p>
            <p className="text-[11px] text-[var(--text-secondary)]">Enterprise registered devices</p>
          </div>

          <div className="skeuo-card p-4 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
              Fleet Valuation
            </span>
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
              ${stats?.total_valuation?.toLocaleString() || '0'}
            </p>
            <p className="text-[11px] text-[var(--text-secondary)]">Procurement cost basis</p>
          </div>

          <div className="skeuo-card p-4 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5 text-purple-500" />
              In Circulation
            </span>
            <p className="text-xl font-black text-[var(--text-primary)]">{stats?.assigned || 0}</p>
            <p className="text-[11px] text-[var(--text-secondary)]">Allocated to staff</p>
          </div>

          <div className="skeuo-card p-4 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-blue-500" />
              In Depot Stock
            </span>
            <p className="text-xl font-black text-blue-600 dark:text-blue-400">{stats?.in_stock || 0}</p>
            <p className="text-[11px] text-[var(--text-secondary)]">Ready for deployment</p>
          </div>

          <div className="skeuo-card p-4 space-y-1 col-span-2 lg:col-span-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <Wrench className="h-3.5 w-3.5 text-amber-500" />
              Diagnostics / Repair
            </span>
            <p className="text-xl font-black text-amber-600 dark:text-amber-400">{stats?.maintenance || 0}</p>
            <p className="text-[11px] text-[var(--text-secondary)]">Active service tickets</p>
          </div>
        </div>

        {/* ==============================================================
            NAVIGATION TABS
            ============================================================== */}
        <div className="skeuo-card-soft p-1.5 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1">
            <TabItem
              active={activeTab === 'inventory'}
              onClick={() => setActiveTab('inventory')}
              icon={<Laptop className="h-4 w-4" />}
              label="Fleet Inventory"
              count={assets.length}
            />
            <TabItem
              active={activeTab === 'my_assets'}
              onClick={() => setActiveTab('my_assets')}
              icon={<User className="h-4 w-4" />}
              label="My Assigned Hardware"
              count={myAssets.length}
            />
            <TabItem
              active={activeTab === 'requests'}
              onClick={() => setActiveTab('requests')}
              icon={<Send className="h-4 w-4" />}
              label="Requisitions &amp; Requests"
              count={requests.filter((r) => r.status === 'pending').length}
              countColor="bg-amber-500 text-white"
            />
            <TabItem
              active={activeTab === 'maintenance'}
              onClick={() => setActiveTab('maintenance')}
              icon={<Wrench className="h-4 w-4" />}
              label="Service &amp; Maintenance"
              count={maintenanceAssets.length}
            />
          </div>

          {activeTab === 'inventory' && (
            <div className="hidden sm:flex items-center gap-1 pr-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs transition ${
                  viewMode === 'grid' ? 'skeuo-inset text-indigo-600' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
                title="Grid layout"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs transition ${
                  viewMode === 'table' ? 'skeuo-inset text-indigo-600' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
                title="Table layout"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* ==============================================================
            TAB 1: FLEET INVENTORY
            ============================================================== */}
        {activeTab === 'inventory' && (
          <div className="space-y-5">
            {/* Search & Filter Bar */}
            <div className="skeuo-card p-4 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between gap-4">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Search by tag, model, serial #, assignee or location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="skeuo-inset w-full pl-10 pr-4 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
                />
              </div>

              {/* Category & Status Dropdowns */}
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="skeuo-inset px-3 py-2 text-xs font-bold text-[var(--text-primary)] focus:outline-none"
                >
                  <option value="all">All Categories</option>
                  <option value="hardware">Compute &amp; Laptops</option>
                  <option value="peripherals">Monitors &amp; Peripherals</option>
                  <option value="mobile_devices">Mobile Devices</option>
                  <option value="security">Security Tokens</option>
                  <option value="software_license">Software Licenses</option>
                  <option value="office_furniture">Office Furniture</option>
                </select>

                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="skeuo-inset px-3 py-2 text-xs font-bold text-[var(--text-primary)] focus:outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="in_stock">In Stock (Depot)</option>
                  <option value="assigned">Allocated (Active)</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="retired">Retired</option>
                </select>

                {(searchQuery || selectedCategory !== 'all' || selectedStatus !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('all');
                      setSelectedStatus('all');
                    }}
                    className="skeuo-btn text-xs py-2 px-2.5 text-[var(--text-muted)] hover:text-rose-500 font-bold"
                    title="Clear filters"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Empty State */}
            {filteredAssets.length === 0 ? (
              <div className="skeuo-card p-12 text-center max-w-md mx-auto space-y-3">
                <div className="skeuo-inset h-12 w-12 rounded-full mx-auto flex items-center justify-center text-[var(--text-muted)]">
                  <Laptop className="h-6 w-6" />
                </div>
                <h3 className="font-extrabold text-sm text-[var(--text-primary)]">No Assets Found</h3>
                <p className="text-xs text-[var(--text-muted)]">
                  No devices matched your search or category filters.
                </p>
                {isAdmin && (
                  <button onClick={() => setShowAddModal(true)} className="skeuo-btn-primary text-xs py-2 px-3 font-bold mt-2">
                    Register First Asset
                  </button>
                )}
              </div>
            ) : viewMode === 'grid' ? (
              /* GRID VIEW */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredAssets.map((asset) => {
                  const statusInfo = STATUS_STYLES[asset.status] || {
                    label: asset.status,
                    badge: 'text-slate-500',
                    dot: 'bg-slate-400',
                  };

                  return (
                    <div
                      key={asset.id}
                      className="skeuo-card p-5 flex flex-col justify-between hover:shadow-lg transition-all border border-[var(--border-soft)]"
                    >
                      <div className="space-y-3">
                        {/* Header: Tag + Category + Status */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="skeuo-inset p-2 rounded-xl">
                              {CATEGORY_ICONS[asset.category] || <Laptop className="h-4 w-4" />}
                            </div>
                            <div>
                              <span className="font-mono text-[11px] font-black text-indigo-600 dark:text-indigo-400">
                                {asset.asset_tag}
                              </span>
                              <p className="text-[10px] text-[var(--text-muted)] font-semibold uppercase">
                                {CATEGORY_LABELS[asset.category] || asset.category}
                              </p>
                            </div>
                          </div>

                          <span className={`skeuo-pill px-2.5 py-0.5 text-[10px] font-bold flex items-center gap-1.5 ${statusInfo.badge}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${statusInfo.dot}`} />
                            {statusInfo.label}
                          </span>
                        </div>

                        {/* Device Name & Specs */}
                        <div>
                          <h3 className="font-black text-sm text-[var(--text-primary)] tracking-tight">
                            {asset.name}
                          </h3>
                          <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
                            {asset.manufacturer} {asset.model_number ? `&bull; ${asset.model_number}` : ''}
                          </p>
                        </div>

                        {/* Specs Pill */}
                        {asset.specifications && (
                          <div className="skeuo-inset p-2.5 rounded-xl text-[11px] text-[var(--text-muted)] line-clamp-2 leading-relaxed">
                            {asset.specifications}
                          </div>
                        )}

                        {/* Metadata Rows */}
                        <div className="space-y-1.5 text-xs pt-1 border-t border-[var(--border-subtle)]">
                          <div className="flex justify-between">
                            <span className="text-[var(--text-muted)] font-semibold">Serial Number:</span>
                            <span className="font-mono font-bold text-[var(--text-primary)]">
                              {asset.serial_number || 'N/A'}
                            </span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-[var(--text-muted)] font-semibold">Location / Depot:</span>
                            <span className="font-semibold text-[var(--text-primary)]">{asset.location || 'HQ Depot'}</span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-[var(--text-muted)] font-semibold">Assigned To:</span>
                            {asset.assigned_to_name ? (
                              <span className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {asset.assigned_to_name}
                              </span>
                            ) : (
                              <span className="text-[var(--text-muted)] font-mono text-[11px]">&mdash; Unassigned</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="pt-4 mt-4 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
                        <button
                          onClick={() => handleOpenDetailModal(asset)}
                          className="skeuo-btn text-xs py-1.5 px-3 font-bold text-[var(--text-primary)] hover:text-indigo-600 flex items-center gap-1"
                        >
                          <QrCode className="h-3.5 w-3.5" />
                          <span>Passport</span>
                        </button>

                        {isAdmin && (
                          <div className="flex items-center gap-1.5">
                            {asset.status === 'in_stock' && (
                              <button
                                onClick={() => {
                                  setShowAssignModal(asset);
                                  setAssignForm({
                                    employee_id: '',
                                    assigned_date: new Date().toISOString().split('T')[0],
                                    expected_return_date: '',
                                    notes: '',
                                  });
                                }}
                                className="skeuo-btn-primary text-xs py-1.5 px-2.5 font-bold flex items-center gap-1"
                              >
                                <UserCheck className="h-3.5 w-3.5" />
                                <span>Assign</span>
                              </button>
                            )}

                            {asset.status === 'assigned' && (
                              <button
                                onClick={() => {
                                  setShowReturnModal(asset);
                                  setReturnForm({
                                    condition: asset.condition || 'good',
                                    location: 'HQ Depot',
                                    notes: '',
                                  });
                                }}
                                className="skeuo-btn text-xs py-1.5 px-2.5 font-bold text-amber-600 flex items-center gap-1"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                <span>Return</span>
                              </button>
                            )}

                            {asset.status !== 'maintenance' && (
                              <button
                                onClick={() => {
                                  setShowMaintenanceModal(asset);
                                  setMaintenanceForm({ issue_description: '', notes: '' });
                                }}
                                className="skeuo-btn text-xs py-1.5 px-2 text-[var(--text-muted)] hover:text-amber-500"
                                title="Send for maintenance / diagnostics"
                              >
                                <Wrench className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* TABLE VIEW */
              <div className="skeuo-card p-6 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)]">
                      <th className="py-3 font-bold">Asset Tag</th>
                      <th className="py-3 font-bold">Device Name &amp; Model</th>
                      <th className="py-3 font-bold">Category</th>
                      <th className="py-3 font-bold">Serial Number</th>
                      <th className="py-3 font-bold">Assignee</th>
                      <th className="py-3 font-bold">Depot / Location</th>
                      <th className="py-3 font-bold">Status</th>
                      <th className="py-3 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {filteredAssets.map((asset) => {
                      const statusInfo = STATUS_STYLES[asset.status] || {
                        label: asset.status,
                        badge: 'text-slate-500',
                        dot: 'bg-slate-400',
                      };
                      return (
                        <tr key={asset.id} className="hover:bg-[var(--bg-surface-elevated)] transition">
                          <td className="py-3 font-mono font-black text-indigo-600 dark:text-indigo-400">
                            {asset.asset_tag}
                          </td>
                          <td className="py-3 font-bold text-[var(--text-primary)]">
                            {asset.name}
                            <span className="block text-[11px] font-normal text-[var(--text-muted)]">
                              {asset.manufacturer}
                            </span>
                          </td>
                          <td className="py-3 font-semibold text-[var(--text-secondary)]">
                            {CATEGORY_LABELS[asset.category] || asset.category}
                          </td>
                          <td className="py-3 font-mono text-[var(--text-muted)]">{asset.serial_number || '—'}</td>
                          <td className="py-3 font-semibold text-[var(--text-primary)]">
                            {asset.assigned_to_name || <span className="text-[var(--text-muted)]">In Stock</span>}
                          </td>
                          <td className="py-3 text-[var(--text-secondary)]">{asset.location || 'HQ Depot'}</td>
                          <td className="py-3">
                            <span className={`skeuo-pill px-2.5 py-0.5 text-[10px] font-bold flex items-center gap-1.5 w-fit ${statusInfo.badge}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${statusInfo.dot}`} />
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <button
                              onClick={() => handleOpenDetailModal(asset)}
                              className="skeuo-btn text-xs py-1 px-2.5 font-bold"
                            >
                              Passport
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ==============================================================
            TAB 2: MY ASSIGNED ASSETS
            ============================================================== */}
        {activeTab === 'my_assets' && (
          <div className="space-y-6">
            <div className="skeuo-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-extrabold text-[var(--text-primary)]">My Assigned Hardware &amp; Credentials</h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    Equipment issued to your employee account for daily operational use.
                  </p>
                </div>
                <button
                  onClick={() => setShowRequestModal(true)}
                  className="skeuo-btn text-xs py-1.5 px-3 font-bold text-indigo-600 flex items-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Request Additional Asset</span>
                </button>
              </div>

              {myAssets.length === 0 ? (
                <div className="skeuo-inset p-8 text-center text-xs text-[var(--text-muted)] rounded-2xl">
                  You currently have no hardware devices or assets officially assigned to your account.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {myAssets.map((asset) => (
                    <div key={asset.id} className="skeuo-card p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-black text-indigo-600 dark:text-indigo-400">
                          {asset.asset_tag}
                        </span>
                        <span className="skeuo-pill px-2 py-0.5 text-[10px] text-emerald-600 font-bold">
                          Assigned to You
                        </span>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="skeuo-inset p-3 rounded-2xl">
                          {CATEGORY_ICONS[asset.category] || <Laptop className="h-5 w-5" />}
                        </div>
                        <div>
                          <h3 className="font-extrabold text-sm text-[var(--text-primary)]">{asset.name}</h3>
                          <p className="text-xs text-[var(--text-muted)]">{asset.manufacturer} {asset.model_number}</p>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-xs pt-2 border-t border-[var(--border-subtle)]">
                        <div className="flex justify-between">
                          <span className="text-[var(--text-muted)]">Serial:</span>
                          <span className="font-mono font-bold text-[var(--text-primary)]">{asset.serial_number}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--text-muted)]">Condition:</span>
                          <span className="font-bold capitalize text-emerald-600">{asset.condition}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--text-muted)]">Assigned Date:</span>
                          <span className="font-bold text-[var(--text-primary)]">{asset.assigned_date || 'Active'}</span>
                        </div>
                      </div>

                      <div className="pt-2">
                        <button
                          onClick={() => handleOpenDetailModal(asset)}
                          className="skeuo-btn w-full text-xs py-2 font-bold flex items-center justify-center gap-1.5"
                        >
                          <QrCode className="h-3.5 w-3.5" />
                          <span>View Digital Passport</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==============================================================
            TAB 3: REQUISITIONS & REQUESTS
            ============================================================== */}
        {activeTab === 'requests' && (
          <div className="space-y-6">
            <div className="skeuo-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-extrabold text-[var(--text-primary)]">Equipment Requisitions</h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    Hardware, monitor, and license procurement requests submitted by team members.
                  </p>
                </div>
                <button
                  onClick={() => setShowRequestModal(true)}
                  className="skeuo-btn-primary text-xs py-2 px-3.5 font-bold flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  <span>Submit Requisition</span>
                </button>
              </div>

              {requests.length === 0 ? (
                <div className="skeuo-inset p-8 text-center text-xs text-[var(--text-muted)] rounded-2xl">
                  No equipment requisitions currently filed.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)]">
                        <th className="py-3 font-bold">Requester</th>
                        <th className="py-3 font-bold">Item Requested</th>
                        <th className="py-3 font-bold">Category</th>
                        <th className="py-3 font-bold">Priority</th>
                        <th className="py-3 font-bold">Justification</th>
                        <th className="py-3 font-bold">Status</th>
                        {isAdmin && <th className="py-3 font-bold text-right">Review</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                      {requests.map((req) => (
                        <tr key={req.id} className="hover:bg-[var(--bg-surface-elevated)] transition">
                          <td className="py-3">
                            <span className="font-bold text-[var(--text-primary)] block">{req.employee_name}</span>
                            <span className="text-[11px] text-[var(--text-muted)] font-mono">{req.employee_email}</span>
                          </td>
                          <td className="py-3 font-bold text-[var(--text-primary)]">{req.item_name}</td>
                          <td className="py-3 text-[var(--text-secondary)]">
                            {CATEGORY_LABELS[req.category] || req.category}
                          </td>
                          <td className="py-3">
                            <span
                              className={`skeuo-pill px-2 py-0.5 text-[10px] font-bold uppercase ${
                                req.priority === 'urgent'
                                  ? 'text-rose-600 bg-rose-500/10'
                                  : req.priority === 'high'
                                  ? 'text-amber-600'
                                  : 'text-indigo-600'
                              }`}
                            >
                              {req.priority}
                            </span>
                          </td>
                          <td className="py-3 text-[var(--text-secondary)] max-w-xs truncate">{req.reason}</td>
                          <td className="py-3">
                            <span
                              className={`skeuo-pill px-2.5 py-0.5 text-[10px] font-bold ${
                                req.status === 'approved'
                                  ? 'text-emerald-600'
                                  : req.status === 'rejected'
                                  ? 'text-rose-600'
                                  : 'text-amber-600'
                              }`}
                            >
                              {req.status.toUpperCase()}
                            </span>
                          </td>
                          {isAdmin && (
                            <td className="py-3 text-right">
                              {req.status === 'pending' ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleReviewRequest(req.id, 'approved')}
                                    disabled={actionLoading}
                                    className="skeuo-btn text-xs py-1 px-2.5 text-emerald-600 font-bold hover:bg-emerald-500/10"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleReviewRequest(req.id, 'rejected')}
                                    disabled={actionLoading}
                                    className="skeuo-btn text-xs py-1 px-2.5 text-rose-600 font-bold hover:bg-rose-500/10"
                                  >
                                    Reject
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-[var(--text-muted)] font-mono">Reviewed</span>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==============================================================
            TAB 4: MAINTENANCE & DIAGNOSTICS
            ============================================================== */}
        {activeTab === 'maintenance' && (
          <div className="space-y-6">
            <div className="skeuo-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-extrabold text-[var(--text-primary)]">Diagnostics &amp; Repair Queue</h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    Hardware currently checked into the IT service center for battery, screen or logic board maintenance.
                  </p>
                </div>
              </div>

              {maintenanceAssets.length === 0 ? (
                <div className="skeuo-inset p-8 text-center text-xs text-[var(--text-muted)] rounded-2xl">
                  No assets currently flagged for maintenance. All operational hardware in good standing.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {maintenanceAssets.map((asset) => (
                    <div key={asset.id} className="skeuo-card p-5 space-y-3 border border-amber-500/30">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-black text-amber-600 dark:text-amber-400">
                          {asset.asset_tag}
                        </span>
                        <span className="skeuo-pill px-2 py-0.5 text-[10px] text-amber-600 font-bold flex items-center gap-1">
                          <Wrench className="h-3 w-3" />
                          Under Repair
                        </span>
                      </div>

                      <h3 className="font-extrabold text-sm text-[var(--text-primary)]">{asset.name}</h3>
                      <p className="text-xs text-[var(--text-muted)] font-mono">{asset.serial_number}</p>

                      <div className="skeuo-inset p-3 rounded-xl text-xs text-[var(--text-secondary)]">
                        <p className="font-bold text-[var(--text-primary)] mb-1">Diagnosis Notes</p>
                        <p>{asset.notes || 'Hardware diagnostics in progress.'}</p>
                      </div>

                      {isAdmin && (
                        <button
                          onClick={() => {
                            setShowReturnModal(asset);
                            setReturnForm({ condition: 'good', location: 'HQ Depot', notes: 'Repairs completed successfully.' });
                          }}
                          className="skeuo-btn-success w-full text-xs py-2 font-bold flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Complete Repair &amp; Return to Stock</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==============================================================
            MODAL 1: REGISTER NEW ASSET
            ============================================================== */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="skeuo-card max-w-xl w-full p-6 relative max-h-[90vh] overflow-y-auto space-y-5 border-2 border-[var(--border-soft)]">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="skeuo-inset p-2 rounded-xl text-indigo-600">
                    <Laptop className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-[var(--text-primary)]">Register Enterprise Asset</h3>
                    <p className="text-xs text-[var(--text-muted)]">Add device or license to inventory ledger</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="skeuo-btn h-8 w-8 p-0 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateAsset} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Asset Tag *</span>
                    <input
                      type="text"
                      required
                      placeholder="e.g. AST-9010"
                      value={newAssetForm.asset_tag}
                      onChange={(e) => setNewAssetForm({ ...newAssetForm, asset_tag: e.target.value })}
                      className="skeuo-inset w-full px-3 py-2 text-xs font-mono text-[var(--text-primary)] focus:outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Category *</span>
                    <select
                      value={newAssetForm.category}
                      onChange={(e) => setNewAssetForm({ ...newAssetForm, category: e.target.value })}
                      className="skeuo-inset w-full px-3 py-2 text-xs font-bold text-[var(--text-primary)] focus:outline-none"
                    >
                      <option value="hardware">Compute &amp; Laptops</option>
                      <option value="peripherals">Monitors &amp; Peripherals</option>
                      <option value="mobile_devices">Mobile Devices</option>
                      <option value="security">Security Tokens &amp; Keys</option>
                      <option value="software_license">Software Licenses</option>
                      <option value="office_furniture">Office Furniture</option>
                    </select>
                  </label>
                </div>

                <label className="block">
                  <span className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Device Name / Model *</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MacBook Pro 16&quot; M3 Max"
                    value={newAssetForm.name}
                    onChange={(e) => setNewAssetForm({ ...newAssetForm, name: e.target.value })}
                    className="skeuo-inset w-full px-3 py-2 text-xs font-bold text-[var(--text-primary)] focus:outline-none"
                  />
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <label className="block">
                    <span className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Manufacturer</span>
                    <input
                      type="text"
                      placeholder="e.g. Apple, Dell, HP"
                      value={newAssetForm.manufacturer}
                      onChange={(e) => setNewAssetForm({ ...newAssetForm, manufacturer: e.target.value })}
                      className="skeuo-inset w-full px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Model #</span>
                    <input
                      type="text"
                      placeholder="e.g. A2991"
                      value={newAssetForm.model_number}
                      onChange={(e) => setNewAssetForm({ ...newAssetForm, model_number: e.target.value })}
                      className="skeuo-inset w-full px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Serial Number</span>
                    <input
                      type="text"
                      placeholder="e.g. C02XG788MD6T"
                      value={newAssetForm.serial_number}
                      onChange={(e) => setNewAssetForm({ ...newAssetForm, serial_number: e.target.value })}
                      className="skeuo-inset w-full px-3 py-2 text-xs font-mono text-[var(--text-primary)] focus:outline-none"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <label className="block">
                    <span className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Purchase Cost ($)</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="2499.00"
                      value={newAssetForm.purchase_cost}
                      onChange={(e) => setNewAssetForm({ ...newAssetForm, purchase_cost: Number(e.target.value) })}
                      className="skeuo-inset w-full px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Purchase Date</span>
                    <input
                      type="date"
                      value={newAssetForm.purchase_date}
                      onChange={(e) => setNewAssetForm({ ...newAssetForm, purchase_date: e.target.value })}
                      className="skeuo-inset w-full px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Warranty Expiry</span>
                    <input
                      type="date"
                      value={newAssetForm.warranty_expiry}
                      onChange={(e) => setNewAssetForm({ ...newAssetForm, warranty_expiry: e.target.value })}
                      className="skeuo-inset w-full px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Depot Location</span>
                    <input
                      type="text"
                      placeholder="HQ Depot Locker B-02"
                      value={newAssetForm.location}
                      onChange={(e) => setNewAssetForm({ ...newAssetForm, location: e.target.value })}
                      className="skeuo-inset w-full px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Initial Condition</span>
                    <select
                      value={newAssetForm.condition}
                      onChange={(e) => setNewAssetForm({ ...newAssetForm, condition: e.target.value })}
                      className="skeuo-inset w-full px-3 py-2 text-xs font-bold text-[var(--text-primary)] focus:outline-none"
                    >
                      <option value="new">Brand New</option>
                      <option value="excellent">Excellent</option>
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                    </select>
                  </label>
                </div>

                <label className="block">
                  <span className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Hardware Specifications</span>
                  <textarea
                    rows={2}
                    placeholder="e.g. 14-core CPU, 36GB Unified RAM, 1TB SSD, Space Black"
                    value={newAssetForm.specifications}
                    onChange={(e) => setNewAssetForm({ ...newAssetForm, specifications: e.target.value })}
                    className="skeuo-inset w-full px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
                  />
                </label>

                {/* Optional immediate assignment */}
                <label className="block">
                  <span className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                    Direct Allocate to Employee (Optional)
                  </span>
                  <select
                    value={newAssetForm.assigned_to_id}
                    onChange={(e) => setNewAssetForm({ ...newAssetForm, assigned_to_id: e.target.value })}
                    className="skeuo-inset w-full px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none font-bold"
                  >
                    <option value="">-- Keep in Stock (Unallocated) --</option>
                    {employeesList.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name || emp.employee_code} ({emp.department} &bull; {emp.employee_code})
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex items-center gap-3 pt-3 border-t border-[var(--border-subtle)]">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="skeuo-btn flex-1 text-xs py-2 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="skeuo-btn-primary flex-1 text-xs py-2 font-bold"
                  >
                    {actionLoading ? 'Registering...' : 'Provision Asset'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==============================================================
            MODAL 2: ASSIGN / ALLOCATE ASSET
            ============================================================== */}
        {showAssignModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="skeuo-card max-w-md w-full p-6 relative space-y-5 border-2 border-[var(--border-soft)]">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="skeuo-inset p-2 rounded-xl text-emerald-600">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-[var(--text-primary)]">Allocate Asset</h3>
                    <p className="text-xs text-[var(--text-muted)] font-mono">{showAssignModal.asset_tag} &bull; {showAssignModal.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAssignModal(null)}
                  className="skeuo-btn h-8 w-8 p-0 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleAssignAsset} className="space-y-4">
                <label className="block">
                  <span className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Select Assignee *</span>
                  <select
                    required
                    value={assignForm.employee_id}
                    onChange={(e) => setAssignForm({ ...assignForm, employee_id: e.target.value })}
                    className="skeuo-inset w-full px-3 py-2 text-xs font-bold text-[var(--text-primary)] focus:outline-none"
                  >
                    <option value="">-- Choose Employee --</option>
                    {employeesList.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name || emp.employee_code} ({emp.department} &bull; {emp.employee_code})
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Handover Date</span>
                    <input
                      type="date"
                      value={assignForm.assigned_date}
                      onChange={(e) => setAssignForm({ ...assignForm, assigned_date: e.target.value })}
                      className="skeuo-inset w-full px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Expected Return</span>
                    <input
                      type="date"
                      value={assignForm.expected_return_date}
                      onChange={(e) => setAssignForm({ ...assignForm, expected_return_date: e.target.value })}
                      className="skeuo-inset w-full px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Handover Notes</span>
                  <textarea
                    rows={2}
                    placeholder="Handed over with charger, security token, and carrying bag."
                    value={assignForm.notes}
                    onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
                    className="skeuo-inset w-full px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
                  />
                </label>

                <div className="flex items-center gap-3 pt-3 border-t border-[var(--border-subtle)]">
                  <button
                    type="button"
                    onClick={() => setShowAssignModal(null)}
                    className="skeuo-btn flex-1 text-xs py-2 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading || !assignForm.employee_id}
                    className="skeuo-btn-primary flex-1 text-xs py-2 font-bold"
                  >
                    {actionLoading ? 'Allocating...' : 'Confirm Allocation'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==============================================================
            MODAL 3: RETURN ASSET TO DEPOT
            ============================================================== */}
        {showReturnModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="skeuo-card max-w-md w-full p-6 relative space-y-5 border-2 border-[var(--border-soft)]">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="skeuo-inset p-2 rounded-xl text-amber-600">
                    <RotateCcw className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-[var(--text-primary)]">Return Asset to Stock</h3>
                    <p className="text-xs text-[var(--text-muted)] font-mono">{showReturnModal.asset_tag} &bull; {showReturnModal.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowReturnModal(null)}
                  className="skeuo-btn h-8 w-8 p-0 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleReturnAsset} className="space-y-4">
                <label className="block">
                  <span className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Return Condition</span>
                  <select
                    value={returnForm.condition}
                    onChange={(e) => setReturnForm({ ...returnForm, condition: e.target.value })}
                    className="skeuo-inset w-full px-3 py-2 text-xs font-bold text-[var(--text-primary)] focus:outline-none"
                  >
                    <option value="new">Like New</option>
                    <option value="excellent">Excellent</option>
                    <option value="good">Good (Normal wear)</option>
                    <option value="fair">Fair (Scratches/Blemishes)</option>
                    <option value="poor">Damaged (Requires Repair)</option>
                  </select>
                </label>

                <label className="block">
                  <span className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Return Storage Location</span>
                  <input
                    type="text"
                    value={returnForm.location}
                    onChange={(e) => setReturnForm({ ...returnForm, location: e.target.value })}
                    className="skeuo-inset w-full px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Return Inspection Notes</span>
                  <textarea
                    rows={2}
                    placeholder="All accessories returned, factory reset completed."
                    value={returnForm.notes}
                    onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
                    className="skeuo-inset w-full px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
                  />
                </label>

                <div className="flex items-center gap-3 pt-3 border-t border-[var(--border-subtle)]">
                  <button
                    type="button"
                    onClick={() => setShowReturnModal(null)}
                    className="skeuo-btn flex-1 text-xs py-2 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="skeuo-btn-primary flex-1 text-xs py-2 font-bold"
                  >
                    {actionLoading ? 'Processing...' : 'Accept Return'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==============================================================
            MODAL 4: SEND FOR MAINTENANCE
            ============================================================== */}
        {showMaintenanceModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="skeuo-card max-w-md w-full p-6 relative space-y-5 border-2 border-[var(--border-soft)]">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="skeuo-inset p-2 rounded-xl text-amber-500">
                    <Wrench className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-[var(--text-primary)]">Diagnostic &amp; Repair Queue</h3>
                    <p className="text-xs text-[var(--text-muted)] font-mono">{showMaintenanceModal.asset_tag} &bull; {showMaintenanceModal.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowMaintenanceModal(null)}
                  className="skeuo-btn h-8 w-8 p-0 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleMaintenanceAsset} className="space-y-4">
                <label className="block">
                  <span className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Reported Issue *</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Battery not charging, display flicker, OS crash"
                    value={maintenanceForm.issue_description}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, issue_description: e.target.value })}
                    className="skeuo-inset w-full px-3 py-2 text-xs font-bold text-[var(--text-primary)] focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Additional Diagnostic Notes</span>
                  <textarea
                    rows={2}
                    placeholder="Sent to authorized service provider for battery replacement."
                    value={maintenanceForm.notes}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, notes: e.target.value })}
                    className="skeuo-inset w-full px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
                  />
                </label>

                <div className="flex items-center gap-3 pt-3 border-t border-[var(--border-subtle)]">
                  <button
                    type="button"
                    onClick={() => setShowMaintenanceModal(null)}
                    className="skeuo-btn flex-1 text-xs py-2 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading || !maintenanceForm.issue_description}
                    className="skeuo-btn-danger flex-1 text-xs py-2 font-bold"
                  >
                    {actionLoading ? 'Logging...' : 'Send to Maintenance'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==============================================================
            MODAL 5: SUBMIT REQUISITION REQUEST
            ============================================================== */}
        {showRequestModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="skeuo-card max-w-md w-full p-6 relative space-y-5 border-2 border-[var(--border-soft)]">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="skeuo-inset p-2 rounded-xl text-indigo-600">
                    <Send className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-[var(--text-primary)]">Requisition Equipment</h3>
                    <p className="text-xs text-[var(--text-muted)]">Submit hardware or tool request to IT</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowRequestModal(false)}
                  className="skeuo-btn h-8 w-8 p-0 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitRequest} className="space-y-4">
                <label className="block">
                  <span className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Equipment Category *</span>
                  <select
                    value={requestForm.category}
                    onChange={(e) => setRequestForm({ ...requestForm, category: e.target.value })}
                    className="skeuo-inset w-full px-3 py-2 text-xs font-bold text-[var(--text-primary)] focus:outline-none"
                  >
                    <option value="hardware">Compute &amp; Laptops</option>
                    <option value="peripherals">Monitors &amp; Peripherals</option>
                    <option value="mobile_devices">Mobile Devices</option>
                    <option value="security">Security Tokens</option>
                    <option value="software_license">Software Licenses</option>
                    <option value="office_furniture">Ergonomic Furniture</option>
                  </select>
                </label>

                <label className="block">
                  <span className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Requested Item Name *</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 4K UltraSharp Monitor or Thunderbolt Dock"
                    value={requestForm.item_name}
                    onChange={(e) => setRequestForm({ ...requestForm, item_name: e.target.value })}
                    className="skeuo-inset w-full px-3 py-2 text-xs font-bold text-[var(--text-primary)] focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Urgency / Priority</span>
                  <select
                    value={requestForm.priority}
                    onChange={(e) => setRequestForm({ ...requestForm, priority: e.target.value })}
                    className="skeuo-inset w-full px-3 py-2 text-xs font-bold text-[var(--text-primary)] focus:outline-none"
                  >
                    <option value="low">Low (Standard refresh)</option>
                    <option value="normal">Normal (Project work)</option>
                    <option value="urgent">Urgent (Blocker / Broken tool)</option>
                  </select>
                </label>

                <label className="block">
                  <span className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Business Justification *</span>
                  <textarea
                    rows={3}
                    required
                    placeholder="Explain why this hardware is required for your project role."
                    value={requestForm.reason}
                    onChange={(e) => setRequestForm({ ...requestForm, reason: e.target.value })}
                    className="skeuo-inset w-full px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
                  />
                </label>

                <div className="flex items-center gap-3 pt-3 border-t border-[var(--border-subtle)]">
                  <button
                    type="button"
                    onClick={() => setShowRequestModal(false)}
                    className="skeuo-btn flex-1 text-xs py-2 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading || !requestForm.item_name || !requestForm.reason}
                    className="skeuo-btn-primary flex-1 text-xs py-2 font-bold"
                  >
                    {actionLoading ? 'Submitting...' : 'Submit Requisition'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==============================================================
            MODAL 6: ASSET DETAIL & DIGITAL PASSPORT MODAL
            ============================================================== */}
        {showDetailModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="skeuo-card max-w-lg w-full p-6 relative max-h-[90vh] overflow-y-auto space-y-5 border-2 border-[var(--border-soft)]">
              <button
                onClick={() => setShowDetailModal(null)}
                className="absolute top-4 right-4 skeuo-btn h-8 w-8 p-0 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Passport Header */}
              <div className="skeuo-inset p-5 rounded-2xl space-y-3 bg-gradient-to-br from-[var(--bg-surface-elevated)] to-[var(--bg-surface)]">
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-indigo-600" />
                    <span className="font-black text-xs text-[var(--text-primary)] tracking-wide">
                      APRYDE HARDWARE PASSPORT
                    </span>
                  </div>
                  <span className="font-mono font-black text-xs text-indigo-600 dark:text-indigo-400">
                    {showDetailModal.asset_tag}
                  </span>
                </div>

                <div>
                  <h3 className="font-black text-lg text-[var(--text-primary)]">{showDetailModal.name}</h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    {showDetailModal.manufacturer} &bull; Model {showDetailModal.model_number || 'Standard'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono border-t border-[var(--border-subtle)] pt-2.5">
                  <div>
                    <span className="text-[var(--text-muted)] block text-[10px]">SERIAL NUMBER</span>
                    <span className="font-bold text-[var(--text-primary)]">{showDetailModal.serial_number || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block text-[10px]">CURRENT ASSIGNEE</span>
                    <span className="font-bold text-indigo-600">
                      {showDetailModal.assigned_to_name || 'In Depot Stock'}
                    </span>
                  </div>
                </div>

                {/* Mock Barcode */}
                <div className="mt-2 pt-2 border-t border-dashed border-[var(--border-subtle)] flex flex-col items-center">
                  <div className="h-7 w-52 bg-gradient-to-r from-slate-900 via-slate-600 to-slate-900 dark:from-slate-200 dark:via-slate-400 dark:to-slate-100 rounded opacity-80" />
                  <span className="text-[8px] font-mono tracking-widest text-[var(--text-muted)] mt-1">
                    * {showDetailModal.asset_tag} * INVENTORY VERIFIED
                  </span>
                </div>
              </div>

              {/* Specifications */}
              <div className="space-y-2 text-xs">
                <h4 className="font-bold text-[var(--text-primary)]">Specifications &amp; Parameters</h4>
                <div className="skeuo-inset p-3 rounded-xl space-y-1.5 font-medium text-[var(--text-secondary)]">
                  <p>{showDetailModal.specifications || 'Standard manufacturer specifications.'}</p>
                  <p className="text-[11px] text-[var(--text-muted)] pt-1 border-t border-[var(--border-subtle)]">
                    Purchased: {showDetailModal.purchase_date || 'N/A'} &bull; Cost: ${showDetailModal.purchase_cost || '0'}
                  </p>
                </div>
              </div>

              {/* Audit History Timeline */}
              {showDetailModal.history && showDetailModal.history.length > 0 && (
                <div className="space-y-2 text-xs">
                  <h4 className="font-bold text-[var(--text-primary)]">Chain of Custody &amp; Audit Trail</h4>
                  <div className="skeuo-inset p-3 rounded-xl space-y-2 divide-y divide-[var(--border-subtle)]">
                    {showDetailModal.history.map((h: any) => (
                      <div key={h.id} className="pt-2 first:pt-0">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[var(--text-primary)] uppercase text-[10px] tracking-wider">
                            {h.action}
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)] font-mono">
                            {new Date(h.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{h.notes}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2 border-t border-[var(--border-subtle)]">
                <button
                  onClick={() => window.print()}
                  className="skeuo-btn flex-1 text-xs py-2 font-bold flex items-center justify-center gap-1.5"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print Passport</span>
                </button>
                <button
                  onClick={() => setShowDetailModal(null)}
                  className="skeuo-btn-primary flex-1 text-xs py-2 font-bold"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}

// Subcomponents
function TabItem({
  active,
  onClick,
  icon,
  label,
  count,
  countColor,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
  countColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all whitespace-nowrap ${
        active
          ? 'skeuo-inset text-indigo-600 dark:text-indigo-400 font-extrabold shadow-inner'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)]'
      }`}
    >
      {icon}
      <span>{label}</span>
      {typeof count === 'number' && (
        <span
          className={`skeuo-pill px-1.5 py-0.2 text-[10px] font-mono font-bold ${
            countColor || 'text-[var(--text-muted)]'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

