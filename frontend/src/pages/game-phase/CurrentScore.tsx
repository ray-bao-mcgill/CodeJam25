import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameFlow } from '@/hooks/useGameFlow'
import { useLobby } from '@/hooks/useLobby'
import { useGameSync } from '@/hooks/useGameSync'
import { useLobbyWebSocket } from '@/hooks/useLobbyWebSocket'

const CurrentScore: React.FC = () => {
  const navigate = useNavigate()
  const { gameState, proceedToNextPhase } = useGameFlow()
  const { lobby, lobbyId, playerId } = useLobby()
  const { showResults: syncShowResults } = useGameSync()
  const [scores, setScores] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isVisible, setIsVisible] = useState(false)
  const [waitingForSync, setWaitingForSync] = useState(true)
  const [readyPlayers, setReadyPlayers] = useState<string[]>([])
  const [readyToContinuePlayers, setReadyToContinuePlayers] = useState<string[]>([])
  const [allReadyToContinue, setAllReadyToContinue] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<number>(7)
  const hasSentReadyRef = useRef(false)
  const hasSentContinueRef = useRef(false)
  const scoresShownRef = useRef(false)
  
  // Determine phase from sessionStorage or gameState
  const getCurrentPhase = (): string => {
    // Check sessionStorage for current round
    const currentRound = sessionStorage.getItem('currentRound') || 'behavioural'
    
    if (currentRound === 'behavioural') {
      return 'behavioural_score'
    } else if (currentRound === 'quickfire') {
      return 'quickfire_score'
    } else if (currentRound === 'technical') {
      return 'technical_score'
    }
    
    // Fallback to gameState (with null check)
    if (gameState && gameState.phase && gameState.phase.includes('score')) {
      return gameState.phase
    }
    
    return 'behavioural_score'
  }
  
  const currentPhase = getCurrentPhase()

  // Set up WebSocket for score synchronization
  const wsRef = useLobbyWebSocket({
    lobbyId: lobbyId || null,
    enabled: !!lobbyId,
    onLobbyUpdate: () => {},
    onGameStarted: () => {},
    onDisconnect: () => {},
    onKicked: () => {},
    currentPlayerId: playerId || null,
    onGameMessage: (message: any) => {
      if (message.type === 'player_ready_for_scores') {
        setReadyPlayers((prev) => {
          const newReady = [...prev]
          if (!newReady.includes(message.player_id)) {
            newReady.push(message.player_id)
            console.log('Player ready for scores:', message.player_id, 'Total ready:', newReady.length)
          }
          return newReady
        })
      } else if (message.type === 'scores_ready') {
        // Server has calculated and is broadcasting synchronized scores
        // ONLY show scores when ALL players are ready (no race conditions)
        console.log('Received synchronized scores from server:', message.scores)
        if (message.scores && Object.keys(message.scores).length > 0 && !scoresShownRef.current) {
          setScores(message.scores)
          setWaitingForSync(false)
          setIsLoading(false)
          scoresShownRef.current = true
          // Reset timer when scores are shown
          setTimeRemaining(7)
        }
      } else if (message.type === 'show_scores') {
        // Server says all players are ready, show scores
        setWaitingForSync(false)
      } else if (message.type === 'player_ready_to_continue') {
        // Player clicked continue button
        setReadyToContinuePlayers((prev) => {
          const newReady = [...prev]
          if (!newReady.includes(message.player_id)) {
            newReady.push(message.player_id)
            console.log('Player ready to continue:', message.player_id, 'Total:', newReady.length)
          }
          return newReady
        })
      } else if (message.type === 'all_ready_to_continue') {
        // All players clicked continue - navigate
        setAllReadyToContinue(true)
        console.log('All players ready to continue, navigating...')
      } else if (message.type === 'phase_changed') {
        console.log('Phase changed to:', message.phase)
      }
    },
  })

  useEffect(() => {
    setIsVisible(false)
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, 10)
    return () => clearTimeout(timer)
  }, [])

  // Reset continue state when phase changes
  useEffect(() => {
    setReadyToContinuePlayers([])
    setAllReadyToContinue(false)
    setScores({})
    setWaitingForSync(true)
    setIsLoading(true)
    hasSentReadyRef.current = false
    hasSentContinueRef.current = false
    scoresShownRef.current = false
    setTimeRemaining(7)
  }, [currentPhase])
  
  // 7-second timer after scores are shown
  useEffect(() => {
    if (!waitingForSync && !isLoading && Object.keys(scores).length > 0 && scoresShownRef.current) {
      const interval = setInterval(() => {
        setTimeRemaining((prev) => {
          const newTime = prev - 1
          if (newTime <= 0) {
            clearInterval(interval)
          }
          return newTime
        })
      }, 1000)
      
      return () => clearInterval(interval)
    }
  }, [waitingForSync, isLoading, scores])

  // Send "ready for scores" message when component mounts
  useEffect(() => {
    if (lobbyId && playerId && !hasSentReadyRef.current) {
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        console.log('Sending ready_for_scores message for phase:', currentPhase)
        ws.send(JSON.stringify({
          type: 'ready_for_scores',
          player_id: playerId,
          lobby_id: lobbyId,
          phase: currentPhase
        }))
        hasSentReadyRef.current = true
        // Add self to ready players immediately
        setReadyPlayers((prev) => {
          if (!prev.includes(playerId)) {
            return [...prev, playerId]
          }
          return prev
        })
      } else {
        // Retry if WebSocket not ready
        const retryTimer = setTimeout(() => {
          const retryWs = wsRef.current
          if (retryWs && retryWs.readyState === WebSocket.OPEN && !hasSentReadyRef.current) {
            retryWs.send(JSON.stringify({
              type: 'ready_for_scores',
              player_id: playerId,
              lobby_id: lobbyId,
              phase: currentPhase
            }))
            hasSentReadyRef.current = true
            setReadyPlayers((prev) => {
              if (!prev.includes(playerId)) {
                return [...prev, playerId]
              }
              return prev
            })
          }
        }, 500)
        return () => clearTimeout(retryTimer)
      }
    }
  }, [lobbyId, playerId, currentPhase, wsRef])

  // Check if all players are ready (fallback - server will send scores_ready when all ready)
  useEffect(() => {
    const totalPlayers = lobby?.players.length || 0
    const allReady = totalPlayers > 0 && readyPlayers.length >= totalPlayers
    
    // Only use fallback if we don't have scores yet and all players are ready
    if ((allReady || syncShowResults) && Object.keys(scores).length === 0) {
      console.log('All players ready but no scores received yet. Waiting for server...')
      // Don't generate random scores - wait for server to send synchronized scores
      // Server will send 'scores_ready' message when all players are ready
    } else if (Object.keys(scores).length > 0) {
      // We have scores, show them
      setWaitingForSync(false)
      setIsLoading(false)
    } else {
      console.log(`Waiting for players: ${readyPlayers.length}/${totalPlayers} ready`)
    }
  }, [readyPlayers, lobby?.players.length, syncShowResults, scores])

  // Navigate when all players are ready to continue
  useEffect(() => {
    if (allReadyToContinue && !waitingForSync && !isLoading && Object.keys(scores).length > 0) {
      const phase = currentPhase
      console.log('All players ready, navigating from phase:', phase)
      
      setTimeout(() => {
        if (phase === 'behavioural_score') {
          sessionStorage.setItem('currentRound', 'quickfire')
          navigate('/round-start-counter/technical-theory')  // technical-theory IS quickfire
        } else if (phase === 'quickfire_score') {
          sessionStorage.setItem('currentRound', 'technical')
          navigate('/round-start-counter/technical-practical')
        } else if (phase === 'technical_score') {
          sessionStorage.removeItem('currentRound')
          navigate('/win-lose')
        } else {
          proceedToNextPhase()
        }
      }, 500)
    }
  }, [allReadyToContinue, waitingForSync, isLoading, scores, currentPhase, navigate, proceedToNextPhase])

  const handleContinue = useCallback(() => {
    // Send "ready to continue" message to server
    if (!hasSentContinueRef.current && lobbyId && playerId) {
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        console.log('Sending ready_to_continue message for phase:', currentPhase)
        ws.send(JSON.stringify({
          type: 'ready_to_continue',
          player_id: playerId,
          lobby_id: lobbyId,
          phase: currentPhase
        }))
        hasSentContinueRef.current = true
        // Add self to ready players immediately
        setReadyToContinuePlayers((prev) => {
          if (!prev.includes(playerId)) {
            return [...prev, playerId]
          }
          return prev
        })
      }
    }
  }, [currentPhase, lobbyId, playerId, wsRef])

  if (waitingForSync || isLoading) {
    const totalPlayers = lobby?.players.length || 0
    const readyCount = readyPlayers.length
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 game-bg">
        <div className="game-paper px-8 py-6 game-shadow-hard-lg">
          <div className="text-center space-y-4">
            <div className="text-2xl font-black mb-4">WAITING FOR OTHER PLAYERS...</div>
            <div className="text-lg">
              {waitingForSync 
                ? 'Synchronizing results with other players...' 
                : 'Calculating scores...'}
            </div>
            {lobby?.players && (
              <div className="text-sm text-gray-600 mt-4">
                <div className="text-lg font-bold mb-2">
                  {readyCount} / {totalPlayers} players ready
                </div>
                <div className="text-xs">
                  {readyCount < totalPlayers 
                    ? `Waiting for ${totalPlayers - readyCount} more player${totalPlayers - readyCount === 1 ? '' : 's'}...`
                    : 'All players ready!'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Sort players by score (descending)
  const sortedPlayers = lobby?.players
    ? [...lobby.players].sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0))
    : []

  const getPhaseTitle = () => {
    switch (currentPhase) {
      case 'behavioural_score':
        return 'BEHAVIOURAL ROUND SCORES'
      case 'quickfire_score':
        return 'QUICK FIRE ROUND SCORES'
      case 'technical_score':
        return 'TECHNICAL ROUND SCORES'
      default:
        return 'CURRENT SCORES'
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 game-bg">
      <div
        className="w-full max-w-4xl space-y-8"
        style={{
          transform: isVisible ? 'scale(1)' : 'scale(0.8)',
          opacity: isVisible ? 1 : 0,
          transition: 'transform 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55), opacity 0.6s ease-out'
        }}
      >
        {/* Title */}
        <div className="text-center">
          <div className="game-paper px-8 py-4 game-shadow-hard-lg game-hand-drawn inline-block">
            <h1 className="game-title text-3xl sm:text-4xl">{getPhaseTitle()}</h1>
          </div>
        </div>

        {/* Scores */}
        <div className="space-y-4">
          {sortedPlayers.map((player, index) => {
            const score = scores[player.id] || 0
            const isWinner = index === 0 && sortedPlayers.length > 1
            return (
              <div
                key={player.id}
                className={`game-paper px-6 py-5 game-shadow-hard-lg ${
                  isWinner ? 'game-block-yellow' : ''
                }`}
                style={{
                  border: '4px solid var(--game-text-primary)',
                  transform: `rotate(${index % 2 === 0 ? '-0.5deg' : '0.5deg'})`,
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-2xl font-black">#{index + 1}</div>
                    <div className="text-xl font-bold">{player.name}</div>
                    {isWinner && <span className="text-xl">👑</span>}
                  </div>
                  <div className="text-3xl font-black">{score}</div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Continue Button */}
        <div className="flex flex-col items-center gap-4">
          {/* 7-second timer */}
          {!waitingForSync && !isLoading && Object.keys(scores).length > 0 && (
            <div className="text-sm text-gray-600">
              Auto-advancing in {timeRemaining} second{timeRemaining !== 1 ? 's' : ''}...
            </div>
          )}
          
          {readyToContinuePlayers.length > 0 && (
            <div className="game-paper px-6 py-4 game-shadow-hard-lg">
              <div className="text-center">
                <div className="game-label-text text-sm mb-2">WAITING FOR OTHER PLAYERS</div>
                <div className="text-lg font-bold">
                  {readyToContinuePlayers.length} / {lobby?.players.length || 0} players ready
                </div>
                {readyToContinuePlayers.length < (lobby?.players.length || 0) && (
                  <div className="text-sm text-gray-600 mt-2">
                    Waiting for {lobby && lobby.players ? lobby.players.length - readyToContinuePlayers.length : 0} more player{lobby && lobby.players && (lobby.players.length - readyToContinuePlayers.length) !== 1 ? 's' : ''}...
                  </div>
                )}
              </div>
            </div>
          )}
          <button
            onClick={handleContinue}
            disabled={hasSentContinueRef.current || waitingForSync || isLoading}
            className={`game-sharp px-10 py-5 text-lg font-black uppercase tracking-widest game-shadow-hard-lg ${
              hasSentContinueRef.current || waitingForSync || isLoading ? '' : 'game-button-hover'
            }`}
            style={{
              border: '6px solid var(--game-text-primary)',
              backgroundColor: (hasSentContinueRef.current || waitingForSync || isLoading) ? 'var(--game-bg-alt)' : 'var(--game-green)',
              color: (hasSentContinueRef.current || waitingForSync || isLoading) ? 'var(--game-text-dim)' : 'var(--game-text-white)',
              cursor: (hasSentContinueRef.current || waitingForSync || isLoading) ? 'not-allowed' : 'pointer',
              opacity: (hasSentContinueRef.current || waitingForSync || isLoading) ? 0.6 : 1
            }}
          >
            {hasSentContinueRef.current 
              ? 'WAITING FOR OTHERS...' 
              : waitingForSync || isLoading
                ? 'LOADING SCORES...'
                : currentPhase === 'technical_score' 
                  ? 'VIEW RESULTS' 
                  : 'CONTINUE'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CurrentScore
