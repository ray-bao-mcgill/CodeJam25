from typing import Dict, Any
import asyncio
import uuid
from lobby import Lobby
from matches import Match


class LobbyManager:
    """Manages multiple Lobby instances"""
    
    def __init__(self):
        self.lobbies: Dict[str, Lobby] = {}
    
    def create_lobby(self) -> str:
        """Create a new lobby and return lobby ID"""
        lobby = Lobby()
        self.lobbies[lobby.id] = lobby
        print(f"Created lobby {lobby.id}. Total lobbies: {len(self.lobbies)}")
        print(f"Lobby IDs: {list(self.lobbies.keys())}")
        return lobby.id
    
    def get_lobby(self, lobby_id: str) -> Lobby:
        """Get a lobby by ID. Returns None if not found. Case-insensitive lookup."""
        lobby_id = lobby_id.strip()
        # Try exact match first
        lobby = self.lobbies.get(lobby_id, None)
        if lobby:
            return lobby
        
        # Try case-insensitive lookup
        lobby_id_lower = lobby_id.lower()
        for key, value in self.lobbies.items():
            if key.lower() == lobby_id_lower:
                print(f"Found lobby '{key}' via case-insensitive match for '{lobby_id}'")
                return value
        
        print(f"Lobby '{lobby_id}' not found. Available: {list(self.lobbies.keys())}")
        return None
    
    def join_lobby(self, lobby_id: str, player_name: str) -> tuple[bool, str, str]:
        """Join a lobby. Returns (success, message, player_id). Case-insensitive lobby lookup."""
        lobby_id = lobby_id.strip()
        print(f"Attempting to join lobby: '{lobby_id}'")
        print(f"Available lobbies: {list(self.lobbies.keys())}")
        
        lobby = self.get_lobby(lobby_id)
        if not lobby:
            return False, f"Lobby not found. Available lobbies: {list(self.lobbies.keys())}", ""
        
        # Use the actual lobby ID from the dictionary key (case-correct)
        actual_lobby_id = None
        lobby_id_lower = lobby_id.lower()
        for key in self.lobbies.keys():
            if key.lower() == lobby_id_lower:
                actual_lobby_id = key
                break
        
        return lobby.add_player(player_name.strip())
    
    def leave_lobby(self, lobby_id: str, player_id: str = None, player_name: str = None):
        """Remove a player from a lobby"""
        lobby = self.get_lobby(lobby_id)
        if not lobby:
            print(f"Warning: Attempted to leave non-existent lobby {lobby_id}")
            return
        
        lobby.remove_player(player_id=player_id, player_name=player_name)
        print(f"Player removed from lobby {lobby_id}. Remaining players: {len(lobby.players)}")
        
        # Only clean up empty lobbies if they have no connections AND no players
        # Don't delete immediately - let them persist for a bit in case someone is joining
        if lobby.is_empty() and len(lobby.connections) == 0:
            print(f"Cleaning up empty lobby {lobby_id}")
            del self.lobbies[lobby.id]
    
    def start_game(
        self, 
        lobby_id: str, 
        player_id: str = None,
        match_type: str = None,
        job_description: str = None,
        role: str = None,
        level: str = None,
        match_config: Dict = None
    ) -> tuple[bool, str]:
        """Start the game in a lobby and create a Match instance"""
        lobby = self.get_lobby(lobby_id)
        if not lobby:
            return False, "Lobby not found"
        
        # Try to start the game in the lobby
        success, message = lobby.start_game(player_id)
        if not success:
            return False, message
        
        # Use provided match configuration or fall back to lobby's stored configuration
        final_match_type = match_type or lobby.match_type or "generalized"
        final_job_description = job_description or lobby.job_description
        final_role = role or lobby.role
        final_level = level or lobby.level
        final_match_config = match_config or lobby.match_config or {}
        
        # Validate match configuration based on type
        if final_match_type == "job_posting" and not final_job_description:
            return False, "Job description is required for job_posting match type"
        elif final_match_type == "generalized" and (not final_role or not final_level):
            return False, "Role and level are required for generalized match type"
        
        # Create a Match instance
        match_id = str(uuid.uuid4())
        
        # Create callback function for Match to notify lobby
        # This callback will be called synchronously by Match, but we need to handle async broadcasts
        def match_callback(event_type: str, data: Dict):
            """Callback for Match to notify lobby of events"""
            # Handle the event in the lobby
            lobby.handle_match_event(event_type, data)
            # Schedule async broadcast if event loop is running
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    loop.create_task(self.broadcast_lobby_update(lobby_id))
                else:
                    # If no event loop, the router will handle broadcasting
                    pass
            except RuntimeError:
                # No event loop available, router will handle broadcasting
                pass
        
        # Create and set the match
        match = Match(
            match_id=match_id,
            lobby_id=lobby_id,
            players=lobby.players,
            match_type=final_match_type,
            job_description=final_job_description,
            role=final_role,
            level=final_level,
            match_config=final_match_config,
            lobby_callback=match_callback
        )
        
        lobby.set_match(match)
        
        # Start the match
        match.start()
        
        print(f"Created and started match {match_id} for lobby {lobby_id} (type: {final_match_type})")
        return True, f"Game started with match {match_id}"
    
    def transfer_ownership(self, lobby_id: str, new_owner_id: str, current_owner_id: str) -> tuple[bool, str]:
        """Transfer ownership in a lobby"""
        lobby = self.get_lobby(lobby_id)
        if not lobby:
            return False, "Lobby not found"
        
        return lobby.transfer_ownership(new_owner_id, current_owner_id)
    
    def add_connection(self, lobby_id: str, websocket):
        """Add WebSocket connection to a lobby"""
        lobby = self.get_lobby(lobby_id)
        if lobby:
            lobby.add_connection(websocket)
    
    def remove_connection(self, lobby_id: str, websocket):
        """Remove WebSocket connection from a lobby"""
        lobby = self.get_lobby(lobby_id)
        if lobby:
            lobby.remove_connection(websocket)
    
    async def broadcast_lobby_update(self, lobby_id: str):
        """Broadcast current lobby state to ALL WebSocket connections in a lobby"""
        lobby = self.get_lobby(lobby_id)
        if not lobby:
            print(f"Lobby {lobby_id} not found")
            return
        
        if len(lobby.connections) == 0:
            print(f"No connections for lobby {lobby_id}")
            return
        
        connections = lobby.connections.copy()
        print(f"Broadcasting to {len(connections)} connections in lobby {lobby_id}")
        
        disconnected = []
        for ws in connections:
            try:
                await ws.send_json({
                    "type": "lobby_update",
                    "lobby": lobby.to_dict()
                })
                print(f"✓ Sent update to WebSocket")
            except Exception as e:
                print(f"✗ Error sending to WebSocket: {e}")
                disconnected.append(ws)
        
        # Clean up disconnected connections
        for ws in disconnected:
            lobby.remove_connection(ws)
    
    async def broadcast_game_message(self, lobby_id: str, message: dict):
        """Broadcast a game message to ALL WebSocket connections in a lobby"""
        lobby = self.get_lobby(lobby_id)
        if not lobby:
            print(f"Lobby {lobby_id} not found for game message broadcast")
            return
        
        if len(lobby.connections) == 0:
            print(f"No connections for lobby {lobby_id}")
            return
        
        connections = lobby.connections.copy()
        print(f"Broadcasting game message {message.get('type')} to {len(connections)} connections in lobby {lobby_id}")
        
        disconnected = []
        for ws in connections:
            try:
                await ws.send_json(message)
                print(f"✓ Sent game message to WebSocket")
            except Exception as e:
                print(f"✗ Error sending game message to WebSocket: {e}")
                disconnected.append(ws)
        
        # Clean up disconnected connections
        for ws in disconnected:
            lobby.remove_connection(ws)


# Global lobby manager instance
lobby_manager = LobbyManager()

