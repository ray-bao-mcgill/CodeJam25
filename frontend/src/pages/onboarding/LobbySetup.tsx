import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLobby } from '@/hooks/useLobby'

const LobbySetup: React.FC = () => {
  const navigate = useNavigate()
  const [playerName, setPlayerNameLocal] = useState('')
  const [mode, setMode] = useState<'role' | 'description' | null>(null)
  const [selectedRole, setSelectedRole] = useState('')
  const [selectedLevel, setSelectedLevel] = useState('')
  const [jobDescriptionText, setJobDescriptionText] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const {
    playerName: hookPlayerName,
    setPlayerName,
    createLobby,
  } = useLobby()

  // Sync local state with hook state only on mount, and only if local is empty
  useEffect(() => {
    if (!playerName && hookPlayerName) {
      setPlayerNameLocal(hookPlayerName)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount - we intentionally don't want to sync after user types

  const roles = ['Frontend', 'Backend', 'Full Stack', 'DevOps', 'Mobile']
  const levels = ['Intern', 'Junior', 'Mid-Level', 'Senior', 'Lead']

  const handleCreateLobby = async () => {
    // Early return if already loading
    if (isLoading) {
      return
    }

    // Validate player name
    if (!playerName || !playerName.trim()) {
      setError('Please enter your name')
      return
    }

    // Validate mode selection
    if (!mode) {
      setError('Please select either Role or Job Description mode')
      return
    }

    // Validate based on mode
    if (mode === 'role') {
      if (!selectedRole || !selectedRole.trim()) {
        setError('Please select a role')
        return
      }
      if (!selectedLevel || !selectedLevel.trim()) {
        setError('Please select a level')
        return
      }
    } else if (mode === 'description') {
      if (!jobDescriptionText || !jobDescriptionText.trim()) {
        setError('Please enter a job description')
        return
      }
    }

    setIsLoading(true)
    setError('')

    try {
      // Store selections for later use
      if (mode === 'role') {
        sessionStorage.setItem('selectedRole', selectedRole)
        sessionStorage.setItem('selectedLevel', selectedLevel)
        sessionStorage.setItem('jobMode', 'role')
      } else {
        sessionStorage.setItem('jobDescription', jobDescriptionText.trim())
        sessionStorage.setItem('jobMode', 'description')
      }
      
      // Create a new lobby - pass player name directly (will save to sessionStorage on success)
      const result = await createLobby(playerName.trim())
      
      if (result?.success) {
        // Navigate to waiting room after creating lobby
        setTimeout(() => {
          navigate('/lobby-waiting', { replace: true })
        }, 100)
      } else {
        setError(result?.error || 'Failed to create lobby')
        setIsLoading(false)
      }
    } catch (err) {
      setError('Failed to create lobby')
      console.error('Error:', err)
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 game-bg">
      <div className="w-full max-w-4xl space-y-12">
        <h1 
          className="text-6xl font-black text-center tracking-widest game-text-glow-cyan"
          style={{ 
            fontFamily: 'Impact, Arial Black, sans-serif',
            color: 'var(--game-cyan)',
            textTransform: 'uppercase'
          }}
        >
          CREATE LOBBY
        </h1>
        
        <div className="space-y-10">
          {/* Name Input */}
          <div>
            <Input
              type="text"
              placeholder="ENTER YOUR NAME"
              value={playerName}
              onChange={(e) => {
                setPlayerNameLocal(e.target.value)
                setError('')
              }}
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

          {/* Mode Selection */}
          <div className="flex justify-center gap-8">
            <Button
              onClick={() => {
                setMode('role')
                setJobDescriptionText('')
                setError('')
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
                setSelectedRole('')
                setSelectedLevel('')
                setError('')
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

          {/* Role Mode: Show Role and Level Selection */}
          {mode === 'role' && (
            <div className="space-y-8 animate-in slide-in-from-top duration-300">
              {/* Role Selection */}
              <div className="space-y-4">
                <h2 
                  className="text-2xl font-bold text-center"
                  style={{ color: 'var(--game-text-primary)' }}
                >
                  SELECT ROLE
                </h2>
                <div className="flex flex-wrap justify-center gap-3">
                  {roles.map((role) => (
                    <Button
                      key={role}
                      onClick={() => setSelectedRole(role)}
                      className="px-8 py-6 text-lg font-bold rounded-xl transform hover:scale-105 transition-all duration-200"
                      style={{
                        background: selectedRole === role
                          ? `linear-gradient(135deg, var(--game-cyan-dark), var(--game-cyan))`
                          : 'rgba(15, 10, 31, 0.8)',
                        border: `3px solid var(--game-cyan)`,
                        color: 'var(--game-text-primary)',
                        fontFamily: 'Impact, Arial Black, sans-serif',
                        textTransform: 'uppercase',
                        boxShadow: selectedRole === role
                          ? `0 0 20px var(--game-cyan-glow)`
                          : 'none'
                      }}
                    >
                      {role}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Level Selection */}
              <div className="space-y-4">
                <h2 
                  className="text-2xl font-bold text-center"
                  style={{ color: 'var(--game-text-primary)' }}
                >
                  SELECT LEVEL
                </h2>
                <div className="flex flex-wrap justify-center gap-3">
                  {levels.map((level) => (
                    <Button
                      key={level}
                      onClick={() => setSelectedLevel(level)}
                      className="px-8 py-6 text-lg font-bold rounded-xl transform hover:scale-105 transition-all duration-200"
                      style={{
                        background: selectedLevel === level
                          ? `linear-gradient(135deg, var(--game-red-dark), var(--game-red))`
                          : 'rgba(15, 10, 31, 0.8)',
                        border: `3px solid var(--game-red)`,
                        color: 'var(--game-text-primary)',
                        fontFamily: 'Impact, Arial Black, sans-serif',
                        textTransform: 'uppercase',
                        boxShadow: selectedLevel === level
                          ? `0 0 20px var(--game-red-glow)`
                          : 'none'
                      }}
                    >
                      {level}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Description Mode: Show Job Description Input */}
          {mode === 'description' && (
            <div className="animate-in slide-in-from-top duration-300">
              <Input
                type="text"
                placeholder="PASTE JOB DESCRIPTION"
                value={jobDescriptionText}
                onChange={(e) => setJobDescriptionText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleCreateLobby()}
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

          {error && (
            <div className="text-red-400 text-lg font-bold text-center animate-in slide-in-from-top duration-300">
              {error}
            </div>
          )}

          {/* Create Lobby Button */}
          <div className="flex justify-center pt-6">
            <Button 
              onClick={handleCreateLobby}
              disabled={
                isLoading || 
                !playerName?.trim() ||
                !mode ||
                (mode === 'role' && (!selectedRole?.trim() || !selectedLevel?.trim())) ||
                (mode === 'description' && !jobDescriptionText?.trim())
              }
              className="px-20 py-8 text-2xl font-bold rounded-2xl transform hover:scale-110 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: (
                  !isLoading && 
                  playerName.trim() &&
                  ((mode === 'role' && selectedRole && selectedLevel) ||
                   (mode === 'description' && jobDescriptionText.trim()))
                )
                  ? `linear-gradient(135deg, #00cc66, var(--game-green))`
                  : 'rgba(50, 50, 50, 0.5)',
                border: (
                  !isLoading && 
                  playerName.trim() &&
                  ((mode === 'role' && selectedRole && selectedLevel) ||
                   (mode === 'description' && jobDescriptionText.trim()))
                )
                  ? `3px solid var(--game-green)`
                  : '3px solid #555',
                color: 'var(--game-text-primary)',
                fontFamily: 'Impact, Arial Black, sans-serif',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                boxShadow: (
                  !isLoading && 
                  playerName.trim() &&
                  ((mode === 'role' && selectedRole && selectedLevel) ||
                   (mode === 'description' && jobDescriptionText.trim()))
                )
                  ? `0 0 20px rgba(0, 255, 136, 0.5)`
                  : 'none',
                cursor: (
                  !isLoading && 
                  playerName.trim() &&
                  ((mode === 'role' && selectedRole && selectedLevel) ||
                   (mode === 'description' && jobDescriptionText.trim()))
                ) ? 'pointer' : 'not-allowed'
              }}
            >
              {isLoading ? 'CREATING...' : 'CREATE LOBBY'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LobbySetup
