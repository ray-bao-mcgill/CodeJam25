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
  totalPlayersCount = 0
}) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!selectedOption || isSubmitting || disabled) return
    
    setIsSubmitting(true)
    try {
      await onSubmit(selectedOption)
    } finally {
      setIsSubmitting(false)
    }
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
          <h2 className="text-3xl font-black text-[var(--game-text-primary)] leading-[1.4]" style={{ fontFamily: 'Arial, sans-serif' }}>
            {question}
          </h2>
        </div>

        {/* Answer Options Grid */}
        <div className="grid grid-cols-2 gap-6">
          {options.map((option, index) => {
            const isSelected = selectedOption === option.id
            const style = optionStyles[index] || optionStyles[0]
            
            let buttonClasses = `py-8 px-6 text-xl font-bold game-sharp game-shadow-hard transition-all duration-200 relative overflow-visible border-8`
            let buttonStyle: React.CSSProperties = {
              fontFamily: 'Arial, sans-serif',
              minHeight: '120px',
              cursor: (disabled || isSubmitting || isWaitingForOthers) ? 'not-allowed' : 'pointer',
              opacity: 1 // Force full opacity always
            }

            if (disabled || isSubmitting || isWaitingForOthers) {
              // Grey out when disabled
              buttonClasses += " bg-gray-400 border-[var(--game-text-primary)] text-white"
            } else {
              buttonClasses += ` ${style.bgClass} ${style.borderClass} text-white hover:translate-y-[-4px] hover:rotate-[-2deg] hover:shadow-[12px_12px_0px_rgba(0,0,0,0.3)] hover:bg-[var(--game-yellow)] hover:border-[var(--game-text-primary)]`
              if (isSelected) {
                buttonClasses += " scale-105 ring-4 ring-offset-2 ring-gray-800"
                buttonStyle.transform = 'scale(1.05)'
              }
            }

            return (
              <Button
                key={option.id}
                onClick={() => !disabled && !isSubmitting && !isWaitingForOthers && setSelectedOption(option.id)}
                disabled={disabled || isSubmitting || isWaitingForOthers}
                className={buttonClasses}
                style={buttonStyle}
                variant="ghost"
              >
                <div className="flex items-center gap-4 w-full">
                  {/* Shape Icon */}
                  <div className="flex-shrink-0">{style.shape}</div>
                  
                  {/* Option Text */}
                  <span className="flex-1 text-left">{option.label}</span>
                  
                  {/* Letter Label */}
                  <span className="text-3xl font-black opacity-80">{style.label}</span>
                </div>
              </Button>
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

        {/* Submit Button */}
        <div className="flex justify-center">
          <button
            onClick={handleSubmit}
            disabled={!selectedOption || isSubmitting || disabled || isWaitingForOthers}
            className={`game-sharp px-10 py-5 text-lg font-black uppercase tracking-widest game-shadow-hard-lg transition-all ${
              selectedOption && !isSubmitting && !disabled && !isWaitingForOthers
                ? 'game-block-green game-button-hover'
                : 'game-paper'
            }`}
            style={{
              border: '6px solid var(--game-text-primary)',
              color: selectedOption && !isSubmitting && !disabled && !isWaitingForOthers
                ? 'var(--game-text-white)'
                : 'var(--game-text-dim)',
              cursor: selectedOption && !isSubmitting && !disabled && !isWaitingForOthers
                ? 'pointer'
                : 'not-allowed',
              opacity: (!selectedOption || isSubmitting || disabled || isWaitingForOthers) ? 0.5 : 1
            }}
          >
            {isSubmitting ? 'SUBMITTING...' : isWaitingForOthers ? 'WAITING...' : submitButtonText}
          </button>
        </div>
      </div>
    </div>
  )
}

export default MultipleChoice

