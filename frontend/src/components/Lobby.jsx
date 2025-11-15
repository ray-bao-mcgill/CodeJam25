import { useState, useEffect, useRef } from 'react'
import { Container, Stack, Title, TextInput, Button, Text, Paper, List, Group, ActionIcon } from '@mantine/core'

export default function Lobby() {
  const [lobbyId, setLobbyId] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [joined, setJoined] = useState(false)
  const [lobby, setLobby] = useState(null)
  const [error, setError] = useState('')
  const [gameStarted, setGameStarted] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [copied, setCopied] = useState(false)
  const wsRef = useRef(null)
  const lobbyIdRef = useRef(null)
  const playerIdRef = useRef(null)

  const copyLobbyId = async () => {
    if (lobby?.id) {
      await navigator.clipboard.writeText(lobby.id)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const connectWebSocket = (id) => {
    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    console.log(`Connecting WebSocket to lobby ${id}`)
    lobbyIdRef.current = id
    
    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/lobby/${id}`)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('✓ WebSocket connected')
      // Send ping every 20 seconds
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }))
        } else {
          clearInterval(pingInterval)
        }
      }, 20000)
      ws._pingInterval = pingInterval
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        console.log('Received WebSocket message:', message.type)
        
        if (message.type === 'lobby_update') {
          console.log('Updating lobby state:', message.lobby)
          setLobby(message.lobby)
          // Check if game has started
          if (message.lobby.status === 'starting') {
            setGameStarted(true)
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    ws.onclose = (event) => {
      console.log('WebSocket closed', event.code)
      if (ws._pingInterval) {
        clearInterval(ws._pingInterval)
      }
      wsRef.current = null
      
      // Reconnect if not intentional
      if (event.code !== 1000 && lobbyIdRef.current && joined) {
        setTimeout(() => {
          console.log('Reconnecting...')
          connectWebSocket(lobbyIdRef.current)
        }, 2000)
      }
    }
  }

  const createLobby = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name')
      return
    }

    setIsCreating(true)
    setError('')

    try {
      const createResponse = await fetch('http://127.0.0.1:8000/api/lobby/create', {
        method: 'POST',
      })
      const createData = await createResponse.json()

      if (createData.lobby_id) {
        const joinResponse = await fetch('http://127.0.0.1:8000/api/lobby/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lobby_id: createData.lobby_id,
            player_name: playerName.trim(),
          }),
        })

        const joinData = await joinResponse.json()

        if (joinData.success) {
          setLobbyId(createData.lobby_id)
          setJoined(true)
          setLobby(joinData.lobby)
          playerIdRef.current = joinData.player_id
          // Connect WebSocket AFTER joining
          setTimeout(() => {
            connectWebSocket(createData.lobby_id)
          }, 100)
        } else {
          setError(joinData.message)
        }
      }
    } catch (err) {
      setError('Failed to create lobby')
      console.error('Error:', err)
    } finally {
      setIsCreating(false)
    }
  }

  const joinLobby = async () => {
    if (!lobbyId.trim() || !playerName.trim()) {
      setError('Please enter both lobby ID and your name')
      return
    }

    try {
      const response = await fetch('http://127.0.0.1:8000/api/lobby/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lobby_id: lobbyId.trim(),
          player_name: playerName.trim(),
        }),
      })

      const data = await response.json()

      if (data.success) {
        setLobbyId(lobbyId.trim())
        setJoined(true)
        setLobby(data.lobby)
        playerIdRef.current = data.player_id
        // Connect WebSocket AFTER joining
        setTimeout(() => {
          connectWebSocket(lobbyId.trim())
        }, 100)
      } else {
        setError(data.message)
      }
    } catch (err) {
      setError('Failed to join lobby')
      console.error('Error:', err)
    }
  }

  const startGame = async () => {
    if (!lobbyIdRef.current) return
    
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/lobby/${lobbyIdRef.current}/start`, {
        method: 'POST',
      })
      const data = await response.json()
      
      if (data.success) {
        setGameStarted(true)
      } else {
        setError(data.message)
      }
    } catch (err) {
      setError('Failed to start game')
      console.error('Error:', err)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        if (wsRef.current._pingInterval) {
          clearInterval(wsRef.current._pingInterval)
        }
        wsRef.current.close()
      }
    }
  }, [])

  // Ready screen when game starts
  if (gameStarted && lobby) {
    return (
      <Container size="md" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        <Paper p="xl" style={{ width: '100%', maxWidth: 600 }}>
          <Stack gap="lg" align="center">
            <Title order={2} ta="center">Ready Screen</Title>
            <Text size="lg" ta="center">Game Starting...</Text>
            
            <div style={{ width: '100%' }}>
              <Text fw={500} mb="md" ta="center">Players:</Text>
              <List>
                {lobby.players.map((player) => (
                  <List.Item key={player.id} style={{ fontSize: '18px' }}>
                    {player.name}
                  </List.Item>
                ))}
              </List>
            </div>
            
            <Text size="sm" c="dimmed" ta="center">
              Preparing interview questions...
            </Text>
          </Stack>
        </Paper>
      </Container>
    )
  }

  if (joined && lobby) {
    return (
      <Container size="md" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        <Paper p="xl" style={{ width: '100%', maxWidth: 600 }}>
          <Stack gap="lg">
            <Title order={2} ta="center">Lobby: {lobby.id}</Title>
            <Text size="sm" c="dimmed" ta="center">Status: {lobby.status}</Text>
            
            <Group justify="center" gap="xs">
              <Text size="sm" fw={500}>Lobby ID:</Text>
              <Text size="sm" style={{ fontFamily: 'monospace' }}>{lobby.id}</Text>
              <ActionIcon variant="subtle" onClick={copyLobbyId} title="Copy lobby ID">
                {copied ? '✓' : '📋'}
              </ActionIcon>
            </Group>
            
            <div>
              <Text fw={500} mb="sm">Players ({lobby.players.length}/2):</Text>
              {lobby.players.length === 0 ? (
                <Text c="dimmed">No players yet</Text>
              ) : (
                <List>
                  {lobby.players.map((player) => (
                    <List.Item key={player.id}>{player.name}</List.Item>
                  ))}
                </List>
              )}
            </div>

            <Stack gap="sm">
              {lobby.players.length === 2 && lobby.status === 'waiting' && (
                <Button onClick={startGame} fullWidth size="lg" color="green">
                  Start Game
                </Button>
              )}
              <Button onClick={() => {
                setJoined(false)
                setLobby(null)
                setLobbyId('')
                setPlayerName('')
                setGameStarted(false)
                if (wsRef.current) {
                  wsRef.current.close()
                  wsRef.current = null
                }
              }} variant="outline">
                Leave Lobby
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Container>
    )
  }

  return (
    <Container size="sm" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
      <Paper p="xl" style={{ width: '100%' }}>
        <Stack gap="lg">
          <Title order={2} ta="center">Lobby</Title>
          
          <TextInput
            label="Your Name"
            placeholder="Enter your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            required
          />

          <TextInput
            label="Lobby ID (leave empty to create new)"
            placeholder="Enter lobby ID to join"
            value={lobbyId}
            onChange={(e) => setLobbyId(e.target.value)}
          />

          {error && <Text c="red" size="sm">{error}</Text>}

          <Stack gap="sm">
            {lobbyId.trim() ? (
              <Button onClick={joinLobby} fullWidth size="lg" loading={isCreating}>
                Join Lobby
              </Button>
            ) : (
              <Button onClick={createLobby} fullWidth size="lg" loading={isCreating}>
                Create Lobby
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>
    </Container>
  )
}
