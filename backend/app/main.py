from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Request, Header, Query, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, FileResponse, RedirectResponse
from fastapi.exceptions import RequestValidationError
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.exceptions import HTTPException as StarletteHTTPException
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import os
from pathlib import Path
import uuid
import asyncio
import aiofiles
from contextlib import asynccontextmanager
from typing import Optional, List
from datetime import timedelta, datetime, timezone
from uuid import UUID

from app.config import settings
from app.database import init_db, get_db, AsyncSession, User, VideoDocumentation, FrameAnalysis
from app.services.auth_service import AuthService
from app.services.activity_service import ActivityService
from app.services.google_oauth_service import GoogleOAuthService
from app.services.video_upload_service import VideoUploadService
from app.services.video_metadata_service import VideoMetadataService
from app.services.cache_service import CacheService
from app.services.metrics_service import metrics_service
from app.services.system_monitor import system_monitor
from app.models import (
    UserSignup, UserLogin, SignupResponse, LoginResponse, UserResponse,
    VideoUploadCreate, VideoUploadResponse, VideoUploadListResponse, VideoUploadUpdate, BulkDeleteRequest,
    ActivityLogResponse, ActivityLogListResponse, ActivityLogStatsResponse,
    VideoPanelItem, VideoPanelResponse
)
from app.utils.logger import configure_logging, logger
from app.utils.validators import validate_file, validate_file_size
from app.middleware.error_handler import (
    validation_exception_handler,
    http_exception_handler,
    general_exception_handler
)
from app.middleware.request_logging import RequestLoggingMiddleware

# Security
security = HTTPBearer()

# Configure logging
# #region agent log
try:
    log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
    import json
    import time
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(json.dumps({"sessionId":"debug-session","runId":"startup-debug","hypothesisId":"A,B,C","location":"main.py:configure_logging","message":"Module loading - before configure_logging","data":{},"timestamp":int(time.time()*1000)}) + "\n")
except Exception as e:
    # If logging fails, at least try to print
    print(f"[DEBUG] Failed to write startup log: {e}")
# #endregion
configure_logging()
# #region agent log
try:
    log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
    import json
    import time
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(json.dumps({"sessionId":"debug-session","runId":"startup-debug","hypothesisId":"A,B,C","location":"main.py:configure_logging","message":"Module loading - after configure_logging","data":{},"timestamp":int(time.time()*1000)}) + "\n")
except: pass
# #endregion

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

# Directories
UPLOAD_DIR = settings.UPLOAD_DIR  # Temporary storage before S3 upload
AUDIO_DIR = settings.AUDIO_DIR
UPLOAD_DIR.mkdir(exist_ok=True, parents=True)
AUDIO_DIR.mkdir(exist_ok=True, parents=True)

# Initialize services


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    # #region agent log
    try:
        log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
        import json
        import time
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId":"debug-session","runId":"startup-debug","hypothesisId":"D","location":"main.py:lifespan","message":"Lifespan startup entry","data":{"api_version":settings.API_VERSION},"timestamp":int(time.time()*1000)}) + "\n")
    except: pass
    # #endregion
    logger.info("Starting application", version=settings.API_VERSION)
    
    try:
        # #region agent log
        try:
            log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
            import json
            import time
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"startup-debug","hypothesisId":"D","location":"main.py:init_db","message":"Before init_db call","data":{},"timestamp":int(time.time()*1000)}) + "\n")
        except: pass
        # #endregion
        await init_db()
        # #region agent log
        try:
            log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
            import json
            import time
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"startup-debug","hypothesisId":"D","location":"main.py:init_db","message":"After init_db call - success","data":{},"timestamp":int(time.time()*1000)}) + "\n")
        except: pass
        # #endregion
        logger.info("Database initialized")
    except Exception as e:
        # #region agent log
        try:
            log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
            import json
            import time
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"startup-debug","hypothesisId":"D","location":"main.py:init_db","message":"init_db exception","data":{"error":str(e),"error_type":type(e).__name__},"timestamp":int(time.time()*1000)}) + "\n")
        except: pass
        # #endregion
        logger.error("Failed to initialize database", error=str(e), exc_info=True)
        logger.error("Application will continue but database operations may fail")
        logger.error("Please check your DATABASE_URL in .env file and ensure the database is accessible")
        # Don't raise - let the app start and show errors on actual database operations
    
    # Start system monitoring
    from app.services.system_monitor import system_monitor
    if getattr(settings, 'METRICS_ENABLED', True):
        system_monitor.start_background_monitoring()
    
    yield
    # Shutdown
    logger.info("Shutting down application")


app = FastAPI(
    title=settings.API_TITLE,
    version=settings.API_VERSION,
    description=settings.API_DESCRIPTION,
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# Request logging middleware (should be first to capture all requests)
app.add_middleware(RequestLoggingMiddleware)

# Compression middleware (should be added before CORS)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS middleware - Comprehensive configuration to allow any localhost origin
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

class UniversalCORSMiddleware(BaseHTTPMiddleware):
    """CORS middleware that allows any localhost origin and configured origins"""
    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("Origin")
        method = request.method
        
        # Determine if origin should be allowed
        allowed = False
        if origin:
            # Always allow localhost or 127.0.0.1 (any port)
            if "localhost" in origin.lower() or "127.0.0.1" in origin:
                allowed = True
            # Check configured origins
            else:
                configured_origins = settings.CORS_ORIGINS
                if isinstance(configured_origins, str):
                    configured_origins = [configured_origins]
                elif not isinstance(configured_origins, list):
                    configured_origins = []
                if origin in configured_origins:
                    allowed = True
        
        # Handle preflight OPTIONS requests
        if method == "OPTIONS":
            if allowed and origin:
                return Response(
                    status_code=200,
                    headers={
                        "Access-Control-Allow-Origin": origin,
                        "Access-Control-Allow-Credentials": "true",
                        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD",
                        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept, Origin",
                        "Access-Control-Max-Age": "86400",  # 24 hours
                    }
                )
            # Return 200 for OPTIONS even without origin (some browsers don't send it)
            return Response(status_code=200)
        
        # Process the actual request
        response = await call_next(request)
        
        # Add CORS headers to all responses if origin is allowed
        if allowed and origin:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With, Accept, Origin"
            response.headers["Access-Control-Expose-Headers"] = "Content-Length, Content-Type, Authorization"
        
        return response

# Add the universal CORS middleware
app.add_middleware(UniversalCORSMiddleware)

# Log CORS configuration
logger.info("CORS middleware configured - allowing all localhost origins", 
           configured_origins=settings.CORS_ORIGINS,
           allow_credentials=settings.CORS_ALLOW_CREDENTIALS)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Error handlers
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Video Processing API",
        "version": settings.API_VERSION,
        "status": "operational"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": settings.API_VERSION,
        "database": "connected"
    }


@app.middleware("http")
async def cors_debug_middleware(request: Request, call_next):
    """Middleware to log CORS-related information for debugging"""
    origin = request.headers.get("Origin")
    if origin:
        logger.debug("CORS request", origin=origin, path=request.url.path, method=request.method)
    response = await call_next(request)
    return response


@app.get("/metrics")
async def prometheus_metrics():
    """
    Prometheus metrics endpoint
    Returns metrics in Prometheus format
    """
    if not getattr(settings, 'METRICS_ENABLED', True):
        from fastapi.responses import PlainTextResponse
        return PlainTextResponse(content="# Metrics disabled\n", media_type="text/plain")
    
    from fastapi.responses import PlainTextResponse
    
    lines = []
    
    # HTTP Request Metrics
    request_counts = metrics_service.get_request_counts()
    for endpoint, counts in request_counts.items():
        # Parse method and path from endpoint key (format: "METHOD /path")
        parts = endpoint.split(' ', 1)
        method = parts[0] if len(parts) > 0 else 'GET'
        path = parts[1] if len(parts) > 1 else endpoint
        
        # Escape quotes in path for Prometheus
        path_escaped = path.replace('"', '\\"')
        
        for status_code, count in counts.items():
            lines.append(
                f'http_requests_total{{method="{method}",endpoint="{path_escaped}",status="{status_code}"}} {count}'
            )
    
    # Response Time Histogram (simplified - using percentiles)
    response_times = metrics_service.get_response_time_stats()
    for endpoint, stats in response_times.items():
        # Parse method and path from endpoint key
        parts = endpoint.split(' ', 1)
        method = parts[0] if len(parts) > 0 else 'GET'
        path = parts[1] if len(parts) > 1 else endpoint
        
        # Escape quotes in path for Prometheus
        path_escaped = path.replace('"', '\\"')
        
        # Convert to seconds for Prometheus
        for percentile, value in stats.items():
            if percentile.startswith('p'):
                lines.append(
                    f'http_request_duration_seconds{{method="{method}",endpoint="{path_escaped}",quantile="{percentile}"}} {value / 1000.0}'
                )
        
        # Average and max
        if 'avg' in stats:
            lines.append(
                f'http_request_duration_seconds_sum{{method="{method}",endpoint="{path_escaped}"}} {stats["avg"] * stats.get("count", 1) / 1000.0}'
            )
            lines.append(
                f'http_request_duration_seconds_count{{method="{method}",endpoint="{path_escaped}"}} {stats.get("count", 0)}'
            )
    
    # Cache Metrics
    cache_stats = metrics_service.get_cache_stats()
    for cache_type, stats in cache_stats.items():
        lines.append(f'cache_hits_total{{cache_type="{cache_type}"}} {stats["hits"]}')
        lines.append(f'cache_misses_total{{cache_type="{cache_type}"}} {stats["misses"]}')
        lines.append(f'cache_hit_rate{{cache_type="{cache_type}"}} {stats["hit_rate"]}')
    
    # System Resource Metrics
    current_metrics = system_monitor.get_current_metrics()
    if current_metrics:
        memory = current_metrics.get('memory', {})
        cpu = current_metrics.get('cpu', {})
        
        if memory:
            lines.append(f'system_memory_process_bytes {memory.get("process_mb", 0) * 1024 * 1024}')
            lines.append(f'system_memory_available_bytes {memory.get("system_available_gb", 0) * 1024 * 1024 * 1024}')
            lines.append(f'system_memory_used_percent {memory.get("system_used_percent", 0)}')
        
        if cpu:
            lines.append(f'system_cpu_process_percent {cpu.get("process_percent", 0)}')
            lines.append(f'system_cpu_system_percent {cpu.get("system_percent", 0)}')
    
    # Slow Queries Count
    slow_queries = metrics_service.get_slow_queries(limit=1)
    lines.append(f'slow_queries_total {len(slow_queries)}')
    
    # Add help and type comments
    prometheus_output = """# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
# HELP http_request_duration_seconds HTTP request duration in seconds
# TYPE http_request_duration_seconds histogram
# HELP cache_hits_total Total number of cache hits
# TYPE cache_hits_total counter
# HELP cache_misses_total Total number of cache misses
# TYPE cache_misses_total counter
# HELP cache_hit_rate Cache hit rate (0-1)
# TYPE cache_hit_rate gauge
# HELP system_memory_process_bytes Process memory usage in bytes
# TYPE system_memory_process_bytes gauge
# HELP system_memory_available_bytes Available system memory in bytes
# TYPE system_memory_available_bytes gauge
# HELP system_memory_used_percent System memory used percentage
# TYPE system_memory_used_percent gauge
# HELP system_cpu_process_percent Process CPU usage percentage
# TYPE system_cpu_process_percent gauge
# HELP system_cpu_system_percent System CPU usage percentage
# TYPE system_cpu_system_percent gauge
# HELP slow_queries_total Total number of slow queries detected
# TYPE slow_queries_total gauge
""" + "\n".join(lines)
    
    return PlainTextResponse(content=prometheus_output, media_type="text/plain")


