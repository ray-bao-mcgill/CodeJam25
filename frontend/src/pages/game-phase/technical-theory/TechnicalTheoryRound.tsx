import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import MultipleChoice, { MultipleChoiceOption } from '@/components/MultipleChoice'
import { useGameFlow } from '@/hooks/useGameFlow'
import { useGameSync } from '@/hooks/useGameSync'
import { useLobby } from '@/hooks/useLobby'
import { useLobbyWebSocket } from '@/hooks/useLobbyWebSocket'

interface TechnicalTheoryQuestion {
  question: string
  options: MultipleChoiceOption[]
  correctAnswer: string
}

const TechnicalTheoryRound: React.FC = () => {
  const navigate = useNavigate()
  const { submitTechnicalTheoryAnswer } = useGameFlow()
  const { lobbyId, playerId, lobby } = useLobby()
  const { gameState, submitAnswer: syncSubmitAnswer, showResults } = useGameSync()
  const [questions, setQuestions] = useState<TechnicalTheoryQuestion[]>([])
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
    // TODO: Fetch 10 technical theory questions from backend API
    // For now, use placeholder questions with multiple choice options
    setTimeout(() => {
      const placeholderQuestions: TechnicalTheoryQuestion[] = [
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
          question: 'Which data structure uses LIFO?',
          options: [
            { id: 'A', label: 'Queue', color: 'red' },
            { id: 'B', label: 'Stack', color: 'blue' },
            { id: 'C', label: 'Array', color: 'yellow' },
            { id: 'D', label: 'Linked List', color: 'green' }
          ],
          correctAnswer: 'B'
        },
        {
          question: 'What does REST stand for?',
          options: [
            { id: 'A', label: 'Remote State Transfer', color: 'red' },
            { id: 'B', label: 'Representational State Transfer', color: 'blue' },
            { id: 'C', label: 'Real State Transport', color: 'yellow' },
            { id: 'D', label: 'Responsive State Transfer', color: 'green' }
          ],
          correctAnswer: 'B'
        },
        {
          question: 'What is polymorphism?',
          options: [
            { id: 'A', label: 'Multiple forms', color: 'red' },
            { id: 'B', label: 'Single form', color: 'blue' },
            { id: 'C', label: 'No form', color: 'yellow' },
            { id: 'D', label: 'Hidden form', color: 'green' }
          ],
          correctAnswer: 'A'
        },
        {
          question: 'Which sorting algorithm is fastest on average?',
          options: [
            { id: 'A', label: 'Bubble Sort', color: 'red' },
            { id: 'B', label: 'Quick Sort', color: 'blue' },
            { id: 'C', label: 'Selection Sort', color: 'yellow' },
            { id: 'D', label: 'Insertion Sort', color: 'green' }
          ],
          correctAnswer: 'B'
        },
        {
          question: 'What is encapsulation?',
          options: [
            { id: 'A', label: 'Hiding data', color: 'red' },
            { id: 'B', label: 'Showing data', color: 'blue' },
            { id: 'C', label: 'Deleting data', color: 'yellow' },
            { id: 'D', label: 'Copying data', color: 'green' }
          ],
          correctAnswer: 'A'
        },
        {
          question: 'What is a closure in JavaScript?',
          options: [
            { id: 'A', label: 'Function with access to outer scope', color: 'red' },
            { id: 'B', label: 'Closed function', color: 'blue' },
            { id: 'C', label: 'Private function', color: 'yellow' },
            { id: 'D', label: 'Static function', color: 'green' }
          ],
          correctAnswer: 'A'
        },
        {
          question: 'What does SQL stand for?',
          options: [
            { id: 'A', label: 'Structured Query Language', color: 'red' },
            { id: 'B', label: 'Simple Query Language', color: 'blue' },
            { id: 'C', label: 'Standard Query Language', color: 'yellow' },
            { id: 'D', label: 'Sequential Query Language', color: 'green' }
          ],
          correctAnswer: 'A'
        },
        {
          question: 'What is the purpose of Docker?',
          options: [
            { id: 'A', label: 'Containerization', color: 'red' },
            { id: 'B', label: 'Version control', color: 'blue' },
            { id: 'C', label: 'Database management', color: 'yellow' },
            { id: 'D', label: 'Code editing', color: 'green' }
          ],
          correctAnswer: 'A'
        },
        {
          question: 'What is a RESTful API?',
          options: [
            { id: 'A', label: 'API using REST principles', color: 'red' },
            { id: 'B', label: 'API for resting', color: 'blue' },
            { id: 'C', label: 'API with no state', color: 'yellow' },
            { id: 'D', label: 'API for testing', color: 'green' }
          ],
          correctAnswer: 'A'
        }
      ]
      
      setQuestions(placeholderQuestions)
      setIsLoading(false)
    }, 500)
  }, [])

  // Check if all questions are submitted
  useEffect(() => {
    if (submittedQuestions.size === 10 && questions.length === 10 && !finishedAllQuestions) {
      // Finished all questions - notify server
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN && playerId && lobbyId) {
        ws.send(JSON.stringify({
          type: 'technical_theory_finished',
          player_id: playerId,
          lobby_id: lobbyId
        }))
        setFinishedAllQuestions(true)
      }
    }
  }, [submittedQuestions.size, questions.length, finishedAllQuestions, playerId, lobbyId, wsRef])

  // Navigate when server says all players finished (phase complete)
  useEffect(() => {
    if (showResults && gameState?.showResults && gameState?.phaseComplete && gameState?.phase === 'technical_theory' && finishedAllQuestions) {
      sessionStorage.setItem('currentRound', 'technical-theory')
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
    await submitTechnicalTheoryAnswer(selectedOptionId, currentIndex)
    // Submit via sync with phase information
    syncSubmitAnswer(selectedOptionId, `technical_theory_q${currentIndex}`, 'technical_theory', currentIndex)
    
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
          title="TECHNICAL THEORY"
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

export default TechnicalTheoryRound

