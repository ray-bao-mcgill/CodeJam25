import React from "react";
import { LobbyData, Player } from "../hooks/useLobby";

interface ReadyScreenProps {
  lobby: LobbyData;
}

export default function ReadyScreen({ lobby }: ReadyScreenProps) {
  return (
    <div className="container">
      <div className="paper">
        <div className="stack">
          <h2 className="text-center">Ready Screen</h2>
          <p className="text-large text-center">Game Starting...</p>

          <div>
            <p className="text-bold text-center">Players:</p>
            <ul className="player-list">
              {lobby.players.map((player: Player) => (
                <li key={player.id}>{player.name}</li>
              ))}
            </ul>
          </div>

          <p className="text-small text-dimmed text-center">
            Preparing interview questions...
          </p>
        </div>
      </div>
    </div>
  );
}

