import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const [showButtons, setShowButtons] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Reset visibility state and trigger fade in on mount
    setIsVisible(false);
    // Small delay to ensure initial state is rendered before animation
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 10);
    return () => clearTimeout(timer);
  }, []);

  const handleStartGame = () => {
    // Trigger shrink and fade out animation
    setShowButtons(true);
    
    // Navigate to lobby creation page after fade out completes
    setTimeout(() => {
      navigate('/lobby-creation');
    }, 1500); // Wait for shrink/fade animation to complete
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 game-bg">
      <div className="text-center space-y-16 relative">
        {/* Hand-drawn title with sticky note effect - shrinks and fades out when showButtons is true */}
        <div 
          className="relative inline-block game-skew-left transition-all duration-1000 ease-in-out"
          style={{
            transform: showButtons ? 'scale(0.3)' : 'scale(1)',
            opacity: showButtons ? 0 : 1,
            transition: 'transform 1s cubic-bezier(0.68, -0.55, 0.265, 1.55), opacity 1s ease-out'
          }}
        >
          <div className="game-sticky-note px-12 py-8 game-shadow-hard-lg">
            <h1 className="game-title text-8xl" style={{ fontSize: '6rem', lineHeight: '1.1' }}>
              HIRE OR <span className="game-flame">
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
        <div 
          className="flex justify-center transition-all duration-1000 ease-in-out"
          style={{
            transform: showButtons ? 'scale(0.3)' : 'scale(1)',
            opacity: showButtons ? 0 : 1,
            transition: 'transform 1s cubic-bezier(0.68, -0.55, 0.265, 1.55), opacity 1s ease-out'
          }}
        >
          <div className="game-label-text text-2xl game-shadow-hard-sm">
            INTERVIEW BATTLE
          </div>
        </div>

        {/* Decorative elements - also shrink and fade out */}
        <div 
          className="absolute top-20 left-10 text-6xl opacity-70 game-skew-right transition-all duration-1000 ease-in-out"
          style={{
            transform: showButtons ? 'scale(0.3)' : 'scale(1)',
            opacity: showButtons ? 0 : 0.7,
            transition: 'transform 1s cubic-bezier(0.68, -0.55, 0.265, 1.55), opacity 1s ease-out'
          }}
        >
          📋
        </div>
        <div 
          className="absolute bottom-20 right-10 text-6xl opacity-70 game-skew-left transition-all duration-1000 ease-in-out"
          style={{
            transform: showButtons ? 'scale(0.3)' : 'scale(1)',
            opacity: showButtons ? 0 : 0.7,
            transition: 'transform 1s cubic-bezier(0.68, -0.55, 0.265, 1.55), opacity 1s ease-out'
          }}
        >
          💼
        </div>
        
        {/* Start button - bounce fade in on mount, fades out when clicked */}
        <div 
          className="pt-8 transition-all duration-1000 ease-in-out"
          style={{
            transform: (showButtons ? 'scale(0.3)' : (isVisible ? 'scale(1)' : 'scale(0.8)')),
            opacity: showButtons ? 0 : (isVisible ? 1 : 0),
            transition: showButtons 
              ? 'transform 1s cubic-bezier(0.68, -0.55, 0.265, 1.55), opacity 1s ease-out'
              : 'transform 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55), opacity 0.6s ease-out'
          }}
        >
          <button
            className="game-sharp game-block-blue px-12 py-6 text-xl font-black uppercase tracking-widest game-shadow-hard-lg game-button-hover"
            style={{
              border: '6px solid var(--game-text-primary)',
              color: 'var(--game-text-white)',
              letterSpacing: '0.15em'
            }}
            onClick={handleStartGame}
            disabled={showButtons}
          >
            START GAME
          </button>
        </div>
      </div>
    </div>
  );
};

export default Landing;



