"use client";

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, X, AlertTriangle, Info, UserPlus, Calendar, DollarSign, ShieldAlert } from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';
import type { Notification } from '@/types/notification';

// Icons for different notification types
const notificationTypeIcons: Record<string, React.ReactNode> = {
  info: <Info className="h-4 w-4" />,
  warning: <AlertTriangle className="h-4 w-4" />,
  success: <Check className="h-4 w-4" />,
  error: <ShieldAlert className="h-4 w-4" />,
  approval_required: <ShieldAlert className="h-4 w-4" />,
  leave_request: <Calendar className="h-4 w-4" />,
  payroll_processing: <DollarSign className="h-4 w-4" />,
  attendance_alert: <AlertTriangle className="h-4 w-4" />,
  system_alert: <ShieldAlert className="h-4 w-4" />,
  employee_onboarded: <UserPlus className="h-4 w-4" />,
};

// Colors for different notification types
const notificationTypeColors: Record<string, string> = {
  info: 'text-indigo-600 dark:text-indigo-400',
  warning: 'text-amber-600 dark:text-amber-400',
  success: 'text-emerald-600 dark:text-emerald-400',
  error: 'text-rose-600 dark:text-rose-400',
  approval_required: 'text-purple-600 dark:text-purple-400',
  leave_request: 'text-blue-600 dark:text-blue-400',
  payroll_processing: 'text-orange-600 dark:text-orange-400',
  attendance_alert: 'text-red-600 dark:text-red-400',
  system_alert: 'text-gray-600 dark:text-gray-400',
  employee_onboarded: 'text-teal-600 dark:text-teal-400',
};

// Background colors for different notification types
const notificationTypeBgColors: Record<string, string> = {
  info: 'bg-indigo-100 dark:bg-indigo-900/30',
  warning: 'bg-amber-100 dark:bg-amber-900/30',
  success: 'bg-emerald-100 dark:bg-emerald-900/30',
  error: 'bg-rose-100 dark:bg-rose-900/30',
  approval_required: 'bg-purple-100 dark:bg-purple-900/30',
  leave_request: 'bg-blue-100 dark:bg-blue-900/30',
  payroll_processing: 'bg-orange-100 dark:bg-orange-900/30',
  attendance_alert: 'bg-red-100 dark:bg-red-900/30',
  system_alert: 'bg-gray-100 dark:bg-gray-900/30',
  employee_onboarded: 'bg-teal-100 dark:bg-teal-900/30',
};

// Priority colors
const priorityColors: Record<string, string> = {
  low: 'border-slate-300 dark:border-slate-600',
  medium: 'border-blue-500 dark:border-blue-400',
  high: 'border-amber-500 dark:border-amber-400',
  critical: 'border-rose-500 dark:border-rose-400',
};

