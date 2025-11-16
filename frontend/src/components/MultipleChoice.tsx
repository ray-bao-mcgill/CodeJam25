import React, { useState } from 'react'
import { Button } from '@/components/ui/button'

export interface MultipleChoiceOption {
  id: string
  label: string
  color: 'red' | 'blue' | 'yellow' | 'green'
}

export interface MultipleChoiceProps {
  question: string
  options: MultipleChoiceOption[]
  onSubmit: (selectedOptionId: string) => void
  title?: string
  submitButtonText?: string
  disabled?: boolean
  isWaitingForOthers?: boolean
  submittedPlayersCount?: number
  totalPlayersCount?: number
  correctAnswerId?: string  // Option ID of the correct answer (e.g., "A", "B", "C", "D")
}

const MultipleChoice: React.FC<MultipleChoiceProps> = ({
  question,
  options,
  onSubmit,
  title,
  submitButtonText = 'SUBMIT',
  disabled = false,
  isWaitingForOthers = false,
  submittedPlayersCount = 0,
  totalPlayersCount = 0,
  correctAnswerId
}) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)

  const handleOptionClick = async (optionId: string) => {
    if (isSubmitting || disabled || isWaitingForOthers || selectedOption !== null) return
    
    // Check if answer is correct
    const correct = correctAnswerId === optionId
    setIsCorrect(correct)
    setSelectedOption(optionId)
    setShowFeedback(true)
    setIsSubmitting(true)
    
    // Show feedback for 1.5 seconds before submitting
    setTimeout(async () => {
      try {
        await onSubmit(optionId)
      } finally {
        setIsSubmitting(false)
        // Reset feedback after a brief delay
        setTimeout(() => {
          setShowFeedback(false)
          setSelectedOption(null)
        }, 300)
      }
    }, 1500)
  }

  // Define colors and shapes for each option - TechnicalTheoryRound style
  const optionStyles = [
    {
      color: 'orange',
      bgClass: 'bg-[#ff6600]', // Bright orange
      borderClass: 'border-[var(--game-text-primary)]',
      shape: (
        <div className="w-10 h-10 rounded-full bg-white border-[3px] border-black shadow-[2px_2px_0px_rgba(0,0,0,0.3)]" />
      ),
      label: 'A'
    },
    {
      color: 'lime',
      bgClass: 'bg-[#88dd00]', // Lime green
      borderClass: 'border-[var(--game-text-primary)]',
      shape: (
        <div className="w-10 h-10 rotate-45 bg-white border-[3px] border-black shadow-[2px_2px_0px_rgba(0,0,0,0.3)]" />
      ),
      label: 'B'
    },
    {
      color: 'pink',
      bgClass: 'bg-[#ff3366]', // Hot pink
      borderClass: 'border-[var(--game-text-primary)]',
      shape: (
        <div className="relative w-10 h-10">
          {/* Shadow layer */}
          <div 
            className="absolute top-[2px] left-[2px] w-10 h-10 bg-black opacity-30"
            style={{ 
              clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
            }} 
          />
          {/* Triangle */}
          <div 
            className="absolute top-0 left-0 w-10 h-10 bg-white border-[3px] border-black shadow-[2px_2px_0px_rgba(0,0,0,0.3)]"
            style={{ 
              clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
            }} 
          />
        </div>
      ),
      label: 'C'
    },
    {
      color: 'purple',
      bgClass: 'bg-[#9966ff]', // Purple
      borderClass: 'border-[var(--game-text-primary)]',
      shape: (
        <div className="w-10 h-10 bg-white border-[3px] border-black shadow-[2px_2px_0px_rgba(0,0,0,0.3)]" />
      ),
      label: 'D'
    }
  ]

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 game-bg">
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1.05); }
          50% { transform: scale(1.1); }
        }
      `}</style>
      <div className="w-full max-w-7xl space-y-6">
        {/* Title */}
        {title && (
          <div className="relative game-skew-left">
            <div className="game-sticky-note px-12 py-6 game-shadow-hard-lg">
              <h1 className="game-title text-6xl" style={{ fontSize: '3.5rem', lineHeight: '1.1' }}>
                {title}
              </h1>
            </div>
          </div>
        )}

        {/* Question */}
        <div className="text-center py-8 px-8 game-paper game-sharp game-shadow-hard border-4 border-[var(--game-text-primary)]">
          <h2 
            className="font-black text-[var(--game-text-primary)] leading-[1.4] break-words overflow-wrap-anywhere" 
            style={{ 
              fontFamily: 'Arial, sans-serif',
              fontSize: 'clamp(1rem, 4vw, 1.875rem)' // Responsive font size: min 1rem, max 1.875rem (30px)
            }}
          >
            {question}
          </h2>
        </div>

        {/* Answer Options Grid */}
        <div className="grid grid-cols-2 gap-6">
          {options.map((option, index) => {
            const isSelected = selectedOption === option.id
            const isCorrect = correctAnswerId === option.id
            const style = optionStyles[index] || optionStyles[0]
            
            const isOptionSelected = selectedOption === option.id
            const isCorrectOption = correctAnswerId === option.id
            const isDisabled = disabled || isSubmitting || isWaitingForOthers || (selectedOption !== null && !isOptionSelected)
            // Always show correct answer in green when feedback is active
            const showCorrectHighlight = showFeedback && isCorrectOption
            const showIncorrectHighlight = showFeedback && isOptionSelected && !isCorrect
            
            let buttonClasses = `text-base font-bold game-sharp game-shadow-hard transition-all duration-200 relative overflow-hidden border-8`
            let buttonStyle: React.CSSProperties = {
              fontFamily: 'Arial, sans-serif',
              height: '140px', // Fixed height
              width: '100%', // Fixed width within grid
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              opacity: isDisabled && !isOptionSelected && !showCorrectHighlight ? 0.6 : 1,
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
              hyphens: 'auto',
              padding: '16px',
              transition: 'all 0.3s ease'
            }

            // Apply feedback colors
            if (showFeedback && isOptionSelected) {
              if (isCorrect) {
                // Green glow for correct answer
                buttonClasses += " bg-green-500 border-green-700 text-white"
                buttonStyle.boxShadow = '0 0 20px rgba(34, 197, 94, 0.8), 0 0 40px rgba(34, 197, 94, 0.6)'
                buttonStyle.transform = 'scale(1.05)'
              } else {
                // Red glow for incorrect answer
                buttonClasses += " bg-red-500 border-red-700 text-white"
                buttonStyle.boxShadow = '0 0 20px rgba(239, 68, 68, 0.8), 0 0 40px rgba(239, 68, 68, 0.6)'
                buttonStyle.transform = 'scale(1.05)'
              }
            } else if (showCorrectHighlight) {
              // Always highlight correct answer in green when feedback is shown
              buttonClasses += " bg-green-500 border-green-700 text-white"
              buttonStyle.boxShadow = '0 0 20px rgba(34, 197, 94, 0.8), 0 0 40px rgba(34, 197, 94, 0.6)'
              buttonStyle.transform = 'scale(1.05)'
              buttonStyle.animation = 'pulse 0.5s ease-in-out'
            } else if (isDisabled && !isOptionSelected && !showCorrectHighlight) {
              // Grey out when disabled (but keep selected/correct options visible)
              buttonClasses += " bg-gray-400 border-[var(--game-text-primary)] text-white"
            } else {
              buttonClasses += ` ${style.bgClass} ${style.borderClass} text-white`
              if (!isDisabled) {
                buttonClasses += " hover:translate-y-[-4px] hover:rotate-[-2deg] hover:shadow-[12px_12px_0px_rgba(0,0,0,0.3)] hover:bg-[var(--game-yellow)] hover:border-[var(--game-text-primary)]"
              }
              if (isOptionSelected && !showFeedback) {
                buttonClasses += " scale-105 ring-4 ring-offset-2 ring-gray-800"
                buttonStyle.transform = 'scale(1.05)'
              }
            }

            return (
              <div key={option.id} className="relative">
                {isCorrect && (
                  <span className="absolute -top-2 -right-2 text-4xl font-bold text-yellow-400 z-10 drop-shadow-[2px_2px_0px_rgba(0,0,0,0.8)]" style={{ textShadow: '2px 2px 0px rgba(0,0,0,0.8)' }}>
                    ★
                  </span>
                )}
                <Button
                onClick={() => handleOptionClick(option.id)}
                disabled={isDisabled}
                className={buttonClasses}
                style={buttonStyle}
                variant="ghost"
              >
                <div className="flex items-center gap-3 w-full h-full">
                  {/* Shape Icon */}
                  <div className="flex-shrink-0">{style.shape}</div>
                  
                  {/* Option Text */}
                  <span 
                    className="flex-1 text-left break-words overflow-wrap-anywhere"
                    style={{
                      fontSize: 'clamp(0.75rem, 2.5vw, 1rem)', // Responsive: min 12px, max 16px
                      lineHeight: '1.3'
                    }}
                  >
                    {option.label}
                  </span>
                  
                  {/* Letter Label */}
                  <span className="text-2xl font-black opacity-80 flex-shrink-0">{style.label}</span>
                </div>
                </Button>
              </div>
            )
          })}
        </div>

        {/* Waiting for others indicator */}
        {isWaitingForOthers && (
          <div className="text-center">
            <div className="game-label-text text-lg game-shadow-hard-sm inline-block">
              WAITING FOR OTHER PLAYERS... ({submittedPlayersCount} / {totalPlayersCount})
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default MultipleChoice

