import React, { useState, useCallback } from "react";
import { useLobby } from "../hooks/useLobby";
import { useLobbyWebSocket } from "../hooks/useLobbyWebSocket";
import { LobbyData } from "../hooks/useLobby";
import LobbyJoinForm from "./LobbyJoinForm";
import LobbyWaitingRoom from "./LobbyWaitingRoom";
import ReadyScreen from "./ReadyScreen";

const LobbyCreation: React.FC = () => {
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const {
    lobbyId,
    playerName,
    joined,
    lobby,
    error,
    isCreating,
    playerId,
    setLobbyId,
    setPlayerName,
    setLobby,
    createLobby,
    joinLobby,
    startGame,
    leaveLobby,
  } = useLobby();

  const handleLobbyUpdate = useCallback(
    (updatedLobby: LobbyData) => {
      setLobby(updatedLobby);
      if (
        updatedLobby.status === "starting" ||
        updatedLobby.status === "in_progress"
      ) {
        setGameStarted(true);
      }
    },
    [setLobby]
  );

  const handleGameStarted = useCallback(() => {
    setGameStarted(true);
  }, []);

  const wsRef = useLobbyWebSocket({
    lobbyId: joined ? lobbyId : null,
    enabled: joined,
    onLobbyUpdate: handleLobbyUpdate,
    onGameStarted: handleGameStarted,
  });

  const handleCreateLobby = async () => {
    const result = await createLobby();
    if (result?.success && result.lobbyId) {
      // WebSocket will connect automatically via the hook
    }
  };

  const handleJoinLobby = async () => {
    const result = await joinLobby();
    if (result?.success && result.lobbyId) {
      // WebSocket will connect automatically via the hook
    }
  };

  const handleStartGame = async () => {
    await startGame();
  };

  const handleLeaveLobby = async () => {
    await leaveLobby();
    setGameStarted(false);
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  // Ready screen when game starts
  if (gameStarted && lobby) {
    return <ReadyScreen lobby={lobby} />;
  }

  // Lobby waiting room
  if (joined && lobby) {
    return (
      <LobbyWaitingRoom
        lobby={lobby}
        onStartGame={handleStartGame}
        onLeaveLobby={handleLeaveLobby}
        playerId={playerId}
        onLobbyUpdate={handleLobbyUpdate}
      />
    );
  }

  // Join/create form
  return (
    <LobbyJoinForm
      lobbyId={lobbyId}
      playerName={playerName}
      error={error}
      isCreating={isCreating}
      onLobbyIdChange={setLobbyId}
      onPlayerNameChange={setPlayerName}
      onCreateLobby={handleCreateLobby}
      onJoinLobby={handleJoinLobby}
    />
  );
};

export default LobbyCreation;


