import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BaseQuestion from '@/components/BaseQuestion'
import { useGameFlow } from '@/hooks/useGameFlow'

const BehaviouralAnswer: React.FC = () => {
  const navigate = useNavigate()
  const { submitFollowUpAnswer } = useGameFlow()
  const [followUpQuestion, setFollowUpQuestion] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // TODO: Fetch follow-up question from backend API based on previous answer
    // For now, use placeholder
    setTimeout(() => {
      setFollowUpQuestion('Can you elaborate on what specific challenges you faced during that situation?')
      setIsLoading(false)
    }, 500)
  }, [])

  const handleSubmit = async (answer: string) => {
    await submitFollowUpAnswer(answer)
    // Set current round in sessionStorage
    sessionStorage.setItem('currentRound', 'behavioural')
    // Navigate to score display
    setTimeout(() => {
      navigate('/current-score')
    }, 500)
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
    />
  )
}

export default BehaviouralAnswer


