import React, { useState } from "react";
import { RoundHistory } from "@/types/analytics";
import { PulseCard } from "./PulseCard";
import { CountUpNumber } from "./CountUpNumber";

interface RoundJourneyCardProps {
  round: RoundHistory;
  players: Array<{ id: string; name: string }>;
  delay?: number;
}

export const RoundJourneyCard: React.FC<RoundJourneyCardProps> = ({
  round,
  players,
  delay = 0,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getPlayerName = (id: string) =>
    players.find((p) => p.id === id)?.name || id;

  // Determine card color based on highlight type
  const cardColor =
    round.highlight === "comeback"
      ? "yellow"
      : round.highlight === "blowout"
      ? "red"
      : round.highlight === "upset"
      ? "purple"
      : "blue";

  // Sort results by score descending
  const sortedResults = [...round.results].sort((a, b) => b.score - a.score);
  const [winner, loser] = sortedResults;

  const phaseIcons = {
    behavioural: "💬",
    followup: "🔄",
    theory: "🧠",
    practical: "💻",
    "technical-theory": "⚡",
  };

  const phaseLabels = {
    behavioural: "Behavioural",
    followup: "Follow-Up",
    theory: "Tech Theory",
    practical: "Coding Challenge",
    "technical-theory": "Technical Theory",
  };

  return (
    <div className="animate-stamp-in" style={{ animationDelay: `${delay}ms` }}>
      <PulseCard
        color={cardColor}
        highlight={
          round.highlight === "comeback" || round.highlight === "upset"
        }
        onClick={() => setIsExpanded(!isExpanded)}
        className="cursor-pointer hover:scale-102 transition-transform"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{phaseIcons[round.phase]}</span>
            <div>
              <div className="game-label-text text-xl">
                ROUND {round.roundNumber}:{" "}
                {phaseLabels[round.phase].toUpperCase()}
              </div>
              <div className="text-sm text-gray-600 font-medium mt-1">
                {round.title}
              </div>
            </div>
          </div>
          <div className="text-2xl game-label-text">
            {isExpanded ? "▼" : "▶"}
          </div>
        </div>

        {/* Score Summary */}
        <div className="grid grid-cols-2 gap-4 mb-3">
          {sortedResults.map((result, idx) => {
            const isWinner = idx === 0;
            return (
              <div
                key={result.playerId}
                className={`text-center p-3 game-sharp border-4 ${
                  isWinner
                    ? "border-[var(--game-green)] bg-green-50"
                    : "border-gray-400 bg-gray-50"
                }`}
              >
                <div className="game-label-text text-sm mb-1">
                  {getPlayerName(result.playerId).toUpperCase()}
                </div>
                <div
                  className="text-3xl font-black"
                  style={{ fontFamily: "Impact, sans-serif" }}
                >
                  <CountUpNumber
                    end={result.score}
                    duration={1500}
                    delay={delay + 200}
                  />
                </div>
                {result.scoreDelta !== 0 && (
                  <div
                    className={`text-sm font-bold mt-1 ${
                      result.scoreDelta > 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {result.scoreDelta > 0 ? "+" : ""}
                    {result.scoreDelta}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Commentary */}
        {round.commentary && (
          <div className="text-center game-label-text text-sm text-gray-700 italic mb-2">
            "{round.commentary}"
          </div>
        )}

        {/* Badges */}
        <div className="flex gap-2 justify-center flex-wrap">
          {round.results.map((result) => (
            <React.Fragment key={result.playerId}>
              {result.wasPerfect && (
                <span className="px-3 py-1 game-sharp border-2 border-yellow-500 bg-yellow-100 text-xs font-black">
                  💯 PERFECT
                </span>
              )}
              {result.wasComeback && (
                <span className="px-3 py-1 game-sharp border-2 border-orange-500 bg-orange-100 text-xs font-black">
                  🔥 COMEBACK
                </span>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="mt-6 pt-6 border-t-4 border-black space-y-4 animate-fade-in">
            {round.results.map((result) => (
              <div
                key={result.playerId}
                className="bg-white p-4 game-sharp border-4 border-black"
              >
                <div className="game-label-text text-lg mb-3">
                  {getPlayerName(result.playerId).toUpperCase()}'S BREAKDOWN
                </div>

                {result.breakdown && (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {/* Rapid Fire Stats */}
                    {result.breakdown.correctAnswers !== undefined && (
                      <>
                        <div>
                          <span className="font-semibold">
                            Correct Answers:
                          </span>{" "}
                          {result.breakdown.correctAnswers}
                        </div>
                        {result.breakdown.timeBonus !== undefined && (
                          <div>
                            <span className="font-semibold">Time Bonus:</span> +
                            {result.breakdown.timeBonus}
                          </div>
                        )}
                        {result.breakdown.livesBonus !== undefined && (
                          <div>
                            <span className="font-semibold">Lives Bonus:</span>{" "}
                            +{result.breakdown.livesBonus}
                          </div>
                        )}
                      </>
                    )}

                    {/* Behavioural Stats */}
                    {result.breakdown.wordCount !== undefined && (
                      <>
                        <div>
                          <span className="font-semibold">Word Count:</span>{" "}
                          {result.breakdown.wordCount}
                        </div>
                        {result.breakdown.aiScore !== undefined && (
                          <div>
                            <span className="font-semibold">AI Score:</span>{" "}
                            {result.breakdown.aiScore}/100
                          </div>
                        )}
                      </>
                    )}

                    {/* Technical Stats */}
                    {result.breakdown.testsPassed !== undefined && (
                      <>
                        <div>
                          <span className="font-semibold">Tests Passed:</span>{" "}
                          {result.breakdown.testsPassed}
                        </div>
                        {result.breakdown.codeQuality !== undefined && (
                          <div>
                            <span className="font-semibold">Code Quality:</span>{" "}
                            {result.breakdown.codeQuality}%
                          </div>
                        )}
                      </>
                    )}

                    {result.responseTime !== undefined && (
                      <div>
                        <span className="font-semibold">Response Time:</span>{" "}
                        {result.responseTime}s
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </PulseCard>
    </div>
  );
};
