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
        
        import copy
        from sqlalchemy.orm.attributes import flag_modified
        
        if merge:
            # Merge updates with existing game_state
            current_state = match_record.game_state or {}
            if isinstance(current_state, dict):
                current_state.update(updates)
                match_record.game_state = copy.deepcopy(current_state)
            else:
                # If game_state is not a dict, replace it
                match_record.game_state = copy.deepcopy(updates)
        else:
            # Replace game_state entirely
            match_record.game_state = copy.deepcopy(updates)
        
        flag_modified(match_record, "game_state")
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
        phase: The game phase (behavioural, technical_theory, technical_practical)
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
        
        # Initialize player_responses structure: {player_id: {phase: {question_index: response_data}}}
        if "player_responses" not in current_state:
            current_state["player_responses"] = {}
        
        if player_id not in current_state["player_responses"]:
            current_state["player_responses"][player_id] = {}
        
        if phase not in current_state["player_responses"][player_id]:
            current_state["player_responses"][player_id][phase] = {}
        
        # Store response per player per phase per question_index
        response_data = {
            "question_id": question_id,
            "answer": answer,
            "question_index": question_index,
            "answered_at": datetime.utcnow().isoformat(),
            "phase": phase
        }
        
        current_state["player_responses"][player_id][phase][str(question_index)] = response_data
        
        # Also maintain answers dict for backward compatibility and quick lookup
        if "answers" not in current_state:
            current_state["answers"] = {}
        
        # Store answer keyed by question_id (for quick lookup)
        current_state["answers"][question_id] = {
            "player_id": player_id,
            "answer": answer,
            "phase": phase,
            "question_index": question_index,
            "answered_at": datetime.utcnow().isoformat()
        }
        
        # Update phase-specific answer tracking (backward compatibility)
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
        
        # CRITICAL: Create a new dict to ensure SQLAlchemy detects the change
        # SQLAlchemy JSON columns need a new object reference to detect changes
        import copy
        match_record.game_state = copy.deepcopy(current_state)
        
        # Mark the column as modified to ensure SQLAlchemy tracks the change
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(match_record, "game_state")
        
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
        phase: The current phase (tutorial, behavioural, technical_theory, technical_practical, score)
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
        
        # CRITICAL: Create a new dict to ensure SQLAlchemy detects the change
        import copy
        match_record.game_state = copy.deepcopy(current_state)
        
        # Mark the column as modified to ensure SQLAlchemy tracks the change
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(match_record, "game_state")
        
        db.commit()
        return True
    except Exception as e:
        db.rollback()
        print(f"Error updating submission status for match {match_id}: {e}")
        return False
    finally:
        db.close()


