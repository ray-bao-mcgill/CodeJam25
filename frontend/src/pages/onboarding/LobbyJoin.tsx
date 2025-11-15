import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigate } from 'react-router-dom'
import { useLobby } from '@/hooks/useLobby'

const LobbyJoin: React.FC = () => {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [lobbyCode, setLobbyCode] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const { joinLobby } = useLobby()

  const handleJoin = async () => {
    if (!name.trim()) {
      setError('Please enter your name')
      return
    }
    
    setIsLoading(true)
    setError('')
    
    try {
      // If no lobby code, we need to handle random lobby join
      // For now, require a lobby code
      if (!lobbyCode.trim()) {
        setError('Please enter a lobby code or use CREATE LOBBY instead')
        setIsLoading(false)
        return
      }
      
      // Pass values directly to joinLobby (will save to sessionStorage on success)
      const result = await joinLobby(lobbyCode.trim(), name.trim())
      
      if (result?.success) {
        // Navigate to lobby-waiting after successful join
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

          {/* Mode Selection */}
          <div className="flex justify-center gap-8">
            <Button
              onClick={() => setLobbyCode('')}
              className="px-12 py-8 text-xl font-bold rounded-2xl transform hover:scale-105 transition-all duration-200"
              style={{
                background: !lobbyCode.trim()
                  ? `linear-gradient(135deg, var(--game-cyan-dark), var(--game-cyan))`
                  : 'rgba(15, 10, 31, 0.8)',
                border: `3px solid var(--game-cyan)`,
                color: 'var(--game-text-primary)',
                fontFamily: 'Impact, Arial Black, sans-serif',
                textTransform: 'uppercase',
                boxShadow: !lobbyCode.trim()
                  ? `0 0 20px var(--game-cyan-glow)`
                  : 'none'
              }}
            >
              RANDOM LOBBY
            </Button>

            <div className="w-96">
              <Input
                type="text"
                placeholder="ENTER LOBBY CODE"
                value={lobbyCode}
                onChange={(e) => {
                  setLobbyCode(e.target.value)
                  setError('')
                }}
                onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleJoin()}
                className="w-full text-center text-lg py-8 rounded-2xl font-bold"
                style={{
                  background: 'rgba(15, 10, 31, 0.8)',
                  border: `3px solid ${lobbyCode.trim() ? 'var(--game-red)' : '#555'}`,
                  color: 'var(--game-text-primary)',
                  fontFamily: 'Impact, Arial Black, sans-serif',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  boxShadow: lobbyCode.trim() ? `0 0 20px var(--game-red-glow)` : 'none',
                  transition: 'all 0.3s ease'
                }}
              />
            </div>
          </div>

          {error && (
            <div className="text-red-400 text-lg font-bold text-center animate-in slide-in-from-top duration-300">
              {error}
            </div>
          )}

          {/* Join Button */}
          <div className="flex justify-center pt-6">
            <Button 
              onClick={handleJoin}
              disabled={!name.trim() || !lobbyCode.trim() || isLoading}
              className="px-20 py-8 text-2xl font-bold rounded-2xl transform hover:scale-110 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: (name.trim() && lobbyCode.trim() && !isLoading)
                  ? `linear-gradient(135deg, #00cc66, var(--game-green))`
                  : 'rgba(50, 50, 50, 0.5)',
                border: (name.trim() && lobbyCode.trim() && !isLoading)
                  ? `3px solid var(--game-green)`
                  : '3px solid #555',
                color: 'var(--game-text-primary)',
                fontFamily: 'Impact, Arial Black, sans-serif',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                boxShadow: (name.trim() && lobbyCode.trim() && !isLoading)
                  ? `0 0 20px rgba(0, 255, 136, 0.5)`
                  : 'none',
                cursor: (name.trim() && lobbyCode.trim() && !isLoading) ? 'pointer' : 'not-allowed'
              }}
            >
              {isLoading ? 'JOINING...' : 'JOIN'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LobbyJoin
