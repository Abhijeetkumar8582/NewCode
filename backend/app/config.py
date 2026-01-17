from pydantic_settings import BaseSettings
from pydantic import field_validator, ConfigDict
from typing import List, Union, Optional
from pathlib import Path
import os


class Settings(BaseSettings):
    # API Settings
    API_TITLE: str = "Video Processing API"
    API_VERSION: str = "1.0.0"
    API_DESCRIPTION: str = "Production-ready video processing API"
    
    # Server Settings
    HOST: str = "0.0.0.0"
    PORT: int = 9001
    DEBUG: bool = True  # Set to False in production
    
    # CORS Settings
    CORS_ORIGINS: Union[str, List[str]] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ]
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: Union[str, List[str]] = ["*"]
    CORS_ALLOW_HEADERS: Union[str, List[str]] = ["*"]
    
    # OpenAI Settings
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MAX_RETRIES: int = 3
    OPENAI_TIMEOUT: int = 300
    
    # GPT Settings (Druid Platform)
    GPT_BASE_URL: Optional[str] = None
    GPT_BEARER_TOKEN: Optional[str] = None
    
    # File Settings
    UPLOAD_DIR: Union[str, Path] = Path("./uploads")
    OUTPUT_DIR: Union[str, Path] = Path("./outputs")
    FRAMES_DIR: Union[str, Path] = Path("./frames")  # Directory for extracted frames
    AUDIO_DIR: Union[str, Path] = Path("./audio")  # Directory for extracted audio files
    MAX_FILE_SIZE: int = 500 * 1024 * 1024  # 500MB
    ALLOWED_EXTENSIONS: Union[str, List[str]] = [".mp4", ".avi", ".mov", ".mkv", ".webm"]
    
    # Frame Analysis Settings
    FRAMES_PER_SECOND: float = 0.5  # Extract 1 frame every 2 seconds (0.5 frames per second)
    FRAME_ANALYSIS_WORKERS: int = 4  # Number of parallel workers for frame analysis
    GPT_BATCH_SIZE: int = 10  # Number of frames to send in a single GPT API call
    
    # Database Settings
    # MySQL format: mysql+aiomysql://user:password@host:port/database
    # PostgreSQL format: postgresql+asyncpg://user:password@host:port/database
    # SQL Server format: mssql+aioodbc://user:password@host:port/database?driver=ODBC+Driver+17+for+SQL+Server
    # AWS RDS MySQL: mysql+aiomysql://admin:admin1234@database-1.cfmeekcmyemg.ap-south-1.rds.amazonaws.com:3306/master
    DATABASE_URL: str = "mysql+aiomysql://admin:admin1234@database-1.cfmeekcmyemg.ap-south-1.rds.amazonaws.com:3306/master"
    
    # Auth Settings
    SECRET_KEY: str = "your-secret-key-change-in-production"  # Should be in env
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    SESSION_TOKEN_LENGTH: int = 32
    
    # Encryption Settings (for sensitive data like API keys)
    ENCRYPTION_KEY: Optional[str] = None  # Fernet encryption key (base64-encoded, 32 bytes)
    
    # Google OAuth2 Settings
    # Note: GOOGLE_REDIRECT_URI must match EXACTLY what's configured in Google Cloud Console
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_REDIRECT_URI: str = "http://localhost:3000/auth/google/callback"
    
    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_PER_MINUTE: int = 10
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"
    
    # Background Tasks
    MAX_WORKERS: int = 4
    
    # Cache Settings
    CACHE_ENABLED: bool = True
    CACHE_DEFAULT_TTL: int = 120  # Default TTL in seconds (2 minutes)
    
    # Request Logging Settings
    REQUEST_LOGGING_ENABLED: bool = True
    REQUEST_LOGGING_SLOW_THRESHOLD_MS: int = 1000  # Log as slow if >1s
    REQUEST_LOGGING_LOG_TO_ACTIVITY: bool = True  # Log to activity log
    REQUEST_LOGGING_SKIP_PATHS: List[str] = ["/health", "/api/health", "/docs", "/redoc", "/openapi.json"]
    
    # Health Check Settings
    HEALTH_CHECK_DISK_WARNING_THRESHOLD: float = 10.0  # Warn if <10% free
    HEALTH_CHECK_DISK_CRITICAL_THRESHOLD: float = 5.0   # Critical if <5% free
    
    # Performance Monitoring Settings
    METRICS_ENABLED: bool = True
    METRICS_RETENTION_HOURS: int = 24
    SLOW_QUERY_THRESHOLD_MS: int = 500
    SYSTEM_MONITOR_INTERVAL_SECONDS: int = 30
    METRICS_PERCENTILES: List[float] = [0.5, 0.75, 0.9, 0.95, 0.99]
    
    @field_validator('CORS_ORIGINS', mode='before')
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(',') if origin.strip()]
        return v
    
    @field_validator('CORS_ALLOW_METHODS', mode='before')
    @classmethod
    def parse_cors_methods(cls, v):
        if isinstance(v, str):
            return [method.strip() for method in v.split(',') if method.strip()]
        return v
    
    @field_validator('CORS_ALLOW_HEADERS', mode='before')
    @classmethod
    def parse_cors_headers(cls, v):
        if isinstance(v, str):
            return [header.strip() for header in v.split(',') if header.strip()]
        return v
    
    @field_validator('UPLOAD_DIR', mode='before')
    @classmethod
    def parse_upload_dir(cls, v):
        if isinstance(v, str):
            return Path(v)
        return v
    
    @field_validator('OUTPUT_DIR', mode='before')
    @classmethod
    def parse_output_dir(cls, v):
        if isinstance(v, str):
            return Path(v)
        return v
    
    @field_validator('FRAMES_DIR', mode='before')
    @classmethod
    def parse_frames_dir(cls, v):
        if isinstance(v, str):
            return Path(v)
        return v
    
    @field_validator('ALLOWED_EXTENSIONS', mode='before')
    @classmethod
    def parse_allowed_extensions(cls, v):
        if isinstance(v, str):
            return [ext.strip() for ext in v.split(',') if ext.strip()]
        return v
    
    @field_validator('OPENAI_API_KEY', mode='before')
    @classmethod
    def parse_openai_api_key(cls, v):
        """Clean and validate OpenAI API key"""
        if v is None:
            return None
        if isinstance(v, str):
            # Remove whitespace, newlines, and join if split across lines
            cleaned = ''.join(v.split()).strip()
            # Remove any quotes
            cleaned = cleaned.strip('"\'')
            # Check if it's still a placeholder value
            if cleaned and cleaned.lower() in ['none', 'null', '']:
                return None
            if cleaned and 'your_openai_api_key_here' in cleaned.lower():
                return None
            return cleaned if cleaned else None
        return v
    
    @field_validator('GPT_BASE_URL', mode='before')
    @classmethod
    def parse_gpt_base_url(cls, v):
        """Clean and validate GPT base URL"""
        if v is None:
            return None
        if isinstance(v, str):
            # Remove whitespace and quotes, but preserve the URL structure
            cleaned = v.strip().strip('"\'')
            if cleaned and cleaned.lower() in ['none', 'null', '']:
                return None
            return cleaned if cleaned else None
        return v
    
    @field_validator('GPT_BEARER_TOKEN', mode='before')
    @classmethod
    def parse_gpt_bearer_token(cls, v):
        """Clean and validate GPT bearer token"""
        if v is None:
            return None
        if isinstance(v, str):
            # Remove whitespace, newlines, and join if split across lines (tokens can be long)
            cleaned = ''.join(v.split()).strip().strip('"\'')
            if cleaned and cleaned.lower() in ['none', 'null', '']:
                return None
            return cleaned if cleaned else None
        return v
    
    # Ensure .env file is loaded from the backend directory
    _backend_dir = Path(__file__).parent.parent
    _env_file = _backend_dir / ".env"
    
    model_config = ConfigDict(
        env_file=str(_env_file) if _env_file.exists() else ".env",
        case_sensitive=True,
        env_file_encoding='utf-8-sig',  # utf-8-sig handles BOM (Byte Order Mark) in .env files
        extra='allow'  # Allow extra fields from .env file
    )


