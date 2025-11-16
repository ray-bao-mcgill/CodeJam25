import React, { useState, useEffect, useRef } from 'react'
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

// Lives Component
const Lives: React.FC<{ lives: number }> = ({ lives }) => {
  return (
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
  )
}

// Timer Component
const Timer: React.FC<{ timeRemaining: number }> = ({ timeRemaining }) => {
  return (
    <div
      className={`w-20 h-20 flex items-center justify-center text-4xl font-black game-sharp game-shadow-hard border-4 border-[var(--game-text-primary)] text-white ${
        timeRemaining <= 30 ? 'bg-[var(--game-red)]' : 'bg-[var(--game-blue)]'
      }`}
      style={{ fontFamily: 'Arial Black, sans-serif' }}
    >
      {timeRemaining}
    </div>
  )
}

// Answer Button Component
const AnswerButton: React.FC<{
  option: MultipleChoiceOption
  index: number
  onClick: () => void
  disabled: boolean
  showFeedback: boolean
  isCorrect: boolean
  isSelected: boolean
  correctAnswerId?: string
}> = ({ option, index, onClick, disabled, showFeedback, isCorrect, isSelected, correctAnswerId }) => {
  // Define colors and shapes for each option - matching RapidFireQuiz exactly
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
  const isCorrectAnswer = correctAnswerId === option.id
  
  let buttonClasses = `py-8 px-6 text-xl font-bold game-sharp game-shadow-hard transition-all duration-200 relative overflow-visible border-8`
  let buttonStyle: React.CSSProperties = {
    fontFamily: 'Arial, sans-serif',
    minHeight: '120px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: 1 // Force full opacity always
  }

  if (showFeedback) {
    if (isCorrectAnswer) {
      // Show correct answer in green
      buttonClasses += " bg-[var(--game-green)] border-[var(--game-text-primary)] text-white"
    } else if (isSelected && !isCorrect) {
      // Show wrong selected answer in red
      buttonClasses += " bg-[var(--game-red)] border-[var(--game-text-primary)] text-white"
    } else {
      // Grey out unselected answers
      buttonClasses += " bg-gray-400 border-[var(--game-text-primary)] text-white"
    }
  } else {
    buttonClasses += ` ${style.bgClass} ${style.borderClass} text-white hover:translate-y-[-4px] hover:rotate-[-2deg] hover:shadow-[12px_12px_0px_rgba(0,0,0,0.3)] hover:bg-[var(--game-yellow)] hover:border-[var(--game-text-primary)]`
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={buttonClasses}
      style={buttonStyle}
    >
      <div className="flex items-center gap-4 w-full">
        {/* Shape Icon */}
        <div className="flex-shrink-0">{style.shape}</div>
        
        {/* Option Text */}
        <span className="flex-1 text-left">{option.label}</span>
        
        {/* Letter Label */}
        <span className="text-3xl font-black opacity-80">{style.label}</span>
      </div>
    </button>
  )
}

