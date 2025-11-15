from typing import List, Dict
from datetime import datetime
import uuid


class Lobby:
    """Represents a single lobby instance"""
    
    MIN_PLAYERS = 2
    MAX_PLAYERS = 8
    
    def __init__(self, lobby_id: str = None):
        self.id = lobby_id or str(uuid.uuid4())[:8]
        self.players: List[Dict] = []
        self.created_at = datetime.now().isoformat()
        self.status = "waiting"  # waiting, starting, in_progress, completed
        self.connections: List = []  # WebSocket connections
    
    def add_player(self, player_name: str) -> tuple[bool, str, str]:
        """Add a player to the lobby. Returns (success, message, player_id)"""
        # Check if lobby is full
        if len(self.players) >= self.MAX_PLAYERS:
            return False, f"Lobby is full (max {self.MAX_PLAYERS} players)", ""
        
        # Check if name is already taken
        if player_name in [p["name"] for p in self.players]:
            return False, "Name already taken", ""
        
        # Create player
        player_id = str(uuid.uuid4())[:8]
        player = {
            "id": player_id,
            "name": player_name,
            "joined_at": datetime.now().isoformat()
        }
        self.players.append(player)
        return True, "Joined successfully", player_id
    
    def remove_player(self, player_id: str = None, player_name: str = None) -> bool:
        """Remove a player from the lobby. Returns True if player was removed"""
        initial_count = len(self.players)
        
        if player_id:
            self.players = [p for p in self.players if p.get("id") != player_id]
        elif player_name:
            self.players = [p for p in self.players if p.get("name") != player_name]
        
        return len(self.players) < initial_count
    
    def is_empty(self) -> bool:
        """Check if lobby has no players"""
        return len(self.players) == 0
    
    def can_start(self) -> bool:
        """Check if game can be started"""
        return len(self.players) >= self.MIN_PLAYERS and self.status == "waiting"
    
    def start_game(self) -> tuple[bool, str]:
        """Start the game. Returns (success, message)"""
        if len(self.players) < self.MIN_PLAYERS:
            return False, f"Need at least {self.MIN_PLAYERS} players to start"
        
        if self.status != "waiting":
            return False, "Game already started"
        
        self.status = "starting"
        return True, "Game started"
    
    def add_connection(self, websocket):
        """Add a WebSocket connection to this lobby"""
        if websocket not in self.connections:
            self.connections.append(websocket)
            print(f"Added WebSocket connection. Total connections for {self.id}: {len(self.connections)}")
    
    def remove_connection(self, websocket):
        """Remove a WebSocket connection from this lobby"""
        if websocket in self.connections:
            self.connections.remove(websocket)
            print(f"Removed WebSocket connection. Total connections for {self.id}: {len(self.connections)}")
    
    def to_dict(self) -> Dict:
        """Convert lobby to dictionary for JSON serialization"""
        return {
            "id": self.id,
            "players": self.players,
            "created_at": self.created_at,
            "status": self.status
        }

