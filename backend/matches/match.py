"""
Match class - represents an active game match
Handles game state, database operations, and lobby communication
"""
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime
import uuid
from sqlalchemy.orm import Session
from database import SessionLocal, OngoingMatch
from database.game_state import update_phase, update_scores


class Match:
    """Represents an active game match"""
    
    def __init__(
        self, 
        match_id: str, 
        lobby_id: str, 
        players: List[Dict], 
        match_type: str,
        job_description: Optional[str] = None,
        role: Optional[str] = None,
        level: Optional[str] = None,
        match_config: Optional[Dict] = None,
        lobby_callback: Optional[Callable] = None
    ):
        """
        Initialize a new match
        
        Args:
            match_id: Unique identifier for this match
            lobby_id: ID of the lobby this match belongs to
            players: List of player dictionaries from the lobby
            match_type: Type of match - "job_posting" or "generalized"
            job_description: Job description text (for job_posting type)
            role: Role name (for generalized type) - e.g., "Frontend", "Backend"
            level: Level name (for generalized type) - e.g., "Junior", "Senior"
            match_config: Additional configuration as dictionary
            lobby_callback: Optional callback function to notify lobby of changes
        """
        self.match_id = match_id
        self.lobby_id = lobby_id
        self.players = players.copy()  # Copy player list
        self.created_at = datetime.utcnow()
        self.started_at: Optional[datetime] = None
        self.completed_at: Optional[datetime] = None
        
        # Match configuration - consolidate everything into match_config
        self.match_type = match_type  # "job_posting" or "generalized"
        self.match_config = match_config or {}
        
        # Store job-specific or role-specific config in match_config
        if match_type == "job_posting" and job_description:
            self.match_config["job_description"] = job_description
        elif match_type == "generalized":
            if role:
                self.match_config["role"] = role
            if level:
                self.match_config["level"] = level
        
        # Game state
        self.status = "starting"  # starting, in_progress, completed
        self.current_round = 0
        self.scores: Dict[str, int] = {player["id"]: 0 for player in players}
        self.total_questions = 0
        
        # Lobby callback for triggering updates
        self.lobby_callback = lobby_callback
        
        # Initialize match in database
        self._create_match_record()
    
    def _create_match_record(self):
        """Create initial match record in database"""
        db: Session = SessionLocal()
        try:
            # Check if match already exists
            existing = db.query(OngoingMatch).filter(OngoingMatch.match_id == self.match_id).first()
            if existing:
                print(f"Match {self.match_id} already exists in database")
                return
            
            # Create new match record
            match_record = OngoingMatch(
                match_id=self.match_id,
                lobby_id=self.lobby_id,
                created_at=self.created_at,
                started_at=None,
                completed_at=None,
                match_type=self.match_type,
                match_config=self.match_config,
                players=self.players,
                game_state={
                    "scores": {player["id"]: 0 for player in self.players},
                    "current_round": 0,
                    "total_questions": 0
                },
                match_summary_text=None,
                winner_id=None,
                total_questions=0,
                duration_seconds=None
            )
            
            db.add(match_record)
            db.commit()
            print(f"Created match record {self.match_id} in database (type: {self.match_type})")
        except Exception as e:
            db.rollback()
            print(f"Error creating match record: {e}")
            import traceback
            traceback.print_exc()
        finally:
            db.close()
    
    def start(self):
        """Start the match"""
        if self.status != "starting":
            return False
        
        self.started_at = datetime.utcnow()
        self.status = "in_progress"
        
        # Update database
        self._update_match_record()
        
        # Update phase to tutorial
        update_phase(
            match_id=self.match_id,
            phase="tutorial",
            phase_data={
                "status": "in_progress",
                "started_at": self.started_at.isoformat()
            }
        )
        
        # Notify lobby
        self._notify_lobby("match_started", {
            "match_id": self.match_id,
            "started_at": self.started_at.isoformat(),
            "players": self.players,
            "scores": self.scores
        })
        
        return True
    
    def update_score(self, player_id: str, points: int, phase: Optional[str] = None):
        """Update a player's score"""
        if player_id not in self.scores:
            print(f"Warning: Player {player_id} not found in match")
            return False
        
        self.scores[player_id] += points
        
        # Update database
        self._update_match_record()
        
        # Update scores in database with phase-specific tracking
        update_scores(
            match_id=self.match_id,
            scores=self.scores,
            phase=phase
        )
        
        # Notify lobby
        self._notify_lobby("score_updated", {
            "match_id": self.match_id,
            "player_id": player_id,
            "new_score": self.scores[player_id],
            "points_added": points,
            "all_scores": self.scores
        })
        
        return True
    
    def add_question(self):
        """Increment question count"""
        self.total_questions += 1
        self._update_match_record()
    
    def complete(self, winner_id: Optional[str] = None, match_summary_text: Optional[str] = None):
        """Complete the match"""
        if self.status == "completed":
            return False
        
        self.completed_at = datetime.utcnow()
        self.status = "completed"
        
        # Calculate duration
        duration_seconds = None
        if self.started_at:
            duration_seconds = int((self.completed_at - self.started_at).total_seconds())
        
        # Update game state with final state
        final_game_state = {
            "scores": self.scores,
            "current_round": self.current_round,
            "total_questions": self.total_questions,
            "duration_seconds": duration_seconds,
            "status": "completed"
        }
        
        # Determine winner if not provided
        if not winner_id and self.scores:
            winner_id = max(self.scores.items(), key=lambda x: x[1])[0]
        
        # Update database
        db: Session = SessionLocal()
        try:
            match_record = db.query(OngoingMatch).filter(OngoingMatch.match_id == self.match_id).first()
            if match_record:
                match_record.completed_at = self.completed_at
                match_record.game_state = final_game_state
                match_record.winner_id = winner_id
                match_record.match_summary_text = match_summary_text
                match_record.total_questions = self.total_questions
                match_record.duration_seconds = duration_seconds
                
                db.commit()
                print(f"Completed match {self.match_id} in database")
        except Exception as e:
            db.rollback()
            print(f"Error completing match record: {e}")
        finally:
            db.close()
        
        # Notify lobby
        self._notify_lobby("match_completed", {
            "match_id": self.match_id,
            "completed_at": self.completed_at.isoformat(),
            "winner_id": winner_id,
            "final_scores": self.scores,
            "game_state": final_game_state
        })
        
        return True
    
    def _update_match_record(self):
        """Update match record in database"""
        db: Session = SessionLocal()
        try:
            match_record = db.query(OngoingMatch).filter(OngoingMatch.match_id == self.match_id).first()
            if match_record:
                match_record.started_at = self.started_at
                match_record.total_questions = self.total_questions
                match_record.game_state = {
                    "scores": self.scores,
                    "current_round": self.current_round,
                    "total_questions": self.total_questions,
                    "status": self.status
                }
                
                db.commit()
        except Exception as e:
            db.rollback()
            print(f"Error updating match record: {e}")
        finally:
            db.close()
    
    def _notify_lobby(self, event_type: str, data: Dict[str, Any]):
        """Notify lobby of match events"""
        if self.lobby_callback:
            try:
                self.lobby_callback(event_type, data)
            except Exception as e:
                print(f"Error notifying lobby: {e}")
    
    def get_state(self) -> Dict[str, Any]:
        """Get current match state"""
        return {
            "match_id": self.match_id,
            "lobby_id": self.lobby_id,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "match_type": self.match_type,
            "match_config": self.match_config,
            "players": self.players,
            "scores": self.scores,
            "current_round": self.current_round,
            "total_questions": self.total_questions
        }
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert match to dictionary (alias for get_state)"""
        return self.get_state()

