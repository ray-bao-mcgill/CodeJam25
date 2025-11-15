import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'

interface Question {
  question: string
  options: string[]
  correctAnswer: string
}

const RapidFireQuiz: React.FC = () => {
  const navigate = useNavigate()
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [lives, setLives] = useState(2)
  const [timeLeft, setTimeLeft] = useState(150) // 2.5 minutes total for 10 questions
  const [isAnswered, setIsAnswered] = useState(false)
  const [correctAnswers, setCorrectAnswers] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [startTime] = useState(Date.now())
  const [opponentScore] = useState(Math.floor(Math.random() * 500) + 1200) // Random score between 1200-1700
  const maxQuestions = 10

  // Fetch questions from backend
  useEffect(() => {
    // TODO: Replace with actual API call
    const fetchQuestions = async () => {
      try {
        // const response = await fetch('/api/questions/technical-theory')
        // const data = await response.json()
        
        // Mock data for now - get 10 questions
        const mockQuestions: Question[] = [
          {
            question: "What is the time complexity of binary search?",
            options: ["O(n)", "O(log n)", "O(n²)", "O(1)"],
            correctAnswer: "O(log n)"
          },
          {
            question: "Which data structure uses LIFO?",
            options: ["Queue", "Stack", "Array", "Linked List"],
            correctAnswer: "Stack"
          },
          {
            question: "What does REST stand for?",
            options: ["Remote State Transfer", "Representational State Transfer", "Real State Transport", "Responsive State Transfer"],
            correctAnswer: "Representational State Transfer"
          },
          {
            question: "What is polymorphism?",
            options: ["Multiple forms", "Single form", "No form", "Hidden form"],
            correctAnswer: "Multiple forms"
          },
          {
            question: "Which sorting algorithm is fastest on average?",
            options: ["Bubble Sort", "Quick Sort", "Selection Sort", "Insertion Sort"],
            correctAnswer: "Quick Sort"
          },
          {
            question: "What is encapsulation?",
            options: ["Hiding data", "Showing data", "Deleting data", "Copying data"],
            correctAnswer: "Hiding data"
          },
          {
            question: "What is a closure in JavaScript?",
            options: ["Function with access to outer scope", "Closed function", "Private function", "Static function"],
            correctAnswer: "Function with access to outer scope"
          },
          {
            question: "What does SQL stand for?",
            options: ["Structured Query Language", "Simple Query Language", "Standard Query Language", "Sequential Query Language"],
            correctAnswer: "Structured Query Language"
          },
          {
            question: "What is the purpose of Docker?",
            options: ["Containerization", "Version control", "Database management", "Code editing"],
            correctAnswer: "Containerization"
          },
          {
            question: "What is a RESTful API?",
            options: ["API using REST principles", "API for resting", "API with no state", "API for testing"],
            correctAnswer: "API using REST principles"
          }
        ]
        
        // Shuffle and take max 10 questions
        const shuffled = mockQuestions.sort(() => Math.random() - 0.5).slice(0, maxQuestions)
        setQuestions(shuffled)
      } catch (error) {
        console.error('Error fetching questions:', error)
      }
    }

    fetchQuestions()
  }, [])  // Notify server when finished all questions and wait for all players
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

