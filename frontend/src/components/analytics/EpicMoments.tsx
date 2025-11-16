import React from "react";
import { PersonalHighlight } from "@/types/analytics";
import { PulseCard } from "./PulseCard";
import { CountUpNumber } from "./CountUpNumber";

interface EpicMomentsProps {
  moments: PersonalHighlight[];
}

export const EpicMoments: React.FC<EpicMomentsProps> = ({ moments }) => {
  const momentColors: Record<
    PersonalHighlight["type"],
    "blue" | "red" | "yellow" | "green" | "purple"
  > = {
    best_answer: "green",
    fastest_response: "blue",
    most_detailed: "purple",
    perfect_accuracy: "green",
    consistency: "yellow",
    improvement: "blue",
  };

  if (moments.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-8">
        <h2 className="game-label-text text-4xl mb-2">
          🏆 YOUR ACHIEVEMENTS 🏆
        </h2>
        <p className="text-lg text-gray-600 font-medium">
          Stand-out moments from your performance
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {moments.map((moment, idx) => (
          <div
            key={idx}
            className="animate-stamp-in"
            style={{ animationDelay: `${idx * 150}ms` }}
          >
            <PulseCard
              color={momentColors[moment.type]}
              highlight
              className="text-center"
            >
              <div className="text-6xl mb-3">{moment.icon}</div>
              <div className="game-label-text text-2xl mb-2">
                {moment.title.toUpperCase()}
              </div>
              <div className="text-sm text-gray-600 mb-3 italic">
                {moment.phase} - Round {moment.roundNumber}
              </div>
              <div className="text-base text-gray-800 mb-4">
                {moment.description}
              </div>
              <div
                className="text-5xl font-black mx-auto"
                style={{ fontFamily: "Impact, sans-serif" }}
              >
                <CountUpNumber
                  end={moment.stat}
                  duration={2000}
                  delay={idx * 150 + 300}
                  className="text-[var(--game-text-primary)]"
                />
              </div>
            </PulseCard>
          </div>
        ))}
      </div>
    </div>
  );
};
