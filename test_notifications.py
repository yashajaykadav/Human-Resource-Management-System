"""
Test script to create sample notifications
Run this after starting the backend to populate test data
"""
import asyncio
import json

# Sample user IDs - replace with actual user IDs from your database
SAMPLE_USER_IDS = [
    "123e4567-e89b-12d3-a456-426614174000",  # Replace with actual user ID
    "123e4567-e89b-12d3-a456-426614174001",  # Replace with actual user ID
]

# Sample notifications to create
SAMPLE_NOTIFICATIONS = [
    {
        "title": "Welcome to Apryde AI HRMS",
        "message": "Your account has been successfully created. Explore the dashboard to get started.",
        "notification_type": "info",
        "priority": "medium",
        "is_global": False,
        "action_url": "/profile"
    },
    {
        "title": "Leave Request Approved",
        "message": "Your leave request for 5 days has been approved by your manager.",
        "notification_type": "leave_request",
        "priority": "high",
        "is_global": False,
        "action_url": "/leaves/my-requests"
    },
    {
        "title": "Payroll Processed",
        "message": "Your salary for this month has been processed. View your payslip.",
        "notification_type": "payroll_processing",
        "priority": "medium",
        "is_global": False,
        "action_url": "/payroll/my-payslips"
    },
    {
        "title": "System Update",
        "message": "A new system update has been applied. All features are now available.",
        "notification_type": "system_alert",
        "priority": "medium",
        "is_global": True,
        "action_url": "/settings"
    },
    {
        "title": "New Employee Onboarded",
        "message": "John Doe has been successfully onboarded to the system.",
        "notification_type": "employee_onboarded",
        "priority": "medium",
        "is_global": False
    },
]

async def create_test_notifications():
    """Create test notifications for development"""
    import os
    import httpx
    
    # This will use the backend URL from your environment
    port = os.getenv("BACKEND_PORT", "8001")
    backend_url = f"http://localhost:{port}/api/v1"
    
    # If you're running in Docker, use the service name
    # backend_url = "http://backend:8000/api/v1"
    
    async with httpx.AsyncClient() as client:
        # First, try to get a token (replace with your actual credentials)
        # This is just for testing - in production, use proper authentication
        print("Creating test notifications...")
        print(f"Backend URL: {backend_url}")
        
        for i, notification in enumerate(SAMPLE_NOTIFICATIONS):
            try:
                # Create for first user
                if SAMPLE_USER_IDS:
                    notification["user_id"] = SAMPLE_USER_IDS[0]
                
                response = await client.post(
                    f"{backend_url}/notifications",
                    json=notification,
                    timeout=10.0
                )
                
                if response.status_code in [200, 201]:
                    print(f"✅ Created notification {i+1}: {notification['title']}")
                else:
                    print(f"❌ Failed to create notification {i+1}: HTTP {response.status_code}")
                    print(f"   Response: {response.text}")
                    
            except Exception as e:
                print(f"❌ Error creating notification {i+1}: {e}")
        
        # Also create a global notification
        global_notification = {
            "title": "System Maintenance",
            "message": "The system will undergo maintenance tonight at 2 AM. Please save your work.",
            "notification_type": "system_alert",
            "priority": "high",
            "is_global": True
        }
        
        try:
            response = await client.post(
                f"{backend_url}/notifications/admin/global",
                json=global_notification,
                timeout=10.0
            )
            if response.status_code in [200, 201]:
                print(f"✅ Created global notification: {global_notification['title']}")
            else:
                print(f"❌ Failed to create global notification: HTTP {response.status_code}")
        except Exception as e:
            print(f"❌ Error creating global notification: {e}")

if __name__ == "__main__":
    asyncio.run(create_test_notifications())
