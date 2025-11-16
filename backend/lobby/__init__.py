from typing import List, Dict, Optional, Any
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
        self.match: Optional[Any] = None  # Match instance (imported from matches module to avoid circular import)
        self.owner_id: str = None  # Player ID of the lobby owner
        
        # Match configuration - set when lobby is created/configured
        self.match_type: Optional[str] = None  # "job_posting" or "generalized"
        self.job_description: Optional[str] = None
        self.role: Optional[str] = None
        self.level: Optional[str] = None
        self.match_config: Dict = {}  # Additional configuration
    
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
        
        # Set first player as owner if no owner exists
        if self.owner_id is None:
            self.owner_id = player_id
            print(f"Set {player_name} ({player_id}) as lobby owner")
        
        return True, "Joined successfully", player_id
    
    def remove_player(self, player_id: str = None, player_name: str = None) -> bool:
        """Remove a player from the lobby. Returns True if player was removed"""
        initial_count = len(self.players)
        
        # Find the player being removed
        removed_player_id = None
        if player_id:
            removed_player_id = player_id
            self.players = [p for p in self.players if p.get("id") != player_id]
        elif player_name:
            player = next((p for p in self.players if p.get("name") == player_name), None)
            if player:
                removed_player_id = player.get("id")
            self.players = [p for p in self.players if p.get("name") != player_name]
        
        # If owner left, transfer ownership to next player
        if removed_player_id == self.owner_id and len(self.players) > 0:
            self.owner_id = self.players[0]["id"]
            print(f"Owner left, transferred ownership to {self.players[0]['name']} ({self.owner_id})")
        elif removed_player_id == self.owner_id:
            self.owner_id = None
            print("Owner left and lobby is now empty")
        
        return len(self.players) < initial_count
    
    def is_empty(self) -> bool:
        """Check if lobby has no players"""
        return len(self.players) == 0
    
    def can_start(self) -> bool:
        """Check if game can be started"""
        return len(self.players) >= self.MIN_PLAYERS and self.status == "waiting"
    
    def start_game(self, player_id: str = None) -> tuple[bool, str]:
        """Start the game. Returns (success, message)"""
        # Check if player is the owner
        if player_id and player_id != self.owner_id:
            return False, "Only the lobby owner can start the game"
        
        if len(self.players) < self.MIN_PLAYERS:
            return False, f"Need at least {self.MIN_PLAYERS} players to start"
        
        if self.status != "waiting":
            return False, "Game already started"
        
        self.status = "starting"
        # Match will be created by LobbyManager after this returns
        return True, "Game started"
    
    def transfer_ownership(self, new_owner_id: str, current_owner_id: str) -> tuple[bool, str]:
        """Transfer ownership to another player. Returns (success, message)"""
        # Verify current owner
        if current_owner_id != self.owner_id:
            return False, "Only the current owner can transfer ownership"
        
        # Verify new owner exists in lobby
        new_owner = next((p for p in self.players if p.get("id") == new_owner_id), None)
        if not new_owner:
            return False, "New owner not found in lobby"
        
        # Transfer ownership
        old_owner_name = next((p["name"] for p in self.players if p.get("id") == self.owner_id), "Unknown")
        self.owner_id = new_owner_id
        print(f"Ownership transferred from {old_owner_name} to {new_owner['name']} ({new_owner_id})")
        return True, f"Ownership transferred to {new_owner['name']}"
    
    def set_match(self, match_instance):
        """Set the match instance for this lobby"""
        self.match = match_instance
        if match_instance:
            self.status = "in_progress"
    
    def handle_match_event(self, event_type: str, data: Dict[str, Any]):
        """Handle events from the Match instance"""
        # Update lobby status based on match events
        if event_type == "match_started":
            self.status = "in_progress"
        elif event_type == "match_completed":
            self.status = "completed"
        
        # This method will be called by Match, and LobbyManager will broadcast updates
        # The actual broadcasting is handled by LobbyManager.broadcast_lobby_update()
    
    def add_connection(self, websocket):
        """Add a WebSocket connection to this lobby"""
        # Check if this websocket is already in the list
        # Use identity check (is) instead of equality check for WebSocket objects
        for existing_ws in self.connections:
            if existing_ws is websocket:
                print(f"WebSocket connection already exists for {self.id}, skipping duplicate add")
                return
        
        self.connections.append(websocket)
        print(f"Added WebSocket connection. Total connections for {self.id}: {len(self.connections)}")
    
    def remove_connection(self, websocket):
        """Remove a WebSocket connection from this lobby"""
        initial_count = len(self.connections)
        # Remove all instances of this websocket (should only be one, but be safe)
        self.connections = [ws for ws in self.connections if ws is not websocket]
        removed_count = initial_count - len(self.connections)
        if removed_count > 0:
            print(f"Removed {removed_count} WebSocket connection(s). Total connections for {self.id}: {len(self.connections)}")
        else:
            print(f"WebSocket connection not found in lobby {self.id} (already removed or never added)")
    
    def to_dict(self) -> Dict:
        """Convert lobby to dictionary for JSON serialization"""
        result = {
            "id": self.id,
            "players": self.players,
            "created_at": self.created_at,
            "status": self.status,
            "owner_id": self.owner_id
        }
        
        # Include match information if available
        if self.match:
            result["match"] = self.match.get_state()
        
        return result

