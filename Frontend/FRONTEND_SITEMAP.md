# Frontend Sitemap / URL Paths

**Base URL**: `http://52.66.222.206` (or configured domain)

---

## 📍 Public Routes (No Authentication Required)

| Path | Description | Query Parameters | Notes |
|------|-------------|------------------|-------|
| `/` | Home/Index page | None | Auto-redirects to `/dashboard` if authenticated, otherwise to `/auth` |
| `/auth` | Authentication page (Login/Signup) | `error`, `message` | Supports both email/password and Google OAuth login |
| `/auth/google/callback` | Google OAuth callback handler | `code`, `token`, `session`, `error` | Processes Google OAuth authentication |

---

## 🔒 Protected Routes (Authentication Required)

| Path | Description | Query Parameters | Notes |
|------|-------------|------------------|-------|
| `/dashboard` | Main dashboard with video statistics | None | Shows overview of all videos, stats, and analytics |
| `/process-data` | Video upload and processing page | None | Upload videos, view processing status, manage uploads |
| `/document` | Document viewer and management | `video` (video file number) | View generated documents, transcripts, frames, and summaries |
| `/activity-log` | User activity log viewer | None | View all user activities and actions |
| `/account` | User account settings | None | View and edit user profile information |
| `/help` | Help & Support page | None | Documentation and support resources |

---

## 📋 Route Details

### `/` (Root/Home)
- **Type**: Public (redirects based on auth status)
- **Behavior**: 
  - If authenticated → redirects to `/dashboard`
  - If not authenticated → redirects to `/auth`
- **File**: `pages/index.js`

### `/auth`
- **Type**: Public
- **Features**:
  - Email/Password login
  - Email/Password signup
  - Google OAuth login button
- **Query Parameters**:
  - `error`: Error type (e.g., `oauth_failed`)
  - `message`: Error message to display
- **File**: `pages/auth.js`

### `/auth/google/callback`
- **Type**: Public (OAuth callback)
- **Purpose**: Handles Google OAuth authentication callback
- **Query Parameters**:
  - `code`: Authorization code from Google (exchanges for tokens)
  - `token`: Direct access token (if provided by backend)
  - `session`: Session token (if provided by backend)
  - `error`: Error message from OAuth flow
- **Behavior**: 
  - Processes OAuth callback
  - Stores tokens in localStorage
  - Redirects to `/dashboard` on success
  - Redirects to `/auth?error=...` on failure
- **File**: `pages/auth/google/callback.js`

### `/dashboard`
- **Type**: Protected (requires authentication)
- **Features**:
  - Video statistics overview
  - Total videos, completed, processing, failed counts
  - Success rate, total duration, average duration
  - Status distribution charts
  - Application and language distribution
  - Monthly and daily processing charts
  - Video list with filtering and sorting
- **File**: `pages/dashboard.js`

### `/process-data`
- **Type**: Protected (requires authentication)
- **Features**:
  - Video file upload (drag & drop or file picker)
  - Multiple file upload support
  - Upload progress tracking
  - Video list with pagination
  - Filter by status, file name, application name, language, priority, tags
  - Sort by various fields
  - View mode: List or Grid
  - Bulk delete operations
  - Retry failed uploads
  - View processing status
- **File**: `pages/process-data.js`

### `/document`
- **Type**: Protected (requires authentication)
- **Query Parameters**:
  - `video`: Video file number (e.g., `VF-2024-0001`) - Optional, if not provided shows document list
- **Features**:
  - Document list view (if no video parameter)
  - Document detail view (if video parameter provided)
  - Tabs: Transcribe, Frames, Summaries
  - View video transcript
  - View frame analyses with GPT responses
  - View video summaries
  - Export document (PDF, DOCX, HTML)
  - Bulk operations on documents
  - Pagination and filtering
- **File**: `pages/document.js`

### `/activity-log`
- **Type**: Protected (requires authentication)
- **Features**:
  - View all user activity logs
  - Filter by action type
  - Filter by date range
  - Search functionality
  - Pagination
  - Activity statistics
- **File**: `pages/activity-log.js`

### `/account`
- **Type**: Protected (requires authentication)
- **Features**:
  - View user profile information
  - Edit user details (name, email)
  - View account creation date
  - View last login date
- **File**: `pages/account.js`

### `/help`
- **Type**: Protected (requires authentication)
- **Features**:
  - Help documentation
  - Support resources
  - FAQ section
- **File**: `pages/help.js`

---

## 🔄 Navigation Flow

### Authentication Flow
```
/ → /auth → [Login/Signup] → /dashboard
/ → /auth → [Google OAuth] → /auth/google/callback → /dashboard
```

### Main Application Flow
```
/dashboard → /process-data → /document?video=VF-XXXX-XXXX
```

### Navigation Menu (from Layout component)
- **Main Navigation**:
  - Dashboard (`/dashboard`)
  - Process Data (`/process-data`)
  - Document (`/document`)
- **Support Navigation**:
  - Activity Log (`/activity-log`)
  - Help & Support (`/help`)

---

## 📝 Notes

### Authentication
- All protected routes check authentication status
- Unauthenticated users are redirected to `/auth`
- Authenticated users on `/auth` are redirected to `/dashboard`
- Authentication state is stored in `localStorage`:
  - `access_token`: JWT token
  - `session_token`: Session identifier
  - `user`: User object (JSON)

### Route Protection
- Routes are protected in `_app.js` using `requiresAuth()` function
- Public routes: `/auth`, `/api`
- All other routes require authentication

### Query Parameters
- Query parameters are accessed via `router.query` in Next.js
- Common patterns:
  - `/auth?error=oauth_failed&message=...` - Error display
  - `/document?video=VF-2024-0001` - Specific document view

### Data Prefetching
- The app uses a prefetch service to load data in the background
- Prefetching occurs on main pages: `/dashboard`, `/process-data`, `/document`
- Helps improve perceived performance

### Page View Logging
- All page views are logged via `activityLogger`
- Logs include page name, path, query parameters, and timestamps

---

## 🔗 Quick Reference

**Base URL**: `http://52.66.222.206` (or configured domain)

**Total Routes**: 9

**Public Routes**: 3
- `/`, `/auth`, `/auth/google/callback`

**Protected Routes**: 6
- `/dashboard`, `/process-data`, `/document`, `/activity-log`, `/account`, `/help`

**Special Routes**:
- `/` - Auto-redirect based on auth status
- `/auth/google/callback` - OAuth callback handler
