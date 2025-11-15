from typing import Dict, Set, List
from datetime import datetime
import uuid

class LobbyManager:
    def __init__(self):
        self.lobbies: Dict[str, Dict] = {}
        self.connections: Dict[str, List] = {}  # lobby_id -> list of websocket connections
    
    def create_lobby(self) -> str:
        """Create a new lobby and return lobby ID"""
        lobby_id = str(uuid.uuid4())[:8]
        self.lobbies[lobby_id] = {
            "id": lobby_id,
            "players": [],
            "created_at": datetime.now().isoformat(),
            "status": "waiting"
        }
        self.connections[lobby_id] = []
        return lobby_id
    
    def join_lobby(self, lobby_id: str, player_name: str) -> tuple[bool, str, str]:
        """Join a lobby. Returns (success, message, player_id)"""
        lobby_id = lobby_id.strip()  # Remove whitespace
        print(f"Attempting to join lobby: '{lobby_id}'")
        print(f"Available lobbies: {list(self.lobbies.keys())}")
        
        if lobby_id not in self.lobbies:
            return False, f"Lobby not found. Available lobbies: {list(self.lobbies.keys())}", ""
        
        lobby = self.lobbies[lobby_id]
        
        # Max 2 players
        if len(lobby["players"]) >= 2:
            return False, "Lobby is full (max 2 players)", ""
        
        if player_name in [p["name"] for p in lobby["players"]]:
            return False, "Name already taken", ""
        
        player_id = str(uuid.uuid4())[:8]
        player = {
            "id": player_id,
            "name": player_name,
            "joined_at": datetime.now().isoformat()
        }
        lobby["players"].append(player)
        return True, "Joined successfully", player_id
    
    def leave_lobby(self, lobby_id: str, player_id: str = None, player_name: str = None):
        """Remove a player from a lobby"""
        if lobby_id in self.lobbies:
            lobby = self.lobbies[lobby_id]
            if player_id:
                lobby["players"] = [p for p in lobby["players"] if p.get("id") != player_id]
            elif player_name:
                lobby["players"] = [p for p in lobby["players"] if p.get("name") != player_name]
            
            # Clean up empty lobbies
            if len(lobby["players"]) == 0:
                del self.lobbies[lobby_id]
                if lobby_id in self.connections:
                    del self.connections[lobby_id]
    
    def get_lobby(self, lobby_id: str) -> Dict:
        """Get lobby info"""
        return self.lobbies.get(lobby_id, None)
    
    def start_game(self, lobby_id: str) -> tuple[bool, str]:
        """Start the game - move lobby to 'starting' status"""
        if lobby_id not in self.lobbies:
            return False, "Lobby not found"
        
        lobby = self.lobbies[lobby_id]
        
        if len(lobby["players"]) < 2:
            return False, "Need 2 players to start"
        
        if lobby["status"] != "waiting":
            return False, "Game already started"
        
        lobby["status"] = "starting"
        return True, "Game started"
    
    def add_connection(self, lobby_id: str, websocket):
        """Add WebSocket connection to lobby"""
        if lobby_id not in self.connections:
            self.connections[lobby_id] = []
        if websocket not in self.connections[lobby_id]:
            self.connections[lobby_id].append(websocket)
            print(f"Added WebSocket connection. Total connections for {lobby_id}: {len(self.connections[lobby_id])}")
    
    def remove_connection(self, lobby_id: str, websocket):
        """Remove WebSocket connection from lobby"""
        if lobby_id in self.connections:
            if websocket in self.connections[lobby_id]:
                self.connections[lobby_id].remove(websocket)
                print(f"Removed WebSocket connection. Total connections for {lobby_id}: {len(self.connections[lobby_id])}")
    
    async def broadcast_lobby_update(self, lobby_id: str):
        """Broadcast current lobby state to ALL WebSocket connections"""
        if lobby_id not in self.connections:
            print(f"No connections for lobby {lobby_id}")
            return
        
        lobby = self.get_lobby(lobby_id)
        if not lobby:
            print(f"Lobby {lobby_id} not found")
            return
        
        connections = self.connections[lobby_id].copy()
        print(f"Broadcasting to {len(connections)} connections in lobby {lobby_id}")
        
        disconnected = []
        for ws in connections:
            try:
                await ws.send_json({
                    "type": "lobby_update",
                    "lobby": lobby
                })
                print(f"✓ Sent update to WebSocket")
            except Exception as e:
                print(f"✗ Error sending to WebSocket: {e}")
                disconnected.append(ws)
        
        # Clean up disconnected connections
        for ws in disconnected:
            self.remove_connection(lobby_id, ws)

# Global lobby manager instance
lobby_manager = LobbyManager()
