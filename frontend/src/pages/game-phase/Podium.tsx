import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLobby } from '@/hooks/useLobby'
import { useLobbyWebSocket } from '@/hooks/useLobbyWebSocket'
import { Button } from '@/components/ui/button'

interface PlayerRanking {
  name: string
  score: number
  rank: number
  isCurrentPlayer?: boolean
}

const Podium: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { lobby, playerId, lobbyId } = useLobby()
  const [rankings, setRankings] = useState<PlayerRanking[]>([])
  
  // Get score and rank from URL params (these are passed from WinLose page)
  const urlScore = parseInt(searchParams.get('score') || '0')
  const urlRank = parseInt(searchParams.get('rank') || '1')
  
  console.log(`[PODIUM] URL params: score=${urlScore}, rank=${urlRank}`)

  // Fetch rankings from database API on mount
  useEffect(() => {
    const fetchRankings = async () => {
      // Fetch from database API (only source of truth)
      if (lobbyId) {
        try {
          const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://127.0.0.1:8000' : window.location.origin)
          const response = await fetch(`${API_URL}/api/lobby/${lobbyId}/match-rankings`)
          if (response.ok) {
            const data = await response.json()
            if (data.rankings && data.rankings.length > 0) {
              const playerRankings: PlayerRanking[] = data.rankings.map((r: any) => ({
                name: r.name || 'Unknown',
                score: r.score || 0,
                rank: r.rank || 1,
                isCurrentPlayer: r.player_id === playerId
              }))
              playerRankings.sort((a, b) => a.rank - b.rank)
              console.log('[PODIUM] Fetched rankings from database:', playerRankings)
              console.log('[PODIUM] Scores from DB:', playerRankings.map(p => `${p.name}: ${p.score} (rank ${p.rank})`))
              
              setRankings(playerRankings)
              return
            }
          } else {
            console.error('[PODIUM] API error:', response.status, response.statusText)
          }
        } catch (e) {
          console.error('[PODIUM] Error fetching rankings from API:', e)
        }
      }
      
      // Fallback: URL params (from WinLose navigation) - only if API fails
      if (lobby && lobby.players) {
        const playerRankings: PlayerRanking[] = lobby.players.map((player: any, index: number) => ({
          name: player.name || player.id,
          score: player.id === playerId ? urlScore : 0,
          rank: index + 1,
          isCurrentPlayer: player.id === playerId
        }))
        playerRankings.sort((a, b) => b.score - a.score)
        playerRankings.forEach((player, index) => {
          player.rank = index + 1
        })
        console.log('[PODIUM] Using fallback from URL params:', playerRankings)
        setRankings(playerRankings)
      }
    }
    
    fetchRankings()
  }, [lobbyId, lobby, playerId, urlScore, urlRank])

  // Listen for game_end message to get actual rankings from backend (in case it arrives late)
  useLobbyWebSocket({
    lobbyId: lobbyId || null,
    enabled: !!lobbyId,
    onLobbyUpdate: () => {},
    onGameStarted: () => {},
    onDisconnect: () => {},
    onKicked: () => {},
    currentPlayerId: playerId || null,
    onGameMessage: (message: any) => {
      if (message.type === 'game_end' && message.rankings) {
        // Convert backend rankings to frontend format
        const playerRankings: PlayerRanking[] = message.rankings.map((r: any) => ({
          name: r.name,
          score: r.score,
          rank: r.rank,
          isCurrentPlayer: r.player_id === playerId
        }))
        console.log('[PODIUM] Received game_end message with rankings:', playerRankings)
        setRankings(playerRankings)
      }
    },
  })

  const getPodiumHeight = (rank: number) => {
    if (rank === 1) return 'h-80'
    if (rank === 2) return 'h-64'
    if (rank === 3) return 'h-56'
    return 'h-48'
  }

  const getPodiumColor = (rank: number) => {
    if (rank === 1) return 'bg-[#FFD700]' // Gold
    if (rank === 2) return 'bg-[#C0C0C0]' // Silver
    if (rank === 3) return 'bg-[#CD7F32]' // Bronze
    return 'bg-[var(--game-blue)]'
  }

  const getRankDisplay = (rank: number) => {
    return `#${rank}`
  }

  // Show top 3 on podium, rest in list
  const topThree = rankings.slice(0, 3)
  const restOfPlayers = rankings.slice(3)

  // Get players by rank for podium display (2nd, 1st, 3rd order)
  const getPlayerByRank = (rank: number) => rankings.find(p => p.rank === rank)
  const podiumOrder = [getPlayerByRank(2), getPlayerByRank(1), getPlayerByRank(3)]

  return (
    <div className="flex flex-col items-center justify-between min-h-screen p-6 game-bg overflow-hidden">
      <div className="w-full max-w-7xl flex flex-col" style={{ height: 'calc(100vh - 3rem)' }}>
        {/* Title */}
        <div className="relative game-skew-left mb-4 mt-2">
          <div className="game-sticky-note px-12 py-4 game-shadow-hard-lg">
            <h1 className="game-title text-5xl" style={{ fontSize: '3rem', lineHeight: '1.1' }}>
              FINAL RANKINGS
            </h1>
          </div>
        </div>
        
        {/* Subtitle */}
        <div className="flex justify-center mb-6">
          <div className="game-label-text text-lg game-shadow-hard-sm">
            TOP PERFORMERS
          </div>
        </div>

        {/* Podium for Top 3 - Always show 3 spots */}
        <div className="flex items-end justify-center gap-8 flex-1 pb-8">
          {podiumOrder.map((player, visualIndex) => {
            // Map visual position to actual rank: [2, 1, 3]
            const actualRank = visualIndex === 0 ? 2 : visualIndex === 1 ? 1 : 3
            
            if (!player) {
              // Show empty podium spot
              return (
                <div 
                  key={`empty-${actualRank}`}
                  className="flex flex-col items-center animate-stamp-in"
                  style={{ animationDelay: `${visualIndex * 0.2}s` }}
                >
                  {/* Empty Player Info */}
                  <div className="mb-4 text-center">
                    <div className="text-5xl mb-2 font-black text-[var(--game-text-primary)]" style={{ fontFamily: 'Arial Black, sans-serif' }}>
                      #{actualRank}
                    </div>
                    <div className="game-sharp px-6 py-4 game-shadow-hard border-4 border-[var(--game-text-primary)] bg-[var(--game-paper)] opacity-50">
                      <div className="font-black text-xl text-[var(--game-text-primary)]" style={{ fontFamily: 'Arial Black, sans-serif' }}>
                        ---
                      </div>
                      <div className="font-black text-lg text-[var(--game-blue)]" style={{ fontFamily: 'Arial Black, sans-serif' }}>
                        0 pts
                      </div>
                    </div>
                  </div>

                  {/* Empty Podium Block */}
                  <div 
                    className={`w-48 ${getPodiumHeight(actualRank)} ${getPodiumColor(actualRank)} game-sharp game-shadow-hard-lg border-8 border-[var(--game-text-primary)] flex items-center justify-center relative opacity-50`}
                  >
                    <div className="text-6xl font-black text-white drop-shadow-lg" style={{ fontFamily: 'Impact, sans-serif' }}>
                      {actualRank}
                    </div>
                  </div>
                </div>
              )
            }
            
            return (
              <div 
                key={player.name}
                className="flex flex-col items-center animate-stamp-in"
                style={{ animationDelay: `${visualIndex * 0.2}s` }}
              >
                {/* Player Info */}
                <div className="mb-4 text-center">
                  <div className="text-5xl mb-2 font-black text-[var(--game-text-primary)]" style={{ fontFamily: 'Arial Black, sans-serif' }}>
                    #{player.rank}
                  </div>
                  <div 
                    className={`game-sharp px-6 py-4 game-shadow-hard border-4 ${
                      player.isCurrentPlayer ? 'border-[var(--game-yellow)] bg-[#fffacd]' : 'border-[var(--game-text-primary)] bg-[var(--game-paper)]'
                    }`}
                  >
                    <div className="font-black text-xl text-[var(--game-text-primary)]" style={{ fontFamily: 'Arial Black, sans-serif' }}>
                      {player.name}
                      {player.isCurrentPlayer && ' (YOU)'}
                    </div>
                    <div className="font-black text-lg text-[var(--game-blue)]" style={{ fontFamily: 'Arial Black, sans-serif' }}>
                      {player.score} pts
                    </div>
                  </div>
                </div>

                {/* Podium Block */}
                <div 
                  className={`w-48 ${getPodiumHeight(player.rank)} ${getPodiumColor(player.rank)} game-sharp game-shadow-hard-lg border-8 border-[var(--game-text-primary)] flex items-center justify-center relative`}
                >
                  <div className="text-6xl font-black text-white drop-shadow-lg" style={{ fontFamily: 'Impact, sans-serif' }}>
                    {player.rank}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        {/* Action Buttons */}
        <div className="flex justify-center gap-6 pb-4">
          <Button
            onClick={() => navigate('/analytics')}
            className="game-sharp bg-[var(--game-blue)] px-16 py-7 text-xl font-black uppercase tracking-widest game-shadow-hard-lg hover:translate-y-[-4px] hover:rotate-[-2deg] hover:shadow-[12px_12px_0px_rgba(0,0,0,0.3)] hover:bg-[var(--game-yellow)] transition-all border-8 border-[var(--game-text-primary)] text-white"
            style={{ fontFamily: 'Arial Black, sans-serif' }}
            variant="ghost"
          >
            VIEW ANALYTICS
          </Button>
          
          <Button
            onClick={() => navigate('/landing')}
            className="game-sharp bg-[var(--game-green)] px-16 py-7 text-xl font-black uppercase tracking-widest game-shadow-hard-lg hover:translate-y-[-4px] hover:rotate-[-2deg] hover:shadow-[12px_12px_0px_rgba(0,0,0,0.3)] hover:bg-[var(--game-yellow)] transition-all border-8 border-[var(--game-text-primary)] text-white"
            style={{ fontFamily: 'Arial Black, sans-serif' }}
            variant="ghost"
          >
            PLAY AGAIN
          </Button>
        </div>
      </div>
    </div>
  )
}

export default Podium
