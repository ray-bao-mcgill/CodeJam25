import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useLobby } from "@/hooks/useLobby";
import { useLobbyWebSocket } from "@/hooks/useLobbyWebSocket";

const Tutorial: React.FC = () => {
  const navigate = useNavigate();
  const { lobbyId, playerId } = useLobby();
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [tutorialStartTime, setTutorialStartTime] = useState<number | null>(
    null
  );
  const [isTransitioning, setIsTransitioning] = useState(false);
  const serverTimeOffsetRef = useRef<number>(0);

  // Check if we're in a lobby context (vs standalone tutorial from landing)
  const isInLobby = !!lobbyId;

  const tutorialSteps = [
    {
      title: "WELCOME TO THE INTERVIEW GAME",
      content:
        "You'll be competing against another player in a series of interview questions. Answer thoughtfully and show your skills!",
    },
    {
      title: "ROUND 1: BEHAVIOURAL",
      content:
        "You'll answer behavioural questions. The AI will ask follow-up questions based on your answers. Be specific and provide examples!",
    },
    {
      title: "ROUND 2: QUICK FIRE",
      content:
        "Answer 10 rapid-fire questions. Speed and accuracy matter here. Think fast!",
    },
    {
      title: "ROUND 3: TECHNICAL",
      content:
        "Showcase your technical knowledge. Answer technical questions that demonstrate your expertise.",
    },
    {
      title: "SCORING",
      content:
        "Your answers will be evaluated by AI. Scores are displayed after each round. The player with the highest score wins!",
    },
  ];

  // Set up WebSocket connection for synchronization
  const wsRef = useLobbyWebSocket({
    lobbyId: lobbyId || null,
    enabled: !!lobbyId,
    onLobbyUpdate: () => {},
    onGameStarted: () => {},
    onDisconnect: () => {},
    onKicked: () => {},
    currentPlayerId: playerId || null,
    onGameMessage: (message: any) => {
      // Handle tutorial synchronization messages
      if (message.type === "tutorial_start") {
        const serverTimestamp = message.serverTime || Date.now();
        const clientTime = Date.now();
        serverTimeOffsetRef.current = serverTimestamp - clientTime;
        setTutorialStartTime(message.startTime || serverTimestamp);
      } else if (message.type === "tutorial_slide") {
        // Server is controlling slide progression
        setCurrentStep(message.slideIndex || 0);
      }
    },
  });

  useEffect(() => {
    setIsVisible(false);
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 10);
    return () => clearTimeout(timer);
  }, []);

  // Initialize tutorial start time when component mounts
  useEffect(() => {
    if (!tutorialStartTime) {
      const now = Date.now();
      setTutorialStartTime(now);

      // Notify server that tutorial started (if WebSocket is ready)
      const wsConnection = wsRef.current;
      if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
        wsConnection.send(
          JSON.stringify({
            type: "tutorial_started",
            player_id: playerId,
            startTime: now,
          })
        );
      }
    }
  }, [tutorialStartTime, playerId]);

  // Auto-advance slides every 1 second (synchronized) - only in lobby context
  useEffect(() => {
    if (tutorialStartTime === null || !isInLobby) return;

    const interval = setInterval(() => {
      // Calculate elapsed time using server time if available
      const currentTime = Date.now() + serverTimeOffsetRef.current;
      const elapsed = Math.floor((currentTime - tutorialStartTime) / 1000);
      const slideIndex = Math.min(
        Math.floor(elapsed),
        tutorialSteps.length - 1
      );

      if (slideIndex !== currentStep) {
        // Fade out transition
        setIsTransitioning(true);
        setTimeout(() => {
          setCurrentStep(slideIndex);
          setIsTransitioning(false);
        }, 200); // Half of transition time

        // If we've reached the last slide, wait 1 second then navigate to round start counter
        if (slideIndex >= tutorialSteps.length - 1) {
          setTimeout(() => {
            // Notify server that tutorial completed
            const wsConnection = wsRef.current;
            if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
              wsConnection.send(
                JSON.stringify({
                  type: "tutorial_completed",
                  player_id: playerId,
                })
              );
            }
            sessionStorage.setItem("currentRound", "behavioural");
            navigate("/round-start-counter/behavioural");
          }, 1000);
        }
      }
    }, 100); // Check every 100ms for smoother transitions

    return () => clearInterval(interval);
  }, [
    tutorialStartTime,
    currentStep,
    tutorialSteps.length,
    navigate,
    isInLobby,
    playerId,
  ]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 game-bg">
      <div
        className="w-full max-w-4xl space-y-8"
        style={{
          transform: isVisible ? "scale(1)" : "scale(0.8)",
          opacity: isVisible ? 1 : 0,
          transition:
            "transform 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55), opacity 0.6s ease-out",
        }}
      >
        {/* Progress Indicator */}
        <div className="flex justify-center gap-2">
          {tutorialSteps.map((_, index) => (
            <div
              key={index}
              className={`h-2 w-12 game-sharp transition-all duration-300 ${
                index === currentStep
                  ? "game-block-blue"
                  : index < currentStep
                  ? "game-block-green"
                  : "game-paper"
              }`}
              style={{
                border: "2px solid var(--game-text-primary)",
                opacity:
                  index === currentStep ? 1 : index < currentStep ? 0.7 : 0.4,
              }}
            />
          ))}
        </div>

        {/* Tutorial Content */}
        <div
          className="game-paper px-8 py-10 game-shadow-hard-lg"
          style={{
            opacity: isTransitioning ? 0 : 1,
            transition: "opacity 0.2s ease-in-out",
          }}
        >
          <div className="text-center space-y-6">
            <div className="game-label-text text-sm">
              STEP {currentStep + 1} OF {tutorialSteps.length}
            </div>
            <h1 className="game-title text-4xl sm:text-5xl">
              {tutorialSteps[currentStep].title}
            </h1>
            <div className="text-lg text-gray-800 mt-6 whitespace-pre-wrap">
              {tutorialSteps[currentStep].content}
            </div>
          </div>
        </div>

        {/* Navigation Controls - only show in standalone mode */}
        {!isInLobby && (
          <div className="flex justify-center gap-6 mt-8">
            <button
              className="game-sharp px-8 py-4 text-lg font-black uppercase tracking-widest game-button-hover"
              style={{
                background: "#ff6600",
                border: "6px solid #000",
                color: "#fff",
                boxShadow: "6px 6px 0 #2d2d2d",
              }}
              onClick={() => navigate("/landing")}
            >
              Back to Main Menu
            </button>
            <button
              className="game-sharp px-8 py-4 text-lg font-black uppercase tracking-widest game-button-hover"
              style={{
                background: "#9966ff",
                border: "6px solid #000",
                color: "#fff",
                boxShadow: "6px 6px 0 #2d2d2d",
                opacity: currentStep > 0 ? 1 : 0.5,
              }}
              onClick={() => {
                if (currentStep > 0) {
                  setIsTransitioning(true);
                  setTimeout(() => {
                    setCurrentStep((prev) => prev - 1);
                    setIsTransitioning(false);
                  }, 200);
                }
              }}
              disabled={currentStep === 0}
            >
              Prev
            </button>
            <button
              className="game-sharp px-8 py-4 text-lg font-black uppercase tracking-widest game-button-hover"
              style={{
                background: "#138a36",
                border: "6px solid #000",
                color: "#fff",
                boxShadow: "6px 6px 0 #2d2d2d",
                opacity: currentStep < tutorialSteps.length - 1 ? 1 : 0.5,
              }}
              onClick={() => {
                if (currentStep < tutorialSteps.length - 1) {
                  setIsTransitioning(true);
                  setTimeout(() => {
                    setCurrentStep((prev) => prev + 1);
                    setIsTransitioning(false);
                  }, 200);
                }
              }}
              disabled={currentStep >= tutorialSteps.length - 1}
            >
              Next
            </button>
          </div>
        )}

        {/* Auto-playing indicator - only in lobby mode */}
        {isInLobby && (
          <div className="text-center">
            <div className="game-label-text text-sm opacity-70">
              Auto-playing tutorial...
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Tutorial;
