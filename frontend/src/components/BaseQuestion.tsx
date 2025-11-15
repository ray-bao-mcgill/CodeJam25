import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export interface BaseQuestionProps {
  question: string
  onSubmit: (answer: string) => Promise<void> | void
  onNext?: () => void
  placeholder?: string
  submitButtonText?: string
  title?: string
  showSkip?: boolean
  onSkip?: () => void
  maxLength?: number
  isLoading?: boolean
  timeRemaining?: number
  isWaitingForOthers?: boolean
  submittedPlayersCount?: number
  totalPlayersCount?: number
}

const BaseQuestion: React.FC<BaseQuestionProps> = ({
  question,
  onSubmit,
  onNext,
  placeholder = "Type your answer here...",
  submitButtonText = "SUBMIT",
  title,
  showSkip = false,
  onSkip,
  maxLength = 2000,
  isLoading = false,
  timeRemaining,
  isWaitingForOthers = false,
  submittedPlayersCount = 0,
  totalPlayersCount = 0,
}) => {
  const [answer, setAnswer] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    setIsVisible(false)
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, 10)
    return () => clearTimeout(timer)
  }, [question])

  const handleSubmit = async () => {
    if (!answer.trim() || isSubmitting || isLoading) {
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit(answer.trim())
      setAnswer('')
      if (onNext) {
        onNext()
      }
    } catch (error) {
      console.error('Error submitting answer:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey && !isSubmitting && !isLoading) {
      handleSubmit()
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 game-bg">
      <div
        className="w-full max-w-4xl space-y-6"
        style={{
          transform: isVisible ? 'scale(1)' : 'scale(0.8)',
          opacity: isVisible ? 1 : 0,
          transition: 'transform 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55), opacity 0.6s ease-out'
        }}
      >
        {/* Title */}
        {title && (
          <div className="text-center">
            <div className="game-paper px-8 py-4 game-shadow-hard-lg game-hand-drawn inline-block">
              <h1 className="game-title text-3xl sm:text-4xl">{title}</h1>
            </div>
          </div>
        )}

        {/* Timer and Status */}
        {(timeRemaining !== undefined || isWaitingForOthers) && (
          <div className="game-paper px-6 py-4 game-shadow-hard-lg">
            <div className="flex items-center justify-between flex-wrap gap-4">
              {timeRemaining !== undefined && (
                <div className="flex items-center gap-2">
                  <div className="game-label-text text-sm">TIME REMAINING:</div>
                  <div className={`text-2xl font-black ${timeRemaining <= 30 ? 'text-red-600' : 'text-gray-800'}`}>
                    {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                  </div>
                </div>
              )}
              {isWaitingForOthers && (
                <div className="flex items-center gap-2">
                  <div className="game-label-text text-sm">WAITING FOR OTHER PLAYERS...</div>
                  <div className="text-lg font-bold text-gray-800">
                    {submittedPlayersCount} / {totalPlayersCount}
                  </div>
                </div>
              )}
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

        {/* Answer Input */}
        <div className="game-paper px-6 py-5 game-shadow-hard-lg">
          <div className="game-label-text text-sm mb-3">YOUR ANSWER</div>
          <textarea
            value={answer}
            onChange={(e) => {
              if (e.target.value.length <= maxLength) {
                setAnswer(e.target.value)
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full min-h-[200px] p-4 text-base border-4 border-gray-800 rounded-none font-mono resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{
              background: 'var(--game-bg-alt)',
              color: 'var(--game-text-primary)',
            }}
            disabled={isSubmitting || isLoading}
          />
          <div className="text-xs text-gray-600 mt-2 text-right">
            {answer.length}/{maxLength} characters
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4 flex-wrap">
          {showSkip && onSkip && (
            <button
              onClick={onSkip}
              disabled={isSubmitting || isLoading}
              className="game-sharp game-paper px-8 py-4 text-base font-black uppercase tracking-widest game-shadow-hard game-button-hover"
              style={{
                border: '4px solid var(--game-text-primary)',
                color: 'var(--game-text-primary)',
                opacity: (isSubmitting || isLoading) ? 0.5 : 1,
                cursor: (isSubmitting || isLoading) ? 'not-allowed' : 'pointer'
              }}
            >
              SKIP
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={!answer.trim() || isSubmitting || isLoading || isWaitingForOthers}
            className={`game-sharp px-8 py-4 text-base font-black uppercase tracking-widest game-shadow-hard-lg game-button-hover ${
              answer.trim() && !isSubmitting && !isLoading && !isWaitingForOthers
                ? 'game-block-green'
                : 'game-paper'
            }`}
            style={{
              border: '6px solid var(--game-text-primary)',
              color: answer.trim() && !isSubmitting && !isLoading && !isWaitingForOthers
                ? 'var(--game-text-white)'
                : 'var(--game-text-dim)',
              cursor: answer.trim() && !isSubmitting && !isLoading && !isWaitingForOthers
                ? 'pointer'
                : 'not-allowed',
              opacity: (!answer.trim() || isSubmitting || isLoading || isWaitingForOthers) ? 0.5 : 1
            }}
          >
            {isWaitingForOthers 
              ? 'WAITING FOR OTHERS...' 
              : isSubmitting || isLoading 
                ? 'SUBMITTING...' 
                : submitButtonText}
          </button>
        </div>
      </div>
    </div>
  )
}

export default BaseQuestion

