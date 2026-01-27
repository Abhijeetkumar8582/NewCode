# Backend API Sitemap / URL Paths

**Base URL**: `http://52.66.222.206:9001`

---

## 📍 Root & Health Endpoints

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/` | Root endpoint - API information | ❌ No |
| GET | `/health` | Basic health check | ❌ No |
| GET | `/api/health` | Detailed health check with service status | ❌ No |
| GET | `/metrics` | Prometheus metrics (basic) | ❌ No |
| GET | `/api/metrics` | Performance metrics (requires auth) | ✅ Yes |

---

## 🔐 Authentication Endpoints

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| POST | `/api/auth/signup` | Register a new user | ❌ No |
| POST | `/api/auth/login` | Login user and get access token | ❌ No |
| GET | `/api/auth/me` | Get current authenticated user information | ✅ Yes |
| GET | `/api/auth/google` | Initiate Google OAuth flow | ❌ No |
| GET | `/api/auth/google/callback` | Handle Google OAuth callback | ❌ No |
| POST | `/api/auth/google/token` | Exchange Google OAuth code for tokens | ❌ No |

---

## 📤 Video Upload & Management

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| POST | `/api/upload` | Upload video file and start processing | ✅ Yes |
| GET | `/api/uploads` | Get paginated list of user's video uploads | ✅ Yes |
| GET | `/api/uploads/{upload_id}` | Get specific video upload by ID | ✅ Yes |
| PATCH | `/api/uploads/{upload_id}` | Update video upload metadata | ✅ Yes |
| DELETE | `/api/uploads/{upload_id}` | Delete a video upload (soft/hard delete) | ✅ Yes |
| POST | `/api/uploads/bulk-delete` | Bulk delete multiple video uploads | ✅ Yes |
| POST | `/api/uploads/{upload_id}/restore` | Restore a soft-deleted video upload | ✅ Yes |
| POST | `/api/uploads/{upload_id}/retry` | Retry processing a failed video upload | ✅ Yes |

---

## 🎬 Video Panel & Listing

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/api/videos/panel` | Get all videos for panel/list view with frame statistics | ✅ Yes |

---

## 🎥 Video Details & Analysis

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/api/videos/{video_id}/frames` | Get frame analyses for a video | ✅ Yes |
| GET | `/api/videos/{video_id}/transcript` | Get video transcript | ✅ Yes |
| GET | `/api/videos/{video_id}/document` | Get complete document/data for a video by ID | ✅ Yes |
| GET | `/api/videos/file-number/{video_file_number}/status` | Get video status by file number | ✅ Yes |
| GET | `/api/videos/file-number/{video_file_number}/audio` | Get video audio by file number | ✅ Yes |
| GET | `/api/videos/file-number/{video_file_number}/document` | Get complete document/data for a video by file number | ✅ Yes |

---

## 📊 Activity Logs

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/api/activity-logs` | Get paginated activity logs with filtering | ✅ Yes |
| GET | `/api/activity-logs/{log_id}` | Get a specific activity log by ID | ✅ Yes |
| GET | `/api/activity-logs/stats` | Get activity statistics | ✅ Yes |
| GET | `/api/activity-logs/actions` | Get list of available action types | ✅ Yes |

---

## ⚙️ Settings

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/api/settings/openai-key` | Get user's OpenAI API key (encrypted) | ✅ Yes |
| GET | `/api/settings/openai-key/check` | Check if OpenAI key is available | ✅ Yes |
| PUT | `/api/settings/openai-key` | Update user's OpenAI API key | ✅ Yes |

---

## 📄 Interactive API Documentation

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/docs` | Swagger UI - Interactive API documentation | ❌ No |
| GET | `/redoc` | ReDoc - Alternative API documentation | ❌ No |
| GET | `/openapi.json` | OpenAPI schema (JSON) | ❌ No |

---

## 📝 Notes

### Documented but Not Currently Implemented
The following endpoints are mentioned in `API_ENDPOINTS.md` but may not be active in the current codebase:
- `GET /api/status/{job_id}` - Job status endpoint
- `GET /api/download/{job_id}` - Document download endpoint  
- `GET /api/videos/file-number/{video_file_number}/gpt-responses` - GPT responses endpoint

These may be legacy endpoints or planned features. Check the actual implementation in `main.py` or use `/docs` for the current API schema.

---

### Authentication
- Most endpoints require JWT Bearer token in the `Authorization` header:
  ```
  Authorization: Bearer <your_access_token>
  ```
- Token is obtained from `/api/auth/login` or Google OAuth endpoints

### Query Parameters
Many endpoints support query parameters for filtering, pagination, and sorting. Refer to the full API documentation in `backend/docs/API_ENDPOINTS.md` for detailed parameter lists.

### Rate Limiting
Some endpoints have rate limiting configured. Exceeding limits returns `429 Too Many Requests`.

### Video File Numbers
- Format: `VF-YYYY-NNNN` (e.g., `VF-2024-0001`)
- Used to fetch video data by file number instead of UUID

---

## 🔗 Quick Reference

**Base URL**: `http://52.66.222.206:9001`

**Total Endpoints**: 33

**Public Endpoints** (No Auth): 8
- `/`, `/health`, `/api/health`, `/metrics`, `/docs`, `/redoc`, `/openapi.json`
- `/api/auth/signup`, `/api/auth/login`, `/api/auth/google/*`

**Protected Endpoints** (Auth Required): 25