const TechnicalTheoryRound: React.FC = () => {
  const navigate = useNavigate()
  const { submitTechnicalTheoryAnswer } = useGameFlow()
  const { lobbyId, playerId, lobby } = useLobby()
  const { gameState, submitAnswer: syncSubmitAnswer, showResults, timeRemaining } = useGameSync()
  const [questions, setQuestions] = useState<TechnicalTheoryQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [submittedQuestions, setSubmittedQuestions] = useState<Set<number>>(new Set())
  const [finishedAllQuestions, setFinishedAllQuestions] = useState(false)
  const [finishedPlayersCount, setFinishedPlayersCount] = useState(0)
  const [totalPlayersCount, setTotalPlayersCount] = useState(0)
  const [playerProgress, setPlayerProgress] = useState<Record<string, { submitted: number; total: number; percentage: number; correct: number }>>({})
  const [correctAnswers, setCorrectAnswers] = useState<Set<number>>(new Set())
  const [lives, setLives] = useState(2)
  const [isDead, setIsDead] = useState(false)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const hasRequestedQuestionsRef = useRef(false)
  
  // Helper function to convert backend question format to frontend format
  const convertQuestionToFrontendFormat = (
    question: string,
    correctAnswer: string,
    incorrectAnswers: string[]
  ): TechnicalTheoryQuestion => {
    // Combine correct and incorrect answers, then shuffle
    const allAnswers = [correctAnswer, ...incorrectAnswers]
    const shuffled = [...allAnswers].sort(() => Math.random() - 0.5)
    
    // Map to options with IDs A, B, C, D
    const colors: Array<'red' | 'blue' | 'yellow' | 'green'> = ['red', 'blue', 'yellow', 'green']
    const options: MultipleChoiceOption[] = shuffled.map((answer, idx) => ({
      id: String.fromCharCode(65 + idx), // A, B, C, D
      label: answer,
      color: colors[idx]
    }))
    
    // Find which option ID corresponds to the correct answer
    const correctOptionId = options.find(opt => opt.label === correctAnswer)?.id || 'A'
    
    return {
      question,
      options,
      correctAnswer: correctOptionId
    }
  }
  
  const wsRef = useLobbyWebSocket({
    lobbyId: lobbyId || null,
    enabled: !!lobbyId,
    onLobbyUpdate: () => {},
    onGameStarted: () => {},
    onDisconnect: () => {},
    onKicked: () => {},
    currentPlayerId: playerId || null,
    onGameMessage: (message: any) => {
      console.log('[TECHNICAL_THEORY] Received WebSocket message:', message.type, message)
      
      // Handle all questions loaded at once
      if (message.type === 'technical_theory_questions_loaded') {
        console.log('[TECHNICAL_THEORY] Received questions from backend:', message.questions?.length || 0)
        if (!message.questions || message.questions.length === 0) {
          console.error('[TECHNICAL_THEORY] Received empty questions array!')
          return
        }
        // Sort questions by question_index to ensure correct order
        const sortedBackendQuestions = [...message.questions].sort((a: any, b: any) => 
          (a.question_index || 0) - (b.question_index || 0)
        )
        const convertedQuestions: TechnicalTheoryQuestion[] = sortedBackendQuestions.map((q: any) =>
          convertQuestionToFrontendFormat(
            q.question,
            q.correct_answer,
            q.incorrect_answers || []
          )
        )
        setQuestions(convertedQuestions)
        setIsLoading(false)
        hasRequestedQuestionsRef.current = true // Mark as successfully requested
        console.log('[TECHNICAL_THEORY] Successfully loaded', convertedQuestions.length, 'questions')
      }
      // Handle individual question received (fallback)
      else if (message.type === 'question_received' && message.phase === 'technical_theory') {
        console.log('[TECHNICAL_THEORY] Received question_received message:', {
          hasCorrectAnswer: !!message.correct_answer,
          hasIncorrectAnswers: !!message.incorrect_answers,
          questionIndex: message.question_index
        })
        
        // If we receive question_index 0 without answer fields, we need to request all questions
        // This happens when backend sends a single question before broadcasting all questions
        if (message.question_index === 0 && (!message.correct_answer || !message.incorrect_answers)) {
          console.warn('[TECHNICAL_THEORY] Received question 0 without answer fields, requesting all questions')
          // Reset request flag and request again
          hasRequestedQuestionsRef.current = false
          const ws = wsRef.current
          if (ws && ws.readyState === WebSocket.OPEN && lobbyId && playerId) {
            setTimeout(() => {
              ws.send(JSON.stringify({
                type: 'request_question',
                player_id: playerId,
                lobby_id: lobbyId,
                phase: 'technical_theory',
                question_index: 0
              }))
            }, 500) // Small delay to avoid race condition
          }
          return
        }
        
        if (message.correct_answer && message.incorrect_answers) {
          const converted = convertQuestionToFrontendFormat(
            message.question,
            message.correct_answer,
            message.incorrect_answers
          )
          // If we don't have all questions yet, add this one
          setQuestions(prev => {
            const newQuestions = [...prev]
            const idx = message.question_index || 0
            newQuestions[idx] = converted
            return newQuestions
          })
          setIsLoading(false)
        } else {
          console.warn('[TECHNICAL_THEORY] Received question_received without answer fields, ignoring')
        }
      }
      // Handle player finished technical theory
      else if (message.type === 'player_finished_technical_theory') {
        console.log('[TECHNICAL_THEORY] Player finished:', message.player_id, 'Total finished:', message.total_finished, '/', message.total_players)
        setFinishedPlayersCount(message.total_finished || 0)
        setTotalPlayersCount(message.total_players || 0)
      }
      // Handle show results (phase complete)
      else if (message.type === 'show_results' && message.phase === 'technical_theory') {
        console.log('[TECHNICAL_THEORY] Show results received, phaseComplete:', message.phaseComplete)
        if (message.phaseComplete) {
          setFinishedPlayersCount(message.total_players || totalPlayersCount)
        }
      }
      // Handle player progress updates
      else if (message.type === 'player_submitted' && message.phase === 'technical_theory' && message.player_progress) {
        console.log('[TECHNICAL_THEORY] Player progress update:', message.player_progress)
        setPlayerProgress(message.player_progress)
      }
      // Handle answer correctness feedback
      else if (message.type === 'answer_scored' && message.phase === 'technical_theory') {
        if (message.is_correct && message.question_index !== undefined) {
          setCorrectAnswers(prev => new Set([...prev, message.question_index]))
        }
      }
    },
  })

  // Request questions from backend when component mounts
  useEffect(() => {
    // Don't request if questions are already loaded
    if (questions.length > 0) {
      console.log('[TECHNICAL_THEORY] Questions already loaded, skipping request')
      hasRequestedQuestionsRef.current = true // Mark as requested since we have questions
      return
    }
    
    if (!lobbyId || !playerId) return
    
    // Reset request flag if we don't have questions yet (allows retry)
    if (hasRequestedQuestionsRef.current && questions.length === 0 && !isLoading) {
      console.log('[TECHNICAL_THEORY] No questions received after request, resetting flag for retry')
      hasRequestedQuestionsRef.current = false
    }
    
    if (hasRequestedQuestionsRef.current) return
    
    const requestQuestions = () => {
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        return false
      }
      
      if (hasRequestedQuestionsRef.current) {
        return true // Already requested
      }
      
      console.log('[TECHNICAL_THEORY] Requesting question 0 (will trigger loading all 10 questions)')
      hasRequestedQuestionsRef.current = true
      ws.send(JSON.stringify({
        type: 'request_question',
        player_id: playerId,
        lobby_id: lobbyId,
        phase: 'technical_theory',
        question_index: 0
      }))
      return true
    }
    
    // Wait for connection with retry logic
    let checkInterval: ReturnType<typeof setInterval> | null = null
    let retryTimeout: ReturnType<typeof setTimeout> | null = null
    let questionRetryTimeout: ReturnType<typeof setTimeout> | null = null
    let wsOpenHandler: ((event: Event) => void) | null = null
    
    const setupRetry = () => {
      checkInterval = setInterval(() => {
        if (requestQuestions()) {
          if (checkInterval) {
            clearInterval(checkInterval)
            checkInterval = null
          }
          if (retryTimeout) {
            clearTimeout(retryTimeout)
            retryTimeout = null
          }
        }
      }, 100)
      
      // Stop checking after 10 seconds
      retryTimeout = setTimeout(() => {
        if (checkInterval) {
          clearInterval(checkInterval)
          checkInterval = null
        }
        if (!hasRequestedQuestionsRef.current) {
          console.warn('[TECHNICAL_THEORY] Failed to request questions after 10 seconds')
          // Reset flag to allow retry
          hasRequestedQuestionsRef.current = false
        }
      }, 10000)
    }
    
    // Set up a timeout to retry if no questions received after 3 seconds
    questionRetryTimeout = setTimeout(() => {
      if (questions.length === 0 && hasRequestedQuestionsRef.current && isLoading) {
        console.warn('[TECHNICAL_THEORY] No questions received after 3 seconds, retrying request')
        hasRequestedQuestionsRef.current = false
        // The effect will re-run and retry the request
      }
    }, 3000)
    
    // Also listen for WebSocket open event
    const ws = wsRef.current
    if (ws) {
      wsOpenHandler = () => {
        console.log('[TECHNICAL_THEORY] WebSocket opened, requesting questions')
        if (requestQuestions()) {
          if (checkInterval) {
            clearInterval(checkInterval)
            checkInterval = null
          }
          if (retryTimeout) {
            clearTimeout(retryTimeout)
            retryTimeout = null
          }
        }
      }
      
      if (ws.readyState === WebSocket.OPEN) {
        // Already open, request immediately
        if (requestQuestions()) {
          // Request sent successfully, but still set up retry timeout in case response doesn't come
        }
      } else if (ws.readyState === WebSocket.CONNECTING) {
        // Still connecting, wait for open event
        ws.addEventListener('open', wsOpenHandler, { once: true })
        setupRetry() // Also set up interval as backup
      } else {
        // Not connected, set up retry
        setupRetry()
      }
    } else {
      // WebSocket ref not available yet, set up retry
      setupRetry()
    }
    
    // Single cleanup function for all timeouts/intervals
    return () => {
      if (checkInterval) {
        clearInterval(checkInterval)
        checkInterval = null
      }
      if (retryTimeout) {
        clearTimeout(retryTimeout)
        retryTimeout = null
      }
      if (questionRetryTimeout) {
        clearTimeout(questionRetryTimeout)
        questionRetryTimeout = null
      }
      if (ws && wsOpenHandler) {
        ws.removeEventListener('open', wsOpenHandler)
        wsOpenHandler = null
      }
    }
  }, [lobbyId, playerId, wsRef, questions.length, isLoading])

  // Update total players count from lobby
  useEffect(() => {
    if (lobby?.players.length) {
      setTotalPlayersCount(lobby.players.length)
    }
  }, [lobby?.players.length])

  // Check if all questions are submitted (only if not dead)
  useEffect(() => {
    if (isDead) return // Don't check if dead
    
    const totalQuestions = questions.length
    if (totalQuestions > 0 && submittedQuestions.size === totalQuestions && !finishedAllQuestions) {
      console.log('[TECHNICAL_THEORY] All questions submitted, notifying server')
      // Finished all questions - notify server
      // Don't update finishedPlayersCount here - wait for backend confirmation
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN && playerId && lobbyId) {
        ws.send(JSON.stringify({
          type: 'technical_theory_finished',
          player_id: playerId,
          lobby_id: lobbyId
        }))
        setFinishedAllQuestions(true)
        console.log('[TECHNICAL_THEORY] Sent finished message to server')
      }
    }
  }, [submittedQuestions.size, questions.length, finishedAllQuestions, isDead, playerId, lobbyId, wsRef])

  // Navigate when server says all players finished (phase complete)
  useEffect(() => {
    if (showResults && gameState?.showResults && gameState?.phaseComplete && gameState?.phase === 'technical_theory') {
      console.log('[TECHNICAL_THEORY] Phase complete, navigating to results')
      sessionStorage.setItem('currentRound', 'technical-theory')
      setTimeout(() => {
        navigate('/current-score')
      }, 500)
    }
  }, [showResults, gameState?.showResults, gameState?.phaseComplete, gameState?.phase, navigate])

  // Ensure currentIndex is valid
  const safeCurrentIndex = Math.min(currentIndex, questions.length - 1)
  const currentQuestion = questions.length > 0 && safeCurrentIndex >= 0 ? questions[safeCurrentIndex] : null

  // Reset feedback when question changes (must be before conditional returns)
  useEffect(() => {
    setShowFeedback(false)
    setSelectedOption(null)
  }, [currentIndex])

  const handleSubmit = async (selectedOptionId: string) => {
    // Safety checks
    if (!questions.length || currentIndex < 0 || currentIndex >= questions.length) {
      console.error('[TECHNICAL_THEORY] Invalid question index:', currentIndex)
      return
    }
    
    // Don't allow resubmitting the same question, submitting if already finished, or if dead
    if (submittedQuestions.has(currentIndex) || finishedAllQuestions || isDead) {
      return
    }

    const currentQuestion = questions[currentIndex]
    if (!currentQuestion) {
      console.error('[TECHNICAL_THEORY] No question at index:', currentIndex)
      return
    }
    
    const isCorrect = selectedOptionId === currentQuestion.correctAnswer
    
    // Track correct answer locally
    if (isCorrect) {
      setCorrectAnswers(prev => new Set([...prev, currentIndex]))
    } else {
      // Wrong answer - lose a life
      const newLives = Math.max(0, lives - 1)
      console.log(`[TECHNICAL_THEORY] Wrong answer! Lives: ${lives} -> ${newLives}`)
      setLives(newLives)
      
      if (newLives <= 0) {
        // Player is dead - mark as dead and send finish state
        console.log('[TECHNICAL_THEORY] Player is DEAD!')
        setIsDead(true)
        setFinishedAllQuestions(true)
        
        // Notify server that this player is finished (dead)
        // Mark all remaining questions as submitted so backend knows player is done
        const totalQuestions = questions.length
        const newSubmittedSet = new Set(submittedQuestions)
        for (let i = currentIndex; i < totalQuestions; i++) {
          newSubmittedSet.add(i)
        }
        setSubmittedQuestions(newSubmittedSet)
        
        // Send finish message via WebSocket (mark as dead)
        if (lobbyId && playerId && wsRef.current) {
          const ws = wsRef.current
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'technical_theory_finished',
              player_id: playerId,
              lobby_id: lobbyId,
              is_dead: true  // Mark as dead so backend knows
            }))
            console.log('[TECHNICAL_THEORY] Sent finish message to server (dead)')
          }
        }
        
        // Don't advance to next question - player is dead
        return
      }
    }
    
    await submitTechnicalTheoryAnswer(selectedOptionId, currentIndex)
    // Submit via sync with phase information
    syncSubmitAnswer(selectedOptionId, `technical_theory_q${currentIndex}`, 'technical_theory', currentIndex)
    
    // Mark this question as submitted
    const newSubmittedSet = new Set(submittedQuestions)
    newSubmittedSet.add(currentIndex)
    setSubmittedQuestions(newSubmittedSet)
    
    // Advance to next question after feedback delay (feedback is shown in MultipleChoice component)
    // The MultipleChoice component handles the 1.5s feedback delay, so we advance after that
    const totalQuestions = questions.length
    
    // Check if this was the last question
    if (currentIndex >= totalQuestions - 1) {
      // This was the last question - check if we should send finish message
      console.log('[TECHNICAL_THEORY] Last question submitted, checking completion')
      // Wait for state to update, then check completion
      setTimeout(() => {
        if (newSubmittedSet.size >= totalQuestions && !finishedAllQuestions && !isDead) {
          console.log('[TECHNICAL_THEORY] All questions completed, sending finish message')
          if (lobbyId && playerId && wsRef.current) {
            const ws = wsRef.current
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'technical_theory_finished',
                player_id: playerId,
                lobby_id: lobbyId,
                is_dead: false  // Not dead, just finished all questions
              }))
              setFinishedAllQuestions(true)
              console.log('[TECHNICAL_THEORY] Sent finished message to server')
            }
          }
        }
      }, 100) // Small delay to ensure state is updated
    } else {
      // Not the last question - advance to next
      setTimeout(() => {
        setCurrentIndex(prev => Math.min(prev + 1, totalQuestions - 1))
      }, 1800) // Wait for feedback (1500ms) + transition (300ms)
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

  // Show game over placeholder if player is dead
  if (isDead) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 game-bg">
        <div className="game-paper px-12 py-8 game-shadow-hard-lg border-4 border-[var(--game-text-primary)]">
          <h2 className="text-4xl font-black text-[var(--game-text-primary)] mb-4 text-center">GAME OVER</h2>
          <p className="text-xl text-[var(--game-text-primary)] text-center">
            You've run out of lives. Waiting for other players to finish...
          </p>
          <p className="text-sm text-gray-600 text-center mt-4">
            {finishedPlayersCount || 0} / {totalPlayersCount || lobby?.players.length || 0} players finished
          </p>
        </div>
      </div>
    )
  }

  // Safety check - don't render if no questions
  if (!currentQuestion) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 game-bg">
        <div className="game-paper px-8 py-4 game-shadow-hard-lg">
          <div className="text-lg font-bold">No questions available</div>
        </div>
      </div>
    )
  }

  const handleAnswerClick = async (optionId: string) => {
    if (submittedQuestions.has(safeCurrentIndex) || finishedAllQuestions || isDead || selectedOption !== null) return
    
    const correct = optionId === currentQuestion.correctAnswer
    setIsCorrect(correct)
    setSelectedOption(optionId)
    setShowFeedback(true)
    
    // Show feedback for 1.5 seconds before submitting
    setTimeout(async () => {
      await handleSubmit(optionId)
      // Reset feedback after a brief delay
      setTimeout(() => {
        setShowFeedback(false)
        setSelectedOption(null)
      }, 300)
    }, 1500)
  }

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

        {/* Header with Lives and Timer */}
        <div className="flex justify-between items-center px-4">
          {/* Lives */}
          <Lives lives={lives} />

          {/* Timer */}
          <Timer timeRemaining={timeRemaining || 180} />
        </div>

        {/* Question */}
        <div className="text-center py-8 px-8 game-paper game-sharp game-shadow-hard border-4 border-[var(--game-text-primary)]">
          <h2 className="text-3xl font-black text-[var(--game-text-primary)] leading-[1.4]" style={{ fontFamily: 'Arial, sans-serif' }}>
            {currentQuestion.question}
          </h2>
        </div>

        {/* Answer Options Grid */}
        <div className="grid grid-cols-2 gap-6">
          {currentQuestion.options.map((option, index) => (
            <AnswerButton
              key={option.id}
              option={option}
              index={index}
              onClick={() => handleAnswerClick(option.id)}
              disabled={submittedQuestions.has(safeCurrentIndex) || finishedAllQuestions || isDead || showFeedback}
              showFeedback={showFeedback}
              isCorrect={isCorrect && selectedOption === option.id}
              isSelected={selectedOption === option.id}
              correctAnswerId={currentQuestion.correctAnswer}
            />
          ))}
        </div>

        {/* Score Display */}
        <div className="text-center">
          <div className="game-label-text text-lg game-shadow-hard-sm inline-block">
            CORRECT: {correctAnswers.size}/{questions.length}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TechnicalTheoryRound
