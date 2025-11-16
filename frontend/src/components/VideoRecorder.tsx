import React, { useRef, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface VideoRecorderProps {
  onRecordingComplete: (videoBlob: Blob) => void
  onRecordingStart?: () => void
  onRecordingStop?: () => void
  maxDuration?: number // in seconds
  disabled?: boolean
}

const VideoRecorder: React.FC<VideoRecorderProps> = ({ 
  onRecordingComplete, 
  onRecordingStart,
  onRecordingStop,
  maxDuration = 60,
  disabled = false 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [hasRecording, setHasRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [error, setError] = useState<string>('')
  const [isPreview, setIsPreview] = useState(false)
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string>('')

  // Timer for recording duration
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>
    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1
          if (newTime >= maxDuration) {
            stopRecording()
          }
          return newTime
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isRecording, isPaused, maxDuration])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        }, 
        audio: true 
      })
      
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setError('')
    } catch (err) {
      console.error('Error accessing camera:', err)
      setError('Unable to access camera. Please allow camera permissions.')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  const startRecording = async () => {
    if (!streamRef.current) {
      await startCamera()
      // Wait a bit for camera to initialize
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    if (!streamRef.current) {
      setError('Camera not available')
      return
    }

    try {
      chunksRef.current = []
      
      // Try to create MediaRecorder without specifying mimeType first
      let mediaRecorder: MediaRecorder | null = null
      let selectedMimeType = ''
      
      try {
        // Try with default settings (no mimeType specified)
        mediaRecorder = new MediaRecorder(streamRef.current)
        selectedMimeType = mediaRecorder.mimeType
        console.log('Using browser default MIME type:', selectedMimeType)
      } catch (defaultError) {
        console.log('Default MediaRecorder failed, trying with specific mimeTypes...')
        
        // Try multiple codec options with fallbacks
        const mimeTypes = [
          'video/webm;codecs=vp9',
          'video/webm;codecs=vp8',
          'video/webm;codecs=vp8,opus',
          'video/webm',
          'video/mp4',
          'video/x-matroska;codecs=avc1',
          '' // Empty string as last resort to use browser default
        ]
        
        for (const mimeType of mimeTypes) {
          try {
            if (mimeType === '' || MediaRecorder.isTypeSupported(mimeType)) {
              const options = mimeType ? { mimeType } : undefined
              mediaRecorder = new MediaRecorder(streamRef.current, options)
              selectedMimeType = mimeType || mediaRecorder.mimeType
              console.log('Using MIME type:', selectedMimeType)
              break
            }
          } catch (err) {
            console.log(`Failed with ${mimeType}:`, err)
            continue
          }
        }
      }
      
      if (!mediaRecorder) {
        throw new Error('No supported video format found')
      }

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blobType = selectedMimeType || 'video/webm'
        const blob = new Blob(chunksRef.current, { type: blobType })
        const url = URL.createObjectURL(blob)
        setRecordedVideoUrl(url)
        setHasRecording(true)
        onRecordingComplete(blob)
        stopCamera()
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start(100) // Collect data every 100ms
      setIsRecording(true)
      setRecordingTime(0)
      setError('')
      
      // Notify parent that recording started
      if (onRecordingStart) {
        onRecordingStart()
      }
    } catch (err) {
      console.error('Error starting recording:', err)
      setError(`Unable to start recording: ${err instanceof Error ? err.message : 'Unknown error'}. Browser: ${navigator.userAgent}`)
    }
  }

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.pause()
      setIsPaused(true)
    }
  }

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isPaused) {
      mediaRecorderRef.current.resume()
      setIsPaused(false)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setIsPaused(false)
      setIsPreview(true)
      
      // Notify parent that recording stopped
      if (onRecordingStop) {
        onRecordingStop()
      }
    }
  }

  const retake = () => {
    if (recordedVideoUrl) {
      URL.revokeObjectURL(recordedVideoUrl)
      setRecordedVideoUrl('')
    }
    setHasRecording(false)
    setIsPreview(false)
    setRecordingTime(0)
    chunksRef.current = []
    startCamera()
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Initialize camera on mount
  useEffect(() => {
    startCamera()
    return () => {
      stopCamera()
      if (recordedVideoUrl) {
        URL.revokeObjectURL(recordedVideoUrl)
      }
    }
  }, [])

  return (
    <div className="space-y-4">
      {/* Video Display */}
      <div className="relative game-sharp game-shadow-hard-lg border-8 border-[var(--game-text-primary)] bg-black overflow-hidden" style={{ aspectRatio: '16/9' }}>
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted={!isPreview}
          src={isPreview ? recordedVideoUrl : undefined}
          controls={isPreview}
        />
        
        {/* Recording Indicator */}
        {isRecording && !isPaused && (
          <div className="absolute top-4 left-4 flex items-center gap-2 game-sharp bg-[var(--game-red)] px-4 py-2 game-shadow-hard-sm border-4 border-[var(--game-text-primary)]">
            <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
            <span className="text-white font-black text-sm">REC</span>
          </div>
        )}

        {/* Paused Indicator */}
        {isPaused && (
          <div className="absolute top-4 left-4 game-sharp bg-[var(--game-yellow)] px-4 py-2 game-shadow-hard-sm border-4 border-[var(--game-text-primary)]">
            <span className="text-[var(--game-text-primary)] font-black text-sm">PAUSED</span>
          </div>
        )}

        {/* Timer */}
        {isRecording && (
          <div className="absolute top-4 right-4 game-sharp bg-[var(--game-paper)] px-4 py-2 game-shadow-hard-sm border-4 border-[var(--game-text-primary)]">
         <span className="text-[var(--game-text-primary)] font-black text-lg">
              {formatTime(maxDuration - recordingTime)}
            </span>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80">
            <div className="game-paper px-8 py-6 game-shadow-hard-lg text-center">
              <div className="text-[var(--game-red)] font-black text-lg mb-2">ERROR</div>
              <div className="text-[var(--game-text-primary)]">{error}</div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-4 flex-wrap">
        {!isRecording && !hasRecording && (
          <Button
            onClick={startRecording}
            disabled={disabled || !!error}
            className="game-sharp bg-[var(--game-red)] px-8 py-6 text-xl font-black uppercase tracking-widest game-shadow-hard-lg hover:translate-y-[-4px] hover:rotate-[-2deg] hover:shadow-[12px_12px_0px_rgba(0,0,0,0.3)] hover:bg-[var(--game-yellow)] transition-all border-8 border-[var(--game-text-primary)] text-white"
            style={{ fontFamily: 'Arial Black, sans-serif' }}
            variant="ghost"
          >
            ● START RECORDING
          </Button>
        )}

        {isRecording && !isPaused && (
          <>
            <Button
              onClick={pauseRecording}
              className="game-sharp bg-[var(--game-yellow)] px-8 py-6 text-xl font-black uppercase tracking-widest game-shadow-hard-lg hover:translate-y-[-4px] hover:rotate-[-2deg] hover:shadow-[12px_12px_0px_rgba(0,0,0,0.3)] transition-all border-8 border-[var(--game-text-primary)] text-[var(--game-text-primary)]"
              style={{ fontFamily: 'Arial Black, sans-serif' }}
              variant="ghost"
            >
              ⏸ PAUSE
            </Button>
            <Button
              onClick={stopRecording}
              className="game-sharp bg-[var(--game-blue)] px-8 py-6 text-xl font-black uppercase tracking-widest game-shadow-hard-lg hover:translate-y-[-4px] hover:rotate-[-2deg] hover:shadow-[12px_12px_0px_rgba(0,0,0,0.3)] hover:bg-[var(--game-yellow)] transition-all border-8 border-[var(--game-text-primary)] text-white"
              style={{ fontFamily: 'Arial Black, sans-serif' }}
              variant="ghost"
            >
              ■ STOP
            </Button>
          </>
        )}

        {isPaused && (
          <>
            <Button
              onClick={resumeRecording}
              className="game-sharp bg-[var(--game-green)] px-8 py-6 text-xl font-black uppercase tracking-widest game-shadow-hard-lg hover:translate-y-[-4px] hover:rotate-[-2deg] hover:shadow-[12px_12px_0px_rgba(0,0,0,0.3)] hover:bg-[var(--game-yellow)] transition-all border-8 border-[var(--game-text-primary)] text-white"
              style={{ fontFamily: 'Arial Black, sans-serif' }}
              variant="ghost"
            >
              ▶ RESUME
            </Button>
            <Button
              onClick={stopRecording}
              className="game-sharp bg-[var(--game-blue)] px-8 py-6 text-xl font-black uppercase tracking-widest game-shadow-hard-lg hover:translate-y-[-4px] hover:rotate-[-2deg] hover:shadow-[12px_12px_0px_rgba(0,0,0,0.3)] hover:bg-[var(--game-yellow)] transition-all border-8 border-[var(--game-text-primary)] text-white"
              style={{ fontFamily: 'Arial Black, sans-serif' }}
              variant="ghost"
            >
              ■ STOP
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export default VideoRecorder
