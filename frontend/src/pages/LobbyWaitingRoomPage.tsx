import React, { useCallback, useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLobby, LobbyData } from '@/hooks/useLobby'
import { useLobbyWebSocket } from '@/hooks/useLobbyWebSocket'
import { API_URL } from '@/config'
import LobbyWaitingRoom from '@/pages/LobbyWaitingRoom'
import ReadyScreen from '@/pages/ReadyScreen'
import Loading from '@/components/Loading'

const LobbyWaitingRoomPage: React.FC = () => {
  const navigate = useNavigate()
  const [gameStarted, setGameStarted] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [lobbyExists, setLobbyExists] = useState<boolean | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const isLeavingRef = useRef(false)

  useEffect(() => {
    // Reset visibility state and trigger fade in on mount
    setIsVisible(false)
    // Small delay to ensure initial state is rendered before animation
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, 10)
    return () => clearTimeout(timer)
  }, [])

  const {
    lobbyId,
    joined,
    lobby,
    playerId,
    playerName,
    setLobby,
    startGame,
    leaveLobby,
  } = useLobby()

  // Store wsRef in a ref so it can be accessed in callbacks
  const wsRefRef = useRef<ReturnType<typeof useLobbyWebSocket> | null>(null)

  // Check if lobby exists in backend when page loads
  useEffect(() => {
    const checkLobbyExists = async () => {
      if (!lobbyId) {
        setIsChecking(false)
        setLobbyExists(false)
        return
      }

      try {
        // Create abort controller for timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)
        
        const response = await fetch(`${API_URL}/api/lobby/${lobbyId}`, {
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (!response.ok) {
          // If we get a 404, lobby definitely doesn't exist
          if (response.status === 404) {
            setLobbyExists(false)
            console.log('Lobby not found in backend (404):', lobbyId)
          } else {
            // Other HTTP errors - assume lobby might exist (network/server issues)
            console.warn('Error checking lobby existence (HTTP error):', response.status)
            setLobbyExists(null) // Unknown - don't redirect
          }
          setIsChecking(false)
          return
        }

        const data = await response.json()
        
        if (data.success && data.lobby) {
          setLobbyExists(true)
          // Update lobby state with backend data if it exists
          if (setLobby) {
            setLobby(data.lobby)
          }
        } else {
          setLobbyExists(false)
          console.log('Lobby not found in backend:', lobbyId)
        }
      } catch (err: any) {
        // Network errors or timeouts - don't assume lobby doesn't exist
        // If we have sessionStorage data, trust it and let WebSocket verify
        console.warn('Error checking lobby existence (network error):', err)
        const isNetworkError = err.name === 'AbortError' || 
                              err.name === 'TypeError' ||
                              err.message?.includes('Failed to fetch') || 
                              err.message?.includes('network') ||
                              err.message?.includes('ERR_CONNECTION_REFUSED')
        
        if (isNetworkError) {
          // Network error - assume lobby might exist if we have sessionStorage data
          if (joined && lobby) {
            setLobbyExists(null) // Unknown - don't redirect, let WebSocket verify
            console.log('Network error but have sessionStorage data, assuming lobby exists')
          } else {
            setLobbyExists(false) // No sessionStorage data, probably doesn't exist
          }
        } else {
          setLobbyExists(false)
        }
      } finally {
        setIsChecking(false)
      }
    }

    // Wait a moment for state to load from sessionStorage, then check
    const timer = setTimeout(() => {
      checkLobbyExists()
    }, 500) // Increased timeout to allow sessionStorage to load
    
    return () => clearTimeout(timer)
  }, [lobbyId, setLobby, joined, lobby])

  // Redirect if lobby doesn't exist or missing required state
  useEffect(() => {
    // Only redirect if we're certain the lobby doesn't exist (not on network errors)
    if (!isChecking && lobbyExists === false && !joined) {
      console.log('Lobby does not exist and no sessionStorage data, redirecting to lobby-join')
      navigate('/lobby-join', { replace: true })
    } else if (!isChecking && lobbyExists === false && (!joined || !lobby || !lobbyId)) {
      console.log('Lobby does not exist and missing required state, redirecting to lobby-join')
      navigate('/lobby-join', { replace: true })
    }
  }, [isChecking, lobbyExists, joined, lobby, lobbyId, navigate])

  const handleLobbyUpdate = useCallback(
    (updatedLobby: LobbyData) => {
      // Check if current player is still in the lobby (backup check for kicks)
      if (playerId && updatedLobby.players) {
        const playerStillInLobby = updatedLobby.players.some(
          (p: any) => p.id === playerId
        )
        if (!playerStillInLobby) {
          // Player was removed from lobby (kicked)
          console.log('Player no longer in lobby, redirecting to join screen')
          if (wsRefRef.current?.current) {
            wsRefRef.current.current.close(1000)
          }
          leaveLobby()
          navigate('/lobby-join', { replace: true })
          return
        }
      }
      
      setLobby(updatedLobby)
      if (
        updatedLobby.status === 'starting' ||
        updatedLobby.status === 'in_progress'
      ) {
        setGameStarted(true)
      }
    },
    [setLobby, playerId, navigate, leaveLobby]
  )

  const handleGameStarted = useCallback(() => {
    setGameStarted(true)
  }, [])

  const [showDisconnectNotification, setShowDisconnectNotification] = useState(false);

  const handleDisconnect = useCallback((wasUserInitiated: boolean) => {
    // Don't handle disconnect if we're already leaving intentionally
    if (isLeavingRef.current) {
      return;
    }
    if (!wasUserInitiated) {
      console.log('Unexpected disconnect, showing notification and redirecting')
      setShowDisconnectNotification(true);
      // Redirect to lobby creation screen after showing notification briefly
      setTimeout(() => {
        // Clean up lobby state before redirecting
        leaveLobby();
        navigate('/lobby-creation', { replace: true });
      }, 2000); // Show notification for 2 seconds before redirecting
    }
  }, [navigate, leaveLobby])

  const handleKicked = useCallback(() => {
    console.log('handleKicked called - Player was kicked from lobby, redirecting')
    // Store kicked flag in sessionStorage so notification shows on redirect page
    sessionStorage.setItem('wasKicked', 'true')
    // Close WebSocket connection (use custom code 4000 for "kicked by owner")
    if (wsRefRef.current?.current) {
      try {
        wsRefRef.current.current.close(4000, 'Kicked by lobby owner') // Custom code for kicked
      } catch (e) {
        // If close fails, just close normally
        console.warn('Failed to close with custom code, closing normally:', e)
        wsRefRef.current.current.close(1000)
      }
    }
    // Clean up lobby state and redirect immediately
    leaveLobby()
    navigate('/lobby-join', { replace: true })
  }, [navigate, leaveLobby])

  const wsRef = useLobbyWebSocket({
    lobbyId: joined ? lobbyId : null,
    enabled: joined && !!lobbyId,
    onLobbyUpdate: handleLobbyUpdate,
    onGameStarted: handleGameStarted,
    onDisconnect: handleDisconnect,
    onKicked: handleKicked,
    currentPlayerId: playerId,
  })

  // Store wsRef in ref so it can be accessed in callbacks
  wsRefRef.current = wsRef

  const handleStartGame = async () => {
    await startGame()
  }

  const handleLeaveLobby = async () => {
    isLeavingRef.current = true // Mark that we're intentionally leaving
    setIsVisible(false)
    await leaveLobby()
    setGameStarted(false)
    if (wsRefRef.current?.current) {
      // Mark as user-initiated before closing
      wsRefRef.current.current.close(1000) // Normal closure code indicates user-initiated
    }
    setTimeout(() => {
      navigate('/lobby-join', { replace: true })
    }, 1000) // Wait for shrink/fade animation to complete
  }

  // Don't render anything if we're still checking
  if (isChecking) {
    return <Loading message="Loading..." />
  }
  
  // Only redirect if we're certain lobby doesn't exist (not on network errors)
  if (lobbyExists === false && !joined && !lobby) {
    return <Loading message="Lobby not found. Redirecting..." />
  }

  // Ready screen when game starts
  if (gameStarted && lobby && (lobbyExists === true || (lobbyExists === null && joined))) {
    return <ReadyScreen lobby={lobby} />
  }

  // Lobby waiting room - render if we have lobby data (even if existence check failed due to network)
  if (joined && lobby && (lobbyExists === true || lobbyExists === null)) {
    return (
      <div
        style={{
          transform: isVisible ? 'scale(1)' : 'scale(0.3)',
          opacity: isVisible ? 1 : 0,
          transition: 'transform 1s cubic-bezier(0.68, -0.55, 0.265, 1.55), opacity 1s ease-out'
        }}
      >
        <LobbyWaitingRoom
          lobby={lobby}
          onStartGame={handleStartGame}
          onLeaveLobby={handleLeaveLobby}
          playerId={playerId}
          playerName={playerName}
          onLobbyUpdate={handleLobbyUpdate}
          showDisconnectNotification={showDisconnectNotification}
          onDismissDisconnect={() => setShowDisconnectNotification(false)}
        />
      </div>
    )
  }

  // Fallback - should not reach here, but just in case
  return <Loading message="Loading..." />
}

export default LobbyWaitingRoomPage

