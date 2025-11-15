import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameFlow } from '@/hooks/useGameFlow'
import { useLobby } from '@/hooks/useLobby'
import { useGameSync } from '@/hooks/useGameSync'

const CurrentScore: React.FC = () => {
  const navigate = useNavigate()
  const { gameState, proceedToNextPhase } = useGameFlow()
  const { lobby } = useLobby()
  const { showResults: syncShowResults } = useGameSync()
  const [scores, setScores] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isVisible, setIsVisible] = useState(false)
  const [waitingForSync, setWaitingForSync] = useState(true)
  
  // Determine phase from sessionStorage or gameState
  const getCurrentPhase = (): string => {
    // Check sessionStorage for current round
    const currentRound = sessionStorage.getItem('currentRound') || 'behavioural'
    
    if (currentRound === 'behavioural') {
      return 'behavioural_score'
    } else if (currentRound === 'quickfire') {
      return 'quickfire_score'
    } else if (currentRound === 'technical') {
      return 'technical_score'
    }
    
    // Fallback to gameState
    if (gameState.phase.includes('score')) {
      return gameState.phase
    }
    
    return 'behavioural_score'
  }
  
  const currentPhase = getCurrentPhase()

  useEffect(() => {
    setIsVisible(false)
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, 10)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    // Wait for synchronization before showing scores
    if (syncShowResults) {
      setWaitingForSync(false)
      // TODO: Fetch actual scores from backend API
      // For now, use placeholder scores
      setTimeout(() => {
        const placeholderScores: Record<string, number> = {}
        if (lobby?.players) {
          lobby.players.forEach((player) => {
            placeholderScores[player.id] = Math.floor(Math.random() * 50) + 50
          })
        }
        setScores(placeholderScores)
        setIsLoading(false)
      }, 1000)
    }
  }, [syncShowResults, lobby])

  const handleContinue = () => {
    // Navigate based on current phase
    if (currentPhase === 'behavioural_score') {
      sessionStorage.setItem('currentRound', 'quickfire')
      navigate('/quickfire-round')
    } else if (currentPhase === 'quickfire_score') {
      sessionStorage.setItem('currentRound', 'technical')
      navigate('/technical-theory')
    } else if (currentPhase === 'technical_score') {
      sessionStorage.removeItem('currentRound')
      navigate('/win-lose')
    } else {
      proceedToNextPhase()
    }
  }

  if (waitingForSync || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 game-bg">
        <div className="game-paper px-8 py-6 game-shadow-hard-lg">
          <div className="text-center space-y-4">
            <div className="text-2xl font-black mb-4">WAITING FOR OTHER PLAYERS...</div>
            <div className="text-lg">
              {waitingForSync 
                ? 'Synchronizing results with other players...' 
                : 'Calculating scores...'}
            </div>
            {lobby?.players && (
              <div className="text-sm text-gray-600 mt-4">
                Players: {lobby.players.length}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Sort players by score (descending)
  const sortedPlayers = lobby?.players
    ? [...lobby.players].sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0))
    : []

  const getPhaseTitle = () => {
    switch (currentPhase) {
      case 'behavioural_score':
        return 'BEHAVIOURAL ROUND SCORES'
      case 'quickfire_score':
        return 'QUICK FIRE ROUND SCORES'
      case 'technical_score':
        return 'TECHNICAL ROUND SCORES'
      default:
        return 'CURRENT SCORES'
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 game-bg">
      <div
        className="w-full max-w-4xl space-y-8"
        style={{
          transform: isVisible ? 'scale(1)' : 'scale(0.8)',
          opacity: isVisible ? 1 : 0,
          transition: 'transform 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55), opacity 0.6s ease-out'
        }}
      >
        {/* Title */}
        <div className="text-center">
          <div className="game-paper px-8 py-4 game-shadow-hard-lg game-hand-drawn inline-block">
            <h1 className="game-title text-3xl sm:text-4xl">{getPhaseTitle()}</h1>
          </div>
        </div>

        {/* Scores */}
        <div className="space-y-4">
          {sortedPlayers.map((player, index) => {
            const score = scores[player.id] || 0
            const isWinner = index === 0 && sortedPlayers.length > 1
            return (
              <div
                key={player.id}
                className={`game-paper px-6 py-5 game-shadow-hard-lg ${
                  isWinner ? 'game-block-yellow' : ''
                }`}
                style={{
                  border: '4px solid var(--game-text-primary)',
                  transform: `rotate(${index % 2 === 0 ? '-0.5deg' : '0.5deg'})`,
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-2xl font-black">#{index + 1}</div>
                    <div className="text-xl font-bold">{player.name}</div>
                    {isWinner && <span className="text-xl">👑</span>}
                  </div>
                  <div className="text-3xl font-black">{score}</div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Continue Button */}
        <div className="flex justify-center">
          <button
            onClick={handleContinue}
            className="game-sharp game-block-green px-10 py-5 text-lg font-black uppercase tracking-widest game-shadow-hard-lg game-button-hover"
            style={{
              border: '6px solid var(--game-text-primary)',
              color: 'var(--game-text-white)',
            }}
          >
            {currentPhase === 'technical_score' ? 'VIEW RESULTS' : 'CONTINUE'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CurrentScore


