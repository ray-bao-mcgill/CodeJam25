import React, { useState } from "react";
import { LobbyData, Player } from "../hooks/useLobby";
import { API_URL } from "../config";

interface LobbyWaitingRoomProps {
  lobby: LobbyData;
  onStartGame: () => void;
  onLeaveLobby: () => void;
  playerId?: string | null;
  onLobbyUpdate?: (lobby: LobbyData) => void;
}

export default function LobbyWaitingRoom({
  lobby,
  onStartGame,
  onLeaveLobby,
  playerId,
  onLobbyUpdate,
}: LobbyWaitingRoomProps) {
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const copyLobbyId = async () => {
    if (lobby?.id) {
      await navigator.clipboard.writeText(lobby.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const transferOwnership = async (newOwnerId: string) => {
    if (!lobby.id || !playerId) return;

    // Optimistically update UI immediately
    if (onLobbyUpdate) {
      onLobbyUpdate({
        ...lobby,
        owner_id: newOwnerId,
      });
    }

    try {
      const response = await fetch(
        `${API_URL}/api/lobby/${lobby.id}/transfer-ownership`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            new_owner_id: newOwnerId,
            current_owner_id: playerId,
          }),
        }
      );
      const data = await response.json();

      if (!data.success) {
        setError(data.message);
        // Revert optimistic update on error
        if (onLobbyUpdate) {
          onLobbyUpdate(lobby);
        }
      }
    } catch (err) {
      setError("Failed to transfer ownership");
      console.error("Error:", err);
      // Revert optimistic update on error
      if (onLobbyUpdate) {
        onLobbyUpdate(lobby);
      }
    }
  };

  const isOwner = lobby.owner_id === playerId;

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

          {error && <p className="text-error text-small">{error}</p>}

          <div>
            <p className="text-bold">Players ({lobby.players.length}/8):</p>
            {lobby.players.length === 0 ? (
              <p className="text-dimmed">No players yet</p>
            ) : (
              <ul className="player-list">
                {lobby.players.map((player: Player) => (
                  <li
                    key={player.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span>{player.name}</span>
                      {lobby.owner_id === player.id && (
                        <span title="Lobby Owner">👑</span>
                      )}
                    </span>
                    {isOwner &&
                      lobby.owner_id !== player.id &&
                      lobby.status === "waiting" && (
                        <button
                          onClick={() => transferOwnership(player.id)}
                          className="btn-icon"
                          title="Transfer ownership"
                          style={{
                            padding: "1px 4px",
                            fontSize: "10px",
                            lineHeight: "1.2",
                            opacity: 0.3,
                            transition: "opacity 0.2s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = "1";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = "0.3";
                          }}
                        >
                          👑 Transfer
                        </button>
                      )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="stack">
            {lobby.players.length >= 2 && lobby.status === "waiting" && (
              <button
                onClick={onStartGame}
                className="btn btn-large btn-success"
                disabled={!isOwner}
                style={{
                  opacity: !isOwner ? 0.5 : 1,
                  cursor: !isOwner ? "not-allowed" : "pointer",
                }}
                title={
                  !isOwner
                    ? "Only the lobby owner can start the game"
                    : "Start the game"
                }
              >
                {isOwner ? "Start Game 👑" : "Start Game (Owner Only)"}
              </button>
            )}
            <button onClick={onLeaveLobby} className="btn btn-outline">
              Leave Lobby
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

