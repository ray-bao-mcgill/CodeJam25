import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLobby } from '@/hooks/useLobby'

const LobbyJoin: React.FC = () => {
  const navigate = useNavigate()
  const { lobbyId: urlLobbyId } = useParams<{ lobbyId?: string }>()
  const [name, setName] = useState('')
  const [lobbyCode, setLobbyCode] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showKickedNotification, setShowKickedNotification] = useState(false)

  const { joinLobby } = useLobby()

  // Store lobby ID from URL parameter (but don't display it)
  // The lobby code state is only used for manual entry

  // Check if user was kicked when component mounts
  useEffect(() => {
    const wasKicked = sessionStorage.getItem('wasKicked') === 'true'
    if (wasKicked) {
      setShowKickedNotification(true)
      // Clear the flag
      sessionStorage.removeItem('wasKicked')
      // Auto-hide after 5 seconds
      setTimeout(() => {
        setShowKickedNotification(false)
      }, 5000)
    }
  }, [])


  const handleJoin = async () => {
    if (!name.trim()) {
      setError('Please enter your name')
      return
    }
    
    setIsLoading(true)
    setError('')
    
    try {
      // Use URL lobby ID if available, otherwise use entered code
      const lobbyIdToUse = urlLobbyId || lobbyCode.trim()
      
      if (!lobbyIdToUse) {
        setError('Please enter a lobby code or use CREATE LOBBY instead')
        setIsLoading(false)
        return
      }
      
      const result = await joinLobby(lobbyIdToUse, name.trim())
      
      if (result?.success) {
        setTimeout(() => {
          navigate('/lobby-waiting', { replace: true })
        }, 100)
      } else {
        setError(result?.error || 'Failed to join lobby')
        setIsLoading(false)
      }
    } catch (err) {
      setError('Failed to join lobby')
      console.error('Error:', err)
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 game-bg relative">
      {/* Kicked Notification */}
      {showKickedNotification && (
        <div
          className="fixed top-4 right-4 z-50 game-sticky-note px-6 py-4 game-shadow-hard-lg"
          style={{
            animation: 'fadeIn 0.3s ease-out',
            maxWidth: '350px',
            backgroundColor: '#dc2626', // Bright red background
            color: '#ffffff', // White text for contrast
            border: '4px solid #000000', // Thick black border
            transform: 'rotate(1deg)'
          }}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl flex-shrink-0">🚫</span>
            <div className="text-base font-black uppercase flex-1">
              YOU WERE KICKED FROM THE LOBBY
            </div>
            <button
              onClick={() => setShowKickedNotification(false)}
              className="text-sm font-black flex-shrink-0 hover:opacity-70 transition-opacity"
              style={{ color: '#ffffff' }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Back Button - Fixed to top left of screen */}
      <button
        onClick={() => navigate('/lobby-creation')}
        className="fixed top-4 left-4 z-50 game-sharp px-4 py-2 text-sm font-black uppercase tracking-wider game-shadow-hard-sm game-button-hover"
        style={{
          background: '#ff6600',
          border: '3px solid var(--game-text-primary)',
          color: '#fff'
        }}
      >
        BACK
      </button>

      <div className="w-full max-w-3xl space-y-16 relative">
        {/* Title */}
        <div className="text-center">
          <div className="px-12 py-8 game-shadow-hard-lg game-hand-drawn inline-block"
            style={{
              backgroundColor: '#ffe63b',
              border: '6px solid var(--game-text-primary)',
              transform: 'rotate(-2deg)'
            }}
          >
            <h1 className="game-title text-4xl">
              JOIN LOBBY
            </h1>
          </div>
        </div>
        
        <div className="space-y-12">
          {/* Name Input - Label maker style */}
          <div className="space-y-4 flex flex-col items-center">
            <div className="text-lg font-bold" style={{ color: 'var(--game-text-primary)' }}>YOUR NAME</div>
            <input
              type="text"
              placeholder="ENTER YOUR NAME"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError('')
              }}
              autoComplete="name"
              data-form-type="other"
              className="game-sharp game-paper max-w-xs w-full text-center text-xl py-4 px-4 font-black uppercase tracking-widest game-shadow-hard"
              style={{
                border: '6px solid var(--game-text-primary)',
                color: 'var(--game-text-primary)',
                letterSpacing: '0.15em',
                fontFamily: 'Impact, sans-serif'
              }}
            />
          </div>

          {/* Lobby Code Input - Only show if not coming from invite link */}
          {!urlLobbyId && (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-6 flex-wrap">
                <button
                  onClick={() => setLobbyCode('')}
                  className={`game-sharp px-8 py-4 text-xl font-black uppercase tracking-widest game-shadow-hard-lg game-button-hover ${
                    !lobbyCode.trim() ? 'game-block-blue' : 'game-paper'
                  }`}
                  style={{
                    border: '6px solid var(--game-text-primary)',
                    color: !lobbyCode.trim() ? 'var(--game-text-white)' : 'var(--game-text-primary)'
                  }}
                >
                  RANDOM
                </button>
                
                <div className="text-3xl font-black self-center" style={{ color: 'var(--game-text-primary)', fontFamily: 'Impact, sans-serif' }}>OR</div>
                
                <input
                  type="text"
                  placeholder="ENTER CODE"
                  value={lobbyCode}
                  onChange={(e) => {
                    setLobbyCode(e.target.value.toUpperCase())
                    setError('')
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleJoin()}
                  autoComplete="off"
                  data-form-type="other"
                  data-lpignore="true"
                  className={`game-sharp text-center text-xl px-6 py-4 font-black uppercase tracking-widest game-shadow-hard-lg game-button-hover ${
                    lobbyCode.trim() ? 'game-block-red' : 'game-paper'
                  }`}
                  style={{
                    border: '6px solid var(--game-text-primary)',
                    color: lobbyCode.trim() ? 'var(--game-text-white)' : 'var(--game-text-primary)',
                    letterSpacing: '0.15em',
                    fontFamily: 'Impact, sans-serif',
                    width: '220px'
                  }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="game-sticky-note px-6 py-4 game-shadow-hard-sm">
              <div className="text-lg font-black uppercase text-red-600">
                {error}
              </div>
            </div>
          )}

          {/* Join Button */}
          <div className="flex justify-center pt-4">
            <button
              onClick={handleJoin}
              disabled={!name.trim() || (!urlLobbyId && !lobbyCode.trim()) || isLoading}
              className={`game-sharp px-12 py-6 text-xl font-black uppercase tracking-widest game-shadow-hard-lg ${
                (name.trim() && (urlLobbyId || lobbyCode.trim()) && !isLoading) 
                  ? 'game-block-green game-button-hover' 
                  : ''
              }`}
              style={{
                border: '8px solid var(--game-text-primary)',
                backgroundColor: (name.trim() && (urlLobbyId || lobbyCode.trim()) && !isLoading) 
                  ? 'var(--game-green)' 
                  : '#9ca3af',
                color: (name.trim() && (urlLobbyId || lobbyCode.trim()) && !isLoading) 
                  ? 'var(--game-text-white)' 
                  : '#6b7280',
                letterSpacing: '0.15em',
                cursor: (name.trim() && (urlLobbyId || lobbyCode.trim()) && !isLoading) ? 'pointer' : 'not-allowed'
              }}
            >
              {isLoading ? 'JOINING...' : 'JOIN'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LobbyJoin
