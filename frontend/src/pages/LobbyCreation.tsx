import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigate } from 'react-router-dom'

const LobbyCreation: React.FC = () => {
  const navigate = useNavigate()
  const [lobbyCode, setLobbyCode] = useState('')
  const [showJoinInput, setShowJoinInput] = useState(false)

  const handleJoinLobby = () => {
    if (!showJoinInput) {
      setShowJoinInput(true)
      return
    }
    
    if (lobbyCode.trim()) {
      // TODO: Call API to join lobby with lobbyCode
      console.log('Joining lobby with code:', lobbyCode)
      navigate('/waiting-room')
    }
  }

  const handleCreateLobby = () => {
    // TODO: Call API to create a new lobby
    console.log('Creating new lobby')
    navigate('/waiting-room')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 game-bg">
      <div className="text-center space-y-16">
        <h1 
          className="text-7xl font-black tracking-widest game-text-glow-cyan"
          style={{ 
            fontFamily: 'Impact, Arial Black, sans-serif',
            color: 'var(--game-cyan)',
            textTransform: 'uppercase'
          }}
        >
          CHOOSE MODE
        </h1>
        
        <div className="flex flex-col items-center gap-10">
          <div className="flex items-center gap-8">
            <Button 
              size="lg"
              className="px-12 py-8 text-xl font-bold rounded-2xl transform hover:scale-110 transition-all duration-300 game-border-glow-cyan"
              style={{
                background: `linear-gradient(135deg, var(--game-cyan-dark), var(--game-cyan))`,
                border: `3px solid var(--game-cyan)`,
                color: 'var(--game-text-primary)',
                fontFamily: 'Impact, Arial Black, sans-serif',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
              onClick={handleJoinLobby}
            >
              JOIN LOBBY
            </Button>
            
            <span 
              className="text-4xl font-bold"
              style={{ color: 'var(--game-text-secondary)' }}
            >
              OR
            </span>
            
            <Button 
              size="lg"
              className="px-12 py-8 text-xl font-bold rounded-2xl transform hover:scale-110 transition-all duration-300 game-border-glow-red"
              style={{
                background: `linear-gradient(135deg, var(--game-red-dark), var(--game-red))`,
                border: `3px solid var(--game-red)`,
                color: 'var(--game-text-primary)',
                fontFamily: 'Impact, Arial Black, sans-serif',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
              onClick={handleCreateLobby}
            >
              CREATE LOBBY
            </Button>
          </div>
          
          {showJoinInput && (
            <div className="w-full max-w-md flex gap-4 animate-in slide-in-from-top duration-300">
              <Input
                type="text"
                placeholder="Enter lobby code..."
                value={lobbyCode}
                onChange={(e) => setLobbyCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinLobby()}
                className="text-center text-lg py-7 rounded-xl font-bold game-border-glow-cyan"
                style={{
                  background: 'rgba(15, 10, 31, 0.8)',
                  border: `2px solid var(--game-cyan)`,
                  color: 'var(--game-text-primary)',
                  fontFamily: 'Impact, Arial Black, sans-serif',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase'
                }}
                autoFocus
              />
              <Button 
                onClick={handleJoinLobby}
                disabled={!lobbyCode.trim()}
                className="px-10 py-7 text-lg font-bold rounded-xl transform hover:scale-105 transition-all duration-200"
                style={{
                  background: lobbyCode.trim() 
                    ? `linear-gradient(135deg, #00cc66, var(--game-green))` 
                    : '#333',
                  border: lobbyCode.trim() 
                    ? `2px solid var(--game-green)` 
                    : '2px solid #555',
                  color: 'var(--game-text-primary)',
                  fontFamily: 'Impact, Arial Black, sans-serif',
                  textTransform: 'uppercase',
                  boxShadow: lobbyCode.trim() 
                    ? `0 0 20px rgba(0, 255, 136, 0.5)` 
                    : 'none'
                }}
              >
                JOIN
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default LobbyCreation






