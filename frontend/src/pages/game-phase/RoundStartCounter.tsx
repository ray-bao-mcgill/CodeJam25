import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLobby } from "@/hooks/useLobby";
import { useLobbyWebSocket } from "@/hooks/useLobbyWebSocket";

const COUNTDOWN_SECONDS = 5;

const nextRouteForType: Record<string, string> = {
  behavioural: "/behavioural-question",
  "technical-theory": "/quickfire-round",  // technical-theory IS the quickfire round
  "technical-practical": "/technical-practical",
};

const getRoundTitle = (type: string): string => {
  const normalized = type.toLowerCase();
  if (normalized === "behavioural") return "BEHAVIOURAL ROUND";
  if (normalized === "technical-theory") return "QUICKFIRE ROUND";  // technical-theory IS quickfire
  if (normalized === "technical-practical") return "PRACTICAL ROUND";
  return "ROUND";
};

const RoundStartCounter: React.FC = () => {
  const { type } = useParams();
  const navigate = useNavigate();
  const { lobbyId, playerId } = useLobby();
  const [remaining, setRemaining] = useState<number>(COUNTDOWN_SECONDS);
  const [countdownStartTime, setCountdownStartTime] = useState<number | null>(null);
  const serverTimeOffsetRef = useRef<number>(0);

  const roundType = (type || "").toLowerCase();
  const isValidType = roundType === "behavioural" || roundType === "technical-theory" || roundType === "technical-practical";

  // Set up WebSocket for synchronization
  const wsRef = useLobbyWebSocket({
    lobbyId: lobbyId || null,
    enabled: !!lobbyId,
    onLobbyUpdate: () => {},
    onGameStarted: () => {},
    onDisconnect: () => {},
    onKicked: () => {},
    currentPlayerId: playerId || null,
    onGameMessage: (message: any) => {
      if (message.type === 'round_start_countdown') {
        const serverTimestamp = message.serverTime || Date.now()
        const clientTime = Date.now()
        serverTimeOffsetRef.current = serverTimestamp - clientTime
        setCountdownStartTime(message.startTime || serverTimestamp)
        setRemaining(message.remaining || COUNTDOWN_SECONDS)
      } else if (message.type === 'round_start_navigate' && message.round_type === roundType) {
        // Server says all players ready - navigate together
        navigate(nextRouteForType[roundType])
      } else if (message.type === 'round_start_skipped' && message.round_type === roundType) {
        // Server says skip was triggered - navigate together
        navigate(nextRouteForType[roundType])
      }
    },
  });

  // Initialize countdown start time
  useEffect(() => {
    if (!countdownStartTime && isValidType) {
      const now = Date.now()
      setCountdownStartTime(now)
      
      // Notify server that countdown started
      const wsConnection = wsRef.current
      if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
        wsConnection.send(JSON.stringify({
          type: 'round_start_countdown_started',
          player_id: playerId,
          round_type: roundType,
          startTime: now
        }))
      }
    }
  }, [countdownStartTime, isValidType, playerId, roundType]);

  // Synchronized countdown - wait for server message to navigate
  useEffect(() => {
    if (!isValidType || !countdownStartTime) return;
    
    const interval = setInterval(() => {
      const currentTime = Date.now() + serverTimeOffsetRef.current
      const elapsed = Math.floor((currentTime - countdownStartTime) / 1000)
      const newRemaining = Math.max(0, COUNTDOWN_SECONDS - elapsed)
      
      setRemaining(newRemaining)
      
      if (newRemaining <= 0) {
        clearInterval(interval)
        // Notify server that countdown completed
        const wsConnection = wsRef.current
        if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
          wsConnection.send(JSON.stringify({
            type: 'round_start_countdown_completed',
            player_id: playerId,
            round_type: roundType
          }))
        }
        // DON'T navigate here - wait for server message
      }
    }, 100); // Update every 100ms for smoother countdown
    
    return () => clearInterval(interval);
  }, [countdownStartTime, isValidType, roundType, playerId]);

  if (!isValidType) {
    return (
      <div
        className="container game-bg"
        style={{
          color: "var(--game-text-primary)",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className="paper stack" style={{ textAlign: "center" }}>
          <h1 className="text-large" style={{ fontSize: "2rem" }}>
            Unknown round type
          </h1>
          <p className="text-dimmed">Valid types: behavioural, technical-theory, technical-practical.</p>
          <button className="btn" onClick={() => navigate("/landing")}>
            Return Home
          </button>
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
            <h1 className="game-title text-4xl">
              {getRoundTitle(roundType)}
            </h1>
          </div>
          <div className="game-label-text text-sm">
            GET READY — QUESTION STARTS SOON
          </div>
        </div>

        {/* Countdown Card */}
        <div
          className="game-paper px-10 py-8 game-shadow-hard-lg game-hand-drawn text-center"
          style={{ border: "6px solid var(--game-text-primary)" }}
        >
          <div className="game-label-text text-sm mb-4">NEXT PHASE BEGINS IN</div>
          <div
            className="text-7xl sm:text-8xl font-black tracking-widest"
            aria-live="polite"
            style={{
              lineHeight: 1,
              color: "var(--game-text-primary)",
            }}
          >
            {remaining}
          </div>
          <div className="game-label-text text-xs mt-2 opacity-70">seconds</div>
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
                  type: 'round_start_skip',
                  player_id: playerId,
                  round_type: roundType
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
          <div className="text-xs font-bold uppercase">
            {roundType === "behavioural" ? "Round 1" : roundType === "technical-theory" ? "Round 2" : "Round 3"}
          </div>
        </div>
        <div
          className="absolute -bottom-4 right-0 game-sticky-note-alt px-4 py-2 game-shadow-hard-sm"
          style={{ transform: "rotate(2deg)" }}
        >
          <div className="text-xs font-bold uppercase">
            {roundType === "behavioural" ? "Behavioural" : roundType === "technical-theory" ? "Quickfire" : "Practical"}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoundStartCounter;
