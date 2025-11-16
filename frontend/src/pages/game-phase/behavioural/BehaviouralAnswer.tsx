import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useGameFlow } from "@/hooks/useGameFlow";
import { useGameSync } from "@/hooks/useGameSync";
import { useLobby } from "@/hooks/useLobby";
import { useLobbyWebSocket } from "@/hooks/useLobbyWebSocket";
import { API_URL } from "@/config";

const ANSWER_SECONDS = 60;

const BehaviouralAnswer: React.FC = () => {
  const navigate = useNavigate();
  const { submitAnswer, submitFollowUpAnswer } = useGameFlow();
  const { lobby, lobbyId, playerId } = useLobby();
  const {
    gameState,
    timeRemaining,
    submitAnswer: syncSubmitAnswer,
    isWaitingForOthers,
    showResults,
  } = useGameSync();
  const [remaining, setRemaining] = useState(ANSWER_SECONDS);
  const [answer, setAnswer] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState("");
  // Initialize questionIndex from sessionStorage if Q0 is already complete
  const initialQuestionIndex = sessionStorage.getItem("behavioural_q0_complete") === "true" ? 1 : 0;
  const [questionIndex, setQuestionIndex] = useState(initialQuestionIndex); // 0 = Q0, 1 = Q1
  const [isLoading, setIsLoading] = useState(true);
  const [hasSubmittedCurrent, setHasSubmittedCurrent] = useState(false);
  const hasRequestedRef = useRef<Record<number, boolean>>({})
  
  console.log(`[BEHAVIOURAL_A] Component mounted with initial questionIndex=${initialQuestionIndex}`)
  
  // Set up WebSocket for receiving questions
  const wsRef = useLobbyWebSocket({
    lobbyId: lobbyId || null,
    enabled: !!lobbyId,
    onLobbyUpdate: () => {},
    onGameStarted: () => {},
    onDisconnect: () => {},
    onKicked: () => {},
    currentPlayerId: playerId || null,
    onGameMessage: (message: any) => {
      // Receive question from server
      if (message.type === 'question_received' && message.phase === 'behavioural') {
        const receivedIndex = message.question_index ?? 0
        
        // For Q1 (follow-up), check if it's personalized for this player
        if (receivedIndex === 1 && message.player_id) {
          // Personalized follow-up - only process if it's for this player
          if (message.player_id === playerId) {
            console.log('[BEHAVIOURAL_A] Received personalized follow-up question:', message.question)
            setCurrentQuestion(message.question)
            setIsLoading(false)
          } else {
            console.log('[BEHAVIOURAL_A] Ignoring follow-up for different player:', message.player_id)
          }
        } else if (receivedIndex === questionIndex) {
          // Q0 question (shared) - process if it matches current index
          // Update question even if not in loading state (in case of remount or refresh)
          if (message.question !== currentQuestion) {
            console.log('[BEHAVIOURAL_A] Received question from server:', message.question, 'index:', receivedIndex)
            setCurrentQuestion(message.question)
            setIsLoading(false)
          } else {
            console.log('[BEHAVIOURAL_A] Question already matches current question')
            setIsLoading(false)
          }
        } else {
          console.log('[BEHAVIOURAL_A] Ignoring question for different index:', receivedIndex, 'current:', questionIndex)
        }
      }
      
      // When all follow-ups are ready, allow navigation
      if (message.type === 'all_followups_ready' && message.phase === 'behavioural' && questionIndex === 1) {
        console.log('[BEHAVIOURAL_A] All follow-ups ready - synchronization complete')
        // This allows the component to proceed - the question should already be loaded
      }
    },
  });

  // Determine question index: Q0 initially, Q1 after Q0 is complete
  useEffect(() => {
    // If phase is complete, don't change question index - navigation will handle moving to results
    if (showResults && gameState?.phaseComplete) {
      console.log('[BEHAVIOURAL_A] Phase complete, not changing question index')
      return
    }
    
    // Check if Q0 is complete by looking at gameState and sessionStorage
    const q0Complete =
      showResults &&
      !gameState?.phaseComplete &&
      (gameState?.submittedPlayers?.length || 0) >=
        (lobby?.players.length || 0);
    const storedQ0Complete =
      sessionStorage.getItem("behavioural_q0_complete") === "true";

    const newIndex = (q0Complete || storedQ0Complete) ? 1 : 0
    
    console.log(`[BEHAVIOURAL_A] Question index determination: q0Complete=${q0Complete}, storedQ0Complete=${storedQ0Complete}, showResults=${showResults}, submittedPlayers=${gameState?.submittedPlayers?.length || 0}/${lobby?.players.length || 0}, currentIndex=${questionIndex}, newIndex=${newIndex}`)
    
    // Only allow indices 0 and 1
    if (newIndex > 1) {
      console.warn('[BEHAVIOURAL_A] Attempted to set question index > 1, blocking')
      return
    }
    
    // Always update if newIndex is different (including on initial mount)
    if (newIndex !== questionIndex) {
      // Don't go backwards unless we're resetting to 0
      if (newIndex < questionIndex && newIndex !== 0) {
        console.log(`[BEHAVIOURAL_A] Ignoring backward index change (${questionIndex} -> ${newIndex})`)
        return
      }
      
      console.log(`[BEHAVIOURAL_A] Question index changing from ${questionIndex} to ${newIndex}`)
      setQuestionIndex(newIndex)
      setHasSubmittedCurrent(false) // Reset for new question
      // Reset the requested flag for the new index so we can request it
      hasRequestedRef.current[newIndex] = false
    }
  }, [
    showResults,
    gameState?.phaseComplete,
    gameState?.submittedPlayers,
    lobby?.players.length,
    questionIndex,
  ]);

  // Fetch question from database when questionIndex changes
  useEffect(() => {
    // Don't fetch if phase is complete
    if (showResults && gameState?.phaseComplete) {
      console.log('[BEHAVIOURAL_A] Phase complete, not fetching questions')
      return
    }
    
    // Only allow question indices 0 and 1
    if (questionIndex > 1) {
      console.warn(`[BEHAVIOURAL_A] Invalid question index ${questionIndex}, not fetching`)
      return
    }
    
    // Don't fetch if we've already fetched this question index
    if (hasRequestedRef.current[questionIndex]) {
      console.log(`[BEHAVIOURAL_A] Already fetched question index ${questionIndex}, skipping`)
      return
    }
    
    console.log(`[BEHAVIOURAL_A] Starting fetch for question index ${questionIndex}`)
    
    // Reset loading state when questionIndex changes
    setIsLoading(true)
    setCurrentQuestion("Loading question...")
    hasRequestedRef.current[questionIndex] = true
    
    // Fetch question from API
    const fetchQuestion = async () => {
      if (!lobbyId) {
        console.warn('[BEHAVIOURAL_A] No lobbyId, cannot fetch question')
        setIsLoading(false)
        return
      }
      
      try {
        // Build query params - include player_id for Q1 (follow-up)
        const params = new URLSearchParams({
          phase: 'behavioural',
          question_index: questionIndex.toString()
        })
        if (questionIndex === 1 && playerId) {
          params.append('player_id', playerId)
        }
        
        console.log(`[BEHAVIOURAL_A] Fetching ${questionIndex === 0 ? 'first' : 'follow-up'} question from API (index=${questionIndex})`)
        const response = await fetch(`${API_URL}/api/lobby/${lobbyId}/question?${params.toString()}`)
        const data = await response.json()
        
        if (data.success && data.question) {
          console.log('[BEHAVIOURAL_A] Fetched question from API:', data.question)
          setCurrentQuestion(data.question)
          setIsLoading(false)
        } else {
          console.warn('[BEHAVIOURAL_A] Question not found in database, falling back to WebSocket request')
          // Fallback to WebSocket request if question not in database yet
          const wsConnection = wsRef.current
          if (wsConnection && wsConnection.readyState === WebSocket.OPEN && playerId) {
            wsConnection.send(JSON.stringify({
              type: 'request_question',
              player_id: playerId,
              lobby_id: lobbyId,
              phase: 'behavioural',
              question_index: questionIndex
            }))
          } else {
            setIsLoading(false)
          }
        }
      } catch (error) {
        console.error('[BEHAVIOURAL_A] Error fetching question from API:', error)
        // Fallback to WebSocket request on error
        const wsConnection = wsRef.current
        if (wsConnection && wsConnection.readyState === WebSocket.OPEN && playerId) {
          wsConnection.send(JSON.stringify({
            type: 'request_question',
            player_id: playerId,
            lobby_id: lobbyId,
            phase: 'behavioural',
            question_index: questionIndex
          }))
        } else {
          setIsLoading(false)
        }
      }
    }
    
    fetchQuestion()
  }, [questionIndex, lobbyId, playerId, showResults, gameState?.phaseComplete, wsRef])

  // Use server-synced timer
  useEffect(() => {
    if (timeRemaining !== undefined) {
      setRemaining(timeRemaining);
    }
  }, [timeRemaining]);

  // Navigation logic
  useEffect(() => {
    // PRIORITY: Check phase complete FIRST (both Q0 and Q1 done) - navigate to results
    if (showResults && gameState?.phaseComplete && hasSubmittedCurrent) {
      console.log("[BEHAVIOURAL_A] Phase complete (both Q0 and Q1 done), navigating to results");
      sessionStorage.setItem("currentRound", "behavioural");
      sessionStorage.removeItem("behavioural_q0_complete"); // Clean up
      setTimeout(() => {
        navigate("/current-score");
      }, 1000);
      return; // Exit early to prevent Q0->Q1 navigation
    }

    // If Q0 is complete (all players submitted Q0), mark it and navigate to show Q1
    // Only navigate if we're on Q0 and haven't already navigated
    if (
      showResults &&
      !gameState?.phaseComplete &&
      questionIndex === 0 &&
      hasSubmittedCurrent
    ) {
      console.log(
        "[BEHAVIOURAL_A] Q0 complete, marking and navigating to show Q1"
      );
      sessionStorage.setItem("behavioural_q0_complete", "true");
      setTimeout(() => {
        navigate("/behavioural-question"); // Show Q1
      }, 1000);
    }
  }, [
    showResults,
    gameState?.phaseComplete,
    questionIndex,
    hasSubmittedCurrent,
    navigate,
  ]);

  const handleSubmit = async () => {
    if (!answer.trim() || hasSubmittedCurrent) return;

    if (questionIndex === 0) {
      // Submit Q0 answer
      console.log("[BEHAVIOURAL_A] Submitting Q0 answer");
      await submitAnswer(answer);
      syncSubmitAnswer(
        answer,
        gameState?.questionId || "behavioural_q0",
        "behavioural",
        0
      );
      setHasSubmittedCurrent(true);
      setAnswer(""); // Clear answer
    } else {
      // Submit Q1 answer
      console.log("[BEHAVIOURAL_A] Submitting Q1 answer");
      await submitFollowUpAnswer(answer);
      syncSubmitAnswer(
        answer,
        gameState?.questionId || "behavioural_q1",
        "behavioural",
        1
      );
      setHasSubmittedCurrent(true);
    }
  };

  const handleClear = () => setAnswer("");

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
    <div className="game-bg h-[100dvh] w-full p-8 overflow-y-auto overflow-x-hidden">
      <div className="w-full max-w-4xl lg:max-w-5xl mx-auto space-y-8 relative pb-24">
        {/* Header and Timer */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] items-start gap-4">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-2">
              <div className="game-sticky-note px-4 py-2 game-shadow-hard-sm">
                <div className="text-xs font-bold uppercase">Round 1</div>
              </div>
              <div className="game-paper px-6 sm:px-8 md:px-10 py-4 sm:py-5 md:py-6 game-shadow-hard-lg game-hand-drawn inline-block max-w-full">
                <h1 className="game-title text-3xl sm:text-4xl">
                  BEHAVIOURAL ANSWER
                </h1>
              </div>
            </div>
            <div className="game-label-text text-xs sm:text-sm">
              TYPE YOUR ANSWER BELOW
            </div>
          </div>
          <div className="md:justify-self-end text-center">
            <div className="game-label-text text-[10px]">TIME LEFT</div>
            <div
              aria-live="polite"
              className="game-sharp game-block-yellow px-4 py-2 game-shadow-hard-sm"
              style={{
                border: "3px solid var(--game-text-primary)",
                color: "var(--game-text-primary)",
                minWidth: "120px",
              }}
            >
              <span className="text-2xl sm:text-3xl font-black tracking-widest">
                {remaining}s
              </span>
            </div>
          </div>
        </div>

        {/* Question Display */}
        <div
          className="game-paper px-6 sm:px-8 py-5 game-shadow-hard"
          style={{ border: "4px solid var(--game-text-primary)" }}
        >
          <div className="game-label-text text-xs mb-2">QUESTION</div>
          <p
            style={{
              fontSize: "1.1rem",
              lineHeight: 1.5,
              color: "var(--game-text-primary)",
              fontWeight: 600,
            }}
          >
            {currentQuestion}
          </p>
        </div>

        {/* Answer Area */}
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="game-label-text text-xs">YOUR ANSWER</div>
            <div className="flex items-center gap-4">
              <button
                className="game-sharp px-4 py-2 text-xs font-black uppercase tracking-widest game-shadow-hard-sm game-button-hover"
                style={{
                  background: "var(--game-paper-bg, #fffbe6)",
                  border: "3px solid var(--game-text-primary)",
                  color: "var(--game-text-primary)",
                }}
                onClick={handleClear}
              >
                Clear
              </button>
            </div>
          </div>

          <textarea
            value={answer}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setAnswer(e.target.value)
            }
            placeholder="Type your answer here..."
            className="game-sharp game-paper w-full block game-shadow-hard min-h-[40vh] md:min-h-[320px]"
            style={{
              border: "6px solid var(--game-text-primary)",
              color: "var(--game-text-primary)",
              padding: "1rem",
              fontSize: "1.125rem",
              lineHeight: 1.6,
              letterSpacing: "0.01em",
              resize: "vertical",
            }}
            disabled={isWaitingForOthers || hasSubmittedCurrent}
          />
        </section>

        {/* Waiting for others indicator */}
        {isWaitingForOthers && (
          <div className="game-paper px-6 py-4 game-shadow-hard-lg">
            <div className="text-center">
              <div className="game-label-text text-sm mb-2">
                WAITING FOR OTHER PLAYERS...
              </div>
              <div className="text-lg font-bold">
                {gameState?.submittedPlayers?.length || 0} /{" "}
                {lobby?.players.length || 0} players submitted
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex items-center justify-center gap-6 flex-wrap pt-2">
          <button
            className="game-sharp game-block-blue px-10 py-4 text-base font-black uppercase tracking-widest game-shadow-hard-lg game-button-hover"
            style={{
              border: "6px solid var(--game-text-primary)",
              color: "var(--game-text-white)",
              minWidth: "220px",
              opacity:
                !answer.trim() || isWaitingForOthers || hasSubmittedCurrent
                  ? 0.5
                  : 1,
              cursor:
                !answer.trim() || isWaitingForOthers || hasSubmittedCurrent
                  ? "not-allowed"
                  : "pointer",
            }}
            onClick={handleSubmit}
            disabled={
              !answer.trim() || isWaitingForOthers || hasSubmittedCurrent
            }
          >
            {hasSubmittedCurrent
              ? "SUBMITTED"
              : isWaitingForOthers
              ? "WAITING FOR OTHERS..."
              : "Submit Answer"}
          </button>
        </div>

        {/* Decorative sticky notes */}
        <div className="flex justify-end">
          <div
            className="game-sticky-note-alt px-4 py-2 game-shadow-hard-sm"
            style={{ transform: "rotate(2deg)" }}
          >
            <div className="text-xs font-bold uppercase">Answer Phase</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BehaviouralAnswer;
