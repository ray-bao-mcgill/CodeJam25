import React, { useState } from "react";
import { LobbyData, Player } from "../hooks/useLobby";

interface LobbyWaitingRoomProps {
  lobby: LobbyData;
  onStartGame: () => void;
  onLeaveLobby: () => void;
}

export default function LobbyWaitingRoom({
  lobby,
  onStartGame,
  onLeaveLobby,
}: LobbyWaitingRoomProps) {
  const [copied, setCopied] = useState<boolean>(false);

  const copyLobbyId = async () => {
    if (lobby?.id) {
      await navigator.clipboard.writeText(lobby.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
            <p className="text-bold">Players ({lobby.players.length}/8):</p>
            {lobby.players.length === 0 ? (
              <p className="text-dimmed">No players yet</p>
            ) : (
              <ul className="player-list">
                {lobby.players.map((player: Player) => (
                  <li key={player.id}>{player.name}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="stack">
            {lobby.players.length >= 2 && lobby.status === "waiting" && (
              <button
                onClick={onStartGame}
                className="btn btn-large btn-success"
              >
                Start Game
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

