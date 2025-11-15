import { useState } from 'react'
import { Title, Button, Container, Stack } from '@mantine/core'
import Lobby from './components/Lobby'
import './App.css'

export default function App() {
  const [showLobby, setShowLobby] = useState(false)

  if (showLobby) {
    return (
      <div className="landing-page">
        <div className="geometric-bg">
          <div className="shape shape-1"></div>
          <div className="shape shape-2"></div>
          <div className="shape shape-3"></div>
          <div className="shape shape-4"></div>
          <div className="shape shape-5"></div>
          <div className="grid-overlay"></div>
        </div>
        <Lobby />
      </div>
    )
  }

  return (
    <div className="landing-page">
      {/* Background geometric shapes */}
      <div className="geometric-bg">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
        <div className="shape shape-4"></div>
        <div className="shape shape-5"></div>
        <div className="grid-overlay"></div>
      </div>

      <Container size="lg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        <Stack align="center" gap="xl">
          <Title order={1} ta="center" className="main-title">Interview Prep</Title>
          <Button onClick={() => setShowLobby(true)} size="lg">Join Lobby</Button>
        </Stack>
      </Container>
    </div>
  )
}
