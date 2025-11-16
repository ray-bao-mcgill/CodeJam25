"""
Simple script to transcribe video files using OpenAI Whisper API.
Saves transcriptions as .txt files in backend/transcriptions/
"""

import asyncio
import os
import sys
from pathlib import Path
from datetime import datetime
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Add current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


async def transcribe_video_file(video_path: str):
    """
    Transcribe a video file using OpenAI Whisper API.
    
    Args:
        video_path: Path to the video file to transcribe
    """
    print(f"\n{'='*80}")
    print(f"🎬 VIDEO TRANSCRIPTION")
    print(f"{'='*80}\n")
    
    # Check if file exists
    if not os.path.exists(video_path):
        print(f"❌ Error: Video file not found: {video_path}")
        return
    
    file_size = os.path.getsize(video_path)
    print(f"📁 Video file: {video_path}")
    print(f"📊 File size: {file_size} bytes ({file_size / 1024 / 1024:.2f} MB)")
    
    # Check for API key
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("\n❌ ERROR: OPENAI_API_KEY not found in environment variables")
        print("Please set it in backend/.env file:")
        print('OPENAI_API_KEY=sk-your-key-here')
        return
    
    print(f"\n🎤 Starting transcription with OpenAI Whisper API...")
    print(f"⏳ This may take a few seconds...\n")
    
    try:
        # Initialize OpenAI client (simple initialization without extra kwargs)
        client = OpenAI(api_key=api_key)
        
        # Transcribe the video
        with open(video_path, "rb") as audio_file:
            transcription = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                language="en",
                response_format="text"
            )
        
        # Get the transcribed text
        text = transcription if isinstance(transcription, str) else transcription.text
        
        print(f"{'='*80}")
        print(f"✅ TRANSCRIPTION COMPLETE!")
        print(f"{'='*80}")
        print(f"📝 Transcribed text:")
        print(f"{'='*80}")
        print(text)
        print(f"{'='*80}\n")
        
        print(f"📊 Character count: {len(text)}")
        print(f"📊 Word count: {len(text.split())}\n")
        
        # Save transcription to file
        script_dir = os.path.dirname(os.path.abspath(__file__))
        output_dir = os.path.join(script_dir, "transcriptions")
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        video_filename = os.path.splitext(os.path.basename(video_path))[0]
        output_file = os.path.join(output_dir, f"transcription_{timestamp}_{video_filename}.txt")
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("="*80 + "\n")
            f.write(f"VIDEO TRANSCRIPTION - {timestamp}\n")
            f.write("="*80 + "\n\n")
            f.write(f"Source file: {video_path}\n")
            f.write(f"File size: {file_size} bytes ({file_size / 1024 / 1024:.2f} MB)\n")
            f.write(f"Transcribed at: {datetime.now().isoformat()}\n")
            f.write("\n" + "="*80 + "\n")
            f.write("TRANSCRIBED TEXT:\n")
            f.write("="*80 + "\n\n")
            f.write(text)
            f.write("\n\n" + "="*80 + "\n")
            f.write(f"Character count: {len(text)}\n")
            f.write(f"Word count: {len(text.split())}\n")
            f.write("="*80 + "\n")
        
        print(f"💾 Transcription saved to:")
        print(f"   {output_file}\n")
        print(f"{'='*80}\n")
        
    except Exception as e:
        print(f"\n{'='*80}")
        print(f"❌ ERROR during transcription:")
        print(f"{'='*80}")
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        print(f"{'='*80}\n")


def main():
    """Main entry point"""
    # Check if video path is provided
    if len(sys.argv) < 2:
        print("\n" + "="*80)
        print("📹 VIDEO TRANSCRIPTION TOOL")
        print("="*80)
        print("\nUsage:")
        print(f"  python transcribe_video.py <path_to_video_file>")
        print("\nExample:")
        print(f"  python transcribe_video.py videos/matchunknown_playerunknown_qbehavioural_q1_20251115_212711.webm")
        
        # List available videos
        videos_dir = Path("videos")
        if videos_dir.exists():
            videos = list(videos_dir.glob("*.webm")) + list(videos_dir.glob("*.mp4"))
            if videos:
                print(f"\n📁 Found {len(videos)} video(s) in videos/ directory:")
                for i, video in enumerate(sorted(videos, key=lambda p: p.stat().st_mtime, reverse=True), 1):
                    size_mb = video.stat().st_size / 1024 / 1024
                    mtime = datetime.fromtimestamp(video.stat().st_mtime)
                    print(f"  {i}. {video.name}")
                    print(f"     Size: {size_mb:.2f} MB | Modified: {mtime.strftime('%Y-%m-%d %H:%M:%S')}")
                
                most_recent = sorted(videos, key=lambda p: p.stat().st_mtime, reverse=True)[0]
                print(f"\n💡 To transcribe the most recent video, run:")
                print(f"  python transcribe_video.py {most_recent}")
            else:
                print("\n⚠️  No videos found in videos/ directory")
                print("   Record a video in the game first!")
        else:
            print("\n⚠️  videos/ directory not found")
            print("   Record a video in the game first!")
        
        print("\n" + "="*80 + "\n")
        return
    
    video_path = sys.argv[1]
    
    # Run async transcription
    asyncio.run(transcribe_video_file(video_path))


if __name__ == "__main__":
    main()
