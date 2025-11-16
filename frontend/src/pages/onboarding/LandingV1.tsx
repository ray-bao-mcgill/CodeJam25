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
          animation: fire-flicker 2s ease-in-out infinite;
          will-change: filter, text-shadow;
        }

        .hire-glow-effect {
          animation: hire-glow 3s ease-in-out infinite;
          will-change: filter, text-shadow;
        }
        /* Idle float/wobble animation for HIRE/FIRE cards */
        @keyframes idle-float-hire {
          0%, 100% {
            transform: rotate(-8deg) translateY(0px) translateX(0px);
          }
          25% {
            transform: rotate(-7deg) translateY(-4px) translateX(2px);
          }
          50% {
            transform: rotate(-9deg) translateY(-2px) translateX(-2px);
          }
          75% {
            transform: rotate(-8deg) translateY(-5px) translateX(1px);
          }
        }
        @keyframes idle-float-fire {
          0%, 100% {
            transform: rotate(5deg) translateY(0px) translateX(0px);
          }
          25% {
            transform: rotate(6deg) translateY(-4px) translateX(-2px);
          }
          50% {
            transform: rotate(4deg) translateY(-2px) translateX(2px);
          }
          75% {
            transform: rotate(5deg) translateY(-5px) translateX(-1px);
          }
        }
        .card-idle-float-hire {
          animation: idle-float-hire 6s ease-in-out infinite;
          will-change: transform;
          transform: translateZ(0);
        }
        .card-idle-float-fire {
          animation: idle-float-fire 6s ease-in-out infinite;
          will-change: transform;
          transform: translateZ(0);
        }
        /* Preserve rotation on hover while scaling */
        .card-idle-float-hire:hover,
        .card-idle-float-fire:hover {
          animation-play-state: paused;
        }
        /* Button hover and focus effects */
        .button-hover-glow {
          transform: skew(-2deg) translateZ(0);
          will-change: transform;
        }
        .button-hover-glow:hover {
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.4), 0 0 25px rgba(59, 130, 246, 0.4);
          transform: skew(-2deg) scale(1.05) translateY(-4px) translateZ(0);
        }
        .button-hover-glow:focus {
          outline: 3px solid var(--game-blue);
          outline-offset: 4px;
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.35), 0 0 20px rgba(59, 130, 246, 0.3);
          transform: skew(-2deg) translateZ(0);
        }
        .button-hover-glow:active {
          transform: skew(-2deg) scale(0.95) translateZ(0);
        }
        /* Subtle background enhancement - simplified for performance */
        .bg-enhanced::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.015) 0%, rgba(0, 0, 0, 0.008) 100%);
          pointer-events: none;
          z-index: 0;
        }
        .bg-enhanced::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: 
            radial-gradient(circle at 15% 25%, rgba(34, 197, 94, 0.025) 0%, transparent 50%),
            radial-gradient(circle at 85% 75%, rgba(239, 68, 68, 0.025) 0%, transparent 50%);
          pointer-events: none;
          z-index: 0;
          /* Removed animation for better performance */
        }
        .bg-enhanced > * {
          position: relative;
          z-index: 1;
        }
        /* Scrolling news ticker for job rejections - optimized */
        @keyframes scroll-ticker {
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(-50%, 0, 0);
          }
        }
        @keyframes scroll-ticker-reverse {
          0% {
            transform: translate3d(-50%, 0, 0);
          }
          100% {
            transform: translate3d(0, 0, 0);
          }
        }
        .rejection-ticker {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 75px;
          background: var(--game-red);
          border-top: 8px solid var(--game-text-primary);
          overflow: hidden;
          z-index: 20;
          display: flex;
          align-items: center;
          box-shadow: 0 -5px 10px rgba(0, 0, 0, 0.2);
          contain: layout style paint;
        }
        .rejection-ticker-top {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 75px;
          background: var(--game-green);
          border-bottom: 8px solid var(--game-text-primary);
          overflow: hidden;
          z-index: 20;
          display: flex;
          align-items: center;
          box-shadow: 0 5px 10px rgba(0, 0, 0, 0.2);
          contain: layout style paint;
        }
        .ticker-content {
          display: flex;
          white-space: nowrap;
          animation: scroll-ticker 40s linear infinite;
          will-change: transform;
          transform: translateZ(0);
        }
        .ticker-content-reverse {
          display: flex;
          white-space: nowrap;
          animation: scroll-ticker-reverse 40s linear infinite;
          will-change: transform;
          transform: translateZ(0);
        }
        .ticker-item {
          display: inline-flex;
          align-items: center;
          padding: 0 50px;
          font-family: 'Courier New', monospace;
          font-weight: bold;
          font-size: 1.5rem;
          color: var(--game-text-white);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          text-shadow: 2.5px 2.5px 0px rgba(0, 0, 0, 0.3);
          backface-visibility: hidden;
        }
        .ticker-separator {
          display: inline-block;
          width: 10px;
          height: 10px;
          background: var(--game-text-white);
          border-radius: 50%;
          margin: 0 25px;
          backface-visibility: hidden;
        }
      `}</style>
    {/* Tutorial button - top left */}
    <button
      className="game-sharp font-black transition-all duration-300 ease-out hover:scale-110 hover:-rotate-6 fixed top-24 left-8 z-50 flex items-center justify-center opacity-0 animate-[fadeIn_0.6s_ease-out_1.8s_both]"
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

    {/* Scrolling "you're hired" ticker - top */}
    <div className="rejection-ticker-top">
      <div className="ticker-content-reverse">
        <span className="ticker-item">YOU'RE HIRED</span>
        <span className="ticker-separator"></span>
        <span className="ticker-item">WELCOME TO THE TEAM</span>
        <span className="ticker-separator"></span>
        <span className="ticker-item">CONGRATULATIONS</span>
        <span className="ticker-separator"></span>
        <span className="ticker-item">START MONDAY</span>
        <span className="ticker-separator"></span>
        <span className="ticker-item">WE'D LOVE TO HAVE YOU</span>
        <span className="ticker-separator"></span>
        <span className="ticker-item">OFFER EXTENDED</span>
        <span className="ticker-separator"></span>
        <span className="ticker-item">YOU GOT THE JOB</span>
        <span className="ticker-separator"></span>
        <span className="ticker-item">PERFECT FIT</span>
        <span className="ticker-separator"></span>
        <span className="ticker-item">WE'RE EXCITED TO WORK WITH YOU</span>
        <span className="ticker-separator"></span>
        <span className="ticker-item">SEE YOU ON YOUR FIRST DAY</span>
        <span className="ticker-separator"></span>
        <span className="ticker-item">YOU'RE HIRED</span>
        <span className="ticker-separator"></span>
        <span className="ticker-item">WELCOME TO THE TEAM</span>
        <span className="ticker-separator"></span>
        <span className="ticker-item">CONGRATULATIONS</span>
        <span className="ticker-separator"></span>
        <span className="ticker-item">START MONDAY</span>
        <span className="ticker-separator"></span>
        <span className="ticker-item">WE'D LOVE TO HAVE YOU</span>
        <span className="ticker-separator"></span>
        <span className="ticker-item">OFFER EXTENDED</span>
        <span className="ticker-separator"></span>
        <span className="ticker-item">YOU GOT THE JOB</span>
        <span className="ticker-separator"></span>
        <span className="ticker-item">PERFECT FIT</span>
        <span className="ticker-separator"></span>
        <span className="ticker-item">WE'RE EXCITED TO WORK WITH YOU</span>
        <span className="ticker-separator"></span>
        <span className="ticker-item">SEE YOU ON YOUR FIRST DAY</span>
      </div>
    </div>

    <div className="flex flex-col items-center justify-center min-h-screen p-8 game-bg bg-enhanced">
      <div className="text-center space-y-16">
        {/* Title with dynamic stamp effects */}
        <div className="flex items-center justify-center gap-16 flex-wrap">
          {/* HIRE with stamp animation */}
          <div className="animate-stamp-in" style={{ animationDelay: '0.2s' }}>
            <div 
              className="px-16 py-12 inline-block relative game-sharp card-idle-float-hire transition-all duration-500 ease-out hover:scale-110 hover:rotate-[-12deg] cursor-pointer"
              style={{
                backgroundColor: 'var(--game-green)',
                border: '10px solid var(--game-text-primary)',
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
              className="px-16 py-12 inline-block relative game-sharp card-idle-float-fire transition-all duration-500 ease-out hover:scale-110 hover:rotate-[8deg] cursor-pointer"
              style={{
                backgroundColor: 'var(--game-red)',
                border: '10px solid var(--game-text-primary)',
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
            className="game-sharp game-block-blue px-12 py-6 text-xl font-black uppercase tracking-widest game-shadow-hard-lg button-hover-glow transition-all duration-300 ease-out"
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

      {/* Scrolling rejection ticker */}
      <div className="rejection-ticker">
        <div className="ticker-content">
          <span className="ticker-item">REJECTED</span>
          <span className="ticker-separator"></span>
          <span className="ticker-item">NOT SELECTED</span>
          <span className="ticker-separator"></span>
          <span className="ticker-item">THANKS BUT NO THANKS</span>
          <span className="ticker-separator"></span>
          <span className="ticker-item">POSITION FILLED</span>
          <span className="ticker-separator"></span>
          <span className="ticker-item">BETTER CANDIDATE FOUND</span>
          <span className="ticker-separator"></span>
          <span className="ticker-item">WE'LL KEEP YOUR RESUME ON FILE</span>
          <span className="ticker-separator"></span>
          <span className="ticker-item">APPLICATION REVIEWED</span>
          <span className="ticker-separator"></span>
          <span className="ticker-item">NOT A GOOD FIT</span>
          <span className="ticker-separator"></span>
          <span className="ticker-item">REJECTED</span>
          <span className="ticker-separator"></span>
          <span className="ticker-item">NOT SELECTED</span>
          <span className="ticker-separator"></span>
          <span className="ticker-item">THANKS BUT NO THANKS</span>
          <span className="ticker-separator"></span>
          <span className="ticker-item">POSITION FILLED</span>
          <span className="ticker-separator"></span>
          <span className="ticker-item">BETTER CANDIDATE FOUND</span>
          <span className="ticker-separator"></span>
          <span className="ticker-item">WE'LL KEEP YOUR RESUME ON FILE</span>
          <span className="ticker-separator"></span>
          <span className="ticker-item">APPLICATION REVIEWED</span>
          <span className="ticker-separator"></span>
          <span className="ticker-item">NOT A GOOD FIT</span>
        </div>
      </div>
    </div>
    </>
  );
};

export default LandingV1;
