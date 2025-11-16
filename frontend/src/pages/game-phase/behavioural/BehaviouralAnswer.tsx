import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useGameFlow } from "@/hooks/useGameFlow";
import { useGameSync } from "@/hooks/useGameSync";
import { useLobby } from "@/hooks/useLobby";
import { useLobbyWebSocket } from "@/hooks/useLobbyWebSocket";
import VideoRecorder from "@/components/VideoRecorder";
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
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState("");
  // Initialize questionIndex from sessionStorage if Q0 is already complete
  const initialQuestionIndex = sessionStorage.getItem("behavioural_q0_complete") === "true" ? 1 : 0;
  const [questionIndex, setQuestionIndex] = useState(initialQuestionIndex); // 0 = Q0, 1 = Q1
  const [isLoading, setIsLoading] = useState(true);
  const [hasSubmittedCurrent, setHasSubmittedCurrent] = useState(false);
  const hasRequestedRef = useRef<Record<number, boolean>>({});
  
  console.log(`[BEHAVIOURAL_A] Component mounted with initial questionIndex=${initialQuestionIndex}`);
  
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
        const receivedIndex = message.question_index ?? 0;
        
        // For Q1 (follow-up), check if it's personalized for this player
        if (receivedIndex === 1 && message.player_id) {
          // Personalized follow-up - only process if it's for this player
          if (message.player_id === playerId) {
            console.log('[BEHAVIOURAL_A] Received personalized follow-up question:', message.question);
            setCurrentQuestion(message.question);
            setIsLoading(false);
          } else {
            console.log('[BEHAVIOURAL_A] Ignoring follow-up for different player:', message.player_id);
          }
        } else if (receivedIndex === questionIndex) {
          // Q0 question (shared) - process if it matches current index
          if (message.question !== currentQuestion) {
            console.log('[BEHAVIOURAL_A] Received question from server:', message.question, 'index:', receivedIndex);
            setCurrentQuestion(message.question);
            setIsLoading(false);
          } else {
            console.log('[BEHAVIOURAL_A] Question already matches current question');
            setIsLoading(false);
          }
        } else {
          console.log('[BEHAVIOURAL_A] Ignoring question for different index:', receivedIndex, 'current:', questionIndex);
        }
      }
      
      // When all follow-ups are ready, allow navigation
      if (message.type === 'all_followups_ready' && message.phase === 'behavioural' && questionIndex === 1) {
        console.log('[BEHAVIOURAL_A] All follow-ups ready - synchronization complete');
      }
    },
  });

  // Determine question index: Q0 initially, Q1 after Q0 is complete
  useEffect(() => {
    // If phase is complete, don't change question index - navigation will handle moving to results
    if (showResults && gameState?.phaseComplete) {
      console.log('[BEHAVIOURAL_A] Phase complete, not changing question index');
      return;
    }
    
    // Check if Q0 is complete by looking at gameState and sessionStorage
    const q0Complete =
      showResults &&
      !gameState?.phaseComplete &&
      (gameState?.submittedPlayers?.length || 0) >=
        (lobby?.players.length || 0);
    const storedQ0Complete =
      sessionStorage.getItem("behavioural_q0_complete") === "true";

    const newIndex = (q0Complete || storedQ0Complete) ? 1 : 0;
    
    console.log(`[BEHAVIOURAL_A] Question index determination: q0Complete=${q0Complete}, storedQ0Complete=${storedQ0Complete}, showResults=${showResults}, submittedPlayers=${gameState?.submittedPlayers?.length || 0}/${lobby?.players.length || 0}, currentIndex=${questionIndex}, newIndex=${newIndex}`);
    
    // Only allow indices 0 and 1
    if (newIndex > 1) {
      console.warn('[BEHAVIOURAL_A] Attempted to set question index > 1, blocking');
      return;
    }
    
    // Always update if newIndex is different (including on initial mount)
    if (newIndex !== questionIndex) {
      // Don't go backwards unless we're resetting to 0
      if (newIndex < questionIndex && newIndex !== 0) {
        console.log(`[BEHAVIOURAL_A] Ignoring backward index change (${questionIndex} -> ${newIndex})`);
        return;
      }
      
      console.log(`[BEHAVIOURAL_A] Question index changing from ${questionIndex} to ${newIndex}`);
      setQuestionIndex(newIndex);
      setHasSubmittedCurrent(false); // Reset for new question
      // Reset the requested flag for the new index so we can request it
      hasRequestedRef.current[newIndex] = false;
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
      console.log('[BEHAVIOURAL_A] Phase complete, not fetching questions');
      return;
    }
    
    // Only allow question indices 0 and 1
    if (questionIndex > 1) {
      console.warn(`[BEHAVIOURAL_A] Invalid question index ${questionIndex}, not fetching`);
      return;
    }
    
    // Don't fetch if we've already fetched this question index
    if (hasRequestedRef.current[questionIndex]) {
      console.log(`[BEHAVIOURAL_A] Already fetched question index ${questionIndex}, skipping`);
      return;
    }
    
    console.log(`[BEHAVIOURAL_A] Starting fetch for question index ${questionIndex}`);
    
    // Reset loading state when questionIndex changes
    setIsLoading(true);
    setCurrentQuestion("Loading question...");
    hasRequestedRef.current[questionIndex] = true;
    
    // Fetch question from API
    const fetchQuestion = async () => {
      if (!lobbyId) {
        console.warn('[BEHAVIOURAL_A] No lobbyId, cannot fetch question');
        setIsLoading(false);
        return;
      }
      
      try {
        // Build query params - include player_id for Q1 (follow-up)
        const params = new URLSearchParams({
          phase: 'behavioural',
          question_index: questionIndex.toString()
        });
        if (questionIndex === 1 && playerId) {
          params.append('player_id', playerId);
        }
        
        console.log(`[BEHAVIOURAL_A] Fetching ${questionIndex === 0 ? 'first' : 'follow-up'} question from API (index=${questionIndex})`);
        const response = await fetch(`${API_URL}/api/lobby/${lobbyId}/question?${params.toString()}`);
        const data = await response.json();
        
        if (data.success && data.question) {
          console.log('[BEHAVIOURAL_A] Fetched question from API:', data.question);
          setCurrentQuestion(data.question);
          setIsLoading(false);
        } else {
          console.warn('[BEHAVIOURAL_A] Question not found in database, falling back to WebSocket request');
          // Fallback to WebSocket request if question not in database yet
          const wsConnection = wsRef.current;
          if (wsConnection && wsConnection.readyState === WebSocket.OPEN && playerId) {
            wsConnection.send(JSON.stringify({
              type: 'request_question',
              player_id: playerId,
              lobby_id: lobbyId,
              phase: 'behavioural',
              question_index: questionIndex
            }));
          } else {
            setIsLoading(false);
          }
        }
      } catch (error) {
        console.error('[BEHAVIOURAL_A] Error fetching question from API:', error);
        // Fallback to WebSocket request on error
        const wsConnection = wsRef.current;
        if (wsConnection && wsConnection.readyState === WebSocket.OPEN && playerId) {
          wsConnection.send(JSON.stringify({
            type: 'request_question',
            player_id: playerId,
            lobby_id: lobbyId,
            phase: 'behavioural',
            question_index: questionIndex
          }));
        } else {
          setIsLoading(false);
        }
      }
    };
    
    fetchQuestion();
  }, [questionIndex, lobbyId, playerId, showResults, gameState?.phaseComplete, wsRef]);

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
    console.log("\n" + "=".repeat(80));
    console.log("📹 [BEHAVIOURAL_A] handleSubmit() called");
    console.log("=".repeat(80));
    console.log(`📊 videoBlob exists: ${!!videoBlob}`);
    console.log(`📊 hasSubmittedCurrent: ${hasSubmittedCurrent}`);
    console.log(`📊 questionIndex: ${questionIndex}`);
    
    if (!videoBlob) {
      console.log("❌ [BEHAVIOURAL_A] No video blob - cannot submit");
      return;
    }
    
    if (hasSubmittedCurrent) {
      console.log("❌ [BEHAVIOURAL_A] Already submitted - cannot submit again");
      return;
    }

    console.log("✅ [BEHAVIOURAL_A] Starting video upload to server...");
    console.log(`📦 [BEHAVIOURAL_A] Video blob size: ${videoBlob.size} bytes`);
    console.log(`📦 [BEHAVIOURAL_A] Video blob type: ${videoBlob.type}`);

    try {
      // Create FormData with video file and metadata
      const formData = new FormData();
      const questionId = questionIndex === 0 ? "behavioural_q0" : "behavioural_q1";
      const videoFilename = `${playerId || 'unknown'}_${questionId}_${Date.now()}.webm`;
      
      formData.append('video', videoBlob, videoFilename);
      formData.append('player_id', playerId || 'unknown');
      formData.append('question_id', questionId);
      
      console.log("\n" + "=".repeat(80));
      console.log("📤 [BEHAVIOURAL_A] Uploading to /api/video/upload");
      console.log("=".repeat(80));
      console.log(`📄 Filename: ${videoFilename}`);
      console.log(`👤 Player ID: ${playerId || 'unknown'}`);
      console.log(`❓ Question ID: ${questionId}`);
      console.log("=".repeat(80) + "\n");
      
      // Upload video to backend endpoint
      const response = await fetch(`${API_URL}/api/video/upload`, {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      
      console.log("\n" + "=".repeat(80));
      console.log("✅ [BEHAVIOURAL_A] Server response received!");
      console.log("=".repeat(80));
      console.log(`� Success: ${result.success}`);
      console.log(`� Message: ${result.message}`);
      console.log(`� Video saved to: ${result.video_path || 'N/A'}`);
      console.log(`📝 Transcription saved to: ${result.transcription_path || 'N/A'}`);
      console.log(`📊 Transcription length: ${result.transcription_text?.length || 0} characters`);
      console.log(`📊 Word count: ${result.word_count || 0}`);
      console.log(`📄 Transcription preview: ${result.transcription_text?.substring(0, 100) || 'N/A'}...`);
      console.log("=".repeat(80) + "\n");
      
      if (!result.success) {
        console.error("❌ [BEHAVIOURAL_A] Upload failed:", result.message);
        return;
      }
      
      // Now submit the transcription text through the game flow
      const transcriptionText = result.transcription_text || '';
      
      if (questionIndex === 0) {
        // Submit Q0 answer
        console.log("📤 [BEHAVIOURAL_A] Submitting Q0 transcription to game flow");
        await submitAnswer(transcriptionText);
        syncSubmitAnswer(
          transcriptionText,
          questionId,
          "behavioural",
          0
        );
        console.log("✅ [BEHAVIOURAL_A] Q0 transcription submitted to game flow!");
      } else {
        // Submit Q1 answer
        console.log("📤 [BEHAVIOURAL_A] Submitting Q1 transcription to game flow");
        await submitFollowUpAnswer(transcriptionText);
        syncSubmitAnswer(
          transcriptionText,
          questionId,
          "behavioural",
          1
        );
        console.log("✅ [BEHAVIOURAL_A] Q1 transcription submitted to game flow!");
      }
      
      setHasSubmittedCurrent(true);
      setVideoBlob(null); // Clear video
      
    } catch (error) {
      console.error("\n" + "=".repeat(80));
      console.error("❌ [BEHAVIOURAL_A] Error during video upload:");
      console.error("=".repeat(80));
      console.error(error);
      console.error("=".repeat(80) + "\n");
    }
  };

  const handleVideoRecorded = (blob: Blob) => {
    setVideoBlob(blob);
  };

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

        {/* Answer Area - Video Recorder */}
        <section className="space-y-3">
          <div className="game-label-text text-xs">RECORD YOUR ANSWER</div>
          
          <VideoRecorder 
            onRecordingComplete={handleVideoRecorded}
            maxDuration={remaining}
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
                !videoBlob || isWaitingForOthers || hasSubmittedCurrent
                  ? 0.5
                  : 1,
              cursor:
                !videoBlob || isWaitingForOthers || hasSubmittedCurrent
                  ? "not-allowed"
                  : "pointer",
            }}
            onClick={handleSubmit}
            disabled={
              !videoBlob || isWaitingForOthers || hasSubmittedCurrent
            }
          >
            {hasSubmittedCurrent
              ? "SUBMITTED"
              : isWaitingForOthers
              ? "WAITING FOR OTHERS..."
              : "Submit Answer"}
          </button>
        </div>

       
      </div>
    </div>
  );
};

export default BehaviouralAnswer;
