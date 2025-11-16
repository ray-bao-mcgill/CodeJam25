import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLobby } from '@/hooks/useLobby'
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
  const currentPlayerScore = parseInt(searchParams.get('score') || '0')
  const currentPlayerRank = parseInt(searchParams.get('rank') || '1')
  const { lobby, playerId } = useLobby()
  const [rankings, setRankings] = useState<PlayerRanking[]>([])

  useEffect(() => {
    // Get player rankings from lobby data or create mock data
    if (lobby && lobby.players) {
      // TODO: Get actual scores from game state
      const playerRankings: PlayerRanking[] = lobby.players.map((player: any, index: number) => ({
        name: player.name,
        score: player.id === playerId ? currentPlayerScore : Math.floor(Math.random() * 2000) + 1000,
        rank: index + 1,
        isCurrentPlayer: player.id === playerId
      }))

      // Sort by score descending and assign ranks
      playerRankings.sort((a, b) => b.score - a.score)
      playerRankings.forEach((player, index) => {
        player.rank = index + 1
      })

      setRankings(playerRankings)
    } else {
      // Single player or no lobby - show just current player
      setRankings([{
        name: 'You',
        score: currentPlayerScore,
        rank: currentPlayerRank,
        isCurrentPlayer: true
      }])
    }
  }, [lobby, playerId, currentPlayerScore, currentPlayerRank])

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
