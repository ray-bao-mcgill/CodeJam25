import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LobbyData, Player } from "../hooks/useLobby";

interface ReadyScreenProps {
  lobby: LobbyData;
}

export default function ReadyScreen({ lobby }: ReadyScreenProps) {
  const navigate = useNavigate();

  // Navigate to tutorial after a brief delay when game starts
  // All players should see this screen, then move to tutorial together
  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/tutorial', { replace: true });
    }, 2000); // 2 second delay to show ready screen

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 game-bg">
      <div className="w-full max-w-4xl space-y-8">
        {/* Title */}
        <div className="text-center">
          <div className="game-paper px-8 py-4 game-shadow-hard-lg game-hand-drawn inline-block">
            <h1 className="game-title text-3xl sm:text-4xl">READY SCREEN</h1>
          </div>
        </div>

        {/* Game Starting Message */}
        <div className="game-paper px-8 py-6 game-shadow-hard-lg text-center">
          <p className="text-xl font-black uppercase tracking-widest" style={{ color: "var(--game-text-primary)" }}>
            Game Starting...
          </p>
        </div>

        {/* Players List */}
        <div className="game-paper px-8 py-6 game-shadow-hard-lg">
          <div className="game-label-text text-sm mb-4 text-center">PLAYERS</div>
          <div className="space-y-3">
            {lobby.players.map((player: Player) => (
              <div
                key={player.id}
                className="game-sharp px-6 py-4 game-shadow-hard-sm text-center"
                style={{
                  border: "4px solid var(--game-text-primary)",
                  background: "var(--game-paper-bg, #fffbe6)",
                  color: "var(--game-text-primary)",
                }}
              >
                <div className="text-lg font-black">{player.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Loading Message */}
        <div className="text-center">
          <div className="game-label-text text-sm opacity-70">
            Preparing interview questions...
          </div>
        </div>
      </div>
    </div>
  );
}

