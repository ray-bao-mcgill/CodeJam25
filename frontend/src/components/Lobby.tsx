import React, { useState, useEffect, useRef } from "react";

interface Player {
  id: string;
  name: string;
}

interface LobbyData {
  id: string;
  status: string;
  players: Player[];
}

interface WebSocketWithInterval extends WebSocket {
  _pingInterval?: number;
}

export default function Lobby() {
  const [lobbyId, setLobbyId] = useState<string>("");
  const [playerName, setPlayerName] = useState<string>("");
  const [joined, setJoined] = useState<boolean>(false);
  const [lobby, setLobby] = useState<LobbyData | null>(null);
  const [error, setError] = useState<string>("");
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const wsRef = useRef<WebSocketWithInterval | null>(null);
  const lobbyIdRef = useRef<string | null>(null);
  const playerIdRef = useRef<string | null>(null);

  const copyLobbyId = async () => {
    if (lobby?.id) {
      await navigator.clipboard.writeText(lobby.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const connectWebSocket = (id: string) => {
    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    console.log(`Connecting WebSocket to lobby ${id}`);
    lobbyIdRef.current = id;

    const ws: WebSocketWithInterval = new WebSocket(
      `ws://127.0.0.1:8000/ws/lobby/${id}`
    );
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("✓ WebSocket connected");
      // Send ping every 20 seconds
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        } else {
          clearInterval(pingInterval);
        }
      }, 20000);
      ws._pingInterval = pingInterval;
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log("Received WebSocket message:", message.type);

        if (message.type === "lobby_update") {
          console.log("Updating lobby state:", message.lobby);
          setLobby(message.lobby);
          // Check if game has started
          if (message.lobby.status === "starting") {
            setGameStarted(true);
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

      // Reconnect if not intentional
      if (event.code !== 1000 && lobbyIdRef.current && joined) {
        setTimeout(() => {
          console.log("Reconnecting...");
          connectWebSocket(lobbyIdRef.current!);
        }, 2000);
      }
    };
  };

  const createLobby = async () => {
    if (!playerName.trim()) {
      setError("Please enter your name");
      return;
    }

    setIsCreating(true);
    setError("");

    try {
      const createResponse = await fetch(
        "http://127.0.0.1:8000/api/lobby/create",
        {
          method: "POST",
        }
      );
      const createData = await createResponse.json();

      if (createData.lobby_id) {
        const joinResponse = await fetch(
          "http://127.0.0.1:8000/api/lobby/join",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lobby_id: createData.lobby_id,
              player_name: playerName.trim(),
            }),
          }
        );

        const joinData = await joinResponse.json();

        if (joinData.success) {
          setLobbyId(createData.lobby_id);
          setJoined(true);
          setLobby(joinData.lobby);
          playerIdRef.current = joinData.player_id;
          // Connect WebSocket AFTER joining
          setTimeout(() => {
            connectWebSocket(createData.lobby_id);
          }, 100);
        } else {
          setError(joinData.message);
        }
      }
    } catch (err) {
      setError("Failed to create lobby");
      console.error("Error:", err);
    } finally {
      setIsCreating(false);
    }
  };

  const joinLobby = async () => {
    if (!lobbyId.trim() || !playerName.trim()) {
      setError("Please enter both lobby ID and your name");
      return;
    }

    try {
      const response = await fetch("http://127.0.0.1:8000/api/lobby/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lobby_id: lobbyId.trim(),
          player_name: playerName.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setLobbyId(lobbyId.trim());
        setJoined(true);
        setLobby(data.lobby);
        playerIdRef.current = data.player_id;
        // Connect WebSocket AFTER joining
        setTimeout(() => {
          connectWebSocket(lobbyId.trim());
        }, 100);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Failed to join lobby");
      console.error("Error:", err);
    }
  };

  const startGame = async () => {
    if (!lobbyIdRef.current) return;

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/api/lobby/${lobbyIdRef.current}/start`,
        {
          method: "POST",
        }
      );
      const data = await response.json();

      if (data.success) {
        setGameStarted(true);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Failed to start game");
      console.error("Error:", err);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        if (wsRef.current._pingInterval) {
          clearInterval(wsRef.current._pingInterval);
        }
        wsRef.current.close();
      }
    };
  }, []);

  // Ready screen when game starts
  if (gameStarted && lobby) {
    return (
      <div className="container">
        <div className="paper">
          <div className="stack">
            <h2 className="text-center">Ready Screen</h2>
            <p className="text-large text-center">Game Starting...</p>

            <div>
              <p className="text-bold text-center">Players:</p>
              <ul className="player-list">
                {lobby.players.map((player) => (
                  <li key={player.id}>{player.name}</li>
                ))}
              </ul>
            </div>

            <p className="text-small text-dimmed text-center">
              Preparing interview questions...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (joined && lobby) {
    return (
      <div className="container">
        <div className="paper">
          <div className="stack">
            <h2 className="text-center">Lobby: {lobby.id}</h2>
            <p className="text-small text-dimmed text-center">
              Status: {lobby.status}
            </p>

            <div className="group">
              <span className="text-small text-bold">Lobby ID:</span>
              <span className="text-small monospace">{lobby.id}</span>
              <button
                className="btn-icon"
                onClick={copyLobbyId}
                title="Copy lobby ID"
              >
                {copied ? "✓" : "📋"}
              </button>
            </div>

            <div>
              <p className="text-bold">Players ({lobby.players.length}/2):</p>
              {lobby.players.length === 0 ? (
                <p className="text-dimmed">No players yet</p>
              ) : (
                <ul className="player-list">
                  {lobby.players.map((player) => (
                    <li key={player.id}>{player.name}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="stack">
              {lobby.players.length === 2 && lobby.status === "waiting" && (
                <button
                  onClick={startGame}
                  className="btn btn-large btn-success"
                >
                  Start Game
                </button>
              )}
              <button
                onClick={() => {
                  setJoined(false);
                  setLobby(null);
                  setLobbyId("");
                  setPlayerName("");
                  setGameStarted(false);
                  if (wsRef.current) {
                    wsRef.current.close();
                    wsRef.current = null;
                  }
                }}
                className="btn btn-outline"
              >
                Leave Lobby
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="paper">
        <div className="stack">
          <h2 className="text-center">Lobby</h2>

          <div className="input-group">
            <label>Your Name</label>
            <input
              type="text"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label>Lobby ID (leave empty to create new)</label>
            <input
              type="text"
              placeholder="Enter lobby ID to join"
              value={lobbyId}
              onChange={(e) => setLobbyId(e.target.value)}
            />
          </div>

          {error && <p className="text-error text-small">{error}</p>}

          <div className="stack">
            {lobbyId.trim() ? (
              <button
                onClick={joinLobby}
                className="btn btn-large"
                disabled={isCreating}
              >
                {isCreating ? "Joining..." : "Join Lobby"}
              </button>
            ) : (
              <button
                onClick={createLobby}
                className="btn btn-large"
                disabled={isCreating}
              >
                {isCreating ? "Creating..." : "Create Lobby"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
