"""
Helper functions for updating game state in the database
"""
from sqlalchemy.orm import Session
from database import SessionLocal, OngoingMatch
from typing import Dict, Any, Optional, List
from datetime import datetime


def update_game_state(
    match_id: str,
    updates: Dict[str, Any],
    merge: bool = True
) -> bool:
    """
    Update game state in the database
    
    Args:
        match_id: The match ID to update
        updates: Dictionary of updates to apply to game_state
        merge: If True, merge updates with existing game_state. If False, replace entirely.
    
    Returns:
        True if successful, False otherwise
    """
    db: Session = SessionLocal()
    try:
        match_record = db.query(OngoingMatch).filter(OngoingMatch.match_id == match_id).first()
        if not match_record:
            print(f"Match {match_id} not found in database")
            return False
        
        if merge:
            # Merge updates with existing game_state
            current_state = match_record.game_state or {}
            if isinstance(current_state, dict):
                current_state.update(updates)
                match_record.game_state = current_state
            else:
                # If game_state is not a dict, replace it
                match_record.game_state = updates
        else:
            # Replace game_state entirely
            match_record.game_state = updates
        
        db.commit()
        return True
    except Exception as e:
        db.rollback()
        print(f"Error updating game state for match {match_id}: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


def record_answer(
    match_id: str,
    player_id: str,
    question_id: str,
    answer: str,
    phase: str,
    question_index: Optional[int] = None
) -> bool:
    """
    Record a player's answer to a question
    
    Args:
        match_id: The match ID
        player_id: The player who answered
        question_id: The question ID
        answer: The answer text
        phase: The game phase (behavioural, quickfire, technical_theory, technical_practical)
        question_index: Optional index of the question in the phase
    
    Returns:
        True if successful, False otherwise
    """
    updates = {
        "answers": {
            question_id: {
                "player_id": player_id,
                "answer": answer,
                "phase": phase,
                "question_index": question_index,
                "answered_at": datetime.utcnow().isoformat()
            }
        }
    }
    
    # Merge with existing answers
    db: Session = SessionLocal()
    try:
        match_record = db.query(OngoingMatch).filter(OngoingMatch.match_id == match_id).first()
        if not match_record:
            return False
        
        current_state = match_record.game_state or {}
        if not isinstance(current_state, dict):
            current_state = {}
        
        # Initialize answers dict if it doesn't exist
        if "answers" not in current_state:
            current_state["answers"] = {}
        
        # Merge answer
        current_state["answers"][question_id] = updates["answers"][question_id]
        
        # Update phase-specific answer tracking
        phase_key = f"{phase}_answers"
        if phase_key not in current_state:
            current_state[phase_key] = {}
        
        if player_id not in current_state[phase_key]:
            current_state[phase_key][player_id] = []
        
        current_state[phase_key][player_id].append({
            "question_id": question_id,
            "answer": answer,
            "question_index": question_index,
            "answered_at": datetime.utcnow().isoformat()
        })
        
        match_record.game_state = current_state
        db.commit()
        return True
    except Exception as e:
        db.rollback()
        print(f"Error recording answer for match {match_id}: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


def update_phase(
    match_id: str,
    phase: str,
    phase_data: Optional[Dict[str, Any]] = None
) -> bool:
    """
    Update the current game phase
    
    Args:
        match_id: The match ID
        phase: The current phase (tutorial, behavioural, quickfire, technical_theory, technical_practical, score)
        phase_data: Optional additional phase-specific data
    
    Returns:
        True if successful, False otherwise
    """
    updates = {
        "current_phase": phase,
        "phase_changed_at": datetime.utcnow().isoformat()
    }
    
    if phase_data:
        updates.update(phase_data)
    
    return update_game_state(match_id, updates)


def update_player_submission_status(
    match_id: str,
    player_id: str,
    question_id: str,
    submitted: bool = True
) -> bool:
    """
    Update player submission status for a question
    
    Args:
        match_id: The match ID
        player_id: The player ID
        question_id: The question ID
        submitted: Whether the player has submitted
    
    Returns:
        True if successful, False otherwise
    """
    db: Session = SessionLocal()
    try:
        match_record = db.query(OngoingMatch).filter(OngoingMatch.match_id == match_id).first()
        if not match_record:
            return False
        
        current_state = match_record.game_state or {}
        if not isinstance(current_state, dict):
            current_state = {}
        
        # Initialize submissions tracking
        if "submissions" not in current_state:
            current_state["submissions"] = {}
        
        if question_id not in current_state["submissions"]:
            current_state["submissions"][question_id] = {}
        
        current_state["submissions"][question_id][player_id] = {
            "submitted": submitted,
            "submitted_at": datetime.utcnow().isoformat() if submitted else None
        }
        
        match_record.game_state = current_state
        db.commit()
        return True
    except Exception as e:
        db.rollback()
        print(f"Error updating submission status for match {match_id}: {e}")
        return False
    finally:
        db.close()


def update_scores(
    match_id: str,
    scores: Dict[str, int],
    phase: Optional[str] = None
) -> bool:
    """
    Update player scores - properly merges with existing scores
    
    Args:
        match_id: The match ID
        scores: Dictionary mapping player_id to score (cumulative scores)
        phase: Optional phase name for phase-specific scores
    
    Returns:
        True if successful, False otherwise
    """
    db: Session = SessionLocal()
    try:
        # Get fresh state from database to avoid race conditions
        match_record = db.query(OngoingMatch).filter(OngoingMatch.match_id == match_id).first()
        if not match_record:
            print(f"Match {match_id} not found for score update")
            return False
        
        current_state = match_record.game_state or {}
        if not isinstance(current_state, dict):
            current_state = {}
        
        # Merge scores properly - take the maximum to avoid overwriting with stale data
        existing_scores = current_state.get("scores", {})
        merged_scores = existing_scores.copy()
        
        for player_id, new_score in scores.items():
            # Use the maximum score to prevent race condition overwrites
            # In normal operation, new_score should always be >= existing
            existing_score = merged_scores.get(player_id, 0)
            merged_scores[player_id] = max(existing_score, new_score)
        
        # Update the scores
        current_state["scores"] = merged_scores
        
        # Store phase-specific scores for reference
        if phase:
            phase_scores_key = f"{phase}_scores"
            current_state[phase_scores_key] = scores.copy()
        
        # Update timestamp
        current_state["scores_updated_at"] = datetime.utcnow().isoformat()
        
        match_record.game_state = current_state
        db.commit()
        
        print(f"[SCORES] Updated scores for match {match_id}: {merged_scores}")
        return True
    except Exception as e:
        db.rollback()
        print(f"Error updating scores for match {match_id}: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


def update_timer_state(
    match_id: str,
    question_id: str,
    time_remaining: int,
    timer_started_at: Optional[str] = None
) -> bool:
    """
    Update timer state for a question
    
    Args:
        match_id: The match ID
        question_id: The question ID
        time_remaining: Time remaining in seconds
        timer_started_at: Optional timestamp when timer started
    
    Returns:
        True if successful, False otherwise
    """
    updates = {
        "timers": {
            question_id: {
                "time_remaining": time_remaining,
                "timer_started_at": timer_started_at or datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
        }
    }
    
    return update_game_state(match_id, updates)


def get_match_by_lobby_id(lobby_id: str) -> Optional[OngoingMatch]:
    """
    Get match record by lobby_id
    
    Args:
        lobby_id: The lobby ID
    
    Returns:
        OngoingMatch record or None
    """
    db: Session = SessionLocal()
    try:
        match_record = db.query(OngoingMatch).filter(
            OngoingMatch.lobby_id == lobby_id
        ).order_by(OngoingMatch.created_at.desc()).first()
        return match_record
    except Exception as e:
        print(f"Error getting match by lobby_id {lobby_id}: {e}")
        return None
    finally:
        db.close()


def get_scores_for_phase(match_id: str, phase: str) -> Dict[str, int]:
    """
    Get cumulative scores from the database (always returns cumulative, not phase-specific)
    
    Args:
        match_id: The match ID
        phase: The phase name (e.g., 'behavioural_score', 'quickfire_score', 'technical_score')
    
    Returns:
        Dictionary mapping player_id to cumulative score, or empty dict if not found
    """
    db: Session = SessionLocal()
    try:
        match_record = db.query(OngoingMatch).filter(OngoingMatch.match_id == match_id).first()
        if not match_record:
            print(f"[SCORES] Match {match_id} not found")
            return {}
        
        game_state = match_record.game_state or {}
        if not isinstance(game_state, dict):
            return {}
        
        # Always return cumulative scores (the main "scores" field)
        # Phase-specific scores are just for reference
        if "scores" in game_state:
            scores = game_state["scores"]
            if isinstance(scores, dict):
                print(f"[SCORES] Retrieved cumulative scores for {phase}: {scores}")
                return scores.copy()
        
        print(f"[SCORES] No scores found for match {match_id}")
        return {}
    except Exception as e:
        print(f"Error getting scores for phase {phase} in match {match_id}: {e}")
        import traceback
        traceback.print_exc()
        return {}
    finally:
        db.close()


def get_player_answers_for_phase(match_id: str, phase: str, player_ids: List[str]) -> Dict[str, List[Dict[str, Any]]]:
    """
    Get all answers for all players for a specific phase
    
    Args:
        match_id: The match ID
        phase: The phase name
        player_ids: List of player IDs
    
    Returns:
        Dict mapping player_id to list of answer dictionaries
    """
    db: Session = SessionLocal()
    try:
        match_record = db.query(OngoingMatch).filter(OngoingMatch.match_id == match_id).first()
        if not match_record:
            return {pid: [] for pid in player_ids}
        
        game_state = match_record.game_state or {}
        if not isinstance(game_state, dict):
            return {pid: [] for pid in player_ids}
        
        # Get answers from game_state
        answers_dict = game_state.get("answers", {})
        phase_answers_key = f"{phase}_answers"
        phase_answers = game_state.get(phase_answers_key, {})
        
        # Build player answers dict
        player_answers: Dict[str, List[Dict[str, any]]] = {pid: [] for pid in player_ids}
        
        # Collect answers from phase-specific tracking
        if isinstance(phase_answers, dict):
            for player_id, answer_list in phase_answers.items():
                if player_id in player_ids and isinstance(answer_list, list):
                    player_answers[player_id] = answer_list
        
        # Also check general answers dict
        if isinstance(answers_dict, dict):
            for question_id, answer_data in answers_dict.items():
                if isinstance(answer_data, dict):
                    answer_phase = answer_data.get("phase", "")
                    answer_player_id = answer_data.get("player_id", "")
                    
                    if answer_phase == phase and answer_player_id in player_ids:
                        if answer_player_id not in player_answers:
                            player_answers[answer_player_id] = []
                        player_answers[answer_player_id].append({
                            "question_id": question_id,
                            "answer": answer_data.get("answer", ""),
                            "question_index": answer_data.get("question_index"),
                            "answered_at": answer_data.get("answered_at")
                        })
        
        return player_answers
    except Exception as e:
        print(f"Error getting player answers for phase {phase}: {e}")
        import traceback
        traceback.print_exc()
        return {pid: [] for pid in player_ids}
    finally:
        db.close()


def calculate_and_store_scores(match_id: str, phase: str, player_ids: List[str]) -> Dict[str, int]:
    """
    Calculate scores for a phase and store them in the database
    For testing: increments owner (first player) score by 1 each round
    Uses database-level locking to prevent race conditions
    
    Args:
        match_id: The match ID
        phase: The phase name (e.g., 'behavioural_score', 'quickfire_score')
        player_ids: List of player IDs
    
    Returns:
        Dictionary mapping player_id to cumulative score
    """
    db: Session = SessionLocal()
    try:
        # Use database-level locking to prevent race conditions
        # Lock the row for update to ensure we get the latest scores
        match_record = db.query(OngoingMatch).filter(
            OngoingMatch.match_id == match_id
        ).with_for_update().first()
        
        if not match_record:
            print(f"Match {match_id} not found for score calculation")
            return {pid: 0 for pid in player_ids}
        
        # Get existing cumulative scores from database (fresh read)
        existing_scores = {}
        game_state = match_record.game_state
        if game_state and isinstance(game_state, dict):
            existing_scores = game_state.get("scores", {}).copy()
        
        # Check if scores for this phase already exist (prevent double calculation)
        phase_scores_key = f"{phase}_scores"
        if game_state and isinstance(game_state, dict) and phase_scores_key in game_state:
            print(f"[SCORES] Scores for {phase} already calculated, returning existing cumulative scores")
            # Return existing cumulative scores, not phase-specific
            return existing_scores
        
        # Get player answers for this phase
        from game.scoring import calculate_phase_scores
        player_answers = get_player_answers_for_phase(match_id, phase, player_ids)
        
        # Calculate phase scores using scoring module
        phase_scores = calculate_phase_scores(
            match_id=match_id,
            phase=phase,
            player_ids=player_ids,
            player_answers=player_answers,
            correct_answers=None  # TODO: Get correct answers from question data
        )
        
        # Calculate cumulative scores (add phase score to existing)
        scores: Dict[str, int] = {}
        for player_id in player_ids:
            base_score = existing_scores.get(player_id, 0)
            phase_score = phase_scores.get(player_id, 0)
            scores[player_id] = base_score + phase_score
        
        # Store cumulative scores (this updates the main "scores" field)
        # Phase-specific scores are stored separately for reference
        # Use the locked database session
        current_state = match_record.game_state or {}
        if not isinstance(current_state, dict):
            current_state = {}
        
        # Merge scores properly
        merged_scores = existing_scores.copy()
        for player_id, new_score in scores.items():
            existing_score = merged_scores.get(player_id, 0)
            merged_scores[player_id] = max(existing_score, new_score)
        
        current_state["scores"] = merged_scores
        current_state[phase_scores_key] = scores.copy()
        current_state["scores_updated_at"] = datetime.utcnow().isoformat()
        
        match_record.game_state = current_state
        db.commit()
        
        print(f"[SCORES] Calculated and stored scores for {phase}: {merged_scores}")
        return merged_scores
    except Exception as e:
        db.rollback()
        print(f"Error calculating scores for match {match_id}: {e}")
        import traceback
        traceback.print_exc()
        # Fallback: try to return existing scores
        try:
            if match_record and match_record.game_state:
                game_state = match_record.game_state
                if isinstance(game_state, dict):
                    return game_state.get("scores", {})
        except:
            pass
        return {pid: 0 for pid in player_ids}
    finally:
        db.close()

