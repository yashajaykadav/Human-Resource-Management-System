# Notification System for Apryde AI HRMS

This document describes the comprehensive notification system implemented for the Apryde AI HRMS project.

## Overview

The notification system provides users with real-time alerts and updates about various HR activities such as leave requests, payroll processing, attendance alerts, and system notifications. The system includes:

- **Backend API**: RESTful endpoints for managing notifications
- **Database Model**: Notification storage with types, priorities, and status tracking
- **Frontend Context**: Global state management for notifications
- **UI Components**: Notification dropdown, toast notifications, and badges
- **Integration**: Seamless integration with the existing navbar and layout

## Architecture

### Backend Components

#### Models
- **Location**: `/backend/app/models/notification.py`
- **Files**:
  - `Notification`: Main notification model with fields for type, priority, status, etc.
  - `UserNotificationPreference`: User-specific notification preferences
  
**Notification Enums**:
```python
- NotificationType: info, warning, success, error, approval_required, leave_request, payroll_processing, attendance_alert, system_alert, employee_onboarded
- NotificationPriority: low, medium, high, critical
- NotificationStatus: unread, read, archived
```

#### API Endpoints
- **Location**: `/backend/app/api/v1/notifications.py`

**Available Endpoints**:

```
GET    /api/v1/notifications              - Get user notifications (filterable)
GET    /api/v1/notifications/unread      - Get unread notifications
GET    /api/v1/notifications/count       - Get notification counts
GET    /api/v1/notifications/{id}         - Get specific notification
POST   /api/v1/notifications              - Create notification
POST   /api/v1/notifications/bulk         - Bulk create notifications
PUT    /api/v1/notifications/{id}         - Update notification
PUT    /api/v1/notifications/{id}/read   - Mark notification as read
PUT    /api/v1/notifications/read-all     - Mark all as read
DELETE /api/v1/notifications/{id}         - Delete (archive) notification
DELETE /api/v1/notifications              - Delete all (archive all)

# Admin Endpoints
GET    /api/v1/notifications/admin/all    - Get all notifications (admin)
POST   /api/v1/notifications/admin/global - Create global notification (admin)

# Preferences Endpoints
GET    /api/v1/notifications/preferences           - Get user preferences
GET    /api/v1/notifications/preferences/{type}   - Get preference by type
PUT    /api/v1/notifications/preferences/{type}   - Update preference
```

### Frontend Components

#### Context
- **Location**: `/frontend/src/context/NotificationContext.tsx`
- Provides global state for notifications
- Manages drodown visibility and real-time updates
- Handles fetching, marking as read, and deleting notifications

**State and Methods**:
- `notifications`: Array of notification objects
- `unreadCount`: Number of unread notifications
- `highPriorityCount`: Number of high priority unread notifications
- `isLoading`: Loading state
- `isDropdownOpen`: Dropdown visibility
- `fetchNotifications()`: Fetch notifications from API
- `fetchNotificationCount()`: Fetch notification counts
- `markAsRead(id)`: Mark a single notification as read
- `markAllAsRead()`: Mark all notifications as read
- `deleteNotification(id)`: Archive/delete a notification
- `clearNotifications()`: Clear all notifications
- `createNotification(options)`: Create a new notification
- `toggleDropdown()` / `openDropdown()` / `closeDropdown()`: Control dropdown

#### Components

1. **NotificationDropdown** (`/frontend/src/components/notifications/NotificationDropdown.tsx`)
   - Displays notifications in a dropdown menu
   - Shows unread count badge
   - Supports marking as read, deleting, and clearing all
   - Sorted by priority and date
   - Includes icons for different notification types
   - Shows time-ago timestamps

2. **NotificationToast** (`/frontend/src/components/notifications/NotificationToast.tsx`)
   - Displays toast notifications at top-right
   - Auto-hide with progress bar
   - Different colors for different notification types
   - Click to view details if action URL provided

3. **NotificationToastContainer**
   - Manages multiple toast notifications
   - Limits to 3 active toasts
   - Handles positioning and animation

