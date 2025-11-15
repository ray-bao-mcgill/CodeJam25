import React, { useState, useEffect } from "react";
import { LobbyData, Player } from "../hooks/useLobby";
import { API_URL } from "../config";

interface LobbyWaitingRoomProps {
  lobby: LobbyData;
  onStartGame: () => void;
  onLeaveLobby: () => void;
  playerId?: string | null;
  playerName?: string | null;
  onLobbyUpdate?: (lobby: LobbyData) => void;
  showDisconnectNotification?: boolean;
  onDismissDisconnect?: () => void;
}

export default function LobbyWaitingRoom({
  lobby,
  onStartGame,
  onLeaveLobby,
  playerId,
  playerName,
  onLobbyUpdate,
  showDisconnectNotification = false,
  onDismissDisconnect,
}: LobbyWaitingRoomProps) {
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedFromModal, setCopiedFromModal] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [transferring, setTransferring] = useState<string | null>(null);
  const [kicking, setKicking] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);

  const getInviteUrl = (): string => {
    if (!lobby?.id) return '';
    const baseUrl = window.location.origin;
    return `${baseUrl}/lobby-join/${lobby.id}`;
  };

  const copyInviteUrl = async (fromModal: boolean = false) => {
    const inviteUrl = getInviteUrl();
    if (inviteUrl) {
      try {
        // Check if clipboard API is available
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(inviteUrl);
        } else {
          // Fallback for browsers without clipboard API
          const textArea = document.createElement('textarea');
          textArea.value = inviteUrl;
          textArea.style.position = 'fixed';
          textArea.style.left = '-999999px';
          textArea.style.top = '-999999px';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          try {
            document.execCommand('copy');
          } catch (err) {
            console.error('Failed to copy using fallback method:', err);
            setError('Failed to copy invite link. Please copy manually: ' + inviteUrl);
            return;
          }
          document.body.removeChild(textArea);
        }
        
        if (fromModal) {
          setCopiedFromModal(true);
        } else {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      } catch (err) {
        console.error('Failed to copy invite URL:', err);
        setError('Failed to copy invite link. Please copy manually: ' + inviteUrl);
      }
    }
  };

  const transferOwnership = async (newOwnerId: string) => {
    // Prevent multiple simultaneous transfers
    if (transferring || !lobby?.id || !playerId) {
      return;
    }

    // Validate lobby exists
    if (!lobby || !lobby.id) {
      setError("Lobby not found. Please refresh the page.");
      setTimeout(() => setError(""), 5000);
      return;
    }

    // Validate lobby still exists and user is still owner
    if (lobby.owner_id !== playerId) {
      setError("You are no longer the owner");
      setTimeout(() => setError(""), 3000);
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

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        setError(data.message || "Failed to transfer ownership");
        // Revert optimistic update on error
        if (onLobbyUpdate) {
          onLobbyUpdate(originalLobby);
        }
        // Auto-clear error after 5 seconds
        setTimeout(() => setError(""), 5000);
      } else {
        // Success - ensure error is cleared
        setError("");
        // WebSocket will update the lobby state, so we don't need to do anything else
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to transfer ownership";
      setError(errorMessage.includes("404") || errorMessage.includes("not found") 
        ? "Lobby not found. Please refresh the page." 
        : "Failed to transfer ownership");
      console.error("Error:", err);
      // Revert optimistic update on error
      if (onLobbyUpdate) {
        onLobbyUpdate(originalLobby);
      }
      // Auto-clear error after 5 seconds
      setTimeout(() => setError(""), 5000);
    } finally {
      setTransferring(null);
    }
  };

  const kickPlayer = async (targetPlayerId: string) => {
    // Prevent multiple simultaneous kicks
    if (kicking || !lobby?.id || !playerId) {
      return;
    }

    // Validate lobby exists
    if (!lobby || !lobby.id) {
      setError("Lobby not found. Please refresh the page.");
      setTimeout(() => setError(""), 5000);
      return;
    }

    // Validate lobby still exists and user is still owner
    if (lobby.owner_id !== playerId) {
      setError("You are no longer the owner");
      setTimeout(() => setError(""), 3000);
      return;
    }

    // Don't allow kicking yourself
    if (targetPlayerId === playerId) {
      setError("Cannot kick yourself");
      setTimeout(() => setError(""), 3000);
      return;
    }

    setKicking(targetPlayerId);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/lobby/${lobby.id}/kick`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            player_id: targetPlayerId,
            owner_id: playerId,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        setError(data.message || "Failed to kick player");
        setTimeout(() => setError(""), 5000);
      } else {
        setError("");
        // WebSocket will update the lobby state
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to kick player";
      setError(errorMessage.includes("404") || errorMessage.includes("not found") 
        ? "Lobby not found. Please refresh the page." 
        : "Failed to kick player");
      console.error("Error:", err);
      setTimeout(() => setError(""), 5000);
    } finally {
      setKicking(null);
    }
  };

  const isOwner = lobby.owner_id === playerId;

  // Auto-dismiss disconnect notification after 5 seconds
  useEffect(() => {
    if (showDisconnectNotification && onDismissDisconnect) {
      const timer = setTimeout(() => {
        onDismissDisconnect();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showDisconnectNotification, onDismissDisconnect]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 sm:p-6 game-bg">
      <div className="w-full max-w-5xl space-y-6 sm:space-y-8 relative">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="game-paper px-8 py-4 sm:px-12 sm:py-6 game-shadow-hard-lg game-hand-drawn inline-block">
            <h1 className="game-title text-3xl sm:text-4xl">
              LOBBY WAITING ROOM
            </h1>
          </div>
          <div className="game-label-text text-sm sm:text-base">
            STATUS: <span className="uppercase">{lobby.status}</span>
          </div>
        </div>

        {/* Lobby ID Section */}
        <div className="game-paper px-3 py-2 sm:px-4 sm:py-2.5 game-shadow-hard flex items-center justify-center gap-2 sm:gap-3 flex-wrap mx-auto"
          style={{
            border: '4px solid var(--game-text-primary)',
            maxWidth: '900px',
            width: '100%'
          }}
        >
          <div className="game-label-text text-xs sm:text-sm">LOBBY ID</div>
          <div 
            className="game-sharp px-2.5 py-1 sm:px-3 sm:py-1.5 text-base sm:text-lg font-black uppercase tracking-widest game-shadow-hard-sm flex items-center gap-2 cursor-pointer game-button-hover"
            onClick={() => copyInviteUrl(false)}
            style={{
              background: 'var(--game-yellow)',
              color: 'var(--game-text-primary)',
              border: '3px solid var(--game-text-primary)',
              fontFamily: 'Courier New, monospace',
              letterSpacing: '0.15em',
              transition: 'all 0.2s ease'
            }}
            title="Click to copy invite link"
          >
            <span>{lobby.id}</span>
            <span className="text-xs sm:text-sm flex-shrink-0" style={{ opacity: copied ? 1 : 0.7 }}>
              {copied ? '✓' : '🔗'}
            </span>
          </div>
        </div>

        {error && (
          <div className="game-sticky-note px-4 py-2 sm:px-6 sm:py-3 game-shadow-hard-sm">
            <div className="text-sm sm:text-base font-black uppercase text-red-600">
              ⚠️ {error}
            </div>
          </div>
        )}

        {/* Players List */}
        <div className="space-y-3 sm:space-y-4 mx-auto" style={{ maxWidth: '900px', width: '100%' }}>
          <div className="game-label-text text-base sm:text-lg text-center">
            PLAYERS ({lobby.players.length}/8)
          </div>
          
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {lobby.players.map((player: Player, idx: number) => {
              const isPlayerOwner = lobby.owner_id === player.id;
              // Check if this is the current player by ID or by name (fallback)
              const isCurrentPlayer = playerId 
                ? player.id === playerId 
                : playerName 
                  ? player.name.toLowerCase().trim() === playerName.toLowerCase().trim()
                  : false;
              return (
                <div
                  key={player.id}
                  className={`game-sharp flex items-center justify-between p-2 sm:p-2.5 game-shadow-hard-sm transition-all duration-100 ${
                    isPlayerOwner ? 'game-block-yellow' : 'game-paper'
                  }`}
                  style={{
                    border: '3px solid var(--game-text-primary)',
                    color: 'var(--game-text-primary)',
                    transform: `rotate(${idx % 2 === 0 ? '-0.5deg' : '0.5deg'})`,
                    height: '48px',
                    width: '100%'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = `rotate(${idx % 2 === 0 ? '-0.5deg' : '0.5deg'}) translate(1px, 1px)`
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = `rotate(${idx % 2 === 0 ? '-0.5deg' : '0.5deg'})`
                  }}
                >
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                    <span className="text-xs sm:text-sm font-black uppercase tracking-wider truncate">
                      {player.name}
                    </span>
                    {isCurrentPlayer && (
                      <span className="text-xs sm:text-sm font-black uppercase tracking-wider flex-shrink-0" title="You">
                        (me)
                      </span>
                    )}
                    {isPlayerOwner && (
                      <span className="text-sm sm:text-base flex-shrink-0" title="Lobby Owner">
                        👑
                      </span>
                    )}
                  </div>
                  
                  {isOwner &&
                    !isPlayerOwner &&
                    lobby.status === "waiting" && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => transferOwnership(player.id)}
                          disabled={transferring === player.id || !!transferring || !!kicking}
                          className="game-sharp px-2 py-1 text-xs font-black game-shadow-hard-sm game-button-hover disabled:opacity-30 flex-shrink-0"
                          style={{
                            background: 'var(--game-bg-alt)',
                            border: '2px solid var(--game-text-primary)',
                            color: 'var(--game-text-primary)',
                            opacity: transferring === player.id ? 1 : 0.4,
                            cursor: transferring === player.id ? 'wait' : 'pointer',
                          }}
                          onMouseEnter={(e) => {
                            if (!transferring && !kicking) {
                              e.currentTarget.style.opacity = "1";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (transferring !== player.id) {
                              e.currentTarget.style.opacity = "0.4";
                            }
                          }}
                          title={transferring === player.id ? "Transferring..." : "Transfer ownership"}
                        >
                          {transferring === player.id ? "⏳" : "👑"}
                        </button>
                        <button
                          onClick={() => kickPlayer(player.id)}
                          disabled={kicking === player.id || !!kicking || !!transferring}
                          className="game-sharp px-2 py-1 text-xs font-black game-shadow-hard-sm game-button-hover disabled:opacity-30 flex-shrink-0"
                          style={{
                            background: 'var(--game-bg-alt)',
                            border: '2px solid var(--game-text-primary)',
                            color: 'var(--game-text-primary)',
                            opacity: kicking === player.id ? 1 : 0.4,
                            cursor: kicking === player.id ? 'wait' : 'pointer',
                          }}
                          onMouseEnter={(e) => {
                            if (!kicking && !transferring) {
                              e.currentTarget.style.opacity = "1";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (kicking !== player.id) {
                              e.currentTarget.style.opacity = "0.4";
                            }
                          }}
                          title={kicking === player.id ? "Kicking..." : "Kick player"}
                        >
                          {kicking === player.id ? "⏳" : "❌"}
                        </button>
                      </div>
                    )}
                </div>
              );
            })}
            {Array.from({ length: Math.max(0, 8 - lobby.players.length) }).map((_, idx) => {
              const totalIdx = lobby.players.length + idx;
              return (
                <div
                  key={`empty-${idx}`}
                  onClick={() => {
                    setShowInviteModal(true);
                  }}
                  className="game-sharp flex items-center justify-center p-2 sm:p-2.5 game-shadow-hard-sm transition-all duration-100 game-paper cursor-pointer"
                  style={{
                    border: '3px solid var(--game-text-primary)',
                    color: 'var(--game-text-primary)',
                    transform: `rotate(${totalIdx % 2 === 0 ? '-0.5deg' : '0.5deg'})`,
                    height: '48px',
                    width: '100%',
                    opacity: 0.4,
                    background: 'var(--game-bg-alt)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = "1";
                    e.currentTarget.style.background = 'var(--game-blue)';
                    e.currentTarget.style.color = 'var(--game-text-white)';
                    e.currentTarget.style.transform = `rotate(${totalIdx % 2 === 0 ? '-0.5deg' : '0.5deg'}) translate(1px, 1px) scale(1.02)`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = "0.4";
                    e.currentTarget.style.background = 'var(--game-bg-alt)';
                    e.currentTarget.style.color = 'var(--game-text-primary)';
                    e.currentTarget.style.transform = `rotate(${totalIdx % 2 === 0 ? '-0.5deg' : '0.5deg'})`;
                  }}
                >
                  <span className="text-xs sm:text-sm font-black uppercase tracking-wider">
                    + INVITE
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col items-center gap-4 sm:gap-6 pt-4 sm:pt-6">
          {lobby.players.length >= 2 && lobby.status === "waiting" && (
            <button
              onClick={onStartGame}
              disabled={!isOwner}
              className={`game-sharp px-8 py-4 sm:px-12 sm:py-5 text-base sm:text-lg font-black uppercase tracking-widest game-shadow-hard-lg game-button-hover ${
                isOwner ? 'game-block-green' : 'game-paper'
              }`}
              style={{
                border: '6px solid var(--game-text-primary)',
                color: isOwner ? 'var(--game-text-white)' : 'var(--game-text-dim)',
                letterSpacing: '0.15em',
                cursor: isOwner ? 'pointer' : 'not-allowed',
                width: '100%',
                maxWidth: '400px',
                opacity: isOwner ? 1 : 0.5
              }}
              title={
                !isOwner
                  ? "Only the lobby owner can start the game"
                  : "Start the game"
              }
            >
              {isOwner ? "START GAME 👑" : "START GAME (OWNER ONLY)"}
            </button>
          )}
          
          <button
            onClick={onLeaveLobby}
            className="game-sharp game-paper px-8 py-3 sm:px-10 sm:py-4 text-sm sm:text-base font-black uppercase tracking-widest game-shadow-hard game-button-hover"
            style={{
              border: '4px solid var(--game-text-primary)',
              color: 'var(--game-text-primary)',
              letterSpacing: '0.1em'
            }}
          >
            LEAVE LOBBY
          </button>
        </div>

        {/* Decorative sticky notes */}
        <div className="absolute top-16 right-2 sm:top-20 sm:right-4 game-sticky-note-alt px-2 py-1.5 sm:px-3 sm:py-2 game-shadow-hard-sm opacity-50">
          <div className="text-xs font-bold uppercase">Ready?</div>
        </div>
      </div>

      {/* Disconnect Notification */}
      {showDisconnectNotification && (
        <div
          className="fixed top-4 right-4 z-50 game-sticky-note px-4 py-3 game-shadow-hard-sm"
          style={{
            animation: 'fadeIn 0.3s ease-out',
            maxWidth: '300px'
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <div className="text-sm font-black uppercase text-red-600">
              DISCONNECTED
            </div>
            <button
              onClick={() => {
                if (onDismissDisconnect) {
                  onDismissDisconnect();
                }
              }}
              className="ml-auto text-xs font-black"
              style={{ color: 'var(--game-text-primary)' }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Invite Modal Overlay */}
      {showInviteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            background: 'rgba(0, 0, 0, 0.75)',
            animation: 'fadeIn 0.3s ease-out'
          }}
          onClick={() => setShowInviteModal(false)}
        >
          <div
            className="game-paper game-shadow-hard-lg relative"
            style={{
              border: '6px solid var(--game-text-primary)',
              background: 'var(--game-bg-alt)',
              padding: '2rem',
              maxWidth: '500px',
              width: '100%',
              animation: 'scaleIn 0.3s ease-out',
              transform: 'rotate(-1deg)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowInviteModal(false)}
              className="absolute top-2 right-2 game-sharp w-8 h-8 flex items-center justify-center game-shadow-hard-sm game-button-hover"
              style={{
                border: '3px solid var(--game-text-primary)',
                background: 'var(--game-red)',
                color: 'var(--game-text-white)',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
            
            <div className="text-center space-y-4">
              <div className="game-label-text text-xl sm:text-2xl">
                INVITE PLAYERS
              </div>
              
              <div className="game-label-text text-sm sm:text-base">
                SHARE THIS INVITE LINK:
              </div>
              
              <div 
                className="game-sharp px-4 py-3 text-sm sm:text-base font-black tracking-wider game-shadow-hard-sm mx-auto inline-block cursor-pointer break-all"
                style={{
                  background: 'var(--game-yellow)',
                  color: 'var(--game-text-primary)',
                  border: '4px solid var(--game-text-primary)',
                  fontFamily: 'Courier New, monospace',
                  transform: 'rotate(0.5deg)',
                  transition: 'all 0.2s ease',
                  maxWidth: '100%',
                  wordBreak: 'break-all'
                }}
                onClick={() => copyInviteUrl(true)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'rotate(0.5deg) scale(1.02)';
                  e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'rotate(0.5deg) scale(1)';
                  e.currentTarget.style.boxShadow = '';
                }}
              >
                {getInviteUrl()}
              </div>
              
              <div className="flex items-center justify-center gap-3 mt-4">
                <button
                  onClick={() => copyInviteUrl(true)}
                  className={`game-sharp px-6 py-3 text-sm font-black uppercase tracking-wider game-shadow-hard-sm game-button-hover ${
                    copiedFromModal ? 'game-block-green' : 'game-paper'
                  }`}
                  style={{
                    border: '4px solid var(--game-text-primary)',
                    color: copiedFromModal ? 'var(--game-text-white)' : 'var(--game-text-primary)',
                  }}
                >
                  {copiedFromModal ? "✓ COPIED!" : "📋 COPY LINK"}
                </button>
                
            <button
              onClick={() => {
                setShowInviteModal(false);
                setCopiedFromModal(false);
              }}
              className="game-sharp game-paper px-6 py-3 text-sm font-black uppercase tracking-wider game-shadow-hard-sm game-button-hover"
              style={{
                border: '4px solid var(--game-text-primary)',
                color: 'var(--game-text-primary)',
              }}
            >
              CLOSE
            </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

