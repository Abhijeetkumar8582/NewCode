"""S3 service for uploading files to AWS S3"""
import boto3
from botocore.exceptions import ClientError, BotoCoreError
from pathlib import Path
from typing import Optional
from datetime import datetime, timezone
import re

from app.config import settings
from app.utils.logger import logger


class S3Service:
    """Service for uploading files to AWS S3"""
    
    def __init__(self):
        """Initialize S3 client"""
        self.s3_client = None
        self.bucket_name = getattr(settings, 'S3_BUCKET_NAME', None)
        
        # Check if credentials are valid (not placeholders)
        access_key = getattr(settings, 'AWS_ACCESS_KEY_ID', None)
        secret_key = getattr(settings, 'AWS_SECRET_ACCESS_KEY', None)
        aws_region = getattr(settings, 'AWS_REGION', 'us-east-1')
        
        # #region agent log
        try:
            log_path = Path(__file__).parent.parent.parent / ".cursor" / "debug.log"
            import json
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"s3-init","hypothesisId":"A","location":"s3_service.py:16","message":"S3Service __init__","data":{"bucket_name":self.bucket_name,"has_access_key":access_key is not None,"has_secret_key":secret_key is not None,"aws_region":aws_region,"access_key_length":len(access_key) if access_key else 0,"secret_key_length":len(secret_key) if secret_key else 0},"timestamp":int(datetime.now(timezone.utc).timestamp()*1000)}) + "\n")
        except: pass
        # #endregion
        
        # Validate credentials are not placeholders
        is_placeholder = (
            not access_key or 
            access_key == 'your_aws_access_key_id' or
            not secret_key or
            secret_key == 'your_aws_secret_access_key' or
            not self.bucket_name or
            self.bucket_name == 'your_s3_bucket_name'
        )
        
        # Initialize S3 client if credentials are available and valid
        if access_key and secret_key and self.bucket_name and not is_placeholder:
            try:
                self.s3_client = boto3.client(
                    's3',
                    aws_access_key_id=access_key,
                    aws_secret_access_key=secret_key,
                    region_name=aws_region
                )
                logger.info("S3 client initialized", bucket=self.bucket_name, region=aws_region)
                # #region agent log
                try:
                    with open(log_path, "a", encoding="utf-8") as f:
                        f.write(json.dumps({"sessionId":"debug-session","runId":"s3-init","hypothesisId":"A","location":"s3_service.py:44","message":"S3 client initialized successfully","data":{"bucket_name":self.bucket_name,"region":aws_region},"timestamp":int(datetime.now(timezone.utc).timestamp()*1000)}) + "\n")
                except: pass
                # #endregion
            except Exception as e:
                logger.error("Failed to initialize S3 client", error=str(e), exc_info=True)
                # #region agent log
                try:
                    with open(log_path, "a", encoding="utf-8") as f:
                        f.write(json.dumps({"sessionId":"debug-session","runId":"s3-init","hypothesisId":"A","location":"s3_service.py:46","message":"Failed to initialize S3 client","data":{"error":str(e),"error_type":type(e).__name__},"timestamp":int(datetime.now(timezone.utc).timestamp()*1000)}) + "\n")
                except: pass
                # #endregion
        else:
            if is_placeholder:
                logger.warning("AWS S3 credentials are placeholders. S3 uploads will be disabled. Please update backend/.env with actual AWS credentials.")
                # #region agent log
                try:
                    with open(log_path, "a", encoding="utf-8") as f:
                        f.write(json.dumps({"sessionId":"debug-session","runId":"s3-init","hypothesisId":"A","location":"s3_service.py:50","message":"S3 credentials are placeholders","data":{"is_placeholder":True},"timestamp":int(datetime.now(timezone.utc).timestamp()*1000)}) + "\n")
                except: pass
                # #endregion
            else:
                logger.warning("AWS credentials not configured. S3 uploads will be disabled.")
                # #region agent log
                try:
                    with open(log_path, "a", encoding="utf-8") as f:
                        f.write(json.dumps({"sessionId":"debug-session","runId":"s3-init","hypothesisId":"A","location":"s3_service.py:52","message":"AWS credentials not configured","data":{"has_access_key":access_key is not None,"has_secret_key":secret_key is not None,"has_bucket_name":self.bucket_name is not None},"timestamp":int(datetime.now(timezone.utc).timestamp()*1000)}) + "\n")
                except: pass
                # #endregion
    
    def _generate_folder_name(self, user_id: str) -> str:
        """
        Generate folder name in format: [user_id]-[UTC date]
        Format: user_id-YYYYMMDD (e.g., 550e8400-e29b-41d4-a716-446655440000-20240111)
        
        Args:
            user_id: User's UUID as string
            
        Returns:
            Folder name string
        """
        # Remove any special characters from user_id, keep only alphanumeric and hyphens
        # UUID format is already safe, but sanitize to be sure
        sanitized_user_id = re.sub(r'[^a-zA-Z0-9-]', '', str(user_id))
        
        # Get current UTC date in YYYYMMDD format
        utc_date = datetime.now(timezone.utc).strftime('%Y%m%d')
        
        # Combine: user_id-YYYYMMDD
        folder_name = f"{sanitized_user_id}-{utc_date}"
        
        return folder_name
    
    def _sanitize_object_name(self, filename: str) -> str:
        """
        Remove spaces and sanitize object name for S3
        
        Args:
            filename: Original filename
            
        Returns:
            Sanitized filename without spaces
        """
        # Remove spaces
        sanitized = filename.replace(' ', '')
        
        # Remove any other problematic characters, keep alphanumeric, dots, hyphens, underscores
        sanitized = re.sub(r'[^a-zA-Z0-9._-]', '', sanitized)
        
        return sanitized
    
    def upload_file(
        self,
        local_file_path: str,
        user_id: str,
        video_id: str,
        original_filename: str
    ) -> Optional[str]:
        """
        Upload file to S3 with structure: [user_id]-[video_id]-[current_time]
        
        The S3 key structure follows the pattern:
        - S3 Key: user_id-video_id-current_time.{extension}
        - Example: 550e8400-e29b-41d4-a716-446655440000-550e8400-e29b-41d4-a716-446655440001-20240111233045.mp4
        
        Args:
            local_file_path: Path to local file to upload
            user_id: User's UUID as string
            video_id: Video upload ID (UUID) as string
            original_filename: Original filename (to extract extension)
            
        Returns:
            S3 object key (path) if successful, None otherwise
        """
        # #region agent log
        import json
        from pathlib import Path as PathLib
        log_path = PathLib(__file__).parent.parent.parent.parent / ".cursor" / "debug.log"
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId": "debug-session", "runId": "run1", "hypothesisId": "B,C,F", "location": "s3_service.py:117", "message": "upload_file entry", "data": {"local_file_path": local_file_path, "file_exists": PathLib(local_file_path).exists() if local_file_path else False, "has_s3_client": self.s3_client is not None, "bucket_name": self.bucket_name}, "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000)}) + "\n")
        except: pass
        # #endregion
        if not self.s3_client or not self.bucket_name:
            # #region agent log
            try:
                log_path = Path(__file__).parent.parent.parent / ".cursor" / "debug.log"
                import json
                # Get credential values for debugging (without exposing full secrets)
                access_key = getattr(settings, 'AWS_ACCESS_KEY_ID', None)
                secret_key = getattr(settings, 'AWS_SECRET_ACCESS_KEY', None)
                access_key_preview = access_key[:10] + "..." if access_key and len(access_key) > 10 else (access_key if access_key else None)
                secret_key_preview = secret_key[:10] + "..." if secret_key and len(secret_key) > 10 else (secret_key if secret_key else None)
                is_placeholder_check = (
                    not access_key or 
                    access_key == 'your_aws_access_key_id' or
                    not secret_key or
                    secret_key == 'your_aws_secret_access_key' or
                    not self.bucket_name or
                    self.bucket_name == 'your_s3_bucket_name'
                )
                with open(log_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps({"sessionId":"debug-session","runId":"s3-upload","hypothesisId":"A","location":"s3_service.py:126","message":"S3 not configured - checking why","data":{"has_s3_client":self.s3_client is not None,"bucket_name":self.bucket_name,"has_access_key":access_key is not None,"has_secret_key":secret_key is not None,"access_key_preview":access_key_preview,"secret_key_preview":secret_key_preview,"is_placeholder":is_placeholder_check,"original_filename":original_filename},"timestamp":int(datetime.now(timezone.utc).timestamp()*1000)}) + "\n")
            except Exception as e:
                # Log the exception too
                try:
                    log_path = Path(__file__).parent.parent.parent / ".cursor" / "debug.log"
                    import json
                    with open(log_path, "a", encoding="utf-8") as f:
                        f.write(json.dumps({"sessionId":"debug-session","runId":"s3-upload","hypothesisId":"A","location":"s3_service.py:126","message":"Error checking S3 config","data":{"error":str(e)},"timestamp":int(datetime.now(timezone.utc).timestamp()*1000)}) + "\n")
                except: pass
            # #endregion
            logger.warning("S3 not configured, skipping upload", 
                         file=original_filename)
            return None
        
        try:
            # Get current UTC time in format: YYYYMMDDHHMMSS
            current_time = datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')
            
            # Get file extension from original filename
            file_extension = Path(original_filename).suffix or '.mp4'
            
            # Sanitize user_id and video_id (keep UUID format with hyphens, remove only invalid chars)
            # Keep alphanumeric, hyphens, and underscores (for UUID format)
            sanitized_user_id = re.sub(r'[^a-zA-Z0-9_-]', '', str(user_id))
            sanitized_video_id = re.sub(r'[^a-zA-Z0-9_-]', '', str(video_id))
            
            # Construct S3 key: user_id_VID_video_id_DATE_YYYYMMDDHHMMSS.{extension}
            s3_key = f"{sanitized_user_id}_VID_{sanitized_video_id}_DATE_{current_time}{file_extension}"
            
            # #region agent log
            try:
                log_path = Path(__file__).parent.parent.parent / ".cursor" / "debug.log"
                import json
                with open(log_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps({"sessionId":"debug-session","runId":"s3-upload","hypothesisId":"S3_KEY_FORMAT","location":"s3_service.py:143","message":"S3 key constructed","data":{"s3_key":s3_key,"sanitized_user_id":sanitized_user_id,"sanitized_video_id":sanitized_video_id,"current_time":current_time,"file_extension":file_extension,"original_filename":original_filename},"timestamp":int(datetime.now(timezone.utc).timestamp()*1000)}) + "\n")
            except: pass
            # #endregion
            
            # Verify local file exists before uploading
            if not Path(local_file_path).exists():
                # #region agent log
                try:
                    with open(log_path, "a", encoding="utf-8") as f:
                        f.write(json.dumps({"sessionId": "debug-session", "runId": "run1", "hypothesisId": "C", "location": "s3_service.py:137", "message": "Local file not found", "data": {"local_file_path": local_file_path}, "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000)}) + "\n")
                except: pass
                # #endregion
                logger.error("Local file not found for S3 upload",
                            file_path=local_file_path)
                return None
            
            # Get file size for logging
            file_size = Path(local_file_path).stat().st_size
            file_size_mb = file_size / (1024 * 1024)
            
            # Upload file to S3
            logger.info("Uploading file to S3", 
                       bucket=self.bucket_name,
                       s3_key=s3_key,
                       local_path=local_file_path,
                       file_size_mb=round(file_size_mb, 2))
            
            # #region agent log
            try:
                with open(log_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps({"sessionId": "debug-session", "runId": "run1", "hypothesisId": "B,G", "location": "s3_service.py:154", "message": "Before boto3 upload_file", "data": {"s3_key": s3_key, "bucket": self.bucket_name, "local_path": local_file_path, "file_size_mb": round(file_size_mb, 2)}, "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000)}) + "\n")
            except: pass
            # #endregion
            # Upload with proper content type and metadata
            try:
                self.s3_client.upload_file(
                    local_file_path,
                    self.bucket_name,
                    s3_key,
                    ExtraArgs={
                        'ContentType': self._get_content_type(original_filename),
                        'Metadata': {
                            'original_filename': original_filename,
                            'user_id': str(user_id),
                            'video_id': str(video_id)
                        }
                    }
                )
                # #region agent log
                try:
                    with open(log_path, "a", encoding="utf-8") as f:
                        f.write(json.dumps({"sessionId": "debug-session", "runId": "s3-upload", "hypothesisId": "B,G", "location": "s3_service.py:246", "message": "After boto3 upload_file (no exception)", "data": {"s3_key": s3_key}, "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000)}) + "\n")
                except: pass
                # #endregion
                
                # Verify file exists in S3
                try:
                    self.s3_client.head_object(Bucket=self.bucket_name, Key=s3_key)
                    # #region agent log
                    try:
                        with open(log_path, "a", encoding="utf-8") as f:
                            f.write(json.dumps({"sessionId": "debug-session", "runId": "s3-upload", "hypothesisId": "B,G", "location": "s3_service.py:265", "message": "Verified file exists in S3", "data": {"s3_key": s3_key, "bucket": self.bucket_name}, "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000)}) + "\n")
                    except: pass
                    # #endregion
                except ClientError as verify_error:
                    # #region agent log
                    try:
                        with open(log_path, "a", encoding="utf-8") as f:
                            f.write(json.dumps({"sessionId": "debug-session", "runId": "s3-upload", "hypothesisId": "B,G", "location": "s3_service.py:270", "message": "File verification failed - file not found in S3", "data": {"s3_key": s3_key, "bucket": self.bucket_name, "error": str(verify_error)}, "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000)}) + "\n")
                    except: pass
                    # #endregion
                    logger.error("File uploaded but verification failed - file not found in S3", s3_key=s3_key, bucket=self.bucket_name, error=str(verify_error))
                    return None
            except Exception as upload_error:
                # #region agent log
                try:
                    with open(log_path, "a", encoding="utf-8") as f:
                        f.write(json.dumps({"sessionId": "debug-session", "runId": "s3-upload", "hypothesisId": "B,G", "location": "s3_service.py:275", "message": "Exception during boto3 upload_file", "data": {"s3_key": s3_key, "error": str(upload_error), "error_type": type(upload_error).__name__}, "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000)}) + "\n")
                except: pass
                # #endregion
                logger.error("Exception during S3 upload", s3_key=s3_key, error=str(upload_error), exc_info=True)
                raise
            # Generate S3 URL
            s3_url = f"s3://{self.bucket_name}/{s3_key}"
            
            logger.info("File uploaded to S3 successfully",
                       s3_key=s3_key,
                       s3_url=s3_url,
                       file_size_mb=round(file_size_mb, 2),
                       bucket=self.bucket_name)
            
            # #region agent log
            try:
                log_path = Path(__file__).parent.parent.parent / ".cursor" / "debug.log"
                import json
                with open(log_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps({"sessionId":"debug-session","runId":"s3-upload","hypothesisId":"D","location":"s3_service.py:212","message":"S3 upload successful, returning s3_key","data":{"s3_key":s3_key,"s3_url":s3_url},"timestamp":int(datetime.now(timezone.utc).timestamp()*1000)}) + "\n")
            except: pass
            # #endregion
            
            return s3_key
            
        except FileNotFoundError:
            # #region agent log
            try:
                log_path = Path(__file__).parent.parent.parent / ".cursor" / "debug.log"
                import json
                with open(log_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps({"sessionId":"debug-session","runId":"s3-upload","hypothesisId":"E","location":"s3_service.py:214","message":"FileNotFoundError - returning None","data":{"local_file_path":local_file_path},"timestamp":int(datetime.now(timezone.utc).timestamp()*1000)}) + "\n")
            except: pass
            # #endregion
            logger.error("Local file not found for S3 upload",
                        file_path=local_file_path)
            return None
        except ClientError as e:
            # #region agent log
            try:
                log_path = Path(__file__).parent.parent.parent / ".cursor" / "debug.log"
                import json
                with open(log_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps({"sessionId": "debug-session", "runId": "s3-upload", "hypothesisId": "F", "location": "s3_service.py:218", "message": "ClientError during S3 upload - returning None", "data": {"error": str(e), "error_code": e.response.get('Error', {}).get('Code', 'Unknown'), "s3_key": s3_key if 's3_key' in locals() else None}, "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000)}) + "\n")
            except: pass
            # #endregion
            logger.error("S3 upload failed (ClientError)",
                        error=str(e),
                        error_code=e.response.get('Error', {}).get('Code', 'Unknown'),
                        s3_key=s3_key if 's3_key' in locals() else None)
            return None
        except BotoCoreError as e:
            # #region agent log
            try:
                with open(log_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps({"sessionId": "debug-session", "runId": "run1", "hypothesisId": "B,E", "location": "s3_service.py:189", "message": "BotoCoreError during S3 upload", "data": {"error": str(e)}, "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000)}) + "\n")
            except: pass
            # #endregion
            logger.error("S3 upload failed (BotoCoreError)",
                        error=str(e))
            return None
        except Exception as e:
            # #region agent log
            try:
                with open(log_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps({"sessionId": "debug-session", "runId": "run1", "hypothesisId": "B,E", "location": "s3_service.py:193", "message": "Unexpected error during S3 upload", "data": {"error": str(e), "error_type": type(e).__name__}, "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000)}) + "\n")
            except: pass
            # #endregion
            logger.error("Unexpected error during S3 upload",
                        error=str(e),
                        exc_info=True)
            return None
    
    def upload_fileobj(
        self,
        file_obj,
        user_id: str,
        video_id: str,
        original_filename: str,
        file_size_bytes: int = 0
    ) -> Optional[str]:
        """
        Upload file directly to S3 from a file-like object (stream) without saving to disk
        
        Args:
            file_obj: File-like object (e.g., FastAPI UploadFile)
            user_id: User's UUID as string
            video_id: Video upload ID (UUID) as string
            original_filename: Original filename (to extract extension)
            file_size_bytes: File size in bytes (optional, for logging)
            
        Returns:
            S3 object key (path) if successful, None otherwise
        """
        if not self.s3_client or not self.bucket_name:
            logger.warning("S3 not configured, cannot upload file", file=original_filename)
            return None
        
        try:
            # Get current UTC time in format: YYYYMMDDHHMMSS
            current_time = datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')
            
            # Get file extension from original filename
            file_extension = Path(original_filename).suffix or '.mp4'
            
            # Sanitize user_id and video_id (keep UUID format with hyphens, remove only invalid chars)
            # Keep alphanumeric, hyphens, and underscores (for UUID format)
            sanitized_user_id = re.sub(r'[^a-zA-Z0-9_-]', '', str(user_id))
            sanitized_video_id = re.sub(r'[^a-zA-Z0-9_-]', '', str(video_id))
            
            # Construct S3 key: user_id_VID_video_id_DATE_YYYYMMDDHHMMSS.{extension}
            s3_key = f"{sanitized_user_id}_VID_{sanitized_video_id}_DATE_{current_time}{file_extension}"
            
            file_size_mb = file_size_bytes / (1024 * 1024) if file_size_bytes > 0 else 0
            
            # Upload file directly from stream to S3
            logger.info("Uploading file directly to S3 from stream", 
                       bucket=self.bucket_name,
                       s3_key=s3_key,
                       file_size_mb=round(file_size_mb, 2) if file_size_mb > 0 else "unknown")
            
            # Reset file pointer to beginning if it's a file-like object
            if hasattr(file_obj, 'seek'):
                file_obj.seek(0)
            
            # Upload with proper content type and metadata
            self.s3_client.upload_fileobj(
                file_obj,
                self.bucket_name,
                s3_key,
                ExtraArgs={
                    'ContentType': self._get_content_type(original_filename),
                    'Metadata': {
                        'original_filename': original_filename,
                        'user_id': str(user_id),
                        'video_id': str(video_id)
                    }
                }
            )
            
            # Verify file exists in S3
            try:
                self.s3_client.head_object(Bucket=self.bucket_name, Key=s3_key)
            except ClientError as verify_error:
                logger.error("File uploaded but verification failed - file not found in S3", 
                           s3_key=s3_key, bucket=self.bucket_name, error=str(verify_error))
                return None
            
            # Generate S3 URL
            s3_url = f"s3://{self.bucket_name}/{s3_key}"
            
            logger.info("File uploaded to S3 successfully from stream",
                       s3_key=s3_key,
                       s3_url=s3_url,
                       file_size_mb=round(file_size_mb, 2) if file_size_mb > 0 else "unknown",
                       bucket=self.bucket_name)
            
            return s3_key
            
        except ClientError as e:
            logger.error("S3 upload failed (ClientError)",
                        error=str(e),
                        error_code=e.response.get('Error', {}).get('Code', 'Unknown'),
                        s3_key=s3_key if 's3_key' in locals() else None)
            return None
        except BotoCoreError as e:
            logger.error("S3 upload failed (BotoCoreError)",
                        error=str(e))
            return None
        except Exception as e:
            logger.error("Unexpected error during S3 upload from stream",
                        error=str(e),
                        exc_info=True)
            return None
    
    def _get_content_type(self, filename: str) -> str:
        """Get content type based on file extension"""
        extension = Path(filename).suffix.lower()
        content_types = {
            '.mp4': 'video/mp4',
            '.avi': 'video/x-msvideo',
            '.mov': 'video/quicktime',
            '.mkv': 'video/x-matroska',
            '.webm': 'video/webm',
            '.flv': 'video/x-flv',
            '.wmv': 'video/x-ms-wmv',
            '.m4v': 'video/x-m4v'
        }
        return content_types.get(extension, 'application/octet-stream')
    
    def create_folder(self, user_id: str) -> Optional[str]:
        """
        Note: With the new flat structure (userid-videoid-currenttime), folders are not needed.
        This method is kept for backward compatibility but will return None.
        
        Args:
            user_id: User's UUID as string (not used in new structure)
            
        Returns:
            None (folders not used in new structure)
        """
        # New structure doesn't use folders - files are stored with flat keys
        # Format: userid-videoid-currenttime.{ext}
        return None
    
    def download_file(
        self,
        s3_key: str,
        local_file_path: str
    ) -> bool:
        """
        Download file from S3 to local filesystem
        
        Args:
            s3_key: S3 object key (path)
            local_file_path: Local path where file should be saved
            
        Returns:
            True if successful, False otherwise
        """
        if not self.s3_client or not self.bucket_name:
            logger.warning("S3 not configured, cannot download file", s3_key=s3_key)
            return False
        
        try:
            # Ensure parent directory exists
            local_path = Path(local_file_path)
            local_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Download file from S3
            self.s3_client.download_file(
                Bucket=self.bucket_name,
                Key=s3_key,
                Filename=str(local_file_path)
            )
            
            logger.info("File downloaded from S3",
                       s3_key=s3_key,
                       local_path=str(local_file_path),
                       file_exists=Path(local_file_path).exists())
            
            return True
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', 'Unknown')
            if error_code == 'NoSuchKey':
                logger.error("File not found in S3", s3_key=s3_key, bucket=self.bucket_name)
            else:
                logger.error("Failed to download file from S3",
                           s3_key=s3_key,
                           error=str(e),
                           error_code=error_code,
                           exc_info=True)
            return False
        except Exception as e:
            logger.error("Unexpected error downloading file from S3",
                       s3_key=s3_key,
                       error=str(e),
                       exc_info=True)
            return False
    
    def get_s3_key_from_url(self, s3_url: str) -> Optional[str]:
        """
        Extract S3 key from S3 URL (supports both s3:// and HTTPS formats)
        
        Args:
            s3_url: S3 URL in format:
                   - s3://bucket-name/key
                   - https://bucket-name.s3.region.amazonaws.com/key
                   - https://s3.region.amazonaws.com/bucket-name/key
        
        Returns:
            S3 key (path) or None if invalid format
        """
        if not s3_url:
            return None
        
        # Handle s3:// URLs
        if s3_url.startswith('s3://'):
            # Remove s3:// prefix
            path = s3_url[5:]  # Remove 's3://'
            
            # Split bucket and key
            parts = path.split('/', 1)
            if len(parts) != 2:
                return None
            
            bucket, key = parts
            
            # Verify bucket matches
            if bucket != self.bucket_name:
                logger.warning("S3 URL bucket mismatch",
                             url_bucket=bucket,
                             configured_bucket=self.bucket_name)
            
            return key
        
        # Handle HTTPS S3 URLs
        # Format: https://bucket-name.s3.region.amazonaws.com/key
        # Format: https://s3.region.amazonaws.com/bucket-name/key
        # May include query parameters (presigned URLs)
        if s3_url.startswith('https://'):
            try:
                from urllib.parse import urlparse
                parsed = urlparse(s3_url)
                
                # Extract key from path (ignore query parameters)
                # Path format: /key or /bucket-name/key
                path = parsed.path.lstrip('/')
                
                if not path:
                    return None
                
                # Check if path starts with bucket name
                if path.startswith(self.bucket_name + '/'):
                    # Format: bucket-name/key
                    key = path[len(self.bucket_name) + 1:]
                else:
                    # Format: key (bucket is in hostname)
                    # Hostname format: bucket-name.s3.region.amazonaws.com
                    key = path
                
                # Verify bucket from hostname if possible
                hostname = parsed.hostname or ''
                if hostname.startswith(self.bucket_name + '.s3.'):
                    # Bucket is in hostname, which matches
                    pass
                elif hostname.startswith('s3.') and hostname.endswith('.amazonaws.com'):
                    # Bucket is in path, already handled above
                    pass
                else:
                    logger.warning("Could not verify bucket from HTTPS URL",
                                 hostname=hostname,
                                 path=path,
                                 configured_bucket=self.bucket_name)
                
                logger.info("Extracted S3 key from HTTPS URL",
                           original_url=s3_url[:100] + "..." if len(s3_url) > 100 else s3_url,
                           extracted_key=key,
                           hostname=hostname)
                
                return key
            except Exception as e:
                logger.error("Failed to parse HTTPS S3 URL",
                           s3_url=s3_url,
                           error=str(e),
                           exc_info=True)
                return None
        
        # Unknown URL format
        logger.warning("Unknown S3 URL format",
                      s3_url=s3_url)
        return None


# Global S3 service instance
s3_service = S3Service()
