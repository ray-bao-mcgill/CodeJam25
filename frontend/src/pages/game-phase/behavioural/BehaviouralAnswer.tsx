import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const ANSWER_SECONDS = 60; // Z seconds for answer phase

const BehaviouralAnswer: React.FC = () => {
  const navigate = useNavigate();
  const [remaining, setRemaining] = useState(ANSWER_SECONDS);
  const [answer, setAnswer] = useState("");
  const [question] = useState(
    // TODO: Replace with shared state/context or backend question
    "Describe a time you overcame a challenge at work."
  );

  useEffect(() => {
    if (remaining <= 0) {
      handleSubmit();
      return;
    }
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  const handleSubmit = () => {
    // TODO: send answer to backend or game state
    navigate("/current-score");
  };

  const handleClear = () => setAnswer("");

  return (
    // Use a fixed viewport height so the outer container actually scrolls
    <div className="game-bg h-[100dvh] w-full p-8 overflow-y-auto overflow-x-hidden">
      <div className="w-full max-w-4xl lg:max-w-5xl mx-auto space-y-8 relative pb-24">
        {/* Header and Timer (no overlap) */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] items-start gap-4">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-2">
              <div className="game-sticky-note px-4 py-2 game-shadow-hard-sm">
                <div className="text-xs font-bold uppercase">Round 1</div>
              </div>
              <div className="game-paper px-6 sm:px-8 md:px-10 py-4 sm:py-5 md:py-6 game-shadow-hard-lg game-hand-drawn inline-block max-w-full">
                <h1 className="game-title text-3xl sm:text-4xl">
                  BEHAVIOURAL ANSWER
                </h1>
              </div>
            </div>
            <div className="game-label-text text-xs sm:text-sm">
              TYPE YOUR ANSWER BELOW
            </div>
          </div>
          <div className="md:justify-self-end text-center">
            <div className="game-label-text text-[10px]">TIME LEFT</div>
            <div
              aria-live="polite"
              className="game-sharp game-block-yellow px-4 py-2 game-shadow-hard-sm"
              style={{
                border: "3px solid var(--game-text-primary)",
                color: "var(--game-text-primary)",
                minWidth: "120px",
              }}
            >
              <span className="text-2xl sm:text-3xl font-black tracking-widest">
                {remaining}s
              </span>
            </div>
          </div>
        </div>

        {/* Top: Smaller Question (top half emphasis) */}
        <div
          className="game-paper px-6 sm:px-8 py-5 game-shadow-hard"
          style={{ border: "4px solid var(--game-text-primary)" }}
        >
          <div className="game-label-text text-xs mb-2">QUESTION</div>
          <p
            style={{
              fontSize: "1.1rem",
              lineHeight: 1.5,
              color: "var(--game-text-primary)",
              fontWeight: 600,
            }}
          >
            {question}
          </p>
        </div>

        {/* Answer Area */}
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="game-label-text text-xs">YOUR ANSWER</div>
            <div className="flex items-center gap-4">
              <button
                className="game-sharp px-4 py-2 text-xs font-black uppercase tracking-widest game-shadow-hard-sm game-button-hover"
                style={{
                  background: "var(--game-paper-bg, #fffbe6)",
                  border: "3px solid var(--game-text-primary)",
                  color: "var(--game-text-primary)",
                }}
                onClick={handleClear}
              >
                Clear
              </button>
            </div>
          </div>

          <textarea
            value={answer}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setAnswer(e.target.value)
            }
            placeholder="Type your answer here..."
            className="game-sharp game-paper w-full block game-shadow-hard min-h-[40vh] md:min-h-[320px]"
            style={{
              border: "6px solid var(--game-text-primary)",
              color: "var(--game-text-primary)",
              padding: "1rem",
              fontSize: "1.125rem",
              lineHeight: 1.6,
              letterSpacing: "0.01em",
              resize: "vertical",
            }}
          />
        </section>

        {/* Actions */}
        <div className="flex items-center justify-center gap-6 flex-wrap pt-2">
          <button
            className="game-sharp game-block-blue px-10 py-4 text-base font-black uppercase tracking-widest game-shadow-hard-lg game-button-hover"
            style={{
              border: "6px solid var(--game-text-primary)",
              color: "var(--game-text-white)",
              minWidth: "220px",
            }}
            onClick={handleSubmit}
          >
            Submit Answer
          </button>
        </div>

        {/* Decorative sticky notes (bottom, non-overlapping) */}
        <div className="flex justify-end">
          <div
            className="game-sticky-note-alt px-4 py-2 game-shadow-hard-sm"
            style={{ transform: "rotate(2deg)" }}
          >
            <div className="text-xs font-bold uppercase">Answer Phase</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BehaviouralAnswer;
