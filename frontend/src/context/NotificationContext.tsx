"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type {
  Notification,
  NotificationCount,
  NotificationType,
  NotificationPriority,
  CreateNotificationOptions
} from '@/types/notification';

interface NotificationContextType {
  // State
  notifications: Notification[];
  unreadCount: number;
  highPriorityCount: number;
  notificationCount: NotificationCount | null;
  isLoading: boolean;
  isDropdownOpen: boolean;

  // Actions
  fetchNotifications: () => Promise<void>;
  fetchNotificationCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  createNotification: (options: CreateNotificationOptions) => Promise<Notification>;
  clearNotifications: () => Promise<void>;
  
  // UI Actions
  toggleDropdown: () => void;
  closeDropdown: () => void;
  openDropdown: () => void;

  // Real-time features
  enableRealtime: boolean;
  setEnableRealtime: (enabled: boolean) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Polling interval for real-time updates (in milliseconds)
const POLLING_INTERVAL = 30000; // 30 seconds

interface NotificationProviderProps {
  children: ReactNode;
  pollInterval?: number;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
  pollInterval = POLLING_INTERVAL
}) => {
  const { user, token } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationCount, setNotificationCount] = useState<NotificationCount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [enableRealtime, setEnableRealtime] = useState(true);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);

  // Calculate counts from notifications
  const unreadCount = notifications.filter(n => n.status === 'unread').length;
  const highPriorityCount = notifications.filter(
    n => n.status === 'unread' && n.priority === 'high'
  ).length;

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!token || !user) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const data = await apiRequest<Notification[]>('/notifications/unread?limit=20');
      setNotifications(data || []);
      setLastFetchTime(new Date());
    } catch (err) {
      // Silently handle errors when backend is not available
      // This prevents console spam during development
      if (process.env.NODE_ENV !== 'production') {
        // Only log in development if it's not a connection error
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (!errorMessage.includes('ERR_CONNECTION_REFUSED') && 
            !errorMessage.includes('Failed to fetch') &&
            !errorMessage.includes('Not authenticated')) {
          console.error("Failed to fetch notifications:", err);
        }
      }
      // Keep existing notifications on error
    } finally {
      setIsLoading(false);
    }
  }, [token, user]);

  // Fetch notification counts
  const fetchNotificationCount = useCallback(async () => {
    if (!token || !user) {
      setNotificationCount(null);
      return;
    }
    try {
      const data = await apiRequest<NotificationCount>('/notifications/count');
      setNotificationCount(data);
    } catch (err) {
      // Silently handle errors when backend is not available
      if (process.env.NODE_ENV !== 'production') {
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (!errorMessage.includes('ERR_CONNECTION_REFUSED') && 
            !errorMessage.includes('Failed to fetch') &&
            !errorMessage.includes('Not authenticated')) {
          console.error("Failed to fetch notification count:", err);
        }
      }
    }
  }, [token, user]);

  // Fetch both notifications and counts
  const fetchAllNotificationData = useCallback(async () => {
    await Promise.all([fetchNotifications(), fetchNotificationCount()]);
  }, [fetchNotifications, fetchNotificationCount]);

  // Mark notification as read
  const markAsRead = useCallback(async (id: string) => {
    try {
      await apiRequest(`/notifications/${id}/read`, { method: 'PUT' });
      
      // Update local state
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === id 
            ? { ...notification, status: 'read' }
            : notification
        )
      );
      
      // Update count
      setNotificationCount(prev => 
        prev ? {
          ...prev,
          unread_count: Math.max(0, (prev.unread_count || 1) - 1)
        } : null
      );
    } catch (err) {
      // Silently handle errors in production
      if (process.env.NODE_ENV !== 'production') {
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (!errorMessage.includes('ERR_CONNECTION_REFUSED') && 
            !errorMessage.includes('Failed to fetch')) {
          console.error("Failed to mark notification as read:", err);
        }
      }
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      await apiRequest('/notifications/read-all', { method: 'PUT' });
      
      // Update local state
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, status: 'read' }))
      );
      
      // Update count
      setNotificationCount(prev => 
        prev ? {
          ...prev,
          unread_count: 0
        } : null
      );
    } catch (err) {
      // Silently handle errors in production
      if (process.env.NODE_ENV !== 'production') {
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (!errorMessage.includes('ERR_CONNECTION_REFUSED') && 
            !errorMessage.includes('Failed to fetch')) {
          console.error("Failed to mark all notifications as read:", err);
        }
      }
    }
  }, []);

  // Delete a notification (archive it)
  const deleteNotification = useCallback(async (id: string) => {
    try {
      await apiRequest(`/notifications/${id}`, { method: 'DELETE' });
      
      // Remove from local state
      setNotifications(prev => prev.filter(notification => notification.id !== id));
    } catch (err) {
      // Silently handle errors in production
      if (process.env.NODE_ENV !== 'production') {
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (!errorMessage.includes('ERR_CONNECTION_REFUSED') && 
            !errorMessage.includes('Failed to fetch')) {
          console.error("Failed to delete notification:", err);
        }
      }
    }
  }, []);

  // Clear all notifications
  const clearNotifications = useCallback(async () => {
    try {
      await apiRequest('/notifications', { method: 'DELETE' });
      setNotifications([]);
      setNotificationCount(prev => 
        prev ? { ...prev, unread_count: 0, total_count: 0 } : null
      );
    } catch (err) {
      // Silently handle errors in production
      if (process.env.NODE_ENV !== 'production') {
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (!errorMessage.includes('ERR_CONNECTION_REFUSED') && 
            !errorMessage.includes('Failed to fetch')) {
          console.error("Failed to clear notifications:", err);
        }
      }
    }
  }, []);

  // Create a notification
  const createNotification = useCallback(async (options: CreateNotificationOptions) => {
    try {
      const notificationData = {
        title: options.title,
        message: options.message,
        notification_type: options.type || 'info',
        priority: options.priority || 'medium',
        data: options.data,
        action_url: options.actionUrl,
        is_global: options.isGlobal || false,
        user_id: options.userId
      };
      
      const response = await apiRequest<Notification>('/notifications', {
        method: 'POST',
        body: JSON.stringify(notificationData)
      });
      
      return response;
    } catch (err) {
      // Silently handle errors in production
      if (process.env.NODE_ENV !== 'production') {
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (!errorMessage.includes('ERR_CONNECTION_REFUSED') && 
            !errorMessage.includes('Failed to fetch')) {
          console.error("Failed to create notification:", err);
        }
      }
      throw err;
    }
  }, []);

  // Dropdown control
  const toggleDropdown = useCallback(() => {
    setIsDropdownOpen(prev => !prev);
  }, []);

  const closeDropdown = useCallback(() => {
    setIsDropdownOpen(false);
  }, []);

  const openDropdown = useCallback(() => {
    setIsDropdownOpen(true);
  }, []);

  // Handle real-time polling
  useEffect(() => {
    if (!enableRealtime || !user || !token) return;

    const intervalId = setInterval(() => {
      fetchNotificationCount();
    }, pollInterval);

    return () => clearInterval(intervalId);
  }, [enableRealtime, pollInterval, fetchNotificationCount, user, token]);

  // Sync notifications on auth change
  useEffect(() => {
    if (user && token) {
      fetchAllNotificationData();
    } else {
      setNotifications([]);
      setNotificationCount(null);
      setIsLoading(false);
    }
  }, [fetchAllNotificationData, user, token]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const notificationToggle = document.getElementById('notification-toggle');
      const notificationDropdown = document.getElementById('notification-dropdown');
      
      if (notificationToggle?.contains(target) || notificationDropdown?.contains(target)) {
        return;
      }
      
      if (isDropdownOpen) {
        closeDropdown();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen, closeDropdown]);

  // Handle window focus - refresh notifications when user returns to the page
  useEffect(() => {
    const handleWindowFocus = () => {
      if (enableRealtime) {
        // Only fetch counts on focus to avoid too many requests
        fetchNotificationCount();
        // If dropdown is open, fetch full notifications
        if (isDropdownOpen) {
          fetchNotifications();
        }
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, [enableRealtime, isDropdownOpen, fetchNotificationCount, fetchNotifications]);

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    highPriorityCount,
    notificationCount,
    isLoading,
    isDropdownOpen,
    fetchNotifications,
    fetchNotificationCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    createNotification,
    clearNotifications,
    toggleDropdown,
    closeDropdown,
    openDropdown,
    enableRealtime,
    setEnableRealtime
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

// Export types for convenience
export type {
  Notification as NotificationType,
  NotificationCount,
  NotificationPriority,
  CreateNotificationOptions
} from '@/types/notification';
