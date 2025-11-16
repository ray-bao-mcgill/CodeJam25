"""
Phase Manager - Tracks game phase state and enforces end criteria
"""
from typing import Dict, Set, List, Optional, Any
from datetime import datetime
from database.game_state import get_match_by_lobby_id, get_scores_for_phase
from database import SessionLocal, OngoingMatch


class PhaseManager:
    """Manages phase state and tracks completion criteria"""
    
    def __init__(self):
        # Track phase state per match: {match_id: {phase: PhaseState}}
        self.phase_states: Dict[str, Dict[str, 'PhaseState']] = {}
    
    def get_phase_state(self, match_id: str, phase: str) -> 'PhaseState':
        """Get or create phase state for a match"""
        if match_id not in self.phase_states:
            self.phase_states[match_id] = {}
        
        if phase not in self.phase_states[match_id]:
            phase_state = PhaseState(phase)
            phase_state.match_id = match_id  # Store match_id for sub-phase checks
            self.phase_states[match_id][phase] = phase_state
        
        return self.phase_states[match_id][phase]
    
    def record_submission(self, match_id: str, phase: str, player_id: str, question_index: Optional[int] = None):
        """Record that a player submitted an answer"""
        phase_state = self.get_phase_state(match_id, phase)
        phase_state.record_submission(player_id, question_index)
        
        # Also record in parent phase if this is a sub-phase
        parent_phase = phase_state.criteria.get("parent_phase")
        if parent_phase:
            parent_state = self.get_phase_state(match_id, parent_phase)
            # Map sub-phase to question index: theory=0, practical=1
            mapped_index = 0 if phase == "technical_theory" else 1
            parent_state.record_submission(player_id, mapped_index)
    
    def check_phase_complete(self, match_id: str, phase: str, total_players: int, player_ids: Optional[List[str]] = None) -> bool:
        """Check if phase completion criteria are met"""
        phase_state = self.get_phase_state(match_id, phase)
        return phase_state.is_complete(total_players, self, player_ids=player_ids)
    
    def get_submission_status(self, match_id: str, phase: str) -> Dict[str, Any]:
        """Get current submission status for a phase"""
        phase_state = self.get_phase_state(match_id, phase)
        return phase_state.get_status()
    
    def reset_phase(self, match_id: str, phase: str):
        """Reset phase state (for new phase)"""
        if match_id in self.phase_states:
            if phase in self.phase_states[match_id]:
                del self.phase_states[match_id][phase]


