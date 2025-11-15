import React from 'react'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'

const LobbyCreation: React.FC = () => {
  const navigate = useNavigate()

  const handleJoinLobby = () => {
    navigate('/lobby-join')
  }

  const handleCreateLobby = () => {
    navigate('/job-input')
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
        
        <div className="flex items-center justify-center gap-8">
          <Button 
            size="lg"
            className="px-12 py-8 text-xl font-bold rounded-2xl transform hover:scale-110 transition-all duration-300 game-border-glow-cyan"
            style={{
              background: `linear-gradient(135deg, var(--game-cyan-dark), var(--game-cyan))`,
              border: `3px solid var(--game-cyan)`,
              color: 'var(--game-text-primary)',
              fontFamily: 'Impact, Arial Black, sans-serif',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              boxShadow: `0 0 20px var(--game-cyan-glow)`
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
              letterSpacing: '0.05em',
              boxShadow: `0 0 20px var(--game-red-glow)`
            }}
            onClick={handleCreateLobby}
          >
            CREATE LOBBY
          </Button>
        </div>
      </div>
    </div>
  )
}

export default LobbyCreation






