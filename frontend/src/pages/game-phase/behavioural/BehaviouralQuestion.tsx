import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BaseQuestion from '@/components/BaseQuestion'
import { useGameFlow } from '@/hooks/useGameFlow'
import { useGameSync } from '@/hooks/useGameSync'
import { useLobby } from '@/hooks/useLobby'

const BehaviouralQuestion: React.FC = () => {
  const navigate = useNavigate()
  const { submitAnswer } = useGameFlow()
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
      // TODO: Fetch question from backend API
      // For now, use placeholder
      setTimeout(() => {
        setQuestion('Tell me about a time when you had to work under pressure. Describe the situation, your actions, and the outcome.')
        setIsLoading(false)
      }, 500)
    }
  }, [gameState?.question])

  // Navigate when results should be shown
  useEffect(() => {
    if (showResults && gameState?.showResults) {
      // Navigate to follow-up question after a brief delay
      setTimeout(() => {
        navigate('/behavioural-answer')
      }, 1000)
    }
  }, [showResults, gameState?.showResults, navigate])

  const handleSubmit = async (answer: string) => {
    await submitAnswer(answer)
    // Submit via sync
    syncSubmitAnswer(answer, gameState?.questionId)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 game-bg">
        <div className="game-paper px-8 py-4 game-shadow-hard-lg">
          <div className="text-lg font-bold">Loading question...</div>
        </div>
      </div>
    )
  }

  return (
    <BaseQuestion
      question={question}
      onSubmit={handleSubmit}
      title="BEHAVIOURAL QUESTION"
      placeholder="Describe a specific situation, your actions, and the results..."
      submitButtonText="SUBMIT ANSWER"
      maxLength={1000}
      timeRemaining={timeRemaining}
      isWaitingForOthers={isWaitingForOthers}
      submittedPlayersCount={gameState?.submittedPlayers.length || 0}
      totalPlayersCount={lobby?.players.length || 0}
    />
  )
}

export default BehaviouralQuestion


