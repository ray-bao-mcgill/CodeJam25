import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLobby } from "@/hooks/useLobby";
import { GameHistory, createMockGameHistory } from "@/types/analytics";
import { CountUpNumber } from "@/components/analytics/CountUpNumber";
import { PulseCard } from "@/components/analytics/PulseCard";

const Analytics: React.FC = () => {
  const navigate = useNavigate();
  const { lobbyId, playerId } = useLobby();
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
    const fetchPlayerScore = async () => {
      if (!lobbyId || !playerId) {
        // Fallback to mock data if no lobby/player
        setTimeout(() => {
          setGameHistory(createMockGameHistory());
          setIsLoading(false);
        }, 500);
        return;
      }

      try {
        const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://127.0.0.1:8000' : window.location.origin);
        const response = await fetch(`${API_URL}/api/lobby/${lobbyId}/match-rankings`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.rankings && data.rankings.length > 0) {
            // Find current player's ranking
            const playerRanking = data.rankings.find((r: any) => r.player_id === playerId);
            
            if (playerRanking) {
              // Create game history with actual player score
              const mockHistory = createMockGameHistory();
              mockHistory.player.totalScore = playerRanking.score;
              mockHistory.player.finalResult = playerRanking.rank === 1 ? "HIRED" : "FIRED";
              mockHistory.player.id = playerId;
              mockHistory.player.name = playerRanking.name || "You";
              
              // Update overall rating based on actual score
              const getRatingFromScore = (score: number): { letter: string; score: number } => {
                if (score >= 5400) return { letter: "A+", score };
                if (score >= 4800) return { letter: "A", score };
                if (score >= 4200) return { letter: "B+", score };
                if (score >= 3600) return { letter: "B", score };
                if (score >= 3000) return { letter: "C+", score };
                if (score >= 2400) return { letter: "C", score };
                if (score >= 1800) return { letter: "D", score };
                return { letter: "F", score };
              };
              
              const rating = getRatingFromScore(playerRanking.score);
              mockHistory.overallRating.letter = rating.letter as any;
              mockHistory.overallRating.score = Math.round((playerRanking.score / 6000) * 100);
              
              setGameHistory(mockHistory);
              setIsLoading(false);
              return;
            }
          }
        }
        
        // Fallback to mock data if API fails or no ranking found
        console.warn('[ANALYTICS] Could not fetch player score, using mock data');
        setGameHistory(createMockGameHistory());
        setIsLoading(false);
      } catch (error) {
        console.error('[ANALYTICS] Error fetching player score:', error);
        // Fallback to mock data on error
        setGameHistory(createMockGameHistory());
        setIsLoading(false);
      }
    };

    fetchPlayerScore();
  }, [lobbyId, playerId]);

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

  // Calculate rating from 0-6000 score to letter grade
  const getRatingFromScore = (score: number): { letter: string; score: number } => {
    // Map score from 0-6000 to letter grades
    if (score >= 5400) return { letter: "A+", score }; // 90% of 6000
    if (score >= 4800) return { letter: "A", score };  // 80% of 6000
    if (score >= 4200) return { letter: "B+", score }; // 70% of 6000
    if (score >= 3600) return { letter: "B", score };  // 60% of 6000
    if (score >= 3000) return { letter: "C+", score }; // 50% of 6000
    if (score >= 2400) return { letter: "C", score };  // 40% of 6000
    if (score >= 1800) return { letter: "D", score };  // 30% of 6000
    return { letter: "F", score };
  };

  const calculatedRating = getRatingFromScore(player.totalScore);

  return (
    <div className="min-h-screen game-bg">
      {/* Hero Section - Score Summary */}
      <div className="min-h-screen flex items-center justify-center p-8 game-bg">
        <div className="text-center max-w-5xl">
          <div 
            className="game-shadow-hard-lg inline-block mb-12"
            style={{
              background: 'var(--game-yellow)',
              padding: '1.2rem 2.5rem',
              transform: 'rotate(-2deg)',
              border: '3px solid var(--game-text-primary)',
            }}
          >
            <h1 
              className="game-title text-6xl sm:text-7xl md:text-8xl lg:text-9xl xl:text-[10rem]" 
              style={{ 
                color: 'var(--game-text-primary)',
                fontSize: 'clamp(1.8rem, 4.5vw, 5.5rem)'
              }}
            >
              YOUR PERFORMANCE RECAP
            </h1>
          </div>

          <div className="mb-16">
            <div
              className="text-[10rem] sm:text-[14rem] md:text-[16rem] font-black mb-6"
              style={{ 
                fontFamily: "Impact, sans-serif",
                fontSize: 'clamp(4.5rem, 9vw, 9rem)'
              }}
            >
              <CountUpNumber
                end={player.totalScore}
                duration={3000}
                className="text-[#2196f3]"
              />
            </div>
            <div 
              className="text-6xl sm:text-7xl md:text-8xl text-gray-600 font-medium mb-4"
              style={{ fontSize: 'clamp(1.5rem, 3.75vw, 3rem)' }}
            >
              TOTAL POINTS
            </div>
            <div 
              className="text-5xl sm:text-6xl text-gray-600 font-bold"
              style={{ fontSize: 'clamp(1.35rem, 3vw, 2.25rem)' }}
            >
              Rating: {calculatedRating.letter} ({player.totalScore} / 6000)
            </div>
          </div>

          <div
            className="text-4xl sm:text-5xl md:text-6xl animate-pulse cursor-pointer font-medium"
            style={{ fontSize: 'clamp(1rem, 2.5vw, 2rem)', color: '#2196f3' }}
            onClick={() => {
              window.scrollTo({ top: window.innerHeight, behavior: "smooth" });
            }}
          >
            ▼ Last minute cram! ▼
          </div>
        </div>
      </div>

      {/* Section 2: Last Minute Cram Advice */}
      <div className="py-16 px-8 game-bg">
        <div className="max-w-4xl mx-auto">
          <h2 className="game-label-text text-4xl text-center mb-12">
            LAST MINUTE CRAM
          </h2>

          <div className="space-y-8">
            {/* Behavioural Round Advice */}
            <div className="animate-stamp-in" style={{ animationDelay: '0ms' }}>
              <PulseCard color="blue">
                <div className="bg-black text-white rounded-xl border-4 border-black font-extrabold px-6 py-2 text-lg sm:text-xl md:text-2xl -mx-6 mt-[-1.5rem] mb-6 w-[calc(100%+3rem)]">
                  ⭐ Behavioural:STAR METHOD
                </div>
                <div className="space-y-4 text-gray-800">
                  <p className="text-base">The goal isn't to sound dramatic. It's to show you think clearly under pressure.</p>
                  <p className="text-base">Pick moments with stakes: deadlines, conflicts, mistakes, constraints, ambiguity.</p>
                  <ul className="space-y-1 text-sm ml-2">
                    <li><strong>Situation:</strong> 1 sentence. No novels.</li>
                    <li><strong>Task:</strong> Your responsibility, not "the team's".</li>
                    <li><strong>Action:</strong> List 2–3 specific things you did (verbs only).</li>
                    <li><strong>Result:</strong> Use numbers, scale, or clear direction of impact ("cut wait time", "unblocked demo").</li>
                    <li><strong>Reflection:</strong> One line showing growth. Signals seniority instantly.</li>
                  </ul>
                  <div className="mt-4 p-3 bg-gray-100 rounded border-2 border-gray-300">
                    <p className="text-xs font-bold mb-1">Mini formula:</p>
                    <p className="text-xs">S (1 line) → T (your goal) → A (your execution) → R (impact) → L (what you'd do next time)</p>
                  </div>
                </div>
              </PulseCard>
            </div>

            {/* Theory Round Advice */}
            <div className="animate-stamp-in" style={{ animationDelay: '150ms' }}>
              <PulseCard color="blue">
                <div className="bg-black text-white rounded-xl border-4 border-black font-extrabold px-6 py-2 text-lg sm:text-xl md:text-2xl -mx-6 mt-[-1.5rem] mb-6 w-[calc(100%+3rem)]">
                  ⚡ Theory: Learn Fundamentals
                </div>
                <div className="space-y-4 text-gray-800">
                  <p className="text-base">This round tests what interviewers expect you to know without Googling. The fastest way to improve is to strengthen pattern recognition around core principles.</p>
                  <ul className="space-y-2 text-sm ml-2">
                    <li><strong>Don't memorize, cluster concepts:</strong> Group topics ("HTTP stuff", "SQL joins", "DSA") for faster recall.</li>
                    <li><strong>Learn the "why" not just the definition:</strong> You know why hash map gives O(1) average access and when it fails.</li>
                    <li><strong>Create quick mental contrasts:</strong> array vs list · GET vs POST · ACID vs BASE · recursion vs iteration </li>
                    <li>In interviews (and the game), wrong answers usually share a flaw, look for that!</li>
                    <li><strong>Maximize improvement by minute spent by focusing on high-frequency fundamentals</strong>. </li>
                  </ul>
                </div>
              </PulseCard>
            </div>

            {/* Practical Round Advice */}
            <div className="animate-stamp-in" style={{ animationDelay: '300ms' }}>
              <PulseCard color="blue">
                <div className="bg-black text-white rounded-xl border-4 border-black font-extrabold px-6 py-2 text-lg sm:text-xl md:text-2xl -mx-6 mt-[-1.5rem] mb-6 w-[calc(100%+3rem)]">
                  🛠️ Practical: Coding & Written Responses
                </div>
                <div className="space-y-6 text-gray-800">
                  <div>
                    <ul className="space-y-2 text-sm ml-2">
                      <li className="text-center"><strong>Code answers </strong></li>
                      <li><strong>Completeness:</strong> Did you attempt all parts? Even partial score if you show direction and intent.</li>
                      <li><strong>Correctness:</strong> Does your code work for the core logic without error, missing edge cases, or contradictions.</li>
                      <li><strong>Efficiency:</strong> Is your approach reasonable for input size? Clean structure = higher score.</li>
                    </ul>
                    <div className="mt-3 p-3 bg-gray-100 rounded border-2 border-gray-300">
                      <p className="text-xs font-bold mb-1">Real tip:</p>
                      <p className="text-xs">If you get stuck, outline the function signatures and the steps so the grader sees your thinking instead of a blank screen.</p>
                    </div>
                  </div>
                  <div className="border-t-4 border-black pt-4">
                    <ul className="space-y-2 text-sm ml-2">
                      <li className="text-center"><strong>Text answers </strong></li>
                      <li><strong>Completeness:</strong> Did you address every part of the question?</li>
                      <li><strong>Clarity:</strong> Short sentences. Clear sequence. No rambling. A structure ("first…, then…, finally…") helps.</li>
                      <li><strong>Correctness:</strong> Actually answer the question, no contradictions or invented assumptions.</li>
                    </ul>
                  </div>
                </div>
              </PulseCard>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="py-16 px-8 game-bg">
        <div className="max-w-4xl mx-auto">
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
