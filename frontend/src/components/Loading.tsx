import React from 'react'

interface LoadingProps {
  message?: string
}

const Loading: React.FC<LoadingProps> = ({ message = 'Loading...' }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 game-bg">
      <div className="text-center space-y-6">
        <div className="game-paper px-8 py-6 game-shadow-hard-lg game-hand-drawn inline-block">
          <div className="game-title text-2xl sm:text-3xl">
            {message}
          </div>
        </div>
        
        {/* Animated dots */}
        <div className="flex justify-center gap-2">
          <div 
            className="game-sharp w-4 h-4 game-shadow-hard-sm"
            style={{
              background: 'var(--game-blue)',
              border: '3px solid var(--game-text-primary)',
              animation: 'bounce 1.4s ease-in-out infinite',
              animationDelay: '0s'
            }}
          />
          <div 
            className="game-sharp w-4 h-4 game-shadow-hard-sm"
            style={{
              background: 'var(--game-red)',
              border: '3px solid var(--game-text-primary)',
              animation: 'bounce 1.4s ease-in-out infinite',
              animationDelay: '0.2s'
            }}
          />
          <div 
            className="game-sharp w-4 h-4 game-shadow-hard-sm"
            style={{
              background: 'var(--game-yellow)',
              border: '3px solid var(--game-text-primary)',
              animation: 'bounce 1.4s ease-in-out infinite',
              animationDelay: '0.4s'
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default Loading

