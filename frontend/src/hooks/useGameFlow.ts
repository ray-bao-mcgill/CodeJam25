import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_URL } from '../config'
import { useLobby } from './useLobby'

export type GamePhase = 
  | 'tutorial'
  | 'behavioural_question'
  | 'behavioural_followup'
  | 'behavioural_score'
  | 'technical_theory'
  | 'technical_theory_score'
  | 'technical'
  | 'technical_score'
  | 'game_end'

export interface GameState {
  phase: GamePhase
  questionIndex: number
  currentQuestion?: string
  followUpQuestion?: string
  scores: Record<string, number>
  answers: string[]
  technicalTheoryQuestions: string[]
  technicalTheoryAnswers: string[]
  technicalTheoryCurrentIndex: number
}

export function useGameFlow() {
  const navigate = useNavigate()
  const { lobbyId, playerId } = useLobby()
  
  const [gameState, setGameState] = useState<GameState>({
    phase: 'tutorial',
    questionIndex: 0,
    scores: {},
    answers: [],
    technicalTheoryQuestions: [],
    technicalTheoryAnswers: [],
    technicalTheoryCurrentIndex: 0,
  })

  // Note: Navigation is handled by ReadyScreen component
  // This hook manages game state and provides functions for game flow

  const proceedToNextPhase = useCallback(() => {
    setGameState((prev) => {
      const phaseOrder: GamePhase[] = [
        'tutorial',
        'behavioural_question',
        'behavioural_followup',
        'behavioural_score',
        'technical_theory',
        'technical_theory_score',
        'technical',
        'technical_score',
        'game_end',
      ]

      const currentIndex = phaseOrder.indexOf(prev.phase)
      const nextPhase = phaseOrder[currentIndex + 1] || 'game_end'

      // Navigate based on phase
      switch (nextPhase) {
        case 'behavioural_question':
          navigate('/behavioural-question')
          break
        case 'behavioural_followup':
          navigate('/behavioural-answer')
          break
        case 'behavioural_score':
          navigate('/current-score')
          break
        case 'technical_theory':
          navigate('/technical-theory')
          break
        case 'technical_theory_score':
          navigate('/current-score')
          break
        case 'technical':
          navigate('/technical-theory')
          break
        case 'technical_score':
          navigate('/current-score')
          break
        case 'game_end':
          navigate('/win-lose')
          break
        default:
          break
      }

      return {
        ...prev,
        phase: nextPhase,
      }
    })
  }, [navigate])

  const submitAnswer = useCallback(async (answer: string) => {
    // Store answer in state
    setGameState((prev) => ({
      ...prev,
      answers: [...prev.answers, answer],
    }))

    // TODO: Send answer to backend API
    // For now, just proceed to next phase
    return Promise.resolve()
  }, [])

  const submitFollowUpAnswer = useCallback(async (answer: string) => {
    // Store follow-up answer
    setGameState((prev) => ({
      ...prev,
      answers: [...prev.answers, answer],
    }))

    // TODO: Send follow-up answer to backend API
    // For now, just proceed to score display
    return Promise.resolve()
  }, [])

  const submitTechnicalTheoryAnswer = useCallback(async (answer: string, questionIndex: number) => {
    setGameState((prev) => {
      const newAnswers = [...prev.technicalTheoryAnswers]
      newAnswers[questionIndex] = answer
      return {
        ...prev,
        technicalTheoryAnswers: newAnswers,
        technicalTheoryCurrentIndex: questionIndex + 1,
      }
    })

    // TODO: Send answer to backend API
    return Promise.resolve()
  }, [])

  const submitTechnicalAnswer = useCallback(async (answer: string) => {
    setGameState((prev) => ({
      ...prev,
      answers: [...prev.answers, answer],
    }))

    // TODO: Send technical answer to backend API
    return Promise.resolve()
  }, [])

  return {
    gameState,
    setGameState,
    proceedToNextPhase,
    submitAnswer,
    submitFollowUpAnswer,
    submitTechnicalTheoryAnswer,
    submitTechnicalAnswer,
  }
}

