# Interview Practice Application

A multiplayer interview practice application with real-time lobby system. Players can join lobbies, practice interviews, and receive scores.

## Features

- **Lobby System**: Create and join lobbies (max 2 players)
- **Real-time Sync**: WebSocket-based synchronization between clients
- **Start Game**: Begin interview sessions when both players are ready
- **Terminal Theme**: Dark theme with monospace font styling

## Tech Stack

- **Backend**: FastAPI (Python)
- **Frontend**: React + Vite + Mantine UI
- **Real-time**: WebSocket connections
- **State Management**: In-memory lobby manager

## Developer Setup

### Prerequisites

- Python 3.8+
- Node.js 16+
- npm or yarn

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Run the server:
```bash
python main.py
```

Backend runs on **http://127.0.0.1:8000**
- API Docs: http://127.0.0.1:8000/docs
- Health Check: http://127.0.0.1:8000/

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Run the dev server:
```bash
npm run dev
```

Frontend runs on **http://localhost:3000**

## Running Both Services

Open two terminal windows:

**Terminal 1** (Backend):
```bash
cd backend
python main.py
```

**Terminal 2** (Frontend):
```bash
cd frontend
npm run dev
```

## API Endpoints

### Lobby Management
- `POST /api/lobby/create` - Create a new lobby
- `POST /api/lobby/join` - Join a lobby
- `GET /api/lobby/{lobby_id}` - Get lobby information
- `POST /api/lobby/{lobby_id}/start` - Start the game
- `POST /api/lobby/{lobby_id}/leave` - Leave a lobby

### WebSocket
- `WS /ws/lobby/{lobby_id}` - Real-time lobby updates

## Project Structure

```
CodeJam25/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── lobby_manager.py      # Lobby state management
│   └── requirements.txt      # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Main app component
│   │   ├── components/
│   │   │   └── Lobby.jsx    # Lobby component
│   │   └── main.jsx         # React entry point
│   ├── package.json         # Node dependencies
│   └── vite.config.js      # Vite configuration
└── README.md
```

## Development Notes

- Backend uses `reload=False` to prevent losing in-memory lobby state
- WebSocket connections are managed per lobby
- Lobby state is stored in-memory (not persisted)
- Max 2 players per lobby
