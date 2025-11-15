import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const WinLose: React.FC = () => {
  const navigate = useNavigate()
  const [showButtons, setShowButtons] = useState(false)
  const [result, setResult] = useState<'HIRE' | 'FIRE' | null>(null)

  useEffect(() => {
    // Determine result (for now, default to HIRE - you can get this from props/state later)
    setResult('HIRE') // TODO: Get actual result from game state
    
    // Start animation sequence: shrink logo, then show buttons
    const timer = setTimeout(() => {
      setShowButtons(true)
    }, 1500) // Wait for shrink animation to complete
    
    return () => clearTimeout(timer)
  }, [])

  const handlePlayAgain = () => {
    navigate('/lobby-creation')
  }

  const handleViewAnalytics = () => {
    // Navigate to analytics page
    navigate('/analytics')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 game-bg">
      <div className="text-center space-y-16">
        {/* HIRE or FIRE Logo - Shrinks cartoonishly */}
        <div 
          className={`game-paper px-16 py-10 game-shadow-hard-lg game-hand-drawn inline-block transition-all duration-1000 ease-in-out ${
            showButtons ? 'shrink-logo' : ''
          }`}
          style={{
            transform: showButtons ? 'scale(0.3)' : 'scale(1)',
            opacity: showButtons ? 0.3 : 1,
            transition: 'transform 1s cubic-bezier(0.68, -0.55, 0.265, 1.55), opacity 1s ease-out'
          }}
        >
          <h1 className="game-title text-7xl sm:text-8xl">
            {result || 'HIRE'}
          </h1>
        </div>

        {/* Buttons - Pop up cartoonishly */}
        {showButtons && (
          <div className="flex items-center justify-center gap-12 flex-wrap pop-up-buttons">
            <button
              className="game-sharp game-block-blue px-10 py-6 text-xl font-black uppercase tracking-widest game-shadow-hard-lg game-button-hover button-pop"
              style={{
                border: '6px solid var(--game-text-primary)',
                color: 'var(--game-text-white)',
                transform: 'rotate(-1deg)',
                animation: 'popIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) 0.2s both'
              }}
              onClick={handlePlayAgain}
            >
              PLAY AGAIN
            </button>
            
            <button
              className="game-sharp game-block-red px-10 py-6 text-xl font-black uppercase tracking-widest game-shadow-hard-lg game-button-hover button-pop"
              style={{
                border: '6px solid var(--game-text-primary)',
                color: 'var(--game-text-white)',
                transform: 'rotate(1deg)',
                animation: 'popIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) 0.4s both'
              }}
              onClick={handleViewAnalytics}
            >
              VIEW ANALYTICS
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default WinLose


