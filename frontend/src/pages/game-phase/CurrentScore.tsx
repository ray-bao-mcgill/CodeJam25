import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameFlow } from '@/hooks/useGameFlow'
import { useLobby } from '@/hooks/useLobby'
import { useLobbyWebSocket } from '@/hooks/useLobbyWebSocket'

const CurrentScore: React.FC = () => {
  const navigate = useNavigate()
  const { gameState, proceedToNextPhase } = useGameFlow()
  const { lobby, lobbyId, playerId } = useLobby()
  // Single source of truth for score state
  const [scoreState, setScoreState] = useState<{
    scores: Record<string, number>
    phaseScores: Record<string, number>
    isLoading: boolean
    waitingForSync: boolean
    scoresReceived: boolean
  }>({
    scores: {},
    phaseScores: {},
    isLoading: true,
    waitingForSync: true,
    scoresReceived: false
  })
  
  const [isVisible, setIsVisible] = useState(false)
  const [readyPlayers, setReadyPlayers] = useState<string[]>([])
  const [readyToContinuePlayers, setReadyToContinuePlayers] = useState<string[]>([])
  const [allReadyToContinue, setAllReadyToContinue] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<number>(7)
  
  // Determine phase from sessionStorage or gameState
  const getCurrentPhase = (): string => {
    // Check sessionStorage for current round
    const currentRound = sessionStorage.getItem('currentRound') || 'behavioural'
    
    if (currentRound === 'behavioural') {
      return 'behavioural_score'
    } else if (currentRound === 'technical-theory') {
      return 'technical_theory_score'
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
  
  // Phase-specific tracking to prevent cross-phase message issues
  const currentPhaseRef = useRef<string>(currentPhase)
  const hasSentReadyRef = useRef<Record<string, boolean>>({})
  const hasSentContinueRef = useRef<Record<string, boolean>>({})
  const scoresReceivedForPhaseRef = useRef<Record<string, boolean>>({})
  const lastScoresMessageRef = useRef<Record<string, { scores: Record<string, number>, phaseScores: Record<string, number>, timestamp: number }>>({})
  const prepareForScoresReceivedRef = useRef<Record<string, boolean>>({})
  const scoresReadyReceivedRef = useRef<Record<string, boolean>>({})
  const pendingScoresMessageRef = useRef<Record<string, any>>({})

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
      const messagePhase = message.phase || currentPhaseRef.current
      
      // Ignore messages from wrong phase (prevent cross-phase contamination)
      if (messagePhase !== currentPhaseRef.current) {
        console.log(`[SCORES] Ignoring message from wrong phase: ${messagePhase} (current: ${currentPhaseRef.current})`)
        return
      }
      
      if (message.type === 'player_ready_for_scores') {
        // Only process if for current phase
        if (messagePhase === currentPhaseRef.current) {
          setReadyPlayers((prev) => {
            const newReady = [...prev]
            if (!newReady.includes(message.player_id)) {
              newReady.push(message.player_id)
              console.log(`[SCORES] Player ready for scores (${messagePhase}):`, message.player_id, 'Total ready:', newReady.length)
            }
            return newReady
          })
        }
      } else if (message.type === 'prepare_for_scores') {
        // Server is preparing to send scores - wait for synchronization
        if (messagePhase === currentPhaseRef.current) {
          console.log(`[SCORES] Received prepare_for_scores for phase ${messagePhase}, waiting for synchronized scores...`)
          prepareForScoresReceivedRef.current[messagePhase] = true
          
          // Check if we already received scores_ready (due to network timing)
          if (pendingScoresMessageRef.current[messagePhase]) {
            console.log(`[SCORES] Found pending scores_ready message, processing now...`)
            const pendingMessage = pendingScoresMessageRef.current[messagePhase]
            delete pendingScoresMessageRef.current[messagePhase]
            // Process the pending message
            setTimeout(() => {
              // Trigger scores_ready handler logic
              const displayScores = () => {
                setScoreState({
                  scores: pendingMessage.scores || {},
                  phaseScores: pendingMessage.phase_scores || {},
                  isLoading: false,
                  waitingForSync: false,
                  scoresReceived: true
                })
                setTimeRemaining(7)
              }
              displayScores()
            }, 50)
          }
        }
      } else if (message.type === 'scores_ready') {
        // Server has calculated and is broadcasting synchronized scores
        // Guard against duplicate messages and wrong phase
        if (messagePhase !== currentPhaseRef.current) {
          console.log(`[SCORES] Ignoring scores_ready from wrong phase: ${messagePhase}`)
          return
        }
        
        // If synchronized flag is set, ensure we received prepare_for_scores first
        if (message.synchronized && !prepareForScoresReceivedRef.current[messagePhase]) {
          console.log(`[SCORES] Received synchronized scores_ready but didn't receive prepare_for_scores yet, storing for later...`)
          // Store the message but don't display yet - will be processed when prepare_for_scores arrives
          pendingScoresMessageRef.current[messagePhase] = message
          scoresReadyReceivedRef.current[messagePhase] = true
          return
        }
        
        // Check if we already received scores for this phase
        if (scoresReceivedForPhaseRef.current[messagePhase]) {
          console.log(`[SCORES] Already received scores for phase ${messagePhase}, ignoring duplicate`)
          return
        }
        
        // Validate scores data
        if (!message.scores || Object.keys(message.scores).length === 0) {
          console.warn(`[SCORES] Received scores_ready but scores are empty for phase ${messagePhase}`)
          return
        }
        
        // Check for duplicate message (same scores data)
        const lastMessage = lastScoresMessageRef.current[messagePhase]
        const messageTimestamp = message.serverTime || Date.now()
        if (lastMessage && 
            JSON.stringify(lastMessage.scores) === JSON.stringify(message.scores) &&
            messageTimestamp - lastMessage.timestamp < 1000) {
          console.log(`[SCORES] Duplicate scores_ready message detected for phase ${messagePhase}, ignoring`)
          return
        }
        
        console.log(`[SCORES] Received synchronized scores for phase ${messagePhase}:`, message.scores)
        console.log(`[SCORES] Phase scores (round-specific):`, message.phase_scores)
        console.log(`[SCORES] Synchronized flag:`, message.synchronized)
        
        // Store message timestamp for deduplication
        lastScoresMessageRef.current[messagePhase] = {
          scores: message.scores,
          phaseScores: message.phase_scores || {},
          timestamp: messageTimestamp
        }
        
        // Mark scores as received for this phase
        scoresReceivedForPhaseRef.current[messagePhase] = true
        scoresReadyReceivedRef.current[messagePhase] = true
        
        // If synchronized, add a small delay to ensure all clients are ready to display
        // This ensures all clients display scores at approximately the same time
        const displayScores = () => {
          // Update state atomically
          setScoreState({
            scores: message.scores || {},
            phaseScores: message.phase_scores || {},
            isLoading: false,
            waitingForSync: false,
            scoresReceived: true
          })
          
          // Reset timer when scores are shown
          setTimeRemaining(7)
        }
        
        if (message.synchronized) {
          // Small delay to synchronize display across all clients
          // This ensures all clients receive the message before any display
          setTimeout(displayScores, 50)
        } else {
          // Not synchronized, display immediately (backward compatibility)
          displayScores()
        }
      } else if (message.type === 'show_scores') {
        // Server says all players are ready, show scores
        if (messagePhase === currentPhaseRef.current) {
          setScoreState(prev => ({
            ...prev,
            waitingForSync: false
          }))
        }
      } else if (message.type === 'game_end') {
        // Game has ended - navigate after showing final scores
        console.log('Game ended! Rankings:', message.rankings)
        console.log('Final scores:', message.final_scores)
        
        if (message.rankings && playerId) {
          // Find current player's rank and score
          const playerRanking = message.rankings.find((r: any) => r.player_id === playerId)
          if (playerRanking) {
            const rank = playerRanking.rank
            const score = playerRanking.score
            console.log(`[GAME_END] Player ${playerId} rank: ${rank}, score: ${score}`)
            // Wait for final score display (7 seconds timer) then navigate to WinLose page
            setTimeout(() => {
              navigate(`/win-lose?score=${score}&rank=${rank}`)
            }, 8000) // Wait 8 seconds to allow final score display
          }
        }
      } else if (message.type === 'player_ready_to_continue') {
        // Player clicked continue button - only process if for current phase
        if (messagePhase === currentPhaseRef.current) {
          setReadyToContinuePlayers((prev) => {
            const newReady = [...prev]
            if (!newReady.includes(message.player_id)) {
              newReady.push(message.player_id)
              console.log(`[SCORES] Player ready to continue (${messagePhase}):`, message.player_id, 'Total:', newReady.length)
            }
            return newReady
          })
        }
      } else if (message.type === 'all_ready_to_continue') {
        // All players clicked continue - navigate (only if for current phase)
        if (messagePhase === currentPhaseRef.current) {
          setAllReadyToContinue(true)
          console.log(`[SCORES] All players ready to continue for phase ${messagePhase}, navigating...`)
        }
      } else if (message.type === 'phase_changed') {
        console.log(`[SCORES] Phase changed to: ${message.phase}`)
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

  // Update phase ref when phase changes
  useEffect(() => {
    currentPhaseRef.current = currentPhase
  }, [currentPhase])
  
  // Reset state when phase changes - ensure clean slate
  useEffect(() => {
    console.log(`[SCORES] Phase changed to: ${currentPhase}, resetting state`)
    setReadyToContinuePlayers([])
    setAllReadyToContinue(false)
    setReadyPlayers([])
    setScoreState({
      scores: {},
      phaseScores: {},
      isLoading: true,
      waitingForSync: true,
      scoresReceived: false
    })
    // Reset phase-specific flags
    hasSentReadyRef.current[currentPhase] = false
    hasSentContinueRef.current[currentPhase] = false
    scoresReceivedForPhaseRef.current[currentPhase] = false
    prepareForScoresReceivedRef.current[currentPhase] = false
    scoresReadyReceivedRef.current[currentPhase] = false
    delete pendingScoresMessageRef.current[currentPhase]
    setTimeRemaining(7)
  }, [currentPhase])
  
  // 7-second timer after scores are shown
  useEffect(() => {
    if (!scoreState.waitingForSync && 
        !scoreState.isLoading && 
        scoreState.scoresReceived && 
        Object.keys(scoreState.scores).length > 0) {
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
  }, [scoreState.waitingForSync, scoreState.isLoading, scoreState.scoresReceived, scoreState.scores])

  // Send "ready for scores" message when component mounts or phase changes
  useEffect(() => {
    const phaseKey = currentPhase
    if (lobbyId && playerId && !hasSentReadyRef.current[phaseKey]) {
      const sendReadyMessage = () => {
        const ws = wsRef.current
        if (ws && ws.readyState === WebSocket.OPEN) {
          console.log(`[SCORES] Sending ready_for_scores message for phase: ${phaseKey}`)
          ws.send(JSON.stringify({
            type: 'ready_for_scores',
            player_id: playerId,
            lobby_id: lobbyId,
            phase: phaseKey
          }))
          hasSentReadyRef.current[phaseKey] = true
          // Add self to ready players immediately
          setReadyPlayers((prev) => {
            if (!prev.includes(playerId)) {
              return [...prev, playerId]
            }
            return prev
          })
          return true
        }
        return false
      }
      
      if (sendReadyMessage()) {
        return
      }
      
      // Retry if WebSocket not ready
      const retryTimer = setTimeout(() => {
        if (!hasSentReadyRef.current[phaseKey]) {
          sendReadyMessage()
        }
      }, 500)
      return () => clearTimeout(retryTimer)
    }
  }, [lobbyId, playerId, currentPhase, wsRef])

  // Check if all players are ready (fallback - server will send scores_ready when all ready)
  useEffect(() => {
    const totalPlayers = lobby?.players.length || 0
    const allReady = totalPlayers > 0 && readyPlayers.length >= totalPlayers
    
    // Only use fallback if we don't have scores yet and all players are ready
    if (allReady && !scoreState.scoresReceived && Object.keys(scoreState.scores).length === 0) {
      console.log(`[SCORES] All players ready (${readyPlayers.length}/${totalPlayers}) but no scores received yet. Waiting for server...`)
      // Don't generate random scores - wait for server to send synchronized scores
      // Server will send 'scores_ready' message when all players are ready
    } else if (scoreState.scoresReceived && Object.keys(scoreState.scores).length > 0) {
      // We have scores, ensure state is correct
      if (scoreState.waitingForSync || scoreState.isLoading) {
        setScoreState(prev => ({
          ...prev,
          waitingForSync: false,
          isLoading: false
        }))
      }
    } else {
      console.log(`[SCORES] Waiting for players: ${readyPlayers.length}/${totalPlayers} ready`)
    }
  }, [readyPlayers, lobby?.players.length, scoreState.scoresReceived, scoreState.scores, scoreState.waitingForSync, scoreState.isLoading])

  // Navigate when all players are ready to continue
  useEffect(() => {
    if (allReadyToContinue && 
        !scoreState.waitingForSync && 
        !scoreState.isLoading && 
        scoreState.scoresReceived &&
        Object.keys(scoreState.scores).length > 0) {
      const phase = currentPhase
      console.log(`[SCORES] All players ready, navigating from phase: ${phase}`)
      
      setTimeout(() => {
        if (phase === 'behavioural_score') {
          sessionStorage.setItem('currentRound', 'technical-theory')
          navigate('/round-start-counter/technical-theory')
        } else if (phase === 'technical_theory_score') {
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
  }, [allReadyToContinue, scoreState.waitingForSync, scoreState.isLoading, scoreState.scoresReceived, scoreState.scores, currentPhase, navigate, proceedToNextPhase])

  const handleContinue = useCallback(() => {
    // Send "ready to continue" message to server (phase-specific)
    const phaseKey = currentPhase
    if (!hasSentContinueRef.current[phaseKey] && lobbyId && playerId) {
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        console.log(`[SCORES] Sending ready_to_continue message for phase: ${phaseKey}`)
        ws.send(JSON.stringify({
          type: 'ready_to_continue',
          player_id: playerId,
          lobby_id: lobbyId,
          phase: phaseKey
        }))
        hasSentContinueRef.current[phaseKey] = true
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

  if (scoreState.waitingForSync || scoreState.isLoading) {
    const totalPlayers = lobby?.players.length || 0
    const readyCount = readyPlayers.length
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 game-bg">
        <div className="game-paper px-8 py-6 game-shadow-hard-lg">
          <div className="text-center space-y-4">
            <div className="text-2xl font-black mb-4">WAITING FOR OTHER PLAYERS...</div>
            <div className="text-lg">
              {scoreState.waitingForSync 
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
    ? [...lobby.players].sort((a, b) => (scoreState.scores[b.id] || 0) - (scoreState.scores[a.id] || 0))
    : []

  const getPhaseTitle = () => {
    switch (currentPhase) {
      case 'behavioural_score':
        return 'BEHAVIOURAL ROUND SCORES'
      case 'technical_theory_score':
        return 'TECHNICAL THEORY ROUND SCORES'
      case 'technical_score':
        return 'TECHNICAL ROUND SCORES'
      default:
        return 'CURRENT SCORES'
    }
  }

  // VS-style results page (for 2 players)
  if (sortedPlayers.length === 2 && 
      !scoreState.waitingForSync && 
      !scoreState.isLoading && 
      scoreState.scoresReceived &&
      Object.keys(scoreState.scores).length > 0) {
    const player1 = sortedPlayers[0]
    const player2 = sortedPlayers[1]
    const score1 = scoreState.scores[player1.id] || 0
    const score2 = scoreState.scores[player2.id] || 0
    
    return (
      <div className="flex items-center justify-center min-h-screen game-bg relative overflow-hidden">
        {/* Continuous Vertical Line - perfectly centered */}
        <div className="absolute top-0 bottom-0 left-1/2 w-2 bg-[var(--game-text-primary)] transform -translate-x-1/2 shadow-[2px_2px_0px_rgba(0,0,0,0.3)]" />
        
        {/* Title at top - absolute positioning */}
        <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-10">
          <div className="game-label-text text-3xl game-shadow-hard">
            {getPhaseTitle()}
          </div>
        </div>

        {/* Bottom loading indicator - absolute positioning */}
        {(readyToContinuePlayers.length > 0 || timeRemaining > 0) && (
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
            <div className="game-label-text text-xl game-shadow-hard-sm animate-pulse">
              {readyToContinuePlayers.length > 0 
                ? `WAITING FOR PLAYERS... (${readyToContinuePlayers.length} / ${lobby?.players.length || 0})`
                : timeRemaining > 0
                  ? `AUTO-ADVANCING IN ${timeRemaining}S...`
                  : 'NEXT ROUND STARTING SOON...'}
            </div>
          </div>
        )}

        {/* Main VS Content - Perfectly Centered */}
        <div className="relative z-10 flex items-center justify-between w-full max-w-[1600px] px-16">
          {/* Player 1 Score - Left Side */}
          <div className="flex flex-col items-center animate-stamp-in" style={{ animationDelay: '0.2s' }}>
            <div className="game-label-text text-lg mb-3 game-shadow-hard-sm bg-[var(--game-blue)] px-4 py-1 text-white">
              {player1.name.toUpperCase()}{player1.id === playerId && ' (ME)'}
            </div>
            <div className="px-10 py-7 game-sharp game-shadow-hard-lg border-6 border-[var(--game-blue)] bg-gradient-to-br from-blue-100 to-blue-200 score-display">
              <div 
                className="text-6xl font-black text-[var(--game-blue)] leading-none"
                style={{ fontFamily: 'Impact, sans-serif' }}
              >
                {score1}
              </div>
            </div>
            {/* Round Score Increase Display */}
            {scoreState.phaseScores[player1.id] > 0 && (
              <div className="mt-3 px-4 py-2 bg-green-500 text-white rounded-md text-lg font-bold">
                +{scoreState.phaseScores[player1.id]}
              </div>
            )}
          </div>

          {/* VS in Circle - perfectly centered on the line */}
          <div className="flex items-center justify-center absolute left-1/2 transform -translate-x-1/2 animate-stamp-in-vs" style={{ animationDelay: '0.6s' }}>
            {/* VS Text in Circle */}
            <div className="rounded-full flex items-center justify-center w-[180px] h-[180px] bg-gradient-to-br from-yellow-300 via-[var(--game-yellow)] to-orange-400 border-[10px] border-[var(--game-text-primary)] shadow-[10px_10px_0px_rgba(0,0,0,0.4)]">
              <div className="text-[5rem] font-black text-[var(--game-text-primary)] leading-none drop-shadow-lg" style={{ fontFamily: 'Impact, sans-serif' }}>
                VS
              </div>
            </div>
          </div>

          {/* Player 2 Score - Right Side */}
          <div className="flex flex-col items-center animate-stamp-in" style={{ animationDelay: '0.4s' }}>
            <div className="game-label-text text-lg mb-3 game-shadow-hard-sm bg-[var(--game-red)] px-4 py-1 text-white">
              {player2.name.toUpperCase()}{player2.id === playerId && ' (ME)'}
            </div>
            <div className="px-10 py-7 game-sharp game-shadow-hard-lg border-6 border-[var(--game-red)] bg-gradient-to-br from-red-100 to-red-200 score-display">
              <div 
                className="text-6xl font-black text-[var(--game-red)] leading-none"
                style={{ fontFamily: 'Impact, sans-serif' }}
              >
                {score2}
              </div>
            </div>
            {/* Round Score Increase Display */}
            {scoreState.phaseScores[player2.id] > 0 && (
              <div className="mt-3 px-4 py-2 bg-green-500 text-white rounded-md text-lg font-bold">
                +{scoreState.phaseScores[player2.id]}
              </div>
            )}
          </div>
        </div>


        {/* Continue Button - positioned at bottom */}
        <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-10">
          <button
            onClick={handleContinue}
            disabled={hasSentContinueRef.current[currentPhase] || scoreState.waitingForSync || scoreState.isLoading}
            className={`game-sharp px-10 py-5 text-lg font-black uppercase tracking-widest game-shadow-hard-lg ${
              hasSentContinueRef.current[currentPhase] || scoreState.waitingForSync || scoreState.isLoading ? '' : 'game-button-hover'
            }`}
            style={{
              border: '6px solid var(--game-text-primary)',
              backgroundColor: (hasSentContinueRef.current[currentPhase] || scoreState.waitingForSync || scoreState.isLoading) ? 'var(--game-bg-alt)' : 'var(--game-green)',
              color: (hasSentContinueRef.current[currentPhase] || scoreState.waitingForSync || scoreState.isLoading) ? 'var(--game-text-dim)' : 'var(--game-text-white)',
              cursor: (hasSentContinueRef.current[currentPhase] || scoreState.waitingForSync || scoreState.isLoading) ? 'not-allowed' : 'pointer',
              opacity: (hasSentContinueRef.current[currentPhase] || scoreState.waitingForSync || scoreState.isLoading) ? 0.6 : 1
            }}
          >
            {hasSentContinueRef.current[currentPhase] 
              ? 'WAITING FOR OTHERS...' 
              : scoreState.waitingForSync || scoreState.isLoading
                ? 'LOADING SCORES...'
                : currentPhase === 'technical_score' 
                  ? 'VIEW RESULTS' 
                  : 'CONTINUE'}
          </button>
        </div>
      </div>
    )
  }

  // Fallback to list view for non-2-player games
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
            const score = scoreState.scores[player.id] || 0
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
                    <div className="text-xl font-bold">
                      {player.name}
                      {player.id === playerId && <span className="ml-2 text-base opacity-75">(me)</span>}
                    </div>
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
          {!scoreState.waitingForSync && !scoreState.isLoading && scoreState.scoresReceived && Object.keys(scoreState.scores).length > 0 && (
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
            disabled={hasSentContinueRef.current[currentPhase] || scoreState.waitingForSync || scoreState.isLoading}
            className={`game-sharp px-10 py-5 text-lg font-black uppercase tracking-widest game-shadow-hard-lg ${
              hasSentContinueRef.current[currentPhase] || scoreState.waitingForSync || scoreState.isLoading ? '' : 'game-button-hover'
            }`}
            style={{
              border: '6px solid var(--game-text-primary)',
              backgroundColor: (hasSentContinueRef.current[currentPhase] || scoreState.waitingForSync || scoreState.isLoading) ? 'var(--game-bg-alt)' : 'var(--game-green)',
              color: (hasSentContinueRef.current[currentPhase] || scoreState.waitingForSync || scoreState.isLoading) ? 'var(--game-text-dim)' : 'var(--game-text-white)',
              cursor: (hasSentContinueRef.current[currentPhase] || scoreState.waitingForSync || scoreState.isLoading) ? 'not-allowed' : 'pointer',
              opacity: (hasSentContinueRef.current[currentPhase] || scoreState.waitingForSync || scoreState.isLoading) ? 0.6 : 1
            }}
          >
            {hasSentContinueRef.current[currentPhase] 
              ? 'WAITING FOR OTHERS...' 
              : scoreState.waitingForSync || scoreState.isLoading
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
