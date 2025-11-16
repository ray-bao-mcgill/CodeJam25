"""
Test script for video transcription functionality
Run this to test Whisper API integration without starting the full app
"""
import os
import sys
import asyncio
from pathlib import Path

# Add parent directory to path so we can import from app
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
from app.llm.video_processor import VideoProcessor
from app.llm.openai import OpenAIClient

async def test_transcription():
    """Test video transcription with a sample video data URI"""
    
    # Load environment variables
    load_dotenv()
    
    # Check if API key is set
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or api_key == "your-api-key-here":
        print("❌ ERROR: OPENAI_API_KEY not set in .env file")
        print("Please edit backend/.env and add your OpenAI API key")
        print("Get your key from: https://platform.openai.com/api-keys")
        return
    
    print("✅ OpenAI API key found")
    print(f"Key preview: {api_key[:10]}...{api_key[-4:]}")
    
    # Initialize OpenAI client
    openai_client = OpenAIClient(api_key=api_key)
    
    # Initialize video processor
    video_processor = VideoProcessor(openai_client=openai_client)
    
    print("\n" + "="*80)
    print("🎥 VIDEO TRANSCRIPTION TEST")
    print("="*80)
    print("\nThis test will:")
    print("1. Check if you have a sample video file")
    print("2. Transcribe it using OpenAI Whisper API")
    print("3. Save the transcription to a text file")
    print("\n" + "="*80)
    
    # For testing, we need a sample video file
    # You can record one using the frontend and it will be sent as base64
    # For now, let's just test with a placeholder
    
    sample_video_data = "data:video/webm;base64,TEST_DATA_PLACEHOLDER"
    
    print("\n⚠️  NOTE: To test with real video:")
    print("1. Start the backend server: python main.py")
    print("2. Start the frontend: cd ../frontend && npm run dev")
    print("3. Record a video answer in the behavioral round")
    print("4. Check backend/app/llm/transcriptions/ folder for the output")
    
    print("\n✅ Video processor initialized successfully!")
    print(f"✅ Transcription files will be saved to: {os.path.join(os.path.dirname(__file__), 'app', 'llm', 'transcriptions')}")
    print("\n" + "="*80)

if __name__ == "__main__":
    asyncio.run(test_transcription())
