"""Real GPT-4 Vision service for frame analysis"""
import base64
import time
import json
from typing import Dict, Optional, List, Any
import numpy as np
from pathlib import Path
import aiofiles
from openai import AsyncOpenAI
import httpx

from app.config import settings
from app.utils.logger import logger


class GPTService:
    """Real GPT-4 Vision API service for analyzing video frames"""
    
    def __init__(self):
        """Initialize GPT service with OpenAI client or custom GPT service"""
        # Initialize OpenAI client only if API key is provided
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY) if hasattr(settings, 'OPENAI_API_KEY') and settings.OPENAI_API_KEY else None
        
        # Use custom GPT service if configured
        self.gpt_base_url = settings.GPT_BASE_URL
        self.gpt_bearer_token = settings.GPT_BEARER_TOKEN
        self.use_custom_gpt = bool(self.gpt_base_url and self.gpt_bearer_token)
        
        # Load prompt from file
        self.prompt_template = self._load_prompt_template()
        
        # #region agent log
        log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"gpt-init","hypothesisId":"GPT_SERVICE_INIT","location":"gpt_service.py:32","message":"GPTService initialization","data":{"use_custom_gpt":self.use_custom_gpt,"gpt_base_url":bool(self.gpt_base_url),"gpt_bearer_token":bool(self.gpt_bearer_token),"has_client":bool(self.client),"gpt_base_url_value":self.gpt_base_url[:50] if self.gpt_base_url else None},"timestamp":int(time.time()*1000)}) + "\n")
        except: pass
        # #endregion
        
        if not self.client and not self.use_custom_gpt:
            logger.warning("Neither OpenAI API key nor custom GPT service configured. GPT service will not work.")
        elif self.use_custom_gpt:
            logger.info("Using custom GPT service", base_url=self.gpt_base_url[:50] + "..." if len(self.gpt_base_url) > 50 else self.gpt_base_url)
    
    def _load_prompt_template(self) -> str:
        """Load prompt template from prompt.txt file"""
        try:
            # Try app/prompt.txt first (new location), then fallback to backend root
            prompt_file = Path(__file__).parent.parent / "prompt.txt"
            if not prompt_file.exists():
                prompt_file = Path(__file__).parent.parent.parent / "prompt.txt"
            logger.info("Loading prompt template", prompt_file=str(prompt_file))
            if prompt_file.exists():
                with open(prompt_file, 'r', encoding='utf-8') as f:
                    prompt_content = f.read().strip()
                    logger.info("Prompt template loaded successfully", 
                              prompt_length=len(prompt_content),
                              prompt_preview=prompt_content[:200])
                    print(f"[GPT Service] Prompt loaded from: {prompt_file}")
                    print(f"[GPT Service] Prompt length: {len(prompt_content)} characters")
                    return prompt_content
            else:
                # Default prompt if file doesn't exist
                logger.warning("prompt.txt not found, using default prompt", prompt_file=str(prompt_file))
                print(f"[GPT Service] WARNING: prompt.txt not found at {prompt_file}")
                return """Analyze this video frame and provide:
1. A detailed description of what you see (UI elements, text, layout, etc.)
2. Extract any visible text (OCR) from the frame
3. Identify any important information or data displayed

Frame timestamp: {timestamp} seconds"""
        except Exception as e:
            logger.error("Failed to load prompt template", error=str(e))
            print(f"[GPT Service] ERROR loading prompt: {str(e)}")
            return """Analyze this video frame and provide:
1. A detailed description of what you see (UI elements, text, layout, etc.)
2. Extract any visible text (OCR) from the frame
3. Identify any important information or data displayed

Frame timestamp: {timestamp} seconds"""
    
    def _extract_analysis_rules(self, prompt: str) -> str:
        """Extract only the editable content within ANALYSIS RULES section (excluding header and separator)"""
        try:
            # Find the ANALYSIS RULES section
            start_marker = "### 🔍 **ANALYSIS RULES**"
            
            start_idx = prompt.find(start_marker)
            if start_idx == -1:
                return ""
            
            # Find the content after the header (skip the header line and any blank lines)
            content_start = start_idx + len(start_marker)
            remaining = prompt[content_start:]
            
            # Skip leading newlines/whitespace
            remaining = remaining.lstrip('\n\r')
            
            # Find the next "---" separator (this marks the end of ANALYSIS RULES)
            # Look for "\n---\n" pattern
            end_marker = "\n---\n"
            end_idx = remaining.find(end_marker)
            
            if end_idx == -1:
                # If no separator found, try finding next "###" section
                end_idx = remaining.find("\n### ")
                if end_idx == -1:
                    # If still not found, take until end (but strip trailing "---" if present)
                    content = remaining.rstrip()
                    if content.endswith("---"):
                        content = content[:-3].rstrip()
                    return content
            
            # Extract content between header and separator (excluding the separator)
            content = remaining[:end_idx].strip()
            return content
        except Exception as e:
            logger.error("Failed to extract analysis rules", error=str(e))
            return ""
    
    def _build_full_prompt(self, analysis_rules_content: str) -> str:
        """Build full prompt by combining fixed parts with custom ANALYSIS RULES content"""
        full_template = self.prompt_template
        
        # Find the ANALYSIS RULES section in the template
        start_marker = "### 🔍 **ANALYSIS RULES**"
        
        start_idx = full_template.find(start_marker)
        if start_idx == -1:
            # If marker not found, return template as-is
            logger.warning("ANALYSIS RULES marker not found in template")
            return full_template
        
        # Find the content after the header
        content_start = start_idx + len(start_marker)
        remaining = full_template[content_start:].lstrip('\n\r')
        
        # Find the "---" separator that marks the end of ANALYSIS RULES
        end_marker = "\n---\n"
        end_idx = remaining.find(end_marker)
        
        if end_idx == -1:
            # Try finding next "###" section
            end_idx = remaining.find("\n### ")
            if end_idx == -1:
                # If no end marker found, replace content from start to end
                before = full_template[:content_start]
                return before + "\n\n" + analysis_rules_content + "\n" + remaining
        
        # Replace only the content between header and separator
        before = full_template[:content_start]
        after = remaining[end_idx:]  # Includes the "---\n" separator
        
        # Build the full section: header + custom content + separator
        return before + "\n\n" + analysis_rules_content + after
    
    def _encode_image(self, image_path: str) -> str:
        """Encode image to base64"""
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')
    
    def _strip_markdown_code_blocks(self, text: str) -> str:
        """Strip markdown code blocks (```json ... ```) from text"""
        import re
        # Remove markdown code blocks
        text = re.sub(r'```json\s*\n?', '', text)
        text = re.sub(r'```\s*\n?', '', text)
        # Also handle cases where there might be ``` at the start/end
        text = text.strip()
        if text.startswith('```'):
            text = text[3:].strip()
        if text.endswith('```'):
            text = text[:-3].strip()
        return text.strip()
    
    def _repair_json(self, json_str: str) -> str:
        """Attempt to repair common JSON issues"""
        import re
        # Remove leading/trailing whitespace and newlines
        json_str = json_str.strip()
        
        # If empty, return empty
        if not json_str:
            return "{}"
        
        # Remove any leading newlines, spaces, or other whitespace
        json_str = json_str.lstrip('\n\r\t ')
        
        # If it doesn't start with {, try to find the JSON object
        if not json_str.startswith('{'):
            # Find first {
            start = json_str.find('{')
            if start != -1:
                json_str = json_str[start:]
            else:
                # No { found - might be just JSON content without braces
                # Check if it looks like JSON key-value pairs
                if '"' in json_str or 'timestamp' in json_str.lower() or 'description' in json_str.lower():
                    # Wrap in braces
                    json_str = '{' + json_str
                    # Try to add closing brace if missing
                    if json_str.count('{') > json_str.count('}'):
                        json_str = json_str + '}'
        
        # If it doesn't end with }, try to find the end
        if not json_str.endswith('}'):
            # Find last }
            end = json_str.rfind('}')
            if end != -1:
                json_str = json_str[:end + 1]
            else:
                # No } found - try to add it if we have an opening brace
                if json_str.startswith('{') and json_str.count('{') > json_str.count('}'):
                    json_str = json_str + '}'
        
        # Remove any trailing newlines or whitespace
        json_str = json_str.rstrip('\n\r\t ')
        
        # Final check - ensure it starts with { and ends with }
        if not json_str.startswith('{'):
            json_str = '{' + json_str
        if not json_str.endswith('}'):
            json_str = json_str + '}'
        
        return json_str.strip()
    
    async def get_prompt_template(self, user_id: Optional[str] = None, db: Optional[Any] = None) -> str:
        """
        Get prompt template - use user's custom ANALYSIS RULES if available, otherwise use default
        
        Args:
            user_id: Optional user ID to fetch custom ANALYSIS RULES
            db: Optional database session to fetch user prompt
        
        Returns:
            Full prompt template string with custom ANALYSIS RULES if available
        """
        # If user_id and db are provided, try to get user's custom ANALYSIS RULES
        if user_id and db:
            try:
                from app.database import User
                from sqlalchemy import select
                from uuid import UUID
                
                # Convert user_id to UUID if it's a string
                if isinstance(user_id, str):
                    user_uuid = UUID(user_id)
                else:
                    user_uuid = user_id
                
                # Query user's custom ANALYSIS RULES
                # For MySQL, convert UUID to string for comparison
                from app.database import _is_mysql
                user_id_for_query = str(user_uuid) if _is_mysql and isinstance(user_uuid, UUID) else user_uuid
                result = await db.execute(
                    select(User.frame_analysis_prompt).where(User.id == user_id_for_query)
                )
                custom_analysis_rules = result.scalar_one_or_none()
                
                if custom_analysis_rules:
                    logger.info("Using custom user ANALYSIS RULES", user_id=str(user_id))
                    # Build full prompt with custom ANALYSIS RULES
                    return self._build_full_prompt(custom_analysis_rules)
            except Exception as e:
                logger.warning("Failed to fetch user custom ANALYSIS RULES, using default", 
                             user_id=str(user_id), error=str(e))
        
        # Fall back to default prompt
        return self.prompt_template
    
    def get_default_analysis_rules(self) -> str:
        """Get the default ANALYSIS RULES section from the template"""
        return self._extract_analysis_rules(self.prompt_template)

    async def _get_openai_client(self, user_id: Optional[str] = None, db: Optional[Any] = None) -> Optional[AsyncOpenAI]:
        """
        Get OpenAI client - use user's API key if available, otherwise use system default
        Note: If custom GPT service is configured, this returns None and custom service is used instead
        
        Args:
            user_id: Optional user ID to fetch custom API key
            db: Optional database session to fetch user API key
        
        Returns:
            AsyncOpenAI client instance or None
        """
        # If custom GPT service is configured, don't use OpenAI client
        if self.use_custom_gpt:
            return None
        
        # If user_id and db are provided, try to get user's custom API key
        if user_id and db:
            try:
                from app.database import User
                from sqlalchemy import select
                from uuid import UUID
                from app.utils.encryption import EncryptionService
                
                # Convert user_id to UUID if it's a string
                if isinstance(user_id, str):
                    user_uuid = UUID(user_id)
                else:
                    user_uuid = user_id
                
                # Query user's custom API key (encrypted)
                # For MySQL, convert UUID to string for comparison
                from app.database import _is_mysql
                user_id_for_query = str(user_uuid) if _is_mysql and isinstance(user_uuid, UUID) else user_uuid
                result = await db.execute(
                    select(User.openai_api_key).where(User.id == user_id_for_query)
                )
                encrypted_api_key = result.scalar_one_or_none()
                
                if encrypted_api_key:
                    # Decrypt the API key
                    decrypted_key = EncryptionService.decrypt(encrypted_api_key)
                    if decrypted_key:
                        logger.info("Using custom user OpenAI API key", user_id=str(user_id))
                        return AsyncOpenAI(api_key=decrypted_key)
                    else:
                        logger.warning("Failed to decrypt user API key, using system default", 
                                     user_id=str(user_id))
            except Exception as e:
                logger.warning("Failed to fetch user custom API key, using system default", 
                             user_id=str(user_id), error=str(e))
        
        # Fall back to system default client
        return self.client
    
    async def _call_custom_gpt(self, payload: Dict) -> Dict:
        """Call custom GPT service using httpx"""
        # #region agent log
        log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"gpt-custom-call","hypothesisId":"CUSTOM_GPT_CALL","location":"gpt_service.py:329","message":"Calling custom GPT service","data":{"base_url":self.gpt_base_url[:50] if self.gpt_base_url else None,"model":payload.get("model"),"messages_count":len(payload.get("messages",[]))},"timestamp":int(time.time()*1000)}) + "\n")
        except: pass
        # #endregion
        
        headers = {
            "Authorization": f"Bearer {self.gpt_bearer_token}",
            "Content-Type": "application/json"
        }
        
        try:
            async with httpx.AsyncClient(timeout=300.0) as client:
                response = await client.post(
                    self.gpt_base_url,
                    headers=headers,
                    json=payload
                )
                response.raise_for_status()
                result = response.json()
                
                # #region agent log
                try:
                    with open(log_path, "a", encoding="utf-8") as f:
                        f.write(json.dumps({"sessionId":"debug-session","runId":"gpt-custom-call","hypothesisId":"CUSTOM_GPT_SUCCESS","location":"gpt_service.py:350","message":"Custom GPT service call successful","data":{"status_code":response.status_code,"has_choices":"choices" in result,"choices_count":len(result.get("choices",[]))},"timestamp":int(time.time()*1000)}) + "\n")
                except: pass
                # #endregion
                
                return result
        except httpx.HTTPStatusError as e:
            # Handle 413 Request Entity Too Large - reduce batch size
            if e.response.status_code == 413:
                # #region agent log
                try:
                    with open(log_path, "a", encoding="utf-8") as f:
                        f.write(json.dumps({"sessionId":"debug-session","runId":"gpt-custom-call","hypothesisId":"CUSTOM_GPT_413_ERROR","location":"gpt_service.py:360","message":"Custom GPT service 413 error - payload too large","data":{"error":str(e),"status_code":413},"timestamp":int(time.time()*1000)}) + "\n")
                except: pass
                # #endregion
                raise Exception("Request payload too large (413). Batch size needs to be reduced.")
            # #region agent log
            try:
                with open(log_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps({"sessionId":"debug-session","runId":"gpt-custom-call","hypothesisId":"CUSTOM_GPT_ERROR","location":"gpt_service.py:370","message":"Custom GPT service call failed","data":{"error":str(e),"error_type":type(e).__name__,"status_code":e.response.status_code if hasattr(e, 'response') else None},"timestamp":int(time.time()*1000)}) + "\n")
            except: pass
            # #endregion
            raise
        except Exception as e:
            # #region agent log
            try:
                with open(log_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps({"sessionId":"debug-session","runId":"gpt-custom-call","hypothesisId":"CUSTOM_GPT_ERROR","location":"gpt_service.py:380","message":"Custom GPT service call failed","data":{"error":str(e),"error_type":type(e).__name__},"timestamp":int(time.time()*1000)}) + "\n")
            except: pass
            # #endregion
            raise

    async def analyze_frame(
        self,
        image_path: str,
        timestamp_seconds: float,
        frame_number: Optional[int] = None,
        user_id: Optional[str] = None,
        db: Optional[Any] = None
    ) -> Dict:
        """
        Analyze a single frame using GPT-4 Vision API
        
        Args:
            image_path: Path to the frame image file
            timestamp_seconds: Timestamp of the frame in the video
            frame_number: Optional frame number
            user_id: Optional user ID to use custom prompt and API key
            db: Optional database session to fetch user prompt and API key
        
        Returns:
            Dictionary with 'description', 'ocr_text', and 'processing_time_ms'
        """
        # Use custom GPT service if configured
        if not self.use_custom_gpt:
            # Get OpenAI client (user's key or system default)
            client = await self._get_openai_client(user_id, db)
            if not client:
                raise ValueError("OpenAI API key not configured")
        else:
            client = None  # Will use custom GPT service
        
        start_time = time.time()
        
        try:
            # Read and encode image
            async with aiofiles.open(image_path, 'rb') as f:
                image_data = await f.read()
                base64_image = base64.b64encode(image_data).decode('utf-8')
            
            # Get prompt template (user's custom or default)
            prompt_template = await self.get_prompt_template(user_id, db)
            
            # Format prompt with timestamp
            prompt_text = prompt_template.format(timestamp=timestamp_seconds)
            print(f"[GPT Service] Formatted prompt for timestamp: {timestamp_seconds}")
            print(f"[GPT Service] Prompt text length: {len(prompt_text)} characters")
            print(f"[GPT Service] Prompt preview: {prompt_text[:300]}...")
            
            # Always request JSON since our prompt explicitly asks for JSON format
            # The prompt.txt file specifies "strict JSON response"
            request_json = True  # Always true since prompt.txt requires JSON
            print(f"[GPT Service] Requesting JSON format: {request_json}")
            
            # Call GPT-4 Vision API (use user's client if available)
            api_params = {
                "model": "gpt-4o-mini",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": prompt_text
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ],
                "max_tokens": 1000
            }
            
            # Only request JSON if prompt explicitly asks for it
            if request_json:
                api_params["response_format"] = {"type": "json_object"}
                print(f"[GPT Service] Added response_format: json_object to API params")
            
            print(f"[GPT Service] Making API call to GPT-4o-mini...")
            print(f"[GPT Service] Image path: {image_path}")
            print(f"[GPT Service] Image size: {len(base64_image)} base64 characters")
            
            # Use custom GPT service or OpenAI client
            if self.use_custom_gpt:
                print(f"[GPT Service] Using custom GPT service: {self.gpt_base_url}")
                # #region agent log
                try:
                    with open(log_path, "a", encoding="utf-8") as f:
                        f.write(json.dumps({"sessionId":"debug-session","runId":"gpt-analyze-frame","hypothesisId":"USE_CUSTOM_GPT","location":"gpt_service.py:426","message":"Using custom GPT for single frame","data":{"image_path":image_path,"timestamp":timestamp_seconds},"timestamp":int(time.time()*1000)}) + "\n")
                except: pass
                # #endregion
                response_data = await self._call_custom_gpt(api_params)
                # Custom GPT service returns JSON directly
                content = response_data.get("choices", [{}])[0].get("message", {}).get("content", "")
            else:
                response = await client.chat.completions.create(**api_params)
                content = response.choices[0].message.content
            
            print(f"[GPT Service] API call completed successfully")
            
            # Parse response
            
            # Print and log raw response for debugging
            print(f"[GPT Service] ========== GPT RESPONSE RECEIVED ==========")
            print(f"[GPT Service] Response length: {len(content) if content else 0} characters")
            print(f"[GPT Service] Full response content:")
            print(content)
            print(f"[GPT Service] ============================================")
            
            logger.warning("Raw GPT response received",
                        content_preview=content[:500] if content else "None",
                        content_length=len(content) if content else 0,
                        timestamp=timestamp_seconds)
            
            # Initialize defaults
            description = ""
            ocr_text = None
            meta_tags = []
            
            # Since we're using response_format: {"type": "json_object"}, 
            # OpenAI should return valid JSON. Parse it directly.
            try:
                # Content should be valid JSON, but strip whitespace just in case
                content_cleaned = content.strip() if content else ""
                
                if not content_cleaned:
                    raise ValueError("Empty response from GPT API")
                
                # Try direct JSON parse first (should work with response_format)
                print(f"[GPT Service] Attempting to parse JSON response...")
                print(f"[GPT Service] Content to parse (first 200 chars): {content_cleaned[:200]}")
                try:
                    json_response = json.loads(content_cleaned)
                    print(f"[GPT Service] ✓ Direct JSON parse succeeded!")
                except json.JSONDecodeError as parse_err:
                    # If direct parse fails, try stripping markdown and repairing
                    print(f"[GPT Service] ✗ Direct JSON parse failed: {str(parse_err)}")
                    print(f"[GPT Service] Attempting repair...")
                    logger.warning("Direct JSON parse failed, attempting repair",
                                content_preview=content_cleaned[:200],
                                error=str(parse_err))
                    content_cleaned = self._strip_markdown_code_blocks(content_cleaned).strip()
                    
                    # Extract JSON object if embedded
                    json_start = content_cleaned.find('{')
                    json_end = content_cleaned.rfind('}')
                    
                    if json_start != -1 and json_end != -1 and json_end > json_start:
                        json_str = content_cleaned[json_start:json_end + 1]
                        print(f"[GPT Service] Extracted JSON from position {json_start} to {json_end}")
                    else:
                        json_str = content_cleaned
                        print(f"[GPT Service] Using full content as JSON string")
                    
                    # Repair and parse
                    print(f"[GPT Service] Repairing JSON string...")
                    json_str = self._repair_json(json_str)
                    print(f"[GPT Service] Repaired JSON (first 200 chars): {json_str[:200]}")
                    json_response = json.loads(json_str)
                    print(f"[GPT Service] ✓ JSON parse succeeded after repair!")
                    
                # Extract fields from JSON response according to prompt format
                # Expected format: {"timestamp": number, "description": string, "meta_tags": [string, string, string]}
                if not isinstance(json_response, dict):
                    raise ValueError(f"JSON response is not a dictionary, got {type(json_response).__name__}")
                
                # Get description (required field)
                description = json_response.get("description", "")
                if not description or not isinstance(description, str):
                    logger.warning("Missing or invalid description in GPT response", 
                                json_keys=list(json_response.keys()),
                                description_type=type(json_response.get("description")).__name__ if "description" in json_response else "missing")
                    description = description if description else "No description provided"
                
                # Get meta_tags (required field, should be array of exactly 3)
                meta_tags = json_response.get("meta_tags", [])
                if not isinstance(meta_tags, list):
                    logger.warning("meta_tags is not a list", 
                                meta_tags_type=type(meta_tags).__name__,
                                meta_tags_value=meta_tags)
                    meta_tags = []
                elif len(meta_tags) != 3:
                    logger.warning("meta_tags should have exactly 3 items", 
                                meta_tags_count=len(meta_tags),
                                meta_tags=meta_tags)
                    # Keep what we have, but log the issue
                
                # Get timestamp from response (optional, prompt asks for it)
                if "timestamp" in json_response:
                    response_ts = json_response.get("timestamp")
                    if isinstance(response_ts, (int, float)):
                        timestamp_seconds = float(response_ts)
                    else:
                        logger.warning("Timestamp in response is not a number", 
                                    timestamp_type=type(response_ts).__name__)
                
                # OCR text is not in the prompt format, but check just in case
                ocr_text = json_response.get("ocr_text") or json_response.get("text")
                
                print(f"[GPT Service] ========== PARSED JSON FIELDS ==========")
                print(f"[GPT Service] Description: {description[:100]}..." if len(description) > 100 else f"[GPT Service] Description: {description}")
                print(f"[GPT Service] Meta tags: {meta_tags}")
                print(f"[GPT Service] Meta tags count: {len(meta_tags)}")
                print(f"[GPT Service] Timestamp: {timestamp_seconds}")
                print(f"[GPT Service] JSON keys: {list(json_response.keys())}")
                print(f"[GPT Service] ========================================")
                
                logger.info("Successfully parsed JSON response from GPT",
                           has_description=bool(description),
                           description_length=len(description) if description else 0,
                           meta_tags_count=len(meta_tags) if meta_tags else 0,
                           timestamp=timestamp_seconds,
                           json_keys=list(json_response.keys()))
                        
            except json.JSONDecodeError as e:
                # JSON parsing failed - log detailed error
                error_msg = str(e)
                error_pos = getattr(e, 'pos', 'unknown')
                logger.error("Failed to parse JSON response from GPT",
                            error=error_msg,
                            error_position=error_pos,
                            content_preview=content[:500] if content else "None",
                            content_length=len(content) if content else 0,
                            timestamp=timestamp_seconds)
                logger.error("Full raw response content", content=content)
                
                # Try one final repair attempt
                try:
                    repaired = self._repair_json(content)
                    logger.warning("Attempting final JSON repair", repaired_preview=repaired[:200])
                    json_response = json.loads(repaired)
                    
                    if isinstance(json_response, dict):
                        description = json_response.get("description", "Error: Could not parse GPT response")
                        meta_tags = json_response.get("meta_tags", [])
                        if not isinstance(meta_tags, list):
                            meta_tags = []
                        logger.info("JSON repair succeeded after initial failure")
                    else:
                        raise ValueError("Repaired JSON is not a dictionary")
                except Exception as repair_error:
                    logger.error("JSON repair attempt also failed", repair_error=str(repair_error))
                    # Re-raise with clear error message
                    raise ValueError(f"Failed to parse GPT JSON response: {error_msg}. Content preview: {content[:200]}")
                    
            except Exception as e:
                # Unexpected error during JSON parsing
                logger.error("Unexpected error parsing JSON response",
                            error=str(e),
                            error_type=type(e).__name__,
                            content_preview=content[:500] if content else "None",
                            timestamp=timestamp_seconds,
                            exc_info=True)
                raise
            
            processing_time = int((time.time() - start_time) * 1000)
            
            result = {
                "description": description,
                "ocr_text": ocr_text,
                "meta_tags": meta_tags,  # Add meta_tags to result
                "processing_time_ms": processing_time,
                "model": "gpt-4o-mini",
                "timestamp": timestamp_seconds,
                "frame_number": frame_number
            }
            
            # Store full response in gpt_response for metadata
            if meta_tags:
                result["gpt_response"] = {
                    "description": description,
                    "ocr_text": ocr_text,
                    "meta_tags": meta_tags,
                    "timestamp": timestamp_seconds,
                    "frame_number": frame_number
                }
            
            logger.info("Frame analyzed with GPT", 
                       image_path=image_path,
                       processing_time_ms=processing_time,
                       has_ocr=ocr_text is not None)
            
            return result
            
        except Exception as e:
            error_str = str(e)
            # Clean up error message - remove confusing JSON decode details
            if "JSON parsing failed" in error_str or "Expecting" in error_str:
                # Extract a cleaner error message
                if "Response preview:" in error_str:
                    # Use the response preview part
                    error_str = "Invalid JSON response from GPT API"
                else:
                    error_str = "Failed to parse GPT response as JSON"
            
            logger.error("GPT frame analysis failed",
                        image_path=image_path,
                        error=error_str,
                        error_type=type(e).__name__,
                        exc_info=True)
            # Return error result with cleaner message
            return {
                "description": f"Error analyzing frame: {error_str}",
                "ocr_text": None,
                "meta_tags": None,
                "processing_time_ms": int((time.time() - start_time) * 1000),
                "error": error_str
            }
    
    async def analyze_frame_batch(
        self,
        frames_batch: List[Dict],
        user_id: Optional[str] = None,
        db: Optional[Any] = None
    ) -> List[Dict]:
        """
        Analyze a batch of frames in a single GPT API call (up to 10 frames)
        
        Args:
            frames_batch: List of frame dictionaries (max 10 frames)
            user_id: Optional user ID to use custom API key
            db: Optional database session to fetch user API key
        
        Returns:
            List of analyzed frames with GPT responses
        """
        # Use custom GPT service if configured
        if not self.use_custom_gpt:
            # Get OpenAI client (user's key or system default)
            client = await self._get_openai_client(user_id, db)
            if not client:
                raise ValueError("OpenAI API key not configured")
        
        if not frames_batch:
            return []
        
        start_time = time.time()
        
        try:
            # Prepare images for batch processing
            image_contents = []
            for frame in frames_batch:
                image_path = frame.get("image_path") or frame.get("frame_path")
                if not image_path:
                    continue
                
                async with aiofiles.open(image_path, 'rb') as f:
                    image_data = await f.read()
                    base64_image = base64.b64encode(image_data).decode('utf-8')
                    image_contents.append({
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{base64_image}"
                        }
                    })
            
            if not image_contents:
                logger.warning("No valid images in batch")
                return frames_batch
            
            # Get user's custom prompt template if available
            prompt_template = await self.get_prompt_template(user_id, db)
            
            # Create prompt that asks for analysis of all frames
            timestamps = [f.get("timestamp", 0.0) for f in frames_batch]
            
            # If user has a custom prompt, adapt it for batch processing
            # Otherwise use default batch prompt
            if user_id and db and prompt_template != self.prompt_template:
                # User has custom prompt - adapt it for batch
                prompt_text = f"""Analyze these {len(frames_batch)} video frames using the following instructions:

{prompt_template}

IMPORTANT: Return a JSON object with a "frames" key containing an array. Each element in the array corresponds to a frame in order:
{{
  "frames": [
    {{
      "timestamp": <timestamp_in_seconds>,
      "description": "<detailed_description>",
      "ocr_text": "<extracted_text_or_null>",
      "meta_tags": ["tag1", "tag2", "tag3"]
    }},
    ...
  ]
}}

Frame timestamps (in order): {', '.join([str(ts) for ts in timestamps])}"""
            else:
                # Use default batch prompt
                prompt_text = f"""Analyze these {len(frames_batch)} video frames and provide a JSON response for EACH frame.

For each frame, provide:
1. A detailed description of what you see (UI elements, text, layout, etc.)
2. Extract any visible text (OCR) from the frame
3. Three meta tags that describe the frame content

IMPORTANT: Return a JSON object with a "frames" key containing an array. Each element in the array corresponds to a frame in order:
{{
  "frames": [
    {{
      "timestamp": <timestamp_in_seconds>,
      "description": "<detailed_description>",
      "ocr_text": "<extracted_text_or_null>",
      "meta_tags": ["tag1", "tag2", "tag3"]
    }},
    ...
  ]
}}

Frame timestamps (in order): {', '.join([str(ts) for ts in timestamps])}"""
            
            # Call GPT-4 Vision API with multiple images
            api_params = {
                "model": "gpt-4o-mini",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": prompt_text
                            }
                        ] + image_contents
                    }
                ],
                "max_tokens": 4000,  # Increased for batch processing
                "response_format": {"type": "json_object"}
            }
            
            logger.info("Making batch GPT API call", 
                       frame_count=len(frames_batch),
                       image_count=len(image_contents),
                       using_custom_gpt=self.use_custom_gpt)
            
            # Add timeout to prevent hanging
            import asyncio
            try:
                if self.use_custom_gpt:
                    # Use custom GPT service
                    # #region agent log
                    log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
                    try:
                        with open(log_path, "a", encoding="utf-8") as f:
                            f.write(json.dumps({"sessionId":"debug-session","runId":"gpt-batch-analyze","hypothesisId":"USE_CUSTOM_GPT_BATCH","location":"gpt_service.py:730","message":"Using custom GPT for batch","data":{"batch_size":len(frames_batch),"image_count":len(image_contents)},"timestamp":int(time.time()*1000)}) + "\n")
                    except: pass
                    # #endregion
                    response_data = await asyncio.wait_for(
                        self._call_custom_gpt(api_params),
                        timeout=300.0  # 5 minute timeout per batch
                    )
                    content = response_data.get("choices", [{}])[0].get("message", {}).get("content", "")
                else:
                    # Use OpenAI client
                    response = await asyncio.wait_for(
                        client.chat.completions.create(**api_params),
                        timeout=300.0  # 5 minute timeout per batch
                    )
                    content = response.choices[0].message.content
            except asyncio.TimeoutError:
                logger.error("GPT API call timed out after 5 minutes",
                           batch_size=len(frames_batch))
                raise Exception("GPT API call timed out after 5 minutes. Batch may be too large or API is slow.")
            
            # Parse response
            processing_time = int((time.time() - start_time) * 1000)
            
            # Parse JSON response
            try:
                content_cleaned = content.strip() if content else ""
                json_response = json.loads(content_cleaned)
                
                logger.info("Parsed JSON response", 
                           response_type=type(json_response).__name__,
                           has_frames_key="frames" in json_response if isinstance(json_response, dict) else False,
                           keys=list(json_response.keys()) if isinstance(json_response, dict) else None)
                
                # Handle response format - expect object with "frames" array
                if isinstance(json_response, dict) and "frames" in json_response:
                    results = json_response["frames"]
                    if not isinstance(results, list):
                        logger.warning("Frames key exists but is not a list", frames_type=type(results).__name__)
                        results = [results] if results else []
                elif isinstance(json_response, list):
                    # Fallback: if we get an array directly, use it
                    logger.warning("Received array instead of object with frames key")
                    results = json_response
                elif isinstance(json_response, dict):
                    # Try to find frame data in other keys
                    logger.warning("No 'frames' key found, checking for alternative structure", keys=list(json_response.keys()))
                    # Check if it's a single frame response
                    if "timestamp" in json_response or "description" in json_response:
                        results = [json_response]
                    else:
                        # Try to extract any array from the response
                        for key, value in json_response.items():
                            if isinstance(value, list):
                                results = value
                                logger.info("Found array in key", key=key, array_length=len(value))
                                break
                        else:
                            raise ValueError(f"Could not find frames array in response. Keys: {list(json_response.keys())}")
                else:
                    raise ValueError(f"Unexpected response format: {type(json_response)}")
                
                logger.info("Extracted results", results_count=len(results), expected_count=len(frames_batch))
                
                # Map results back to frames
                analyzed_frames = []
                for i, frame in enumerate(frames_batch):
                    if i < len(results):
                        result = results[i]
                        frame.update({
                            "description": result.get("description", ""),
                            "ocr_text": result.get("ocr_text"),
                            "meta_tags": result.get("meta_tags", []),
                            "processing_time_ms": processing_time // len(frames_batch),  # Divide time per frame
                            "gpt_response": result
                        })
                    else:
                        # Missing result for this frame
                        frame.update({
                            "description": "No analysis result",
                            "ocr_text": None,
                            "meta_tags": [],
                            "processing_time_ms": 0,
                            "error": "Missing result in batch response"
                        })
                    analyzed_frames.append(frame)
                
                logger.info("Batch frame analysis completed successfully",
                           batch_size=len(frames_batch),
                           processing_time_ms=processing_time,
                           results_count=len(analyzed_frames))
                
                return analyzed_frames
                
            except json.JSONDecodeError as e:
                logger.error("Failed to parse batch JSON response",
                           error=str(e),
                           content_preview=content[:500])
                # Return frames with error
                for frame in frames_batch:
                    frame.update({
                        "description": f"Error parsing batch response: {str(e)}",
                        "ocr_text": None,
                        "meta_tags": [],
                        "processing_time_ms": processing_time // len(frames_batch),
                        "error": str(e)
                    })
                return frames_batch
                
        except Exception as e:
            logger.error("Batch frame analysis failed",
                        error=str(e),
                        batch_size=len(frames_batch),
                        exc_info=True)
            # Return frames with error
            for frame in frames_batch:
                frame.update({
                    "description": f"Error in batch analysis: {str(e)}",
                    "ocr_text": None,
                    "meta_tags": [],
                    "processing_time_ms": 0,
                    "error": str(e)
                })
            return frames_batch
    
    async def batch_analyze_frames(
        self,
        frames: List[Dict],
        max_workers: int = 5,
        batch_size: int = 10,
        user_id: Optional[str] = None,
        db: Optional[Any] = None
    ) -> List[Dict]:
        """
        Analyze multiple frames in batches (production-ready with error handling)
        
        Args:
            frames: List of frame dictionaries with 'image_path', 'timestamp', etc.
            max_workers: Maximum number of concurrent batch API calls (default: 5)
            batch_size: Number of frames to send in each batch (default: 10)
        
        Returns:
            List of analyzed frames with GPT responses
        """
        import asyncio
        
        # #region agent log
        log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"gpt-batch-check","hypothesisId":"BATCH_ANALYZE_CHECK","location":"gpt_service.py:960","message":"Checking GPT service configuration","data":{"use_custom_gpt":self.use_custom_gpt,"gpt_base_url":bool(self.gpt_base_url),"gpt_bearer_token":bool(self.gpt_bearer_token),"has_client":bool(self.client)},"timestamp":int(time.time()*1000)}) + "\n")
        except: pass
        # #endregion
        
        # Re-check custom GPT service at runtime (settings might have been updated)
        use_custom_gpt = bool(settings.GPT_BASE_URL and settings.GPT_BEARER_TOKEN)
        # #region agent log
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"gpt-batch-check","hypothesisId":"RUNTIME_CHECK","location":"gpt_service.py:964","message":"Runtime custom GPT check","data":{"use_custom_gpt_from_settings":use_custom_gpt,"current_use_custom_gpt":self.use_custom_gpt,"settings_gpt_base_url":bool(settings.GPT_BASE_URL),"settings_gpt_bearer_token":bool(settings.GPT_BEARER_TOKEN)},"timestamp":int(time.time()*1000)}) + "\n")
        except: pass
        # #endregion
        
        if use_custom_gpt and not self.use_custom_gpt:
            # Update instance variables if custom GPT is now available
            self.gpt_base_url = settings.GPT_BASE_URL
            self.gpt_bearer_token = settings.GPT_BEARER_TOKEN
            self.use_custom_gpt = True
            logger.info("Custom GPT service detected at runtime", base_url=self.gpt_base_url[:50])
            # #region agent log
            try:
                with open(log_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps({"sessionId":"debug-session","runId":"gpt-batch-check","hypothesisId":"RUNTIME_UPDATE","location":"gpt_service.py:970","message":"Updated to use custom GPT at runtime","data":{"use_custom_gpt":self.use_custom_gpt},"timestamp":int(time.time()*1000)}) + "\n")
            except: pass
            # #endregion
        
        # Check if we have a GPT service configured
        # #region agent log
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"gpt-batch-check","hypothesisId":"BEFORE_CLIENT_CHECK","location":"gpt_service.py:973","message":"Before client check","data":{"use_custom_gpt":self.use_custom_gpt,"will_check_openai":not self.use_custom_gpt},"timestamp":int(time.time()*1000)}) + "\n")
        except: pass
        # #endregion
        
        if not self.use_custom_gpt:
            # Get OpenAI client (user's key or system default)
            client = await self._get_openai_client(user_id, db)
            if not client:
                logger.error("OpenAI API key not configured. Cannot analyze frames.")
                # #region agent log
                try:
                    with open(log_path, "a", encoding="utf-8") as f:
                        f.write(json.dumps({"sessionId":"debug-session","runId":"gpt-batch-check","hypothesisId":"NO_GPT_SERVICE","location":"gpt_service.py:990","message":"No GPT service available - returning error frames","data":{"use_custom_gpt":self.use_custom_gpt,"has_client":False},"timestamp":int(time.time()*1000)}) + "\n")
                except: pass
                # #endregion
                # Return frames with error messages
                for frame in frames:
                    frame.update({
                        "description": "OpenAI API key not configured",
                        "ocr_text": None,
                        "meta_tags": [],
                        "processing_time_ms": 0,
                        "error": "OpenAI API key not configured"
                    })
                return frames
        else:
            # #region agent log
            try:
                with open(log_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps({"sessionId":"debug-session","runId":"gpt-batch-check","hypothesisId":"USING_CUSTOM_GPT","location":"gpt_service.py:1005","message":"Using custom GPT service - proceeding with batch analysis","data":{"use_custom_gpt":self.use_custom_gpt,"total_frames":len(frames)},"timestamp":int(time.time()*1000)}) + "\n")
            except: pass
            # #endregion
        
        if not frames:
            return []
        
        # For custom GPT service, use smaller batch size to avoid 413 errors
        # Custom GPT service has stricter payload size limits
        effective_batch_size = batch_size
        if self.use_custom_gpt:
            # Reduce batch size for custom GPT to avoid 413 Request Entity Too Large errors
            # Use max 2 frames per batch for custom GPT (safer than 3 based on testing)
            effective_batch_size = min(batch_size, 2)
            # #region agent log
            log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
            try:
                with open(log_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps({"sessionId":"debug-session","runId":"gpt-batch-check","hypothesisId":"REDUCE_BATCH_SIZE","location":"gpt_service.py:1050","message":"Reducing batch size for custom GPT","data":{"original_batch_size":batch_size,"effective_batch_size":effective_batch_size,"reason":"Custom GPT has payload size limits"},"timestamp":int(time.time()*1000)}) + "\n")
            except: pass
            # #endregion
        
        # Split frames into batches using effective batch size
        frame_batches = []
        for i in range(0, len(frames), effective_batch_size):
            batch = frames[i:i + effective_batch_size]
            frame_batches.append(batch)
        
        logger.info("Processing frames in batches",
                   total_frames=len(frames),
                   batch_size=batch_size,
                   total_batches=len(frame_batches),
                   using_user_key=user_id is not None)
        
        # Create semaphore to limit concurrent batch API calls
        semaphore = asyncio.Semaphore(max_workers)
        
        async def analyze_batch_with_semaphore(batch):
            async with semaphore:
                try:
                    # #region agent log
                    log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
                    try:
                        with open(log_path, "a", encoding="utf-8") as f:
                            f.write(json.dumps({"sessionId":"debug-session","runId":"gpt-batch-analyze","hypothesisId":"BATCH_START","location":"gpt_service.py:1051","message":"Starting batch analysis","data":{"batch_size":len(batch),"use_custom_gpt":self.use_custom_gpt},"timestamp":int(time.time()*1000)}) + "\n")
                    except: pass
                    # #endregion
                    result = await self.analyze_frame_batch(batch, user_id=user_id, db=db)
                    # #region agent log
                    try:
                        with open(log_path, "a", encoding="utf-8") as f:
                            f.write(json.dumps({"sessionId":"debug-session","runId":"gpt-batch-analyze","hypothesisId":"BATCH_COMPLETE","location":"gpt_service.py:1056","message":"Batch analysis completed","data":{"batch_size":len(batch),"result_count":len(result) if result else 0},"timestamp":int(time.time()*1000)}) + "\n")
                    except: pass
                    # #endregion
                    return result
                except Exception as e:
                    error_str = str(e)
                    # Check if it's a 413 error - if so, try processing frames individually
                    if "413" in error_str or "Request Entity Too Large" in error_str or "payload too large" in error_str.lower():
                        logger.warning("Batch too large for custom GPT, processing frames individually",
                                     batch_size=len(batch))
                        # #region agent log
                        log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
                        try:
                            with open(log_path, "a", encoding="utf-8") as f:
                                f.write(json.dumps({"sessionId":"debug-session","runId":"gpt-batch-analyze","hypothesisId":"BATCH_413_FALLBACK","location":"gpt_service.py:1070","message":"Batch too large, falling back to individual frame processing","data":{"batch_size":len(batch)},"timestamp":int(time.time()*1000)}) + "\n")
                        except: pass
                        # #endregion
                        # Process frames individually as fallback
                        individual_results = []
                        for frame in batch:
                            try:
                                single_result = await self.analyze_frame_batch([frame], user_id=user_id, db=db)
                                if single_result:
                                    individual_results.extend(single_result)
                            except Exception as frame_error:
                                logger.error("Individual frame analysis failed",
                                           frame_timestamp=frame.get("timestamp"),
                                           error=str(frame_error))
                                frame.update({
                                    "description": f"Error analyzing frame: {str(frame_error)}",
                                    "ocr_text": None,
                                    "meta_tags": [],
                                    "processing_time_ms": 0,
                                    "error": str(frame_error)
                                })
                                individual_results.append(frame)
                        return individual_results
                    else:
                        logger.error("Batch analysis exception",
                                   batch_size=len(batch),
                                   error=error_str)
                        # #region agent log
                        log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
                        try:
                            with open(log_path, "a", encoding="utf-8") as f:
                                f.write(json.dumps({"sessionId":"debug-session","runId":"gpt-batch-analyze","hypothesisId":"BATCH_ERROR","location":"gpt_service.py:1095","message":"Batch analysis exception","data":{"batch_size":len(batch),"error":error_str,"error_type":type(e).__name__},"timestamp":int(time.time()*1000)}) + "\n")
                        except: pass
                        # #endregion
                        # Return frames with error
                        for frame in batch:
                            frame.update({
                                "description": f"Error analyzing batch: {error_str}",
                                "ocr_text": None,
                                "meta_tags": [],
                                "processing_time_ms": 0,
                                "error": error_str
                            })
                        return batch
        
        # Process all batches concurrently
        tasks = [analyze_batch_with_semaphore(batch) for batch in frame_batches]
        batch_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Flatten results
        analyzed_frames = []
        for batch_result in batch_results:
            if isinstance(batch_result, Exception):
                logger.error("Batch processing failed", error=str(batch_result))
                # Create error frames for this batch
                for frame in frames[len(analyzed_frames):len(analyzed_frames) + batch_size]:
                    frame.update({
                        "description": f"Error: {str(batch_result)}",
                        "ocr_text": None,
                        "meta_tags": [],
                        "processing_time_ms": 0,
                        "error": str(batch_result)
                    })
                    analyzed_frames.append(frame)
            else:
                analyzed_frames.extend(batch_result)
        
        # Sort by timestamp to maintain order
        analyzed_frames.sort(key=lambda x: x.get("timestamp", 0))
        
        successful = sum(1 for f in analyzed_frames if "error" not in f or not f.get("error"))
        logger.info("Batch frame analysis completed",
                   total_frames=len(analyzed_frames),
                   successful=successful,
                   batches_processed=len(frame_batches))
        
        return analyzed_frames

