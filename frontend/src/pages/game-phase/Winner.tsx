import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const Winner: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const totalScore = parseInt(searchParams.get('score') || '0')
  const rank = parseInt(searchParams.get('rank') || '1')
  const [showConfetti, setShowConfetti] = useState(false)
  
  // You're only hired if you're ranked #1
  const isHired = rank === 1
  const resultText = isHired ? 'HIRED!' : 'FIRED!'

  // Play sound immediately when component renders
  const soundFile = isHired ? '/sounds/hired.mp3' : '/sounds/fired.mp3'
  const stampSound = new Audio(soundFile)
  stampSound.volume = 1.0
  
  // Trigger play attempt immediately
  stampSound.play().catch(err => {
    console.log('Audio play failed (browser may block autoplay):', err.message)
  })

  useEffect(() => {
    setShowConfetti(true)

    // Navigate to podium after showing result
    const navigationTimer = setTimeout(() => {
      navigate(`/podium?score=${totalScore}&rank=${rank}`)
    }, 4000) // Show winner screen for 4 seconds
    
    return () => {
      clearTimeout(navigationTimer)
      stampSound.pause()
      stampSound.currentTime = 0
    }
  }, [isHired, totalScore, rank, navigate])

  return (
    <div className="flex items-center justify-center min-h-screen game-bg relative overflow-hidden">
      {/* Confetti Effect - Only for Hired */}
      {showConfetti && isHired && (
        <div className="absolute inset-0 pointer-events-none z-20">
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
                  background: ['var(--game-yellow)', 'var(--game-blue)', 'var(--game-red)', 'var(--game-green)', '#ff6600'][Math.floor(Math.random() * 5)],
                  transform: `rotate(${Math.random() * 360}deg)`
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Winner Announcement */}
      <div className="relative z-10 text-center space-y-12">
        {/* Result Title - Stamp Style matching game aesthetic */}
        <div className="relative animate-stamp-in" style={{ animationDelay: '0.3s' }}>
          <div 
            className={`px-20 py-12 inline-block relative game-sharp game-shadow-hard-lg border-8 ${
              isHired ? 'bg-[var(--game-green)] border-[var(--game-text-primary)]' : 'bg-[var(--game-red)] border-[var(--game-text-primary)]'
            }`}
            style={{
              transform: 'rotate(-5deg)'
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
          <div className="game-label-text text-2xl game-shadow-hard-sm">
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
          <div className="game-label-text text-xl game-shadow-hard-sm">
            {isHired ? 'WELCOME TO THE TEAM!' : 'BETTER LUCK NEXT TIME'}
          </div>
        </div>
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
