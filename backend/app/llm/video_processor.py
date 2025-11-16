"""
Video processing utilities for behavioral answer evaluation.
Converts base64 video data to text transcription for LLM judging.
"""

import base64
import tempfile
import os
from pathlib import Path
from typing import Optional
from datetime import datetime

class VideoProcessor:
    """
    Processes video answers by transcribing them to text.
    Currently supports base64 encoded video data.
    """
    
    def __init__(self, openai_client=None):
        """
        Initialize video processor.
        
        Args:
            openai_client: Optional OpenAI client for Whisper API transcription
        """
        self.client = openai_client
    
    def is_video_data(self, answer: str) -> bool:
        """
        Check if the answer string is base64 encoded video data.
        
        Args:
            answer: The answer string to check
            
        Returns:
            True if the answer appears to be base64 video data
        """
        if not answer or not isinstance(answer, str):
            return False
        
        # Check for data URI scheme (e.g., "data:video/webm;base64,...")
        if answer.startswith("data:video/"):
            return True
        
        return False
    
    def extract_base64_data(self, data_uri: str) -> tuple[bytes, str]:
        """
        Extract the base64 data and mime type from a data URI.
        
        Args:
            data_uri: The data URI string (e.g., "data:video/webm;base64,...")
            
        Returns:
            Tuple of (decoded_bytes, mime_type)
        """
        if not data_uri.startswith("data:"):
            raise ValueError("Invalid data URI format")
        
        # Split into metadata and data
        # Format: data:video/webm;base64,<base64_data>
        header, data = data_uri.split(",", 1)
        
        # Extract mime type
        mime_type = header.split(";")[0].replace("data:", "")
        
        # Decode base64
        video_bytes = base64.b64decode(data)
        
        return video_bytes, mime_type
    
    async def transcribe_video(self, answer: str) -> str:
        """
        Transcribe video answer to text using OpenAI Whisper API.
        
        Args:
            answer: Base64 encoded video data (as data URI)
            
        Returns:
            Transcribed text from the video
        """
        if not self.is_video_data(answer):
            # Not video data, return as-is
            return answer
        
        try:
            # Extract video data
            video_bytes, mime_type = self.extract_base64_data(answer)
            
            # Determine file extension from mime type
            extension_map = {
                "video/webm": ".webm",
                "video/mp4": ".mp4",
                "video/ogg": ".ogg",
            }
            file_extension = extension_map.get(mime_type, ".webm")
            
            # Save to temporary file (Whisper API requires file input)
            with tempfile.NamedTemporaryFile(
                delete=False, 
                suffix=file_extension,
                mode='wb'
            ) as tmp_file:
                tmp_file.write(video_bytes)
                tmp_file_path = tmp_file.name
            
            try:
                # Transcribe using OpenAI Whisper API
                if self.client:
                    transcription = await self._transcribe_with_openai(tmp_file_path)
                else:
                    # Fallback: return a placeholder
                    transcription = "[Video answer - transcription not available]"
                
                return transcription
            
            finally:
                # Clean up temporary file
                if os.path.exists(tmp_file_path):
                    os.remove(tmp_file_path)
        
        except Exception as e:
            # Return error message as fallback
            return f"[Error transcribing video: {str(e)}]"
    
    async def _transcribe_with_openai(self, audio_file_path: str) -> str:
        """
        Transcribe audio/video file using OpenAI Whisper API.
        
        Args:
            audio_file_path: Path to the audio/video file
            
        Returns:
            Transcribed text
        """
        try:
            text = ""
            
            # Method 1: If you have an OpenAI client instance
            # Use the existing client to make the Whisper API call
            if hasattr(self.client, 'client') and self.client.client:
                # Assuming your OpenAI client wraps the official openai library
                with open(audio_file_path, "rb") as audio_file:
                    transcription = self.client.client.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio_file,
                        language="en",  # Optional: specify language for better accuracy
                        response_format="text"  # Get plain text response
                    )
                    text = transcription if isinstance(transcription, str) else transcription.text
            
            # Method 2: Direct OpenAI API call (fallback)
            # If the above doesn't work, you can import OpenAI directly
            else:
                
                # Initialize client with API key from environment
                api_key = os.getenv("OPENAI_API_KEY")
                if not api_key:
                    raise ValueError("OPENAI_API_KEY not found in environment variables")
                
                # Use official OpenAI library
                from openai import OpenAI
                openai_client = OpenAI(api_key=api_key)
                
                with open(audio_file_path, "rb") as audio_file:
                    transcription = openai_client.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio_file,
                        language="en",
                        response_format="text"
                    )
                    text = transcription
            
            # Save transcription to file for debugging
            self._save_transcription_to_file(text, audio_file_path)
            
            return text
        
        except Exception as e:
            import traceback
            traceback.print_exc()
            
            # Return a more helpful error message
            error_msg = str(e)
            if "OPENAI_API_KEY" in error_msg or "api_key" in error_msg.lower():
                return "[Error: OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.]"
            elif "quota" in error_msg.lower():
                return "[Error: OpenAI API quota exceeded. Please check your API usage.]"
            else:
                return f"[Error transcribing video: {error_msg}]"
    
    def _save_transcription_to_file(self, text: str, audio_file_path: str):
        """
        Save transcription to a text file for debugging purposes.
        
        Args:
            text: The transcribed text
            audio_file_path: Path to the original audio file (for naming)
        """
        try:
            # Create output directory if it doesn't exist
            script_dir = os.path.dirname(os.path.abspath(__file__))
            output_dir = os.path.join(script_dir, "transcriptions")
            Path(output_dir).mkdir(parents=True, exist_ok=True)
            
            # Generate filename with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            base_name = os.path.splitext(os.path.basename(audio_file_path))[0]
            output_file = os.path.join(output_dir, f"transcription_{timestamp}_{base_name}.txt")
            
            # Write transcription to file
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write("="*80 + "\n")
                f.write(f"VIDEO TRANSCRIPTION - {timestamp}\n")
                f.write("="*80 + "\n\n")
                f.write(f"Source file: {audio_file_path}\n")
                f.write(f"File size: {os.path.getsize(audio_file_path)} bytes\n")
                f.write(f"Transcribed at: {datetime.now().isoformat()}\n")
                f.write("\n" + "="*80 + "\n")
                f.write("TRANSCRIBED TEXT:\n")
                f.write("="*80 + "\n\n")
                f.write(text)
                f.write("\n\n" + "="*80 + "\n")
                f.write(f"Character count: {len(text)}\n")
                f.write(f"Word count: {len(text.split())}\n")
                f.write("="*80 + "\n")
            
        except Exception as e:
            pass
    
    def save_video_file(self, answer: str, output_dir: str, filename: str) -> Optional[str]:
        """
        Save video data to a file (for debugging or storage).
        
        Args:
            answer: Base64 encoded video data
            output_dir: Directory to save the video file
            filename: Name for the video file (without extension)
            
        Returns:
            Path to saved file, or None if failed
        """
        if not self.is_video_data(answer):
            return None
        
        try:
            video_bytes, mime_type = self.extract_base64_data(answer)
            
            # Determine file extension
            extension_map = {
                "video/webm": ".webm",
                "video/mp4": ".mp4",
                "video/ogg": ".ogg",
            }
            file_extension = extension_map.get(mime_type, ".webm")
            
            # Create output directory if it doesn't exist
            Path(output_dir).mkdir(parents=True, exist_ok=True)
            
            # Save file
            output_path = os.path.join(output_dir, f"{filename}{file_extension}")
            with open(output_path, 'wb') as f:
                f.write(video_bytes)
            
            return output_path
        
        except Exception as e:
            return None
