import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLobby } from '@/hooks/useLobby'
import { useLobbyWebSocket } from '@/hooks/useLobbyWebSocket'

interface PlayerAnswer {
  playerId: string
  playerName: string
  answer: string
  score: number
  feedback: string
}

interface QuestionComparison {
  questionType: 'shared' | 'followup' | 'best_worst' | 'shared_final'
  question: string
  phase: string
  questionId: string
  // For shared questions (Q1, Q4)
  leftAnswer?: PlayerAnswer
  rightAnswer?: PlayerAnswer
  // For follow-up questions (Q2)
  leftFollowUp?: string
  rightFollowUp?: string
  // For best/worst (Q3)
  wrongAnswer?: PlayerAnswer
  bestAnswer?: PlayerAnswer  // Renamed from rightAnswer to avoid duplicate
  wrongQuestion?: string  // Question for wrong answer side
  rightQuestion?: string  // Question for right answer side
  wrongQuip?: string
  rightQuip?: string
}

const Comparison: React.FC = () => {
  const navigate = useNavigate()
  const { lobby, lobbyId, playerId } = useLobby()
  const [comparisons, setComparisons] = useState<QuestionComparison[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [typingLeft, setTypingLeft] = useState(true)
  const [typingRight, setTypingRight] = useState(false)
  const [displayedLeftText, setDisplayedLeftText] = useState('')
  const [displayedRightText, setDisplayedRightText] = useState('')
  const [typingJudgeLeft, setTypingJudgeLeft] = useState(false)
  const [typingJudgeRight, setTypingJudgeRight] = useState(false)
  const [displayedJudgeLeftText, setDisplayedJudgeLeftText] = useState('')
  const [displayedJudgeRightText, setDisplayedJudgeRightText] = useState('')
  const [readyToContinueCount, setReadyToContinueCount] = useState(0)
  const hasLoadedRef = useRef(false)
  const hasSentReadyRef = useRef(false)
  const hasSentContinueRef = useRef(false)

  // Navigate to podium - synchronized with other players
  const navigateToPodium = useCallback(() => {
    console.log('[COMPARISON] Navigating to podium')
    setTimeout(() => {
      navigate('/podium')
    }, 500)
  }, [navigate])

  // Set up WebSocket
  const wsRef = useLobbyWebSocket({
    lobbyId: lobbyId || null,
    enabled: !!lobbyId,
    onLobbyUpdate: () => {},
    onGameStarted: () => {},
    onDisconnect: () => {},
    onKicked: () => {},
    currentPlayerId: playerId || null,
    onGameMessage: (message: any) => {
      if (message.type === 'comparisons_ready') {
        setComparisons(message.comparisons)
        setIsLoading(false)
      }
      
      // Handle synchronization for navigating to podium
      if (message.type === 'player_ready_to_continue_podium') {
        setReadyToContinueCount(message.ready_count || 0)
      }
      
      if (message.type === 'all_ready_to_continue_podium') {
        // All players ready - navigate to podium
        navigateToPodium()
      }
    },
  })

  // Load comparison data from backend
  useEffect(() => {
    if (!hasLoadedRef.current && lobbyId) {
      hasLoadedRef.current = true
      
      // Fetch match summary JSON from backend
      // First get match_id from lobby_id, then fetch summary
      const fetchMatchSummary = async () => {
        try {
          // Get match_id from lobby_id via backend
          const matchResponse = await fetch(`/api/lobby/${lobbyId}/match-id`)
          let matchId = null
          
          if (matchResponse.ok) {
            const matchData = await matchResponse.json()
            matchId = matchData.match_id
          } else {
            // Try alternative: get match from game_state
            const gameStateResponse = await fetch(`/api/lobby/${lobbyId}/game-state`)
            if (gameStateResponse.ok) {
              const gameStateData = await gameStateResponse.json()
              matchId = gameStateData.match_id
            }
          }
          
          if (!matchId) {
            console.warn('[COMPARISON] Could not get match_id, using fallback')
            setComparisons([])
            setIsLoading(false)
            return
          }
          
          const response = await fetch(`/api/match/${matchId}/summary`)
          const data = await response.json()
          
          if (data.comparisons && Array.isArray(data.comparisons)) {
            console.log('[COMPARISON] Loaded match summary:', data.comparisons)
            setComparisons(data.comparisons)
            setIsLoading(false)
          } else if (data.error) {
            console.error('[COMPARISON] Error loading match summary:', data.error)
            // Fallback to empty array if summary not yet generated
            setComparisons([])
            setIsLoading(false)
          } else {
            console.warn('[COMPARISON] Invalid match summary format:', data)
            setComparisons([])
            setIsLoading(false)
          }
        } catch (error) {
          console.error('[COMPARISON] Error fetching match summary:', error)
          setComparisons([])
          setIsLoading(false)
        }
      }
      
      fetchMatchSummary()
      return
    }
    
    // Fallback mock data (only if no lobby/match_id available)
    if (!hasLoadedRef.current && !lobbyId) {
      hasLoadedRef.current = true
      setTimeout(() => {
        const mockComparisons: QuestionComparison[] = [
          // Q1: Shared question
          {
            questionType: 'shared',
            question: "Tell me about a time you faced a difficult challenge at work.",
            phase: "Behavioural",
            questionId: "behavioural_q0",
            leftAnswer: {
              playerId: lobby?.players[0]?.id || "p1",
              playerName: lobby?.players[0]?.name || "Player 1",
              answer: "I implemented a new system that improved efficiency by 40%. I started by analyzing the workflow, identified bottlenecks, and proposed automation solutions.",
              score: 850,
              feedback: "Outstanding communication and clear structure! Your answer demonstrated excellent problem-solving skills."
            },
            rightAnswer: {
              playerId: lobby?.players[1]?.id || "p2",
              playerName: lobby?.players[1]?.name || "Player 2",
              answer: "I... uh... worked on something hard once...",
              score: 250,
              feedback: "A bit vague there! Next time, try adding specific details and concrete examples to make your answer shine."
            }
          },
          // Q2: Follow-up question
          {
            questionType: 'followup',
            question: "Follow-up Questions",
            phase: "Behavioural",
            questionId: "behavioural_q1",
            leftFollowUp: "Can you tell me more about how you handled team resistance?",
            rightFollowUp: "What specific challenge did you face?",
            leftAnswer: {
              playerId: lobby?.players[0]?.id || "p1",
              playerName: lobby?.players[0]?.name || "Player 1",
              answer: "I organized workshops to demonstrate the benefits and addressed concerns one-on-one. This helped build trust and buy-in.",
              score: 820,
              feedback: "Great follow-up! You showed excellent interpersonal skills and problem-solving."
            },
            rightAnswer: {
              playerId: lobby?.players[1]?.id || "p2",
              playerName: lobby?.players[1]?.name || "Player 2",
              answer: "I just tried harder and it worked out.",
              score: 180,
              feedback: "Consider providing more specific examples and details in your follow-up answers."
            }
          },
          // Q3: Best/Worst answers
          {
            questionType: 'best_worst',
            question: "Best and Worst Answers",
            phase: "Technical Theory",
            questionId: "technical_theory_comparison",
            wrongAnswer: {
              playerId: lobby?.players[0]?.id || "p1",
              playerName: lobby?.players[0]?.name || "Player 1",
              answer: "They're all the same, just different ways to declare variables.",
              score: 100,
              feedback: "Not quite! There are important differences."
            },
            bestAnswer: {
              playerId: lobby?.players[1]?.id || "p2",
              playerName: lobby?.players[1]?.name || "Player 2",
              answer: "var has function scope and is hoisted, let and const have block scope. let allows reassignment while const doesn't.",
              score: 900,
              feedback: "Perfect explanation! You covered all the key differences clearly."
            },
            wrongQuestion: "What is the difference between let, const, and var in JavaScript?",
            rightQuestion: "Explain the concept of closures in JavaScript.",
            wrongQuip: "Oops! Looks like someone needs to brush up on JavaScript basics! 😅",
            rightQuip: "Now that's what I call a textbook answer! 📚✨"
          },
          // Q4: Shared question (final)
          {
            questionType: 'shared_final',
            question: "Implement a function to reverse a string.",
            phase: "Technical Practical",
            questionId: "technical_practical_q1",
            leftAnswer: {
              playerId: lobby?.players[0]?.id || "p1",
              playerName: lobby?.players[0]?.name || "Player 1",
              answer: "I would use a for loop... but I'm not sure exactly how.",
              score: 220,
              feedback: "Good start with the approach, but you need to provide actual working code!"
            },
            rightAnswer: {
              playerId: lobby?.players[1]?.id || "p2",
              playerName: lobby?.players[1]?.name || "Player 2",
              answer: "function reverseString(str) { return str.split('').reverse().join(''); }",
              score: 880,
              feedback: "Clean and efficient solution! Great use of built-in methods."
            }
          }
        ]
        setComparisons(mockComparisons)
        setIsLoading(false)
      }, 1000)
    }
  }, [lobby, lobbyId])

  // Typewriter effect for answers
  useEffect(() => {
    if (currentIndex < comparisons.length && comparisons[currentIndex]) {
      const current = comparisons[currentIndex]
      
      // Reset text
      setDisplayedLeftText('')
      setDisplayedRightText('')
      setDisplayedJudgeLeftText('')
      setDisplayedJudgeRightText('')
      setTypingLeft(true)
      setTypingRight(true)
      setTypingJudgeLeft(false)
      setTypingJudgeRight(false)
      
      // Determine what to display based on question type
      let leftAnswerText = ''
      let rightAnswerText = ''
      
      if (current.questionType === 'shared' || current.questionType === 'shared_final') {
        leftAnswerText = current.leftAnswer?.answer || ''
        rightAnswerText = current.rightAnswer?.answer || ''
      } else if (current.questionType === 'followup') {
        leftAnswerText = current.leftAnswer?.answer || ''
        rightAnswerText = current.rightAnswer?.answer || ''
      } else       if (current.questionType === 'best_worst') {
        leftAnswerText = current.wrongAnswer?.answer || ''
        rightAnswerText = current.bestAnswer?.answer || ''
      }
      
      // Typewriter effect for left answer
      let leftIndex = 0
      const leftInterval = setInterval(() => {
        if (leftIndex < leftAnswerText.length) {
          setDisplayedLeftText(leftAnswerText.slice(0, leftIndex + 1))
          leftIndex++
        } else {
          clearInterval(leftInterval)
          setTypingLeft(false)
        }
      }, 30)
      
      // Typewriter effect for right answer
      let rightIndex = 0
      const rightInterval = setInterval(() => {
        if (rightIndex < rightAnswerText.length) {
          setDisplayedRightText(rightAnswerText.slice(0, rightIndex + 1))
          rightIndex++
        } else {
          clearInterval(rightInterval)
          setTypingRight(false)
        }
      }, 30)
      
      return () => {
        clearInterval(leftInterval)
        clearInterval(rightInterval)
      }
    }
  }, [currentIndex, comparisons])

  // Judge typewriter effect - starts after both answers finish
  useEffect(() => {
    if (!typingLeft && !typingRight && currentIndex < comparisons.length && comparisons[currentIndex]) {
      const current = comparisons[currentIndex]
      
      setTypingJudgeLeft(true)
      setTypingJudgeRight(true)
      
      // Determine feedback/quip text
      let leftFeedbackText = ''
      let rightFeedbackText = ''
      
      if (current.questionType === 'shared' || current.questionType === 'shared_final') {
        leftFeedbackText = current.leftAnswer?.feedback || ''
        rightFeedbackText = current.rightAnswer?.feedback || ''
      } else if (current.questionType === 'followup') {
        leftFeedbackText = current.leftAnswer?.feedback || ''
        rightFeedbackText = current.rightAnswer?.feedback || ''
      } else if (current.questionType === 'best_worst') {
        leftFeedbackText = current.wrongQuip || ''
        rightFeedbackText = current.rightQuip || ''
      }
      
      // Typewriter effect for left feedback
      let judgeLeftIndex = 0
      const judgeLeftInterval = setInterval(() => {
        if (judgeLeftIndex < leftFeedbackText.length) {
          setDisplayedJudgeLeftText(leftFeedbackText.slice(0, judgeLeftIndex + 1))
          judgeLeftIndex++
        } else {
          clearInterval(judgeLeftInterval)
          setTypingJudgeLeft(false)
        }
      }, 30)
      
      // Typewriter effect for right feedback
      let judgeRightIndex = 0
      const judgeRightInterval = setInterval(() => {
        if (judgeRightIndex < rightFeedbackText.length) {
          setDisplayedJudgeRightText(rightFeedbackText.slice(0, judgeRightIndex + 1))
          judgeRightIndex++
        } else {
          clearInterval(judgeRightInterval)
          setTypingJudgeRight(false)
        }
      }, 30)
      
      return () => {
        clearInterval(judgeLeftInterval)
        clearInterval(judgeRightInterval)
      }
    }
  }, [typingLeft, typingRight, currentIndex, comparisons])

  // Handle ready for podium - send sync signal (must be after wsRef is defined)
  const handleReadyForPodium = useCallback(() => {
    if (hasSentContinueRef.current || !lobbyId || !playerId) return
    
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log('[COMPARISON] Sending ready_to_continue_podium')
      ws.send(JSON.stringify({
        type: 'ready_to_continue_podium',
        player_id: playerId,
        lobby_id: lobbyId,
        phase: 'comparison'
      }))
      hasSentContinueRef.current = true
    }
  }, [lobbyId, playerId, wsRef])

  // Handle next button click
  const handleNext = useCallback(() => {
    if (currentIndex < comparisons.length - 1) {
      setCurrentIndex(prev => prev + 1)
    } else {
      // Last comparison - send ready signal and navigate
      handleReadyForPodium()
    }
  }, [currentIndex, comparisons.length, handleReadyForPodium])

  // Handle previous button click
  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1)
    }
  }, [currentIndex])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen game-bg">
        <div className="game-paper px-8 py-6 game-shadow-hard-lg">
          <div className="text-2xl font-black">PREPARING COMPARISON...</div>
        </div>
      </div>
    )
  }

  if (comparisons.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen game-bg">
        <div className="game-paper px-8 py-6 game-shadow-hard-lg">
          <div className="text-2xl font-black mb-4">NO COMPARISONS AVAILABLE</div>
          {readyToContinueCount > 0 && (
            <div className="text-sm text-gray-600 mb-4">
              Waiting for players... ({readyToContinueCount} / {lobby?.players.length || 0})
            </div>
          )}
          <button
            onClick={handleReadyForPodium}
            disabled={hasSentContinueRef.current}
            className="game-sharp px-6 py-3 game-button-hover"
            style={{
              border: '4px solid var(--game-text-primary)',
              backgroundColor: hasSentContinueRef.current ? 'var(--game-bg-alt)' : 'var(--game-green)',
              opacity: hasSentContinueRef.current ? 0.6 : 1,
              cursor: hasSentContinueRef.current ? 'not-allowed' : 'pointer',
            }}
          >
            {hasSentContinueRef.current ? 'WAITING FOR OTHERS...' : 'CONTINUE TO RANKINGS'}
          </button>
        </div>
      </div>
    )
  }

  const current = comparisons[currentIndex]
  
  // Determine labels and content based on question type
  const getLeftLabel = () => {
    if (current.questionType === 'followup') {
      return current.leftAnswer?.playerName.toUpperCase() || 'PLAYER 1'
    }
    if (current.questionType === 'best_worst') {
      return 'WRONG ANSWER (EASIEST QUESTION)'
    }
    return current.leftAnswer?.playerName.toUpperCase() || 'PLAYER 1'
  }
  
  const getRightLabel = () => {
    if (current.questionType === 'followup') {
      return current.rightAnswer?.playerName.toUpperCase() || 'PLAYER 2'
    }
    if (current.questionType === 'best_worst') {
      return 'RIGHT ANSWER (HARDEST QUESTION)'
    }
    return current.rightAnswer?.playerName.toUpperCase() || 'PLAYER 2'
  }
  
  const getLeftPlayerName = () => {
    if (current.questionType === 'followup') {
      return current.leftAnswer?.playerName.toUpperCase() || 'PLAYER 1'
    }
    if (current.questionType === 'best_worst') {
      return current.wrongAnswer?.playerName.toUpperCase() || 'PLAYER 1'
    }
    return current.leftAnswer?.playerName.toUpperCase() || 'PLAYER 1'
  }
  
  const getRightPlayerName = () => {
    if (current.questionType === 'best_worst') {
      return current.bestAnswer?.playerName.toUpperCase() || 'PLAYER 2'
    }
    return current.rightAnswer?.playerName.toUpperCase() || 'PLAYER 2'
  }
  
  const getLeftAnswer = () => {
    if (current.questionType === 'best_worst') {
      return current.wrongAnswer
    }
    return current.leftAnswer
  }
  
  const getRightAnswer = () => {
    if (current.questionType === 'best_worst') {
      return current.bestAnswer
    }
    return current.rightAnswer
  }

  return (
    <div className="flex items-center justify-center min-h-screen game-bg relative overflow-hidden">
      {/* Continuous Vertical Line */}
      <div className="absolute top-0 bottom-0 left-1/2 w-2 bg-[var(--game-text-primary)] transform -translate-x-1/2 shadow-[2px_2px_0px_rgba(0,0,0,0.3)]" />

      {/* Title at top */}
      <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-10">
        <div className="game-label-text text-3xl game-shadow-hard">
          ANSWER COMPARISON
        </div>
      </div>

      {/* Question Phase Label */}
      <div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-10">
        <div className="game-paper px-6 py-2 game-shadow-hard">
          <div className="text-sm font-bold text-gray-600">
            {current.questionType === 'shared' ? 'QUESTION 1: SHARED' :
             current.questionType === 'followup' ? 'QUESTION 2: FOLLOW UP' :
             current.questionType === 'best_worst' ? 'QUESTION 3: BEST & WORST' :
             'QUESTION 4: SHARED'}
          </div>
        </div>
      </div>

      {/* Question Display */}
      {(current.questionType === 'shared' || current.questionType === 'shared_final') && (
        <div className="absolute top-36 left-1/2 transform -translate-x-1/2 z-10 w-full max-w-3xl px-8">
          <div className="game-paper px-8 py-4 game-shadow-hard-lg text-center">
            <div className="text-xl font-bold mb-3">{current.question}</div>
            <div className="text-sm text-gray-600">
              Question {currentIndex + 1} of {comparisons.length}
            </div>
          </div>
        </div>
      )}
      

      {/* Main VS Content - Chat Bubble Style - Side by Side */}
      <div className="relative z-10 w-full max-w-[1400px] px-8 mt-16 flex items-start justify-between gap-8">
        {/* Left Side */}
        <div className="w-[42%] animate-stamp-in" style={{ animationDelay: '0.2s' }}>
          {/* Interviewer question for Q2 (follow-up) */}
          {current.questionType === 'followup' && current.leftFollowUp && (
            <div className="mb-4">
              <div className="game-label-text text-xs mb-2 game-shadow-hard-sm bg-gray-700 px-3 py-1 text-white inline-flex items-center gap-2">
                INTERVIEWER
              </div>
              <div className="relative">
                {/* Chat bubble tail pointing left */}
                <div 
                  className="absolute left-0 top-4 w-0 h-0"
                  style={{
                    borderTop: '10px solid transparent',
                    borderBottom: '10px solid transparent',
                    borderRight: '10px solid var(--game-text-primary)',
                    transform: 'translateX(-9px)',
                  }}
                />
                <div className="px-4 py-3 game-sharp game-shadow-hard border-4 border-[var(--game-text-primary)] bg-white">
                  <div className="text-sm leading-relaxed text-[var(--game-text-primary)]">
                    {current.leftFollowUp}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Interviewer question for Q3 (best/worst) */}
          {current.questionType === 'best_worst' && current.wrongQuestion && (
            <div className="mb-4">
              <div className="game-label-text text-xs mb-2 game-shadow-hard-sm bg-gray-700 px-3 py-1 text-white inline-flex items-center gap-2">
                INTERVIEWER
              </div>
              <div className="relative">
                {/* Chat bubble tail pointing left */}
                <div 
                  className="absolute left-0 top-4 w-0 h-0"
                  style={{
                    borderTop: '10px solid transparent',
                    borderBottom: '10px solid transparent',
                    borderRight: '10px solid var(--game-text-primary)',
                    transform: 'translateX(-9px)',
                  }}
                />
                <div className="px-4 py-3 game-sharp game-shadow-hard border-4 border-[var(--game-text-primary)] bg-white">
                  <div className="text-sm leading-relaxed text-[var(--game-text-primary)]">
                    {current.wrongQuestion}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Player name label */}
          <div className="game-label-text text-sm mb-2 game-shadow-hard-sm px-3 py-1 inline-flex items-center gap-2"
            style={{ 
              backgroundColor: current.questionType === 'best_worst' ? 'var(--game-red)' : '#FFD700',
              color: 'white',
              boxShadow: current.questionType === 'best_worst' ? 'none' : '0 0 20px rgba(255, 215, 0, 0.8), 0 0 40px rgba(255, 215, 0, 0.4)'
            }}>
            {getLeftLabel()}
          </div>
          <div className="relative">
            {/* Chat bubble tail pointing left - BLACK */}
            <div 
              className="absolute left-0 top-4 w-0 h-0"
              style={{
                borderTop: '12px solid transparent',
                borderBottom: '12px solid transparent',
                borderRight: '12px solid var(--game-text-primary)',
                transform: 'translateX(-11px)',
              }}
            />
            <div className="px-6 py-4 game-sharp game-shadow-hard-lg border-4 border-[var(--game-text-primary)]"
              style={{ backgroundColor: current.questionType === 'best_worst' ? 'var(--game-red)' : 'var(--game-blue)' }}>
              <div className="text-base leading-relaxed font-semibold text-white">
                {displayedLeftText}
                {typingLeft && <span className="inline-block w-1 h-5 bg-white ml-1 animate-blink" />}
              </div>
            </div>
          </div>
          
          {/* Judge Reply / Quip */}
          {!typingLeft && !typingRight && (
            <div className="mt-4">
              <div className="game-label-text text-xs mb-2 game-shadow-hard-sm bg-gray-700 px-3 py-1 text-white inline-flex items-center gap-2">
                {current.questionType === 'best_worst' ? 'QUIP' : 'JUDGE'}
              </div>
              <div className="relative">
                {/* Chat bubble tail pointing left */}
                <div 
                  className="absolute left-0 top-4 w-0 h-0"
                  style={{
                    borderTop: '10px solid transparent',
                    borderBottom: '10px solid transparent',
                    borderRight: '10px solid var(--game-text-primary)',
                    transform: 'translateX(-9px)',
                  }}
                />
                <div className="px-4 py-3 game-sharp game-shadow-hard border-4 border-[var(--game-text-primary)] bg-white">
                  <div className="text-sm leading-relaxed text-[var(--game-text-primary)]">
                    {displayedJudgeLeftText}
                    {typingJudgeLeft && <span className="inline-block w-1 h-4 bg-[var(--game-text-primary)] ml-1 animate-blink" />}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side */}
        <div className="w-[42%] animate-stamp-in" style={{ animationDelay: '0.2s' }}>
          {/* Interviewer question for Q2 (follow-up) */}
          {current.questionType === 'followup' && current.rightFollowUp && (
            <div className="mb-4">
              <div className="text-right mb-2">
                <div className="game-label-text text-xs game-shadow-hard-sm bg-gray-700 px-3 py-1 text-white inline-flex items-center gap-2">
                  INTERVIEWER
                </div>
              </div>
              <div className="relative">
                {/* Chat bubble tail pointing right */}
                <div 
                  className="absolute right-0 top-4 w-0 h-0"
                  style={{
                    borderTop: '10px solid transparent',
                    borderBottom: '10px solid transparent',
                    borderLeft: '10px solid var(--game-text-primary)',
                    transform: 'translateX(9px)',
                  }}
                />
                <div className="px-4 py-3 game-sharp game-shadow-hard border-4 border-[var(--game-text-primary)] bg-white">
                  <div className="text-sm leading-relaxed text-[var(--game-text-primary)]">
                    {current.rightFollowUp}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Interviewer question for Q3 (best/worst) */}
          {current.questionType === 'best_worst' && current.rightQuestion && (
            <div className="mb-4">
              <div className="text-right mb-2">
                <div className="game-label-text text-xs game-shadow-hard-sm bg-gray-700 px-3 py-1 text-white inline-flex items-center gap-2">
                  INTERVIEWER
                </div>
              </div>
              <div className="relative">
                {/* Chat bubble tail pointing right */}
                <div 
                  className="absolute right-0 top-4 w-0 h-0"
                  style={{
                    borderTop: '10px solid transparent',
                    borderBottom: '10px solid transparent',
                    borderLeft: '10px solid var(--game-text-primary)',
                    transform: 'translateX(9px)',
                  }}
                />
                <div className="px-4 py-3 game-sharp game-shadow-hard border-4 border-[var(--game-text-primary)] bg-white">
                  <div className="text-sm leading-relaxed text-[var(--game-text-primary)]">
                    {current.rightQuestion}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="text-right mb-2">
            <div className="game-label-text text-sm game-shadow-hard-sm px-3 py-1 text-white inline-flex items-center gap-2"
              style={{ 
                backgroundColor: current.questionType === 'best_worst' ? 'var(--game-green)' : 'var(--game-red)',
              }}>
              {getRightLabel()}
            </div>
          </div>
          <div className="relative">
            {/* Chat bubble tail pointing right - BLACK */}
            <div 
              className="absolute right-0 top-4 w-0 h-0"
              style={{
                borderTop: '12px solid transparent',
                borderBottom: '12px solid transparent',
                borderLeft: '12px solid var(--game-text-primary)',
                transform: 'translateX(11px)',
              }}
            />
            <div className="px-6 py-4 game-sharp game-shadow-hard-lg border-4 border-[var(--game-text-primary)]"
              style={{ backgroundColor: current.questionType === 'best_worst' ? 'var(--game-green)' : 'var(--game-red)' }}>
              <div className="text-base leading-relaxed font-semibold text-white">
                {displayedRightText}
                {typingRight && <span className="inline-block w-1 h-5 bg-white ml-1 animate-blink" />}
              </div>
            </div>
          </div>
          
          {/* Judge Reply / Quip */}
          {!typingLeft && !typingRight && (
            <div className="mt-4">
              <div className="text-right mb-2">
                <div className="game-label-text text-xs game-shadow-hard-sm bg-gray-700 px-3 py-1 text-white inline-flex items-center gap-2">
                  {current.questionType === 'best_worst' ? 'QUIP' : 'JUDGE'}
                </div>
              </div>
              <div className="relative">
                {/* Chat bubble tail pointing right */}
                <div 
                  className="absolute right-0 top-4 w-0 h-0"
                  style={{
                    borderTop: '10px solid transparent',
                    borderBottom: '10px solid transparent',
                    borderLeft: '10px solid var(--game-text-primary)',
                    transform: 'translateX(9px)',
                  }}
                />
                <div className="px-4 py-3 game-sharp game-shadow-hard border-4 border-[var(--game-text-primary)] bg-white">
                  <div className="text-sm leading-relaxed text-[var(--game-text-primary)]">
                    {displayedJudgeRightText}
                    {typingJudgeRight && <span className="inline-block w-1 h-4 bg-[var(--game-text-primary)] ml-1 animate-blink" />}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* VS in Circle - Fixed position to not overlap */}
      <div className="flex items-center justify-center fixed left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-stamp-in-vs pointer-events-none" style={{ animationDelay: '0.3s' }}>
        <div className="rounded-full flex items-center justify-center w-[140px] h-[140px] bg-gradient-to-br from-yellow-300 via-[var(--game-yellow)] to-orange-400 border-[8px] border-[var(--game-text-primary)] shadow-[8px_8px_0px_rgba(0,0,0,0.4)]">
          <div className="text-[4rem] font-black text-[var(--game-text-primary)] leading-none drop-shadow-lg" style={{ fontFamily: 'Impact, sans-serif' }}>
            VS
          </div>
        </div>
      </div>

      {/* Navigation Buttons - positioned at bottom */}
      <div className="fixed bottom-8 w-full max-w-[1400px] px-8 left-1/2 transform -translate-x-1/2 z-10 flex justify-between">
        <button
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          className="game-sharp px-8 py-4 text-base font-black uppercase tracking-widest game-shadow-hard-lg game-button-hover"
          style={{
            border: '4px solid var(--game-text-primary)',
            backgroundColor: currentIndex === 0 ? 'var(--game-bg-alt)' : '#FF1493',
            color: 'white',
            cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
            opacity: currentIndex === 0 ? 0.5 : 1,
          }}
        >
          PREVIOUS
        </button>
        <button
          onClick={handleNext}
          disabled={hasSentContinueRef.current && currentIndex === comparisons.length - 1}
          className="game-sharp px-8 py-4 text-base font-black uppercase tracking-widest game-shadow-hard-lg game-button-hover"
          style={{
            border: '4px solid var(--game-text-primary)',
            backgroundColor: (hasSentContinueRef.current && currentIndex === comparisons.length - 1) ? 'var(--game-bg-alt)' : 'var(--game-green)',
            color: 'var(--game-text-white)',
            opacity: (hasSentContinueRef.current && currentIndex === comparisons.length - 1) ? 0.6 : 1,
            cursor: (hasSentContinueRef.current && currentIndex === comparisons.length - 1) ? 'not-allowed' : 'pointer',
          }}
        >
          {currentIndex < comparisons.length - 1 
            ? 'NEXT' 
            : hasSentContinueRef.current 
              ? `WAITING FOR OTHERS... (${readyToContinueCount}/${lobby?.players.length || 0})`
              : 'VIEW RANKINGS'}
        </button>
      </div>
    </div>
  )
}

export default Comparison
