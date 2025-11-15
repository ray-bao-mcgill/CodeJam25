import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const [nameFieldExpanded, setNameFieldExpanded] = useState(false)
  const [showCustomRoleInput, setShowCustomRoleInput] = useState(false)
  const [customRoleText, setCustomRoleText] = useState('')
  const [customRoles, setCustomRoles] = useState<string[]>([])

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

  const defaultRoles = ['Frontend', 'Backend', 'Full Stack', 'DevOps', 'Mobile']
  const roles = [...defaultRoles, ...customRoles]
  const levels = ['Intern', 'Junior', 'Mid-Level', 'Senior', 'Lead']

  const handleCustomRoleConfirm = () => {
    const trimmedRole = customRoleText.trim()
    if (trimmedRole && !defaultRoles.includes(trimmedRole) && !customRoles.includes(trimmedRole)) {
      setCustomRoles([...customRoles, trimmedRole])
      setSelectedRole(trimmedRole)
      setCustomRoleText('')
      setShowCustomRoleInput(false)
    }
  }

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
      setError('Please select either Role or Job Posting mode')
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
        setError('Please enter a job posting link')
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
    <div className="flex flex-col min-h-screen p-6 game-bg relative overflow-hidden">
      {/* Back Button - Fixed to top left of screen */}
      <button
        onClick={() => navigate('/lobby-creation')}
        className="fixed top-4 left-4 z-50 game-sharp game-paper px-4 py-2 text-sm font-black uppercase tracking-wider game-shadow-hard-sm game-button-hover"
        style={{
          border: '3px solid var(--game-text-primary)',
          color: 'var(--game-text-primary)',
          transform: 'rotate(-1deg)'
        }}
      >
        ← BACK
      </button>

      <div className="w-full max-w-6xl mx-auto relative" style={{ minHeight: 'calc(100vh - 3rem)', paddingBottom: '100px' }}>
        {/* Title - Centered */}
        <div className="relative z-10 flex justify-center mb-6">
          <div className="game-paper px-12 py-8 game-shadow-hard-lg game-hand-drawn inline-block">
            <h1 className="game-title text-4xl">
              CREATE LOBBY
            </h1>
          </div>
        </div>
        
        {/* Name Input - Centered, stays in place */}
        <div 
          className={`flex flex-col items-center mb-6 ${nameFieldExpanded ? 'expanded' : ''}`}
          onClick={() => {
            if (mode && !nameFieldExpanded) {
              setNameFieldExpanded(true)
            }
          }}
        >
          <div 
            className="game-label-text text-lg block mb-2"
          >
            YOUR NAME
          </div>
          <input
            type="text"
            placeholder="ENTER YOUR NAME"
            value={playerName}
            onChange={(e) => {
              setPlayerNameLocal(e.target.value)
              setError('')
            }}
            onBlur={() => {
              if (mode && nameFieldExpanded) {
                setNameFieldExpanded(false)
              }
            }}
            className="game-sharp game-paper font-black uppercase tracking-widest game-shadow-hard px-4 text-xl py-4 max-w-xs text-center block"
            style={{
              border: '6px solid var(--game-text-primary)',
              color: 'var(--game-text-primary)',
              letterSpacing: '0.15em',
              cursor: 'text'
            }}
            autoFocus={nameFieldExpanded}
          />
        </div>

        {/* Mode Selection */}
        <div className="flex justify-center gap-6 flex-wrap lobby-setup-mode-buttons">
            <button
              onClick={() => {
                setMode('role')
                setJobDescriptionText('')
                setError('')
                setNameFieldExpanded(false)
                setShowCustomRoleInput(false)
                setCustomRoleText('')
              }}
              className={`game-sharp px-6 py-4 text-base font-black uppercase tracking-widest game-shadow-hard-lg game-button-hover ${
                mode === 'role' ? 'game-block-blue' : 'game-paper'
              }`}
              style={{
                border: '6px solid var(--game-text-primary)',
                color: mode === 'role' ? 'var(--game-text-white)' : 'var(--game-text-primary)',
                transform: 'rotate(-1deg)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              ROLE
            </button>

            <div className="game-label-text text-lg">OR</div>

            <button
              onClick={() => {
                setMode('description')
                setSelectedRole('')
                setSelectedLevel('')
                setError('')
                setNameFieldExpanded(false)
                setShowCustomRoleInput(false)
                setCustomRoleText('')
              }}
              className={`game-sharp px-6 py-4 text-base font-black uppercase tracking-widest game-shadow-hard-lg game-button-hover ${
                mode === 'description' ? 'game-block-red' : 'game-paper'
              }`}
              style={{
                border: '6px solid var(--game-text-primary)',
                color: mode === 'description' ? 'var(--game-text-white)' : 'var(--game-text-primary)',
                transform: 'rotate(1deg)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              JOB POSTING
            </button>
          </div>

          {/* Role Mode: Show Role and Level Selection - Row by row */}
          {mode === 'role' && (
            <div className="mt-6 space-y-4">
              {/* Role Selection Row */}
              <div className="lobby-setup-row" style={{ animationDelay: '0.2s' }}>
                <div className="game-label-text text-sm text-center mb-2" style={{ animation: 'fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) 0.2s forwards', opacity: 0 }}>SELECT ROLE</div>
                <div className="flex flex-wrap justify-center gap-2 items-center">
                  {defaultRoles.map((role, idx) => (
                    <button
                      key={role}
                      onClick={() => {
                        setSelectedRole(role)
                        setShowCustomRoleInput(false)
                      }}
                      className="game-sharp px-4 py-2.5 text-xs font-black uppercase tracking-wider game-shadow-hard-sm game-button-hover"
                      style={{
                        border: '4px solid var(--game-text-primary)',
                        color: selectedRole === role ? 'var(--game-text-white)' : 'var(--game-text-primary)',
                        background: selectedRole === role ? 'var(--game-blue)' : 'var(--game-bg-alt)',
                        transform: `rotate(${idx % 2 === 0 ? '-0.5deg' : '0.5deg'})`,
                        animation: 'fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards',
                        opacity: 0,
                        animationDelay: `${0.3 + idx * 0.03}s`,
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {role}
                    </button>
                  ))}
                  {customRoles.map((role, idx) => (
                    <button
                      key={`custom-${role}`}
                      onClick={() => {
                        setSelectedRole(role)
                        setShowCustomRoleInput(false)
                      }}
                      className="game-sharp px-4 py-2.5 text-xs font-black uppercase tracking-wider game-shadow-hard-sm game-button-hover"
                      style={{
                        border: '4px solid var(--game-text-primary)',
                        color: selectedRole === role ? 'var(--game-text-white)' : 'var(--game-text-primary)',
                        background: selectedRole === role ? 'var(--game-blue)' : 'var(--game-bg-alt)',
                        transform: `rotate(${(defaultRoles.length + idx) % 2 === 0 ? '-0.5deg' : '0.5deg'})`,
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {role}
                    </button>
                  ))}
                  {!showCustomRoleInput ? (
                    <button
                      onClick={() => {
                        setShowCustomRoleInput(true)
                        setSelectedRole('')
                      }}
                      className="game-sharp px-4 py-2.5 text-xs font-black uppercase tracking-wider game-shadow-hard-sm game-button-hover"
                      style={{
                        border: '4px solid var(--game-text-primary)',
                        color: 'var(--game-text-primary)',
                        background: 'var(--game-bg-alt)',
                        transform: 'rotate(0.5deg)',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      + CUSTOM ROLE
                    </button>
                  ) : (
                    <div className="flex items-center gap-2" style={{ transform: 'rotate(-0.3deg)' }}>
                      <input
                        type="text"
                        placeholder="Enter role name"
                        value={customRoleText}
                        onChange={(e) => setCustomRoleText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && customRoleText.trim()) {
                            handleCustomRoleConfirm()
                          } else if (e.key === 'Escape') {
                            setShowCustomRoleInput(false)
                            setCustomRoleText('')
                          }
                        }}
                        className="game-sharp px-4 py-2.5 text-xs font-black uppercase tracking-wider"
                        style={{
                          border: 'none',
                          background: 'white',
                          color: 'var(--game-text-primary)',
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                          outline: 'none',
                          minWidth: '150px',
                          caretColor: 'var(--game-text-primary)'
                        }}
                        autoFocus
                      />
                      <button
                        onClick={handleCustomRoleConfirm}
                        disabled={!customRoleText.trim()}
                        className="game-sharp flex items-center justify-center w-8 h-8"
                        style={{
                          border: 'none',
                          background: customRoleText.trim() ? 'var(--game-blue)' : 'var(--game-bg-alt)',
                          color: 'white',
                          cursor: customRoleText.trim() ? 'pointer' : 'not-allowed',
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                          transition: 'all 0.2s ease',
                          opacity: customRoleText.trim() ? 1 : 0.5
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M13.5 4.5L6 12L2.5 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Level Selection Row */}
              <div className="lobby-setup-row" style={{ animationDelay: '0.5s' }}>
                <div className="game-label-text text-sm text-center mb-2" style={{ animation: 'fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) 0.5s forwards', opacity: 0 }}>SELECT LEVEL</div>
                <div className="flex flex-wrap justify-center gap-2">
                  {levels.map((level, idx) => (
                    <button
                      key={level}
                      onClick={() => setSelectedLevel(level)}
                      className={`game-sharp px-3 py-2 text-xs font-black uppercase tracking-wider game-shadow-hard-sm game-button-hover`}
                      style={{
                        border: '4px solid var(--game-text-primary)',
                        color: selectedLevel === level ? 'var(--game-text-white)' : 'var(--game-text-primary)',
                        background: selectedLevel === level ? 'var(--game-red)' : 'var(--game-bg-alt)',
                        transform: `rotate(${idx % 2 === 0 ? '0.5deg' : '-0.5deg'})`,
                        animation: 'fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards',
                        opacity: 0,
                        animationDelay: `${0.6 + idx * 0.03}s`
                      }}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Description Mode: Show Job Posting Input */}
          {mode === 'description' && (
            <div className="mt-6 lobby-setup-row">
              <div 
                className="game-label-text text-sm mb-2"
                style={{ 
                  animation: 'fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) 0.2s forwards',
                  opacity: 0
                }}
              >
                PASTE JOB POSTING LINK
              </div>
              <textarea
                placeholder="PASTE JOB POSTING LINK HERE (e.g., https://example.com/job-posting)..."
                value={jobDescriptionText}
                onChange={(e) => setJobDescriptionText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && e.ctrlKey && !isLoading && handleCreateLobby()}
                className="game-sharp game-paper w-full text-left text-sm py-3 px-4 font-bold game-shadow-hard"
                style={{
                  border: '6px solid var(--game-text-primary)',
                  color: 'var(--game-text-primary)',
                  height: '100px',
                  resize: 'none',
                  animation: 'fadeInUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) 0.3s forwards',
                  opacity: 0
                }}
                autoFocus
              />
            </div>
          )}

          {/* Create Lobby Button - Fixed bottom */}
          <div className="absolute bottom-6 left-0 right-0 flex justify-center">
            <button
              onClick={handleCreateLobby}
              disabled={
                isLoading || 
                !playerName?.trim() ||
                !mode ||
                (mode === 'role' && (!selectedRole?.trim() || !selectedLevel?.trim())) ||
                (mode === 'description' && !jobDescriptionText?.trim())
              }
              className={`game-sharp px-10 py-4 text-lg font-black uppercase tracking-widest game-shadow-hard-lg game-button-hover ${
                (!isLoading && 
                 playerName.trim() &&
                 ((mode === 'role' && selectedRole && selectedLevel) ||
                  (mode === 'description' && jobDescriptionText.trim())))
                  ? 'game-block-green' : 'game-paper'
              }`}
              style={{
                border: '6px solid var(--game-text-primary)',
                color: (!isLoading && 
                        playerName.trim() &&
                        ((mode === 'role' && selectedRole && selectedLevel) ||
                         (mode === 'description' && jobDescriptionText.trim())))
                  ? 'var(--game-text-white)' : 'var(--game-text-dim)',
                letterSpacing: '0.15em',
                cursor: (!isLoading && 
                        playerName.trim() &&
                        ((mode === 'role' && selectedRole && selectedLevel) ||
                         (mode === 'description' && jobDescriptionText.trim())))
                  ? 'pointer' : 'not-allowed',
                opacity: (isLoading || 
                         !playerName?.trim() ||
                         !mode ||
                         (mode === 'role' && (!selectedRole?.trim() || !selectedLevel?.trim())) ||
                         (mode === 'description' && !jobDescriptionText?.trim()))
                  ? 0.5 : 1
              }}
            >
              {isLoading ? 'CREATING...' : 'CREATE LOBBY'}
            </button>
          </div>

          {error && (
            <div className="absolute top-24 left-1/2 transform -translate-x-1/2 game-sticky-note px-4 py-3 game-shadow-hard-sm z-20">
              <div className="text-sm font-black uppercase text-red-600">
                ⚠️ {error}
              </div>
            </div>
          )}
        </div>
      </div>
  )
}

export default LobbySetup
