import React from "react";

// Co-located Results types (avoid creating a separate types/ folder)
export type RoundType =
  | "behavioural"
  | "followup"
  | "theory"
  | "practical"
  | "rapid-fire";

export interface Player {
  id: string;
  name: string;
  avatar?: string;
}

export interface ResultItem {
  playerId: string;
  score: number;
  correct?: boolean;
  timeMs?: number;
  rankDelta?: number;
  answerPreview?: string;
}

export interface Totals {
  leaderboard?: Array<{ playerId: string; totalScore: number }>;
}

export interface Timing {
  autoAdvanceSec?: number; // used in lobby mode for synced advance
}

export interface Actions {
  onNext: () => void;
  onReviewQuestion?: () => void;
  onShare?: () => void;
}

export interface Flags {
  isInLobby: boolean;
  showCountdown?: boolean;
}

export interface QuestionMeta {
  id?: string;
  title?: string;
  prompt?: string;
  difficulty?: string;
}

export interface ResultsSummaryProps {
  roundType: RoundType;
  questionMeta?: QuestionMeta;
  players: Player[];
  results: ResultItem[];
  totals?: Totals;
  timing?: Timing;
  actions: Actions;
  flags?: Flags;
}

// Reusable Results summary component matching RapidFireQuiz dramatic VS layout
// - Vertical split with score boxes, centered VS badge
// - Bold shadows, high contrast, Impact-style fonts
// - Auto-advance countdown for lobby mode

const ResultsSummary: React.FC<ResultsSummaryProps> = ({
  roundType,
  questionMeta,
  players,
  results,
  totals,
  timing,
  actions,
  flags,
}) => {
  // Map for quick player lookup
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name || id;

  // For 2-player VS view: split into left (first) and right (second)
  const [leftResult, rightResult] =
    results.length >= 2
      ? [results[0], results[1]]
      : results.length === 1
      ? [results[0], { playerId: "opponent", score: 0 }]
      : [
          { playerId: "you", score: 0 },
          { playerId: "opponent", score: 0 },
        ];

  const leftPlayer = nameOf(leftResult.playerId);
  const rightPlayer = nameOf(rightResult.playerId);
  const leftScore = leftResult.score || 0;
  const rightScore = rightResult.score || 0;

  return (
    <div className="flex items-center justify-center min-h-screen game-bg relative overflow-hidden">
      {/* Continuous Vertical Line - perfectly centered */}
      <div className="absolute top-0 bottom-0 left-1/2 w-2 bg-[var(--game-text-primary)] transform -translate-x-1/2 shadow-[2px_2px_0px_rgba(0,0,0,0.3)]" />

      {/* Title at top - absolute positioning */}
      <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-10">
        <div className="game-label-text text-3xl game-shadow-hard">
          FINAL RESULTS
        </div>
      </div>

      {/* Bottom loading indicator - absolute positioning */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
        <div className="game-label-text text-xl game-shadow-hard-sm animate-pulse">
          NEXT ROUND STARTING SOON...
        </div>
      </div>

      {/* Main VS Content - Perfectly Centered */}
      <div className="relative z-10 flex items-center justify-between w-full max-w-[1600px] px-16">
        {/* Left Score */}
        <div
          className="flex flex-col items-center animate-stamp-in"
          style={{ animationDelay: "0.2s" }}
        >
          <div className="game-label-text text-lg mb-3 game-shadow-hard-sm bg-[var(--game-blue)] px-4 py-1 text-white">
            {leftPlayer.toUpperCase()}
          </div>
          <div className="px-10 py-7 game-sharp game-shadow-hard-lg border-6 border-[var(--game-blue)] bg-gradient-to-br from-blue-100 to-blue-200">
            <div
              className="text-6xl font-black text-[var(--game-blue)] leading-none"
              style={{ fontFamily: "Impact, sans-serif" }}
            >
              {leftScore}
            </div>
          </div>
        </div>

        {/* VS in Circle - perfectly centered on the line */}
        <div
          className="flex items-center justify-center absolute left-1/2 transform -translate-x-1/2 animate-stamp-in-vs"
          style={{ animationDelay: "0.6s" }}
        >
          <div className="rounded-full flex items-center justify-center w-[180px] h-[180px] bg-gradient-to-br from-yellow-300 via-[var(--game-yellow)] to-orange-400 border-[10px] border-[var(--game-text-primary)] shadow-[10px_10px_0px_rgba(0,0,0,0.4)]">
            <div
              className="text-[5rem] font-black text-[var(--game-text-primary)] leading-none drop-shadow-lg"
              style={{ fontFamily: "Impact, sans-serif" }}
            >
              VS
            </div>
          </div>
        </div>

        {/* Right Score */}
        <div
          className="flex flex-col items-center animate-stamp-in"
          style={{ animationDelay: "0.4s" }}
        >
          <div className="game-label-text text-lg mb-3 game-shadow-hard-sm bg-[var(--game-red)] px-4 py-1 text-white">
            {rightPlayer.toUpperCase()}
          </div>
          <div className="px-10 py-7 game-sharp game-shadow-hard-lg border-6 border-[var(--game-red)] bg-gradient-to-br from-red-100 to-red-200">
            <div
              className="text-6xl font-black text-[var(--game-red)] leading-none"
              style={{ fontFamily: "Impact, sans-serif" }}
            >
              {rightScore}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function labelForRound(round: ResultsSummaryProps["roundType"]) {
  switch (round) {
    case "behavioural":
      return "Behavioural";
    case "followup":
      return "Follow-up";
    case "theory":
      return "Technical Theory";
    case "practical":
      return "Technical Practical";
    case "rapid-fire":
      return "Rapid Fire";
    default:
      return String(round);
  }
}

export default ResultsSummary;
