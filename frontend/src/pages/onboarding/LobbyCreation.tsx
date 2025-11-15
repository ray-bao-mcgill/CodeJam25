import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'

const LobbyCreation: React.FC = () => {
  const navigate = useNavigate()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Reset visibility state and trigger fade in on mount
    setIsVisible(false)
    // Small delay to ensure initial state is rendered before animation
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, 10)
    return () => clearTimeout(timer)
  }, [])

  const handleJoinLobby = () => {
    setIsVisible(false)
    setTimeout(() => {
      navigate('/lobby-join')
    }, 1000) // Wait for shrink/fade animation to complete
  }

  const handleCreateLobby = () => {
    setIsVisible(false)
    setTimeout(() => {
      navigate('/lobby-setup')
    }, 1000) // Wait for shrink/fade animation to complete
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 game-bg">
      <div className="text-center space-y-20 w-full max-w-5xl relative">
        {/* Title with hand-drawn style - shrinks with bounce */}
        <div 
          className="relative inline-block transition-all duration-1000"
          style={{
            transform: isVisible ? 'scale(1)' : 'scale(0.3)',
            opacity: isVisible ? 1 : 0,
            transition: 'transform 1s cubic-bezier(0.68, -0.55, 0.265, 1.55), opacity 1s ease-out'
          }}
        >
          <div className="game-paper px-16 py-10 game-shadow-hard-lg game-hand-drawn">
            <h1 className="game-title text-7xl">
              GAME SETUP
            </h1>
          </div>
        </div>
        
        {/* Buttons with flat colors and hard shadows - shrink with bounce */}
        <div 
          className="flex items-center justify-center gap-12 flex-wrap transition-all duration-1000"
          style={{
            transform: isVisible ? 'scale(1)' : 'scale(0.3)',
            opacity: isVisible ? 1 : 0,
            transition: 'transform 1s cubic-bezier(0.68, -0.55, 0.265, 1.55), opacity 1s ease-out'
          }}
        >
          <button
            className="game-sharp game-block-blue px-10 py-6 text-xl font-black uppercase tracking-widest game-shadow-hard-lg game-button-hover"
            style={{
              border: '6px solid var(--game-text-primary)',
              color: 'var(--game-text-white)',
              transform: 'rotate(-1deg)'
            }}
            onClick={handleJoinLobby}
            disabled={!isVisible}
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
            disabled={!isVisible}
          >
            CREATE LOBBY
          </button>
        </div>

        {/* Decorative sticky notes - shrink with bounce */}
        <div 
          className="absolute top-32 left-8 game-sticky-note px-6 py-4 game-shadow-hard-sm opacity-85 transition-all duration-1000"
          style={{
            transform: isVisible ? 'scale(1)' : 'scale(0.3)',
            opacity: isVisible ? 0.85 : 0,
            transition: 'transform 1s cubic-bezier(0.68, -0.55, 0.265, 1.55), opacity 1s ease-out'
          }}
        >
          <div className="text-sm font-bold uppercase">Note</div>
        </div>
        <div 
          className="absolute bottom-32 right-8 game-sticky-note-alt px-6 py-4 game-shadow-hard-sm opacity-85 transition-all duration-1000"
          style={{
            transform: isVisible ? 'scale(1)' : 'scale(0.3)',
            opacity: isVisible ? 0.85 : 0,
            transition: 'transform 1s cubic-bezier(0.68, -0.55, 0.265, 1.55), opacity 1s ease-out'
          }}
        >
          <div className="text-sm font-bold uppercase">Tip</div>
        </div>
      </div>
    </div>
  )
}

export default LobbyCreation






