import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLobby } from "@/hooks/useLobby";
import { GameHistory, createMockGameHistory } from "@/types/analytics";
import { CountUpNumber } from "@/components/analytics/CountUpNumber";
import { ProgressBar } from "@/components/analytics/ProgressBar";
import { PulseCard } from "@/components/analytics/PulseCard";
import { SlideInSection } from "@/components/analytics/SlideInSection";
import { FeedbackCard } from "@/components/analytics/FeedbackCard";

const Analytics: React.FC = () => {
  const navigate = useNavigate();
  const { lobbyId } = useLobby();
  const [gameHistory, setGameHistory] = useState<GameHistory | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Enable scrolling for analytics page
  useEffect(() => {
    document.documentElement.style.overflow = "auto";
    document.body.style.overflow = "auto";
    return () => {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    };
  }, []);

  // Fetch game history from backend
  useEffect(() => {
    // TODO: Replace with actual API call when backend is ready
    // fetch(`http://localhost:8000/api/lobby/${lobbyId}/history`)
    //   .then(res => res.json())
    //   .then(data => {
    //     setGameHistory(data);
    //     setIsLoading(false);
    //   });

    // For now, use mock data
    setTimeout(() => {
      setGameHistory(createMockGameHistory());
      setIsLoading(false);
    }, 500);
  }, [lobbyId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen game-bg">
        <div className="text-center">
          <div className="game-label-text text-4xl mb-4 animate-pulse">
            CALCULATING YOUR RESULTS...
          </div>
          <div className="text-xl text-gray-600">
            Analyzing your epic performance 🔥
          </div>
        </div>
      </div>
    );
  }

  if (!gameHistory) {
    return (
      <div className="flex items-center justify-center min-h-screen game-bg">
        <div className="text-center">
          <div className="game-label-text text-3xl mb-4">
            No game data found
          </div>
          <button
            onClick={() => navigate("/landing")}
            className="game-sharp game-button-hover border-6 border-black px-8 py-4 bg-[var(--game-blue)] text-white font-black text-lg uppercase tracking-wide game-shadow-hard-lg"
          >
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  const player = gameHistory.player;
  const rating = gameHistory.overallRating;

  return (
    <div className="min-h-screen game-bg">
      {/* Hero Section - Score Summary */}
      <div className="min-h-screen flex items-center justify-center p-8 game-bg">
        <div className="text-center max-w-4xl">
          <h1 className="game-label-text text-6xl mb-8">
            YOUR PERFORMANCE RECAP
          </h1>

          <div className="mb-12">
            <div
              className="text-8xl font-black mb-4"
              style={{ fontFamily: "Impact, sans-serif" }}
            >
              <CountUpNumber
                end={player.totalScore}
                duration={3000}
                className="text-[var(--game-blue)]"
              />
            </div>
            <div className="text-3xl text-gray-600 font-medium mb-2">
              TOTAL POINTS
            </div>
            <div className="text-2xl text-gray-600">
              Rating: {rating.letter} ({rating.score}/100)
            </div>
          </div>

          <div
            className="text-xl text-gray-600 animate-pulse cursor-pointer"
            onClick={() => {
              window.scrollTo({ top: window.innerHeight, behavior: "smooth" });
            }}
          >
            ▼ View detailed breakdown ▼
          </div>
        </div>
      </div>

      {/* Section 2: Round-by-Round with AI Feedback */}
      <div className="py-16 px-8 game-bg">
        <div className="max-w-4xl mx-auto">
          <h2 className="game-label-text text-4xl text-center mb-12">
            ROUND BREAKDOWN
          </h2>

          <div className="space-y-8">
            {gameHistory.rounds.map((round, idx) => {
              const feedback = gameHistory.feedback.find(
                (f) => f.roundNumber === round.roundNumber
              );

              return (
                <div
                  key={idx}
                  className="animate-stamp-in space-y-4"
                  style={{ animationDelay: `${idx * 150}ms` }}
                >
                  {/* Round Score Card */}
                  <PulseCard color="blue">
                    <div className="game-label-text text-2xl mb-2">
                      ROUND {round.roundNumber}: {round.phase.toUpperCase()}
                    </div>
                    {round.question && (
                      <div className="text-base text-gray-700 mb-3 p-3 bg-gray-100 rounded border-2 border-gray-300">
                        <strong>Question:</strong> {round.question}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div>
                        <span
                          className="text-4xl font-black"
                          style={{ fontFamily: "Impact, sans-serif" }}
                        >
                          <CountUpNumber
                            end={round.results[0]?.score || 0}
                            delay={idx * 150 + 200}
                          />
                        </span>
                        <span className="text-xl text-gray-600 ml-2">
                          points
                        </span>
                      </div>
                      {round.results[0]?.breakdown && (
                        <div className="text-sm text-gray-600">
                          {round.results[0].breakdown.wordCount && (
                            <div>
                              Words: {round.results[0].breakdown.wordCount}
                            </div>
                          )}
                          {round.results[0].breakdown.correctAnswers !==
                            undefined && (
                            <div>
                              Correct:{" "}
                              {round.results[0].breakdown.correctAnswers}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </PulseCard>

                  {/* AI Feedback Card - Separate and prominent */}
                  {feedback && (
                    <FeedbackCard feedback={feedback} delay={idx * 150 + 400} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Section 3: Skill Assessment */}
      <div className="py-16 px-8 game-bg">
        <div className="max-w-4xl mx-auto">
          <h2 className="game-label-text text-4xl text-center mb-12">
            SKILL ASSESSMENT
          </h2>

          {/* Skill Categories */}
          <div className="space-y-4 mb-12">
            {gameHistory.skillAssessment.categories.map((category, idx) => (
              <div key={idx}>
                <PulseCard color="blue">
                  <div className="flex items-center justify-between mb-3">
                    <div className="game-label-text text-lg">
                      {category.name.toUpperCase()}
                    </div>
                    <div
                      className="text-3xl font-black"
                      style={{ fontFamily: "Impact, sans-serif" }}
                    >
                      <CountUpNumber end={category.score} duration={2000} />
                      <span className="text-xl text-gray-600">/100</span>
                    </div>
                  </div>
                  <ProgressBar value={category.score} color="blue" label="" />
                  <div className="text-sm text-gray-700 mt-2">
                    {category.description}
                  </div>
                </PulseCard>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-6 justify-center flex-wrap">
            <button
              onClick={() => navigate("/lobby-creation")}
              className="game-sharp game-button-hover border-6 border-black px-10 py-5 bg-[var(--game-blue)] text-white font-black text-xl uppercase tracking-wide game-shadow-hard-lg"
            >
              🔄 Play Again
            </button>
            <button
              onClick={() => navigate("/landing")}
              className="game-sharp game-button-hover border-6 border-black px-10 py-5 bg-[var(--game-yellow)] text-black font-black text-xl uppercase tracking-wide game-shadow-hard-lg"
            >
              🏠 Main Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
