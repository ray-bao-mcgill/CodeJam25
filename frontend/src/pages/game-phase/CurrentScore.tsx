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
  const allReady = readyCount >= totalPlayers && totalPlayers > 0
  const allReadyToContinue = readyToContinueCount >= totalPlayers && totalPlayers > 0
  
  // Render loading state
  if (isLoading || Object.keys(scores).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen game-bg p-6">
        <div className={`game-paper px-8 py-6 game-shadow-hard-lg text-center transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
          <h1 className="game-title text-3xl mb-4">LOADING SCORES...</h1>
          <div className="game-label-text text-sm mb-2">
            Waiting for players: {readyCount} / {totalPlayers}
          </div>
          {!allReady && (
            <div className="text-xs opacity-70">
              Waiting for all players to be ready...
            </div>
          )}
        </div>
      </div>
    )
  }
  
  // Render scores
  const sortedPlayers = lobby?.players
    .map(p => ({
      id: typeof p === 'object' ? p.id : p,
      name: typeof p === 'object' ? p.name : 'Player'
    }))
    .sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0)) || []
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen game-bg p-6">
      <div className={`w-full max-w-4xl transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="game-paper px-8 py-6 game-shadow-hard-lg mb-6">
          <h1 className="game-title text-3xl mb-4 text-center">
            {currentPhase === 'behavioural_score' && 'BEHAVIOURAL ROUND SCORES'}
            {currentPhase === 'technical_theory_score' && 'TECHNICAL THEORY ROUND SCORES'}
            {currentPhase === 'technical_score' && 'FINAL SCORES'}
          </h1>
          
          <div className="space-y-4">
            {sortedPlayers.map((player, index) => {
              const playerScore = scores[player.id] || 0
              const phaseScore = phaseScores[player.id] || 0
              const isCurrentPlayer = player.id === playerId
              
              return (
                <div
                  key={player.id}
                  className={`game-sharp px-6 py-4 game-shadow-hard-sm ${
                    isCurrentPlayer ? 'border-4 border-[var(--game-blue)]' : ''
                  }`}
                  style={{
                    border: isCurrentPlayer ? '4px solid var(--game-blue)' : '3px solid var(--game-text-primary)',
                    background: isCurrentPlayer ? 'var(--game-blue)' : 'var(--game-paper-bg)',
                    color: isCurrentPlayer ? 'var(--game-text-white)' : 'var(--game-text-primary)',
                    transform: `rotate(${index % 2 === 0 ? '-0.5deg' : '0.5deg'})`
                  }}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <span className="text-2xl font-black">#{index + 1}</span>
                      <span className="text-lg font-black">{player.name}</span>
                      {isCurrentPlayer && <span className="text-xs">(YOU)</span>}
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-black">{playerScore} pts</div>
                      {phaseScore > 0 && (
                        <div className="text-xs opacity-70">+{phaseScore} this round</div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        
        {/* Continue Button */}
        <div className="text-center">
          <button
            onClick={handleContinue}
            disabled={hasSentContinueRef.current[currentPhase] || timeRemaining > 0}
            className={`game-sharp px-10 py-5 text-lg font-black uppercase tracking-widest game-shadow-hard-lg ${
              hasSentContinueRef.current[currentPhase] || timeRemaining > 0
                ? 'opacity-60 cursor-not-allowed'
                : 'game-button-hover'
            }`}
            style={{
              border: '6px solid var(--game-text-primary)',
              backgroundColor: hasSentContinueRef.current[currentPhase] || timeRemaining > 0
                ? 'var(--game-bg-alt)'
                : 'var(--game-green)',
              color: hasSentContinueRef.current[currentPhase] || timeRemaining > 0
                ? 'var(--game-text-dim)'
                : 'var(--game-text-white)'
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
          
          {readyToContinueCount > 0 && (
            <div className="mt-4 text-sm opacity-70">
              {readyToContinueCount} / {totalPlayers} players ready
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CurrentScore
