import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLobby } from '@/hooks/useLobby'
import { useLobbyWebSocket } from '@/hooks/useLobbyWebSocket'
import hiredSound from '@/assets/sounds/hired.mp3'
import firedSound from '@/assets/sounds/fired.mp3'

const WinLose: React.FC = () => {
  const navigate = useNavigate()
  const { lobbyId, playerId, lobby } = useLobby()
  const [showButtons, setShowButtons] = useState(false)
  const [result, setResult] = useState<'HIRE' | 'FIRE' | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<number>(7)
  const [showConfetti, setShowConfetti] = useState(false)
  const [totalScore, setTotalScore] = useState<number>(0)
  const [rank, setRank] = useState<number>(1)

  // Fetch rankings from database API on mount
  useEffect(() => {
    const fetchRankings = async () => {
      if (!lobbyId || !playerId) {
        // Fallback to URL params if no lobbyId
        const urlParams = new URLSearchParams(window.location.search)
        const urlScore = parseInt(urlParams.get('score') || '0')
        const urlRank = parseInt(urlParams.get('rank') || '1')
        // Always set score and rank from URL params if available (even if 0)
        if (!isNaN(urlScore)) {
          console.log(`[WINLOSE] Using URL params: rank=${urlRank}, score=${urlScore}`)
          setTotalScore(urlScore)
          setRank(urlRank)
        }
        return
      }

      try {
        const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://127.0.0.1:8000' : window.location.origin)
        const response = await fetch(`${API_URL}/api/lobby/${lobbyId}/match-rankings`)
        if (response.ok) {
          const data = await response.json()
          if (data.rankings && data.rankings.length > 0) {
            const playerRanking = data.rankings.find((r: any) => r.player_id === playerId)
            if (playerRanking) {
              console.log(`[WINLOSE] Fetched from database: rank=${playerRanking.rank}, score=${playerRanking.score}`)
              setTotalScore(playerRanking.score)
              setRank(playerRanking.rank)
              return
            }
          }
        } else {
          console.error('[WINLOSE] API error:', response.status, response.statusText)
        }
      } catch (e) {
        console.error('[WINLOSE] Error fetching rankings from API:', e)
      }

      // Fallback to URL params if API fails
      const urlParams = new URLSearchParams(window.location.search)
      const urlScore = parseInt(urlParams.get('score') || '0')
      const urlRank = parseInt(urlParams.get('rank') || '1')
      // Always set score and rank from URL params if available (even if 0)
      if (!isNaN(urlScore)) {
        console.log(`[WINLOSE] Using URL params fallback: rank=${urlRank}, score=${urlScore}`)
        setTotalScore(urlScore)
        setRank(urlRank)
      }
    }

    fetchRankings()
  }, [lobbyId, playerId])

  // Set up WebSocket for synchronization
  const wsRef = useLobbyWebSocket({
    lobbyId: lobbyId || null,
    enabled: !!lobbyId,
    onLobbyUpdate: () => {},
    onGameStarted: () => {},
    onDisconnect: () => {},
    onKicked: () => {},
    currentPlayerId: playerId || null,
    onGameMessage: (message: any) => {
      if (message.type === 'winlose_start') {
        setTimeRemaining(message.timeRemaining || 7)
      } else if (message.type === 'game_end' && message.rankings && playerId) {
        // Update from game_end message (but prefer database fetch)
        const playerRanking = message.rankings.find((r: any) => r.player_id === playerId)
        if (playerRanking) {
          console.log(`[WINLOSE] Received game_end message: rank=${playerRanking.rank}, score=${playerRanking.score}`)
          setTotalScore(playerRanking.score)
          setRank(playerRanking.rank)
        }
      }
    },
  });

  const handleContinueToPodium = useCallback(() => {
    // Navigate to comparison page first, which will then go to podium
    navigate('/comparison')
  }, [navigate])

  useEffect(() => {
    // Determine result based on rank (rank 1 = HIRED, rank > 1 = FIRED)
    const isHired = rank === 1
    setResult(isHired ? 'HIRE' : 'FIRE')
    setShowConfetti(isHired)
    console.log(`[WINLOSE] useEffect: rank=${rank}, score=${totalScore}, isHired=${isHired}, result=${isHired ? 'HIRE' : 'FIRE'}`)
    
    // Notify server that win/lose screen started
    const wsConnection = wsRef.current
    if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
      wsConnection.send(JSON.stringify({
        type: 'winlose_started',
        player_id: playerId
      }))
    }
    
    // Play different sound effect based on hired/fired with delay to match animation
    const soundTimer = setTimeout(() => {
      try {
        // Use imported audio files - Vite will handle the path resolution
        const soundFile = isHired ? hiredSound : firedSound
        const stampSound = new Audio(soundFile)
        stampSound.volume = 1.0
        stampSound.preload = 'auto'
        
        // Handle successful load
        stampSound.addEventListener('canplaythrough', () => {
          const playPromise = stampSound.play()
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                console.log('✓ Sound played successfully')
              })
              .catch(err => {
                console.log('Audio play blocked (browser autoplay restriction):', err.message)
              })
          }
        }, { once: true })
        
        // Handle loading errors
        stampSound.addEventListener('error', (e) => {
          console.error('Audio file failed to load:', soundFile, e)
        }, { once: true })
        
        // Start loading
        stampSound.load()
      } catch (error) {
        console.error('Error creating audio:', error)
      }
    }, 300) // Matches the stamp animation delay
    
    // Start animation sequence: show stamp, then show buttons
    const timer = setTimeout(() => {
      setShowButtons(true)
    }, 1500) // Wait for stamp animation to complete
    
    return () => {
      clearTimeout(timer)
      clearTimeout(soundTimer)
    }
  }, [playerId, wsRef, totalScore, rank])

  // 7-second timer countdown
  useEffect(() => {
    if (timeRemaining <= 0) {
      // Timer expired - auto-advance to podium
      handleContinueToPodium()
      return
    }

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        const newTime = prev - 1
        if (newTime <= 0) {
          clearInterval(interval)
          // Auto-advance to podium
          setTimeout(() => {
            handleContinueToPodium()
          }, 100)
        }
        return newTime
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [timeRemaining, handleContinueToPodium])

  // Determine HIRED vs FIRED based on rank (rank 1 = HIRED, rank > 1 = FIRED)
  const isHired = rank === 1
  const resultText = isHired ? 'HIRE' : 'FIRE'
  
  console.log(`[WINLOSE] Display: rank=${rank}, isHired=${isHired}, resultText=${resultText}, totalScore=${totalScore}`)

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 game-bg relative overflow-hidden">
      {/* Confetti Effect - Only for Hired */}
      {showConfetti && isHired && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-fall"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-${Math.random() * 20}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${3 + Math.random() * 2}s`
              }}
            >
              <div
                className="w-4 h-4 game-sharp"
                style={{
                  background: ['var(--game-yellow)', 'var(--game-blue)', 'var(--game-red)', 'var(--game-green)', 'var(--game-orange)'][Math.floor(Math.random() * 5)],
                  transform: `rotate(${Math.random() * 360}deg)`
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Winner Announcement */}
      <div className="relative z-10 text-center space-y-12">
        {/* Result Title - Stamp Style */}
        <div className="relative animate-stamp-in" style={{ animationDelay: '0.3s' }}>
          <div 
            className="px-20 py-12 inline-block relative"
            style={{
              backgroundColor: isHired ? 'var(--game-green)' : 'var(--game-red)',
              border: `8px solid ${isHired ? 'var(--game-green)' : 'var(--game-red)'}`,
              transform: 'rotate(-5deg)',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
            }}
          >
            <h1 
              className="font-black text-white"
              style={{ 
                fontSize: '6rem',
                lineHeight: '1',
                fontFamily: 'Impact, sans-serif',
                letterSpacing: '0.1em',
                textTransform: 'uppercase'
              }}
            >
              {resultText}
            </h1>
          </div>
        </div>

        {/* Total Score Display */}
        <div className="space-y-4 animate-stamp-in" style={{ animationDelay: '0.8s' }}>
          <div className="game-label-text text-2xl game-shadow-hard-sm inline-block">
            FINAL SCORE
          </div>
          <div 
            className="text-9xl font-black game-shadow-hard"
            style={{ 
              color: isHired ? 'var(--game-green)' : 'var(--game-red)',
              fontFamily: 'Impact, sans-serif',
              textTransform: 'uppercase'
            }}
          >
            {totalScore ?? 0}
          </div>
          <div className="game-label-text text-xl game-shadow-hard-sm inline-block">
            {isHired ? 'WELCOME TO THE TEAM!' : 'BETTER LUCK NEXT TIME'}
          </div>
        </div>

        {/* Timer indicator */}
        {showButtons && (
          <div className="text-sm text-gray-600 mb-4">
            Auto-advancing to answer comparison in {timeRemaining}s...
          </div>
        )}

        {/* Continue to Podium Button */}
        {showButtons && (
          <button
            onClick={handleContinueToPodium}
            className="game-sharp game-block-blue px-16 py-6 text-2xl font-black uppercase tracking-widest game-shadow-hard-lg game-button-hover animate-fade-in-up"
            style={{
              border: '6px solid var(--game-text-primary)',
              color: 'var(--game-text-white)',
              letterSpacing: '0.15em',
              marginTop: '3rem',
              animationDelay: '1.8s'
            }}
          >
            VIEW ANSWER COMPARISON
          </button>
        )}
      </div>

      <style>{`
        @keyframes fall {
          to {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0;
          }
        }
        .animate-fall {
          animation: fall linear infinite;
        }
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out both;
        }
      `}</style>
    </div>
  )
}

export default WinLose
