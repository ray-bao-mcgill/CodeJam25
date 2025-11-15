import { useEffect, useRef, useState, useCallback } from 'react'
import { useLobby } from './useLobby'
import { useLobbyWebSocket } from './useLobbyWebSocket'

export interface GameState {
  phase: string
  questionId?: string
  question?: string
  startTime?: number // Server timestamp in milliseconds
  serverTime?: number // Server's current time when message was sent
  submittedPlayers: string[]
  allPlayersSubmitted: boolean
  showResults: boolean
}

export function useGameSync() {
  const { lobbyId, playerId, lobby } = useLobby()
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<number>(180)
  const [hasStartTime, setHasStartTime] = useState<boolean>(false) // Track if we have a startTime
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const serverTimeOffsetRef = useRef<number>(0) // Offset between server and client time
  const localStartTimeRef = useRef<number | null>(null) // Local fallback start time
  const startTimeRef = useRef<number | null>(null) // Current start time (from server or local)
  const timerStartedRef = useRef<boolean>(false) // Track if timer has been started

  // Handle game messages from WebSocket
  const handleGameMessage = useCallback((message: any) => {
    // Handle game state messages
    if (message.type === 'game_state') {
      const state = message.state
      setGameState(state)
      
      // Calculate time remaining using server timestamp
      if (state.startTime && state.serverTime) {
        // Calculate server time offset
        const clientTime = Date.now()
        serverTimeOffsetRef.current = state.serverTime - clientTime
        
        // Calculate elapsed time on server
        const serverNow = Date.now() + serverTimeOffsetRef.current
        const elapsed = Math.floor((serverNow - state.startTime) / 1000)
        const remaining = Math.max(0, 180 - elapsed)
        setTimeRemaining(remaining)
      }
    } else if (message.type === 'question_start') {
      // New question started - use SERVER timestamp for synchronization
      const serverTimestamp = message.serverTime || Date.now()
      const questionStartTime = message.startTime || serverTimestamp
      
      // Calculate server time offset
      const clientTime = Date.now()
      serverTimeOffsetRef.current = serverTimestamp - clientTime
      localStartTimeRef.current = questionStartTime
      startTimeRef.current = questionStartTime
      timerStartedRef.current = false // Reset timer started flag
      setHasStartTime(true) // Trigger timer effect
      
      setGameState({
        phase: message.phase,
        questionId: message.questionId,
        question: message.question,
        startTime: questionStartTime,
        serverTime: serverTimestamp,
        submittedPlayers: [],
        allPlayersSubmitted: false,
        showResults: false
      })
      
      // Calculate initial time remaining
      const elapsed = Math.floor((serverTimestamp - questionStartTime) / 1000)
      const remaining = Math.max(0, 180 - elapsed)
      setTimeRemaining(remaining)
    } else if (message.type === 'player_submitted') {
      // Update submitted players list - BROADCAST from server
      console.log('Received player_submitted:', message.player_id, 'Current submitted:', gameState?.submittedPlayers)
      setGameState((prev) => {
        if (!prev) {
          // Initialize game state if it doesn't exist
          return {
            phase: 'unknown',
            submittedPlayers: [message.player_id],
            allPlayersSubmitted: false,
            showResults: false
          }
        }
        const newSubmitted = [...prev.submittedPlayers]
        if (!newSubmitted.includes(message.player_id)) {
          newSubmitted.push(message.player_id)
          console.log('Added player to submitted list:', message.player_id, 'Total:', newSubmitted.length)
        }
        const totalPlayers = lobby?.players.length || 0
        const allSubmitted = newSubmitted.length >= totalPlayers
        console.log('Submission status:', { submitted: newSubmitted.length, total: totalPlayers, allSubmitted })
        return {
          ...prev,
          submittedPlayers: newSubmitted,
          allPlayersSubmitted: allSubmitted,
          showResults: allSubmitted || message.forceShow
        }
      })
    } else if (message.type === 'show_results') {
      // Force show results (timer expired or all submitted)
      setGameState((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          showResults: true
        }
      })
    }
  }, [lobby?.players.length])

  // Reuse the existing lobby WebSocket connection
  const wsRef = useLobbyWebSocket({
    lobbyId: lobbyId || null,
    enabled: !!lobbyId,
    onLobbyUpdate: () => {}, // Handled elsewhere
    onGameStarted: () => {},
    onDisconnect: () => {},
    onKicked: () => {},
    currentPlayerId: playerId || null,
    onGameMessage: handleGameMessage, // Handle game sync messages
  })

  // Initialize timer when question page loads (fallback if no server message)
  useEffect(() => {
    // If we don't have a startTime from server, initialize with local time
    if (!startTimeRef.current && !localStartTimeRef.current) {
      const now = Date.now()
      localStartTimeRef.current = now
      startTimeRef.current = now
      timerStartedRef.current = false
      setHasStartTime(true) // Trigger timer effect
      setGameState((prev) => ({
        ...(prev || {
          phase: 'unknown',
          submittedPlayers: [],
          allPlayersSubmitted: false,
          showResults: false
        }),
        startTime: now
      }))
      console.log('Initialized local timer start time:', now)
    } else if (gameState?.startTime && gameState.startTime !== startTimeRef.current) {
      // Update ref when gameState.startTime changes
      startTimeRef.current = gameState.startTime
      timerStartedRef.current = false
      setHasStartTime(true) // Trigger timer effect
    }
  }, [gameState?.startTime])

  // Synchronized timer countdown using server time
  useEffect(() => {
    // Don't start timer if results are already shown
    if (gameState?.showResults) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      timerStartedRef.current = false
      return
    }

    // Check if we have a startTime (from server or local fallback)
    const startTime = startTimeRef.current
    if (!startTime || !hasStartTime) {
      // No start time yet, wait for initialization
      return
    }

    // Only start timer once per question
    if (timerStartedRef.current && timerRef.current) {
      return
    }

    // Clear any existing timer before starting a new one
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    timerStartedRef.current = true
    console.log('Starting timer with startTime:', startTime)

    // Use synchronized timer based on server time (or local fallback)
    timerRef.current = setInterval(() => {
      const currentStartTime = startTimeRef.current
      if (!currentStartTime) {
        return
      }

      // Calculate elapsed time using server time offset if available
      const serverNow = Date.now() + serverTimeOffsetRef.current
      const elapsed = Math.floor((serverNow - currentStartTime) / 1000)
      const remaining = Math.max(0, 180 - elapsed)
      
      setTimeRemaining(remaining)
      
      // If timer expired, clear interval and show results
      if (remaining === 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
        timerStartedRef.current = false
        // Trigger show results
        setGameState((prev) => ({
          ...(prev || {
            phase: 'unknown',
            submittedPlayers: [],
            allPlayersSubmitted: false,
            showResults: false
          }),
          showResults: true
        }))
        const ws = wsRef.current?.current
        if (ws && ws.readyState === WebSocket.OPEN) {
          // Timer expired, notify server
          ws.send(JSON.stringify({
            type: 'timer_expired',
            player_id: playerId
          }))
        }
      }
    }, 1000) // Update every second for timer display

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [hasStartTime, gameState?.showResults, playerId, wsRef])

  const submitAnswer = useCallback(async (answer: string, questionId?: string) => {
    if (!playerId) return

    console.log('Submitting answer for player:', playerId)

    // Update local state immediately to show "waiting for others"
    setGameState((prev) => {
      const newState = prev ? { ...prev } : {
        phase: 'unknown',
        questionId: questionId,
        submittedPlayers: [],
        allPlayersSubmitted: false,
        showResults: false
      }
      
      const newSubmitted = [...(newState.submittedPlayers || [])]
      if (!newSubmitted.includes(playerId)) {
        newSubmitted.push(playerId)
        console.log('Added self to submitted list. Total submitted:', newSubmitted.length, 'Total players:', lobby?.players.length)
      }
      
      const totalPlayers = lobby?.players.length || 0
      const allSubmitted = newSubmitted.length >= totalPlayers
      
      return {
        ...newState,
        submittedPlayers: newSubmitted,
        allPlayersSubmitted: allSubmitted,
        showResults: allSubmitted
      }
    })

    // Send to server via WebSocket (using the shared lobby WebSocket)
    // Server should broadcast this to all players
    const ws = wsRef.current?.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log('Sending submit_answer to server')
      ws.send(JSON.stringify({
        type: 'submit_answer',
        player_id: playerId,
        answer: answer,
        questionId: questionId || gameState?.questionId
      }))
    } else {
      console.warn('WebSocket not ready. State:', ws?.readyState)
    }
  }, [playerId, gameState?.questionId, lobby?.players.length, wsRef])

  return {
    gameState,
    timeRemaining,
    submitAnswer,
    isWaitingForOthers: gameState ? gameState.submittedPlayers.length < (lobby?.players.length || 0) && gameState.submittedPlayers.includes(playerId || '') : false,
    allPlayersSubmitted: gameState?.allPlayersSubmitted || false,
    showResults: gameState?.showResults || false
  }
}