class PhaseState:
    """Tracks state for a single phase"""
    
    # Define end criteria for each phase
    PHASE_CRITERIA = {
        "behavioural": {
            "questions_required": 2,  # Initial question + follow-up
            "all_players_must_submit": True,
            "sub_phases": None  # No sub-phases
        },
        "technical_theory": {
            "questions_required": 10,
            "all_players_must_submit": True,
            "sub_phases": None
        },
        "technical": {
            "questions_required": 2,  # Theory + Practical
            "all_players_must_submit": True,
            "sub_phases": ["technical_theory", "technical_practical"]  # Track both sub-phases
        },
        "technical_theory": {
            "questions_required": 1,
            "all_players_must_submit": True,
            "sub_phases": None,
            "parent_phase": "technical"  # Part of technical phase
        },
        "technical_practical": {
            "questions_required": 1,
            "all_players_must_submit": True,
            "sub_phases": None,
            "parent_phase": None  # Standalone phase
        }
    }
    
    def __init__(self, phase: str):
        self.phase = phase
        # Track submissions per player: {player_id: set(question_indices)}
        self.player_submissions: Dict[str, Set[int]] = {}
        # Track which question indices have been answered
        self.question_submissions: Dict[int, Set[str]] = {}
        self.criteria = self.PHASE_CRITERIA.get(phase, {
            "questions_required": 1,
            "all_players_must_submit": True
        })
    
    def record_submission(self, player_id: str, question_index: Optional[int] = None):
        """Record a submission from a player"""
        # Use 0 as default if question_index is None (for single-question phases)
        idx = question_index if question_index is not None else 0
        
        # Track player's submissions
        if player_id not in self.player_submissions:
            self.player_submissions[player_id] = set()
        self.player_submissions[player_id].add(idx)
        
        # Track question submissions
        if idx not in self.question_submissions:
            self.question_submissions[idx] = set()
        self.question_submissions[idx].add(player_id)
    
    def is_complete(self, total_players: int, phase_manager_instance=None, player_ids: Optional[List[str]] = None) -> bool:
        """Check if phase completion criteria are met"""
        required_questions = self.criteria["questions_required"]
        all_must_submit = self.criteria["all_players_must_submit"]
        sub_phases = self.criteria.get("sub_phases")
        
        # For technical phase, check if both sub-phases are complete
        if sub_phases and phase_manager_instance and hasattr(self, 'match_id'):
            # Check if all sub-phases are complete
            for sub_phase in sub_phases:
                sub_phase_state = phase_manager_instance.get_phase_state(self.match_id, sub_phase)
                if not sub_phase_state.is_complete(total_players, phase_manager_instance, player_ids=player_ids):
                    return False
            return True
        
        # For technical_theory phase, get dynamic question count and dead players
        dead_players_set = set()
        if self.phase == "technical_theory" and hasattr(self, 'match_id'):
            from database import SessionLocal, OngoingMatch
            db = SessionLocal()
            try:
                match_record = db.query(OngoingMatch).filter(OngoingMatch.match_id == self.match_id).first()
                if match_record:
                    game_state = match_record.game_state or {}
                    if isinstance(game_state, dict):
                        dead_players_set = set(game_state.get("technical_theory_dead_players", []))
                        # Get dynamic question count from phase_metadata
                        phase_metadata = game_state.get("phase_metadata", {})
                        if "technical_theory" in phase_metadata:
                            dynamic_count = phase_metadata["technical_theory"].get("question_count")
                            if dynamic_count is not None:
                                required_questions = dynamic_count
                                print(f"[PHASE_MANAGER] Using dynamic question_count for technical_theory: {required_questions}")
            finally:
                db.close()
        
        # For regular phases, check question submissions
        # Check if all required questions have been answered
        if len(self.question_submissions) < required_questions:
            return False
        
        # Check if all players have submitted all required questions OR are dead
        if all_must_submit:
            # Get all player IDs - use provided list or infer from submissions
            if player_ids:
                all_player_ids = set(player_ids)
            else:
                # Fallback: use players with submissions (less accurate)
                all_player_ids = set(self.player_submissions.keys())
            
            # Check each player
            for player_id in all_player_ids:
                if player_id in dead_players_set:
                    # Dead players are considered finished
                    continue
                
                # Non-dead players must have submitted all questions
                player_submissions = self.player_submissions.get(player_id, set())
                if len(player_submissions) < required_questions:
                    return False
        
        # Verify each required question has all non-dead players
        # Dead players don't need to submit questions
        active_player_count = total_players - len(dead_players_set)
        for q_idx in range(required_questions):
            if q_idx not in self.question_submissions:
                return False
            # Count only non-dead players
            non_dead_submissions = len([p for p in self.question_submissions[q_idx] if p not in dead_players_set])
            if non_dead_submissions < active_player_count:
                return False
        
        return True
    
    def get_current_question_index(self, total_players: int) -> int:
        """Get the current question index that all players should be on"""
        # Find the highest question index where all players have submitted
        max_complete_index = -1
        for q_idx in sorted(self.question_submissions.keys()):
            if q_idx in self.question_submissions and len(self.question_submissions[q_idx]) >= total_players:
                max_complete_index = q_idx
        
        # Return next question index (or current if not all submitted yet)
        return max_complete_index + 1
    
    def can_advance_to_next_question(self, question_index: int, total_players: int) -> bool:
        """Check if all players have submitted the current question"""
        if question_index not in self.question_submissions:
            return False
        return len(self.question_submissions[question_index]) >= total_players
    
    def get_status(self) -> Dict[str, Any]:
        """Get current status"""
        return {
            "phase": self.phase,
            "player_submissions": {pid: list(indices) for pid, indices in self.player_submissions.items()},
            "question_submissions": {qidx: list(players) for qidx, players in self.question_submissions.items()},
            "criteria": self.criteria
        }


# Global phase manager instance
phase_manager = PhaseManager()

