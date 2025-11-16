import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLobbyWebSocket } from '@/hooks/useLobbyWebSocket'
import { useLobby } from '@/hooks/useLobby'
import hiredSound from '@/assets/sounds/hired.mp3'
import firedSound from '@/assets/sounds/fired.mp3'

const Winner: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { lobbyId, playerId } = useLobby()
  const [totalScore, setTotalScore] = useState(parseInt(searchParams.get('score') || '0'))
  const [rank, setRank] = useState(parseInt(searchParams.get('rank') || '1'))
  const [showConfetti, setShowConfetti] = useState(false)
  
  // Load rankings from localStorage or URL params
  useEffect(() => {
    // Try to get from localStorage first (most accurate)
    const storedRankings = localStorage.getItem('gameRankings')
    if (storedRankings && playerId) {
      try {
        const rankings = JSON.parse(storedRankings)
        const playerRanking = rankings.find((r: any) => r.player_id === playerId)
        if (playerRanking) {
          console.log(`[WINNER] Found player ranking from localStorage: rank=${playerRanking.rank}, score=${playerRanking.score}`)
          setTotalScore(playerRanking.score)
          setRank(playerRanking.rank)
        }
      } catch (e) {
        console.error('Error parsing stored rankings:', e)
      }
    }
    
    // Fallback to URL params if localStorage doesn't have it
    const urlScore = parseInt(searchParams.get('score') || '0')
    const urlRank = parseInt(searchParams.get('rank') || '1')
    // Always set score and rank from URL params if available (even if 0)
    if (!isNaN(urlScore)) {
      console.log(`[WINNER] Using URL params: rank=${urlRank}, score=${urlScore}`)
      setTotalScore(urlScore)
      setRank(urlRank)
    }
  }, [playerId, searchParams])
  
  // Listen for game_end message to get actual scores (in case it arrives late)
  useLobbyWebSocket({
    lobbyId: lobbyId || null,
    enabled: !!lobbyId,
    onLobbyUpdate: () => {},
    onGameStarted: () => {},
    onDisconnect: () => {},
    onKicked: () => {},
    currentPlayerId: playerId || null,
    onGameMessage: (message: any) => {
      if (message.type === 'game_end' && message.rankings && playerId) {
        // Store in localStorage
        localStorage.setItem('gameRankings', JSON.stringify(message.rankings))
        localStorage.setItem('gameFinalScores', JSON.stringify(message.final_scores || {}))
        
        const playerRanking = message.rankings.find((r: any) => r.player_id === playerId)
        if (playerRanking) {
          console.log(`[WINNER] Received game_end message: rank=${playerRanking.rank}, score=${playerRanking.score}`)
          setTotalScore(playerRanking.score)
          setRank(playerRanking.rank)
        }
      }
    },
  })
  
  // You're only hired if you're ranked #1
  const isHired = rank === 1
  const resultText = isHired ? 'HIRED!' : 'FIRED!'
  
  console.log(`[WINNER] Rendering with rank=${rank}, score=${totalScore}, isHired=${isHired}`)

  useEffect(() => {
    setShowConfetti(true)

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

    // Navigate to comparison after showing result
    const navigationTimer = setTimeout(() => {
      navigate('/comparison')
    }, 4000) // Show winner screen for 4 seconds
    
    return () => {
      clearTimeout(navigationTimer)
      clearTimeout(soundTimer)
    }
  }, [isHired, totalScore, rank, navigate])

  return (
    <div className="flex items-center justify-center min-h-screen game-bg relative overflow-hidden">
      {/* Confetti Effect - Only for Hired */}
      {showConfetti && isHired && (
        <div className="absolute inset-0 pointer-events-none z-20">
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
                  background: ['var(--game-yellow)', 'var(--game-blue)', 'var(--game-red)', 'var(--game-green)', '#ff6600'][Math.floor(Math.random() * 5)],
                  transform: `rotate(${Math.random() * 360}deg)`
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Winner Announcement */}
      <div className="relative z-10 text-center space-y-12">
        {/* Result Title - Stamp Style matching game aesthetic */}
        <div className="relative animate-stamp-in" style={{ animationDelay: '0.3s' }}>
          <div 
            className={`px-20 py-12 inline-block relative game-sharp game-shadow-hard-lg border-8 ${
              isHired ? 'bg-[var(--game-green)] border-[var(--game-text-primary)]' : 'bg-[var(--game-red)] border-[var(--game-text-primary)]'
            }`}
            style={{
              transform: 'rotate(-5deg)'
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
          <div className="game-label-text text-2xl game-shadow-hard-sm">
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
          <div className="game-label-text text-xl game-shadow-hard-sm">
            {isHired ? 'WELCOME TO THE TEAM!' : 'BETTER LUCK NEXT TIME'}
          </div>
        </div>
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
      `}</style>
    </div>
  )
}

export default Winner

