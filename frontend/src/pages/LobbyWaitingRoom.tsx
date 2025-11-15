import React, { useState } from "react";
import { LobbyData, Player } from "../hooks/useLobby";
import { API_URL } from "../config";
import { Button } from "@/components/ui/button";

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
  const [transferring, setTransferring] = useState<string | null>(null);

  const copyLobbyId = async () => {
    if (lobby?.id) {
      await navigator.clipboard.writeText(lobby.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const transferOwnership = async (newOwnerId: string) => {
    // Prevent multiple simultaneous transfers
    if (transferring || !lobby?.id || !playerId) {
      return;
    }

    // Validate lobby still exists and user is still owner
    if (lobby.owner_id !== playerId) {
      setError("You are no longer the owner");
      return;
    }

    setTransferring(newOwnerId);
    setError("");

    // Store original lobby state for potential revert
    const originalLobby = { ...lobby };

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
        setError(data.message || "Failed to transfer ownership");
        // Revert optimistic update on error
        if (onLobbyUpdate) {
          onLobbyUpdate(originalLobby);
        }
      }
    } catch (err) {
      setError("Failed to transfer ownership");
      console.error("Error:", err);
      // Revert optimistic update on error
      if (onLobbyUpdate) {
        onLobbyUpdate(originalLobby);
      }
    } finally {
      setTransferring(null);
    }
  };

  const isOwner = lobby.owner_id === playerId;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 game-bg">
      <div className="w-full max-w-4xl space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 
            className="text-6xl font-black tracking-widest game-text-glow-cyan"
            style={{ 
              fontFamily: 'Impact, Arial Black, sans-serif',
              color: 'var(--game-cyan)',
              textTransform: 'uppercase'
            }}
          >
            LOBBY WAITING ROOM
          </h1>
          <p 
            className="text-xl font-bold"
            style={{ color: 'var(--game-text-secondary)' }}
          >
            Status: <span className="uppercase">{lobby.status}</span>
          </p>
        </div>

        {/* Lobby ID Section */}
        <div className="flex items-center justify-center gap-4 p-6 rounded-2xl"
          style={{
            background: 'rgba(15, 10, 31, 0.8)',
            border: '3px solid var(--game-cyan)',
          }}
        >
          <span 
            className="text-lg font-bold"
            style={{ color: 'var(--game-text-primary)' }}
          >
            Lobby ID:
          </span>
          <span 
            className="text-xl font-mono font-bold px-4 py-2 rounded-xl"
            style={{
              background: 'rgba(0, 184, 212, 0.2)',
              color: 'var(--game-cyan)',
              border: '2px solid var(--game-cyan)',
              fontFamily: 'monospace',
            }}
          >
            {lobby.id}
          </span>
          <Button
            onClick={copyLobbyId}
            className="px-4 py-2 text-lg rounded-xl transform hover:scale-110 transition-all duration-200"
            style={{
              background: copied 
                ? 'rgba(0, 255, 136, 0.2)' 
                : 'rgba(15, 10, 31, 0.8)',
              border: `2px solid ${copied ? 'var(--game-green)' : 'var(--game-cyan)'}`,
              color: copied ? 'var(--game-green)' : 'var(--game-cyan)',
              minWidth: '60px',
            }}
            title="Copy lobby ID"
          >
            {copied ? "✓ Copied" : "📋 Copy"}
          </Button>
        </div>

        {error && (
          <div className="text-red-400 text-lg font-bold text-center animate-in slide-in-from-top duration-300">
            {error}
          </div>
        )}

        {/* Players List */}
        <div className="space-y-6">
          <h2 
            className="text-3xl font-black text-center"
            style={{ 
              color: 'var(--game-text-primary)',
              fontFamily: 'Impact, Arial Black, sans-serif',
              textTransform: 'uppercase',
              letterSpacing: '0.1em'
            }}
          >
            Players ({lobby.players.length}/8)
          </h2>
          
          {lobby.players.length === 0 ? (
            <p 
              className="text-center text-xl"
              style={{ color: 'var(--game-text-dim)' }}
            >
              No players yet
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lobby.players.map((player: Player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-4 rounded-2xl transform hover:scale-105 transition-all duration-200"
                  style={{
                    background: lobby.owner_id === player.id
                      ? 'rgba(0, 184, 212, 0.2)'
                      : 'rgba(15, 10, 31, 0.8)',
                    border: `3px solid ${lobby.owner_id === player.id ? 'var(--game-cyan)' : '#555'}`,
                    boxShadow: lobby.owner_id === player.id
                      ? '0 0 20px var(--game-cyan-glow)'
                      : 'none',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span 
                      className="text-xl font-bold"
                      style={{ 
                        color: 'var(--game-text-primary)',
                        fontFamily: 'Impact, Arial Black, sans-serif',
                        textTransform: 'uppercase'
                      }}
                    >
                      {player.name}
                    </span>
                    {lobby.owner_id === player.id && (
                      <span 
                        className="text-2xl"
                        title="Lobby Owner"
                      >
                        👑
                      </span>
                    )}
                  </div>
                  
                  {isOwner &&
                    lobby.owner_id !== player.id &&
                    lobby.status === "waiting" && (
                      <Button
                        onClick={() => transferOwnership(player.id)}
                        disabled={transferring === player.id || !!transferring}
                        className="px-3 py-1 text-sm rounded-lg transition-all duration-200 disabled:opacity-30"
                        style={{
                          background: 'rgba(15, 10, 31, 0.8)',
                          border: '2px solid var(--game-cyan)',
                          color: 'var(--game-cyan)',
                          opacity: transferring === player.id ? 1 : 0.3,
                          fontFamily: 'Impact, Arial Black, sans-serif',
                          textTransform: 'uppercase',
                          fontSize: '10px',
                          cursor: transferring === player.id ? 'wait' : 'pointer',
                        }}
                        onMouseEnter={(e) => {
                          if (!transferring) {
                            e.currentTarget.style.opacity = "1";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (transferring !== player.id) {
                            e.currentTarget.style.opacity = "0.3";
                          }
                        }}
                        title={transferring === player.id ? "Transferring..." : "Transfer ownership"}
                      >
                        {transferring === player.id ? "⏳" : "👑 Transfer"}
                      </Button>
                    )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col items-center gap-6 pt-6">
          {lobby.players.length >= 2 && lobby.status === "waiting" && (
            <Button
              onClick={onStartGame}
              disabled={!isOwner}
              className="px-20 py-8 text-2xl font-bold rounded-2xl transform hover:scale-110 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: isOwner
                  ? `linear-gradient(135deg, #00cc66, var(--game-green))`
                  : 'rgba(50, 50, 50, 0.5)',
                border: isOwner
                  ? `3px solid var(--game-green)`
                  : '3px solid #555',
                color: 'var(--game-text-primary)',
                fontFamily: 'Impact, Arial Black, sans-serif',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                boxShadow: isOwner
                  ? `0 0 20px rgba(0, 255, 136, 0.5)`
                  : 'none',
                cursor: isOwner ? 'pointer' : 'not-allowed',
                width: '100%',
                maxWidth: '400px',
              }}
              title={
                !isOwner
                  ? "Only the lobby owner can start the game"
                  : "Start the game"
              }
            >
              {isOwner ? "START GAME 👑" : "START GAME (OWNER ONLY)"}
            </Button>
          )}
          
          <Button
            onClick={onLeaveLobby}
            className="px-16 py-6 text-xl font-bold rounded-2xl transform hover:scale-105 transition-all duration-300"
            style={{
              background: 'rgba(15, 10, 31, 0.8)',
              border: '3px solid var(--game-red)',
              color: 'var(--game-text-primary)',
              fontFamily: 'Impact, Arial Black, sans-serif',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              boxShadow: '0 0 10px var(--game-red-glow)',
            }}
          >
            LEAVE LOBBY
          </Button>
        </div>
      </div>
    </div>
  );
}

