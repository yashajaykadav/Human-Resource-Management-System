/**
 * Notification Components
 * 
 * This module exports all notification-related components and utilities.
 * 
 * @example
 * ```tsx
 * import { NotificationDropdown, NotificationToastContainer, useToast } from '@/components/notifications';
 * 
 * function App() {
 *   const { showSuccess, showError } = useToast();
 *   
 *   return (
 *     <>
 *       <button onClick={() => showSuccess('Action completed!')}>Success</button>
 *       <NotificationDropdown />
 *       <NotificationToastContainer />
 *     </>
 *   );
 * }
 * ```
 */

export { NotificationDropdown, NotificationEmptyState, NotificationSkeleton, getNotificationLabel } from './NotificationDropdown';
export { NotificationToastContainer, useNotificationToast } from './NotificationToast';
export type { Notification, NotificationType, NotificationPriority, NotificationStatus, NotificationCount } from '@/types/notification';