@app.get("/api/health")
async def api_health(db: AsyncSession = Depends(get_db)):
    """Detailed health check with actual service tests"""
    import time
    import shutil
    from datetime import datetime, timezone
    from sqlalchemy import text, select, func
    
    overall_status = "healthy"
    services = {}
    
    # Test Database Connectivity
    db_status = "operational"
    db_response_time_ms = 0
    db_error = None
    try:
        start_time = time.time()
        result = await db.execute(text("SELECT 1"))
        result.scalar()  # Consume result
        db_response_time_ms = (time.time() - start_time) * 1000
        
        if db_response_time_ms > 5000:  # >5s is degraded
            db_status = "degraded"
            overall_status = "degraded"
    except Exception as e:
        db_status = "down"
        db_error = str(e)
        overall_status = "unhealthy"
        logger.error("Database health check failed", error=str(e))
    
    services["database"] = {
        "status": db_status,
        "response_time_ms": round(db_response_time_ms, 2),
        "error": db_error
    }
    
    # Check OpenAI API
    openai_status = "not_configured"
    openai_error = None
    if settings.OPENAI_API_KEY:
        openai_status = "configured"
        # Optionally test connectivity (lightweight check)
        try:
            # Just verify key format, don't make actual API call
            if len(settings.OPENAI_API_KEY) > 20 and settings.OPENAI_API_KEY.startswith("sk-"):
                openai_status = "configured"
            else:
                openai_status = "error"
                openai_error = "Invalid API key format"
        except Exception as e:
            openai_status = "error"
            openai_error = str(e)
    
    services["openai"] = {
        "status": openai_status,
        "error": openai_error
    }
    
    # Check Disk Space
    disk_status = "ok"
    available_gb = 0
    used_percent = 0
    disk_error = None
    try:
        upload_dir = Path(settings.UPLOAD_DIR)
        upload_dir.mkdir(exist_ok=True, parents=True)
        
        # Get disk usage
        total, used, free = shutil.disk_usage(upload_dir)
        available_gb = free / (1024 ** 3)  # Convert to GB
        used_percent = (used / total) * 100
        free_percent = (free / total) * 100
        
        if free_percent < settings.HEALTH_CHECK_DISK_CRITICAL_THRESHOLD:
            disk_status = "critical"
            overall_status = "unhealthy"
        elif free_percent < settings.HEALTH_CHECK_DISK_WARNING_THRESHOLD:
            disk_status = "warning"
            if overall_status == "healthy":
                overall_status = "degraded"
    except Exception as e:
        disk_status = "error"
        disk_error = str(e)
        logger.error("Disk space check failed", error=str(e))
    
    services["disk_space"] = {
        "status": disk_status,
        "available_gb": round(available_gb, 2),
        "used_percent": round(used_percent, 2),
        "free_percent": round(100 - used_percent, 2),
        "threshold_warning": settings.HEALTH_CHECK_DISK_WARNING_THRESHOLD,
        "threshold_critical": settings.HEALTH_CHECK_DISK_CRITICAL_THRESHOLD,
        "error": disk_error
    }
    
    
    return {
        "status": overall_status,
        "version": settings.API_VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "services": services
    }


