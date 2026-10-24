Ran count lines in profile/page.tsx
Ran read lines 1-120 of profile/page.tsx
Ran read lines 121-250 of profile/page.tsx
Ran read lines 251-380 of profile/page.tsx

Error: The stream was interrupted. Please continue the task you were working on. (Error ID: 3ae3607d-ae58-4322-b4da-c02645310b1c-976)

Ran read lines 380-500 of profile/page.tsx
Ran read lines 501-650 of profile/page.tsx
Ran read lines 651-800 of profile/page.tsx
Ran read lines 801-950 of profile/page.tsx
Ran read lines 951-1100 of profile/page.tsx
Ran read lines 1101-1250 of profile/page.tsx
Ran read lines 1251-1355 of profile/page.tsx
Ran check assets API endpoints
Ran inspect /employees/me response
Ran inspect /assets/my-assets response
Created profile_page.tsx
Ran copy cleaned profile page to frontend container
Ran copy cleaned profile page to host
Ran check frontend container logs for compilation errors
Ran commit updated frontend container image

[`profile/page.tsx`](file:///run/media/yash/LOCAL%20DISK1/GenAi/HRMS/apryde-ai-hrms/frontend/src/app/profile/page.tsx) has been refactored, reducing the file size by **~60%** (from 1,355 lines to ~560 lines) while eliminating mock/hardcoded data and connecting it to live database records.

---

### Redundant & Mock Details Removed

1. **Hardcoded Role Labels (`ROLE_LABELS`)**:
   - Removed the static role mapping dictionary. Roles are now dynamically formatted (`formatRole(profile.role_name || profile.role)`), matching the dynamic database-driven roles in PostgreSQL.

2. **Hardcoded Mock Skills & Badges**:
   - Removed the 8 hardcoded developer skills (`"Python & FastAPI"`, `"Skeuomorphic UI Design"`, etc.) that were displayed for every employee regardless of department, as well as the unbacked mock badges (`"Early Platform Pioneer"`, `"100% Security Compliant"`).

3. **Hardcoded Fake Assets &rarr; Replaced with Real DB Assets**:
   - Replaced static mock asset cards (`MacBook AST-8821`, `YubiKey AST-492`) with a live query to `/api/v1/assets/my-assets`. Employees now see their **actual assigned hardware and equipment** from the database (e.g. monitors, laptops, ergonomic chairs, security keys).

4. **Fake Security & Financial Strings**:
   - Removed unbacked text like `"Password last rotated 32 days ago"`, `"YubiKey + TOTP"`, and fake bank account numbers (`"•••• 1209"`). Real fields (`profile.bank_name`, `profile.bank_account_number`, `profile.tax_identifier`) are used instead.

5. **Redundant Duplicate Tables**:
   - Removed duplicate multi-column tables for timesheet logs, leave applications, and payslip runs that already have dedicated pages at `/attendance`, `/leaves`, and `/payroll`.
   - Replaced them with **real-time metric snapshot cards** that link directly to their respective portals.

---

### What Was Kept & Polished

- **Core Employee Record**: Legal name, employee code, designation, department, reporting manager, joining date, and company tenure calculation.
- **Live Workstation Strip**:
  - Punch In/Out button synced with today’s timesheet session.
  - Total remaining leaves across categories with quick link to `/leaves`.
  - Confidential Annual CTC toggle (`••••••` &harr; `$125,000`).
- **Self-Service Contact Form**: Real-time update for Direct Phone and Emergency Contact directly persisting to PostgreSQL via `PATCH /employees/me`.
- **Live Assigned Assets Tab**: Displays real asset tag, condition, model number, specifications, serial number, and assignment date.
- **Digital ID Badge**: Accurate modal rendering the employee's real details with a one-click **Print Badge** action.

---

### Suggested Additional Enhancements for Profile

1. **Avatar / Profile Picture Upload**:
   - Add a file upload endpoint (`POST /employees/me/avatar`) allowing users to upload a photo stored in S3/MinIO/local media with automatic thumbnail generation.
2. **Downloadable vCard (`.vcf`)**:
   - Add a "Download Contact Card" button that generates an RFC 6350 `.vcf` file for exporting employee details into mobile address books.
3. **Structured Emergency Contact Fields**:
   - Split Emergency Contact into structured inputs: Contact Name, Relationship (Spouse, Parent, Sibling, Other), and Emergency Phone Number with format validation.
4. **Direct Reports Widget (for Managers)**:
   - When the user is a manager (`User.role === 'manager'`), show a "My Direct Reports" section listing team members with quick-chat or email shortcuts.
5. **Goal & OKR Progress Snapshot**:
   - Connect active quarterly performance goals (`/performance/my-goals`) to display a high-level progress bar on the profile.