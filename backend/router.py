from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
import json
import asyncio
from lobby.manager import lobby_manager

router = APIRouter()


class JoinLobbyRequest(BaseModel):
    lobby_id: str
    player_name: str


class LeaveLobbyRequest(BaseModel):
    player_id: str = None
    player_name: str = None


class TransferOwnershipRequest(BaseModel):
    new_owner_id: str
    current_owner_id: str


class KickPlayerRequest(BaseModel):
    player_id: str
    owner_id: str


class StartGameRequest(BaseModel):
    player_id: str
    match_type: str = None  # "job_posting" or "generalized"
    job_description: str = None
    role: str = None
    level: str = None
    match_config: dict = None


# Root route removed - frontend is served at / by main.py
# @router.get("/")
# async def root():
#     return {"message": "Hello World from FastAPI"}


@router.post("/api/lobby/create")
async def create_lobby():
    """Create a new lobby"""
    lobby_id = lobby_manager.create_lobby()
    # Verify lobby was created and still exists
    lobby = lobby_manager.get_lobby(lobby_id)
    if not lobby:
        print(f"ERROR: Lobby {lobby_id} was created but immediately disappeared!")
        return {"lobby_id": None, "message": "Failed to create lobby", "error": True}
    print(f"Verified lobby creation: {lobby_id}, players: {len(lobby.players)}, connections: {len(lobby.connections)}")
    print(f"All lobbies after create: {list(lobby_manager.lobbies.keys())}")
    return {"lobby_id": lobby_id, "message": "Lobby created"}


@router.post("/api/lobby/join")
async def join_lobby(request: JoinLobbyRequest):
    """Join a lobby via HTTP. Case-insensitive lobby ID matching."""
    lobby_id = request.lobby_id.strip()
    player_name = request.player_name.strip()
    print(f"Join request: lobby_id='{lobby_id}', player_name='{player_name}'")
    print(f"Current lobbies before join: {list(lobby_manager.lobbies.keys())}")
    print(f"Lobby manager has {len(lobby_manager.lobbies)} lobbies")
    
    # Find the actual lobby ID (case-correct) for case-insensitive lookup
    actual_lobby_id = None
    lobby_id_lower = lobby_id.lower()
    for key in lobby_manager.lobbies.keys():
        if key.lower() == lobby_id_lower:
            actual_lobby_id = key
            break
    
    if not actual_lobby_id:
        print(f"ERROR: Lobby '{lobby_id}' does not exist!")
        print(f"Available lobby IDs: {list(lobby_manager.lobbies.keys())}")
        print(f"Requested ID (stripped): '{lobby_id}'")
        # Try to find similar IDs
        similar = [lid for lid in lobby_manager.lobbies.keys() if lobby_id.lower() in lid.lower() or lid.lower() in lobby_id.lower()]
        if similar:
            print(f"Similar lobby IDs found: {similar}")
        return {"success": False, "message": f"Lobby not found. Available lobbies: {list(lobby_manager.lobbies.keys())}"}
    
    # Use the actual lobby ID (correct case) for all operations
    lobby_id = actual_lobby_id
    print(f"Found lobby {lobby_id} (matched from '{request.lobby_id.strip()}'), current players: {len(lobby_manager.lobbies[lobby_id].players)}")
    success, message, player_id = lobby_manager.join_lobby(lobby_id, player_name)
    
    if success:
        lobby = lobby_manager.get_lobby(lobby_id)
        if not lobby:
            print(f"ERROR: Lobby {lobby_id} disappeared after join!")
            return {"success": False, "message": "Lobby disappeared after join attempt"}
        print(f"Successfully joined lobby {lobby_id}, now has {len(lobby.players)} players")
        # Give a tiny moment for WebSocket connections to be ready, then broadcast
        await asyncio.sleep(0.1)
        await lobby_manager.broadcast_lobby_update(lobby_id)
        return {"success": True, "message": message, "player_id": player_id, "lobby": lobby.to_dict()}
    
    print(f"Failed to join: {message}")
    return {"success": False, "message": message}


@router.post("/api/lobby/{lobby_id}/start")
async def start_game(lobby_id: str, request: StartGameRequest):
    """Start the game - requires owner player_id"""
    success, message = lobby_manager.start_game(
        lobby_id, 
        request.player_id,
        match_type=request.match_type,
        job_description=request.job_description,
        role=request.role,
        level=request.level,
        match_config=request.match_config
    )
    if success:
        await lobby_manager.broadcast_lobby_update(lobby_id)
        return {"success": True, "message": message}
    return {"success": False, "message": message}


@router.post("/api/lobby/{lobby_id}/transfer-ownership")
async def transfer_ownership(lobby_id: str, request: TransferOwnershipRequest):
    """Transfer ownership to another player"""
    success, message = lobby_manager.transfer_ownership(
        lobby_id, 
        request.new_owner_id, 
        request.current_owner_id
    )
    if success:
        await lobby_manager.broadcast_lobby_update(lobby_id)
        return {"success": True, "message": message}
    return {"success": False, "message": message}