@app.get("/api/metrics")
async def get_performance_metrics(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Get performance metrics in JSON format for dashboard
    Requires authentication
    """
    # Verify authentication
    try:
        payload = AuthService.verify_token(credentials.credentials)
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    
    if not getattr(settings, 'METRICS_ENABLED', True):
        raise HTTPException(status_code=404, detail="Metrics disabled")
    
    # Get response time statistics
    response_times = metrics_service.get_response_time_stats()
    
    # Get slow queries
    slow_queries = metrics_service.get_slow_queries(limit=100)
    
    # Get system resources
    system_resources = system_monitor.get_current_metrics()
    
    # Get cache statistics
    cache_stats = metrics_service.get_cache_stats()
    
    # Get top endpoints
    top_endpoints = metrics_service.get_top_endpoints(limit=10)
    
    # Get error rates
    error_rates = metrics_service.get_error_rates()
    
    # Import timezone here to avoid circular import issues
    from datetime import timezone
    
    return {
        "response_times": response_times,
        "slow_queries": slow_queries,
        "system_resources": {
            "memory": system_resources.get("memory", {}),
            "cpu": system_resources.get("cpu", {}),
            "disk_io": system_resources.get("disk_io", {}),
            "network_io": system_resources.get("network_io", {}),
            "process": system_resources.get("process", {})
        },
        "cache_stats": cache_stats,
        "top_endpoints": [
            {"endpoint": endpoint, "total_requests": count}
            for endpoint, count in top_endpoints
        ],
        "error_rates": error_rates,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


# Authentication dependencies
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Get current authenticated user from JWT token"""
    token = credentials.credentials
    payload = AuthService.verify_token(token)
    
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    
    try:
        # Convert user_id to UUID - handle both string and UUID formats
        if isinstance(user_id, str):
            user_uuid = uuid.UUID(user_id)
        else:
            user_uuid = user_id
        
        user = await AuthService.get_user_by_id(db, user_uuid)
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        if not user.is_active:
            raise HTTPException(status_code=403, detail="User account is inactive")
        
        return user
    except (ValueError, TypeError) as e:
        logger.error("Invalid user ID format in token", user_id=user_id, error=str(e))
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except Exception as e:
        logger.error("Error getting current user", error=str(e), exc_info=True)
        raise HTTPException(status_code=401, detail="Failed to authenticate user")


def get_client_ip(request: Request) -> Optional[str]:
    """Get client IP address from request"""
    if request.client:
        return request.client.host
    return None


def get_user_agent(request: Request) -> Optional[str]:
    """Get user agent from request"""
    return request.headers.get("user-agent")


# Authentication endpoints
@app.post("/api/auth/signup", response_model=SignupResponse)
@limiter.limit("5/minute")
async def signup(
    request: Request,
    user_data: UserSignup,
    db: AsyncSession = Depends(get_db)
):
    """Register a new user"""
    try:
        # Create user
        user = await AuthService.create_user(
            db=db,
            full_name=user_data.full_name,
            email=user_data.email,
            password=user_data.password
        )
        
        # Log activity (non-blocking - uses separate session, won't affect signup)
        await ActivityService.log_activity(
            db=None,  # Use separate session to avoid transaction conflicts
            user_id=user.id,
            action="SIGNUP",
            description=f"User {user.email} registered",
            ip_address=get_client_ip(request)
        )
        
        return SignupResponse(
            message="User registered successfully",
            user=UserResponse.model_validate(user)
        )
    except HTTPException:
        raise
    except Exception as e:
        error_detail = str(e)
        logger.error("Signup error", error=error_detail, exc_info=True)
        # Return more detailed error in debug mode
        if settings.DEBUG:
            raise HTTPException(status_code=500, detail=f"Failed to register user: {error_detail}")
        else:
            raise HTTPException(status_code=500, detail="Failed to register user")


@app.post("/api/auth/login", response_model=LoginResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    credentials: UserLogin,
    db: AsyncSession = Depends(get_db)
):
    """Login user and create session"""
    try:
        # Authenticate user
        user = await AuthService.authenticate_user(
            db=db,
            email=credentials.email,
            password=credentials.password
        )
        
        if not user:
            logger.warning("Login failed - incorrect credentials", email=credentials.email)
            raise HTTPException(status_code=401, detail="Incorrect email or password")
        
        logger.info("User authenticated successfully", user_id=str(user.id), email=user.email)
        
        # Update last login (non-blocking - if it fails, don't fail the login)
        try:
            await AuthService.update_last_login(db, user.id)
        except Exception as login_update_error:
            logger.warning("Failed to update last login", error=str(login_update_error), user_id=str(user.id))
        
        # Create access token
        try:
            access_token = AuthService.create_access_token(
                data={"sub": str(user.id), "email": user.email, "role": user.role},
                expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
            )
        except Exception as token_error:
            logger.error("Failed to create access token", error=str(token_error), user_id=str(user.id))
            raise HTTPException(status_code=500, detail="Failed to create access token")
        
        # Create session (non-blocking - if it fails, still allow login but log the error)
        session = None
        try:
            session = await AuthService.create_session(
                db=db,
                user_id=user.id,
                ip_address=get_client_ip(request),
                user_agent=get_user_agent(request)
            )
        except Exception as session_error:
            logger.error("Failed to create session", error=str(session_error), user_id=str(user.id), exc_info=True)
            # Create a temporary session token for response
            session_token = AuthService.generate_session_token()
            expires_at = datetime.utcnow() + timedelta(days=7)
            # Don't fail login if session creation fails
        
        # Log activity (non-blocking - uses separate session, won't affect login)
        # Pass None for db to use separate session
        await ActivityService.log_activity(
            db=None,  # Use separate session to avoid transaction conflicts
            user_id=user.id,
            action="LOGIN",
            description=f"User {user.email} logged in",
            ip_address=get_client_ip(request)
        )
        
        # Return response
        if session:
            return LoginResponse(
                access_token=access_token,
                session_token=session.session_token,
                user=UserResponse.model_validate(user),
                expires_at=session.expires_at
            )
        else:
            # Fallback if session creation failed
            return LoginResponse(
                access_token=access_token,
                session_token=AuthService.generate_session_token(),
                user=UserResponse.model_validate(user),
                expires_at=datetime.utcnow() + timedelta(days=7)
            )
    except HTTPException:
        raise
    except Exception as e:
        error_detail = str(e)
        logger.error("Login error", error=error_detail, email=credentials.email, exc_info=True)
        # Return more detailed error in debug mode
        if settings.DEBUG:
            raise HTTPException(status_code=500, detail=f"Failed to login: {error_detail}")
        else:
            raise HTTPException(status_code=500, detail="Failed to login")


@app.get("/api/auth/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """Get current user information"""
    # Create response but mask the API key for security
    user_dict = {
        "id": current_user.id,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "last_login_at": current_user.last_login_at,
        "frame_analysis_prompt": current_user.frame_analysis_prompt,
        "openai_api_key": None,  # Never expose the actual API key
        "created_at": current_user.created_at,
        "updated_at": current_user.updated_at
    }
    return UserResponse.model_validate(user_dict)


# Google OAuth endpoints
@app.get("/api/auth/google")
@limiter.limit("10/minute")
async def google_oauth_start(
    request: Request,
    redirect_uri: Optional[str] = Query(None)
):
    """Initiate Google OAuth flow - redirects to Google"""
    try:
        # Store redirect_uri in state if provided (for frontend callback)
        state = None
        if redirect_uri:
            import base64
            state = base64.urlsafe_b64encode(redirect_uri.encode()).decode()
        
        auth_url, state_token = GoogleOAuthService.get_authorization_url(state)
        
        # If redirect_uri was provided, combine it with state_token
        if redirect_uri:
            # Store the state_token with the redirect_uri
            # In production, you might want to use a session or cache for this
            return RedirectResponse(url=auth_url)
        
        return RedirectResponse(url=auth_url)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Google OAuth start error", error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to initiate Google OAuth")


@app.get("/api/auth/google/callback")
async def google_oauth_callback(
    request: Request,
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Handle Google OAuth callback"""
    try:
        # Check for errors from Google
        if error:
            logger.error("Google OAuth error", error=error)
            # Redirect to frontend with error
            frontend_url = settings.CORS_ORIGINS[0] if settings.CORS_ORIGINS else "http://localhost:3000"
            return RedirectResponse(
                url=f"{frontend_url}/auth?error=oauth_failed&message={error}"
            )
        
        if not code:
            raise HTTPException(status_code=400, detail="Authorization code not provided")
        
        # Authenticate with Google
        user = await GoogleOAuthService.authenticate_with_google(db, code)
        
        if not user.is_active:
            raise HTTPException(status_code=403, detail="User account is inactive")
        
        # Update last login
        await AuthService.update_last_login(db, user.id)
        
        # Create access token
        access_token = AuthService.create_access_token(
            data={"sub": str(user.id), "email": user.email, "role": user.role},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        
        # Create session
        session = await AuthService.create_session(
            db=db,
            user_id=user.id,
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request)
        )
        
        # Log activity
        await ActivityService.log_activity(
            db=db,
            user_id=user.id,
            action="LOGIN_GOOGLE",
            description=f"User {user.email} logged in with Google",
            metadata={"provider": "google"},
            ip_address=get_client_ip(request)
        )
        
        # Determine redirect URL - use the frontend callback URL
        frontend_url = settings.CORS_ORIGINS[0] if settings.CORS_ORIGINS else "http://localhost:3000"
        
        # Redirect to frontend Google OAuth callback with tokens
        redirect_url = f"{frontend_url}/auth/google/callback?token={access_token}&session={session.session_token}"
        
        return RedirectResponse(url=redirect_url)
        
    except HTTPException as e:
        # Re-raise HTTP exceptions with their original status codes
        frontend_url = settings.CORS_ORIGINS[0] if settings.CORS_ORIGINS else "http://localhost:3000"
        error_message = e.detail if hasattr(e, 'detail') else "Authentication failed"
        return RedirectResponse(
            url=f"{frontend_url}/auth?error=oauth_failed&message={error_message}"
        )
    except Exception as e:
        logger.error("Google OAuth callback error", 
                    error=str(e), 
                    error_type=type(e).__name__,
                    exc_info=True)
        frontend_url = settings.CORS_ORIGINS[0] if settings.CORS_ORIGINS else "http://localhost:3000"
        error_message = "Authentication failed"
        if "exchange" in str(e).lower() or "token" in str(e).lower():
            error_message = "Failed to exchange authorization code"
        elif "user" in str(e).lower() or "create" in str(e).lower():
            error_message = "Failed to create or retrieve user account"
        return RedirectResponse(
            url=f"{frontend_url}/auth?error=oauth_failed&message={error_message}"
        )


@app.post("/api/auth/google/token")
@limiter.limit("10/minute")
async def google_oauth_token_exchange(
    request: Request,
    code: str = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Exchange Google OAuth code for tokens (alternative to callback redirect)"""
    try:
        # Authenticate with Google
        user = await GoogleOAuthService.authenticate_with_google(db, code)
        
        if not user.is_active:
            raise HTTPException(status_code=403, detail="User account is inactive")
        
        # Update last login
        await AuthService.update_last_login(db, user.id)
        
        # Create access token
        access_token = AuthService.create_access_token(
            data={"sub": str(user.id), "email": user.email, "role": user.role},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        
        # Create session
        session = await AuthService.create_session(
            db=db,
            user_id=user.id,
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request)
        )
        
        # Log activity
        await ActivityService.log_activity(
            db=db,
            user_id=user.id,
            action="LOGIN_GOOGLE",
            description=f"User {user.email} logged in with Google",
            metadata={"provider": "google"},
            ip_address=get_client_ip(request)
        )
        
        # Create user response without exposing sensitive data
        user_dict = {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
            "is_active": user.is_active,
            "last_login_at": user.last_login_at,
            "frame_analysis_prompt": user.frame_analysis_prompt,
            "openai_api_key": None,  # Never expose the actual API key
            "created_at": user.created_at,
            "updated_at": user.updated_at
        }
        
        return LoginResponse(
            access_token=access_token,
            session_token=session.session_token,
            user=UserResponse.model_validate(user_dict),
            expires_at=session.expires_at
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Google OAuth token exchange error", 
                    error=str(e), 
                    error_type=type(e).__name__,
                    exc_info=True)
        # Provide more specific error message if possible
        error_detail = "Failed to authenticate with Google"
        if "exchange" in str(e).lower() or "token" in str(e).lower():
            error_detail = "Failed to exchange authorization code with Google"
        elif "user" in str(e).lower() or "create" in str(e).lower():
            error_detail = "Failed to create or retrieve user account"
        raise HTTPException(status_code=500, detail=error_detail)


@app.post("/api/upload", response_model=VideoUploadResponse)
@limiter.limit(f"{settings.RATE_LIMIT_PER_MINUTE}/minute")
async def upload_video(
    request: Request,
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    application_name: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),  # Comma-separated string or JSON array
    language_code: Optional[str] = Form(None),
    priority: Optional[str] = Form("normal"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Upload video file"""
    # #region agent log
    import json
    import time
    log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
    try:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId":"debug-session","runId":"upload-debug","hypothesisId":"UPLOAD_ENDPOINT_ENTRY","location":"main.py:902","message":"Upload endpoint called","data":{"filename":file.filename if file else None,"name":name,"name_type":type(name).__name__,"name_is_none":name is None,"name_is_empty":name == "" if name else True,"user_id":str(current_user.id) if current_user else None},"timestamp":int(time.time()*1000)}) + "\n")
    except Exception as log_err:
        # Log to console if file logging fails
        print(f"Failed to write log: {log_err}")
    # #endregion
    try:
        # Validate file
        validate_file(file)
        await validate_file_size(file)
        
        # Use provided name or default to filename
        video_name = name or file.filename or "Untitled Video"
        # Sanitize video_name to prevent f-string formatting errors
        import re
        if video_name:
            # Replace problematic characters that could break f-strings
            video_name = re.sub(r'[{}]', '_', video_name)
        
        # Parse tags if provided (comma-separated string or JSON array)
        tags_list = None
        if tags:
            try:
                # Try parsing as JSON array first
                import json
                tags_list = json.loads(tags)
                if not isinstance(tags_list, list):
                    tags_list = [t.strip() for t in tags.split(',')]
            except (json.JSONDecodeError, ValueError):
                # If not JSON, treat as comma-separated string
                tags_list = [t.strip() for t in tags.split(',')]
        
        # Sanitize filename to prevent f-string formatting errors and filesystem issues
        import re
        safe_filename = file.filename or "video"
        # Remove or replace problematic characters
        safe_filename = re.sub(r'[<>:"/\\|?*{}]', '_', safe_filename)
        # Remove leading/trailing dots and spaces
        safe_filename = safe_filename.strip('. ')
        # Ensure filename is not empty
        if not safe_filename:
            safe_filename = "video"
        
        # Get user-entered name for duplicate check and storage
        user_entered_name = name.strip() if name and name.strip() else (file.filename or "Untitled Video")
        
        # Check for duplicate uploads (same original_input and user_id within last 30 seconds)
        from datetime import timedelta, timezone
        from sqlalchemy import select, and_
        from app.database import VideoUpload
        recent_duplicate = await db.execute(
            select(VideoUpload).where(
                and_(
                    VideoUpload.user_id == current_user.id,
                    VideoUpload.original_input == user_entered_name,
                    VideoUpload.created_at >= datetime.now(timezone.utc) - timedelta(seconds=30),
                    VideoUpload.is_deleted == False
                )
            ).order_by(VideoUpload.created_at.desc()).limit(1)
        )
        duplicate_upload = recent_duplicate.scalar_one_or_none()
        if duplicate_upload:
            logger.warning("Duplicate upload detected", 
                         user_id=str(current_user.id),
                         original_input=user_entered_name,
                         existing_video_id=str(duplicate_upload.id))
            raise HTTPException(
                status_code=400,
                detail=f"A video with the same name '{user_entered_name}' was uploaded recently. Please wait a moment or use a different name."
            )
        
        # Read file to get size (needed for metadata)
        # Reset file pointer to beginning
        await file.seek(0)
        file_size_bytes = 0
        chunk_size = 1024 * 1024  # 1MB chunks
        # Read file in chunks to calculate size
        while chunk := await file.read(chunk_size):
            file_size_bytes += len(chunk)
        
        # Reset file pointer again for S3 upload
        await file.seek(0)
        
        file_size_mb = file_size_bytes / (1024 * 1024)
        logger.info("File ready for direct S3 upload", filename=file.filename, size_mb=round(file_size_mb, 2))
        
        # Create minimal metadata (just file size for now, extract full metadata in background)
        # Get mime type from extension
        from pathlib import Path
        extension = Path(safe_filename).suffix.lower()
        mime_types = {
            '.mp4': 'video/mp4',
            '.avi': 'video/x-msvideo',
            '.mov': 'video/quicktime',
            '.mkv': 'video/x-matroska',
            '.webm': 'video/webm',
            '.flv': 'video/x-flv',
            '.wmv': 'video/x-ms-wmv',
            '.m4v': 'video/x-m4v'
        }
        mime_type = mime_types.get(extension, 'video/unknown')
        
        minimal_metadata = {
            "video_size_bytes": file_size_bytes,
            "mime_type": mime_type,
            "video_length_seconds": None,
            "resolution_width": None,
            "resolution_height": None,
            "fps": None
        }
        
        # Create video upload record first (before S3 upload to get video_id)
        # Store user-entered name in original_input, use temporary name for now
        # #region agent log
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"upload-debug","hypothesisId":"ORIGINAL_INPUT","location":"main.py:1008","message":"Setting original_input","data":{"name_parameter":name,"user_entered_name":user_entered_name,"file_filename":file.filename},"timestamp":int(time.time()*1000)}) + "\n")
        except: pass
        # #endregion
        
        # Generate formatted name: {user_id}_VID_{video_id}_DATE_{YYYYMMDDHHMMSS}
        # We need video_id first, so create with temp name, then update
        video_upload = await VideoUploadService.create_upload(
            db=db,
            user_id=current_user.id,
            name="temp",  # Temporary name, will be updated with formatted name
            source_type="upload",
            video_url="pending",  # Placeholder, will be updated to S3 URL
            original_input=user_entered_name,  # Store user-entered name
            status="uploaded",
            job_id=None,  # No job tracking needed for simple upload
            metadata=minimal_metadata,
            application_name=application_name,
            tags=tags_list,
            language_code=language_code,
            priority=priority or "normal"
        )
        
        # Generate formatted name: {user_id}_VID_{video_id}_DATE_{YYYYMMDDHHMMSS}
        # Keep UUID format with hyphens
        current_time = datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')
        sanitized_user_id = re.sub(r'[^a-zA-Z0-9_-]', '', str(current_user.id))
        sanitized_video_id = re.sub(r'[^a-zA-Z0-9_-]', '', str(video_upload.id))
        formatted_name = f"{sanitized_user_id}_VID_{sanitized_video_id}_DATE_{current_time}"
        
        # Update the name field with formatted name
        await VideoUploadService.update_upload(
            db=db,
            upload_id=video_upload.id,
            updates={"name": formatted_name},
            user_id=current_user.id
        )
        # Refresh to get updated name
        await db.refresh(video_upload)
        
        # Upload directly to S3 from file stream (no local file saving)
        from app.services.s3_service import s3_service
        # #region agent log
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"upload-debug","hypothesisId":"G","location":"main.py:1045","message":"Before calling s3_service.upload_fileobj","data":{"user_id":str(current_user.id),"video_id":str(video_upload.id),"original_filename":file.filename or safe_filename,"file_size_bytes":file_size_bytes},"timestamp":int(time.time()*1000)}) + "\n")
        except: pass
        # #endregion
        
        # Reset file pointer to beginning for S3 upload
        await file.seek(0)
        
        # Create a synchronous file buffer for boto3
        # boto3.upload_fileobj requires a synchronous file-like object
        import io
        # Read the entire file into memory as bytes
        file_content = await file.read()
        file_buffer = io.BytesIO(file_content)
        
        # Upload directly to S3 from file buffer (no local file saving)
        s3_key = s3_service.upload_fileobj(
            file_obj=file_buffer,  # Use BytesIO buffer (synchronous file-like object)
            user_id=str(current_user.id),
            video_id=str(video_upload.id),
            original_filename=file.filename or safe_filename,
            file_size_bytes=file_size_bytes
        )
        # #region agent log
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"upload-debug","hypothesisId":"G","location":"main.py:1055","message":"After calling s3_service.upload_fileobj","data":{"s3_key":s3_key,"s3_key_is_none":s3_key is None},"timestamp":int(time.time()*1000)}) + "\n")
        except: pass
        # #endregion
        
        # Update video URL to S3 if upload was successful
        if s3_key:
            s3_url = f"s3://{s3_service.bucket_name}/{s3_key}"
            # #region agent log
            try:
                with open(log_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps({"sessionId":"debug-session","runId":"upload-debug","hypothesisId":"G","location":"main.py:1062","message":"Updating video_url with S3 URL","data":{"s3_key":s3_key,"s3_url":s3_url,"video_id":str(video_upload.id)},"timestamp":int(time.time()*1000)}) + "\n")
            except: pass
            # #endregion
            await VideoUploadService.update_upload(
                db=db,
                upload_id=video_upload.id,
                updates={"video_url": s3_url},
                user_id=current_user.id
            )
            # #region agent log
            try:
                with open(log_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps({"sessionId":"debug-session","runId":"upload-debug","hypothesisId":"G","location":"main.py:1072","message":"Video URL updated to S3","data":{"s3_key":s3_key,"s3_url":s3_url,"video_id":str(video_upload.id)},"timestamp":int(time.time()*1000)}) + "\n")
            except: pass
            # #endregion
            logger.info("Video uploaded directly to S3 and URL updated", s3_key=s3_key, video_id=str(video_upload.id))
        else:
            # #region agent log
            try:
                with open(log_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps({"sessionId":"debug-session","runId":"upload-debug","hypothesisId":"G","location":"main.py:1080","message":"S3 upload returned None","data":{"video_id":str(video_upload.id),"video_url":video_upload.video_url},"timestamp":int(time.time()*1000)}) + "\n")
            except: pass
            # #endregion
            logger.warning("S3 upload failed", video_id=str(video_upload.id))
            # If S3 upload fails, we still have the record but with "pending" URL
            # This allows the user to retry or see the failed upload
        
        # Invalidate user's video panel cache since a new video was added
        CacheService.invalidate_user_cache(current_user.id)
        
        return VideoUploadResponse.model_validate(video_upload)
    except HTTPException as http_err:
        # #region agent log
        import json
        import time
        log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"upload-debug","hypothesisId":"UPLOAD_HTTP_ERROR","location":"main.py:1198","message":"HTTPException in upload endpoint","data":{"status_code":http_err.status_code,"detail":str(http_err.detail)},"timestamp":int(time.time()*1000)}) + "\n")
        except: pass
        # #endregion
        raise
    except Exception as e:
        # #region agent log
        import json
        import time
        log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"upload-debug","hypothesisId":"UPLOAD_EXCEPTION","location":"main.py:1203","message":"Exception in upload endpoint","data":{"error":str(e),"error_type":type(e).__name__},"timestamp":int(time.time()*1000)}) + "\n")
        except: pass
        # #endregion
        # #region agent log
        import json
        import traceback
        log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"upload-debug-v2","hypothesisId":"UPLOAD_ERROR","location":"main.py:1134","message":"Upload endpoint error","data":{"error":str(e),"error_type":type(e).__name__,"traceback":traceback.format_exc(),"filename":file.filename if hasattr(file, 'filename') else None},"timestamp":int(__import__("time").time()*1000)}) + "\n")
        except: pass
        # #endregion
        logger.error("Upload error", error=str(e), exc_info=True)
        error_detail = str(e) if settings.DEBUG else "Failed to upload video"
        raise HTTPException(status_code=500, detail=error_detail)


