import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

const COUNTDOWN_SECONDS = 60;

const nextRouteForType: Record<string, string> = {
  behavioural: "/behavioural-question",
  technical: "/technical-theory",
};

const RoundStartCounter: React.FC = () => {
  const { type } = useParams();
  const navigate = useNavigate();
  const [remaining, setRemaining] = useState<number>(COUNTDOWN_SECONDS);

  const roundType = (type || "").toLowerCase();
  const isValidType = roundType === "behavioural" || roundType === "technical";

  useEffect(() => {
    if (!isValidType) return;
    if (remaining <= 0) {
      navigate(nextRouteForType[roundType]);
      return;
    }
    const id = window.setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => window.clearTimeout(id);
  }, [remaining, isValidType, navigate, roundType]);

  if (!isValidType) {
    return (
      <div
        className="container game-bg"
        style={{
          color: "var(--game-text-primary)",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className="paper stack" style={{ textAlign: "center" }}>
          <h1 className="text-large" style={{ fontSize: "2rem" }}>
            Unknown round type
          </h1>
          <p className="text-dimmed">Valid types: behavioural, technical.</p>
          <button className="btn" onClick={() => navigate("/landing")}>
            Return Home
          </button>
        </div>
      </div>
    );
  }

  const titleClass =
    roundType === "behavioural" ? "game-text-glow-cyan" : "game-text-glow-red";

  return (
    <div
      className="container game-bg"
      style={{
        color: "var(--game-text-primary)",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div className="paper stack" style={{ textAlign: "center" }}>
        <h1
          className={titleClass}
          style={{ fontSize: "2.25rem", fontWeight: 600 }}
        >
          {roundType.charAt(0).toUpperCase() + roundType.slice(1)} Round
        </h1>
        <p
          className="text-secondary"
          style={{ fontSize: "1rem", marginTop: "0.5rem" }}
        >
          Next phase begins in
        </p>
        <div
          className="countdown"
          style={{ fontSize: "4rem", fontWeight: 700, margin: "1.5rem 0" }}
          aria-live="polite"
        >
          {remaining}
        </div>
        <p className="text-dimmed" style={{ fontSize: "0.9rem" }}>
          Automatically advancing to the question phase.
        </p>
        <div style={{ marginTop: "1.5rem" }}>
          <button
            className="btn btn-outline"
            onClick={() => navigate(nextRouteForType[roundType])}
            disabled={remaining <= 0}
          >
            Skip ({remaining}s)
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoundStartCounter;