@router.post("/api/lobby/{lobby_id}/kick")
async def kick_player(lobby_id: str, request: KickPlayerRequest):
    """Kick a player from the lobby (owner only)"""
    lobby = lobby_manager.get_lobby(lobby_id)
    if not lobby:
        return {"success": False, "message": "Lobby not found"}
    
    # Verify requester is the owner
    if lobby.owner_id != request.owner_id:
        return {"success": False, "message": "Only the lobby owner can kick players"}
    
    # Don't allow kicking the owner
    if request.player_id == lobby.owner_id:
        return {"success": False, "message": "Cannot kick the lobby owner"}
    
    # Remove the player
    success = lobby.remove_player(player_id=request.player_id)
    if success:
        # Send kicked message to the kicked player's WebSocket BEFORE removing player from lobby
        # This ensures the message is sent while the connection is still active
        kicked_player_id = request.player_id
        connections = lobby.connections.copy()
        print(f"Sending kicked message to {len(connections)} connections for player {kicked_player_id}")
        for ws in connections:
            try:
                # Send kicked message to all connections - frontend will check if it's for them
                await ws.send_json({
                    "type": "kicked",
                    "player_id": kicked_player_id
                })
                print(f"✓ Sent kicked message to WebSocket")
            except Exception as e:
                print(f"✗ Error sending kicked message: {e}")
        
        # Now remove the player from lobby and clean up
        lobby_manager.leave_lobby(lobby_id, player_id=request.player_id)
        await lobby_manager.broadcast_lobby_update(lobby_id)
        return {"success": True, "message": "Player kicked successfully"}
    return {"success": False, "message": "Player not found"}


@router.post("/api/lobby/{lobby_id}/leave")
async def leave_lobby(lobby_id: str, request: LeaveLobbyRequest):
    """Leave a lobby"""
    print(f"Leave request: lobby_id='{lobby_id}', player_id='{request.player_id}', player_name='{request.player_name}'")
    
    # Get lobby before leaving to check if it exists
    lobby = lobby_manager.get_lobby(lobby_id)
    if not lobby:
        return {"success": False, "message": "Lobby not found"}
    
    lobby_manager.leave_lobby(lobby_id, player_id=request.player_id, player_name=request.player_name)
    
    # Broadcast update to remaining players
    await lobby_manager.broadcast_lobby_update(lobby_id)
    
    return {"success": True, "message": "Left lobby"}


@router.get("/api/lobby/{lobby_id}")
async def get_lobby(lobby_id: str):
    """Get lobby information"""
    lobby = lobby_manager.get_lobby(lobby_id)
    if lobby:
        return {"success": True, "lobby": lobby.to_dict()}
    return {"success": False, "message": "Lobby not found"}


@router.websocket("/ws/lobby/{lobby_id}")
async def websocket_lobby(websocket: WebSocket, lobby_id: str):
    """WebSocket endpoint for real-time lobby updates. Case-insensitive lobby ID matching."""
    await websocket.accept()
    
    # Find the actual lobby ID (case-correct) for case-insensitive lookup
    lobby_id_stripped = lobby_id.strip()
    actual_lobby_id = None
    lobby_id_lower = lobby_id_stripped.lower()
    for key in lobby_manager.lobbies.keys():
        if key.lower() == lobby_id_lower:
            actual_lobby_id = key
            break
    
    if not actual_lobby_id:
        print(f"WebSocket: Lobby '{lobby_id_stripped}' not found. Available: {list(lobby_manager.lobbies.keys())}")
        await websocket.close(code=1008, reason="Lobby not found")
        return
    
    lobby_id = actual_lobby_id
    print(f"WebSocket accepted for lobby {lobby_id} (matched from '{lobby_id_stripped}')")
    
    # Add connection to manager
    lobby_manager.add_connection(lobby_id, websocket)
    
    try:
        # Send current lobby state immediately
        lobby = lobby_manager.get_lobby(lobby_id)
        if lobby:
            await websocket.send_json({
                "type": "lobby_update",
                "lobby": lobby.to_dict()
            })
            print(f"Sent initial lobby state to WebSocket")
        
        # Keep connection alive and handle game messages
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                
                if message.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                elif message.get("type") == "submit_answer":
                    # Player submitted an answer - broadcast to all players in lobby
                    player_id = message.get("player_id")
                    print(f"Player {player_id} submitted answer in lobby {lobby_id}")
                    
                    # Broadcast player_submitted message to all connections in lobby
                    await lobby_manager.broadcast_game_message(
                        lobby_id,
                        {
                            "type": "player_submitted",
                            "player_id": player_id,
                            "questionId": message.get("questionId")
                        }
                    )
                elif message.get("type") == "timer_expired":
                    # Timer expired for a player - check if all timers expired
                    player_id = message.get("player_id")
                    print(f"Timer expired for player {player_id} in lobby {lobby_id}")
                    # Server can decide to show results if timer expired
                    await lobby_manager.broadcast_game_message(
                        lobby_id,
                        {
                            "type": "show_results",
                            "reason": "timer_expired"
                        }
                    )
                    
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