# Video Upload endpoints
@app.get("/api/uploads", response_model=VideoUploadListResponse)
async def get_user_uploads(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    include_deleted: bool = Query(False, description="Include soft-deleted uploads"),
    application_name: Optional[str] = Query(None, description="Filter by application name"),
    language_code: Optional[str] = Query(None, description="Filter by language code"),
    priority: Optional[str] = Query(None, description="Filter by priority (normal, high)"),
    tags: Optional[str] = Query(None, description="Filter by tags (comma-separated)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get paginated list of user's video uploads with filtering"""
    # Parse tags if provided
    tags_list = None
    if tags:
        tags_list = [t.strip() for t in tags.split(',')]
    
    uploads, total = await VideoUploadService.get_user_uploads(
        db=db,
        user_id=current_user.id,
        page=page,
        page_size=page_size,
        status=status,
        include_deleted=include_deleted,
        application_name=application_name,
        language_code=language_code,
        priority=priority,
        tags=tags_list
    )
    
    return VideoUploadListResponse(
        uploads=[VideoUploadResponse.model_validate(upload) for upload in uploads],
        total=total,
        page=page,
        page_size=page_size
    )


@app.get("/api/uploads/{upload_id}", response_model=VideoUploadResponse)
async def get_upload(
    upload_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get specific video upload by ID"""
    upload = await VideoUploadService.get_upload(db, upload_id, current_user.id)
    
    if not upload:
        raise HTTPException(status_code=404, detail="Video upload not found")
    
    return VideoUploadResponse.model_validate(upload)


@app.get("/api/videos/panel", response_model=VideoPanelResponse)
async def get_videos_panel(
    request: Request,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    status: Optional[str] = Query(None, description="Filter by status"),
    application_name: Optional[str] = Query(None, description="Filter by application name"),
    language_code: Optional[str] = Query(None, description="Filter by language code"),
    priority: Optional[str] = Query(None, description="Filter by priority"),
    tags: Optional[str] = Query(None, description="Filter by tags (comma-separated)"),
    sort_by: str = Query("updated_at", description="Sort field: updated_at, created_at, name"),
    sort_order: str = Query("desc", description="Sort order: asc, desc"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all videos for the panel/list view
    
    Returns videos with frame analysis statistics, suitable for displaying
    in a table/list panel similar to document management interfaces.
    """
    # Parse tags if provided (do this first to avoid duplicate parsing)
    tags_list = None
    if tags:
        tags_list = [t.strip() for t in tags.split(',')]
    
    # Generate cache key
    cache_key = CacheService._generate_cache_key(
        prefix="video_panel",
        user_id=current_user.id,
        page=page,
        page_size=page_size,
        status=status,
        application_name=application_name,
        language_code=language_code,
        priority=priority,
        tags=tags_list,
        sort_by=sort_by,
        sort_order=sort_order
    )
    
    # Try to get from cache
    cached_response = CacheService.get(cache_key, "video_panel")
    if cached_response is not None:
        return cached_response
    
    # Validate sort parameters
    if sort_by not in ["updated_at", "created_at", "name", "status"]:
        sort_by = "updated_at"
    if sort_order not in ["asc", "desc"]:
        sort_order = "desc"
    
    # Get videos with stats - add timeout protection to prevent hanging requests
    try:
        videos_data, total = await asyncio.wait_for(
            VideoUploadService.get_user_uploads_with_stats(
        db=db,
        user_id=current_user.id,
        page=page,
        page_size=page_size,
        status=status,
        include_deleted=False,  # Don't show deleted videos in panel
        application_name=application_name,
        language_code=language_code,
        priority=priority,
        tags=tags_list,
        sort_by=sort_by,
        sort_order=sort_order
            ),
            timeout=5.0  # 5 second timeout for database queries
        )
    except asyncio.TimeoutError:
        logger.error(f"Timeout getting videos panel for user {current_user.id}")
        raise HTTPException(
            status_code=504,
            detail="Request timeout - database query took too long"
        )
    except Exception as e:
        logger.error(f"Error getting videos panel: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch videos"
    )
    
    # Convert to panel items
    videos = [
        VideoPanelItem(
            id=video['id'],
            video_file_number=video.get('video_file_number') or None,
            name=video['name'],
            original_input=video.get('original_input') or None,
            status=video['status'],
            created_at=video['created_at'],
            updated_at=video['updated_at'],
            last_activity=video['last_activity'],
            video_length_seconds=video['video_length_seconds'],
            video_size_bytes=video['video_size_bytes'],
            application_name=video['application_name'],
            tags=video['tags'],
            language_code=video['language_code'],
            priority=video['priority'],
            total_frames=video['total_frames'],
            frames_with_gpt=video['frames_with_gpt']
        )
        for video in videos_data
    ]
    
    response = VideoPanelResponse(
        videos=videos,
        total=total,
        page=page,
        page_size=page_size,
        has_more=(page * page_size) < total
    )
    
    # Cache the response
    CacheService.set(cache_key, response, "video_panel")
    
    return response


@app.patch("/api/uploads/{upload_id}", response_model=VideoUploadResponse)
async def update_upload_metadata(
    request: Request,
    upload_id: UUID,
    update_data: VideoUploadUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update video upload metadata"""
    upload = await VideoUploadService.get_upload(db, upload_id, current_user.id)
    
    if not upload:
        raise HTTPException(status_code=404, detail="Video upload not found")
    
    if upload.is_deleted:
        raise HTTPException(status_code=400, detail="Cannot update deleted video upload")
    
    # Prepare updates
    updates = {}
    if update_data.name is not None:
        updates["name"] = update_data.name
    if update_data.status is not None:
        updates["status"] = update_data.status
    if update_data.application_name is not None:
        updates["application_name"] = update_data.application_name
    if update_data.tags is not None:
        updates["tags"] = update_data.tags
    if update_data.language_code is not None:
        updates["language_code"] = update_data.language_code
    if update_data.priority is not None:
        updates["priority"] = update_data.priority
    
    updated_upload = await VideoUploadService.update_upload(db, upload_id, updates, current_user.id)
    
    if not updated_upload:
        raise HTTPException(status_code=404, detail="Video upload not found")
    
    # Invalidate cache for this video and user's video panel
    CacheService.invalidate_video_cache(video_id=upload_id, video_file_number=updated_upload.video_file_number)
    CacheService.invalidate_user_cache(current_user.id)
    
    # Log activity
    await ActivityService.log_activity(
        db=db,
        user_id=current_user.id,
        action="UPDATE_VIDEO_METADATA",
        description=f"User updated video upload metadata: {upload_id}",
        metadata={"upload_id": str(upload_id), "updates": updates},
        ip_address=get_client_ip(request)
    )
    
    return VideoUploadResponse.model_validate(updated_upload)


@app.delete("/api/uploads/{upload_id}")
async def delete_upload(
    request: Request,
    upload_id: UUID,
    permanent: bool = Query(False, description="Permanently delete (hard delete)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a video upload (soft delete by default)"""
    if permanent:
        success = await VideoUploadService.hard_delete_upload(db, upload_id, current_user.id)
        action = "HARD_DELETE_VIDEO"
        message = "Video upload permanently deleted"
    else:
        success = await VideoUploadService.soft_delete_upload(db, upload_id, current_user.id)
        action = "DELETE_VIDEO"
        message = "Video upload deleted successfully"
    
    if not success:
        raise HTTPException(status_code=404, detail="Video upload not found")
    
    # Get video info before deletion for cache invalidation
    upload = await VideoUploadService.get_upload(db, upload_id, current_user.id)
    video_file_number = upload.video_file_number if upload else None
    
    # Invalidate cache for this video and user's video panel
    CacheService.invalidate_video_cache(video_id=upload_id, video_file_number=video_file_number)
    CacheService.invalidate_user_cache(current_user.id)
    
    # Log activity
    await ActivityService.log_activity(
        db=db,
        user_id=current_user.id,
        action=action,
        description=f"User deleted video upload: {upload_id}",
        metadata={"upload_id": str(upload_id), "permanent": permanent},
        ip_address=get_client_ip(request)
    )
    
    return {"message": message}


@app.post("/api/uploads/bulk-delete")
async def bulk_delete_uploads(
    request: Request,
    delete_request: BulkDeleteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Bulk delete multiple video uploads"""
    if not delete_request.upload_ids:
        raise HTTPException(status_code=400, detail="No upload IDs provided")
    
    # Convert string IDs to UUIDs
    try:
        upload_uuids = [UUID(uid) for uid in delete_request.upload_ids]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid upload ID format: {str(e)}")
    
    deleted_count, failed_count = await VideoUploadService.bulk_delete_uploads(
        db=db,
        upload_ids=upload_uuids,
        user_id=current_user.id,
        permanent=delete_request.permanent
    )
    
    # Invalidate cache for all deleted videos and user's video panel
    for upload_id in upload_uuids:
        CacheService.invalidate_video_cache(video_id=upload_id)
    CacheService.invalidate_user_cache(current_user.id)
    
    # Log activity
    action = "BULK_HARD_DELETE_VIDEO" if delete_request.permanent else "BULK_DELETE_VIDEO"
    await ActivityService.log_activity(
        db=db,
        user_id=current_user.id,
        action=action,
        description=f"User bulk deleted {deleted_count} video upload(s)",
        metadata={
            "upload_ids": delete_request.upload_ids,
            "deleted_count": deleted_count,
            "failed_count": failed_count,
            "permanent": delete_request.permanent
        },
        ip_address=get_client_ip(request)
    )
    
    message = f"Successfully deleted {deleted_count} upload(s)"
    if failed_count > 0:
        message += f", {failed_count} failed"
    
    return {
        "message": message,
        "deleted_count": deleted_count,
        "failed_count": failed_count
    }


@app.post("/api/uploads/{upload_id}/restore", response_model=VideoUploadResponse)
async def restore_upload(
    request: Request,
    upload_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Restore a soft-deleted video upload"""
    success = await VideoUploadService.restore_upload(db, upload_id, current_user.id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Video upload not found")
    
    upload = await VideoUploadService.get_upload(db, upload_id, current_user.id)
    
    # Log activity
    await ActivityService.log_activity(
        db=db,
        user_id=current_user.id,
        action="RESTORE_VIDEO",
        description=f"User restored video upload: {upload_id}",
        metadata={"upload_id": str(upload_id)},
        ip_address=get_client_ip(request)
    )
    
    return VideoUploadResponse.model_validate(upload)


@app.post("/api/uploads/{upload_id}/retry", response_model=VideoUploadResponse)
async def retry_upload(
    request: Request,
    upload_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retry upload for a failed video upload"""
    upload = await VideoUploadService.get_upload(db, upload_id, current_user.id)
    
    if not upload:
        raise HTTPException(status_code=404, detail="Video upload not found")
    
    if upload.status != "failed":
        raise HTTPException(status_code=400, detail="Can only retry failed uploads")
    
    # Verify video file exists
    video_path = Path(upload.video_url)
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Video file not found")
    
    # Update upload status to uploaded
    await VideoUploadService.update_upload_status(db, upload_id, "uploaded", None)
    
    # Log activity
    await ActivityService.log_activity(
        db=db,
        user_id=current_user.id,
        action="RETRY_VIDEO_UPLOAD",
        description=f"User retried video upload: {upload_id}",
        metadata={"upload_id": str(upload_id)},
        ip_address=get_client_ip(request)
    )
    
    # Refresh upload to get updated status
    updated_upload = await VideoUploadService.get_upload(db, upload_id, current_user.id)
    
    return VideoUploadResponse.model_validate(updated_upload)


# Activity Log endpoints
@app.get("/api/activity-logs", response_model=ActivityLogListResponse)
async def get_activity_logs(
    request: Request,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Number of items per page"),
    action: Optional[str] = Query(None, description="Filter by action type"),
    start_date: Optional[str] = Query(None, description="Start date (ISO format: YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format: YYYY-MM-DD)"),
    search: Optional[str] = Query(None, description="Search in descriptions"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get paginated activity logs for the current user with filtering
    
    Supports filtering by:
    - action: Filter by specific action type
    - start_date: Filter activities from this date onwards
    - end_date: Filter activities up to this date
    - search: Search in activity descriptions
    """
    # Parse dates if provided
    start_datetime = None
    end_datetime = None
    
    if start_date:
        try:
            # Try parsing as YYYY-MM-DD format
            if len(start_date) == 10:
                start_datetime = datetime.strptime(start_date, "%Y-%m-%d")
            else:
                # Try ISO format
                start_datetime = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD or ISO format")
    
    if end_date:
        try:
            # Try parsing as YYYY-MM-DD format
            if len(end_date) == 10:
                end_datetime = datetime.strptime(end_date, "%Y-%m-%d")
                # Add one day to include the entire end date
                end_datetime = end_datetime + timedelta(days=1)
            else:
                # Try ISO format
                end_datetime = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                end_datetime = end_datetime + timedelta(days=1)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD or ISO format")
    
    logs, total = await ActivityService.get_user_activities_with_filters(
        db=db,
        user_id=current_user.id,
        page=page,
        page_size=page_size,
        action=action,
        start_date=start_datetime,
        end_date=end_datetime,
        search=search
    )
    
    response_data = ActivityLogListResponse(
        logs=[ActivityLogResponse(
            id=log.id,
            user_id=str(log.user_id),
            action=log.action,
            description=log.description,
            metadata=log.activity_metadata,
            ip_address=str(log.ip_address) if log.ip_address else None,
            created_at=log.created_at
        ) for log in logs],
        total=total,
        page=page,
        page_size=page_size
    )
    
    # Add cache headers for better performance
    # Use mode='json' to serialize datetime objects to ISO format strings
    from fastapi.responses import JSONResponse
    return JSONResponse(
        content=response_data.model_dump(mode='json'),
        headers={
            "Cache-Control": "private, max-age=60",  # Cache for 1 minute
            "X-Total-Count": str(total),
            "X-Page": str(page),
            "X-Page-Size": str(page_size)
        }
    )


# Note: Specific routes must be defined before parameterized routes
# to avoid route conflicts (e.g., /stats and /actions before /{log_id})
@app.get("/api/activity-logs/stats", response_model=ActivityLogStatsResponse)
async def get_activity_stats(
    days: int = Query(30, ge=1, le=365, description="Number of days to include in statistics"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get activity statistics for the current user"""
    # Generate cache key
    cache_key = CacheService._generate_cache_key(
        prefix="activity_stats",
        user_id=current_user.id,
        days=days
    )
    
    # Try to get from cache
    cached_response = CacheService.get(cache_key, "activity_stats")
    if cached_response is not None:
        return cached_response
    
    stats = await ActivityService.get_activity_stats(db, current_user.id, days=days)
    
    response = ActivityLogStatsResponse(
        total_activities=stats["total_activities"],
        activities_by_action=stats["activities_by_action"],
        recent_activities=[
            ActivityLogResponse(
                id=log.id,
                user_id=str(log.user_id),
                action=log.action,
                description=log.description,
                metadata=log.activity_metadata,
                ip_address=str(log.ip_address) if log.ip_address else None,
                created_at=log.created_at
            ) for log in stats["recent_activities"]
        ]
    )
    
    # Cache the response
    CacheService.set(cache_key, response, "activity_stats")
    
    return response


@app.get("/api/activity-logs/actions", response_model=List[str])
async def get_available_actions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get list of available action types for the current user"""
    actions = await ActivityService.get_available_actions(db, current_user.id)
    return sorted(actions)


@app.get("/api/activity-logs/{log_id}", response_model=ActivityLogResponse)
async def get_activity_log(
    log_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific activity log by ID"""
    log = await ActivityService.get_activity_by_id(db, log_id, current_user.id)
    
    if not log:
        raise HTTPException(status_code=404, detail="Activity log not found")
    
    return ActivityLogResponse(
        id=log.id,
        user_id=str(log.user_id),
        action=log.action,
        description=log.description,
        metadata=log.activity_metadata,
        ip_address=str(log.ip_address) if log.ip_address else None,
        created_at=log.created_at
    )


@app.get("/api/settings/openai-key")
async def get_user_openai_key(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get the current user's OpenAI API key (masked for security)"""
    await db.refresh(current_user)
    
    # Mask the API key for security (show only last 4 characters)
    masked_key = None
    if current_user.openai_api_key:
        key = current_user.openai_api_key
        if len(key) > 4:
            masked_key = "*" * (len(key) - 4) + key[-4:]
        else:
            masked_key = "*" * len(key)
    
    return {
        "has_key": current_user.openai_api_key is not None,
        "masked_key": masked_key,
        "key_length": len(current_user.openai_api_key) if current_user.openai_api_key else 0
    }


@app.get("/api/settings/openai-key/check")
async def check_openai_key_availability(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Check if OpenAI API key is available (user's key or system default)"""
    await db.refresh(current_user)
    
    # Check if user has a custom API key (and it's valid after decryption)
    has_user_key = False
    if current_user.openai_api_key:
        try:
            from app.utils.encryption import EncryptionService
            decrypted_key = EncryptionService.decrypt(current_user.openai_api_key)
            has_user_key = decrypted_key is not None and decrypted_key.strip() != ""
        except Exception as e:
            logger.warning("Failed to decrypt user API key during check", user_id=str(current_user.id), error=str(e))
            has_user_key = False
    
    # Check if system has a default API key
    has_system_key = settings.OPENAI_API_KEY is not None and settings.OPENAI_API_KEY.strip() != ""
    
    # Check if either key is available
    has_any_key = has_user_key or has_system_key
    
    return {
        "has_key": has_any_key,
        "has_user_key": has_user_key,
        "has_system_key": has_system_key,
        "message": "OpenAI API key is available" if has_any_key else "No OpenAI API key found. Please add your API key in Settings or contact administrator."
    }


@app.put("/api/settings/openai-key")
async def update_user_openai_key(
    request: Request,
    key_data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update the current user's OpenAI API key (encrypted in database)"""
    from app.utils.encryption import EncryptionService
    
    api_key = key_data.get("api_key", "").strip()
    
    # Validate OpenAI API key format (starts with sk- and is at least 20 characters)
    if api_key:
        if not api_key.startswith("sk-"):
            raise HTTPException(
                status_code=400, 
                detail="Invalid OpenAI API key format. OpenAI API keys should start with 'sk-'"
            )
        if len(api_key) < 20:
            raise HTTPException(
                status_code=400,
                detail="Invalid OpenAI API key format. API key appears to be too short."
            )
        
        # Encrypt the API key before storing
        encrypted_key = EncryptionService.encrypt(api_key)
        if not encrypted_key:
            raise HTTPException(
                status_code=500,
                detail="Failed to encrypt API key. Please try again."
            )
        api_key = encrypted_key
    else:
        # If empty string, set to None to use system default
        api_key = None
    
    # Update user's API key (encrypted)
    current_user.openai_api_key = api_key
    await db.commit()
    await db.refresh(current_user)
    
    # Log activity
    from app.services.activity_service import ActivityService
    await ActivityService.log_activity(
        db=db,
        user_id=current_user.id,
        action="UPDATE_OPENAI_KEY",
        description="Updated OpenAI API key" if api_key else "Removed OpenAI API key",
        ip_address=get_client_ip(request)
    )
    
    # Return masked key
    masked_key = None
    if current_user.openai_api_key:
        key = current_user.openai_api_key
        if len(key) > 4:
            masked_key = "*" * (len(key) - 4) + key[-4:]
        else:
            masked_key = "*" * len(key)
    
    return {
        "message": "OpenAI API key updated successfully" if api_key else "OpenAI API key removed. System default will be used.",
        "has_key": current_user.openai_api_key is not None,
        "masked_key": masked_key
    }


@app.get("/api/videos/file-number/{video_file_number}/status", response_model=VideoUploadResponse)
async def get_video_status_by_file_number(
    video_file_number: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get video status by video file number"""
    from app.services.video_file_number_service import VideoFileNumberService
    
    upload = await VideoFileNumberService.get_upload_by_file_number(
        db, video_file_number, str(current_user.id)
    )
    
    if not upload:
        raise HTTPException(status_code=404, detail="Video not found")
    
    return VideoUploadResponse.model_validate(upload)


@app.get("/api/videos/file-number/{video_file_number}/audio")
async def get_audio_file(
    video_file_number: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get audio file for a video by file number"""
    from app.services.video_file_number_service import VideoFileNumberService
    
    upload = await VideoFileNumberService.get_upload_by_file_number(
        db, video_file_number, str(current_user.id)
    )
    
    if not upload:
        raise HTTPException(status_code=404, detail="Video not found")
    
    if not upload.audio_url:
        raise HTTPException(status_code=404, detail="Audio file not available")
    
    audio_path = Path(upload.audio_url)
    if not audio_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found on disk")
    
    return FileResponse(
        path=str(audio_path),
        filename=f"audio_{video_file_number}.mp3",
        media_type="audio/mpeg"
    )


@app.get("/api/videos/{video_id}/frames")
async def get_video_frames(
    video_id: UUID,
    limit: Optional[int] = Query(None, ge=1, le=1000, description="Maximum number of frames to return"),
    offset: int = Query(0, ge=0, description="Number of frames to skip"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get frame analyses for a video from the frame_analyses database table
    
    Returns a list of frame analyses with descriptions, OCR text, timestamps, and images.
    """
    from sqlalchemy import select, func
    
    # Verify the video belongs to the current user
    upload = await VideoUploadService.get_upload(db, video_id, current_user.id)
    if not upload:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # For MySQL/SQL Server, use raw SQL for UUID comparison
    from app.database import _is_mysql, _is_sql_server
    from sqlalchemy import text as sql_text
    
    video_id_str = str(video_id)
    frames = []
    total = 0
    
    if _is_mysql or _is_sql_server:
        # Use raw SQL for MySQL/SQL Server to handle UUID comparison correctly
        if _is_mysql:
            # MySQL query
            limit_clause = f"LIMIT {limit}" if limit else ""
            offset_clause = f"OFFSET {offset}" if offset else ""
            frames_query = sql_text(f"""
                SELECT * FROM frame_analyses 
                WHERE video_id = :video_id 
                ORDER BY timestamp ASC
                {limit_clause}
                {offset_clause}
            """)
        else:
            # SQL Server query
            if limit:
                frames_query = sql_text(f"""
                    SELECT TOP {limit} * FROM frame_analyses 
                    WHERE video_id = :video_id 
                    ORDER BY timestamp ASC
                    {f'OFFSET {offset} ROWS' if offset else ''}
                """)
            else:
                frames_query = sql_text(f"""
                    SELECT * FROM frame_analyses 
                    WHERE video_id = :video_id 
                    ORDER BY timestamp ASC
                    {f'OFFSET {offset} ROWS' if offset else ''}
                """)
        
        count_query = sql_text("""
            SELECT COUNT(*) FROM frame_analyses WHERE video_id = :video_id
        """)
        
        # Execute frames query
        frames_result = await db.execute(frames_query, {"video_id": video_id_str})
        frames_rows = frames_result.fetchall()
        
        # Convert rows to FrameAnalysis objects
        for row in frames_rows:
            frame = FrameAnalysis()
            for key, value in row._mapping.items():
                setattr(frame, key, value)
            frames.append(frame)
        
        # Execute count query
        count_result = await db.execute(count_query, {"video_id": video_id_str})
        total = count_result.scalar() or 0
        
        logger.info(f"Found {len(frames)} frames (total: {total}) for video_id {video_id} using raw SQL")
    else:
        # PostgreSQL: Use ORM query
        query = select(FrameAnalysis).where(
            FrameAnalysis.video_id == video_id
        ).order_by(FrameAnalysis.timestamp.asc())
        
        if limit:
            query = query.limit(limit)
        if offset:
            query = query.offset(offset)
        
        result = await db.execute(query)
        frames = result.scalars().all()
        
        count_query = select(func.count(FrameAnalysis.id)).where(
            FrameAnalysis.video_id == video_id
        )
        count_result = await db.execute(count_query)
        total = count_result.scalar() or 0
        
        logger.info(f"Found {len(frames)} frames (total: {total}) for video_id {video_id} using ORM query")
    
    # Format response
    frames_data = []
    for frame in frames:
        frame_dict = {
            "id": str(frame.id),
            "video_id": str(frame.video_id),
            "timestamp": frame.timestamp,
            "frame_number": frame.frame_number,
            "image_path": frame.image_path,
            "base64_image": frame.base64_image,
            "description": frame.description,
            "ocr_text": frame.ocr_text,
            "gpt_response": frame.gpt_response,
            "processing_time_ms": frame.processing_time_ms,
            "created_at": frame.created_at.isoformat() if frame.created_at else None
        }
        frames_data.append(frame_dict)
    
    return {
        "frames": frames_data,
        "total": total,
        "video_id": str(video_id),
        "limit": limit,
        "offset": offset
    }


@app.get("/api/videos/{video_id}/transcript")
async def get_video_transcript(
    video_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get transcript for a video from the job_status table
    
    Returns the most recent transcript from job_status for the given video_id.
    """
    from sqlalchemy import select, text
    from app.database import JobStatus
    
    # Verify the video belongs to the current user
    upload = await VideoUploadService.get_upload(db, video_id, current_user.id)
    if not upload:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Try to get transcript from job_status table
    # First, try direct query by video_id (as per user's SQL query)
    transcript = None
    
    try:
        # Query job_status by video_id directly (matches user's SQL query)
        is_sql_server = "mssql" in settings.DATABASE_URL.lower()
        is_mysql = "mysql" in settings.DATABASE_URL.lower()
        
        if is_mysql:
            # MySQL: Query with video_id
            query_text = text("""
                SELECT transcript 
                FROM job_status 
                WHERE video_id = :video_id 
                ORDER BY created_at DESC 
                LIMIT 1
            """)
        elif is_sql_server:
            # SQL Server: Query with video_id
            query_text = text("""
                SELECT TOP 1 transcript 
                FROM job_status 
                WHERE video_id = :video_id 
                ORDER BY created_at DESC
            """)
        else:
            # PostgreSQL
            query_text = text("""
                SELECT transcript 
                FROM job_status 
                WHERE video_id = :video_id 
                ORDER BY created_at DESC 
                LIMIT 1
            """)
        
        result = await db.execute(query_text, {"video_id": str(video_id)})
        transcript = result.scalar_one_or_none()
    except Exception as e:
        # If video_id column doesn't exist, try via job_id as fallback
        logger.debug("Could not query job_status by video_id, trying job_id fallback", error=str(e))
        
        if upload.job_id:
            # Fallback: Query job_status by job_id
            query = select(JobStatus.transcript).where(
                JobStatus.job_id == upload.job_id
            ).order_by(JobStatus.created_at.desc()).limit(1)
            
            result = await db.execute(query)
            transcript = result.scalar_one_or_none()
    
    return {
        "video_id": str(video_id),
        "transcript": transcript if transcript else None,
        "has_transcript": bool(transcript and transcript.strip())
    }


@app.get("/api/videos/{video_id}/document")
async def get_video_document_by_id(
    video_id: UUID,
    include_images: bool = Query(True, description="Include base64 images in response"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get video documentation by video ID (alternative to file-number endpoint)
    
    Returns documentation_data which is a JSON array with:
    [
      {
        "image": "base64_encoded_annotated_image_string",
        "description": "~300 words of documentation text explaining the step",
        "step_number": 1
      },
      ...
    ]
    """
    # #region agent log
    try:
        log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
        import json
        import time
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId":"debug-session","runId":"run1","hypothesisId":"B","location":"main.py:get_video_document_by_id","message":"API endpoint entry (by video_id)","data":{"video_id":str(video_id),"include_images":include_images,"user_id":str(current_user.id)},"timestamp":int(time.time()*1000)}) + "\n")
    except: pass
    # #endregion
    from sqlalchemy import select
    from uuid import UUID as UUIDType
                
    # #region agent log - Before service call
    try:
        log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
        import json
        import time
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId":"debug-session","runId":"run1","hypothesisId":"E","location":"main.py:get_video_document_by_id","message":"Before get_upload call","data":{"video_id":str(video_id),"video_id_type":type(video_id).__name__,"video_id_is_uuid":isinstance(video_id,UUIDType),"user_id":str(current_user.id),"user_id_type":type(current_user.id).__name__,"user_id_is_uuid":isinstance(current_user.id,UUIDType)},"timestamp":int(time.time()*1000)}) + "\n")
    except: pass
    # #endregion
    
    # Get the video upload by ID - try with user filter first, then without if needed
    upload = await VideoUploadService.get_upload(db, video_id, current_user.id)
    # #region agent log
    try:
        log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
        import json
        import time
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId":"debug-session","runId":"run1","hypothesisId":"E","location":"main.py:get_video_document_by_id","message":"Video lookup result (by ID with user filter)","data":{"found":upload is not None,"upload_id":str(upload.id) if upload else None,"video_file_number":upload.video_file_number if upload else None,"video_user_id":str(upload.user_id) if upload else None},"timestamp":int(time.time()*1000)}) + "\n")
    except: pass
    # #endregion
    
    # If not found with user filter, try without user filter to check if video exists
    if not upload:
        # #region agent log
        try:
            log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
            import json
            import time
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"run1","hypothesisId":"E","location":"main.py:get_video_document_by_id","message":"Video not found with user filter, trying without","data":{"video_id":str(video_id),"user_id":str(current_user.id)},"timestamp":int(time.time()*1000)}) + "\n")
        except: pass
        # #endregion
        upload_without_filter = await VideoUploadService.get_upload(db, video_id, None)
        # #region agent log
        try:
            log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
            import json
            import time
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"run1","hypothesisId":"E","location":"main.py:get_video_document_by_id","message":"Video lookup without user filter","data":{"found":upload_without_filter is not None,"upload_id":str(upload_without_filter.id) if upload_without_filter else None,"video_user_id":str(upload_without_filter.user_id) if upload_without_filter else None,"requested_user_id":str(current_user.id)},"timestamp":int(time.time()*1000)}) + "\n")
        except: pass
        # #endregion
        
        if upload_without_filter:
            # Video exists but belongs to different user - return 403 Forbidden
            logger.warning(f"Video {video_id} belongs to different user. Requested by: {current_user.id}, Owner: {upload_without_filter.user_id}")
            raise HTTPException(status_code=403, detail="Access denied: Video does not belong to you")
    
    if not upload:
        logger.warning(f"Video not found for video_id: {video_id}, user_id: {current_user.id}")
        raise HTTPException(status_code=404, detail=f"Video not found")
    
    logger.info(f"Looking for documentation for video_id: {upload.id}, video_file_number: {upload.video_file_number}")
    
    # Query the video_documentation table
    query = select(VideoDocumentation).where(
        VideoDocumentation.video_id == upload.id
    )
    result = await db.execute(query)
    documentation = result.scalar_one_or_none()
    # #region agent log
    try:
        log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
        import json
        import time
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId":"debug-session","runId":"run1","hypothesisId":"E","location":"main.py:get_video_document_by_id","message":"Documentation query result (by ID)","data":{"found":documentation is not None,"video_id":str(upload.id),"num_images":documentation.num_images if documentation else None},"timestamp":int(time.time()*1000)}) + "\n")
    except: pass
    # #endregion
    if not documentation:
        logger.warning(f"Documentation not found for video_id: {upload.id}")
        raise HTTPException(
            status_code=404, 
            detail=f"Documentation not found for this video. Video ID: {upload.id}"
        )
    
    logger.info(f"Found documentation for video_id: {upload.id}, num_images: {documentation.num_images}")
    
    # Parse documentation_data (it's stored as JSON or LONGTEXT)
    import json
    if isinstance(documentation.documentation_data, str):
        try:
            doc_data = json.loads(documentation.documentation_data)
        except json.JSONDecodeError:
            logger.error(f"Failed to parse documentation_data as JSON for video {upload.id}")
            raise HTTPException(status_code=500, detail="Invalid documentation data format")
    else:
        doc_data = documentation.documentation_data
    
    # Ensure doc_data is a list
    if not isinstance(doc_data, list):
        logger.warning(f"documentation_data is not a list for video {upload.id}, converting")
        doc_data = [doc_data] if doc_data else []
    
    # If include_images is False, remove image data from response
    if not include_images:
        doc_data = [
            {k: v for k, v in item.items() if k != "image"}
            for item in doc_data
        ]
    
    # Log activity
    try:
        await ActivityService.log_activity(
            db=db,
            user_id=current_user.id,
            action="view_document",
            description=f"Viewed documentation for video {upload.video_file_number or upload.id}",
            metadata={
                "video_id": str(upload.id),
                "video_file_number": upload.video_file_number,
                "num_steps": len(doc_data),
                "include_images": include_images
            }
        )
    except Exception as e:
        logger.warning(f"Failed to log document view activity: {e}")
    
    # Return the documentation data
    response_data = {
        "video_id": str(upload.id),
        "video_file_number": upload.video_file_number,
        "documentation_data": doc_data,
        "sprite_sheet_base64": documentation.sprite_sheet_base64 if include_images else None,
        "num_images": documentation.num_images,
        "created_at": documentation.created_at.isoformat() if documentation.created_at else None,
        "updated_at": documentation.updated_at.isoformat() if documentation.updated_at else None
    }
    # #region agent log
    try:
        log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
        import json
        import time
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId":"debug-session","runId":"run1","hypothesisId":"C","location":"main.py:get_video_document_by_id","message":"Returning response (by ID)","data":{"responseKeys":list(response_data.keys()),"docDataLength":len(doc_data),"numImages":response_data["num_images"]},"timestamp":int(time.time()*1000)}) + "\n")
    except: pass
    # #endregion
    return response_data


@app.get("/api/videos/file-number/{video_file_number}/document")
async def get_video_document(
    video_file_number: str,
    include_images: bool = Query(True, description="Include base64 images in response"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get video documentation by video file number
    
    Returns documentation_data which is a JSON array with:
    [
      {
        "image": "base64_encoded_annotated_image_string",
        "description": "~300 words of documentation text explaining the step",
        "step_number": 1
      },
      ...
    ]
    """
    # #region agent log
    try:
        log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
        import json
        import time
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId":"debug-session","runId":"run1","hypothesisId":"B","location":"main.py:get_video_document","message":"API endpoint entry","data":{"video_file_number":video_file_number,"include_images":include_images,"user_id":str(current_user.id)},"timestamp":int(time.time()*1000)}) + "\n")
    except: pass
    # #endregion
    from app.services.video_file_number_service import VideoFileNumberService
    from sqlalchemy import select
    
    # Get the video upload by file number
    upload = await VideoFileNumberService.get_upload_by_file_number(
        db, video_file_number, str(current_user.id)
    )
    # #region agent log
    try:
        log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
        import json
        import time
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId":"debug-session","runId":"run1","hypothesisId":"E","location":"main.py:get_video_document","message":"Video lookup result","data":{"found":upload is not None,"upload_id":str(upload.id) if upload else None,"video_file_number":video_file_number},"timestamp":int(time.time()*1000)}) + "\n")
    except: pass
    # #endregion
    if not upload:
        logger.warning(f"Video not found for video_file_number: {video_file_number}, user_id: {current_user.id}")
        # #region agent log
        try:
            log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
            import json
            import time
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"run1","hypothesisId":"B","location":"main.py:get_video_document","message":"Video not found - returning 404","data":{"video_file_number":video_file_number,"user_id":str(current_user.id)},"timestamp":int(time.time()*1000)}) + "\n")
        except: pass
        # #endregion
        raise HTTPException(status_code=404, detail=f"Video not found for file number: {video_file_number}")
    
    logger.info(f"Looking for documentation for video_id: {upload.id}, video_file_number: {video_file_number}")
    
    # Query the video_documentation table
    query = select(VideoDocumentation).where(
        VideoDocumentation.video_id == upload.id
    )
    result = await db.execute(query)
    documentation = result.scalar_one_or_none()
    # #region agent log
    try:
        log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
        import json
        import time
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId":"debug-session","runId":"run1","hypothesisId":"E","location":"main.py:get_video_document","message":"Documentation query result","data":{"found":documentation is not None,"video_id":str(upload.id),"num_images":documentation.num_images if documentation else None},"timestamp":int(time.time()*1000)}) + "\n")
    except: pass
    # #endregion
    if not documentation:
        logger.warning(f"Documentation not found for video_id: {upload.id}, video_file_number: {video_file_number}")
        # #region agent log
        try:
            log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
            import json
            import time
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"run1","hypothesisId":"E","location":"main.py:get_video_document","message":"Documentation not found - returning 404","data":{"video_id":str(upload.id),"video_file_number":video_file_number},"timestamp":int(time.time()*1000)}) + "\n")
        except: pass
        # #endregion
        # Return a more helpful error message
        raise HTTPException(
            status_code=404, 
            detail=f"Documentation not found for this video. Video ID: {upload.id}, File Number: {video_file_number}"
        )
    
    logger.info(f"Found documentation for video_id: {upload.id}, num_images: {documentation.num_images}")
    
    # Parse documentation_data (it's stored as JSON or LONGTEXT)
    import json
    if isinstance(documentation.documentation_data, str):
        try:
            doc_data = json.loads(documentation.documentation_data)
        except json.JSONDecodeError:
            logger.error(f"Failed to parse documentation_data as JSON for video {upload.id}")
            raise HTTPException(status_code=500, detail="Invalid documentation data format")
    else:
        doc_data = documentation.documentation_data
    
    # Ensure doc_data is a list
    if not isinstance(doc_data, list):
        logger.warning(f"documentation_data is not a list for video {upload.id}, converting")
        doc_data = [doc_data] if doc_data else []
    
    # If include_images is False, remove image data from response
    if not include_images:
        doc_data = [
            {k: v for k, v in item.items() if k != "image"}
            for item in doc_data
        ]
    
    # Log activity
    try:
        await ActivityService.log_activity(
            db=db,
            user_id=current_user.id,
            action="view_document",
            description=f"Viewed documentation for video {video_file_number}",
            metadata={
                "video_id": str(upload.id),
                "video_file_number": video_file_number,
                "num_steps": len(doc_data),
                "include_images": include_images
            }
        )
    except Exception as e:
        logger.warning(f"Failed to log document view activity: {e}")
    
    # Return the documentation data
    response_data = {
        "video_id": str(upload.id),
        "video_file_number": video_file_number,
        "documentation_data": doc_data,
        "sprite_sheet_base64": documentation.sprite_sheet_base64 if include_images else None,
        "num_images": documentation.num_images,
        "created_at": documentation.created_at.isoformat() if documentation.created_at else None,
        "updated_at": documentation.updated_at.isoformat() if documentation.updated_at else None
    }
    # #region agent log
    try:
        log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
        import json
        import time
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId":"debug-session","runId":"run1","hypothesisId":"C","location":"main.py:get_video_document","message":"Returning response","data":{"responseKeys":list(response_data.keys()),"docDataLength":len(doc_data),"numImages":response_data["num_images"]},"timestamp":int(time.time()*1000)}) + "\n")
    except: pass
    # #endregion
    return response_data








async def _cleanup_local_file(file_path: str):
    """Background task to delete local file after S3 upload"""
    try:
        from pathlib import Path
        path = Path(file_path)
        if path.exists():
            path.unlink()
            logger.info("Local file deleted after S3 upload", file_path=file_path)
    except Exception as e:
        logger.warning("Failed to delete local file", file_path=file_path, error=str(e))


async def extract_and_update_metadata(video_path: str, upload_id: UUID):
    """Background task to extract full video metadata and update the record"""
    from app.database import AsyncSessionLocal
    
    async with AsyncSessionLocal() as db:
        try:
            # Check if video_path is S3 URL - if so, download temporarily for metadata extraction
            from app.services.s3_service import s3_service
            local_path = video_path
            temp_download = False
            
            if video_path.startswith('s3://'):
                # Extract S3 key from URL
                s3_key = s3_service.get_s3_key_from_url(video_path)
                if s3_key:
                    # Download to temp location for metadata extraction
                    import tempfile
                    temp_dir = Path(tempfile.gettempdir()) / "video_metadata"
                    temp_dir.mkdir(exist_ok=True)
                    local_path = temp_dir / f"{upload_id}.{Path(video_path).suffix or 'mp4'}"
                    
                    if s3_service.download_file(s3_key, str(local_path)):
                        temp_download = True
                        logger.info("Downloaded video from S3 for metadata extraction", 
                                   upload_id=str(upload_id),
                                   s3_key=s3_key)
                    else:
                        logger.warning("Failed to download video from S3 for metadata extraction", 
                                     upload_id=str(upload_id))
                        return
            
            # Extract full metadata
            metadata = VideoMetadataService.extract_metadata(local_path)
            
            # Clean up temporary download if we downloaded from S3
            if temp_download:
                try:
                    Path(local_path).unlink()
                    logger.info("Temporary download deleted after metadata extraction", 
                               upload_id=str(upload_id))
                except Exception as e:
                    logger.warning("Failed to delete temporary download", 
                                   upload_id=str(upload_id),
                                 error=str(e))
            
            # Update video upload record with full metadata
            from sqlalchemy import update
            from app.database import VideoUpload
            
            await db.execute(
                update(VideoUpload)
                .where(VideoUpload.id == upload_id)
                .values(
                    video_length_seconds=metadata.get("video_length_seconds"),
                    video_size_bytes=metadata.get("video_size_bytes"),
                    mime_type=metadata.get("mime_type"),
                    resolution_width=metadata.get("resolution_width"),
                    resolution_height=metadata.get("resolution_height"),
                    fps=metadata.get("fps")
                )
            )
            await db.commit()
            
            logger.info("Video metadata updated", 
                       upload_id=str(upload_id),
                       metadata=metadata)
        except Exception as e:
            logger.error("Failed to extract and update metadata", 
                       upload_id=str(upload_id), 
                       error=str(e), 
                       exc_info=True)
                



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_config=None  # Use structlog
    )
