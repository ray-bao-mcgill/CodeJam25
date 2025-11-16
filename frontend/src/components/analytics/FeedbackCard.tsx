import React from "react";
import { PhaseFeedback } from "@/types/analytics";
import { PulseCard } from "./PulseCard";
import { ProgressBar } from "./ProgressBar";

interface FeedbackCardProps {
  feedback: PhaseFeedback;
  delay?: number;
}

export const FeedbackCard: React.FC<FeedbackCardProps> = ({
  feedback,
  delay = 0,
}) => {
  // Dropdown removed: content always visible

  const phaseIcons = {
    behavioural: "💬",
    followup: "🔄",
    theory: "🧠",
    practical: "💻",
    "technical-theory": "⚡",
  };

  const phaseLabels = {
    behavioural: "Behavioural Question",
    followup: "Follow-Up Question",
    theory: "Technical Theory",
    practical: "Coding Challenge",
    "technical-theory": "Technical Theory Round",
  };

  const toneColors = {
    praise: "green" as const,
    constructive: "yellow" as const,
    encouraging: "blue" as const,
  };

  const scorePercentage = (feedback.score / feedback.maxScore) * 100;

  return (
    <div className="animate-stamp-in" style={{ animationDelay: `${delay}ms` }}>
      <PulseCard color={toneColors[feedback.feedback.tone]}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{phaseIcons[feedback.phase]}</span>
            <div>
              <div className="game-label-text text-xl">
                ROUND {feedback.roundNumber}:{" "}
                {phaseLabels[feedback.phase].toUpperCase()}
              </div>
              <div className="text-sm text-gray-600 font-medium mt-1">
                {feedback.feedback.keyInsight}
              </div>
            </div>
          </div>
          {/* Arrow removed (always expanded) */}
        </div>

        {/* Score */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="game-label-text text-lg">YOUR SCORE</span>
            <span
              className="text-3xl font-black"
              style={{ fontFamily: "Impact, sans-serif" }}
            >
              {feedback.score} / {feedback.maxScore}
            </span>
          </div>
          <ProgressBar
            value={scorePercentage}
            color={
              scorePercentage >= 80
                ? "green"
                : scorePercentage >= 60
                ? "yellow"
                : "red"
            }
            delay={delay + 200}
            showPercentage={false}
          />
        </div>

        {/* Metrics (if available) */}
        {feedback.metrics && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            {feedback.metrics.wordCount !== undefined && (
              <div className="text-center p-2 bg-white game-sharp border-2 border-black">
                <div className="text-2xl font-black">
                  {feedback.metrics.wordCount}
                </div>
                <div className="text-xs text-gray-600">Words</div>
              </div>
            )}
            {feedback.metrics.clarity !== undefined && (
              <div className="text-center p-2 bg-white game-sharp border-2 border-black">
                <div className="text-2xl font-black">
                  {feedback.metrics.clarity}%
                </div>
                <div className="text-xs text-gray-600">Clarity</div>
              </div>
            )}
            {feedback.metrics.relevance !== undefined && (
              <div className="text-center p-2 bg-white game-sharp border-2 border-black">
                <div className="text-2xl font-black">
                  {feedback.metrics.relevance}%
                </div>
                <div className="text-xs text-gray-600">Relevance</div>
              </div>
            )}
            {feedback.metrics.depth !== undefined && (
              <div className="text-center p-2 bg-white game-sharp border-2 border-black">
                <div className="text-2xl font-black">
                  {feedback.metrics.depth}%
                </div>
                <div className="text-xs text-gray-600">Depth</div>
              </div>
            )}
            {feedback.metrics.accuracy !== undefined && (
              <div className="text-center p-2 bg-white game-sharp border-2 border-black">
                <div className="text-2xl font-black">
                  {feedback.metrics.accuracy}%
                </div>
                <div className="text-xs text-gray-600">Accuracy</div>
              </div>
            )}
            {feedback.metrics.speed !== undefined && (
              <div className="text-center p-2 bg-white game-sharp border-2 border-black">
                <div className="text-2xl font-black">
                  {feedback.metrics.speed}%
                </div>
                <div className="text-xs text-gray-600">Speed</div>
              </div>
            )}
          </div>
        )}

        {/* Feedback (always visible) */}
        <div className="mt-6 pt-6 border-t-4 border-black space-y-4 animate-fade-in">
          {/* Strengths */}
          <div>
            <div className="game-label-text text-lg mb-2 flex items-center gap-2">
              ✅ STRENGTHS
            </div>
            <ul className="space-y-2">
              {feedback.feedback.strengths.map((strength, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <span className="text-green-600 font-bold">•</span>
                  <span className="text-gray-800">{strength}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Improvements */}
          {feedback.feedback.improvements.length > 0 && (
            <div>
              <div className="game-label-text text-lg mb-2 flex items-center gap-2">
                💡 AREAS TO IMPROVE
              </div>
              <ul className="space-y-2">
                {feedback.feedback.improvements.map((improvement, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <span className="text-yellow-600 font-bold">•</span>
                    <span className="text-gray-800">{improvement}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </PulseCard>
    </div>
  );
};
