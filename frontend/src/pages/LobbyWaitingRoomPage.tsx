import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLobby, LobbyData } from '@/hooks/useLobby'
import { useLobbyWebSocket } from '@/hooks/useLobbyWebSocket'
import LobbyWaitingRoom from '@/pages/LobbyWaitingRoom'
import ReadyScreen from '@/pages/ReadyScreen'

const LobbyWaitingRoomPage: React.FC = () => {
  const navigate = useNavigate()
  const [gameStarted, setGameStarted] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  const {
    lobbyId,
    joined,
    lobby,
    playerId,
    setLobby,
    startGame,
    leaveLobby,
  } = useLobby()

  // Wait a moment for state to load from sessionStorage, then check
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsChecking(false)
      // Check if we have the required state
      if (!joined || !lobby || !lobbyId) {
        console.log('Missing lobby state:', { joined, lobby: !!lobby, lobbyId })
        navigate('/lobby-join', { replace: true })
      }
    }, 500) // Increased timeout to allow sessionStorage to load
    return () => clearTimeout(timer)
  }, [joined, lobby, lobbyId, navigate])

  const handleLobbyUpdate = useCallback(
    (updatedLobby: LobbyData) => {
      setLobby(updatedLobby)
      if (
        updatedLobby.status === 'starting' ||
        updatedLobby.status === 'in_progress'
      ) {
        setGameStarted(true)
      }
    },
    [setLobby]
  )

  const handleGameStarted = useCallback(() => {
    setGameStarted(true)
  }, [])

  const wsRef = useLobbyWebSocket({
    lobbyId: joined ? lobbyId : null,
    enabled: joined && !!lobbyId,
    onLobbyUpdate: handleLobbyUpdate,
    onGameStarted: handleGameStarted,
  })

  const handleStartGame = async () => {
    await startGame()
  }

  const handleLeaveLobby = async () => {
    await leaveLobby()
    setGameStarted(false)
    if (wsRef.current) {
      wsRef.current.close()
    }
    navigate('/lobby-creation', { replace: true })
  }

  // Ready screen when game starts
  if (gameStarted && lobby) {
    return <ReadyScreen lobby={lobby} />
  }

  // Lobby waiting room
  if (joined && lobby) {
    return (
      <LobbyWaitingRoom
        lobby={lobby}
        onStartGame={handleStartGame}
        onLeaveLobby={handleLeaveLobby}
        playerId={playerId}
        onLobbyUpdate={handleLobbyUpdate}
      />
    )
  }

  // Loading or checking state
  if (isChecking) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 game-bg">
        <div className="text-center">
          <p className="text-xl" style={{ color: 'var(--game-text-primary)' }}>
            Loading...
          </p>
        </div>
      </div>
    )
  }

  // Redirecting - show loading while redirecting
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 game-bg">
      <div className="text-center">
        <p className="text-xl" style={{ color: 'var(--game-text-primary)' }}>
          Redirecting...
        </p>
      </div>
    </div>
  )
}

export default LobbyWaitingRoomPage

