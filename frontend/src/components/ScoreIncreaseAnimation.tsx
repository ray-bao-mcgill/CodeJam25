import React, { useEffect, useState, useRef } from 'react'
import './ScoreIncreaseAnimation.css'

interface ScoreIncreaseAnimationProps {
  scoreIncrease: number
  onComplete?: () => void
}

export const ScoreIncreaseAnimation: React.FC<ScoreIncreaseAnimationProps> = ({
  scoreIncrease,
  onComplete
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isShattering, setIsShattering] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const mousePosRef = useRef({ x: window.innerWidth / 2, y: 100 })

  useEffect(() => {
    if (scoreIncrease > 0) {
      setIsVisible(true)
      setIsShattering(false)
      
      // Position animation at center-top of screen initially
      if (containerRef.current) {
        containerRef.current.style.left = '50%'
        containerRef.current.style.top = '20%'
        containerRef.current.style.transform = 'translateX(-50%)'
      }
      
      // Trigger shatter on hover over scoreboard/store icon
      const handleMouseEnter = (e: MouseEvent) => {
        const target = e.target as HTMLElement
        if (target.closest('.score-display, .store-icon, .scoreboard')) {
          setIsShattering(true)
          // Move animation towards the target
          const targetElement = target.closest('.score-display')
          if (targetElement && containerRef.current) {
            const targetRect = targetElement.getBoundingClientRect()
            const targetX = targetRect.left + targetRect.width / 2
            const targetY = targetRect.top + targetRect.height / 2
            containerRef.current.style.left = `${targetX}px`
            containerRef.current.style.top = `${targetY}px`
            containerRef.current.style.transform = 'translate(-50%, -50%)'
          }
          setTimeout(() => {
            setIsVisible(false)
            setIsShattering(false)
            onComplete?.()
          }, 800) // Duration of shatter animation
        }
      }

      document.addEventListener('mouseenter', handleMouseEnter, true)
      
      // Auto-hide after 3 seconds if not shattered
      const autoHideTimer = setTimeout(() => {
        if (isVisible && !isShattering) {
          setIsVisible(false)
          onComplete?.()
        }
      }, 3000)

      return () => {
        document.removeEventListener('mouseenter', handleMouseEnter, true)
        clearTimeout(autoHideTimer)
      }
    }
  }, [scoreIncrease, isVisible, isShattering, onComplete])

  if (!isVisible || scoreIncrease <= 0) return null

  return (
    <div 
      ref={containerRef}
      className={`score-increase-animation ${isShattering ? 'shattering' : ''}`}
    >
      <div className="score-increase-content">
        <div className="score-plus">+</div>
        <div className="score-text">Score Increased</div>
        <div className="score-amount">+{scoreIncrease}</div>
      </div>
      {isShattering && (
        <div className="shatter-particles">
          {Array.from({ length: 20 }).map((_, i) => {
            const angle = (i * 18) * (Math.PI / 180) // Convert to radians
            const x = Math.cos(angle)
            const y = Math.sin(angle)
            return (
              <div
                key={i}
                className="particle"
                style={{
                  '--particle-index': i,
                  '--particle-x': x,
                  '--particle-y': y,
                  '--particle-delay': (i * 0.05) + 's',
                  animationDelay: (i * 0.05) + 's'
                } as React.CSSProperties}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// Hook to track score changes and trigger animations
export const useScoreIncreaseAnimation = (
  currentScores: Record<string, number>,
  previousScores: Record<string, number> | null
) => {
  const [animations, setAnimations] = useState<Array<{ playerId: string; increase: number; id: string }>>([])
  const animationIdRef = useRef(0)

  useEffect(() => {
    if (!previousScores || Object.keys(previousScores).length === 0) return

    const newAnimations: Array<{ playerId: string; increase: number; id: string }> = []
    
    Object.keys(currentScores).forEach(playerId => {
      const currentScore = currentScores[playerId] || 0
      const previousScore = previousScores[playerId] || 0
      const increase = currentScore - previousScore

      if (increase > 0) {
        animationIdRef.current += 1
        newAnimations.push({ 
          playerId, 
          increase,
          id: `${playerId}-${animationIdRef.current}-${Date.now()}`
        })
      }
    })

    if (newAnimations.length > 0) {
      setAnimations(prev => [...prev, ...newAnimations])
      // Clear animations after they complete
      setTimeout(() => {
        setAnimations([])
      }, 4000)
    }
  }, [currentScores, previousScores])

  return animations
}

