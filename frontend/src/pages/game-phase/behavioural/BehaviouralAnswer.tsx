import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BaseQuestion from '@/components/BaseQuestion'
import { useGameFlow } from '@/hooks/useGameFlow'
import { useGameSync } from '@/hooks/useGameSync'
import { useLobby } from '@/hooks/useLobby'

const BehaviouralAnswer: React.FC = () => {
  const navigate = useNavigate()
  const { submitFollowUpAnswer } = useGameFlow()
  const { lobby } = useLobby()
  const { gameState, timeRemaining, submitAnswer: syncSubmitAnswer, isWaitingForOthers, showResults } = useGameSync()
  const [followUpQuestion, setFollowUpQuestion] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Use question from game state if available, otherwise use placeholder
    if (gameState?.question) {
      setFollowUpQuestion(gameState.question)
      setIsLoading(false)
    } else {
      // TODO: Fetch follow-up question from backend API based on previous answer
      // For now, use placeholder
      setTimeout(() => {
        setFollowUpQuestion('Can you elaborate on what specific challenges you faced during that situation?')
        setIsLoading(false)
      }, 500)
    }
  }, [gameState?.question])

  // Navigate when results should be shown
  useEffect(() => {
    if (showResults && gameState?.showResults) {
      // Set current round in sessionStorage
      sessionStorage.setItem('currentRound', 'behavioural')
      // Navigate to score display
      setTimeout(() => {
        navigate('/current-score')
      }, 1000)
    }
  }, [showResults, gameState?.showResults, navigate])

  const handleSubmit = async (answer: string) => {
    await submitFollowUpAnswer(answer)
    // Submit via sync
    syncSubmitAnswer(answer, gameState?.questionId)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 game-bg">
        <div className="game-paper px-8 py-4 game-shadow-hard-lg">
          <div className="text-lg font-bold">Loading follow-up question...</div>
        </div>
      </div>
    )
  }

  return (
    <BaseQuestion
      question={followUpQuestion}
      onSubmit={handleSubmit}
      title="FOLLOW-UP QUESTION"
      placeholder="Provide more details about your experience..."
      submitButtonText="SUBMIT ANSWER"
      maxLength={1000}
      timeRemaining={timeRemaining}
      isWaitingForOthers={isWaitingForOthers}
      submittedPlayersCount={gameState?.submittedPlayers.length || 0}
      totalPlayersCount={lobby?.players.length || 0}
    />
  )
}

export default BehaviouralAnswer


