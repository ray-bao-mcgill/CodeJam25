import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const QUESTION_DISPLAY_SECONDS = 30; // Y seconds

const BehaviouralQuestion: React.FC = () => {
  const navigate = useNavigate();
  const [remaining, setRemaining] = useState(QUESTION_DISPLAY_SECONDS);
  const [question, setQuestion] = useState<string>("Loading question...");

  useEffect(() => {
    // TODO: Replace with backend fetch when API is ready
    setQuestion("Describe a time you overcame a challenge at work.");
  }, []);

  useEffect(() => {
    if (remaining <= 0) {
      navigate("/behavioural-answer");
      return;
    }
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining, navigate]);

  const handleSkip = () => {
    navigate("/behavioural-answer");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 game-bg">
      <div className="w-full max-w-3xl space-y-10 relative">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="game-paper px-10 py-6 game-shadow-hard-lg game-hand-drawn inline-block">
            <h1 className="game-title text-4xl">BEHAVIOURAL QUESTION</h1>
          </div>
          <div className="game-label-text text-sm">
            READ CAREFULLY — YOU'LL ANSWER NEXT
          </div>
        </div>

        {/* Question Card */}
        <div
          className="game-paper px-10 py-8 game-shadow-hard-lg game-hand-drawn"
          style={{ border: "6px solid var(--game-text-primary)" }}
        >
          <h2
            className="font-extrabold"
            style={{
              fontSize: "clamp(2rem, 4vw, 3rem)",
              lineHeight: 1.2,
              color: "var(--game-text-primary)",
              wordBreak: "break-word",
              letterSpacing: "0.02em",
            }}
          >
            <span>{question}</span>
          </h2>
        </div>

        {/* Timer + Actions */}
        <div className="flex items-center justify-center gap-6 flex-wrap">
          <div className="text-center">
            <div className="game-label-text text-xs">TIME LEFT</div>
            <div
              aria-live="polite"
              className="game-sharp game-block-yellow px-6 py-3 game-shadow-hard-sm"
              style={{
                border: "3px solid var(--game-text-primary)",
                color: "var(--game-text-primary)",
                minWidth: "140px",
              }}
            >
              <span className="text-4xl font-black tracking-widest">
                {remaining}s
              </span>
            </div>
          </div>

          <button
            className="game-sharp game-block-blue px-8 py-4 text-base font-black uppercase tracking-widest game-shadow-hard-lg game-button-hover"
            style={{
              border: "6px solid var(--game-text-primary)",
              color: "var(--game-text-white)",
            }}
            onClick={handleSkip}
          >
            Skip
          </button>
        </div>

        {/* Decorative sticky notes */}
        <div
          className="absolute -top-4 left-0 game-sticky-note px-4 py-2 game-shadow-hard-sm"
          style={{ transform: "rotate(-3deg)" }}
        >
          <div className="text-xs font-bold uppercase">Round 1</div>
        </div>
        <div
          className="absolute -bottom-4 right-0 game-sticky-note-alt px-4 py-2 game-shadow-hard-sm"
          style={{ transform: "rotate(2deg)" }}
        >
          <div className="text-xs font-bold uppercase">Behavioural</div>
        </div>
      </div>
    </div>
  );
};

export default BehaviouralQuestion;
