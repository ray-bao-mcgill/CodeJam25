import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Landing: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 game-bg">
      <div className="text-center space-y-12">
        <h1 
          className="text-7xl font-black tracking-widest game-text-glow-cyan"
          style={{ 
            fontFamily: 'Impact, Arial Black, sans-serif',
            color: 'var(--game-cyan)',
            textTransform: 'uppercase'
          }}
        >
          CHOOSE MODE
        </h1>
        
        <Button 
          size="lg"
          className="px-16 py-8 text-2xl font-bold rounded-2xl transform hover:scale-110 transition-all duration-300 game-border-glow-cyan"
          style={{
            background: `linear-gradient(135deg, var(--game-cyan-dark), var(--game-cyan))`,
            border: `3px solid var(--game-cyan)`,
            color: 'var(--game-text-primary)',
            fontFamily: 'Impact, Arial Black, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: '0.1em'
          }}
          onClick={() => navigate('/lobby-creation')}
        >
          START GAME
        </Button>
      </div>
    </div>
  );
};

export default Landing;



