import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameFlow } from '@/hooks/useGameFlow'
import { useLobby } from '@/hooks/useLobby'
import { useLobbyWebSocket } from '@/hooks/useLobbyWebSocket'

const CurrentScore: React.FC = () => {
  const navigate = useNavigate()
  const { gameState, proceedToNextPhase } = useGameFlow()
  const { lobby, lobbyId, playerId } = useLobby()
  
  // Determine current phase
  const getCurrentPhase = (): string => {
    const currentRound = sessionStorage.getItem('currentRound') || 'behavioural'
    if (currentRound === 'behavioural') return 'behavioural_score'
    if (currentRound === 'technical-theory') return 'technical_theory_score'
    if (currentRound === 'technical') return 'technical_score'
    if (gameState?.phase?.includes('score')) return gameState.phase
    return 'behavioural_score'
  }
  
  const [currentPhase, setCurrentPhase] = useState<string>(getCurrentPhase())
  const [scores, setScores] = useState<Record<string, number>>({})
  const [phaseScores, setPhaseScores] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [readyCount, setReadyCount] = useState(0)
  const [readyToContinueCount, setReadyToContinueCount] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(7)
  const [isVisible, setIsVisible] = useState(false)
  
  // Track what we've sent to prevent duplicates
  const hasSentReadyRef = useRef<Record<string, boolean>>({})
  const hasSentContinueRef = useRef<Record<string, boolean>>({})
  const scoresReceivedRef = useRef<Record<string, boolean>>({})
  const currentPhaseRef = useRef<string>(currentPhase)
  
  // Update phase ref when phase changes
  useEffect(() => {
    const newPhase = getCurrentPhase()
    if (newPhase !== currentPhaseRef.current) {
      console.log(`[SCORES] Phase changed: ${currentPhaseRef.current} -> ${newPhase}`)
      currentPhaseRef.current = newPhase
      setCurrentPhase(newPhase)
      // Reset state for new phase
      setIsLoading(true)
      setScores({})
      setPhaseScores({})
      setReadyCount(0)
      setReadyToContinueCount(0)
      setTimeRemaining(7)
      hasSentReadyRef.current[newPhase] = false
      hasSentContinueRef.current[newPhase] = false
      scoresReceivedRef.current[newPhase] = false
    }
  }, [gameState?.phase])
  
  // Set up WebSocket
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
      
      // Only process messages for current phase
      if (messagePhase !== currentPhaseRef.current) {
        return
      }
      
      switch (message.type) {
        case 'player_ready_for_scores':
          setReadyCount(message.ready_count || 0)
          break
          
        case 'scores_ready':
          if (!scoresReceivedRef.current[messagePhase] && message.scores) {
            console.log(`[SCORES] Received scores for ${messagePhase}:`, message.scores)
            scoresReceivedRef.current[messagePhase] = true
            setScores(message.scores || {})
            setPhaseScores(message.phase_scores || {})
            setIsLoading(false)
            setTimeRemaining(7)
          }
          break
          
        case 'player_ready_to_continue':
          setReadyToContinueCount(message.ready_count || 0)
          break
          
        case 'all_ready_to_continue':
          // All players ready - navigate to next phase
          handleNavigateToNext()
          break
          
        case 'game_end':
          if (message.rankings && playerId) {
            const playerRanking = message.rankings.find((r: any) => r.player_id === playerId)
            if (playerRanking) {
              setTimeout(() => {
                navigate(`/win-lose?score=${playerRanking.score}&rank=${playerRanking.rank}`)
              }, 8000)
            }
          }
          break
      }
    },
  })
  
  // Send ready_for_scores when component mounts or phase changes
  useEffect(() => {
    if (!lobbyId || !playerId || !wsRef.current) return
    
    const phase = currentPhaseRef.current
    if (hasSentReadyRef.current[phase]) return
    
    const sendReady = () => {
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        console.log(`[SCORES] Sending ready_for_scores for ${phase}`)
        ws.send(JSON.stringify({
          type: 'ready_for_scores',
          player_id: playerId,
          lobby_id: lobbyId,
          phase: phase
        }))
        hasSentReadyRef.current[phase] = true
        return true
      }
      return false
    }
    
    if (!sendReady()) {
      const retry = setInterval(() => {
        if (sendReady()) {
          clearInterval(retry)
        }
      }, 500)
      setTimeout(() => clearInterval(retry), 5000)
    }
  }, [lobbyId, playerId, currentPhase, wsRef])
  
  // 7-second timer after scores are shown
  useEffect(() => {
    if (!isLoading && Object.keys(scores).length > 0) {
      const interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(interval)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [isLoading, scores])
  
  const handleContinue = useCallback(() => {
    const phase = currentPhaseRef.current
    if (hasSentContinueRef.current[phase] || !lobbyId || !playerId) return
    
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log(`[SCORES] Sending ready_to_continue for ${phase}`)
      ws.send(JSON.stringify({
        type: 'ready_to_continue',
        player_id: playerId,
        lobby_id: lobbyId,
        phase: phase
      }))
      hasSentContinueRef.current[phase] = true
    }
  }, [lobbyId, playerId, wsRef])
  
  const handleNavigateToNext = useCallback(() => {
    const phase = currentPhaseRef.current
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
  }, [navigate, proceedToNextPhase])
  
  // Fade in animation
  useEffect(() => {
    setIsVisible(false)
    const timer = setTimeout(() => setIsVisible(true), 10)
    return () => clearTimeout(timer)
  }, [currentPhase])
  
  const totalPlayers = lobby?.players.length || 0
  
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

  // Render loading state
  if (isLoading || Object.keys(scores).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 game-bg">
        <div className="game-paper px-8 py-6 game-shadow-hard-lg">
          <div className="text-center space-y-4">
            <div className="text-2xl font-black mb-4">WAITING FOR OTHER PLAYERS...</div>
            <div className="text-lg">
              Calculating scores...
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

  // VS-style results page (for 2 players)
  if (sortedPlayers.length === 2 && !isLoading && Object.keys(scores).length > 0) {
    const player1 = sortedPlayers[0]
    const player2 = sortedPlayers[1]
    const score1 = scores[player1.id] || 0
    const score2 = scores[player2.id] || 0
    
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
        {(readyToContinueCount > 0 || timeRemaining > 0) && (
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
            <div className="game-label-text text-xl game-shadow-hard-sm animate-pulse">
              {readyToContinueCount > 0 
                ? `WAITING FOR PLAYERS... (${readyToContinueCount} / ${lobby?.players.length || 0})`
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
            {phaseScores[player1.id] > 0 && (
              <div className="mt-3 px-4 py-2 bg-green-500 text-white rounded-md text-lg font-bold">
                +{phaseScores[player1.id]}
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
            {phaseScores[player2.id] > 0 && (
              <div className="mt-3 px-4 py-2 bg-green-500 text-white rounded-md text-lg font-bold">
                +{phaseScores[player2.id]}
              </div>
            )}
          </div>
        </div>


        {/* Continue Button - positioned at bottom */}
        <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-10">
          <button
            onClick={handleContinue}
            disabled={hasSentContinueRef.current[currentPhase] || timeRemaining > 0}
            className={`game-sharp px-10 py-5 text-lg font-black uppercase tracking-widest game-shadow-hard-lg ${
              hasSentContinueRef.current[currentPhase] || timeRemaining > 0 ? '' : 'game-button-hover'
            }`}
            style={{
              border: '6px solid var(--game-text-primary)',
              backgroundColor: (hasSentContinueRef.current[currentPhase] || timeRemaining > 0) ? 'var(--game-bg-alt)' : 'var(--game-green)',
              color: (hasSentContinueRef.current[currentPhase] || timeRemaining > 0) ? 'var(--game-text-dim)' : 'var(--game-text-white)',
              cursor: (hasSentContinueRef.current[currentPhase] || timeRemaining > 0) ? 'not-allowed' : 'pointer',
              opacity: (hasSentContinueRef.current[currentPhase] || timeRemaining > 0) ? 0.6 : 1
            }}
          >
            {hasSentContinueRef.current[currentPhase] 
              ? 'WAITING FOR OTHERS...' 
              : timeRemaining > 0
                ? `WAIT ${timeRemaining}S...`
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
          {!isLoading && Object.keys(scores).length > 0 && (
            <div className="text-sm text-gray-600">
              Auto-advancing in {timeRemaining} second{timeRemaining !== 1 ? 's' : ''}...
            </div>
          )}
          
          {readyToContinueCount > 0 && (
            <div className="game-paper px-6 py-4 game-shadow-hard-lg">
              <div className="text-center">
                <div className="game-label-text text-sm mb-2">WAITING FOR OTHER PLAYERS</div>
                <div className="text-lg font-bold">
                  {readyToContinueCount} / {lobby?.players.length || 0} players ready
                </div>
                {readyToContinueCount < (lobby?.players.length || 0) && (
                  <div className="text-sm text-gray-600 mt-2">
                    Waiting for {lobby && lobby.players ? lobby.players.length - readyToContinueCount : 0} more player{lobby && lobby.players && (lobby.players.length - readyToContinueCount) !== 1 ? 's' : ''}...
                  </div>
                )}
              </div>
            </div>
          )}
          <button
            onClick={handleContinue}
            disabled={hasSentContinueRef.current[currentPhase] || timeRemaining > 0}
            className={`game-sharp px-10 py-5 text-lg font-black uppercase tracking-widest game-shadow-hard-lg ${
              hasSentContinueRef.current[currentPhase] || timeRemaining > 0 ? '' : 'game-button-hover'
            }`}
            style={{
              border: '6px solid var(--game-text-primary)',
              backgroundColor: (hasSentContinueRef.current[currentPhase] || timeRemaining > 0) ? 'var(--game-bg-alt)' : 'var(--game-green)',
              color: (hasSentContinueRef.current[currentPhase] || timeRemaining > 0) ? 'var(--game-text-dim)' : 'var(--game-text-white)',
              cursor: (hasSentContinueRef.current[currentPhase] || timeRemaining > 0) ? 'not-allowed' : 'pointer',
              opacity: (hasSentContinueRef.current[currentPhase] || timeRemaining > 0) ? 0.6 : 1
            }}
          >
            {hasSentContinueRef.current[currentPhase] 
              ? 'WAITING FOR OTHERS...' 
              : timeRemaining > 0
                ? `WAIT ${timeRemaining}S...`
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