#### Types
- **Location**: `/frontend/src/types/notification.ts`
- TypeScript interfaces for notification data structures

#### Hooks
- **Location**: `/frontend/src/hooks/useNotification.ts`
- `useNotification()`: Convenient hook for showing toast notifications
  ```typescript
  const { success, error, warning, info, urgent, withAction, show, batch } = useNotification();
  
  // Examples:
  success('Operation completed successfully!', 'Success');
  error('Failed to save changes', 'Error');
  warning('This action cannot be undone', 'Warning');
  urgent('System maintenance required!', 'Urgent');
  ```

#### Utilities
- **Location**: `/frontend/src/lib/notifications.ts`
- Client-side functions for API calls
- `createNotification()`, `fetchNotifications()`, `markAsRead()`, etc.
- `NOTIFICATION_CONFIGS`: Predefined notification configurations

## Usage Examples

### Creating Notifications (Backend)

```python
# Python example - create a notification
from fastapi import Depends
from app.api.v1.notifications import NotificationCreate, NotificationType, NotificationPriority
from app.api.v1 import notifications

# In your API endpoint
@router.post("/some-action")
async def some_action(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Create a notification for the current user
    notification = NotificationCreate(
        title="Action Completed",
        message="Your action has been processed successfully",
        notification_type=NotificationType.SUCCESS,
        priority=NotificationPriority.MEDIUM,
        data={"action_id": 123}
    )
    
    # Or use the notifications API
    # await notifications.create_notification(notification, db, current_user)
```

### Using Notifications (Frontend)

```tsx
// Using the useNotification hook
'use client';

import { useNotification } from '@/hooks/useNotification';

function MyComponent() {
  const { success, error, warning } = useNotification();
  
  const handleSave = async () => {
    try {
      await saveData();
      success('Data saved successfully!');
    } catch (err) {
      error('Failed to save data');
    }
  };
  
  return (
    <button onClick={handleSave}>
      Save
    </button>
  );
}
```

```tsx
// Using NotificationContext directly
'use client';

import { useNotifications } from '@/context/NotificationContext';
import { NotificationDropdown } from '@/components/notifications';

function MyApp() {
  const { unreadCount, fetchNotifications } = useNotifications();
  
  // The navbar already includes NotificationDropdown
  // You can also use it separately
  return (
    <>
      <NotificationDropdown />
      <p>You have {unreadCount} unread notifications</p>
    </>
  );
}
```

### Showing Toast Notifications

```tsx
// Simple usage
import { useNotification } from '@/hooks/useNotification';

function MyComponent() {
  const { success, error } = useNotification();
  
  const handleAction = () => {
    success('Action completed!', 'Success');
    // or
    error('Something went wrong', 'Error');
  };
}
```

```tsx
// With action URL
import { useNotification } from '@/hooks/useNotification';

function MyComponent() {
  const { withAction } = useNotification();
  
  const notifyUser = () => {
    withAction(
      'Your leave request requires approval',
      '/leaves/pending',
      'Approval Required'
    );
  };
}
```

## Features

### 1. Notification Types
- **Info**: General information
- **Warning**: Warning messages
- **Success**: Success confirmations
- **Error**: Error messages
- **Approval Required**: Requires user action
- **Leave Request**: Leave-related notifications
- **Payroll Processing**: Payroll-related notifications
- **Attendance Alert**: Attendance-related notifications
- **System Alert**: System-wide alerts
- **Employee Onboarded**: New employee notifications

### 2. Priority Levels
- **Low**: Non-urgent notifications
- **Medium**: Standard notifications
- **High**: Important notifications
- **Critical**: Urgent notifications requiring immediate attention

### 3. Real-time Updates
- Automatic polling for new notifications
- Window focus event triggers refresh
- Configurable polling interval (default: 30 seconds)

### 4. User Preferences
- Enable/disable notifications by type
- Email notification preferences
- Push notification preferences

### 5. Visual Indicators
- Badge with unread count
- Pulse animation for new notifications
- Different colors for different types and priorities
- Time-ago timestamps
- Priority indicator bars

