from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy import Column, String, Integer, JSON, DateTime, Text, Boolean, ForeignKey, BigInteger, Float, TypeDecorator, text
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID, INET as PostgresINET, TIMESTAMP as PostgresTIMESTAMP, JSONB as PostgresJSONB
from sqlalchemy.sql import func
from datetime import datetime
import uuid
from app.config import settings
from app.utils.logger import logger

# Import SQL Server types if available
try:
    from sqlalchemy.dialects.mssql import UNIQUEIDENTIFIER as MSSQL_UNIQUEIDENTIFIER
    _has_mssql_types = True
except ImportError:
    MSSQL_UNIQUEIDENTIFIER = None
    _has_mssql_types = False

Base = declarative_base()

# Database-agnostic types
# Use native types for SQLite, PostgreSQL/SQL Server/MySQL types for those databases
_use_native_types = "sqlite" in settings.DATABASE_URL.lower()
_is_sql_server = "mssql" in settings.DATABASE_URL.lower()
_is_postgresql = "postgresql" in settings.DATABASE_URL.lower()
_is_mysql = "mysql" in settings.DATABASE_URL.lower()

if _use_native_types:
    # SQLite compatible types
    UUIDType = String(36)  # Store UUIDs as strings
    INETType = String(45)  # IPv6 max length
    TimestampType = DateTime  # SQLite doesn't support timezone
    JSONBType = JSON  # SQLite uses JSON
    
    def uuid_default():
        return str(uuid.uuid4())
    
    def generate_uuid():
        """Generate UUID as string for SQLite"""
        return str(uuid.uuid4())
elif _is_sql_server:
    # SQL Server compatible types
    # Use UNIQUEIDENTIFIER type for SQL Server to match the database schema
    class GUID(TypeDecorator):
        """GUID type for SQL Server UNIQUEIDENTIFIER - stores as string in Python"""
        impl = String(36)
        cache_ok = True
        
        def load_dialect_impl(self, dialect):
            if dialect.name == 'mssql' and _has_mssql_types:
                # Use UNIQUEIDENTIFIER for SQL Server
                return dialect.type_descriptor(MSSQL_UNIQUEIDENTIFIER())
            # Fallback to String for other dialects
            return dialect.type_descriptor(String(36))
        
        def process_bind_param(self, value, dialect):
            if value is None:
                return value
            elif isinstance(value, str):
                return value
            elif isinstance(value, uuid.UUID):
                return str(value)
            else:
                return str(value)
        
        def process_result_value(self, value, dialect):
            if value is None:
                return value
            # Return as string for consistency
            return str(value) if not isinstance(value, str) else value
    
    UUIDType = GUID()
    
    INETType = String(45)  # IPv6 max length (NVARCHAR)
    TimestampType = DateTime  # SQL Server DATETIME2
    
    # JSON type for SQL Server - stored as NVARCHAR(MAX)
    class JSONType(TypeDecorator):
        """JSON type for SQL Server - stores as NVARCHAR(MAX)"""
        impl = Text
        cache_ok = True
        
        def load_dialect_impl(self, dialect):
            if dialect.name == 'mssql':
                return dialect.type_descriptor(Text)  # NVARCHAR(MAX)
            return dialect.type_descriptor(JSON)  # Native JSON for other DBs
        
        def process_bind_param(self, value, dialect):
            if value is None:
                return value
            if dialect.name == 'mssql':
                import json
                return json.dumps(value) if not isinstance(value, str) else value
            return value
        
        def process_result_value(self, value, dialect):
            if value is None:
                return value
            if dialect.name == 'mssql':
                import json
                return json.loads(value) if isinstance(value, str) else value
            return value
    
    JSONBType = JSONType()  # Use custom JSON type for SQL Server
elif _is_mysql:
    # MySQL compatible types
    # MySQL uses CHAR(36) for UUIDs
    UUIDType = String(36)  # Store UUIDs as strings in MySQL
    INETType = String(45)  # IPv6 max length
    TimestampType = DateTime  # MySQL DATETIME
    # MySQL has native JSON support (MySQL 5.7+), use standard JSON type
    JSONBType = JSON
    
    def uuid_default():
        return str(uuid.uuid4())
    
    def generate_uuid():
        """Generate UUID as string for MySQL"""
        return str(uuid.uuid4())
else:
    # PostgreSQL types
    UUIDType = PostgresUUID(as_uuid=True)
    INETType = PostgresINET
    TimestampType = PostgresTIMESTAMP(timezone=True)
    JSONBType = PostgresJSONB
    
    def uuid_default():
        return uuid.uuid4()
    
    def generate_uuid():
        """Generate UUID object for PostgreSQL"""
        return uuid.uuid4()


