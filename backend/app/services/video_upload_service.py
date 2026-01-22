from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, case
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID
from datetime import datetime

from app.database import VideoUpload, FrameAnalysis
from app.utils.logger import logger
from app.services.video_file_number_service import VideoFileNumberService
from app.services.s3_service import s3_service
from app.config import settings


class VideoUploadService:
    @staticmethod
    async def create_upload(
        db: AsyncSession,
        user_id: UUID,
        name: str,
        source_type: str,
        video_url: str,
        original_input: str,
        status: str = "uploaded",
        job_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        application_name: Optional[str] = None,
        tags: Optional[List[str]] = None,
        language_code: Optional[str] = None,
        priority: Optional[str] = "normal"
    ) -> VideoUpload:
        """
        Create a new video upload record with unique video file number.
        Handles race conditions when multiple users upload simultaneously.
        """
        from sqlalchemy.exc import IntegrityError
        import asyncio
        
        max_retries = 5
        retry_count = 0
        
        while retry_count < max_retries:
            try:
                # Generate unique video file number
                video_file_number = await VideoFileNumberService.generate_video_file_number(db)
                
                upload = VideoUpload(
                    user_id=user_id,
                    name=name,
                    source_type=source_type,
                    video_url=video_url,
                    original_input=original_input,
                    status=status,
                    job_id=job_id,
                    video_file_number=video_file_number,
                    video_length_seconds=metadata.get("video_length_seconds") if metadata else None,
                    video_size_bytes=metadata.get("video_size_bytes") if metadata else None,
                    mime_type=metadata.get("mime_type") if metadata else None,
                    resolution_width=metadata.get("resolution_width") if metadata else None,
                    resolution_height=metadata.get("resolution_height") if metadata else None,
                    fps=metadata.get("fps") if metadata else None,
                    application_name=application_name,
                    tags=tags,  # JSONB will handle list conversion
                    language_code=language_code,
                    priority=priority or "normal",
                    is_deleted=False
                )
                
                db.add(upload)
                await db.commit()
                await db.refresh(upload)
                
                logger.info("Video upload created", 
                           upload_id=str(upload.id), 
                           video_file_number=video_file_number,
                           user_id=str(user_id), 
                           name=name)
                return upload
                
            except IntegrityError as e:
                # Check if it's a unique constraint violation on video_file_number
                error_str = str(e.orig) if hasattr(e, 'orig') else str(e)
                is_unique_violation = (
                    "unique constraint" in error_str.lower() or
                    "duplicate key" in error_str.lower() or
                    "UNIQUE constraint" in error_str.upper() or
                    "video_file_number" in error_str.lower()
                )
                
                if is_unique_violation and retry_count < max_retries - 1:
                    retry_count += 1
                    await db.rollback()
                    # Small random delay to reduce collision probability
                    await asyncio.sleep(0.1 * retry_count)
                    logger.warning(f"Video file number collision detected, retrying (attempt {retry_count}/{max_retries})",
                                 user_id=str(user_id),
                                 video_file_number=video_file_number,
                                 error=error_str)
                    continue
                else:
                    # Max retries reached or not a unique constraint violation
                    await db.rollback()
                    # Log to debug.log directly to avoid format string issues
                    try:
                        with open(debug_log_path, "a", encoding="utf-8") as f:
                            f.write(json.dumps({
                                "sessionId": "debug-session",
                                "runId": "video-upload-service",
                                "hypothesisId": "CREATE_UPLOAD",
                                "location": "video_upload_service.py:create_upload",
                                "message": "Failed to create video upload after retries",
                                "data": {
                                    "user_id": str(user_id),
                                    "retry_count": retry_count,
                                    "error": error_str
                                },
                                "timestamp": int(datetime.now().timestamp() * 1000)
                            }) + "\n")
                    except Exception:
                        pass
                    raise
            except Exception as e:
                await db.rollback()
                logger.error("Unexpected error creating video upload",
                           user_id=str(user_id),
                           retry_count=retry_count,
                           error=str(e),
                           exc_info=True)
                raise
        
        # Should never reach here, but just in case
        raise RuntimeError(f"Failed to create video upload after {max_retries} retries")
    
    @staticmethod
    async def get_upload(
        db: AsyncSession,
        upload_id: UUID,
        user_id: Optional[UUID] = None
    ) -> Optional[VideoUpload]:
        """Get video upload by ID, optionally filtered by user_id"""
        # #region agent log
        import json
        import time
        log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"run1","hypothesisId":"E","location":"video_upload_service.py:139","message":"get_upload entry","data":{"upload_id":str(upload_id),"user_id":str(user_id) if user_id else None,"has_user_filter":user_id is not None},"timestamp":int(time.time()*1000)}) + "\n")
        except: pass
        # #endregion
        
        # For MySQL/SQL Server, convert UUID to string for comparison if needed
        from app.database import _is_mysql, _is_sql_server
        if _is_mysql or _is_sql_server:
            # Convert UUID to string for MySQL/SQL Server comparison
            upload_id_for_query = str(upload_id)
        else:
            upload_id_for_query = upload_id
        
        query = select(VideoUpload).where(VideoUpload.id == upload_id_for_query)
        
        if user_id:
            # For MySQL/SQL Server, ensure UUID comparison works correctly
            if _is_mysql or _is_sql_server:
                user_id_for_query = str(user_id)
            else:
                user_id_for_query = user_id
            query = query.where(VideoUpload.user_id == user_id_for_query)
        
        # #region agent log
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"run1","hypothesisId":"E","location":"video_upload_service.py:161","message":"Executing query","data":{"upload_id":str(upload_id),"upload_id_for_query":str(upload_id_for_query) if isinstance(upload_id_for_query, str) else str(upload_id_for_query),"upload_id_type":type(upload_id_for_query).__name__,"user_id":str(user_id) if user_id else None,"user_id_for_query":str(user_id_for_query) if user_id else None,"query_has_user_filter":user_id is not None,"is_mysql":_is_mysql,"is_sql_server":_is_sql_server},"timestamp":int(time.time()*1000)}) + "\n")
        except: pass
        # #endregion
        
        result = await db.execute(query)
        video_upload = result.scalar_one_or_none()
        
        # #region agent log
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"run1","hypothesisId":"E","location":"video_upload_service.py:157","message":"get_upload result","data":{"upload_id":str(upload_id),"user_id":str(user_id) if user_id else None,"video_found":video_upload is not None,"video_user_id":str(video_upload.user_id) if video_upload else None,"video_status":video_upload.status if video_upload else None,"video_is_deleted":video_upload.is_deleted if video_upload else None,"matching_user_id":str(video_upload.user_id)==str(user_id) if video_upload and user_id else None},"timestamp":int(time.time()*1000)}) + "\n")
        except: pass
        # #endregion
        
        return video_upload
    
    @staticmethod
    async def get_user_uploads(
        db: AsyncSession,
        user_id: UUID,
        page: int = 1,
        page_size: int = 20,
        status: Optional[str] = None,
        include_deleted: bool = False,
        application_name: Optional[str] = None,
        language_code: Optional[str] = None,
        priority: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> Tuple[List[VideoUpload], int]:
        """Get paginated list of user's video uploads"""
        # Build query
        query = select(VideoUpload).where(VideoUpload.user_id == user_id)
        
        # Filter out deleted items by default
        if not include_deleted:
            query = query.where(VideoUpload.is_deleted == False)
        
        if status:
            query = query.where(VideoUpload.status == status)
        
        if application_name:
            query = query.where(VideoUpload.application_name == application_name)
        
        if language_code:
            query = query.where(VideoUpload.language_code == language_code)
        
        if priority:
            query = query.where(VideoUpload.priority == priority)
        
        if tags:
            # Search for videos that contain any of the specified tags
            # Using JSONB containment operator
            from sqlalchemy import text
            for tag in tags:
                query = query.where(VideoUpload.tags.contains([tag]))
        
        # Get total count
        count_query = select(func.count()).select_from(VideoUpload).where(VideoUpload.user_id == user_id)
        if not include_deleted:
            count_query = count_query.where(VideoUpload.is_deleted == False)
        if status:
            count_query = count_query.where(VideoUpload.status == status)
        if application_name:
            count_query = count_query.where(VideoUpload.application_name == application_name)
        if language_code:
            count_query = count_query.where(VideoUpload.language_code == language_code)
        if priority:
            count_query = count_query.where(VideoUpload.priority == priority)
        if tags:
            for tag in tags:
                count_query = count_query.where(VideoUpload.tags.contains([tag]))
        
        total_result = await db.execute(count_query)
        total = total_result.scalar_one()
        
        # Apply pagination and ordering
        query = query.order_by(desc(VideoUpload.created_at))
        query = query.offset((page - 1) * page_size).limit(page_size)
        
        result = await db.execute(query)
        uploads = list(result.scalars().all())
        
        return uploads, total
    
    @staticmethod
    async def get_user_uploads_with_stats(
        db: AsyncSession,
        user_id: UUID,
        page: int = 1,
        page_size: int = 20,
        status: Optional[str] = None,
        include_deleted: bool = False,
        application_name: Optional[str] = None,
        language_code: Optional[str] = None,
        priority: Optional[str] = None,
        tags: Optional[List[str]] = None,
        sort_by: str = "updated_at",
        sort_order: str = "desc"
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Get user uploads with frame analysis statistics
        
        Returns:
            Tuple of (list of video dicts with stats, total count)
        """
        # Get uploads with sorting support
        # We need to call get_user_uploads but with sorting
        # Since get_user_uploads doesn't support sort_by/sort_order yet, we'll build the query here
        query = select(VideoUpload).where(VideoUpload.user_id == user_id)
        
        # Filter out deleted items by default
        if not include_deleted:
            query = query.where(VideoUpload.is_deleted == False)
        
        if status:
            query = query.where(VideoUpload.status == status)
        
        if application_name:
            query = query.where(VideoUpload.application_name == application_name)
        
        if language_code:
            query = query.where(VideoUpload.language_code == language_code)
        
        if priority:
            query = query.where(VideoUpload.priority == priority)
        
        if tags:
            for tag in tags:
                query = query.where(VideoUpload.tags.contains([tag]))
        
        # Get total count - optimize by reusing the same query structure
        # For SQL Server, ensure we flush any pending operations before count query
        from app.database import _is_sql_server
        if _is_sql_server:
            await db.flush()
        
        # Build count query by cloning the main query structure
        count_query = select(func.count(VideoUpload.id)).where(VideoUpload.user_id == user_id)
        if not include_deleted:
            count_query = count_query.where(VideoUpload.is_deleted == False)
        if status:
            count_query = count_query.where(VideoUpload.status == status)
        if application_name:
            count_query = count_query.where(VideoUpload.application_name == application_name)
        if language_code:
            count_query = count_query.where(VideoUpload.language_code == language_code)
        if priority:
            count_query = count_query.where(VideoUpload.priority == priority)
        if tags:
            for tag in tags:
                count_query = count_query.where(VideoUpload.tags.contains([tag]))
        
        # Execute count query with timeout protection
        try:
            total_result = await db.execute(count_query)
            total = total_result.scalar_one() or 0
        except Exception as e:
            logger.error(f"Error getting video count: {e}", exc_info=True)
            total = 0
        
        # For SQL Server, ensure count result is fully consumed before next query
        if _is_sql_server:
            await db.flush()
        
        # Apply sorting
        if sort_by == "updated_at":
            order_col = VideoUpload.updated_at
        elif sort_by == "created_at":
            order_col = VideoUpload.created_at
        elif sort_by == "name":
            order_col = VideoUpload.name
        elif sort_by == "status":
            order_col = VideoUpload.status
        else:
            order_col = VideoUpload.updated_at
        
        if sort_order == "desc":
            query = query.order_by(desc(order_col))
        else:
            query = query.order_by(order_col)
        
        # Apply pagination
        query = query.offset((page - 1) * page_size).limit(page_size)
        
        result = await db.execute(query)
        uploads = list(result.scalars().all())
        
        # For SQL Server, ensure uploads query result is fully consumed before next query
        if _is_sql_server:
            await db.flush()
        
        # Get frame stats for each upload - optimize with single query
        video_ids = [upload.id for upload in uploads]
        frame_stats = {}
        
        if video_ids:
            # Query frame counts per video - use single optimized query
            # Use CASE statement for SQL Server compatibility instead of .filter()
            is_sql_server = "mssql" in settings.DATABASE_URL.lower()
            
            try:
                if is_sql_server:
                    # SQL Server compatible query using CASE
                    frame_stats_query = select(
                        FrameAnalysis.video_id,
                        func.count(FrameAnalysis.id).label('total_frames'),
                        func.sum(
                            case((FrameAnalysis.gpt_response.isnot(None), 1), else_=0)
                        ).label('frames_with_gpt')
                    ).where(
                        FrameAnalysis.video_id.in_(video_ids)
                    ).group_by(FrameAnalysis.video_id)
                else:
                    # PostgreSQL/SQLite compatible query
                    frame_stats_query = select(
                        FrameAnalysis.video_id,
                        func.count(FrameAnalysis.id).label('total_frames'),
                        func.count(FrameAnalysis.id).filter(
                            FrameAnalysis.gpt_response.isnot(None)
                        ).label('frames_with_gpt')
                    ).where(
                        FrameAnalysis.video_id.in_(video_ids)
                    ).group_by(FrameAnalysis.video_id)
                
                # Execute with timeout protection
                frame_stats_result = await db.execute(frame_stats_query)
                # For SQL Server, ensure we fully consume the result
                frame_stats_rows = frame_stats_result.all()
                frame_stats = {
                    row.video_id: {
                        'total_frames': row.total_frames or 0,
                        'frames_with_gpt': row.frames_with_gpt or 0
                    }
                    for row in frame_stats_rows
                }
                # For SQL Server, flush after consuming result
                if _is_sql_server:
                    await db.flush()
            except Exception as e:
                # If frame_analyses table doesn't exist or query fails, return empty stats
                # Don't log as error - this is expected if table doesn't exist
                if "doesn't exist" not in str(e).lower() and "table" not in str(e).lower():
                    logger.warning(f"Could not fetch frame stats: {e}")
                frame_stats = {}
        
        # Combine upload data with stats
        videos_with_stats = []
        for upload in uploads:
            stats = frame_stats.get(upload.id, {'total_frames': 0, 'frames_with_gpt': 0})
            
            video_dict = {
                'id': upload.id,
                'video_file_number': upload.video_file_number,
                'name': upload.name,
                'original_input': upload.original_input,  # User-entered name
                'status': upload.status,
                'created_at': upload.created_at,
                'updated_at': upload.updated_at,
                'last_activity': upload.updated_at,  # Use updated_at as last activity
                'video_length_seconds': upload.video_length_seconds,
                'video_size_bytes': upload.video_size_bytes,
                'application_name': upload.application_name,
                'tags': upload.tags,
                'language_code': upload.language_code,
                'priority': upload.priority,
                'total_frames': stats['total_frames'],
                'frames_with_gpt': stats['frames_with_gpt'],
                'error': upload.error if hasattr(upload, 'error') else None,  # Include error message for failed videos
                'video_url': upload.video_url  # Include video URL for processing
            }
            videos_with_stats.append(video_dict)
        
        return videos_with_stats, total
    
    @staticmethod
    async def update_upload(
        db: AsyncSession,
        upload_id: UUID,
        updates: Dict[str, Any],
        user_id: Optional[UUID] = None
    ) -> Optional[VideoUpload]:
        """Update video upload"""
        upload = await VideoUploadService.get_upload(db, upload_id, user_id)
        
        if not upload:
            return None
        
        # Update fields
        for key, value in updates.items():
            if hasattr(upload, key):
                setattr(upload, key, value)
        
        await db.commit()
        await db.refresh(upload)
        
        # Log with more detail if status is failed
        if updates.get("status") == "failed":
            logger.warning("Video upload updated to failed status", 
                          upload_id=str(upload_id), 
                          updates=updates,
                          error=updates.get("error"))
        else:
            logger.info("Video upload updated", upload_id=str(upload_id), updates=updates)
        return upload
    
    @staticmethod
    async def update_upload_status(
        db: AsyncSession,
        upload_id: UUID,
        status: str,
        job_id: Optional[str] = None,
        error: Optional[str] = None
    ) -> Optional[VideoUpload]:
        """Update upload status"""
        updates = {"status": status}
        if job_id:
            updates["job_id"] = job_id
        if error:
            updates["error"] = error
        
        return await VideoUploadService.update_upload(db, upload_id, updates)
    
    @staticmethod
    async def update_upload_audio(
        db: AsyncSession,
        upload_id: UUID,
        audio_url: str
    ) -> Optional[VideoUpload]:
        """Update audio URL for a video upload"""
        from sqlalchemy import update
        
        await db.execute(
            update(VideoUpload)
            .where(VideoUpload.id == upload_id)
            .values(audio_url=audio_url, updated_at=datetime.utcnow())
        )
        await db.commit()
        
        logger.info("Audio URL updated", upload_id=str(upload_id), audio_url=audio_url)
        return await VideoUploadService.get_upload(db, upload_id)
    
    @staticmethod
    async def soft_delete_upload(
        db: AsyncSession,
        upload_id: UUID,
        user_id: UUID
    ) -> bool:
        """Soft delete video upload (only by owner)"""
        upload = await VideoUploadService.get_upload(db, upload_id, user_id)
        
        if not upload:
            return False
        
        upload.is_deleted = True
        upload.deleted_at = datetime.utcnow()
        await db.commit()
        await db.refresh(upload)
        
        logger.info("Video upload soft deleted", upload_id=str(upload_id), user_id=str(user_id))
        return True
    
    @staticmethod
    async def restore_upload(
        db: AsyncSession,
        upload_id: UUID,
        user_id: UUID
    ) -> bool:
        """Restore soft-deleted video upload"""
        upload = await VideoUploadService.get_upload(db, upload_id, user_id)
        
        if not upload:
            return False
        
        upload.is_deleted = False
        upload.deleted_at = None
        await db.commit()
        await db.refresh(upload)
        
        logger.info("Video upload restored", upload_id=str(upload_id), user_id=str(user_id))
        return True
    
    @staticmethod
    async def hard_delete_upload(
        db: AsyncSession,
        upload_id: UUID,
        user_id: UUID
    ) -> bool:
        """Permanently delete video upload (only by owner)"""
        upload = await VideoUploadService.get_upload(db, upload_id, user_id)
        
        if not upload:
            return False
        
        await db.delete(upload)
        await db.commit()
        
        logger.info("Video upload permanently deleted", upload_id=str(upload_id), user_id=str(user_id))
        return True
    
    @staticmethod
    async def bulk_delete_uploads(
        db: AsyncSession,
        upload_ids: List[UUID],
        user_id: UUID,
        permanent: bool = False
    ) -> Tuple[int, int]:
        """
        Bulk delete multiple video uploads
        Returns: (deleted_count, failed_count)
        """
        if not upload_ids:
            return (0, 0)
        
        deleted_count = 0
        failed_count = 0
        
        for upload_id in upload_ids:
            try:
                if permanent:
                    success = await VideoUploadService.hard_delete_upload(db, upload_id, user_id)
                else:
                    success = await VideoUploadService.soft_delete_upload(db, upload_id, user_id)
                
                if success:
                    deleted_count += 1
                else:
                    failed_count += 1
            except Exception as e:
                logger.error("Failed to delete upload in bulk operation", 
                           upload_id=str(upload_id), 
                           error=str(e))
                failed_count += 1
        
        logger.info("Bulk delete completed", 
                   total_requested=len(upload_ids),
                   deleted=deleted_count,
                   failed=failed_count,
                   user_id=str(user_id))
        
        return (deleted_count, failed_count)

