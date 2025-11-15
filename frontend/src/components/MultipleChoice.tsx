import React, { useState } from 'react'

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
}

const MultipleChoice: React.FC<MultipleChoiceProps> = ({
  question,
  options,
  onSubmit,
  title,
  submitButtonText = 'SUBMIT',
  disabled = false
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

  const colorClasses = {
    red: 'game-block-red',
    blue: 'game-block-blue',
    yellow: 'game-block-yellow',
    green: 'game-block-green'
  }

  const colorBorders = {
    red: 'border-red-600',
    blue: 'border-blue-600',
    yellow: 'border-yellow-600',
    green: 'border-green-600'
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 game-bg">
      <div className="w-full max-w-4xl space-y-6">
        {/* Title */}
        {title && (
          <div className="text-center">
            <div className="game-paper px-8 py-4 game-shadow-hard-lg game-hand-drawn inline-block">
              <h1 className="game-title text-3xl sm:text-4xl">{title}</h1>
            </div>
          </div>
        )}

        {/* Question */}
        <div className="game-paper px-6 py-5 game-shadow-hard-lg">
          <div className="game-label-text text-sm mb-3">QUESTION</div>
          <div className="text-lg font-bold text-gray-800 whitespace-pre-wrap">
            {question}
          </div>
        </div>

        {/* Options - Kahoot style grid */}
        <div className="grid grid-cols-2 gap-4">
          {options.map((option) => {
            const isSelected = selectedOption === option.id
            return (
              <button
                key={option.id}
                onClick={() => !disabled && !isSubmitting && setSelectedOption(option.id)}
                disabled={disabled || isSubmitting}
                className={`game-sharp px-6 py-8 text-lg font-black uppercase tracking-widest game-shadow-hard-lg transition-all duration-200 ${
                  colorClasses[option.color]
                } ${
                  isSelected 
                    ? 'ring-4 ring-offset-2 ring-gray-800 scale-105' 
                    : 'game-button-hover'
                }`}
                style={{
                  border: `6px solid var(--game-text-primary)`,
                  color: 'var(--game-text-white)',
                  opacity: (disabled || isSubmitting) ? 0.6 : 1,
                  cursor: (disabled || isSubmitting) ? 'not-allowed' : 'pointer',
                  transform: isSelected ? 'scale(1.05)' : 'scale(1)'
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-black mr-4">
                    {option.id === 'A' ? '🔴' : option.id === 'B' ? '🔵' : option.id === 'C' ? '🟡' : '🟢'}
                  </span>
                  <span className="flex-1 text-left">{option.label}</span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Submit Button */}
        <div className="flex justify-center">
          <button
            onClick={handleSubmit}
            disabled={!selectedOption || isSubmitting || disabled}
            className={`game-sharp px-10 py-5 text-lg font-black uppercase tracking-widest game-shadow-hard-lg transition-all ${
              selectedOption && !isSubmitting && !disabled
                ? 'game-block-green game-button-hover'
                : 'game-paper'
            }`}
            style={{
              border: '6px solid var(--game-text-primary)',
              color: selectedOption && !isSubmitting && !disabled
                ? 'var(--game-text-white)'
                : 'var(--game-text-dim)',
              cursor: selectedOption && !isSubmitting && !disabled
                ? 'pointer'
                : 'not-allowed',
              opacity: (!selectedOption || isSubmitting || disabled) ? 0.5 : 1
            }}
          >
            {isSubmitting ? 'SUBMITTING...' : submitButtonText}
          </button>
        </div>
      </div>
    </div>
  )
}

export default MultipleChoice