// Time ago helper
const timeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `${years}y ago`;
  if (months > 0) return `${months}m ago`;
  if (weeks > 0) return `${weeks}w ago`;
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}min ago`;
  return 'Just now';
};

// Get notification labels
export const getNotificationLabel = (type: string): string => {
  const labels: Record<string, string> = {
    info: 'Information',
    warning: 'Warning',
    success: 'Success',
    error: 'Error',
    approval_required: 'Approval Required',
    leave_request: 'Leave Request',
    payroll_processing: 'Payroll Processing',
    attendance_alert: 'Attendance Alert',
    system_alert: 'System Alert',
    employee_onboarded: 'New Employee',
  };
  return labels[type] || type;
};

interface NotificationDropdownProps {
  className?: string;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ className = '' }) => {
  const router = useRouter();
  const {
    notifications,
    isLoading,
    isDropdownOpen,
    notificationCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearNotifications,
    closeDropdown,
    openDropdown,
    unreadCount
  } = useNotifications();

  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  // Sort notifications by priority and then by date
  const sortedNotifications = [...notifications].sort((a, b) => {
    // Higher priority first
    const priorityOrder: Record<string, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1
    };
    
    const aPriority = priorityOrder[a.priority] || 0;
    const bPriority = priorityOrder[b.priority] || 0;
    
    if (aPriority !== bPriority) {
      return bPriority - aPriority;
    }
    
    // Newer first
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const handleNotificationClick = (notification: Notification) => {
    if (notification.action_url) {
      closeDropdown();
      router.push(notification.action_url);
    }
    
    // Mark as read if it's unread
    if (notification.status === 'unread') {
      markAsRead(notification.id);
    }
  };

  const handleMarkAllAsRead = async () => {
    setIsMarkingAll(true);
    try {
      await markAllAsRead();
    } finally {
      setIsMarkingAll(false);
    }
  };

  const hasNotifications = notifications.length > 0;
  const hasUnread = unreadCount > 0;

  return (
    <div className="relative">
      {/* Notification Toggle Button */}
      <button
        id="notification-toggle"
        onClick={(e) => {
          e.stopPropagation();
          if (isDropdownOpen) {
            closeDropdown();
          } else {
            fetchNotifications();
            openDropdown();
          }
        }}
        aria-label="Notifications"
        aria-expanded={isDropdownOpen}
        aria-haspopup="true"
        title="Notifications"
        className={`relative skeuo-btn h-9 w-9 p-0 flex items-center justify-center text-[var(--text-primary)] hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shrink-0 ${className}`}
      >
        <Bell className="h-4.5 w-4.5 text-[var(--text-primary)]" />
        
        {/* Notification Badge - Only show when there are unread notifications */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center shadow-md animate-in zoom-in-75">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <div
          id="notification-dropdown"
          ref={dropdownRef}
          className="absolute right-0 mt-2 w-80 sm:w-96 max-h-[60vh] overflow-y-auto skeuo-card shadow-2xl z-50 border border-[var(--border-soft)]" 
        >
          {/* Header */}
          <div className="p-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-[var(--text-primary)]">
                Notifications
              </h3>
              <span className="skeuo-pill px-2 py-0.5 text-[10px] font-medium bg-[var(--bg-canvas)] text-[var(--text-muted)]">
                {hasNotifications ? unreadCount : '0'} new
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              {hasNotifications && (
                <button
                  onClick={handleMarkAllAsRead}
                  disabled={isMarkingAll}
                  className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors disabled:opacity-50"
                >
                  {isMarkingAll ? 'Marking...' : 'Mark all read'}
                </button>
              )}
              {/* Close Button */}
              <button
                type="button"
                onClick={closeDropdown}
                className="skeuo-btn h-7 w-7 p-0 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg shrink-0"
                title="Close notifications"
                aria-label="Close notifications"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="p-1">
            {isLoading ? (
              <div className="p-6 text-center">
                <div className="animate-pulse flex items-center justify-center gap-2 text-sm text-[var(--text-muted)]">
                  <div className="h-4 w-4 bg-[var(--text-muted)] rounded-full animate-bounce" />
                  <span>Loading notifications...</span>
                </div>
              </div>
            ) : hasNotifications ? (
              sortedNotifications.map((notification) => {
                const Icon = notificationTypeIcons[notification.notification_type] || notificationTypeIcons.info;
                const iconColor = notificationTypeColors[notification.notification_type] || notificationTypeColors.info;
                const bgColor = notificationTypeBgColors[notification.notification_type] || notificationTypeBgColors.info;
                const isUnread = notification.status === 'unread';
                const priority = notification.priority || 'medium';
                const priorityBorder = priorityColors[priority] || priorityColors.medium;

                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`relative p-3 rounded-xl mb-1 cursor-pointer transition-all group hover:bg-[var(--bg-canvas)] {
                      isUnread ? 'bg-[var(--bg-surface-elevated)]' : ''
                    } ${isUnread ? 'bg-[var(--bg-surface-elevated)]' : ''}`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleNotificationClick(notification);
                      }
                    }}
                  >
                    {/* Priority indicator */}
                    <div className={`absolute left-0 top-1/2 -translate-y-1/2 h-4 w-1.5 rounded-r-xl ${priorityBorder}`} />
                    
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className={`skeuo-inset flex-shrink-0 h-8 w-8 rounded-lg ${bgColor} flex items-center justify-center`}>
                        <div className={iconColor}>{Icon}</div>
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-xs text-[var(--text-primary)] truncate">
                            {notification.title}
                          </h4>
                          
                          {/* Time and unread indicator */}
                          <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
                            <span>{timeAgo(notification.created_at)}</span>
                            {isUnread && (
                              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                            )}
                          </div>
                        </div>
                        
                        <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                        
                        {/* Action URL indicator */}
                        {notification.action_url && (
                          <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-1 font-medium">
                            Click to view
                          </p>
                        )}
                      </div>
                      
                      {/* Delete button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification.id);
                        }}
                        aria-label="Delete notification"
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/20 transition-all"
                      >
                        <X className="h-3.5 w-3.5 text-rose-500 dark:text-rose-400" />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-6 text-center">
                <div className="skeuo-inset flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-[var(--bg-canvas)]">
                  <Bell className="h-5 w-5 text-[var(--text-muted)]" />
                </div>
                <p className="mt-3 text-sm text-[var(--text-muted)]">
                  No new notifications
                </p>
                <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                  You're all caught up!
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          {hasNotifications && (
            <div className="p-2 border-t border-[var(--border-subtle)]">
              <button
                onClick={clearNotifications}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                <span>Clear all notifications</span>
              </button>
            </div>
          )}

          {/* Notification count info */}
          {notificationCount && (
            <div className="p-2 border-t border-[var(--border-subtle)] text-[10px] text-[var(--text-muted)]">
              <div className="flex items-center justify-between">
                <span>Total: {notificationCount.total_count}</span>
                <span>Unread: {notificationCount.unread_count}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Export individual components for custom usage
export const NotificationEmptyState = ({ message = 'No notifications' }: { message?: string }) => (
  <div className="p-6 text-center">
    <div className="skeuo-inset flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-[var(--bg-canvas)]">
      <Bell className="h-5 w-5 text-[var(--text-muted)]" />
    </div>
    <p className="mt-3 text-sm text-[var(--text-muted)]">{message}</p>
  </div>
);

export const NotificationSkeleton = () => (
  <div className="p-3 animate-pulse">
    <div className="flex items-center gap-3">
      <div className="skeuo-inset h-8 w-8 rounded-lg bg-[var(--bg-canvas)]" />
      <div className="flex-1 space-y-1">
        <div className="h-2 w-24 bg-[var(--bg-canvas)] rounded" />
        <div className="h-2 w-48 bg-[var(--bg-canvas)] rounded" />
      </div>
    </div>
  </div>
);
