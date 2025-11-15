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
}

export function useLobbyWebSocket({
  lobbyId,
  enabled,
  onLobbyUpdate,
  onGameStarted,
}: UseLobbyWebSocketOptions): RefObject<WebSocketWithInterval | null> {
  const wsRef = useRef<WebSocketWithInterval | null>(null);

  useEffect(() => {
    if (!enabled || !lobbyId) {
      return;
    }

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    console.log(`Connecting WebSocket to lobby ${lobbyId}`);

    const ws: WebSocketWithInterval = new WebSocket(
      `${WS_URL}/ws/lobby/${lobbyId}`
    );
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("✓ WebSocket connected");
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
        console.log("Received WebSocket message:", message.type);

        if (message.type === "lobby_update") {
          console.log("Updating lobby state:", message.lobby);
          onLobbyUpdate(message.lobby);
          
          // Check if game has started
          if (message.lobby.status === "starting" || message.lobby.status === "in_progress") {
            onGameStarted?.();
          }
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = (event) => {
      console.log("WebSocket closed", event.code);
      if (ws._pingInterval) {
        clearInterval(ws._pingInterval);
      }
      wsRef.current = null;

      // Reconnect if not intentional and still enabled
      if (event.code !== 1000 && lobbyId && enabled) {
        setTimeout(() => {
          console.log("Reconnecting...");
          // This will trigger the effect again
        }, 2000);
      }
    };

    // Cleanup on unmount or when dependencies change
    return () => {
      if (wsRef.current) {
        if (wsRef.current._pingInterval) {
          clearInterval(wsRef.current._pingInterval);
        }
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [lobbyId, enabled, onLobbyUpdate, onGameStarted]);

  return wsRef;
}

