import React from "react";
import { useNavigate } from "react-router-dom";

// LandingV1 (Adjusted): Closer to original layout, retains yellow hero note but
// applies thick black border, removes emojis, uses green/orange palette from quickfire.

const LandingV1: React.FC = () => {
  const navigate = useNavigate();

  // Animation styles
  const heroAnimationStyle = {
    animation: "float 3s ease-in-out infinite, sway 6s ease-in-out infinite",
  };

  const shadowPulseStyle = {
    animation: "shadowPulse 3s ease-in-out infinite",
  };

  const letterStaggerStyle = (index: number) => ({
    display: "inline-block",
    animation: `fadeIn 0.6s ease-out ${index * 0.1}s both`,
  });

  // Light pulse styles for HIRE (indices 0-3) and FIRE (indices 5-8)
  const lightPulseStyle = (index: number) => {
    // HIRE letters: H=0, I=1, R=2, E=3
    // FIRE letters: F=5, I=6, R=7, E=8
    const delay = index * 0.08; // 0.08s between each letter for smooth wave
    return {
      display: "inline-block",
      position: "relative" as const,
      animation: `fadeIn 0.6s ease-out ${
        index * 0.1
      }s both, lightSweep 8s ease-in-out ${5 + delay}s infinite`,
    };
  };

  return (
    <>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        
        @keyframes sway {
          0%, 100% { transform: rotate(-3deg); }
          50% { transform: rotate(-1deg); }
        }
        
        @keyframes shadowPulse {
          0%, 100% { box-shadow: 12px 12px 0 rgba(0, 0, 0, 0.2), 10px 10px 0 rgba(0, 0, 0, 0.15); }
          50% { box-shadow: 15px 15px 0 rgba(0, 0, 0, 0.2), 12px 12px 0 rgba(0, 0, 0, 0.15); }
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes lightSweep {
          0% {
            filter: brightness(1);
            text-shadow: none;
          }
          5% {
            filter: brightness(1.4);
            text-shadow: 0 0 15px rgba(255, 255, 255, 0.5), 0 0 25px rgba(255, 255, 255, 0.3);
          }
          10% {
            filter: brightness(1.4);
            text-shadow: 0 0 15px rgba(255, 255, 255, 0.5), 0 0 25px rgba(255, 255, 255, 0.3);
          }
          15% {
            filter: brightness(1);
            text-shadow: none;
          }
          100% {
            filter: brightness(1);
            text-shadow: none;
          }
        }
        
        @keyframes buttonGlow {
          0%, 100% { box-shadow: 8px 8px 0 rgba(0, 0, 0, 0.2), 6px 6px 0 rgba(0, 0, 0, 0.15); }
          50% { box-shadow: 8px 8px 0 #7744ff; }
        }
        
        .tutorial-button-animated:hover {
          animation: buttonGlow 0.6s ease-in-out infinite;
        }
      `}</style>
      <div className="flex flex-col items-center justify-center min-h-screen p-8 game-bg relative">
        {/* Tutorial button - top left - giant ? square */}
        <button
          className="game-sharp font-black game-button-hover tutorial-button-animated absolute top-8 left-8 z-10 flex items-center justify-center"
          style={{
            background: "#9966ff",
            border: "6px solid #000",
            color: "#fff",
            boxShadow:
              "8px 8px 0 rgba(0, 0, 0, 0.2), 6px 6px 0 rgba(0, 0, 0, 0.15)",
            width: "80px",
            height: "80px",
            fontSize: "3rem",
          }}
          onClick={() => navigate("/tutorial")}
          aria-label="How to Play Tutorial"
        >
          ?
        </button>

        <div className="text-center space-y-16 relative">
          {/* Hero sticky note with dark border */}
          <div className="relative inline-block" style={heroAnimationStyle}>
            <div
              className="px-20 py-16 game-shadow-hard-lg"
              style={{
                background: "#ffe63b",
                border: "10px solid #000",
                ...shadowPulseStyle,
              }}
            >
              <h1 className="game-title text-7xl sm:text-8xl font-black leading-[1.05] tracking-tight">
                <span style={{ display: "inline-block" }}>
                  <span style={{ color: "#138a36", ...lightPulseStyle(0) }}>
                    H
                  </span>
                  <span style={{ color: "#138a36", ...lightPulseStyle(1) }}>
                    I
                  </span>
                  <span style={{ color: "#138a36", ...lightPulseStyle(2) }}>
                    R
                  </span>
                  <span style={{ color: "#138a36", ...lightPulseStyle(3) }}>
                    E
                  </span>
                </span>
                <span
                  className="mx-4"
                  style={{
                    fontSize: "0.5em",
                    color: "#000",
                    ...letterStaggerStyle(4),
                  }}
                >
                  OR
                </span>
                <span style={{ display: "inline-block" }}>
                  <span
                    style={{ color: "var(--game-red)", ...lightPulseStyle(5) }}
                  >
                    F
                  </span>
                  <span
                    style={{ color: "var(--game-red)", ...lightPulseStyle(6) }}
                  >
                    I
                  </span>
                  <span
                    style={{ color: "var(--game-red)", ...lightPulseStyle(7) }}
                  >
                    R
                  </span>
                  <span
                    style={{ color: "var(--game-red)", ...lightPulseStyle(8) }}
                  >
                    E
                  </span>
                </span>
              </h1>
            </div>
            {/* Pencil SVG - commented out for now */}
            {/* <div className="absolute -top-6 -right-10" aria-hidden="true">
            <svg width="80" height="80" viewBox="0 0 120 120" fill="none">
              <rect
                x="20"
                y="10"
                width="80"
                height="22"
                rx="3"
                fill="#FFD700"
                stroke="#000"
                strokeWidth="4"
              />
              <rect
                x="20"
                y="32"
                width="80"
                height="12"
                fill="#C0C0C0"
                stroke="#000"
                strokeWidth="4"
              />
              <rect
                x="20"
                y="44"
                width="80"
                height="22"
                rx="3"
                fill="#FF6B9D"
                stroke="#000"
                strokeWidth="4"
              />
              <path
                d="M 60 66 L 40 95 L 80 95 Z"
                fill="#F4A460"
                stroke="#000"
                strokeWidth="4"
              />
              <path
                d="M 60 90 L 52 95 L 68 95 Z"
                fill="#2F4F4F"
                stroke="#000"
                strokeWidth="3"
              />
            </svg>
          </div> */}
          </div>

          {/* Subtitle - bigger and more prominent */}
          <div className="flex justify-center">
            <div
              className="px-12 py-5 game-shadow-hard-lg game-label-text text-xl sm:text-2xl"
              style={{
                background: "#000",
                border: "8px solid #000",
                color: "#fff",
                letterSpacing: "0.2em",
                fontWeight: "900",
              }}
            >
              INTERVIEW BATTLE
            </div>
          </div>

          {/* CTA - Start Game button only (blue) */}
          <div className="pt-4 flex flex-col items-center gap-8">
            <button
              className="game-sharp px-16 py-7 text-2xl font-black uppercase tracking-widest game-button-hover game-block-blue"
              style={{
                border: "8px solid #000",
                color: "#fff",
                boxShadow:
                  "10px 10px 0 rgba(0, 0, 0, 0.2), 8px 8px 0 rgba(0, 0, 0, 0.15)",
              }}
              onClick={() => navigate("/lobby-creation")}
            >
              Start Game
            </button>
          </div>

          {/* Briefcase SVG - commented out for now */}
          {/* <div className="absolute bottom-24 right-14" aria-hidden="true">
          <svg width="120" height="120" viewBox="0 0 140 140" fill="none">
            <rect
              x="15"
              y="45"
              width="110"
              height="70"
              rx="8"
              fill="#8B4513"
              stroke="#000"
              strokeWidth="5"
            />
            <rect
              x="15"
              y="40"
              width="110"
              height="12"
              rx="4"
              fill="#A0522D"
              stroke="#000"
              strokeWidth="5"
            />
            <rect
              x="50"
              y="25"
              width="40"
              height="18"
              rx="6"
              fill="#654321"
              stroke="#000"
              strokeWidth="4"
            />
            <path
              d="M 55 25 Q 70 10 85 25"
              fill="none"
              stroke="#000"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <rect
              x="65"
              y="70"
              width="10"
              height="15"
              rx="2"
              fill="#FFD700"
              stroke="#000"
              strokeWidth="3"
            />
            <circle cx="70" cy="75" r="3" fill="#000" />
            <circle cx="25" cy="55" r="4" fill="#FFD700" stroke="#000" strokeWidth="2" />
            <circle cx="115" cy="55" r="4" fill="#FFD700" stroke="#000" strokeWidth="2" />
            <circle cx="25" cy="105" r="4" fill="#FFD700" stroke="#000" strokeWidth="2" />
            <circle cx="115" cy="105" r="4" fill="#FFD700" stroke="#000" strokeWidth="2" />
          </svg>
        </div> */}
        </div>
      </div>
    </>
  );
};

export default LandingV1;
