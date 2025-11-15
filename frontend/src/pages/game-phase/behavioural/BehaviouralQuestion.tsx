import React, { useEffect, useState } from "react";
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
  const [questionIndex, setQuestionIndex] = useState(0); // 0 = Q0, 1 = Q1

  // Set up WebSocket for skip synchronization
  const wsRef = useLobbyWebSocket({
    lobbyId: lobbyId || null,
    enabled: !!lobbyId,
    onLobbyUpdate: () => {},
    onGameStarted: () => {},
    onDisconnect: () => {},
    onKicked: () => {},
    currentPlayerId: playerId || null,
    onGameMessage: (message: any) => {
      if (message.type === 'behavioural_question_skipped') {
        navigate('/behavioural-answer')
      }
      // When Q0 is complete, server will broadcast show_results with phaseComplete=false
      // Mark Q0 as complete in sessionStorage
      if (message.type === 'show_results' && message.phase === 'behavioural' && !message.phaseComplete) {
        console.log('[BEHAVIOURAL_Q] Received Q0 complete signal, marking in sessionStorage')
        sessionStorage.setItem('behavioural_q0_complete', 'true')
        setQuestionIndex(1)
      }
    },
  });

  // Determine question index: Q0 initially, Q1 after Q0 is complete
  useEffect(() => {
    // Check if we've already completed Q0 by looking at gameState submissions
    // If showResults is true but phaseComplete is false, Q0 is done, show Q1
    const submittedCount = gameState?.submittedPlayers?.length || 0
    const totalPlayers = lobby?.players.length || 0
    const q0Complete = showResults && !gameState?.phaseComplete && submittedCount >= totalPlayers
    
    // Also check sessionStorage as backup
    const storedQ0Complete = sessionStorage.getItem('behavioural_q0_complete') === 'true'
    
    if (q0Complete || storedQ0Complete) {
      console.log('[BEHAVIOURAL_Q] Q0 complete detected, showing Q1')
      setQuestionIndex(1)
    } else {
      console.log('[BEHAVIOURAL_Q] Showing Q0')
      setQuestionIndex(0)
    }
  }, [showResults, gameState?.phaseComplete, gameState?.submittedPlayers, lobby?.players.length])

  useEffect(() => {
    // Set question text based on index
    if (questionIndex === 0) {
      // First question
      setTimeout(() => {
        setQuestion("Describe a time you overcame a challenge at work.");
        setIsLoading(false);
      }, 500);
    } else {
      // Follow-up question (Q1)
      if (gameState?.question) {
        setQuestion(gameState.question)
        setIsLoading(false)
      } else {
        setTimeout(() => {
          setQuestion("Now, describe how you handled the follow-up situation.");
          setIsLoading(false);
        }, 500);
      }
    }
  }, [questionIndex, gameState?.question]);

  // Countdown timer
  useEffect(() => {
    if (remaining > 0 && !isLoading) {
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
  }, [remaining, isLoading, navigate])

  // Navigate to answer page when timer expires
  useEffect(() => {
    if (remaining <= 0 && !isLoading) {
      navigate('/behavioural-answer')
    }
  }, [remaining, isLoading, navigate])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 game-bg">
        <div className="game-paper px-8 py-4 game-shadow-hard-lg">
          <div className="text-lg font-bold">Loading question...</div>
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
            }}
            onClick={() => {
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
            Skip
          </button>
        </div>

        {/* Decorative sticky notes */}
        <div
          className="absolute -top-4 left-0 game-sticky-note px-4 py-2 game-shadow-hard-sm"
          style={{ transform: "rotate(-3deg)" }}
        >
          <div className="text-xs font-bold uppercase">Round 1</div>
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
