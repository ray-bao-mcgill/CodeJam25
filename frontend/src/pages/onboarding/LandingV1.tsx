import React from "react";
import { useNavigate } from "react-router-dom";

const LandingV1: React.FC = () => {
  const navigate = useNavigate();

  return (
    <>
      <style>{`
        @keyframes fire-flicker {
          0%, 100% {
            text-shadow: 
              0 0 15px #ff4500,
              0 0 30px #ff4500,
              0 0 45px #ff6347,
              0 0 60px #ff6347,
              0 0 75px #ff8c00,
              0 0 90px #ff8c00;
            filter: brightness(1.1);
          }
          25% {
            text-shadow: 
              0 0 25px #ff4500,
              0 0 40px #ff4500,
              0 0 55px #ff6347,
              0 0 70px #ff6347,
              0 0 90px #ff8c00,
              0 0 110px #ff8c00;
            filter: brightness(1.4);
          }
          50% {
            text-shadow: 
              0 0 12px #ff4500,
              0 0 25px #ff4500,
              0 0 38px #ff6347,
              0 0 50px #ff6347,
              0 0 65px #ff8c00,
              0 0 80px #ff8c00;
            filter: brightness(0.85);
          }
          75% {
            text-shadow: 
              0 0 20px #ff4500,
              0 0 35px #ff4500,
              0 0 50px #ff6347,
              0 0 65px #ff6347,
              0 0 85px #ff8c00,
              0 0 105px #ff8c00;
            filter: brightness(1.3);
          }
        }

        @keyframes hire-glow {
          0%, 100% {
            text-shadow: 
              0 0 15px rgba(19, 138, 54, 1),
              0 0 30px rgba(19, 138, 54, 0.9),
              0 0 45px rgba(19, 138, 54, 0.7),
              0 0 60px rgba(34, 197, 94, 0.6),
              0 0 75px rgba(34, 197, 94, 0.4);
            filter: brightness(1.1);
          }
          50% {
            text-shadow: 
              0 0 25px rgba(19, 138, 54, 1),
              0 0 50px rgba(19, 138, 54, 0.9),
              0 0 75px rgba(19, 138, 54, 0.8),
              0 0 100px rgba(34, 197, 94, 0.7),
              0 0 125px rgba(34, 197, 94, 0.5);
            filter: brightness(1.35);
          }
        }

        .fire-effect {
          animation: fire-flicker 1.5s ease-in-out infinite;
        }

        .hire-glow-effect {
          animation: hire-glow 2s ease-in-out infinite;
        }
      `}</style>
    <div className="flex flex-col items-center justify-center min-h-screen p-8 game-bg">
      {/* Tutorial button - top left */}
      <button
        className="game-sharp font-black transition-all duration-300 ease-out hover:scale-110 hover:-rotate-6 absolute top-8 left-8 z-10 flex items-center justify-center opacity-0 animate-[fadeIn_0.6s_ease-out_1.8s_both]"
        style={{
          background: "#9966ff",
          border: "6px solid var(--game-text-primary)",
          color: "#fff",
          boxShadow: "8px 8px 0 rgba(0, 0, 0, 0.5)",
          width: "80px",
          height: "80px",
          fontSize: "3rem",
        }}
        onClick={() => navigate("/tutorial")}
        aria-label="How to Play Tutorial"
      >
        ?
      </button>

      <div className="text-center space-y-16">
        {/* Title with dynamic stamp effects */}
        <div className="flex items-center justify-center gap-16 flex-wrap">
          {/* HIRE with stamp animation */}
          <div className="animate-stamp-in" style={{ animationDelay: '0.2s' }}>
            <div 
              className="px-16 py-12 inline-block relative game-sharp transition-all duration-500 ease-out hover:scale-110 hover:rotate-[-12deg] cursor-pointer"
              style={{
                backgroundColor: 'var(--game-green)',
                border: '10px solid var(--game-text-primary)',
                transform: 'rotate(-8deg)',
                boxShadow: '12px 12px 0px rgba(0, 0, 0, 0.5)'
              }}
            >
              <span className="font-black text-white block hire-glow-effect" style={{ fontFamily: 'Impact, sans-serif', letterSpacing: '0.15em', fontSize: '7rem', lineHeight: '1' }}>
                HIRE
              </span>
            </div>
          </div>
          
          {/* OR with smooth fade */}
          <span 
            className="opacity-0 animate-[fadeIn_0.6s_ease-out_0.5s_both] font-black"
            style={{ 
              fontSize: '4rem',
              color: 'var(--game-text-primary)',
              fontFamily: 'Impact, sans-serif',
              textShadow: '4px 4px 0px rgba(0, 0, 0, 0.2)'
            }}
          >
            OR
          </span>
          
          {/* FIRE with stamp animation */}
          <div className="animate-stamp-in" style={{ animationDelay: '0.8s' }}>
            <div 
              className="px-16 py-12 inline-block relative game-sharp transition-all duration-500 ease-out hover:scale-110 hover:rotate-[8deg] cursor-pointer"
              style={{
                backgroundColor: 'var(--game-red)',
                border: '10px solid var(--game-text-primary)',
                transform: 'rotate(5deg)',
                boxShadow: '12px 12px 0px rgba(0, 0, 0, 0.5)'
              }}
            >
              <span className="font-black text-white block fire-effect" style={{ fontFamily: 'Impact, sans-serif', letterSpacing: '0.15em', fontSize: '7rem', lineHeight: '1' }}>
                FIRE
              </span>
            </div>
          </div>
        </div>
        
        {/* Label maker subtitle */}
        <div className="flex justify-center opacity-0 animate-[fadeIn_0.6s_ease-out_1.1s_both]">
          <div className="game-label-text text-3xl game-shadow-hard-sm px-8 py-3">
            INTERVIEW BATTLE
          </div>
        </div>
        
        {/* Start button - flat color block */}
        <div className="pt-8 opacity-0 animate-[fadeIn_0.6s_ease-out_1.3s_both]">
          <button
            className="game-sharp game-block-blue px-12 py-6 text-xl font-black uppercase tracking-widest game-shadow-hard-lg transition-all duration-300 ease-out hover:scale-105 hover:-translate-y-1 active:scale-95 active:translate-y-0"
            style={{
              border: '6px solid var(--game-text-primary)',
              color: 'var(--game-text-white)',
              letterSpacing: '0.15em'
            }}
            onClick={() => navigate('/lobby-creation')}
          >
            START GAME
          </button>
        </div>
      </div>
    </div>
    </>
  );
};

export default LandingV1;
