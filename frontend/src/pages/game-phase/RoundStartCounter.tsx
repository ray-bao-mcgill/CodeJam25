import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLobby } from "@/hooks/useLobby";
import { useLobbyWebSocket } from "@/hooks/useLobbyWebSocket";

const COUNTDOWN_SECONDS = 5;

const nextRouteForType: Record<string, string> = {
  behavioural: "/behavioural-question",
  "technical-theory": "/technical-theory-round",
  "technical-practical": "/technical-practical",
};

const getRoundTitle = (type: string): string => {
  const normalized = type.toLowerCase();
  if (normalized === "behavioural") return "BEHAVIOURAL ROUND";
  if (normalized === "technical-theory") return "TECHNICAL THEORY ROUND";
  if (normalized === "technical-practical") return "PRACTICAL ROUND";
  return "ROUND";
};

// Friendly, compact label for the current phase
const getPhaseLabel = (type: string): string => {
  const normalized = type.toLowerCase();
  if (normalized === "behavioural") return "behavioural round starts in";
  if (normalized === "technical-theory") return "theory round starts in";
  if (normalized === "technical-practical") return "practical round starts in";
  return "next round starts in";
};

const RoundStartCounter: React.FC = () => {
  const { type } = useParams();
  const navigate = useNavigate();
  const { lobbyId, playerId } = useLobby();
  const [remaining, setRemaining] = useState<number>(COUNTDOWN_SECONDS);
  const [countdownStartTime, setCountdownStartTime] = useState<number | null>(
    null
  );
  const serverTimeOffsetRef = useRef<number>(0);

  const roundType = (type || "").toLowerCase();
  const isValidType =
    roundType === "behavioural" ||
    roundType === "technical-theory" ||
    roundType === "technical-practical";

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
      if (message.type === "round_start_countdown") {
        const serverTimestamp = message.serverTime || Date.now();
        const clientTime = Date.now();
        serverTimeOffsetRef.current = serverTimestamp - clientTime;
        setCountdownStartTime(message.startTime || serverTimestamp);
        setRemaining(message.remaining || COUNTDOWN_SECONDS);
      } else if (
        message.type === "round_start_navigate" &&
        message.round_type === roundType
      ) {
        // Server says all players ready - navigate together
        navigate(nextRouteForType[roundType]);
      }
    },
  });

  // Initialize countdown start time
  useEffect(() => {
    if (!countdownStartTime && isValidType) {
      const now = Date.now();
      setCountdownStartTime(now);

      // Notify server that countdown started
      const wsConnection = wsRef.current;
      if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
        wsConnection.send(
          JSON.stringify({
            type: "round_start_countdown_started",
            player_id: playerId,
            round_type: roundType,
            startTime: now,
          })
        );
      }
    }
  }, [countdownStartTime, isValidType, playerId, roundType]);

  // Synchronized countdown - wait for server message to navigate
  useEffect(() => {
    if (!isValidType || !countdownStartTime) return;

    const interval = setInterval(() => {
      const currentTime = Date.now() + serverTimeOffsetRef.current;
      const elapsed = Math.floor((currentTime - countdownStartTime) / 1000);
      const newRemaining = Math.max(0, COUNTDOWN_SECONDS - elapsed);

      setRemaining(newRemaining);

      if (newRemaining <= 0) {
        clearInterval(interval);
        // Notify server that countdown completed
        const wsConnection = wsRef.current;
        if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
          wsConnection.send(
            JSON.stringify({
              type: "round_start_countdown_completed",
              player_id: playerId,
              round_type: roundType,
            })
          );
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
          <p className="text-dimmed">
            Valid types: behavioural, technical-theory, technical-practical.
          </p>
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

        {/* Countdown - no white box, just strong typography */}
        <div className="text-center">
          <div className="game-label-text text-sm mb-3">
            {getPhaseLabel(roundType)}
          </div>
          <div
            className="text-7xl sm:text-8xl font-black tracking-widest"
            aria-live="polite"
            style={{
              lineHeight: 1,
              color: "var(--game-text-primary)",
              textShadow: "2px 2px 0 rgba(0,0,0,0.08)",
            }}
          >
            {remaining}
          </div>
          <div
            className="uppercase text-xs mt-1 opacity-60"
            style={{
              color: "var(--game-text-secondary)",
              letterSpacing: "0.12em",
            }}
          >
            seconds
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoundStartCounter;
