"""
Notification API endpoints for HRMS System
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, or_, func, update
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.future import select
from datetime import datetime, timedelta
from typing import List, Optional
from pydantic import BaseModel, Field
from app.core.database import get_db
from app.models.notification import (
    Notification,
    NotificationType,
    NotificationPriority,
    NotificationStatus,
    UserNotificationPreference
)
from app.models.user import User
from app.api.deps import get_current_user
from uuid import uuid4

router = APIRouter(prefix="/notifications", tags=["Notifications"])


# Pydantic Models
class NotificationBase(BaseModel):
    title: str = Field(..., max_length=255)
    message: str = Field(..., max_length=1000)
    notification_type: NotificationType = NotificationType.INFO
    priority: NotificationPriority = NotificationPriority.MEDIUM
    data: Optional[dict] = None
    action_url: Optional[str] = Field(None, max_length=500)
    is_global: bool = False


class NotificationCreate(NotificationBase):
    user_id: Optional[str] = None
    expires_at: Optional[datetime] = None


class NotificationUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    message: Optional[str] = Field(None, max_length=1000)
    notification_type: Optional[NotificationType] = None
    priority: Optional[NotificationPriority] = None
    status: Optional[NotificationStatus] = None
    data: Optional[dict] = None
    action_url: Optional[str] = Field(None, max_length=500)
    expires_at: Optional[datetime] = None


class UserNotificationPreferenceBase(BaseModel):
    notification_type: NotificationType
    is_enabled: bool = True
    email_notification: bool = False
    push_notification: bool = True


class UserNotificationPreferenceCreate(UserNotificationPreferenceBase):
    pass


class UserNotificationPreferenceUpdate(BaseModel):
    is_enabled: Optional[bool] = None
    email_notification: Optional[bool] = None
    push_notification: Optional[bool] = None


class NotificationResponse(BaseModel):
    id: str
    user_id: Optional[str]
    title: str
    message: str
    notification_type: NotificationType
    priority: NotificationPriority
    status: NotificationStatus
    data: Optional[dict]
    action_url: Optional[str]
    is_global: bool
    created_at: datetime
    updated_at: datetime
    expires_at: Optional[datetime]

    class Config:
        from_attributes = True


class UserNotificationPreferenceResponse(BaseModel):
    id: str
    user_id: str
    notification_type: NotificationType
    is_enabled: bool
    email_notification: bool
    push_notification: bool

    class Config:
        from_attributes = True


class NotificationCountResponse(BaseModel):
    unread_count: int
    total_count: int
    high_priority_count: int
    by_type: dict


# Helper function to get notification by ID
async def get_notification(db: Session, notification_id: str) -> Notification:
    result = await db.execute(
        select(Notification).where(Notification.id == notification_id)
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notification with id {notification_id} not found"
        )
    return notification


# Helper function to get user notification by ID with user check
async def get_user_notification(db: Session, notification_id: str, user_id: str) -> Notification:
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            or_(
                Notification.user_id == user_id,
                Notification.is_global == True
            )
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notification with id {notification_id} not found"
        )
    return notification


@router.get("/", response_model=List[NotificationResponse])
async def get_user_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 50,
    status: Optional[NotificationStatus] = None,
    priority: Optional[NotificationPriority] = None,
    notification_type: Optional[NotificationType] = None
):
    """
    Get notifications for the current user
    
    Returns a list of notifications with optional filtering by status, priority, or type.
    """
    query = select(Notification).where(
        or_(
            Notification.user_id == current_user.id,
            Notification.is_global == True
        )
    )

    # Apply filters
    if status:
        query = query.where(Notification.status == status)
    if priority:
        query = query.where(Notification.priority == priority)
    if notification_type:
        query = query.where(Notification.notification_type == notification_type)

    # Order by created_at descending
    query = query.order_by(desc(Notification.created_at))

    # Apply pagination
    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    notifications = result.scalars().all()

    return notifications


@router.get("/unread", response_model=List[NotificationResponse])
async def get_unread_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = 20
):
    """
    Get unread notifications for the current user
    
    Returns only unread notifications, useful for the notification dropdown.
    """
    query = select(Notification).where(
        or_(
            Notification.user_id == current_user.id,
            Notification.is_global == True
        ),
        Notification.status == NotificationStatus.UNREAD
    ).order_by(desc(Notification.created_at)).limit(limit)

    result = await db.execute(query)
    notifications = result.scalars().all()

    return notifications


@router.get("/count", response_model=NotificationCountResponse)
async def get_notification_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get notification counts for the current user
    
    Returns counts of unread, total, high priority, and count by type.
    """
    # Base query for user's notifications
    base_query = select(Notification).where(
        or_(
            Notification.user_id == current_user.id,
            Notification.is_global == True
        ),
        Notification.expires_at.is_(None) | (Notification.expires_at > datetime.utcnow())
    )

    # Count unread
    unread_query = select(func.count()).select_from(base_query.subquery()).where(
        Notification.status == NotificationStatus.UNREAD
    )
    result = await db.execute(unread_query)
    unread_count = result.scalar() or 0

    # Count total
    total_query = select(func.count()).select_from(base_query.subquery())
    result = await db.execute(total_query)
    total_count = result.scalar() or 0

    # Count high priority unread
    high_priority_query = select(func.count()).select_from(base_query.subquery()).where(
        Notification.status == NotificationStatus.UNREAD,
        Notification.priority == NotificationPriority.HIGH
    )
    result = await db.execute(high_priority_query)
    high_priority_count = result.scalar() or 0

    # Count by type (unread)
    result = await db.execute(
        select(
            Notification.notification_type,
            func.count()
        ).select_from(base_query.subquery()).where(
            Notification.status == NotificationStatus.UNREAD
        ).group_by(Notification.notification_type)
    )
    counts_by_type = {row[0].value: row[1] for row in result.all()}

    return NotificationCountResponse(
        unread_count=unread_count,
        total_count=total_count,
        high_priority_count=high_priority_count,
        by_type=counts_by_type
    )


