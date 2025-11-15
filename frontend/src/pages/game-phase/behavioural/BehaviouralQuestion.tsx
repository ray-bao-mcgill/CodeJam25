import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameFlow } from '@/hooks/useGameFlow'
import { useGameSync } from '@/hooks/useGameSync'
import { useLobby } from '@/hooks/useLobby'
import { useLobbyWebSocket } from '@/hooks/useLobbyWebSocket'

const QUESTION_DISPLAY_SECONDS = 30;

const BehaviouralQuestion: React.FC = () => {
  const navigate = useNavigate();
  const { submitAnswer } = useGameFlow()
  const { lobby, lobbyId, playerId } = useLobby()
  const { gameState, timeRemaining, submitAnswer: syncSubmitAnswer, isWaitingForOthers, showResults } = useGameSync()
  const [remaining, setRemaining] = useState(QUESTION_DISPLAY_SECONDS);
  const [question, setQuestion] = useState<string>("Loading question...");
  const [isLoading, setIsLoading] = useState(true);

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
        // Server says skip was triggered - navigate together
        navigate('/behavioural-answer')
      }
    },
  });

  useEffect(() => {
    // Use question from game state if available, otherwise use placeholder
    if (gameState?.question) {
      setQuestion(gameState.question)
      setIsLoading(false)
    } else {
      // TODO: Replace with backend fetch when API is ready
      setTimeout(() => {
        setQuestion("Describe a time you overcame a challenge at work.");
        setIsLoading(false);
      }, 500);
    }
  }, [gameState?.question]);

  // Use server-synced timer ONLY - no local timer conflicts
  useEffect(() => {
    if (timeRemaining !== undefined) {
      setRemaining(timeRemaining);
    }
  }, [timeRemaining]);

  // Navigate to follow-up question only when first question is complete (all players submitted)
  // But NOT when phase is complete (that happens after follow-up)
  useEffect(() => {
    if (showResults && gameState?.showResults && !gameState?.phaseComplete) {
      // First question complete, navigate to follow-up
      setTimeout(() => {
        navigate('/behavioural-answer')
      }, 1000)
    }
  }, [showResults, gameState?.showResults, gameState?.phaseComplete, navigate])

  const handleSubmit = async (answer: string) => {
    await submitAnswer(answer)
    // Submit via sync with phase information
    syncSubmitAnswer(answer, gameState?.questionId, 'behavioural', 0)
  }

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
              // Send skip request to server - server will broadcast to all clients
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


