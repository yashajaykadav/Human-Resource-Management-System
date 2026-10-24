"use client";

import React, { useEffect, useState } from 'react';
import { useNotifications } from '@/context/NotificationContext';
import { Bell, X, CheckCircle, AlertTriangle, Info, AlertCircle, UserPlus, Calendar, DollarSign, ShieldAlert } from 'lucide-react';
import type { Notification, NotificationType, NotificationPriority } from '@/types/notification';

// Toast notification component that appears at the top-right of the screen
const NotificationToast: React.FC<{ 
  notification: Notification;
  onDismiss: () => void;
  autoHideDuration?: number;
}> = ({ 
  notification, 
  onDismiss, 
  autoHideDuration = 5000 
}) => {
  const [progress, setProgress] = useState(100);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (autoHideDuration && !isClosing) {
      const timer = setTimeout(() => {
        setIsClosing(true);
      }, autoHideDuration);
      
      // Progress bar animation
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev - (100 / (autoHideDuration / 100));
          return newProgress > 0 ? newProgress : 0;
        });
      }, 100);

      return () => {
        clearTimeout(timer);
        clearInterval(progressInterval);
      };
    }
  }, [autoHideDuration, isClosing]);

  useEffect(() => {
    if (isClosing) {
      const timer = setTimeout(() => {
        onDismiss();
      }, 300); // Animation duration
      return () => clearTimeout(timer);
    }
  }, [isClosing, onDismiss]);

  // Icons for different notification types
  const getIcon = () => {
    switch (notification.notification_type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-emerald-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-rose-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case 'info':
      default:
        return <Info className="h-5 w-5 text-indigo-500" />;
      case 'approval_required':
        return <ShieldAlert className="h-5 w-5 text-purple-500" />;
      case 'leave_request':
        return <Calendar className="h-5 w-5 text-blue-500" />;
      case 'payroll_processing':
        return <DollarSign className="h-5 w-5 text-orange-500" />;
      case 'attendance_alert':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'system_alert':
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
      case 'employee_onboarded':
        return <UserPlus className="h-5 w-5 text-teal-500" />;
    }
  };

  // Colors for different notification types
  const getBackgroundColor = () => {
    switch (notification.priority) {
      case 'critical':
        return 'bg-rose-100 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800';
      case 'high':
        return 'bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800';
      case 'low':
        return 'bg-slate-100 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800';
      case 'medium':
      default:
        return 'bg-indigo-100 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800';
    }
  };

  return (
    <div className={`
      skeuo-card shadow-xl mb-3 transform transition-all duration-300 
      ${isClosing ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
      ${getBackgroundColor()}
      border rounded-xl p-4
    `}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        
        <div className="flex-1">
          <h4 className="font-bold text-sm text-[var(--text-primary)]">
            {notification.title}
          </h4>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            {notification.message}
          </p>
          
          {notification.action_url && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (notification.action_url) {
                  window.location.href = notification.action_url;
                }
                onDismiss();
              }}
              className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 mt-1 hover:underline"
            >
              View details
            </button>
          )}
        </div>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsClosing(true);
          }}
          aria-label="Dismiss notification"
          className="flex-shrink-0 p-0.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition"
        >
          <X className="h-4 w-4 text-[var(--text-muted)]" />
        </button>
      </div>
      
      {/* Progress bar */}
      {autoHideDuration && !isClosing && (
        <div className="mt-2 h-0.5 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
          <div 
            className="h-full bg-indigo-500 dark:bg-indigo-400 transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};

// Toast container that manages multiple toast notifications
const NotificationToastContainer: React.FC = () => {
  const { createNotification, notifications } = useNotifications();
  const [toasts, setToasts] = useState<Notification[]>([]);

  // Listen for new notifications and show them as toasts
  useEffect(() => {
    // Check for new unread notifications that should be shown as toasts
    const newToasts = notifications.filter(
      n => n.status === 'unread' && 
           !toasts.some(t => t.id === n.id) &&
           n.priority !== 'low'
    );
    
    if (newToasts.length > 0) {
      // Only show the most recent notification
      const latestToast = newToasts[0];
      setToasts(prev => [latestToast, ...prev].slice(0, 3)); // Max 3 toasts
    }
  }, [notifications, toasts]);

  const handleDismiss = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-6 right-6 z-[100] w-80 space-y-2">
      {toasts.map(notification => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onDismiss={() => handleDismiss(notification.id)}
          autoHideDuration={8000}
        />
      ))}
    </div>
  );
};

// Hook to show toast notifications
export interface ToastOptions {
  type?: NotificationType;
  title?: string;
  message: string;
  priority?: NotificationPriority;
  duration?: number;
  actionUrl?: string;
  data?: Record<string, any>;
}

export const useNotificationToast = () => {
  const { createNotification } = useNotifications();
  
  const showToast = async (options: ToastOptions) => {
    await createNotification({
      title: options.title || 'Notification',
      message: options.message,
      type: options.type || 'info',
      priority: options.priority || 'medium',
      actionUrl: options.actionUrl,
      data: options.data,
      isGlobal: false
    });
  };

  const showSuccess = (message: string, title: string = 'Success') => {
    showToast({ type: 'success', title, message, priority: 'medium' });
  };

  const showError = (message: string, title: string = 'Error') => {
    showToast({ type: 'error', title, message, priority: 'high' });
  };

  const showWarning = (message: string, title: string = 'Warning') => {
    showToast({ type: 'warning', title, message, priority: 'high' });
  };

  const showInfo = (message: string, title: string = 'Information') => {
    showToast({ type: 'info', title, message, priority: 'medium' });
  };

  return {
    showToast: showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo
  };
};

export default NotificationToast;

export { NotificationToastContainer };