def store_question(
    match_id: str,
    phase: str,
    question_index: int,
    question_data: Dict[str, Any],
    is_followup: bool = False,
    parent_question_index: Optional[int] = None,
    player_id: Optional[str] = None
) -> bool:
    """
    Store a question in game_state for game history tracking
    Stores questions per-player for personalized questions, shared for common questions
    
    Args:
        match_id: The match ID
        phase: The game phase (e.g., "behavioural", "technical_practical")
        question_index: The index of the question within the phase
        question_data: Dictionary containing question details:
            - question: The question text
            - question_id: Database ID of the question (if from pool)
            - role: Role associated with question
            - level: Level associated with question
            - generated_at: Timestamp when question was generated/selected
        is_followup: Whether this is a follow-up question (e.g., behavioural Q1)
        parent_question_index: If followup, the index of the parent question
        player_id: Optional player ID for personalized questions (e.g., Q1 follow-ups)
    
    Returns:
        True if successful, False otherwise
    """
    db: Session = SessionLocal()
    try:
        match_record = db.query(OngoingMatch).filter(OngoingMatch.match_id == match_id).first()
        if not match_record:
            print(f"Match {match_id} not found for question storage")
            return False
        
        current_state = match_record.game_state or {}
        if not isinstance(current_state, dict):
            print(f"[QUESTION_STORE] WARNING: game_state is not a dict, type: {type(current_state)}")
            current_state = {}
        
        print(f"[QUESTION_STORE] Current game_state keys before storage: {list(current_state.keys())}")
        print(f"[QUESTION_STORE] Current questions cache exists: {'questions' in current_state}")
        if "questions" in current_state:
            print(f"[QUESTION_STORE] Current questions cache keys: {list(current_state['questions'].keys())}")
        
        # Initialize player_questions structure: {player_id: {phase: {question_index: question_data}}}
        if "player_questions" not in current_state:
            current_state["player_questions"] = {}
        
        # Initialize questions structure for backward compatibility and quick lookup
        if "questions" not in current_state:
            print(f"[QUESTION_STORE] Initializing 'questions' key in game_state")
            current_state["questions"] = {}
        else:
            print(f"[QUESTION_STORE] 'questions' key already exists with {len(current_state['questions'])} entries")
        
        # Prepare question record with metadata
        # Preserve ALL fields from question_data, especially for technical theory (correct_answer, incorrect_answers, option_mapping, etc.)
        question_record = {
            "question": question_data.get("question"),
            "question_id": question_data.get("question_id"),
            "role": question_data.get("role"),
            "level": question_data.get("level"),
            "phase": phase,
            "question_index": question_index,
            "is_followup": is_followup,
            "parent_question_index": parent_question_index,
            "stored_at": datetime.utcnow().isoformat(),
            "generated_at": question_data.get("generated_at", datetime.utcnow().isoformat())
        }
        
        # Preserve all additional fields from question_data (for technical theory: correct_answer, incorrect_answers, option_mapping, etc.)
        for key, value in question_data.items():
            if key not in question_record:
                question_record[key] = value
        
        # If player_id is provided, store per-player (for personalized questions)
        if player_id:
            if player_id not in current_state["player_questions"]:
                current_state["player_questions"][player_id] = {}
            if phase not in current_state["player_questions"][player_id]:
                current_state["player_questions"][player_id][phase] = {}
            
            current_state["player_questions"][player_id][phase][str(question_index)] = question_record
            question_record["player_id"] = player_id
            
            # Also store in questions cache with player-specific key
            personalized_key = f"{phase}_{question_index}_{player_id}"
            current_state["questions"][personalized_key] = question_record
        else:
            # Shared question - store for all players
            # Get all player IDs from match
            # players can be stored as JSON in OngoingMatch, so it might be a list of dicts
            players = match_record.players or []
            if isinstance(players, list):
                for p in players:
                    # Handle both dict format {"id": "..."} and direct string format
                    if isinstance(p, dict):
                        player_id_str = p.get("id") or p.get("player_id") or str(p)
                    else:
                        player_id_str = str(p)
                    
                    if player_id_str and player_id_str not in ["None", "null"]:
                        if player_id_str not in current_state["player_questions"]:
                            current_state["player_questions"][player_id_str] = {}
                        if phase not in current_state["player_questions"][player_id_str]:
                            current_state["player_questions"][player_id_str][phase] = {}
                        
                        current_state["player_questions"][player_id_str][phase][str(question_index)] = question_record
            
            # Also store in questions cache with shared key
            shared_key = f"{phase}_{question_index}"
            current_state["questions"][shared_key] = question_record
            print(f"[QUESTION_STORE] Stored question with shared key '{shared_key}'")
            print(f"[QUESTION_STORE] Questions cache now has {len(current_state['questions'])} entries")
            print(f"[QUESTION_STORE] Questions cache keys after storage: {list(current_state['questions'].keys())}")
        
        # Also maintain a phase-specific list for easier access (backward compatibility)
        phase_questions_key = f"{phase}_questions"
        if phase_questions_key not in current_state:
            current_state[phase_questions_key] = []
        
        # Check if this question_index already exists in the list
        existing_index = None
        for idx, q in enumerate(current_state[phase_questions_key]):
            if q.get("question_index") == question_index and q.get("player_id") == player_id:
                existing_index = idx
                break
        
        if existing_index is not None:
            # Update existing entry
            current_state[phase_questions_key][existing_index] = question_record
        else:
            # Add new entry
            current_state[phase_questions_key].append(question_record)
            # Sort by question_index to maintain order
            current_state[phase_questions_key].sort(key=lambda x: (x.get("question_index", 0), x.get("player_id", "")))
        
        print(f"[QUESTION_STORE] Final game_state keys before commit: {list(current_state.keys())}")
        print(f"[QUESTION_STORE] Final questions cache has {len(current_state.get('questions', {}))} entries")
        
        # CRITICAL: Create a new dict to ensure SQLAlchemy detects the change
        # SQLAlchemy JSON columns need a new object reference to detect changes
        import copy
        match_record.game_state = copy.deepcopy(current_state)
        
        # Mark the column as modified to ensure SQLAlchemy tracks the change
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(match_record, "game_state")
        
        db.commit()
        
        print(f"[QUESTION_STORE] Committed to database. Verifying after commit...")
        # Verify after commit - use a fresh query to ensure we get the latest data
        db.expire(match_record)
        db.refresh(match_record)
        verify_state = match_record.game_state or {}
        verify_questions = verify_state.get("questions", {})
        print(f"[QUESTION_STORE] After commit - game_state keys: {list(verify_state.keys())}")
        print(f"[QUESTION_STORE] After commit - questions cache keys: {list(verify_questions.keys())}")
        
        if player_id:
            print(f"[QUESTION_STORE] Stored {phase} question (index={question_index}, followup={is_followup}) for player {player_id} in match {match_id}")
        else:
            print(f"[QUESTION_STORE] Stored shared {phase} question (index={question_index}, followup={is_followup}) for match {match_id}")
        return True
    except Exception as e:
        db.rollback()
        print(f"Error storing question for match {match_id}: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


def get_question_from_game_state(
    match_id: str,
    phase: str,
    question_index: int
) -> Optional[Dict[str, Any]]:
    """
    Retrieve a question from game_state
    
    Args:
        match_id: The match ID
        phase: The game phase
        question_index: The question index
    
    Returns:
        Question data dictionary or None if not found
    """
    db: Session = SessionLocal()
    try:
        match_record = db.query(OngoingMatch).filter(OngoingMatch.match_id == match_id).first()
        if not match_record:
            return None
        
        game_state = match_record.game_state or {}
        questions_cache = game_state.get("questions", {})
        question_key = f"{phase}_{question_index}"
        
        return questions_cache.get(question_key)
    except Exception as e:
        print(f"Error retrieving question for match {match_id}: {e}")
        return None
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
        
        # CRITICAL: Create a new dict to ensure SQLAlchemy detects the change
        import copy
        match_record.game_state = copy.deepcopy(current_state)
        
        # Mark the column as modified to ensure SQLAlchemy tracks the change
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(match_record, "game_state")
        
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
        phase: The phase name (e.g., 'behavioural_score', 'technical_theory_score', 'technical_score')
    
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


async def calculate_and_store_scores(match_id: str, phase: str, player_ids: List[str]) -> Dict[str, int]:
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
            return {pid: 0 for pid in player_ids}, {pid: 0 for pid in player_ids}
        
        # Get existing cumulative scores from database (fresh read)
        # These are the PREVIOUS scores before this phase calculation
        existing_scores = {}
        game_state = match_record.game_state
        if game_state and isinstance(game_state, dict):
            existing_scores = game_state.get("scores", {}).copy()
        
        # Store previous scores for animation purposes
        previous_scores = existing_scores.copy()
        
        # Check if scores for this phase already exist (prevent double calculation)
        phase_scores_key = f"{phase}_scores"
        if game_state and isinstance(game_state, dict) and phase_scores_key in game_state:
            print(f"[SCORES] Scores for {phase} already calculated, returning existing cumulative scores")
            # Return existing cumulative scores from game_state (should be up to date)
            # Make sure we return scores for all requested players
            cumulative_scores = game_state.get("scores", {})
            if not isinstance(cumulative_scores, dict):
                cumulative_scores = {}
            # Ensure all players have scores (even if 0)
            result_scores = {}
            for pid in player_ids:
                result_scores[pid] = cumulative_scores.get(pid, 0)
            print(f"[SCORES] Returning cumulative scores: {result_scores}")
            # Also return previous scores for animation
            return result_scores, previous_scores
        
        # Normalize phase name (remove "_score" suffix if present for answer lookup)
        answer_phase = phase.replace("_score", "") if phase.endswith("_score") else phase
        
        # Get player answers for this phase
        player_answers = get_player_answers_for_phase(match_id, answer_phase, player_ids)
        
        # For behavioural phase, use LLM judge for scoring
        if answer_phase == "behavioural":
            from game.behavioural_scoring import score_behavioural_answers
            from app.llm.judge import BehaviouralJudge
            from app.llm.openai import OpenAIClient
            import os
            
            # Initialize judge
            llm_client = OpenAIClient(api_key=os.environ.get("OPENAI_API_KEY"))
            judge = BehaviouralJudge(llm_client)
            
            # Calculate scores using LLM judge for each player
            phase_scores = {}
            for player_id in player_ids:
                try:
                    score = await score_behavioural_answers(match_id, player_id, judge)
                    phase_scores[player_id] = score
                    print(f"[SCORES] LLM judge scored player {player_id}: {score}")
                except Exception as e:
                    print(f"[SCORES] Error scoring player {player_id} with LLM judge: {e}")
                    import traceback
                    traceback.print_exc()
                    # Fallback to 0 if scoring fails
                    phase_scores[player_id] = 0
        elif answer_phase == "technical_theory":
            # For technical_theory, use pre-calculated scores (scored incrementally as answers were submitted)
            # Read directly from the locked database session to ensure we get the latest data
            phase_scores = {}
            
            # Get technical_theory_scores from the current game_state (already locked)
            technical_theory_scores = game_state.get("technical_theory_scores", {}) if isinstance(game_state, dict) else {}
            
            if not isinstance(technical_theory_scores, dict):
                print(f"[SCORES] WARNING: technical_theory_scores is not a dict: {type(technical_theory_scores)}")
                technical_theory_scores = {}
            
            for player_id in player_ids:
                try:
                    player_scores = technical_theory_scores.get(player_id, {})
                    
                    if isinstance(player_scores, dict):
                        # Get pre-calculated total if available
                        if "_total" in player_scores:
                            total_value = player_scores["_total"]
                            if isinstance(total_value, (int, float)):
                                phase_scores[player_id] = int(total_value)
                            else:
                                # Calculate from individual scores
                                total = sum(
                                    s.get("score", 0)
                                    for s in player_scores.values()
                                    if isinstance(s, dict) and "score" in s
                                )
                                phase_scores[player_id] = total
                        else:
                            # Calculate from individual scores
                            total = sum(
                                s.get("score", 0)
                                for s in player_scores.values()
                                if isinstance(s, dict) and "score" in s
                            )
                            phase_scores[player_id] = total
                    else:
                        print(f"[SCORES] WARNING: player_scores for {player_id} is not a dict: {type(player_scores)}")
                        phase_scores[player_id] = 0
                    
                    print(f"[SCORES] Retrieved pre-calculated technical theory score for player {player_id}: {phase_scores[player_id]}")
                except Exception as e:
                    print(f"[SCORES] Error getting technical theory score for player {player_id}: {e}")
                    import traceback
                    traceback.print_exc()
                    # Fallback to 0 if scoring fails
                    phase_scores[player_id] = 0
        elif answer_phase == "technical_practical":
            # For technical_practical, use pre-calculated scores (scored incrementally as submissions were submitted)
            phase_scores = {}
            
            # Get technical_practical_scores from the current game_state (already locked)
            technical_practical_scores = game_state.get("technical_practical_scores", {}) if isinstance(game_state, dict) else {}
            
            if not isinstance(technical_practical_scores, dict):
                print(f"[SCORES] WARNING: technical_practical_scores is not a dict: {type(technical_practical_scores)}")
                technical_practical_scores = {}
            
            for player_id in player_ids:
                try:
                    player_scores = technical_practical_scores.get(player_id, {})
                    
                    if isinstance(player_scores, dict):
                        # Get pre-calculated total if available
                        if "_total" in player_scores:
                            total_value = player_scores["_total"]
                            if isinstance(total_value, (int, float)):
                                phase_scores[player_id] = int(total_value)
                            else:
                                # Calculate from individual scores
                                total = sum(
                                    s.get("score", 0)
                                    for s in player_scores.values()
                                    if isinstance(s, dict) and "score" in s
                                )
                                phase_scores[player_id] = total
                        else:
                            # Calculate from individual scores
                            total = sum(
                                s.get("score", 0)
                                for s in player_scores.values()
                                if isinstance(s, dict) and "score" in s
                            )
                            phase_scores[player_id] = total
                    else:
                        print(f"[SCORES] WARNING: player_scores for {player_id} is not a dict: {type(player_scores)}")
                        phase_scores[player_id] = 0
                    
                    print(f"[SCORES] Retrieved pre-calculated technical practical score for player {player_id}: {phase_scores[player_id]}")
                except Exception as e:
                    print(f"[SCORES] Error getting technical practical score for player {player_id}: {e}")
                    import traceback
                    traceback.print_exc()
                    # Fallback to 0 if scoring fails
                    phase_scores[player_id] = 0
        else:
            # For other phases, use standard scoring module
            from game.scoring import calculate_phase_scores
            phase_scores = calculate_phase_scores(
                match_id=match_id,
                phase=answer_phase,
                player_ids=player_ids,
                player_answers=player_answers,
                correct_answers=None  # TODO: Get correct answers from question data
            )
        
        # Calculate cumulative scores (add phase score to existing)
        # This is correct - we want cumulative scores across all phases
        scores: Dict[str, int] = {}
        for player_id in player_ids:
            base_score = existing_scores.get(player_id, 0)
            phase_score = phase_scores.get(player_id, 0)
            scores[player_id] = base_score + phase_score
        
        # Store cumulative scores (this updates the main "scores" field)
        # Phase-specific scores are stored separately for reference
        # Use the locked database session - modify game_state in place to preserve all nested structures
        current_state = match_record.game_state or {}
        if not isinstance(current_state, dict):
            current_state = {}
        
        # Use the newly calculated cumulative scores directly (don't use max() which can hide bugs)
        merged_scores = scores.copy()
        
        # Update scores in the existing game_state dict (preserve all other structures like technical_theory_scores)
        current_state["scores"] = merged_scores
        # Store phase-specific scores separately (just for this phase, not cumulative)
        current_state[phase_scores_key] = phase_scores.copy()
        # Store previous scores for animation purposes (before this phase)
        current_state["previous_scores"] = previous_scores.copy()
        current_state["scores_updated_at"] = datetime.utcnow().isoformat()
        
        # CRITICAL: Create a new dict to ensure SQLAlchemy detects the change
        # But preserve all nested structures by doing a deep copy of the entire game_state
        import copy
        match_record.game_state = copy.deepcopy(current_state)
        
        # Mark the column as modified to ensure SQLAlchemy tracks the change
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(match_record, "game_state")
        
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

