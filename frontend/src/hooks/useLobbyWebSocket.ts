import { useEffect, useRef, RefObject } from "react";
import { WS_URL } from "../config";
import { LobbyData } from "./useLobby";

interface WebSocketWithInterval extends WebSocket {
  _pingInterval?: number;
}

interface UseLobbyWebSocketOptions {
  lobbyId: string | null;
  enabled: boolean;
  onLobbyUpdate: (lobby: LobbyData) => void;
  onGameStarted?: () => void;
  onDisconnect?: (wasUserInitiated: boolean) => void;
  onKicked?: (kickedPlayerId: string) => void;
  currentPlayerId?: string | null;
}

export function useLobbyWebSocket({
  lobbyId,
  enabled,
  onLobbyUpdate,
  onGameStarted,
  onDisconnect,
  onKicked,
  currentPlayerId,
}: UseLobbyWebSocketOptions): RefObject<WebSocketWithInterval | null> {
  const wsRef = useRef<WebSocketWithInterval | null>(null);
  const callbacksRef = useRef({ onLobbyUpdate, onGameStarted, onDisconnect, onKicked });
  const currentPlayerIdRef = useRef<string | null>(currentPlayerId || null);
  const connectedLobbyIdRef = useRef<string | null>(null);
  const isConnectingRef = useRef(false);
  const isUserInitiatedCloseRef = useRef(false);

  // Update callbacks ref without triggering reconnection
  useEffect(() => {
    callbacksRef.current = { onLobbyUpdate, onGameStarted, onDisconnect, onKicked };
    currentPlayerIdRef.current = currentPlayerId || null;
  }, [onLobbyUpdate, onGameStarted, onDisconnect, onKicked, currentPlayerId]);

  useEffect(() => {
    // If disabled or no lobbyId, close connection
    if (!enabled || !lobbyId) {
      if (wsRef.current && connectedLobbyIdRef.current) {
        isUserInitiatedCloseRef.current = true;
        wsRef.current.close(1000);
        wsRef.current = null;
        connectedLobbyIdRef.current = null;
      }
      isConnectingRef.current = false;
      return;
    }

    // If already connected to this lobby, don't reconnect
    if (
      wsRef.current &&
      wsRef.current.readyState === WebSocket.OPEN &&
      connectedLobbyIdRef.current === lobbyId
    ) {
      return;
    }

    // If already connecting to this lobby, don't start another connection
    if (isConnectingRef.current && connectedLobbyIdRef.current === lobbyId) {
      return;
    }

    // Close existing connection if connecting to a different lobby
    if (wsRef.current && connectedLobbyIdRef.current && connectedLobbyIdRef.current !== lobbyId) {
      const oldWs = wsRef.current;
      isUserInitiatedCloseRef.current = true;
      oldWs.close(1000);
      wsRef.current = null;
      connectedLobbyIdRef.current = null;
      isConnectingRef.current = false;
    }

    // Prevent duplicate connections
    if (isConnectingRef.current) {
      return;
    }

    isConnectingRef.current = true;
    connectedLobbyIdRef.current = lobbyId;
    console.log(`Connecting WebSocket to lobby ${lobbyId}`);

    const ws: WebSocketWithInterval = new WebSocket(
      `${WS_URL}/ws/lobby/${lobbyId}`
    );
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("✓ WebSocket connected");
      isConnectingRef.current = false;
      isUserInitiatedCloseRef.current = false;
      // Send ping every 20 seconds
      const pingInterval: number = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        } else {
          clearInterval(pingInterval);
        }
      }, 20000) as unknown as number;
      ws._pingInterval = pingInterval;
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === "lobby_update") {
          // Use ref to get latest callbacks without recreating connection
          callbacksRef.current.onLobbyUpdate(message.lobby);
          
          // Check if game has started
          if (message.lobby.status === "starting" || message.lobby.status === "in_progress") {
            callbacksRef.current.onGameStarted?.();
          }
        } else if (message.type === "kicked") {
          // Handle kicked message - only trigger if this player was kicked
          const kickedPlayerId = message.player_id;
          console.log("Received kicked message:", { kickedPlayerId, currentPlayerId: currentPlayerIdRef.current });
          if (kickedPlayerId && kickedPlayerId === currentPlayerIdRef.current) {
            console.log("Player ID matches, triggering onKicked callback");
            callbacksRef.current.onKicked?.(kickedPlayerId);
          } else {
            console.log("Player ID does not match, ignoring kicked message");
          }
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      isConnectingRef.current = false;
    };

    ws.onclose = (event) => {
      console.log("WebSocket closed", event.code);
      if (ws._pingInterval) {
        clearInterval(ws._pingInterval);
      }
      isConnectingRef.current = false;
      
      // Code 4000 is used for "kicked by owner" - don't treat as unexpected disconnect
      const wasUserInitiated = isUserInitiatedCloseRef.current || event.code === 1000 || event.code === 4000;
      isUserInitiatedCloseRef.current = false;
      
      // Only notify if this was an unexpected disconnection (not user-initiated and not kicked)
      if (!wasUserInitiated && enabled && lobbyId && callbacksRef.current.onDisconnect) {
        callbacksRef.current.onDisconnect(false);
      }
      
      // Only clear if this was the current connection
      if (wsRef.current === ws) {
        wsRef.current = null;
        if (connectedLobbyIdRef.current === lobbyId) {
          connectedLobbyIdRef.current = null;
        }
      }
    };

    // Cleanup on unmount or when lobbyId/enabled changes
    return () => {
      // Only cleanup if this is still the current connection AND it's for the same lobby
      // This prevents cleanup from running when React StrictMode causes double renders
      if (wsRef.current === ws && connectedLobbyIdRef.current === lobbyId) {
        if (ws._pingInterval) {
          clearInterval(ws._pingInterval);
        }
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          isUserInitiatedCloseRef.current = true;
          ws.close(1000); // Normal closure
        }
        // Only clear refs if this was the active connection
        if (wsRef.current === ws) {
          wsRef.current = null;
          connectedLobbyIdRef.current = null;
          isConnectingRef.current = false;
        }
      }
    };
  }, [lobbyId, enabled]); // Only depend on lobbyId and enabled, not callbacks

  return wsRef;
}

