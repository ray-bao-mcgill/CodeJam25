import React from "react";

interface LobbyJoinFormProps {
  lobbyId: string;
  playerName: string;
  error: string;
  isCreating: boolean;
  onLobbyIdChange: (value: string) => void;
  onPlayerNameChange: (value: string) => void;
  onCreateLobby: () => void;
  onJoinLobby: () => void;
}

export default function LobbyJoinForm({
  lobbyId,
  playerName,
  error,
  isCreating,
  onLobbyIdChange,
  onPlayerNameChange,
  onCreateLobby,
  onJoinLobby,
}: LobbyJoinFormProps) {
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
              onChange={(e) => onPlayerNameChange(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label>Lobby ID (leave empty to create new)</label>
            <input
              type="text"
              placeholder="Enter lobby ID to join"
              value={lobbyId}
              onChange={(e) => onLobbyIdChange(e.target.value)}
            />
          </div>

          {error && <p className="text-error text-small">{error}</p>}

          <div className="stack">
            {lobbyId.trim() ? (
              <button
                onClick={onJoinLobby}
                className="btn btn-large"
                disabled={isCreating}
              >
                {isCreating ? "Joining..." : "Join Lobby"}
              </button>
            ) : (
              <button
                onClick={onCreateLobby}
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