# Try to load from environment variable as fallback if not in .env
_openai_key_from_env = os.getenv("OPENAI_API_KEY")
if _openai_key_from_env:
    # Clean the key from environment variable too
    _openai_key_from_env = ''.join(_openai_key_from_env.split()).strip().strip('"\'')
    if _openai_key_from_env and 'your_openai_api_key_here' not in _openai_key_from_env.lower():
        # Override with environment variable if it's valid
        os.environ["OPENAI_API_KEY"] = _openai_key_from_env

settings = Settings()

# Validate and log API key status on import
if settings.OPENAI_API_KEY:
    masked_key = f"{settings.OPENAI_API_KEY[:7]}...{settings.OPENAI_API_KEY[-4:]}" if len(settings.OPENAI_API_KEY) > 11 else "***"
    print(f"[OK] OpenAI API key loaded: {masked_key}")
    # Verify it's not a placeholder
    if 'your_openai_api_key_here' in settings.OPENAI_API_KEY.lower() or 'your_ope' in settings.OPENAI_API_KEY.lower():
        print("[WARNING] OPENAI_API_KEY appears to be a placeholder value!")
        print("   Please update your .env file with a valid API key")
        settings.OPENAI_API_KEY = None
else:
    print("[WARNING] OPENAI_API_KEY not found in .env file or environment variables")
    print("   Please set OPENAI_API_KEY in your .env file or as an environment variable")

# Validate and log GPT service configuration
if settings.GPT_BASE_URL and settings.GPT_BEARER_TOKEN:
    masked_url = settings.GPT_BASE_URL[:30] + "..." if len(settings.GPT_BASE_URL) > 30 else settings.GPT_BASE_URL
    masked_token = f"{settings.GPT_BEARER_TOKEN[:7]}...{settings.GPT_BEARER_TOKEN[-4:]}" if len(settings.GPT_BEARER_TOKEN) > 11 else "***"
    print(f"[OK] Custom GPT service configured: {masked_url}")
    print(f"[OK] GPT Bearer Token loaded: {masked_token}")
elif settings.GPT_BASE_URL or settings.GPT_BEARER_TOKEN:
    print("[WARNING] Custom GPT service partially configured:")
    if not settings.GPT_BASE_URL:
        print("   - GPT_BASE_URL is missing")
    if not settings.GPT_BEARER_TOKEN:
        print("   - GPT_BEARER_TOKEN is missing")
    print("   Both GPT_BASE_URL and GPT_BEARER_TOKEN are required for custom GPT service")
