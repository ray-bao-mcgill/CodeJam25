import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigate } from 'react-router-dom'

const JobInputSelection: React.FC = () => {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'role' | 'description' | null>(null)
  const [jobDescription, setJobDescription] = useState('')

  const handleNext = () => {
    if (!name.trim()) return
    
    if (mode === 'description' && jobDescription.trim()) {
      // TODO: Call API with job description mode
      console.log('Job description mode:', { name, jobDescription })
      navigate('/waiting-room')
    } else if (mode === 'role') {
      // Navigate to role selection page (LobbySetup)
      console.log('Role mode selected:', { name })
      navigate('/lobby-setup')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 game-bg">
      <div className="w-full max-w-3xl space-y-12">
        <h1 
          className="text-6xl font-black text-center tracking-widest game-text-glow-cyan"
          style={{ 
            fontFamily: 'Impact, Arial Black, sans-serif',
            color: 'var(--game-cyan)',
            textTransform: 'uppercase'
          }}
        >
          LOBBY
        </h1>
        
        <div className="space-y-10">
          {/* Name Input */}
          <div>
            <Input
              type="text"
              placeholder="ENTER YOUR NAME"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-center text-xl py-8 rounded-2xl font-bold game-border-glow-cyan"
              style={{
                background: 'rgba(15, 10, 31, 0.8)',
                border: `3px solid var(--game-cyan)`,
                color: 'var(--game-text-primary)',
                fontFamily: 'Impact, Arial Black, sans-serif',
                letterSpacing: '0.1em',
                textTransform: 'uppercase'
              }}
            />
          </div>

          {/* Mode Selection Buttons */}
          <div className="flex justify-center gap-8">
            <Button
              onClick={() => {
                setMode('role')
                setJobDescription('')
              }}
              className="px-12 py-8 text-xl font-bold rounded-2xl transform hover:scale-105 transition-all duration-200"
              style={{
                background: mode === 'role'
                  ? `linear-gradient(135deg, var(--game-cyan-dark), var(--game-cyan))`
                  : 'rgba(15, 10, 31, 0.8)',
                border: `3px solid var(--game-cyan)`,
                color: 'var(--game-text-primary)',
                fontFamily: 'Impact, Arial Black, sans-serif',
                textTransform: 'uppercase',
                boxShadow: mode === 'role'
                  ? `0 0 20px var(--game-cyan-glow)`
                  : 'none'
              }}
            >
              ROLE
            </Button>

            <Button
              onClick={() => {
                setMode('description')
              }}
              className="px-12 py-8 text-xl font-bold rounded-2xl transform hover:scale-105 transition-all duration-200"
              style={{
                background: mode === 'description'
                  ? `linear-gradient(135deg, var(--game-red-dark), var(--game-red))`
                  : 'rgba(15, 10, 31, 0.8)',
                border: `3px solid var(--game-red)`,
                color: 'var(--game-text-primary)',
                fontFamily: 'Impact, Arial Black, sans-serif',
                textTransform: 'uppercase',
                boxShadow: mode === 'description'
                  ? `0 0 20px var(--game-red-glow)`
                  : 'none'
              }}
            >
              JOB DESCRIPTION
            </Button>
          </div>

          {/* Job Description Input (shows when description mode is selected) */}
          {mode === 'description' && (
            <div className="animate-in slide-in-from-top duration-300">
              <Input
                type="text"
                placeholder="PASTE JOB DESCRIPTION"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                className="w-full text-center text-lg py-8 rounded-2xl font-bold game-border-glow-red"
                style={{
                  background: 'rgba(15, 10, 31, 0.8)',
                  border: `3px solid var(--game-red)`,
                  color: 'var(--game-text-primary)',
                  fontFamily: 'Impact, Arial Black, sans-serif',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase'
                }}
                autoFocus
              />
            </div>
          )}

          {/* Next Button */}
          <div className="flex justify-center pt-6">
            <Button 
              onClick={handleNext}
              disabled={!name.trim() || !mode || (mode === 'description' && !jobDescription.trim())}
              className="px-20 py-8 text-2xl font-bold rounded-2xl transform hover:scale-110 transition-all duration-300"
              style={{
                background: (name.trim() && mode && (mode === 'role' || jobDescription.trim()))
                  ? `linear-gradient(135deg, #00cc66, var(--game-green))`
                  : 'rgba(50, 50, 50, 0.5)',
                border: (name.trim() && mode && (mode === 'role' || jobDescription.trim()))
                  ? `3px solid var(--game-green)`
                  : '3px solid #555',
                color: 'var(--game-text-primary)',
                fontFamily: 'Impact, Arial Black, sans-serif',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                boxShadow: (name.trim() && mode && (mode === 'role' || jobDescription.trim()))
                  ? `0 0 20px rgba(0, 255, 136, 0.5)`
                  : 'none',
                cursor: (name.trim() && mode && (mode === 'role' || jobDescription.trim())) ? 'pointer' : 'not-allowed'
              }}
            >
              NEXT
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default JobInputSelection
