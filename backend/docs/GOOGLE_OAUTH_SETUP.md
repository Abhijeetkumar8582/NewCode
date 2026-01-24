# Google OAuth2 Setup Guide

This guide explains how to set up Google OAuth2 authentication for the application.

## Prerequisites

1. A Google Cloud Platform (GCP) account
2. Access to the [Google Cloud Console](https://console.cloud.google.com/)

## Step 1: Create OAuth 2.0 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth client ID**
5. If prompted, configure the OAuth consent screen:
   - Choose **External** (for testing) or **Internal** (for Google Workspace)
   - Fill in the required information:
     - App name
     - User support email
     - Developer contact information
   - Add scopes: `email`, `profile`, `openid`
   - Add test users (if external)
6. Configure the OAuth client:
   - Application type: **Web application**
   - Name: Your app name
   - Authorized JavaScript origins:
     - `http://localhost:3000` (for development)
     - `http://localhost:9001` (for backend)
     - Your production domain (for production)
   - Authorized redirect URIs:
     - `http://localhost:9001/api/auth/google/callback` (for development)
     - `https://yourdomain.com/api/auth/google/callback` (for production)
7. Click **Create**
8. Copy the **Client ID** and **Client Secret**

## Step 2: Configure Environment Variables

Add the following to your `.env` file:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:9001/api/auth/google/callback
```

For production, update the redirect URI:

```env
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/auth/google/callback
```

## Step 3: Run Database Migration

Make sure you've run the OAuth support migration:

```bash
psql -U postgres -d epiplex -f migrations/003_add_oauth_support.sql
```

## Step 4: Install Dependencies

The required dependencies are already included in `requirements.txt`:

```bash
pip install -r requirements.txt
```

Key dependencies for Google OAuth:
- `httpx==0.25.2` - For making HTTP requests to Google APIs
- `python-multipart` - For handling form data in requests

## API Endpoints

### 1. Initiate Google OAuth Flow

**GET** `/api/auth/google`

Redirects the user to Google's OAuth consent screen.

**Query Parameters:**
- `redirect_uri` (optional): Frontend URL to redirect to after authentication

**Example:**
```
GET /api/auth/google?redirect_uri=http://localhost:3000/dashboard
```

### 2. OAuth Callback

**GET** `/api/auth/google/callback`

Handles the OAuth callback from Google. This endpoint:
- Exchanges the authorization code for tokens
- Gets user information from Google
- Creates or retrieves the user account
- Generates JWT and session tokens
- Redirects to frontend with tokens

**Query Parameters:**
- `code`: Authorization code from Google (automatically provided)
- `state`: State parameter for CSRF protection (automatically provided)

### 3. Token Exchange (Alternative)

**POST** `/api/auth/google/token`

Alternative endpoint that returns JSON instead of redirecting. Useful for SPA applications.

**Query Parameters:**
- `code`: Authorization code from Google

**Response:**
```json
{
  "access_token": "jwt_token_here",
  "session_token": "session_token_here",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "full_name": "John Doe",
    "email": "john@example.com",
    "role": "user",
    "is_active": true
  },
  "expires_at": "2024-01-01T00:00:00Z"
}
```

## Frontend Integration

### Option 1: Redirect Flow

```javascript
// Redirect user to Google OAuth
window.location.href = 'http://localhost:9001/api/auth/google?redirect_uri=http://localhost:3000';
```

Then handle the callback on your frontend:

```javascript
// On /auth/google/callback page
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');
const session = urlParams.get('session');

if (token) {
  // Store tokens
  localStorage.setItem('access_token', token);
  localStorage.setItem('session_token', session);

  // Redirect to dashboard
  window.location.href = '/dashboard';
}
```

### Option 2: Popup Flow

```javascript
// Open Google OAuth in popup
const popup = window.open(
  'http://localhost:9001/api/auth/google?redirect_uri=http://localhost:3000',
  'google-auth',
  'width=500,height=600'
);

