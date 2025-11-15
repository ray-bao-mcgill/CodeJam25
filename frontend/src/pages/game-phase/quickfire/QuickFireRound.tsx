import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import MultipleChoice, { MultipleChoiceOption } from '@/components/MultipleChoice'
import { useGameFlow } from '@/hooks/useGameFlow'
import { useGameSync } from '@/hooks/useGameSync'
import { useLobby } from '@/hooks/useLobby'
import { useLobbyWebSocket } from '@/hooks/useLobbyWebSocket'

interface QuickFireQuestion {
  question: string
  options: MultipleChoiceOption[]
  correctAnswer: string
}

const QuickFireRound: React.FC = () => {
  const navigate = useNavigate()
  const { submitQuickFireAnswer } = useGameFlow()
  const { lobbyId, playerId, lobby } = useLobby()
  const { gameState, submitAnswer: syncSubmitAnswer, showResults } = useGameSync()
  const [questions, setQuestions] = useState<QuickFireQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [submittedQuestions, setSubmittedQuestions] = useState<Set<number>>(new Set())
  const [finishedAllQuestions, setFinishedAllQuestions] = useState(false)
  
  const wsRef = useLobbyWebSocket({
    lobbyId: lobbyId || null,
    enabled: !!lobbyId,
    onLobbyUpdate: () => {},
    onGameStarted: () => {},
    onDisconnect: () => {},
    onKicked: () => {},
    currentPlayerId: playerId || null,
    onGameMessage: () => {},
  })

  useEffect(() => {
    // TODO: Fetch 10 quick fire questions from backend API
    // For now, use placeholder questions with multiple choice options
    setTimeout(() => {
      const placeholderQuestions: QuickFireQuestion[] = [
        {
          question: 'What is the time complexity of binary search?',
          options: [
            { id: 'A', label: 'O(n)', color: 'red' },
            { id: 'B', label: 'O(log n)', color: 'blue' },
            { id: 'C', label: 'O(n log n)', color: 'yellow' },
            { id: 'D', label: 'O(1)', color: 'green' }
          ],
          correctAnswer: 'B'
        },
        {
          question: 'What keyword declares a constant in JavaScript?',
          options: [
            { id: 'A', label: 'var', color: 'red' },
            { id: 'B', label: 'let', color: 'blue' },
            { id: 'C', label: 'const', color: 'yellow' },
            { id: 'D', label: 'final', color: 'green' }
          ],
          correctAnswer: 'C'
        },
        {
          question: 'What does REST stand for?',
          options: [
            { id: 'A', label: 'Representational State Transfer', color: 'red' },
            { id: 'B', label: 'Remote Execution State Transfer', color: 'blue' },
            { id: 'C', label: 'Resource Exchange Service Type', color: 'yellow' },
            { id: 'D', label: 'Rapid Execution System Transfer', color: 'green' }
          ],
          correctAnswer: 'A'
        },
        {
          question: 'What is the primary purpose of a database index?',
          options: [
            { id: 'A', label: 'Store data', color: 'red' },
            { id: 'B', label: 'Improve query performance', color: 'blue' },
            { id: 'C', label: 'Backup data', color: 'yellow' },
            { id: 'D', label: 'Encrypt data', color: 'green' }
          ],
          correctAnswer: 'B'
        },
        {
          question: 'What is a closure in JavaScript?',
          options: [
            { id: 'A', label: 'A function that closes the browser', color: 'red' },
            { id: 'B', label: 'A function with access to outer scope variables', color: 'blue' },
            { id: 'C', label: 'A way to close files', color: 'yellow' },
            { id: 'D', label: 'A type of loop', color: 'green' }
          ],
          correctAnswer: 'B'
        },
        {
          question: 'What is the main difference between SQL and NoSQL databases?',
          options: [
            { id: 'A', label: 'SQL is faster', color: 'red' },
            { id: 'B', label: 'NoSQL uses tables, SQL uses documents', color: 'blue' },
            { id: 'C', label: 'SQL is relational, NoSQL is non-relational', color: 'yellow' },
            { id: 'D', label: 'NoSQL is older', color: 'green' }
          ],
          correctAnswer: 'C'
        },
        {
          question: 'What is Git primarily used for?',
          options: [
            { id: 'A', label: 'Running code', color: 'red' },
            { id: 'B', label: 'Version control', color: 'blue' },
            { id: 'C', label: 'Database management', color: 'yellow' },
            { id: 'D', label: 'Web hosting', color: 'green' }
          ],
          correctAnswer: 'B'
        },
        {
          question: 'What is the difference between synchronous and asynchronous code?',
          options: [
            { id: 'A', label: 'Synchronous blocks, asynchronous doesn\'t', color: 'red' },
            { id: 'B', label: 'Asynchronous is faster', color: 'blue' },
            { id: 'C', label: 'Synchronous uses callbacks', color: 'yellow' },
            { id: 'D', label: 'No difference', color: 'green' }
          ],
          correctAnswer: 'A'
        },
        {
          question: 'What is the main difference between a stack and a queue?',
          options: [
            { id: 'A', label: 'Stack is LIFO, queue is FIFO', color: 'red' },
            { id: 'B', label: 'Queue is LIFO, stack is FIFO', color: 'blue' },
            { id: 'C', label: 'Stack is faster', color: 'yellow' },
            { id: 'D', label: 'No difference', color: 'green' }
          ],
          correctAnswer: 'A'
        },
        {
          question: 'What is the purpose of unit testing?',
          options: [
            { id: 'A', label: 'Test individual components', color: 'red' },
            { id: 'B', label: 'Test the entire system', color: 'blue' },
            { id: 'C', label: 'Test user interfaces', color: 'yellow' },
            { id: 'D', label: 'Test network connections', color: 'green' }
          ],
          correctAnswer: 'A'
        }
      ]
      setQuestions(placeholderQuestions)
      setIsLoading(false)
    }, 500)
  }, [])

  // Notify server when finished all questions and wait for all players
  useEffect(() => {
    if (submittedQuestions.size === 10 && questions.length === 10 && !finishedAllQuestions) {
      // Finished all questions - notify server
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN && playerId && lobbyId) {
        ws.send(JSON.stringify({
          type: 'quickfire_finished',
          player_id: playerId,
          lobby_id: lobbyId
        }))
        setFinishedAllQuestions(true)
      }
    }
  }, [submittedQuestions.size, questions.length, finishedAllQuestions, playerId, lobbyId, wsRef])

  // Navigate when server says all players finished (phase complete)
  useEffect(() => {
    if (showResults && gameState?.showResults && gameState?.phaseComplete && gameState?.phase === 'quickfire' && finishedAllQuestions) {
      sessionStorage.setItem('currentRound', 'quickfire')
      setTimeout(() => {
        navigate('/current-score')
      }, 500)
    }
  }, [showResults, gameState?.showResults, gameState?.phaseComplete, gameState?.phase, finishedAllQuestions, navigate])

  const handleSubmit = async (selectedOptionId: string) => {
    // Don't allow resubmitting the same question
    if (submittedQuestions.has(currentIndex)) {
      return
    }

    const currentQuestion = questions[currentIndex]
    await submitQuickFireAnswer(selectedOptionId, currentIndex)
    // Submit via sync with phase information
    syncSubmitAnswer(selectedOptionId, `quickfire_q${currentIndex}`, 'quickfire', currentIndex)
    
    // Mark this question as submitted
    setSubmittedQuestions(prev => new Set([...prev, currentIndex]))
    
    // Advance to next question immediately (no waiting)
    if (currentIndex < questions.length - 1) {
      setTimeout(() => {
        setCurrentIndex(currentIndex + 1)
      }, 300) // Small delay for visual feedback
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

        {/* Multiple Choice Component */}
        <MultipleChoice
          question={currentQuestion.question}
          options={currentQuestion.options}
          onSubmit={handleSubmit}
          title="QUICK FIRE ROUND"
          submitButtonText="SUBMIT"
          disabled={submittedQuestions.has(currentIndex)}
          isWaitingForOthers={finishedAllQuestions && !gameState?.phaseComplete}
          submittedPlayersCount={finishedAllQuestions ? (gameState?.submittedPlayers.length || 0) : 0}
          totalPlayersCount={finishedAllQuestions ? (lobby?.players.length || 0) : 0}
        />
      </div>
    </div>
  )
}

export default QuickFireRound

