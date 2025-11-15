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
  owner_id?: string;
}

export function useLobby() {
  // Load initial state from sessionStorage
  const [lobbyId, setLobbyIdState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('lobbyId') || '';
    }
    return '';
  });
  const [playerName, setPlayerNameState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('playerName') || '';
    }
    return '';
  });
  const [joined, setJoinedState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('joined') === 'true';
    }
    return false;
  });
  const [lobby, setLobbyState] = useState<LobbyData | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('lobby');
      return stored ? JSON.parse(stored) : null;
    }
    return null;
  });
  const [error, setError] = useState<string>("");
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [playerId, setPlayerIdState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('playerId') || null;
    }
    return null;
  });

  // Wrapper setters that also update sessionStorage
  const setLobbyId = (id: string) => {
    setLobbyIdState(id);
    if (id) {
      sessionStorage.setItem('lobbyId', id);
    } else {
      sessionStorage.removeItem('lobbyId');
    }
  };

  const setPlayerName = (name: string) => {
    setPlayerNameState(name);
    if (name) {
      sessionStorage.setItem('playerName', name);
    } else {
      sessionStorage.removeItem('playerName');
    }
  };

  const setJoined = (value: boolean) => {
    setJoinedState(value);
    sessionStorage.setItem('joined', value.toString());
    if (!value) {
      sessionStorage.removeItem('joined');
    }
  };

  const setLobby = (lobbyData: LobbyData | null) => {
    setLobbyState(lobbyData);
    if (lobbyData) {
      sessionStorage.setItem('lobby', JSON.stringify(lobbyData));
    } else {
      sessionStorage.removeItem('lobby');
    }
  };

  const setPlayerId = (id: string | null) => {
    setPlayerIdState(id);
    if (id) {
      sessionStorage.setItem('playerId', id);
    } else {
      sessionStorage.removeItem('playerId');
    }
  };

  const createLobby = async (playerNameToUse: string) => {
    if (!playerNameToUse || !playerNameToUse.trim()) {
      setError("Please enter your name");
      return { success: false, error: "Please enter your name" };
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
            player_name: playerNameToUse.trim(),
          }),
        });

        const joinData = await joinResponse.json();

        if (joinData.success) {
          // Only save to sessionStorage after successful lobby creation/join
          setPlayerName(playerNameToUse.trim());
          // Use wrapper setters which persist to sessionStorage
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

  const joinLobby = async (customLobbyId?: string, customPlayerName?: string) => {
    // Use custom parameters if provided, otherwise use state
    const lobbyIdToUse = customLobbyId || lobbyId;
    const playerNameToUse = customPlayerName || playerName;

    if (!lobbyIdToUse.trim() || !playerNameToUse.trim()) {
      setError("Please enter both lobby ID and your name");
      return { success: false, error: "Please enter both lobby ID and your name" };
    }

    try {
      const response = await fetch(`${API_URL}/api/lobby/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lobby_id: lobbyIdToUse.trim(),
          player_name: playerNameToUse.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Use wrapper setters which persist to sessionStorage
        // Use the lobby ID from the response, not the one we sent (in case of mismatch)
        const responseLobbyId = data.lobby?.id || lobbyIdToUse.trim();
        setLobbyId(responseLobbyId);
        setPlayerName(playerNameToUse.trim());
        setJoined(true);
        setLobby(data.lobby);
        setPlayerId(data.player_id);
        return { success: true, lobbyId: responseLobbyId };
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
    if (!lobbyId || !playerId) {
      setError("No lobby ID or player ID");
      return { success: false, error: "No lobby ID or player ID" };
    }

    try {
      // Get match configuration from sessionStorage
      const jobMode = sessionStorage.getItem('jobMode');
      let matchType: string | null = null;
      let jobDescription: string | null = null;
      let role: string | null = null;
      let level: string | null = null;

      if (jobMode === 'description') {
        matchType = 'job_posting';
        jobDescription = sessionStorage.getItem('jobDescription');
      } else if (jobMode === 'role') {
        matchType = 'generalized';
        role = sessionStorage.getItem('selectedRole');
        level = sessionStorage.getItem('selectedLevel');
      }

      // Build request body
      const requestBody: any = {
        player_id: playerId,
      };

      if (matchType) {
        requestBody.match_type = matchType;
        if (matchType === 'job_posting' && jobDescription) {
          requestBody.job_description = jobDescription;
        } else if (matchType === 'generalized' && role && level) {
          requestBody.role = role;
          requestBody.level = level;
        }
      }

      const response = await fetch(`${API_URL}/api/lobby/${lobbyId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
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
      // Reset state and clear sessionStorage
      setJoined(false);
      setLobby(null);
      setLobbyId("");
      setPlayerName("");
      setPlayerId(null);
      setError("");
      // Clear sessionStorage
      sessionStorage.removeItem('lobbyId');
      sessionStorage.removeItem('playerId');
      sessionStorage.removeItem('joined');
      sessionStorage.removeItem('lobby');
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
    // Clear sessionStorage
    sessionStorage.removeItem('lobbyId');
    sessionStorage.removeItem('playerId');
    sessionStorage.removeItem('joined');
    sessionStorage.removeItem('lobby');
    sessionStorage.removeItem('playerName');
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

