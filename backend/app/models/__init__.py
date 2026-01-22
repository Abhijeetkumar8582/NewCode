"""Models package - exports all schemas"""

# Authentication schemas
from app.models.auth_schemas import (
    UserSignup,
    UserLogin,
    UserResponse,
    LoginResponse,
    SignupResponse
)

# Video upload schemas
from app.models.video_schemas import (
    VideoUploadCreate,
    VideoUploadResponse,
    VideoUploadListResponse,
    VideoUploadUpdate,
    BulkDeleteRequest
)

# Activity log schemas
from app.models.activity_schemas import (
    ActivityLogResponse,
    ActivityLogListResponse,
    ActivityLogStatsResponse
)

# Video panel schemas
from app.models.video_panel_schemas import (
    VideoPanelItem,
    VideoPanelResponse
)

__all__ = [
    # Auth schemas
    "UserSignup",
    "UserLogin",
    "UserResponse",
    "LoginResponse",
    "SignupResponse",
    # Video schemas
    "VideoUploadCreate",
    "VideoUploadResponse",
    "VideoUploadListResponse",
    "VideoUploadUpdate",
    "BulkDeleteRequest",
    # Activity schemas
    "ActivityLogResponse",
    "ActivityLogListResponse",
    "ActivityLogStatsResponse",
    # Video panel schemas
    "VideoPanelItem",
    "VideoPanelResponse",
]
