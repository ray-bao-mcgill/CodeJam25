from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import json
import asyncio
from lobby_manager import lobby_manager

app = FastAPI()

# CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class JoinLobbyRequest(BaseModel):
    lobby_id: str
    player_name: str


class LeaveLobbyRequest(BaseModel):
    player_id: str = None
    player_name: str = None


@app.get("/")
async def root():
    return {"message": "Hello World from FastAPI"}


@app.post("/api/lobby/create")
async def create_lobby():
    """Create a new lobby"""
    lobby_id = lobby_manager.create_lobby()
    print(f"Created lobby: {lobby_id}")
    print(f"Total lobbies: {len(lobby_manager.lobbies)}")
    return {"lobby_id": lobby_id, "message": "Lobby created"}


@app.post("/api/lobby/join")
async def join_lobby(request: JoinLobbyRequest):
    """Join a lobby via HTTP"""
    print(f"Join request: lobby_id='{request.lobby_id}', player_name='{request.player_name}'")
    success, message, player_id = lobby_manager.join_lobby(request.lobby_id.strip(), request.player_name.strip())
    if success:
        lobby = lobby_manager.get_lobby(request.lobby_id)
        # Give a tiny moment for WebSocket connections to be ready, then broadcast
        await asyncio.sleep(0.1)
        await lobby_manager.broadcast_lobby_update(request.lobby_id)
        return {"success": True, "message": message, "player_id": player_id, "lobby": lobby}
    return {"success": False, "message": message}


@app.post("/api/lobby/{lobby_id}/start")
async def start_game(lobby_id: str):
    """Start the game"""
    success, message = lobby_manager.start_game(lobby_id)
    if success:
        await lobby_manager.broadcast_lobby_update(lobby_id)
        return {"success": True, "message": message}
    return {"success": False, "message": message}


@app.post("/api/lobby/{lobby_id}/leave")
async def leave_lobby(lobby_id: str, request: LeaveLobbyRequest):
    """Leave a lobby"""
    lobby_manager.leave_lobby(lobby_id, player_id=request.player_id, player_name=request.player_name)
    await lobby_manager.broadcast_lobby_update(lobby_id)
    return {"success": True, "message": "Left lobby"}


@app.get("/api/lobby/{lobby_id}")
async def get_lobby(lobby_id: str):
    """Get lobby information"""
    lobby = lobby_manager.get_lobby(lobby_id)
    if lobby:
        return {"success": True, "lobby": lobby}
    return {"success": False, "message": "Lobby not found"}


@app.websocket("/ws/lobby/{lobby_id}")
async def websocket_lobby(websocket: WebSocket, lobby_id: str):
    """WebSocket endpoint for real-time lobby updates"""
    await websocket.accept()
    print(f"WebSocket accepted for lobby {lobby_id}")
    
    # Add connection to manager
    lobby_manager.add_connection(lobby_id, websocket)
    
    try:
        # Send current lobby state immediately
        lobby = lobby_manager.get_lobby(lobby_id)
        if lobby:
            await websocket.send_json({
                "type": "lobby_update",
                "lobby": lobby
            })
            print(f"Sent initial lobby state to WebSocket")
        
        # Keep connection alive
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                
                if message.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                    
            except WebSocketDisconnect:
                print(f"WebSocket disconnected normally")
                break
            except json.JSONDecodeError:
                continue
            except Exception as e:
                print(f"WebSocket error: {e}")
                break
    
    except WebSocketDisconnect:
        print(f"WebSocket disconnected")
    finally:
        lobby_manager.remove_connection(lobby_id, websocket)
        # Broadcast updated state after disconnection
        await lobby_manager.broadcast_lobby_update(lobby_id)


if __name__ == "__main__":
    print("Starting FastAPI server on http://127.0.0.1:8000")
    print("NOTE: Using reload=False to prevent losing in-memory lobbies")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False)