@router.get("/{notification_id}", response_model=NotificationResponse)
async def get_notification(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific notification by ID
    """
    notification = await get_user_notification(db, notification_id, current_user.id)
    return notification


@router.post("/", response_model=NotificationResponse, status_code=status.HTTP_201_CREATED)
async def create_notification(
    notification: NotificationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new notification
    
    Regular users can only create notifications for themselves.
    Admin users can create notifications for other users.
    """
    # Check if user can create for other users
    if notification.user_id and notification.user_id != current_user.id:
        if not current_user.is_superuser and current_user.role not in ["super_admin", "hr_admin"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can create notifications for other users"
            )

    # For regular users without user_id specified, default to current user
    if not notification.user_id:
        notification.user_id = current_user.id

    db_notification = Notification(
        **notification.model_dump(exclude_unset=True),
        id=str(uuid4())
    )

    db.add(db_notification)
    await db.commit()
    await db.refresh(db_notification)

    return db_notification


@router.post("/bulk", response_model=List[NotificationResponse], status_code=status.HTTP_201_CREATED)
async def create_bulk_notifications(
    notifications: List[NotificationCreate],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create multiple notifications at once
    """
    if not current_user.is_superuser and current_user.role not in ["super_admin", "hr_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create bulk notifications"
        )

    created_notifications = []
    for notification_data in notifications:
        db_notification = Notification(
            **notification_data.model_dump(exclude_unset=True),
            id=str(uuid4())
        )
        db.add(db_notification)
        created_notifications.append(db_notification)

    await db.commit()

    for notification in created_notifications:
        await db.refresh(notification)

    return created_notifications


@router.put("/{notification_id}", response_model=NotificationResponse)
async def update_notification(
    notification_id: str,
    notification: NotificationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a notification
    """
    db_notification = await get_user_notification(db, notification_id, current_user.id)

    update_data = notification.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_notification, key, value)

    db.add(db_notification)
    await db.commit()
    await db.refresh(db_notification)

    return db_notification


@router.put("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_as_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Mark a notification as read
    """
    db_notification = await get_user_notification(db, notification_id, current_user.id)

    db_notification.status = NotificationStatus.READ
    db_notification.updated_at = datetime.utcnow()

    db.add(db_notification)
    await db.commit()
    await db.refresh(db_notification)

    return db_notification


@router.put("/read-all", response_model=dict)
async def mark_all_notifications_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Mark all notifications for the current user as read
    """
    result = await db.execute(
        update(Notification)
        .where(
            or_(
                Notification.user_id == current_user.id,
                Notification.is_global == True
            ),
            Notification.status == NotificationStatus.UNREAD
        )
        .values(status=NotificationStatus.READ, updated_at=datetime.utcnow())
    )

    await db.commit()

    return {"message": "All notifications marked as read", "updated_count": result.rowcount}


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a notification
    
    Soft delete - actually archives the notification
    """
    db_notification = await get_user_notification(db, notification_id, current_user.id)

    # Archive instead of delete
    db_notification.status = NotificationStatus.ARCHIVED
    db_notification.updated_at = datetime.utcnow()

    db.add(db_notification)
    await db.commit()

    return None


@router.delete("/", status_code=status.HTTP_204_NO_CONTENT)
async def delete_all_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete all notifications for the current user
    
    Soft delete - archives all notifications
    """
    await db.execute(
        update(Notification)
        .where(
            or_(
                Notification.user_id == current_user.id,
                Notification.is_global == True
            ),
            Notification.status != NotificationStatus.ARCHIVED
        )
        .values(status=NotificationStatus.ARCHIVED, updated_at=datetime.utcnow())
    )

    await db.commit()

    return None


# Admin endpoints for managing global notifications
@router.get("/admin/all", response_model=List[NotificationResponse])
async def get_all_notifications_admin(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100
):
    """
    Admin only: Get all notifications in the system
    """
    if not current_user.is_superuser and current_user.role not in ["super_admin", "hr_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    query = select(Notification).order_by(desc(Notification.created_at)).offset(skip).limit(limit)
    result = await db.execute(query)
    notifications = result.scalars().all()

    return notifications


@router.post("/admin/global", response_model=NotificationResponse, status_code=status.HTTP_201_CREATED)
async def create_global_notification(
    notification: NotificationBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Admin only: Create a global notification for all users
    """
    if not current_user.is_superuser and current_user.role not in ["super_admin", "hr_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    db_notification = Notification(
        **notification.model_dump(exclude_unset=True),
        id=str(uuid4()),
        is_global=True,
        user_id=None
    )

    db.add(db_notification)
    await db.commit()
    await db.refresh(db_notification)

    return db_notification


# User notification preferences endpoints
@router.get("/preferences", response_model=List[UserNotificationPreferenceResponse])
async def get_notification_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all notification preferences for the current user
    """
    result = await db.execute(
        select(UserNotificationPreference)
        .where(UserNotificationPreference.user_id == current_user.id)
    )
    preferences = result.scalars().all()

    # If no preferences exist, create defaults for all notification types
    if not preferences:
        notification_types = list(NotificationType)
        for notification_type in notification_types:
            db_pref = UserNotificationPreference(
                id=str(uuid4()),
                user_id=current_user.id,
                notification_type=notification_type,
                is_enabled=True,
                email_notification=False,
                push_notification=True
            )
            db.add(db_pref)
            preferences.append(db_pref)

        await db.commit()
        for preference in preferences:
            await db.refresh(preference)

    return preferences


@router.get("/preferences/{notification_type}", response_model=UserNotificationPreferenceResponse)
async def get_notification_preference(
    notification_type: NotificationType,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get notification preference for a specific notification type
    """
    result = await db.execute(
        select(UserNotificationPreference)
        .where(
            UserNotificationPreference.user_id == current_user.id,
            UserNotificationPreference.notification_type == notification_type
        )
    )
    preference = result.scalar_one_or_none()

    if not preference:
        # Create default if it doesn't exist
        preference = UserNotificationPreference(
            id=str(uuid4()),
            user_id=current_user.id,
            notification_type=notification_type,
            is_enabled=True,
            email_notification=False,
            push_notification=True
        )
        db.add(preference)
        await db.commit()
        await db.refresh(preference)

    return preference


@router.put("/preferences/{notification_type}", response_model=UserNotificationPreferenceResponse)
async def update_notification_preference(
    notification_type: NotificationType,
    preference: UserNotificationPreferenceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update notification preference for a specific notification type
    """
    result = await db.execute(
        select(UserNotificationPreference)
        .where(
            UserNotificationPreference.user_id == current_user.id,
            UserNotificationPreference.notification_type == notification_type
        )
    )
    db_preference = result.scalar_one_or_none()

    if not db_preference:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Preference for notification type {notification_type.value} not found"
        )

    update_data = preference.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_preference, key, value)

    db.add(db_preference)
    await db.commit()
    await db.refresh(db_preference)

    return db_preference


