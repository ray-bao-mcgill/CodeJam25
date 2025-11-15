from typing import Dict
from lobby import Lobby


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
        """Get a lobby by ID. Returns None if not found."""
        lobby_id = lobby_id.strip()
        lobby = self.lobbies.get(lobby_id, None)
        if not lobby:
            print(f"Lobby '{lobby_id}' not found. Available: {list(self.lobbies.keys())}")
        return lobby
    
    def join_lobby(self, lobby_id: str, player_name: str) -> tuple[bool, str, str]:
        """Join a lobby. Returns (success, message, player_id)"""
        lobby_id = lobby_id.strip()
        print(f"Attempting to join lobby: '{lobby_id}'")
        print(f"Available lobbies: {list(self.lobbies.keys())}")
        
        lobby = self.get_lobby(lobby_id)
        if not lobby:
            return False, f"Lobby not found. Available lobbies: {list(self.lobbies.keys())}", ""
        
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
    
    def start_game(self, lobby_id: str) -> tuple[bool, str]:
        """Start the game in a lobby"""
        lobby = self.get_lobby(lobby_id)
        if not lobby:
            return False, "Lobby not found"
        
        return lobby.start_game()
    
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


# Global lobby manager instance
lobby_manager = LobbyManager()