// Listen for callback
window.addEventListener('message', (event) => {
  if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
    const { token, session } = event.data;
    localStorage.setItem('access_token', token);
    localStorage.setItem('session_token', session);
    popup.close();
    window.location.href = '/dashboard';
  }
});
```

## Quick Setup (3 Steps)

### 1. Configure Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create/select a project
3. Enable Google+ API and Google OAuth2 API
4. Go to **APIs & Services** > **Credentials**
5. Click **Create Credentials** > **OAuth client ID**
6. Configure OAuth consent screen (if prompted)
7. Set application type to **Web application**
8. Add authorized redirect URIs: `http://localhost:9001/api/auth/google/callback`

### 2. Configure Environment Variables
Add to your `.env` file:
```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:9001/api/auth/google/callback
```

### 3. Run Database Migration
```bash
# Connect to your MySQL database and run:
source backend/migrations/003_add_oauth_support.sql
```

## How It Works

1. User clicks "Sign in with Google" on frontend
2. Frontend redirects to `/api/auth/google`
3. Backend redirects to Google OAuth consent screen
4. User authorizes the application
5. Google redirects to `/api/auth/google/callback` with authorization code
6. Backend exchanges code for access token
7. Backend fetches user info from Google
8. Backend creates or retrieves user account
9. Backend generates JWT and session tokens
10. Backend redirects to frontend with tokens
11. Frontend stores tokens and authenticates user

## User Account Linking

- If a user signs up with email/password and later signs in with Google (same email), their accounts are automatically linked
- The `provider` field tracks the authentication method: `'email'` or `'google'`
- Users can have both `password_hash` and `google_id` if they've used both methods

## Security Notes

- Always use HTTPS in production
- Store `GOOGLE_CLIENT_SECRET` securely (never commit to version control)
- The `state` parameter provides CSRF protection
- Tokens are only sent in the redirect URL for development - consider using a more secure method in production (e.g., one-time token exchange)

## Testing Google OAuth Setup

### Test Environment Variables
```bash
cd backend
python -c "
from app.config import settings
print('GOOGLE_CLIENT_ID:', bool(settings.GOOGLE_CLIENT_ID))
print('GOOGLE_CLIENT_SECRET:', bool(settings.GOOGLE_CLIENT_SECRET))
print('GOOGLE_REDIRECT_URI:', settings.GOOGLE_REDIRECT_URI)
"
```

### Test OAuth Flow
1. Run the configuration test: `python test_google_oauth.py`
2. Start your backend server: `python start.py`
3. Go to `http://localhost:3000/auth`
4. Click "Continue with Google"
5. Complete Google OAuth flow
6. Check backend logs for successful authentication

### Verify Database Records
```sql
-- Check OAuth users in database
SELECT id, email, full_name, provider, google_id, created_at
FROM users
WHERE provider = 'google'
ORDER BY created_at DESC;
```

## Troubleshooting

### "Redirect URI mismatch" error
- Ensure the redirect URI in your `.env` matches exactly what's configured in Google Cloud Console
- Check for trailing slashes and protocol (http vs https)
- For development: `http://localhost:9001/api/auth/google/callback`
- For production: `https://yourdomain.com/api/auth/google/callback`

### "Invalid client" error
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
- Ensure credentials are for the correct project
- Check that OAuth consent screen is configured

### "access_denied" error
- User denied consent or closed the popup
- Check OAuth consent screen configuration
- Ensure test users are added (if using external app type)

### User not created
- Check database migration was run (`003_add_oauth_support.sql`)
- Verify database connection
- Check application logs for errors
- Ensure Google user info includes email and id fields

### Token exchange fails
- Verify `GOOGLE_CLIENT_SECRET` is correct
- Check that the authorization code is not expired (codes expire quickly)
- Ensure redirect URI matches exactly

### Frontend callback issues
- Check browser console for JavaScript errors
- Verify CORS settings allow your frontend domain
- Check that tokens are being stored correctly in localStorage

