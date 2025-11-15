import React from 'react'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'

const LobbyCreation: React.FC = () => {
  const navigate = useNavigate()

  const handleJoinLobby = () => {
    navigate('/lobby-join')
  }

  const handleCreateLobby = () => {
    navigate('/lobby-setup')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 game-bg">
      <div className="text-center space-y-20 w-full max-w-5xl">
        {/* Title with hand-drawn style */}
        <div className="relative inline-block">
          <div className="game-paper px-16 py-10 game-shadow-hard-lg game-hand-drawn">
            <h1 className="game-title text-7xl">
              CHOOSE MODE
            </h1>
          </div>
        </div>
        
        {/* Buttons with flat colors and hard shadows */}
        <div className="flex items-center justify-center gap-12 flex-wrap">
          <button
            className="game-sharp game-block-blue px-10 py-6 text-xl font-black uppercase tracking-widest game-shadow-hard-lg game-button-hover"
            style={{
              border: '6px solid var(--game-text-primary)',
              color: 'var(--game-text-white)',
              transform: 'rotate(-1deg)'
            }}
            onClick={handleJoinLobby}
          >
            JOIN LOBBY
          </button>
          
          {/* Label maker "OR" */}
          <div className="game-label-text text-3xl game-shadow-hard-sm">
            OR
          </div>
          
          <button
            className="game-sharp game-block-red px-10 py-6 text-xl font-black uppercase tracking-widest game-shadow-hard-lg game-button-hover"
            style={{
              border: '6px solid var(--game-text-primary)',
              color: 'var(--game-text-white)',
              transform: 'rotate(1deg)'
            }}
            onClick={handleCreateLobby}
          >
            CREATE LOBBY
          </button>
        </div>

        {/* Decorative sticky notes */}
        <div className="absolute top-32 left-8 game-sticky-note px-6 py-4 game-shadow-hard-sm opacity-85">
          <div className="text-sm font-bold uppercase">Note</div>
        </div>
        <div className="absolute bottom-32 right-8 game-sticky-note-alt px-6 py-4 game-shadow-hard-sm opacity-85">
          <div className="text-sm font-bold uppercase">Tip</div>
        </div>
      </div>
    </div>
  )
}

export default LobbyCreation






