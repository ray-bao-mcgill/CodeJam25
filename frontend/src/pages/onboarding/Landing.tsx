import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Landing: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 game-bg">
      <div className="text-center space-y-16 relative">
        {/* Hand-drawn title with sticky note effect */}
        <div className="relative inline-block game-skew-left">
          <div className="game-sticky-note px-20 py-16 game-shadow-hard-lg">
            <h1 className="game-title text-8xl" style={{ fontSize: '6rem', lineHeight: '1.1' }}>
              <span className="game-success">
                <span className="success-letter success-letter-1" data-letter="H">H</span>
                <span className="success-letter success-letter-2" data-letter="I">I</span>
                <span className="success-letter success-letter-3" data-letter="R">R</span>
                <span className="success-letter success-letter-4" data-letter="E">E</span>
              </span> <span style={{ fontSize: '0.6em' }}>OR</span> <span className="game-flame">
                <span className="flame-letter flame-letter-1">F</span>
                <span className="flame-letter flame-letter-2">I</span>
                <span className="flame-letter flame-letter-3">R</span>
                <span className="flame-letter flame-letter-4">E</span>
              </span>
            </h1>
          </div>
          {/* Doodle annotation */}
          <div 
            className="absolute -top-4 -right-8 text-4xl"
            style={{ transform: 'rotate(15deg)', opacity: 0.8 }}
          >
            ✏️
          </div>
        </div>
        
        {/* Label maker subtitle */}
        <div className="flex justify-center">
          <div className="game-label-text text-2xl game-shadow-hard-sm">
            INTERVIEW BATTLE
          </div>
        </div>
        
        {/* Start button - flat color block */}
        <div className="pt-8">
          <button
            className="game-sharp game-block-blue px-12 py-6 text-xl font-black uppercase tracking-widest game-shadow-hard-lg game-button-hover"
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

        {/* Decorative elements */}
        <div className="absolute bottom-20 right-10 text-6xl opacity-70 game-skew-left">
          💼
        </div>
      </div>
    </div>
  );
};

export default Landing;



