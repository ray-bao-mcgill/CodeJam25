import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LobbyData, Player } from "../hooks/useLobby";

interface ReadyScreenProps {
  lobby: LobbyData;
}

export default function ReadyScreen({ lobby }: ReadyScreenProps) {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(3);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(false);
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 10);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      // Navigate to tutorial when countdown reaches 0
      navigate("/tutorial");
    }
  }, [countdown, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 game-bg">
      <div
        className="w-full max-w-4xl space-y-8 text-center"
        style={{
          transform: isVisible ? "scale(1)" : "scale(0.8)",
          opacity: isVisible ? 1 : 0,
          transition:
            "transform 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55), opacity 0.6s ease-out",
        }}
      >
        <div className="game-paper px-8 py-6 game-shadow-hard-lg game-hand-drawn inline-block">
          <h1 className="game-title text-4xl sm:text-5xl">GAME STARTING</h1>
        </div>

        <div className="game-paper px-8 py-6 game-shadow-hard-lg">
          <div className="text-6xl font-black mb-4">{countdown}</div>
          <div className="game-label-text text-lg">Preparing interview questions...</div>
        </div>

        <div className="game-paper px-6 py-4 game-shadow-hard">
          <div className="game-label-text text-sm mb-3">PLAYERS</div>
          <div className="flex flex-wrap justify-center gap-3">
            {lobby.players.map((player: Player, idx: number) => (
              <div
                key={player.id}
                className="game-sharp px-4 py-2 text-sm font-black uppercase tracking-wider game-shadow-hard-sm"
                style={{
                  border: "3px solid var(--game-text-primary)",
                  background: "var(--game-bg-alt)",
                  color: "var(--game-text-primary)",
                  transform: `rotate(${idx % 2 === 0 ? "-0.5deg" : "0.5deg"})`,
                }}
              >
                {player.name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