## Integration Points

### 1. Dashboard Notifications
At the top of each dashboard, users see a notification bell with:
- Unread count badge
- Pulse indicator for new notifications
- Dropdown with recent notifications

### 2. Toast Notifications
Toast notifications appear at the top-right corner for:
- High and critical priority notifications
- New notifications that arrive while the app is open

### 3. Context Menu
The notification dropdown in the navbar provides:
- List of recent unread notifications
- Mark all as read button
- Clear all button
- Click to view details (if action URL provided)

## API Integration

The notification system integrates with the existing API structure:

```python
# In main.py
from app.api.v1 import notifications
app.include_router(notifications.router, prefix=settings.API_V1_STR)
```

## Database Schema

### notifications table
```sql
CREATE TABLE notifications (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_type ENUM(...) NOT NULL,
    priority ENUM(...) NOT NULL,
    status ENUM(...) NOT NULL,
    data TEXT NULL,
    action_url VARCHAR(500) NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    expires_at DATETIME NULL,
    is_global BOOLEAN NOT NULL DEFAULT FALSE
);
```

### user_notification_preferences table
```sql
CREATE TABLE user_notification_preferences (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    notification_type ENUM(...) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    email_notification BOOLEAN NOT NULL DEFAULT FALSE,
    push_notification BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (user_id, notification_type)
);
```

## Styling

The notification system uses the existing skeuomorphic design language:
- **Cards**: Skeuomorphic card styling
- **Buttons**: Tactile button styling
- **Colors**: Uses the existing color variables
- **Animations**: Smooth transitions and animations
- **Icons**: Uses Lucide icons matching the app's iconography

## Testing

To test the notification system:

1. Start the backend server
2. Start the frontend app
3. Log in as a user
4. Create notifications via API:
   ```bash
   # Create a notification
   curl -X POST http://localhost:8000/api/v1/notifications \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"title": "Test", "message": "This is a test notification", "notification_type": "info"}'
   ```
5. Verify the notification appears in the navbar dropdown
6. Test marking as read, etc.

## Future Enhancements

1. **WebSocket Integration**: Replace polling with WebSocket for real-time updates
2. **Email Notifications**: Backend integration for sending email alerts
3. **Push Notifications**: Browser push notification support
4. **Mobile Integration**: Mobile app notification support
5. **Digest Emails**: Daily/weekly notification digest emails
6. **Notification Digests**: Group similar notifications
7. **Notification Templates**: Predefined notification templates for common events

## Troubleshooting

### Notification not appearing
- Check if user is authenticated
- Verify the notification is for the correct user
- Check if notification is marked as read
- Ensure the notification dropdown is open

### Real-time not working
- Check if `enableRealtime` is set to true (default)
- Verify the polling interval in NotificationProvider
- Check browser console for errors

### Styling issues
- Ensure all notification components are wrapped in ThemeProvider
- Check if tailwind classes are being applied correctly
- Verify the skeuomorphic styling is consistent with the app

## Files Changed

### Backend
- `app/models/notification.py` (new)
- `app/models/user.py` (updated - added relationships)
- `app/models/__init__.py` (updated - added imports)
- `app/api/v1/notifications.py` (new)
- `app/main.py` (updated - added router)

### Frontend
- `src/types/notification.ts` (new)
- `src/context/NotificationContext.tsx` (new)
- `src/components/notifications/` (new directory)
  - `index.ts`
  - `NotificationDropdown.tsx`
  - `NotificationToast.tsx`
- `src/hooks/` (new directory)
  - `index.ts`
  - `useNotification.ts`
- `src/lib/notifications.ts` (new)
- `src/components/Navbar.tsx` (updated - added NotificationDropdown)
- `src/app/layout.tsx` (updated - added NotificationProvider and ToastContainer)
- `src/app/page.tsx` (updated - added useNotifications import)

## Summary

The notification system provides a comprehensive, real-time notification experience for users of the Apryde AI HRMS. It includes both technical (backend API, database) and user-facing (frontend UI, toast notifications) components that integrate seamlessly with the existing application architecture.
