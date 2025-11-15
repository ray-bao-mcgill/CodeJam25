import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const Winner: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const totalScore = parseInt(searchParams.get('score') || '0')
  const [showConfetti, setShowConfetti] = useState(false)
  
  // Determine if hired or fired based on score (threshold: 3000 points)
  const isHired = totalScore >= 3000
  const resultText = isHired ? 'HIRED!' : 'FIRED!'

  useEffect(() => {
    setShowConfetti(true)
    
    // Play different sound effect based on hired/fired with delay to match animation
    const timer = setTimeout(() => {
      try {
        const soundFile = isHired ? '/sounds/hired.mp3' : '/sounds/fired.mp3'
        const stampSound = new Audio(soundFile)
        stampSound.volume = 1.0
        
        // Try to play, handle browser autoplay restrictions
        const playPromise = stampSound.play()
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('Sound played successfully')
            })
            .catch(err => {
              console.log('Audio play failed (browser may block autoplay):', err.message)
            })
        }
      } catch (error) {
        console.error('Error creating audio:', error)
      }
    }, 300) // Matches the stamp animation delay
    
    return () => clearTimeout(timer)
  }, [isHired])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 game-bg relative overflow-hidden">
      {/* Confetti Effect - Only for Hired */}
      {showConfetti && isHired && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-fall"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-${Math.random() * 20}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${3 + Math.random() * 2}s`
              }}
            >
              <div
                className="w-4 h-4 game-sharp"
                style={{
                  background: ['var(--game-yellow)', 'var(--game-blue)', 'var(--game-red)', 'var(--game-green)', 'var(--game-orange)'][Math.floor(Math.random() * 5)],
                  transform: `rotate(${Math.random() * 360}deg)`
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Winner Announcement */}
      <div className="relative z-10 text-center space-y-12">
        {/* Result Title - Stamp Style */}
        <div className="relative animate-stamp-in" style={{ animationDelay: '0.3s' }}>
          <div 
            className="px-20 py-12 inline-block relative"
            style={{
              backgroundColor: isHired ? 'var(--game-green)' : 'var(--game-red)',
              border: `8px solid ${isHired ? 'var(--game-green)' : 'var(--game-red)'}`,
              transform: 'rotate(-5deg)',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
            }}
          >
            <h1 
              className="font-black text-white"
              style={{ 
                fontSize: '6rem',
                lineHeight: '1',
                fontFamily: 'Impact, sans-serif',
                letterSpacing: '0.1em',
                textTransform: 'uppercase'
              }}
            >
              {resultText}
            </h1>
          </div>
        </div>

        {/* Total Score Display */}
        <div className="space-y-4 animate-stamp-in" style={{ animationDelay: '0.8s' }}>
          <div className="game-label-text text-2xl game-shadow-hard-sm inline-block">
            FINAL SCORE
          </div>
          <div 
            className="text-9xl font-black game-shadow-hard"
            style={{ 
              color: isHired ? 'var(--game-green)' : 'var(--game-red)',
              fontFamily: 'Impact, sans-serif',
              textTransform: 'uppercase'
            }}
          >
            {totalScore}
          </div>
          <div className="game-label-text text-xl game-shadow-hard-sm inline-block">
            {isHired ? 'WELCOME TO THE TEAM!' : 'BETTER LUCK NEXT TIME'}
          </div>
        </div>

        {/* View Analytics Button */}
        <button
          onClick={() => navigate('/analytics')}
          className="game-sharp game-block-blue px-16 py-6 text-2xl font-black uppercase tracking-widest game-shadow-hard-lg game-button-hover animate-fade-in-up"
          style={{
            border: '6px solid var(--game-text-primary)',
            color: 'var(--game-text-white)',
            letterSpacing: '0.15em',
            marginTop: '3rem',
            animationDelay: '1.8s'
          }}
        >
          VIEW ANALYTICS
        </button>
      </div>

      <style>{`
        @keyframes fall {
          to {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0;
          }
        }
        .animate-fall {
          animation: fall linear infinite;
        }
      `}</style>
    </div>
  )
}

export default Winner
