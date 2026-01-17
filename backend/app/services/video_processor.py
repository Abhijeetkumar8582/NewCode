import cv2
import os
import openai
from pathlib import Path
import tempfile
import base64
from typing import List, Dict, Optional
import time
import httpx
from app.config import settings

class VideoProcessor:
    def __init__(self):
        # Initialize OpenAI client only if API key is provided (for backward compatibility)
        self.openai_client = None
        if settings.OPENAI_API_KEY:
            try:
                self.openai_client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
            except:
                pass
        
        # Use custom GPT service if configured
        self.gpt_base_url = settings.GPT_BASE_URL
        self.gpt_bearer_token = settings.GPT_BEARER_TOKEN
        self.use_custom_gpt = bool(self.gpt_base_url and self.gpt_bearer_token)
        
        self.temp_dir = Path(tempfile.gettempdir()) / "video_frames"
        self.temp_dir.mkdir(exist_ok=True)
    
    def extract_transcript(self, video_path: str) -> str:
        """Extract transcript from video using OpenAI Whisper"""
        if not self.openai_client:
            raise Exception("OpenAI API key is required for transcript extraction. Please set OPENAI_API_KEY in your .env file.")
        
        try:
            with open(video_path, "rb") as video_file:
                transcript = self.openai_client.audio.transcriptions.create(
                    model="whisper-1",
                    file=video_file,
                    response_format="text"
                )
            return transcript
        except Exception as e:
            raise Exception(f"Error extracting transcript: {str(e)}")
    
    def extract_frames(self, video_path: str) -> List[Dict]:
        """Extract 1 frame per second from video"""
        frames = []
        cap = cv2.VideoCapture(video_path)
        
        if not cap.isOpened():
            raise Exception("Could not open video file")
        
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_interval = int(fps)  # 1 frame per second
        
        frame_count = 0
        second = 0
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            # Extract frame every second
            if frame_count % frame_interval == 0:
                # Save frame as image
                frame_path = self.temp_dir / f"frame_{second:04d}.jpg"
                cv2.imwrite(str(frame_path), frame)
                
                frames.append({
                    "second": second,
                    "frame_path": str(frame_path),
                    "frame_number": frame_count
                })
                second += 1
            
            frame_count += 1
        
        cap.release()
        return frames
    
    def analyze_frame_with_openai(self, frame_path: str) -> str:
        """Send screenshot to GPT API (custom or OpenAI) and get description"""
        try:
            with open(frame_path, "rb") as image_file:
                # Encode image to base64
                base64_image = base64.b64encode(image_file.read()).decode('utf-8')
            
            # Use custom GPT service if configured
            if self.use_custom_gpt:
                return self._analyze_with_custom_gpt(base64_image)
            
            # Fallback to OpenAI if available
            if self.openai_client:
                response = self.openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text",
                                    "text": "Describe in detail what is happening in this image. Focus on:\n1. What actions or events are occurring\n2. What objects, UI elements, or visual elements are present\n3. Any changes, movements, or transitions happening\n4. The context and significance of what you see\n\nProvide a clear, detailed description of what's happening in the image."
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
                    max_tokens=400
                )
                return response.choices[0].message.content
            else:
                raise Exception("No GPT service configured. Please set GPT_BASE_URL and GPT_BEARER_TOKEN or OPENAI_API_KEY")
        except Exception as e:
            return f"Error analyzing frame: {str(e)}"
    
    def _analyze_with_custom_gpt(self, base64_image: str) -> str:
        """Analyze frame using custom GPT service"""
        try:
            headers = {
                "Authorization": f"Bearer {self.gpt_bearer_token}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": "OpenAI/gpt-5-nano",  # Adjust model name as needed
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": "Describe in detail what is happening in this image. Focus on:\n1. What actions or events are occurring\n2. What objects, UI elements, or visual elements are present\n3. Any changes, movements, or transitions happening\n4. The context and significance of what you see\n\nProvide a clear, detailed description of what's happening in the image."
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
                "max_tokens": 400
            }
            
            with httpx.Client(timeout=60.0) as client:
                response = client.post(
                    self.gpt_base_url,
                    headers=headers,
                    json=payload
                )
                response.raise_for_status()
                result = response.json()
                
                # Extract content from response (adjust based on actual API response format)
                if "choices" in result and len(result["choices"]) > 0:
                    return result["choices"][0]["message"]["content"]
                elif "content" in result:
                    return result["content"]
                else:
                    return str(result)
        except Exception as e:
            raise Exception(f"Error calling custom GPT service: {str(e)}")
    
    def extract_and_analyze_frames(self, video_path: str) -> List[Dict]:
        """Extract frames and analyze each one with OpenAI"""
        print("Extracting frames from video...")
        frames = self.extract_frames(video_path)
        
        print(f"Extracted {len(frames)} frames. Analyzing with OpenAI...")
        frame_analyses = []
        
        for i, frame_data in enumerate(frames):
            print(f"Analyzing frame {i+1}/{len(frames)} (second {frame_data['second']})...")
            
            analysis = self.analyze_frame_with_openai(frame_data["frame_path"])
            
            frame_analyses.append({
                "second": frame_data["second"],
                "timestamp": f"{frame_data['second']//60:02d}:{frame_data['second']%60:02d}",
                "description": analysis,
                "frame_path": frame_data["frame_path"]
            })
            
            # Small delay to avoid rate limiting
            time.sleep(0.1)
        
        return frame_analyses
    
    def cleanup_temp_files(self):
        """Clean up temporary frame files"""
        for file in self.temp_dir.glob("*.jpg"):
            try:
                file.unlink()
            except:
                pass

