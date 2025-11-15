import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLobby } from "@/hooks/useLobby";
import { useLobbyWebSocket } from "@/hooks/useLobbyWebSocket";

const COUNTDOWN_SECONDS = 60;

const nextRouteForType: Record<string, string> = {
  behavioural: "/behavioural-question",
  technical: "/technical-theory",
};

const RoundStartCounter: React.FC = () => {
  const { type } = useParams();
  const navigate = useNavigate();
  const { lobbyId, playerId } = useLobby();
  const [remaining, setRemaining] = useState<number>(COUNTDOWN_SECONDS);
  const [countdownStartTime, setCountdownStartTime] = useState<number | null>(null);
  const serverTimeOffsetRef = useRef<number>(0);

  const roundType = (type || "").toLowerCase();
  const isValidType = roundType === "behavioural" || roundType === "technical";

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
          <p className="text-dimmed">Valid types: behavioural, technical.</p>
          <button className="btn" onClick={() => navigate("/landing")}>
            Return Home
          </button>
        </div>
      </div>
    );
  }

  const titleClass =
    roundType === "behavioural" ? "game-text-glow-cyan" : "game-text-glow-red";
  const borderClass =
    roundType === "behavioural" ? "game-border-glow-cyan" : "game-border-glow-red";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 game-bg">
      <div className="w-full max-w-4xl space-y-8">
        {/* Title */}
        <div className="text-center">
          <div className={`game-paper px-8 py-4 game-shadow-hard-lg game-hand-drawn inline-block ${borderClass}`}>
            <h1 className={`game-title text-3xl sm:text-4xl ${titleClass}`}>
              {roundType.charAt(0).toUpperCase() + roundType.slice(1)} ROUND
            </h1>
          </div>
        </div>

        {/* Countdown */}
        <div className="game-paper px-8 py-10 game-shadow-hard-lg text-center">
          <div className="game-label-text text-sm mb-4">NEXT PHASE BEGINS IN</div>
          <div
            className={`text-7xl sm:text-8xl font-black tracking-widest ${titleClass}`}
            aria-live="polite"
            style={{ lineHeight: 1 }}
          >
            {remaining}
          </div>
          <div className="game-label-text text-xs mt-2 opacity-70">seconds</div>
        </div>

        {/* Info Message */}
        <div className="text-center">
          <div className="game-label-text text-sm opacity-70 mb-4">
            Automatically advancing to the question phase...
          </div>
          
          {/* Skip Button */}
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
            Skip ({remaining}s)
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoundStartCounter;
