import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BaseQuestion from '@/components/BaseQuestion'
import { useGameFlow } from '@/hooks/useGameFlow'
import { useGameSync } from '@/hooks/useGameSync'
import { useLobby } from '@/hooks/useLobby'

const TechnicalPractical: React.FC = () => {
  const navigate = useNavigate()
  const { submitTechnicalAnswer } = useGameFlow()
  const { lobby } = useLobby()
  const { gameState, timeRemaining, submitAnswer: syncSubmitAnswer, isWaitingForOthers, showResults } = useGameSync()
  const [question, setQuestion] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Use question from game state if available, otherwise use placeholder
    if (gameState?.question) {
      setQuestion(gameState.question)
      setIsLoading(false)
    } else {
      // TODO: Fetch technical practical question from backend API
      // For now, use placeholder
      setTimeout(() => {
        setQuestion('Write a function that finds the maximum element in a binary tree. Explain your approach and provide the implementation.')
        setIsLoading(false)
      }, 500)
    }
  }, [gameState?.question])

  // Navigate when phase is complete (both theory and practical answered by all players)
  useEffect(() => {
    if (showResults && gameState?.showResults && gameState?.phaseComplete) {
      // Phase complete, navigate to score display
      sessionStorage.setItem('currentRound', 'technical')
      setTimeout(() => {
        navigate('/current-score')
      }, 1000)
    }
  }, [showResults, gameState?.showResults, gameState?.phaseComplete, navigate])

  const handleSubmit = async (answer: string) => {
    await submitTechnicalAnswer(answer)
    // Submit via sync with phase information
    syncSubmitAnswer(answer, gameState?.questionId, 'technical_practical', 0)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 game-bg">
        <div className="game-paper px-8 py-4 game-shadow-hard-lg">
          <div className="text-lg font-bold">Loading practical question...</div>
        </div>
      </div>
    )
  }

  return (
    <BaseQuestion
      question={question}
      onSubmit={handleSubmit}
      title="TECHNICAL PRACTICAL"
      placeholder="Write your code solution and explain your approach..."
      submitButtonText="SUBMIT ANSWER"
      maxLength={2000}
      timeRemaining={timeRemaining}
      isWaitingForOthers={isWaitingForOthers}
      submittedPlayersCount={gameState?.submittedPlayers.length || 0}
      totalPlayersCount={lobby?.players.length || 0}
    />
  )
}

export default TechnicalPractical


