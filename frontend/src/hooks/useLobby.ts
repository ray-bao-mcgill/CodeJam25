import { useState } from "react";
import { API_URL } from "../config";

export interface Player {
  id: string;
  name: string;
}

export interface LobbyData {
  id: string;
  status: string;
  players: Player[];
  created_at?: string;
  match?: any;
}

export function useLobby() {
  const [lobbyId, setLobbyId] = useState<string>("");
  const [playerName, setPlayerName] = useState<string>("");
  const [joined, setJoined] = useState<boolean>(false);
  const [lobby, setLobby] = useState<LobbyData | null>(null);
  const [error, setError] = useState<string>("");
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [playerId, setPlayerId] = useState<string | null>(null);

  const createLobby = async () => {
    if (!playerName.trim()) {
      setError("Please enter your name");
      return;
    }

    setIsCreating(true);
    setError("");

    try {
      const createResponse = await fetch(`${API_URL}/api/lobby/create`, {
        method: "POST",
      });
      const createData = await createResponse.json();

      if (createData.lobby_id) {
        const joinResponse = await fetch(`${API_URL}/api/lobby/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lobby_id: createData.lobby_id,
            player_name: playerName.trim(),
          }),
        });

        const joinData = await joinResponse.json();

        if (joinData.success) {
          setLobbyId(createData.lobby_id);
          setJoined(true);
          setLobby(joinData.lobby);
          setPlayerId(joinData.player_id);
          return { success: true, lobbyId: createData.lobby_id };
        } else {
          setError(joinData.message);
          return { success: false, error: joinData.message };
        }
      } else {
        setError("Failed to create lobby");
        return { success: false, error: "Failed to create lobby" };
      }
    } catch (err) {
      const errorMsg = "Failed to create lobby";
      setError(errorMsg);
      console.error("Error:", err);
      return { success: false, error: errorMsg };
    } finally {
      setIsCreating(false);
    }
  };

  const joinLobby = async () => {
    if (!lobbyId.trim() || !playerName.trim()) {
      setError("Please enter both lobby ID and your name");
      return { success: false, error: "Please enter both lobby ID and your name" };
    }

    try {
      const response = await fetch(`${API_URL}/api/lobby/join`, {
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
        setPlayerId(data.player_id);
        return { success: true, lobbyId: lobbyId.trim() };
      } else {
        setError(data.message);
        return { success: false, error: data.message };
      }
    } catch (err) {
      const errorMsg = "Failed to join lobby";
      setError(errorMsg);
      console.error("Error:", err);
      return { success: false, error: errorMsg };
    }
  };

  const startGame = async () => {
    if (!lobbyId) {
      setError("No lobby ID");
      return { success: false, error: "No lobby ID" };
    }

    try {
      const response = await fetch(`${API_URL}/api/lobby/${lobbyId}/start`, {
        method: "POST",
      });
      const data = await response.json();

      if (data.success) {
        return { success: true };
      } else {
        setError(data.message);
        return { success: false, error: data.message };
      }
    } catch (err) {
      const errorMsg = "Failed to start game";
      setError(errorMsg);
      console.error("Error:", err);
      return { success: false, error: errorMsg };
    }
  };

  const leaveLobby = async () => {
    if (!lobbyId || !playerId) {
      return;
    }

    try {
      await fetch(`${API_URL}/api/lobby/${lobbyId}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player_id: playerId,
        }),
      });
    } catch (err) {
      console.error("Error leaving lobby:", err);
    } finally {
      // Reset state
      setJoined(false);
      setLobby(null);
      setLobbyId("");
      setPlayerName("");
      setPlayerId(null);
      setError("");
    }
  };

  const reset = () => {
    setJoined(false);
    setLobby(null);
    setLobbyId("");
    setPlayerName("");
    setPlayerId(null);
    setError("");
    setIsCreating(false);
  };

  return {
    // State
    lobbyId,
    playerName,
    joined,
    lobby,
    error,
    isCreating,
    playerId,
    // Setters
    setLobbyId,
    setPlayerName,
    setLobby,
    setError,
    // Actions
    createLobby,
    joinLobby,
    startGame,
    leaveLobby,
    reset,
  };
}

