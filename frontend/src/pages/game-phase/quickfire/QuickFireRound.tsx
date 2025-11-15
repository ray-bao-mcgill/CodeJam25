import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BaseQuestion from '@/components/BaseQuestion'
import { useGameFlow } from '@/hooks/useGameFlow'
import { useGameSync } from '@/hooks/useGameSync'
import { useLobby } from '@/hooks/useLobby'

const QuickFireRound: React.FC = () => {
  const navigate = useNavigate()
  const { submitQuickFireAnswer } = useGameFlow()
  const { lobby } = useLobby()
  const { gameState, timeRemaining, submitAnswer: syncSubmitAnswer, isWaitingForOthers, showResults } = useGameSync()
  const [questions, setQuestions] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // TODO: Fetch 10 quick fire questions from backend API
    // For now, use placeholder questions
    setTimeout(() => {
      const placeholderQuestions = [
        'What is the time complexity of binary search?',
        'Explain the difference between let, const, and var in JavaScript.',
        'What is a REST API?',
        'What is the purpose of a database index?',
        'Explain the concept of closure in JavaScript.',
        'What is the difference between SQL and NoSQL databases?',
        'What is the purpose of version control systems like Git?',
        'Explain the difference between synchronous and asynchronous programming.',
        'What is the difference between a stack and a queue?',
        'What is the purpose of unit testing?',
      ]
      setQuestions(placeholderQuestions)
      setIsLoading(false)
    }, 500)
  }, [])

  // Navigate when results should be shown (after all questions)
  useEffect(() => {
    if (showResults && gameState?.showResults && currentIndex >= questions.length - 1) {
      sessionStorage.setItem('currentRound', 'quickfire')
      setTimeout(() => {
        navigate('/current-score')
      }, 1000)
    }
  }, [showResults, gameState?.showResults, currentIndex, questions.length, navigate])

  const handleSubmit = async (answer: string) => {
    await submitQuickFireAnswer(answer, currentIndex)
    // Submit via sync
    syncSubmitAnswer(answer, gameState?.questionId)
    
    if (currentIndex < questions.length - 1) {
      // Move to next question (wait for sync if needed)
      if (!isWaitingForOthers) {
        setCurrentIndex(currentIndex + 1)
      }
    }
  }

  if (isLoading || questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 game-bg">
        <div className="game-paper px-8 py-4 game-shadow-hard-lg">
          <div className="text-lg font-bold">Loading questions...</div>
        </div>
      </div>
    )
  }

  const currentQuestion = questions[currentIndex]
  const progress = ((currentIndex + 1) / questions.length) * 100

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 game-bg">
      <div className="w-full max-w-4xl space-y-6">
        {/* Progress Bar */}
        <div className="game-paper px-6 py-4 game-shadow-hard">
          <div className="flex items-center justify-between mb-2">
            <div className="game-label-text text-sm">
              QUESTION {currentIndex + 1} OF {questions.length}
            </div>
            <div className="game-label-text text-sm">
              {Math.round(progress)}%
            </div>
          </div>
          <div className="w-full h-4 bg-gray-200 relative" style={{ border: '2px solid var(--game-text-primary)' }}>
            <div
              className="h-full game-block-blue transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question Component */}
        <BaseQuestion
          question={currentQuestion}
          onSubmit={handleSubmit}
          title="QUICK FIRE ROUND"
          placeholder="Type your answer quickly..."
          submitButtonText={currentIndex < questions.length - 1 ? 'NEXT QUESTION' : 'FINISH ROUND'}
          maxLength={500}
          timeRemaining={timeRemaining}
          isWaitingForOthers={isWaitingForOthers}
          submittedPlayersCount={gameState?.submittedPlayers.length || 0}
          totalPlayersCount={lobby?.players.length || 0}
        />
      </div>
    </div>
  )
}

export default QuickFireRound

