import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'
import { useGameSync } from '@/hooks/useGameSync'
import { useLobby } from '@/hooks/useLobby'

interface Question {
  question: string
  options: string[]
  correctAnswer: string
}

const RapidFireQuiz: React.FC = () => {
  const navigate = useNavigate()
  const { lobbyId, playerId, lobby } = useLobby()
  const { gameState, submitAnswer: syncSubmitAnswer, showResults } = useGameSync()
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
  const [submittedQuestions, setSubmittedQuestions] = useState<Set<number>>(new Set())
  const [finishedAllQuestions, setFinishedAllQuestions] = useState(false)
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
  }, [])

  // Check if all questions submitted and notify server
  useEffect(() => {
    if (submittedQuestions.size === 10 && questions.length === 10 && !finishedAllQuestions) {
      setFinishedAllQuestions(true)
      setGameOver(true)
    }
  }, [submittedQuestions.size, questions.length, finishedAllQuestions])

  // Navigate when server says all players finished (phase complete)
  useEffect(() => {
    if (showResults && gameState?.showResults && gameState?.phaseComplete && gameState?.phase === 'technical_theory' && finishedAllQuestions) {
      sessionStorage.setItem('currentRound', 'technical_theory')
      setTimeout(() => {
        navigate('/current-score')
      }, 2500) // Match the VS page timer
    }
  }, [showResults, gameState?.showResults, gameState?.phaseComplete, gameState?.phase, finishedAllQuestions, navigate])

  // Auto-navigate to score page after game over (fallback if no backend sync)
  useEffect(() => {
    if (gameOver && !lobbyId) {
      // Single player mode - navigate after showing VS page
      const finalScore = calculateFinalScore()
      const playerWon = finalScore > opponentScore
      
      const timer = setTimeout(() => {
        navigate('/current-score')
      }, 2500)
      
      return () => clearTimeout(timer)
    }
  }, [gameOver, navigate, opponentScore, lobbyId])

  // Timer countdown
  useEffect(() => {
    if (timeLeft === 0 && !isAnswered) {
      handleTimeout()
      return
    }

    if (!isAnswered && !gameOver) {
      const timer = setInterval(() => {
        setTimeLeft(prev => prev - 1)
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [timeLeft, isAnswered, gameOver])

  const handleTimeout = () => {
    setGameOver(true)
  }

  const calculateFinalScore = () => {
    // 100 points per correct answer (max 1000)
    const questionScore = correctAnswers * 100
    
    // Remaining 1000 points divided by time and lives
    const timeBonus = Math.floor((timeLeft / 150) * 500) // 500 points for time
    const livesBonus = lives * 250 // 250 points per life (max 500)
    
    return questionScore + timeBonus + livesBonus
  }

  const handleAnswerSelect = (optionIndex: number) => {
    if (isAnswered || gameOver) return

    setSelectedAnswer(optionIndex)
    setIsAnswered(true)

    const currentQuestion = questions[currentQuestionIndex]
    const isCorrect = currentQuestion.options[optionIndex] === currentQuestion.correctAnswer

    if (isCorrect) {
      setCorrectAnswers(prev => prev + 1)
    } else {
      setLives(prev => prev - 1)
    }

    // Submit to backend via sync
    if (lobbyId && playerId) {
      syncSubmitAnswer(
        currentQuestion.options[optionIndex], 
        `technical_theory_q${currentQuestionIndex}`, 
        'technical_theory', 
        currentQuestionIndex
      )
    }

    // Mark this question as submitted
    setSubmittedQuestions(prev => new Set([...prev, currentQuestionIndex]))

    setTimeout(() => {
      if (!isCorrect && lives - 1 <= 0) {
        setGameOver(true)
      } else if (currentQuestionIndex + 1 >= questions.length) {
        // All questions completed
        setGameOver(true)
      } else {
        nextQuestion()
      }
    }, 1500)
  }

  const nextQuestion = () => {
    setCurrentQuestionIndex(prev => prev + 1)
    setSelectedAnswer(null)
    setIsAnswered(false)
  }

  const finalScore = calculateFinalScore()

  if (questions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#f5f5dc' }}>
        <p className="text-2xl font-bold" style={{ color: '#333' }}>Loading...</p>
      </div>
    )
  }

  if (gameOver) {
    const playerWon = finalScore > opponentScore
    
    return (
      <div className="flex items-center justify-center min-h-screen game-bg relative overflow-hidden">
        {/* Continuous Vertical Line - perfectly centered */}
        <div className="absolute top-0 bottom-0 left-1/2 w-2 bg-[var(--game-text-primary)] transform -translate-x-1/2 shadow-[2px_2px_0px_rgba(0,0,0,0.3)]" />
        
        {/* Title at top - absolute positioning */}
        <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-10">
          <div className="game-label-text text-3xl game-shadow-hard">
            FINAL RESULTS
          </div>
        </div>

        {/* Bottom loading indicator - absolute positioning */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
          <div className="game-label-text text-xl game-shadow-hard-sm animate-pulse">
            NEXT ROUND STARTING SOON...
          </div>
        </div>

        {/* Main VS Content - Perfectly Centered */}
        <div className="relative z-10 flex items-center justify-between w-full max-w-[1600px] px-16">
          {/* Your Score - Left Side */}
          <div className="flex flex-col items-center animate-stamp-in" style={{ animationDelay: '0.2s' }}>
            <div className="game-label-text text-lg mb-3 game-shadow-hard-sm bg-[var(--game-blue)] px-4 py-1 text-white">
              YOUR SCORE
            </div>
            <div className="px-10 py-7 game-sharp game-shadow-hard-lg border-6 border-[var(--game-blue)] bg-gradient-to-br from-blue-100 to-blue-200">
              <div className="text-6xl font-black text-[var(--game-blue)] leading-none" style={{ fontFamily: 'Impact, sans-serif' }}>
                {finalScore}
              </div>
            </div>
          </div>

          {/* VS in Circle - perfectly centered on the line */}
          <div className="flex items-center justify-center absolute left-1/2 transform -translate-x-1/2 animate-stamp-in-vs" style={{ animationDelay: '0.6s' }}>
            {/* VS Text in Circle */}
            <div className="rounded-full flex items-center justify-center w-[180px] h-[180px] bg-gradient-to-br from-yellow-300 via-[var(--game-yellow)] to-orange-400 border-[10px] border-[var(--game-text-primary)] shadow-[10px_10px_0px_rgba(0,0,0,0.4)]">
              <div className="text-[5rem] font-black text-[var(--game-text-primary)] leading-none drop-shadow-lg" style={{ fontFamily: 'Impact, sans-serif' }}>
                VS
              </div>
            </div>
          </div>

          {/* Opponent's Score - Right Side */}
          <div className="flex flex-col items-center animate-stamp-in" style={{ animationDelay: '0.4s' }}>
            <div className="game-label-text text-lg mb-3 game-shadow-hard-sm bg-[var(--game-red)] px-4 py-1 text-white">
              OPPONENT'S SCORE
            </div>
            <div className="px-10 py-7 game-sharp game-shadow-hard-lg border-6 border-[var(--game-red)] bg-gradient-to-br from-red-100 to-red-200">
              <div className="text-6xl font-black text-[var(--game-red)] leading-none" style={{ fontFamily: 'Impact, sans-serif' }}>
                {opponentScore}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const currentQuestion = questions[currentQuestionIndex]
  const correctAnswerIndex = currentQuestion.options.findIndex(opt => opt === currentQuestion.correctAnswer)

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 game-bg">
      <div className="w-full max-w-7xl space-y-6">
        {/* Title */}
        <div className="relative game-skew-left">
          <div className="game-sticky-note px-12 py-6 game-shadow-hard-lg">
            <h1 className="game-title text-6xl" style={{ fontSize: '3.5rem', lineHeight: '1.1' }}>
              TECHNICAL THEORY
            </h1>
          </div>
        </div>

        {/* Subtitle */}
        <div className="flex justify-center">
          <div className="game-label-text text-xl game-shadow-hard-sm">
            RAPID FIRE QUIZ
          </div>
        </div>

        {/* Header with Lives, Question Counter, and Timer */}
        <div className="flex justify-between items-center px-4">
          {/* Lives */}
          <div className="flex gap-3">
            {[...Array(2)].map((_, i) => (
              <div
                key={i}
                className={`w-16 h-16 flex items-center justify-center text-3xl font-black game-sharp game-shadow-hard border-4 border-[var(--game-text-primary)] ${
                  i < lives ? 'bg-[var(--game-red)] text-white' : 'bg-gray-300 text-white'
                }`}
                style={{ fontFamily: 'Arial Black, sans-serif' }}
              >
                ❤
              </div>
            ))}
          </div>

          {/* Question Counter */}
          <div className="text-3xl font-black px-8 py-3 game-sharp game-shadow-hard bg-[var(--game-bg-alt)] text-[var(--game-text-primary)] border-4 border-[var(--game-text-primary)]" style={{ fontFamily: 'Arial Black, sans-serif' }}>
            {currentQuestionIndex + 1} / 10
          </div>

          {/* Timer */}
          <div
            className={`w-20 h-20 flex items-center justify-center text-4xl font-black game-sharp game-shadow-hard border-4 border-[var(--game-text-primary)] text-white ${
              timeLeft <= 30 ? 'bg-[var(--game-red)]' : 'bg-[var(--game-blue)]'
            }`}
            style={{ fontFamily: 'Arial Black, sans-serif' }}
          >
            {timeLeft}
          </div>
        </div>

        {/* Question */}
        <div className="text-center py-8 px-8 game-paper game-sharp game-shadow-hard border-4 border-[var(--game-text-primary)]">
          <h2 className="text-3xl font-black text-[var(--game-text-primary)] leading-[1.4]" style={{ fontFamily: 'Arial, sans-serif' }}>
            {currentQuestion.question}
          </h2>
        </div>

        {/* Answer Options Grid */}
        <div className="grid grid-cols-2 gap-6">
          {currentQuestion.options.map((option, index) => {
            const isCorrect = index === correctAnswerIndex
            const isSelected = index === selectedAnswer
            
            // Define colors and shapes for each option - Jackbox style flat colors
            // Using vibrant color palette
            const optionStyles = [
              {
                color: 'orange',
                bgClass: 'bg-[#ff6600]', // Bright orange
                borderClass: 'border-[var(--game-text-primary)]',
                shape: (
                  <div className="w-10 h-10 rounded-full bg-white border-3 border-black shadow-[2px_2px_0px_rgba(0,0,0,0.3)]" />
                ),
                label: 'A'
              },
              {
                color: 'lime',
                bgClass: 'bg-[#88dd00]', // Lime green
                borderClass: 'border-[var(--game-text-primary)]',
                shape: (
                  <div className="w-10 h-10 rotate-45 bg-white border-3 border-black shadow-[2px_2px_0px_rgba(0,0,0,0.3)]" />
                ),
                label: 'B'
              },
              {
                color: 'pink',
                bgClass: 'bg-[#ff3366]', // Hot pink
                borderClass: 'border-[var(--game-text-primary)]',
                shape: (
                  <div className="relative w-10 h-10">
                    {/* Shadow layer */}
                    <div 
                      className="absolute top-[2px] left-[2px] w-10 h-10 bg-black opacity-30"
                      style={{ 
                        clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
                      }} 
                    />
                    {/* Triangle */}
                    <div 
                      className="absolute top-0 left-0 w-10 h-10 bg-white"
                      style={{ 
                        clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
                      }} 
                    />
                  </div>
                ),
                label: 'C'
              },
              {
                color: 'purple',
                bgClass: 'bg-[#9966ff]', // Purple
                borderClass: 'border-[var(--game-text-primary)]',
                shape: (
                  <div className="w-10 h-10 bg-white border-3 border-black shadow-[2px_2px_0px_rgba(0,0,0,0.3)]" />
                ),
                label: 'D'
              }
            ]

            const style = optionStyles[index]
            
            let buttonClasses = `py-8 px-6 text-xl font-bold game-sharp game-shadow-hard transition-all duration-200 relative overflow-visible border-8`
            let buttonStyle: React.CSSProperties = {
              fontFamily: 'Arial, sans-serif',
              minHeight: '120px',
              cursor: isAnswered ? 'not-allowed' : 'pointer',
              opacity: 1 // Force full opacity always
            }

            if (isAnswered) {
              const wasCorrect = isSelected && isCorrect
              
              if (isCorrect) {
                // Show correct answer in green
                buttonClasses += " bg-[var(--game-green)] border-[var(--game-text-primary)] text-white"
              } else if (isSelected && !isCorrect) {
                // Show wrong selected answer in red
                buttonClasses += " bg-[var(--game-red)] border-[var(--game-text-primary)] text-white"
              } else {
                // Grey out unselected answers with lower opacity
                buttonClasses += " bg-gray-400 border-[var(--game-text-primary)] text-white "
              }
            } else {
              buttonClasses += ` ${style.bgClass} ${style.borderClass} text-white hover:translate-y-[-4px] hover:rotate-[-2deg] hover:shadow-[12px_12px_0px_rgba(0,0,0,0.3)] hover:bg-[var(--game-yellow)] hover:border-[var(--game-text-primary)]`
            }

            return (
              <Button
                key={index}
                onClick={() => handleAnswerSelect(index)}
                disabled={isAnswered}
                className={buttonClasses}
                style={buttonStyle}
                variant="ghost"
              >
                <div className="flex items-center gap-4 w-full">
                  {/* Shape Icon */}
                  <div className="flex-shrink-0">{style.shape}</div>
                  
                  {/* Option Text */}
                  <span className="flex-1 text-left">{option}</span>
                  
                  {/* Letter Label */}
                  <span className="text-3xl font-black opacity-80">{style.label}</span>
                </div>
              </Button>
            )
          })}
        </div>

        {/* Score Display */}
        <div className="text-center">
          <div className="game-label-text text-lg game-shadow-hard-sm inline-block">
            CORRECT: {correctAnswers}/10
          </div>
        </div>
      </div>
    </div>
  )
}

export default RapidFireQuiz