class User(Base):
    __tablename__ = "users"
    
    id = Column(UUIDType, primary_key=True, default=uuid_default)
    full_name = Column(String(150), nullable=False)
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=True)  # Nullable for OAuth users
    google_id = Column(String(255), nullable=True, unique=True, index=True)  # Google OAuth ID
    provider = Column(String(50), nullable=False, default='email')  # 'email' or 'google'
    role = Column(String(50), nullable=False, default='user')
    is_active = Column(Boolean, nullable=False, default=True)
    last_login_at = Column(TimestampType, nullable=True)
    frame_analysis_prompt = Column(Text, nullable=True)  # Custom GPT prompt for frame analysis
    openai_api_key = Column(String(500), nullable=True)  # User's personal OpenAI API key (encrypted in production)
    created_at = Column(TimestampType, nullable=False, server_default=func.now())
    updated_at = Column(TimestampType, nullable=False, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    activity_logs = relationship("UserActivityLog", back_populates="user", cascade="all, delete-orphan")
    video_uploads = relationship("VideoUpload", back_populates="user", cascade="all, delete-orphan")


class UserSession(Base):
    __tablename__ = "user_sessions"
    
    id = Column(UUIDType, primary_key=True, default=uuid_default)
    user_id = Column(UUIDType, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    session_token = Column(String(255), nullable=False, unique=True, index=True)
    ip_address = Column(INETType, nullable=True)
    user_agent = Column(Text, nullable=True)
    created_at = Column(TimestampType, nullable=False, server_default=func.now())
    expires_at = Column(TimestampType, nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="sessions")


class UserActivityLog(Base):
    __tablename__ = "user_activity_logs"
    
    # Use Integer for SQLite compatibility (SQLite requires INTEGER PRIMARY KEY for autoincrement)
    # Integer works for all databases, though BigInteger is preferred for PostgreSQL/SQL Server
    # For simplicity and SQLite compatibility, we use Integer for all
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(UUIDType, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    action = Column(String(100), nullable=False, index=True)
    description = Column(Text, nullable=True)
    activity_metadata = Column('metadata', JSONBType, nullable=True)  # Column name in DB is 'metadata', but attribute name is 'activity_metadata'
    ip_address = Column(INETType, nullable=True)
    created_at = Column(TimestampType, nullable=False, server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="activity_logs")


class VideoUpload(Base):
    __tablename__ = "video_uploads"
    
    id = Column(UUIDType, primary_key=True, default=uuid_default)
    user_id = Column(UUIDType, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    
    # Essential fields
    name = Column(String(255), nullable=False)  # Human-readable name
    source_type = Column(String(50), nullable=False, default='upload')  # 'upload' or 'url'
    video_url = Column(Text, nullable=False)  # Storage URL/path
    original_input = Column(Text, nullable=False)  # Original filename or URL
    status = Column(String(50), nullable=False, default='uploaded', index=True)  # uploaded, processing, completed, failed, cancelled
    
    # Video tech metadata
    video_length_seconds = Column(Float, nullable=True)
    video_size_bytes = Column(BigInteger, nullable=True)
    mime_type = Column(String(100), nullable=True)
    resolution_width = Column(Integer, nullable=True)
    resolution_height = Column(Integer, nullable=True)
    fps = Column(Float, nullable=True)
    
    # Business/Functional metadata
    # application_name: Application name (e.g., SAP, Salesforce)
    application_name = Column(String(100), nullable=True)
    # tags: Tags as JSON array (e.g., ["HR", "Payroll"])
    tags = Column(JSONBType, nullable=True)
    # language_code: Language code (e.g., en, hi)
    language_code = Column(String(10), nullable=True)
    # priority: Priority: normal, high
    priority = Column(String(20), nullable=True, default='normal')
    
    # Soft delete support
    is_deleted = Column(Boolean, nullable=False, default=False, index=True)
    deleted_at = Column(TimestampType, nullable=True)
    
    # Timestamps
    created_at = Column(TimestampType, nullable=False, server_default=func.now())
    updated_at = Column(TimestampType, nullable=False, server_default=func.now(), onupdate=func.now())
    
    # Link to job_status (optional, for processing tracking)
    job_id = Column(String, nullable=True, index=True)
    
    # Video file number - unique identifier for the video file (e.g., VF-2024-001)
    video_file_number = Column(String(50), nullable=True, unique=True, index=True)
    
    # Audio file path - extracted audio from video
    audio_url = Column(Text, nullable=True)  # Path to extracted audio file
    
    # Summary PDF path - generated PDF with summaries and images
    summary_pdf_url = Column(Text, nullable=True)  # Path to generated summary PDF
    
    # Relationships
    user = relationship("User", back_populates="video_uploads")
    frame_analyses = relationship("FrameAnalysis", back_populates="video_upload", cascade="all, delete-orphan", order_by="FrameAnalysis.timestamp")
    summaries = relationship("VideoSummary", back_populates="video_upload", cascade="all, delete-orphan", order_by="VideoSummary.batch_number")


class FrameAnalysis(Base):
    __tablename__ = "frame_analyses"
    
    id = Column(UUIDType, primary_key=True, default=uuid_default)
    video_id = Column(UUIDType, ForeignKey('video_uploads.id', ondelete='CASCADE'), nullable=False, index=True)
    
    # Frame metadata
    # timestamp: Timestamp in seconds
    timestamp = Column(Float, nullable=False)
    # frame_number: Frame number in video
    frame_number = Column(Integer, nullable=True)
    # image_path: Path to saved frame image
    image_path = Column(Text, nullable=False)
    # base64_image: Base64 encoded image for direct display
    base64_image = Column(Text, nullable=True)
    
    # Analysis results
    # description: GPT-generated description/caption
    description = Column(Text, nullable=True)
    # ocr_text: Extracted OCR text from GPT analysis
    ocr_text = Column(Text, nullable=True)
    # gpt_response: Full GPT response JSON (for future use)
    gpt_response = Column(JSONBType, nullable=True)
    
    # Processing metadata
    # processing_time_ms: Time taken to process frame in milliseconds
    processing_time_ms = Column(Integer, nullable=True)
    
    # Timestamps
    created_at = Column(TimestampType, nullable=False, server_default=func.now())
    
    # Relationships
    video_upload = relationship("VideoUpload", back_populates="frame_analyses")


class VideoSummary(Base):
    __tablename__ = "video_summaries"
    
    id = Column(UUIDType, primary_key=True, default=uuid_default)
    video_id = Column(UUIDType, ForeignKey('video_uploads.id', ondelete='CASCADE'), nullable=False, index=True)
    
    # Summary metadata
    batch_number = Column(Integer, nullable=False)
    batch_start_frame = Column(Integer, nullable=False)
    batch_end_frame = Column(Integer, nullable=False)
    total_frames_in_batch = Column(Integer, nullable=False)
    
    # Summary content
    summary_text = Column(Text, nullable=False)
    summary_metadata = Column(Text, nullable=True)  # JSON string for additional metadata
    
    # Processing metadata
    processing_time_ms = Column(Integer, nullable=True)
    model_used = Column(String(50), nullable=True, default='gpt-4o-mini')
    
    # Timestamps
    created_at = Column(TimestampType, nullable=False, server_default=func.now())
    
    # Relationships
    video_upload = relationship("VideoUpload", back_populates="summaries")


class VideoDocumentation(Base):
    __tablename__ = "video_documentation"
    
    # Based on the database structure, the table has both id (primary key) and video_id (foreign key)
    id = Column(UUIDType, primary_key=True, default=uuid_default)
    video_id = Column(UUIDType, ForeignKey('video_uploads.id', ondelete='CASCADE'), nullable=False, index=True)
    # For MySQL, documentation_data is LONGTEXT, so we use Text and parse JSON manually
    # For other DBs, we can use JSONBType
    documentation_data = Column(Text if _is_mysql else JSONBType, nullable=False)  # JSON array with image, description, step_number
    sprite_sheet_base64 = Column(Text, nullable=True)  # Base64 encoded sprite sheet
    num_images = Column(Integer, nullable=True)  # Number of images
    created_at = Column(TimestampType, nullable=False, server_default=func.now())
    updated_at = Column(TimestampType, nullable=False, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    video_upload = relationship("VideoUpload", backref="documentation")


class JobStatus(Base):
    __tablename__ = "job_status"
    
    job_id = Column(String(255), primary_key=True, index=True)
    status = Column(String(50), nullable=False, index=True)
    progress = Column(Integer, default=0)
    message = Column(Text)
    current_step = Column(String(255))
    step_progress = Column(JSONBType if _is_sql_server else JSON)  # Use JSONBType for SQL Server, JSON for MySQL/PostgreSQL
    output_files = Column(JSONBType if _is_sql_server else JSON)  # Use JSONBType for SQL Server, JSON for MySQL/PostgreSQL
    transcript = Column(Text)  # Store transcript text
    frame_analyses = Column(JSONBType if _is_sql_server else JSON)  # Use JSONBType for SQL Server, JSON for MySQL/PostgreSQL
    error = Column(Text)
    created_at = Column(TimestampType, default=datetime.utcnow, server_default=func.now())
    updated_at = Column(TimestampType, default=datetime.utcnow, onupdate=datetime.utcnow, server_default=func.now())


# Create async engine with database-specific parameters
# Configure connection pooling and encoding based on database type
connect_args = {}
if "mssql" in settings.DATABASE_URL.lower():
    # SQL Server specific: use UTF-8 encoding
    connect_args = {
        "timeout": 30,
        "autocommit": False
    }
elif "mysql" in settings.DATABASE_URL.lower():
    # MySQL specific: charset and other connection options for aiomysql
    # Note: aiomysql uses pymysql under the hood, so we pass pymysql-style args
    connect_args = {
        "charset": "utf8mb4",
        "connect_timeout": 30,
        "autocommit": False,
    }

# Log database connection info (without password)
db_url_for_logging = settings.DATABASE_URL
if "@" in db_url_for_logging:
    # Mask password in logs
    parts = db_url_for_logging.split("@")
    if len(parts) == 2:
        user_pass = parts[0].split("://")[1] if "://" in parts[0] else parts[0]
        if ":" in user_pass:
            user = user_pass.split(":")[0]
            db_url_for_logging = db_url_for_logging.replace(user_pass, f"{user}:***")
logger.info("Initializing database connection", 
           database_url=db_url_for_logging,
           is_mysql=_is_mysql,
           is_postgresql=_is_postgresql,
           is_sql_server=_is_sql_server)

try:
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,
        future=True,
        pool_pre_ping=True,  # Verify connections before using
        pool_recycle=3600,   # Recycle connections after 1 hour
        pool_size=10,        # Connection pool size
        max_overflow=20,     # Maximum overflow connections
        connect_args=connect_args
    )
    logger.info("Database engine created successfully")
except Exception as e:
    logger.error("Failed to create database engine", error=str(e), exc_info=True)
    raise

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)


async def init_db():
    """Initialize database tables and test connection"""
    try:
        # First, test the database connection
        logger.info("Testing database connection...")
        async with engine.begin() as conn:
            # Simple query to test connection (works for all database types)
            await conn.execute(text("SELECT 1"))
        logger.info("Database connection test successful")
        
        # Check if tables already exist to avoid unnecessary DESCRIBE queries
        logger.info("Checking database tables...")
        tables_exist = False
        try:
            async with engine.begin() as conn:
                if _is_mysql:
                    result = await conn.execute(text("""
                        SELECT COUNT(*) 
                        FROM information_schema.tables 
                        WHERE table_schema = DATABASE() 
                        AND table_name IN ('users', 'video_uploads')
                    """))
                    tables_exist = result.scalar() >= 2
                elif _is_postgresql:
                    result = await conn.execute(text("""
                        SELECT COUNT(*) 
                        FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name IN ('users', 'video_uploads')
                    """))
                    tables_exist = result.scalar() >= 2
                elif _is_sql_server:
                    result = await conn.execute(text("""
                        SELECT COUNT(*) 
                        FROM INFORMATION_SCHEMA.TABLES 
                        WHERE TABLE_NAME IN ('users', 'video_uploads')
                    """))
                    tables_exist = result.scalar() >= 2
        except Exception as e:
            logger.warning("Could not check table existence, will create tables", error=str(e))
            tables_exist = False
        
        # Only run create_all if tables don't exist (avoids DESCRIBE queries on every startup)
        if not tables_exist:
            logger.info("Creating database tables...")
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all, checkfirst=True)
        else:
            logger.info("Database tables already exist, skipping creation")
        
        # For MySQL, check if job_status table exists and has job_id column
        # Only check if we just created tables or if this is a first-time setup
        # Skip this check on subsequent startups to avoid unnecessary queries
        if _is_mysql and not tables_exist:
            try:
                async with engine.begin() as conn:
                    # Check if job_status table exists
                    result = await conn.execute(text("""
                        SELECT COUNT(*) 
                        FROM information_schema.tables 
                        WHERE table_schema = DATABASE() 
                        AND table_name = 'job_status'
                    """))
                    table_exists = result.scalar() > 0
                    
                    if table_exists:
                        # #region agent log
                        import json
                        log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
                        try:
                            with open(log_path, "a", encoding="utf-8") as f:
                                f.write(json.dumps({"sessionId":"debug-session","runId":"db-init","hypothesisId":"JOB_STATUS_SCHEMA","location":"database.py:407","message":"Checking job_status table","data":{"table_exists":True},"timestamp":int(__import__("time").time()*1000)}) + "\n")
                        except: pass
                        # #endregion
                        # Check if job_id column exists
                        result = await conn.execute(text("""
                            SELECT COUNT(*) 
                            FROM information_schema.columns 
                            WHERE table_schema = DATABASE() 
                            AND table_name = 'job_status' 
                            AND column_name = 'job_id'
                        """))
                        column_exists = result.scalar() > 0
                        # #region agent log
                        try:
                            with open(log_path, "a", encoding="utf-8") as f:
                                f.write(json.dumps({"sessionId":"debug-session","runId":"db-init","hypothesisId":"JOB_STATUS_SCHEMA","location":"database.py:415","message":"job_id column check","data":{"column_exists":column_exists},"timestamp":int(__import__("time").time()*1000)}) + "\n")
                        except: pass
                        # #endregion
                        
                        if not column_exists:
                            logger.info("Adding missing job_id column to job_status table...")
                            # Check if table has existing primary key
                            result = await conn.execute(text("""
                                SELECT COUNT(*) 
                                FROM information_schema.table_constraints 
                                WHERE table_schema = DATABASE() 
                                AND table_name = 'job_status' 
                                AND constraint_type = 'PRIMARY KEY'
                            """))
                            has_pk = result.scalar() > 0
                            
                            # Check if table has any rows
                            result = await conn.execute(text("SELECT COUNT(*) FROM job_status"))
                            row_count = result.scalar() or 0
                            
                            if has_pk and row_count > 0:
                                # Table has data and primary key - need to handle carefully
                                logger.warning("job_status table has existing primary key and data. Manual migration may be required.")
                                logger.warning("Please run: ALTER TABLE job_status ADD COLUMN job_id VARCHAR(255) FIRST, DROP PRIMARY KEY, ADD PRIMARY KEY (job_id)")
                            elif has_pk:
                                # Table has primary key but no data - safe to drop and recreate
                                logger.info("Dropping existing primary key to add job_id...")
                                await conn.execute(text("ALTER TABLE job_status DROP PRIMARY KEY"))
                                
                                # Add job_id column
                                await conn.execute(text("""
                                    ALTER TABLE job_status 
                                    ADD COLUMN job_id VARCHAR(255) NOT NULL FIRST
                                """))
                                
                                # Add primary key constraint
                                await conn.execute(text("""
                                    ALTER TABLE job_status 
                                    ADD PRIMARY KEY (job_id)
                                """))
                                logger.info("Successfully added job_id column as primary key")
                            else:
                                # No primary key - safe to add
                                # Add job_id column as nullable first (in case table has data)
                                await conn.execute(text("""
                                    ALTER TABLE job_status 
                                    ADD COLUMN job_id VARCHAR(255) FIRST
                                """))
                                
                                # If table is empty, make it NOT NULL and add primary key
                                if row_count == 0:
                                    await conn.execute(text("""
                                        ALTER TABLE job_status 
                                        MODIFY COLUMN job_id VARCHAR(255) NOT NULL,
                                        ADD PRIMARY KEY (job_id)
                                    """))
                                    logger.info("Successfully added job_id column as primary key")
                                else:
                                    logger.warning("job_status table has data. Please populate job_id values and then add primary key constraint manually.")
            except Exception as e:
                logger.warning(f"Could not check/alter job_status table: {str(e)}")
                # Continue - table creation might handle it
        
        logger.info("Database tables initialized successfully")
    except Exception as e:
        # Log the error for debugging
        error_msg = str(e)
        error_type = type(e).__name__
        logger.error("Database initialization error", 
                    error=error_msg, 
                    error_type=error_type,
                    exc_info=True)
        
        # Some errors are expected (like table already exists with different schema)
        if "already exists" in error_msg.lower() or "already an object" in error_msg.lower():
            logger.info("Tables may already exist with different schema - this is OK")
        elif "connection" in error_msg.lower() or "connect" in error_msg.lower():
            logger.error("Database connection failed. Please check:")
            logger.error("1. Database server is running and accessible")
            logger.error("2. DATABASE_URL in .env file is correct")
            logger.error("3. Network/firewall allows connection")
            logger.error("4. Database credentials are correct")
            # Don't raise - let the app start and show error on first request
        else:
            logger.warning(f"Database initialization warning: {error_msg}")
            logger.warning("If tables don't exist, please run: python scripts/run_migration.py")
        # Continue anyway - tables might be managed by migration scripts


async def get_db() -> AsyncSession:
    """Get database session"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
