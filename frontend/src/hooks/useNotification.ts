/**
 * useNotification Hook
 * 
 * A convenient hook for showing toast notifications in the application.
 * Wraps the notification context to provide a simple API for displaying toasts.
 * 
 * @example
 * ```tsx
 * import { useNotification } from '@/hooks/useNotification';
 * 
 * function MyComponent() {
 *   const { success, error, warning, info } = useNotification();
 *   
 *   const handleClick = () => {
 *     success('Action completed successfully!', 'Success');
 *   };
 *   
 *   return <button onClick={handleClick}>Do something</button>;
 * }
 * ```
 */

"use client";

import { useNotificationToast } from '@/components/notifications';
import type { NotificationType, NotificationPriority } from '@/types/notification';

export interface ToastOptions {
  title?: string;
  message: string;
  type?: NotificationType;
  priority?: NotificationPriority;
  duration?: number;
  actionUrl?: string;
  data?: Record<string, any>;
}

/**
 * Formats a notification message with optional variables
 */
export const formatMessage = (template: string, variables: Record<string, string> = {}): string => {
  return template.replace(/\{\w+\}/g, (match) => {
    const key = match.slice(1, -1);
    return variables[key] || match;
  });
};

/**
 * Hook for displaying toast notifications
 */
export const useNotification = () => {
  const { showToast: showNotification } = useNotificationToast();
  
  /**
   * Show a success notification
   */
  const success = (message: string, title: string = 'Success') => {
    showNotification({
      type: 'success',
      title,
      message,
      priority: 'medium'
    });
  };

  /**
   * Show an error notification
   */
  const error = (message: string, title: string = 'Error') => {
    showNotification({
      type: 'error',
      title,
      message,
      priority: 'high'
    });
  };

  /**
   * Show a warning notification
   */
  const warning = (message: string, title: string = 'Warning') => {
    showNotification({
      type: 'warning',
      title,
      message,
      priority: 'high'
    });
  };

  /**
   * Show an information notification
   */
  const info = (message: string, title: string = 'Information') => {
    showNotification({
      type: 'info',
      title,
      message,
      priority: 'medium'
    });
  };

  /**
   * Show a notification with custom options
   */
  const show = (options: ToastOptions) => {
    showNotification({
      type: options.type || 'info',
      title: options.title || '',
      message: options.message,
      priority: options.priority || 'medium',
      actionUrl: options.actionUrl,
      data: options.data
    });
  };

  /**
   * Show a high priority notification
   */
  const urgent = (message: string, title: string = 'Urgent') => {
    showNotification({
      type: 'error',
      title,
      message,
      priority: 'critical'
    });
  };

  /**
   * Show a notification with an action URL
   */
  const withAction = (message: string, actionUrl: string, title: string = 'Action Required') => {
    showNotification({
      type: 'approval_required',
      title,
      message,
      priority: 'high',
      actionUrl
    });
  };

  /**
   * Show multiple notifications at once
   */
  const batch = (notifications: Array<ToastOptions>) => {
    notifications.forEach(notification => {
      showNotification({
        type: notification.type || 'info',
        title: notification.title || '',
        message: notification.message,
        priority: notification.priority || 'medium',
        actionUrl: notification.actionUrl,
        data: notification.data
      });
    });
  };

  return {
    success,
    error,
    warning,
    info,
    urgent,
    withAction,
    show,
    batch,
    formatMessage
  };
};

export default useNotification;
