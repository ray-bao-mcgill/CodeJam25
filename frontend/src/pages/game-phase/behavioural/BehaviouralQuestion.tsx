import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useGameSync } from '@/hooks/useGameSync'
import { useLobby } from '@/hooks/useLobby'
import { useLobbyWebSocket } from '@/hooks/useLobbyWebSocket'

const QUESTION_DISPLAY_SECONDS = 30;

const BehaviouralQuestion: React.FC = () => {
  const navigate = useNavigate();
  const { lobby, lobbyId, playerId } = useLobby()
  const { gameState, showResults } = useGameSync()
  const [remaining, setRemaining] = useState(QUESTION_DISPLAY_SECONDS);
  const [question, setQuestion] = useState<string>("Loading question...");
  const [isLoading, setIsLoading] = useState(true);
  // Initialize questionIndex from sessionStorage if Q0 is already complete
  const initialQuestionIndex = sessionStorage.getItem("behavioural_q0_complete") === "true" ? 1 : 0;
  const [questionIndex, setQuestionIndex] = useState(initialQuestionIndex); // 0 = Q0, 1 = Q1
  const [waitingForFollowups, setWaitingForFollowups] = useState(false);
  // Set loading message based on initial question index
  const [loadingMessage, setLoadingMessage] = useState<string>(
    initialQuestionIndex === 1 ? "Waiting for players..." : "Loading question..."
  );
  const [skipConfirmations, setSkipConfirmations] = useState<Set<string>>(new Set());
  const [skipTotalPlayers, setSkipTotalPlayers] = useState<number>(0);
  const hasRequestedRef = useRef<Record<number, boolean>>({})
  
  console.log(`[BEHAVIOURAL_Q] Component mounted with initial questionIndex=${initialQuestionIndex}`)
  
  // Determine if all players have submitted Q0
  const submittedCount = gameState?.submittedPlayers?.length || 0
  const totalPlayers = lobby?.players.length || 0
  const allPlayersSubmittedQ0 = submittedCount >= totalPlayers

  // Set up WebSocket for skip synchronization and question receiving
  const wsRef = useLobbyWebSocket({
    lobbyId: lobbyId || null,
    enabled: !!lobbyId,
    onLobbyUpdate: () => {},
    onGameStarted: () => {},
    onDisconnect: () => {},
    onKicked: () => {},
    currentPlayerId: playerId || null,
    onGameMessage: (message: any) => {
      // Handle skip confirmation
      if (message.type === 'behavioural_question_skip_confirmed') {
        setSkipConfirmations(prev => new Set([...prev, message.player_id]))
        setSkipTotalPlayers(message.total_players || 0)
      }
      
      // Handle skip execution (all players confirmed)
      if (message.type === 'behavioural_question_skipped') {
        navigate('/behavioural-answer')
      }
      // When Q0 is complete, server will broadcast show_results with phaseComplete=false
      // Mark Q0 as complete in sessionStorage
      // Only process if we're currently on Q0 (questionIndex === 0) to avoid processing stale messages
      if (message.type === 'show_results' && message.phase === 'behavioural' && !message.phaseComplete) {
        // Use functional update to get current questionIndex
        setQuestionIndex(currentIndex => {
          if (currentIndex === 0) {
            console.log('[BEHAVIOURAL_Q] Received Q0 complete signal, marking in sessionStorage and moving to Q1')
            sessionStorage.setItem('behavioural_q0_complete', 'true')
            return 1
          } else {
            console.log(`[BEHAVIOURAL_Q] Ignoring stale Q0 complete signal (already on Q${currentIndex})`)
            return currentIndex
          }
        })
      }
      // If phase is complete, navigate to answer page (which will then navigate to results)
      if (message.type === 'show_results' && message.phase === 'behavioural' && message.phaseComplete) {
        console.log('[BEHAVIOURAL_Q] Phase complete signal received, navigating to answer page')
        // Navigate to answer page - it will handle navigation to results
        setTimeout(() => {
          navigate('/behavioural-answer')
        }, 500)
      }
      // Handle question generation status
      if (message.type === 'question_generating' && message.phase === 'behavioural' && message.question_index === 1) {
        // Only show loading for this player's question
        if (message.player_id === playerId) {
          console.log('[BEHAVIOURAL_Q] Question is being generated, showing loading state')
          setIsLoading(true)
          setWaitingForFollowups(true)
          setLoadingMessage(message.message || "Considering your response...")
        }
      }
      
      // When all players submit Q0, update message if we're waiting
      // This will be handled by the useEffect that watches gameState.submittedPlayers
      
      // Receive question from server
      if (message.type === 'question_received' && message.phase === 'behavioural') {
        const receivedIndex = message.question_index ?? 0
        
        // For Q1 (follow-up), check if it's personalized for this player
        if (receivedIndex === 1 && message.player_id) {
          // Personalized follow-up - only process if it's for this player
          if (message.player_id === playerId) {
            console.log('[BEHAVIOURAL_Q] Received personalized follow-up question:', message.question)
            setQuestion(message.question)
            setIsLoading(false)
            // Still waiting for other players' follow-ups to be generated
            setWaitingForFollowups(true)
          } else if (message.player_id !== playerId) {
            console.log('[BEHAVIOURAL_Q] Ignoring follow-up for different player:', message.player_id)
          }
        } else if (receivedIndex === questionIndex) {
          // Q0 question (shared) - process normally
          if (isLoading || !question) {
            console.log('[BEHAVIOURAL_Q] Received question from server:', message.question, 'index:', receivedIndex)
            setQuestion(message.question)
            setIsLoading(false)
          } else {
            console.log('[BEHAVIOURAL_Q] Ignoring duplicate question (already loaded)')
          }
        } else if (receivedIndex !== questionIndex) {
          console.log('[BEHAVIOURAL_Q] Ignoring question for different index:', receivedIndex, 'current:', questionIndex)
        }
      }
      
      // When all follow-ups are ready, allow navigation
      // Only show the question when all follow-ups are ready (don't show "waiting" message)
      if (message.type === 'all_followups_ready' && message.phase === 'behavioural' && questionIndex === 1) {
        console.log('[BEHAVIOURAL_Q] All follow-ups ready - synchronization complete, showing question')
        setWaitingForFollowups(false)
        // Question should already be loaded, just allow it to be displayed
      }
      // Handle question errors
      if (message.type === 'question_error' && message.phase === 'behavioural') {
        console.error('[BEHAVIOURAL_Q] Question error from server:', message.message)
        // Keep loading state - don't use placeholder
      }
    },
  });

  // Determine question index: Q0 initially, Q1 after Q0 is complete
  useEffect(() => {
    // If phase is complete, don't change question index - navigate away instead
    if (showResults && gameState?.phaseComplete) {
      console.log('[BEHAVIOURAL_Q] Phase complete, should navigate away')
      return
    }
    
    // If we're already on Q1, don't change back to Q0 even if we receive stale signals
    if (questionIndex === 1) {
      // Only allow moving forward if phase is complete (which is handled above)
      return
    }
    
    // Check if we've already completed Q0 by looking at gameState submissions
    // If showResults is true but phaseComplete is false, Q0 is done, show Q1
    const submittedCount = gameState?.submittedPlayers?.length || 0
    const totalPlayers = lobby?.players.length || 0
    const q0Complete = showResults && !gameState?.phaseComplete && submittedCount >= totalPlayers
    
    // Also check sessionStorage as backup
    const storedQ0Complete = sessionStorage.getItem('behavioural_q0_complete') === 'true'
    
    // Only allow Q0 (index 0) or Q1 (index 1) - never go beyond
    const newIndex = (q0Complete || storedQ0Complete) ? 1 : 0
    
    // Don't allow question index beyond 1
    if (newIndex > 1) {
      console.warn('[BEHAVIOURAL_Q] Attempted to set question index > 1, blocking')
      return
    }
    
    // Only update if we're moving forward (0 -> 1), not backward
    if (newIndex > questionIndex) {
      console.log(`[BEHAVIOURAL_Q] Question index changing from ${questionIndex} to ${newIndex}`)
      setQuestionIndex(newIndex)
      // Update loading message for Q1 - check if all players have submitted
      if (newIndex === 1) {
        const currentSubmittedCount = gameState?.submittedPlayers?.length || 0
        const currentTotalPlayers = lobby?.players.length || 0
        if (currentSubmittedCount >= currentTotalPlayers) {
          setLoadingMessage("Considering your response...")
        } else {
          setLoadingMessage("Waiting for players...")
        }
      }
      // Reset the requested flag for the new index so we can request it
      hasRequestedRef.current[newIndex] = false
    } else if (newIndex < questionIndex) {
      console.log(`[BEHAVIOURAL_Q] Ignoring backward index change (${questionIndex} -> ${newIndex})`)
    }
  }, [showResults, gameState?.phaseComplete, gameState?.submittedPlayers, lobby?.players.length, questionIndex])
  
  // Update loading message when submission status changes
  useEffect(() => {
    if (questionIndex === 1) {
      if (waitingForFollowups) {
        // Already generating follow-ups
        setLoadingMessage("Considering your response...")
      } else if (allPlayersSubmittedQ0) {
        // All players submitted, should be generating soon
        setLoadingMessage("Considering your response...")
      } else {
        // Still waiting for players
        setLoadingMessage("Waiting for players...")
      }
    }
  }, [questionIndex, allPlayersSubmittedQ0, waitingForFollowups])

  // Request question from server when component mounts or questionIndex changes
  useEffect(() => {
    // Don't request if phase is complete
    if (showResults && gameState?.phaseComplete) {
      console.log('[BEHAVIOURAL_Q] Phase complete, not requesting questions')
      return
    }
    
    // Only allow question indices 0 and 1
    if (questionIndex > 1) {
      console.warn(`[BEHAVIOURAL_Q] Invalid question index ${questionIndex}, not requesting`)
      return
    }
    
    // Don't request if we've already requested this question index
    if (hasRequestedRef.current[questionIndex]) {
      console.log(`[BEHAVIOURAL_Q] Already requested question index ${questionIndex}, skipping`)
      return
    }
    
    // Reset loading state when questionIndex changes
    setIsLoading(true)
    // Clear question when switching indices
    if (questionIndex === 1) {
      setQuestion("")
      // Set message based on whether all players have submitted
      const currentSubmittedCount = gameState?.submittedPlayers?.length || 0
      const currentTotalPlayers = lobby?.players.length || 0
      if (currentSubmittedCount >= currentTotalPlayers) {
        setLoadingMessage("Considering your response...")
      } else {
        setLoadingMessage("Waiting for players...")
      }
    } else {
      setQuestion("Loading question...")
      setLoadingMessage("Loading question...")
    }
    hasRequestedRef.current[questionIndex] = true
    
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let checkTimer: ReturnType<typeof setInterval> | null = null
    
    const requestQuestion = () => {
      const wsConnection = wsRef.current
      if (wsConnection && wsConnection.readyState === WebSocket.OPEN && lobbyId && playerId) {
        console.log(`[BEHAVIOURAL_Q] Requesting ${questionIndex === 0 ? 'first' : 'follow-up'} question (index=${questionIndex})`)
        wsConnection.send(JSON.stringify({
          type: 'request_question',
          player_id: playerId,
          lobby_id: lobbyId,
          phase: 'behavioural',
          question_index: questionIndex
        }))
        return true
      }
      return false
    }
    
    // Try to request immediately
    if (requestQuestion()) {
      // Set a timeout to retry if no response after 2 seconds (only if still loading)
      retryTimer = setTimeout(() => {
        setIsLoading(currentLoading => {
          if (currentLoading) {
            console.warn('[BEHAVIOURAL_Q] No question received after 2s, retrying...')
            // Reset the flag to allow retry
            hasRequestedRef.current[questionIndex] = false
            requestQuestion()
          }
          return currentLoading
        })
      }, 2000)
    } else {
      // WebSocket not ready yet - wait for it
      console.log('[BEHAVIOURAL_Q] WebSocket not ready, waiting...')
      checkTimer = setInterval(() => {
        if (requestQuestion()) {
          if (checkTimer) clearInterval(checkTimer)
        }
      }, 500)
      
      // Stop checking after 10 seconds
      setTimeout(() => {
        if (checkTimer) clearInterval(checkTimer)
      }, 10000)
    }
    
    return () => {
      if (retryTimer) clearTimeout(retryTimer)
      if (checkTimer) clearInterval(checkTimer)
    }
  }, [questionIndex, wsRef, lobbyId, playerId, showResults, gameState?.phaseComplete])

  // Countdown timer - don't start if waiting for follow-ups
  useEffect(() => {
    if (remaining > 0 && !isLoading && !waitingForFollowups) {
      const timer = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            navigate('/behavioural-answer')
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [remaining, isLoading, waitingForFollowups, navigate])

  // Navigate to answer page when timer expires
  useEffect(() => {
    if (remaining <= 0 && !isLoading) {
      navigate('/behavioural-answer')
    }
  }, [remaining, isLoading, navigate])

  // Show loading state only when:
  // 1. Actually loading AND we don't have a question yet
  // 2. Waiting for follow-ups to be generated (we have our question but waiting for others to be ready)
  const shouldShowLoading = (isLoading && !question) || (questionIndex === 1 && waitingForFollowups && question)
  
  if (shouldShowLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 game-bg relative overflow-hidden">
        {/* Animated background shapes */}
        <div className="absolute inset-0 pointer-events-none">
          <div 
            className="absolute w-64 h-64 rounded-full opacity-20 blur-3xl animate-pulse"
            style={{
              background: 'radial-gradient(circle, var(--game-blue) 0%, transparent 70%)',
              top: '10%',
              left: '10%',
              animationDelay: '0s',
              animationDuration: '3s'
            }}
          />
          <div 
            className="absolute w-48 h-48 rounded-full opacity-20 blur-3xl animate-pulse"
            style={{
              background: 'radial-gradient(circle, var(--game-purple) 0%, transparent 70%)',
              top: '60%',
              right: '15%',
              animationDelay: '1s',
              animationDuration: '4s'
            }}
          />
          <div 
            className="absolute w-56 h-56 rounded-full opacity-20 blur-3xl animate-pulse"
            style={{
              background: 'radial-gradient(circle, var(--game-green) 0%, transparent 70%)',
              bottom: '15%',
              left: '50%',
              animationDelay: '2s',
              animationDuration: '3.5s'
            }}
          />
        </div>

        <div className="relative z-10 w-full max-w-2xl">
          <div className="game-paper px-12 py-10 game-shadow-hard-lg game-hand-drawn">
            {/* Main message */}
            <div className="text-center mb-8">
              <h2 
                className="text-3xl font-black mb-4"
                style={{ color: 'var(--game-text-primary)' }}
              >
                {loadingMessage}
              </h2>
              
              {/* Animated dots */}
              <div className="flex items-center justify-center gap-2 mt-6">
                <div 
                  className="w-4 h-4 rounded-full animate-bounce"
                  style={{
                    backgroundColor: 'var(--game-blue)',
                    animationDelay: '0s',
                    animationDuration: '1s'
                  }}
                />
                <div 
                  className="w-4 h-4 rounded-full animate-bounce"
                  style={{
                    backgroundColor: 'var(--game-purple)',
                    animationDelay: '0.2s',
                    animationDuration: '1s'
                  }}
                />
                <div 
                  className="w-4 h-4 rounded-full animate-bounce"
                  style={{
                    backgroundColor: 'var(--game-green)',
                    animationDelay: '0.4s',
                    animationDuration: '1s'
                  }}
                />
                <div 
                  className="w-4 h-4 rounded-full animate-bounce"
                  style={{
                    backgroundColor: 'var(--game-orange)',
                    animationDelay: '0.6s',
                    animationDuration: '1s'
                  }}
                />
              </div>
            </div>

            {/* Animated progress bar - only show when generating, not when waiting for players */}
            {questionIndex === 1 && allPlayersSubmittedQ0 && (
              <div className="mt-8">
                <div 
                  className="h-2 rounded-full overflow-hidden"
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.1)',
                    border: '2px solid var(--game-text-primary)'
                  }}
                >
                  <div 
                    className="h-full rounded-full"
                    style={{
                      background: 'linear-gradient(90deg, var(--game-blue), var(--game-purple), var(--game-green), var(--game-orange))',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 2s infinite linear',
                      width: '100%'
                    }}
                  />
                </div>
              </div>
            )}
            
            {/* Show player count when waiting for players (Q1, loading, not all submitted) */}
            {questionIndex === 1 && isLoading && !allPlayersSubmittedQ0 && !question && (
              <div className="mt-6 text-center">
                <div className="text-sm font-bold" style={{ color: 'var(--game-text-secondary)' }}>
                  {submittedCount} of {totalPlayers} players ready
                </div>
              </div>
            )}
          </div>
         
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 game-bg">
      <div className="w-full max-w-3xl space-y-10 relative">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="game-paper px-10 py-6 game-shadow-hard-lg game-hand-drawn inline-block">
            <h1 className="game-title text-4xl">BEHAVIOURAL QUESTION</h1>
          </div>
          <div className="game-label-text text-sm">
            READ CAREFULLY — YOU'LL ANSWER NEXT
          </div>
        </div>

        {/* Question Card */}
        <div
          className="game-paper px-10 py-8 game-shadow-hard-lg game-hand-drawn"
          style={{ border: "6px solid var(--game-text-primary)" }}
        >
          <h2
            className="font-extrabold"
            style={{
              fontSize: "clamp(2rem, 4vw, 3rem)",
              lineHeight: 1.2,
              color: "var(--game-text-primary)",
              wordBreak: "break-word",
              letterSpacing: "0.02em",
            }}
          >
            <span>{question}</span>
          </h2>
        </div>

        {/* Timer + Skip Button */}
        <div className="flex items-center justify-center gap-6 flex-wrap">
          <div className="text-center">
            <div className="game-label-text text-xs mb-2">TIME LEFT</div>
            <div
              aria-live="polite"
              className="game-sharp game-block-yellow px-6 py-3 game-shadow-hard-sm"
              style={{
                border: "3px solid var(--game-text-primary)",
                color: "var(--game-text-primary)",
                minWidth: "140px",
              }}
            >
              <span className="text-4xl font-black tracking-widest">
                {remaining}s
              </span>
            </div>
          </div>

          <button
            className="game-sharp game-block-blue px-8 py-4 text-base font-black uppercase tracking-widest game-shadow-hard-lg game-button-hover"
            style={{
              border: "6px solid var(--game-text-primary)",
              color: "var(--game-text-white)",
              opacity: skipConfirmations.has(playerId || '') ? 0.6 : 1
            }}
            onClick={() => {
              if (skipConfirmations.has(playerId || '')) {
                return // Already confirmed
              }
              const wsConnection = wsRef.current
              if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
                wsConnection.send(JSON.stringify({
                  type: 'behavioural_question_skip',
                  player_id: playerId,
                  phase: 'behavioural'
                }))
              }
            }}
          >
            {skipConfirmations.has(playerId || '') 
              ? `Skip (${skipConfirmations.size}/${skipTotalPlayers || lobby?.players.length || 0})`
              : 'Skip'}
          </button>
          {skipConfirmations.size > 0 && skipConfirmations.size < (skipTotalPlayers || lobby?.players.length || 0) && (
            <div className="text-center w-full">
              <div className="game-label-text text-xs">
                Waiting for {(skipTotalPlayers || lobby?.players.length || 0) - skipConfirmations.size} more player(s) to confirm skip
              </div>
            </div>
          )}
        </div>

       
        <div
          className="absolute -bottom-4 right-0 game-sticky-note-alt px-4 py-2 game-shadow-hard-sm"
          style={{ transform: "rotate(2deg)" }}
        >
          <div className="text-xs font-bold uppercase">Behavioural</div>
        </div>
      </div>
    </div>
  );
};

export default BehaviouralQuestion;
