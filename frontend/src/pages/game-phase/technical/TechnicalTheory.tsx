import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BaseQuestion from '@/components/BaseQuestion'
import { useGameFlow } from '@/hooks/useGameFlow'
import { useGameSync } from '@/hooks/useGameSync'
import { useLobby } from '@/hooks/useLobby'

const TechnicalTheory: React.FC = () => {
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
      // TODO: Fetch technical question from backend API
      // For now, use placeholder
      setTimeout(() => {
        setQuestion('Explain the concept of object-oriented programming. Include examples of encapsulation, inheritance, and polymorphism.')
        setIsLoading(false)
      }, 500)
    }
  }, [gameState?.question])

  // Navigate when results should be shown
  useEffect(() => {
    if (showResults && gameState?.showResults) {
      // Set current round in sessionStorage
      sessionStorage.setItem('currentRound', 'technical')
      // Navigate to score display
      setTimeout(() => {
        navigate('/current-score')
      }, 1000)
    }
  }, [showResults, gameState?.showResults, navigate])

  const handleSubmit = async (answer: string) => {
    await submitTechnicalAnswer(answer)
    // Submit via sync
    syncSubmitAnswer(answer, gameState?.questionId)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 game-bg">
        <div className="game-paper px-8 py-4 game-shadow-hard-lg">
          <div className="text-lg font-bold">Loading technical question...</div>
        </div>
      </div>
    )
  }

  return (
    <BaseQuestion
      question={question}
      onSubmit={handleSubmit}
      title="TECHNICAL QUESTION"
      placeholder="Explain your technical knowledge and provide examples..."
      submitButtonText="SUBMIT ANSWER"
      maxLength={1500}
      timeRemaining={timeRemaining}
      isWaitingForOthers={isWaitingForOthers}
      submittedPlayersCount={gameState?.submittedPlayers.length || 0}
      totalPlayersCount={lobby?.players.length || 0}
    />
  )
}

export default TechnicalTheory


