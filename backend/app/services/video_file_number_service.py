"""Service for generating unique video file numbers"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from typing import Optional
from datetime import datetime

from app.database import VideoUpload
from app.utils.logger import logger
from app.config import settings


class VideoFileNumberService:
    """Service for generating and managing video file numbers"""
    
    @staticmethod
    async def generate_video_file_number(db: AsyncSession) -> str:
        """
        Generate a unique video file number in format: VF-YYYY-NNNN
        Example: VF-2024-0001, VF-2024-0002, etc.
        
        Returns:
            Unique video file number string
        """
        current_year = datetime.utcnow().year
        
        # Check database type
        db_url_lower = settings.DATABASE_URL.lower()
        is_sql_server = "mssql" in db_url_lower
        is_mysql = "mysql" in db_url_lower
        
        # Get the highest sequence number for current year
        # Using raw SQL for better performance with large datasets
        if is_sql_server:
            # SQL Server syntax: Use RIGHT to get last 4 characters (sequence number)
            # Format is VF-YYYY-NNNN, so RIGHT(video_file_number, 4) gets NNNN
            query = text("""
                SELECT COALESCE(MAX(
                    CAST(RIGHT(video_file_number, 4) AS INTEGER)
                ), 0) as max_seq
                FROM video_uploads
                WHERE video_file_number LIKE :pattern
            """)
        elif is_mysql:
            # MySQL syntax: Use RIGHT to get last 4 characters (sequence number)
            # MySQL uses RIGHT function similar to SQL Server
            query = text("""
                SELECT COALESCE(MAX(
                    CAST(RIGHT(video_file_number, 4) AS UNSIGNED)
                ), 0) as max_seq
                FROM video_uploads
                WHERE video_file_number LIKE :pattern
            """)
        else:
            # PostgreSQL syntax: Use SUBSTRING with regex
            query = text("""
                SELECT COALESCE(MAX(
                    CAST(SUBSTRING(video_file_number FROM '\\d+$') AS INTEGER)
                ), 0) as max_seq
                FROM video_uploads
                WHERE video_file_number LIKE :pattern
            """)
        
        pattern = f"VF-{current_year}-%"
        result = await db.execute(query, {"pattern": pattern})
        row = result.fetchone()
        max_seq = row[0] if row else 0
        
        # #region agent log
        import json
        log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"upload-debug-v3","hypothesisId":"VIDEO_FILE_NUMBER","location":"video_file_number_service.py:66","message":"Before conversion","data":{"max_seq":str(max_seq),"max_seq_type":type(max_seq).__name__,"row":str(row) if row else None},"timestamp":int(__import__("time").time()*1000)}) + "\n")
        except: pass
        # #endregion
        
        # Ensure max_seq is an integer (database might return Decimal or other types)
        try:
            max_seq = int(max_seq) if max_seq is not None else 0
        except (ValueError, TypeError) as e:
            # #region agent log
            try:
                with open(log_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps({"sessionId":"debug-session","runId":"upload-debug-v3","hypothesisId":"VIDEO_FILE_NUMBER","location":"video_file_number_service.py:70","message":"Conversion error","data":{"max_seq":str(max_seq),"error":str(e)},"timestamp":int(__import__("time").time()*1000)}) + "\n")
            except: pass
            # #endregion
            max_seq = 0
        
        # Increment sequence
        next_seq = max_seq + 1
        
        # Ensure next_seq is an integer before formatting
        try:
            next_seq = int(next_seq)
        except (ValueError, TypeError) as e:
            # #region agent log
            try:
                with open(log_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps({"sessionId":"debug-session","runId":"upload-debug-v3","hypothesisId":"VIDEO_FILE_NUMBER","location":"video_file_number_service.py:78","message":"next_seq conversion error","data":{"next_seq":str(next_seq),"error":str(e)},"timestamp":int(__import__("time").time()*1000)}) + "\n")
            except: pass
            # #endregion
            next_seq = 1  # Fallback to 1
        
        # #region agent log
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"upload-debug-v3","hypothesisId":"VIDEO_FILE_NUMBER","location":"video_file_number_service.py:80","message":"Before format","data":{"next_seq":next_seq,"next_seq_type":type(next_seq).__name__,"current_year":current_year},"timestamp":int(__import__("time").time()*1000)}) + "\n")
        except: pass
        # #endregion
        
        # Format: VF-YYYY-NNNN (4-digit sequence)
        # Use format() method instead of f-string format specifier to avoid issues
        video_file_number = f"VF-{current_year}-{str(next_seq).zfill(4)}"
        
        logger.info("Generated video file number", 
                   video_file_number=video_file_number,
                   year=current_year,
                   sequence=next_seq)
        
        return video_file_number
    
    @staticmethod
    async def get_upload_by_file_number(
        db: AsyncSession,
        video_file_number: str,
        user_id: Optional[str] = None
    ) -> Optional[VideoUpload]:
        """
        Get video upload by video file number
        
        Args:
            db: Database session
            video_file_number: Video file number (e.g., VF-2024-0001)
            user_id: Optional user ID to filter by user
        
        Returns:
            VideoUpload if found, None otherwise
        """
        query = select(VideoUpload).where(
            VideoUpload.video_file_number == video_file_number
        )
        
        if user_id:
            from uuid import UUID
            from app.database import _is_mysql
            user_uuid = UUID(user_id)
            # For MySQL, convert UUID to string for comparison
            user_id_for_query = str(user_uuid) if _is_mysql else user_uuid
            query = query.where(VideoUpload.user_id == user_id_for_query)
        
        result = await db.execute(query)
        return result.scalar_one_or_none()

