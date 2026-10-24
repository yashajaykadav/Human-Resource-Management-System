/**
 * Notification Types for HRMS System
 */

export type NotificationType = 
  | 'info'
  | 'warning'
  | 'success'
  | 'error'
  | 'approval_required'
  | 'leave_request'
  | 'payroll_processing'
  | 'attendance_alert'
  | 'system_alert'
  | 'employee_onboarded';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

export type NotificationStatus = 'unread' | 'read' | 'archived';

export interface Notification {
  id: string;
  user_id: string | null;
  title: string;
  message: string;
  notification_type: NotificationType;
  priority: NotificationPriority;
  status: NotificationStatus;
  data: Record<string, any> | null;
  action_url: string | null;
  is_global: boolean;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

export interface NotificationCount {
  unread_count: number;
  total_count: number;
  high_priority_count: number;
  by_type: Record<NotificationType, number>;
}

export interface UserNotificationPreference {
  id: string;
  user_id: string;
  notification_type: NotificationType;
  is_enabled: boolean;
  email_notification: boolean;
  push_notification: boolean;
}

export type NotificationCreate = Omit<Notification, 'id' | 'created_at' | 'updated_at' | 'status'> & {
  user_id?: string;
  expires_at?: string;
};

export type NotificationUpdate = Partial<Omit<Notification, 'id' | 'created_at' | 'updated_at' | 'user_id'>>;

export interface CreateNotificationOptions {
  title: string;
  message: string;
  type?: NotificationType;
  priority?: NotificationPriority;
  data?: Record<string, any>;
  actionUrl?: string;
  isGlobal?: boolean;
  userId?: string;
}
