"""
Scoring for technical theory phase
Scores answers as they're submitted using TheoreticalJudge
Stores incremental scores to avoid recalculation at the end
"""
from typing import Dict, Optional
from datetime import datetime
from database import SessionLocal, OngoingMatch
from app.llm.judge import TheoreticalJudge


async def score_technical_theory_answer(
    match_id: str,
    player_id: str,
    question_index: int,
    answer: str
) -> Optional[int]:
    """
    Score a single technical theory answer immediately when submitted
    
    Args:
        match_id: The match ID
        player_id: The player ID
        question_index: The question index (0, 1, 2, etc.)
        answer: The player's answer (option ID like "A", "B", "C", "D")
    
    Returns:
        Score for this answer (200 if correct, 0 if incorrect), or None if question/answer not found
    """
    db = SessionLocal()
    try:
        match_record = db.query(OngoingMatch).filter(OngoingMatch.match_id == match_id).first()
        if not match_record:
            print(f"[TECHNICAL_THEORY_SCORING] Match {match_id} not found")
            return None
        
        game_state = match_record.game_state or {}
        if not isinstance(game_state, dict):
            print(f"[TECHNICAL_THEORY_SCORING] game_state is not a dict")
            return None
        
        # Get question from questions cache
        questions_cache = game_state.get("questions", {})
        question_key = f"technical_theory_{question_index}"
        question_data = questions_cache.get(question_key)
        
        if not question_data:
            print(f"[TECHNICAL_THEORY_SCORING] Question {question_index} not found in cache")
            return None
        
        # Get correct answer from question data
        correct_answer = question_data.get("correct_answer")
        if not correct_answer:
            print(f"[TECHNICAL_THEORY_SCORING] No correct_answer in question data")
            return None
        
        # The answer from frontend is an option ID (A, B, C, D)
        # Use the stored option_mapping if available (deterministic shuffle from backend)
        # Otherwise fall back to reconstructing the mapping
        option_mapping = question_data.get("option_mapping")
        if option_mapping:
            # Use pre-computed deterministic mapping
            player_answer_text = option_mapping.get(answer.upper())
            if not player_answer_text:
                print(f"[TECHNICAL_THEORY_SCORING] Invalid option ID: {answer}")
                return None
        else:
            # Fallback: reconstruct mapping (shouldn't happen if questions loaded correctly)
            print(f"[TECHNICAL_THEORY_SCORING] WARNING: No option_mapping found, reconstructing (may be inconsistent)")
            incorrect_answers = question_data.get("incorrect_answers", [])
            all_answers = [correct_answer] + incorrect_answers
            
            # Map option IDs to answers (same logic as frontend)
            # Frontend maps: A=0, B=1, C=2, D=3
            option_map = {}
            for idx, ans in enumerate(all_answers):
                option_id = chr(65 + idx)  # A, B, C, D
                option_map[option_id] = ans
            
            # Get the actual answer text from the option ID
            player_answer_text = option_map.get(answer.upper())
            if not player_answer_text:
                print(f"[TECHNICAL_THEORY_SCORING] Invalid option ID: {answer}")
                return None
        
        # Score using TheoreticalJudge (200 points per correct answer, 0 for incorrect)
        judge = TheoreticalJudge()
        question_for_judge = {
            "correct": correct_answer
        }
        result = judge.judge(question_for_judge, player_answer_text)
        
        # Score is 200 if correct, 0 if incorrect (defined in TheoreticalJudge)
        score = result.score
        is_correct = result.is_correct
        
        print(f"[TECHNICAL_THEORY_SCORING] Player {player_id}, Q{question_index}: {answer} -> {player_answer_text} | Correct: {correct_answer} | IsCorrect: {is_correct} | Score: {score}")
        
        # Track answer with feedback in game_state
        # Initialize answer_tracking structure: {phase: {player_id: {question_index: {answer, feedback, attempted, ...}}}}
        if "answer_tracking" not in game_state:
            game_state["answer_tracking"] = {}
        if "technical_theory" not in game_state["answer_tracking"]:
            game_state["answer_tracking"]["technical_theory"] = {}
        if player_id not in game_state["answer_tracking"]["technical_theory"]:
            game_state["answer_tracking"]["technical_theory"][player_id] = {}
        
        # Store answer with feedback (technical theory has no feedback, but track attempted flag)
        game_state["answer_tracking"]["technical_theory"][player_id][str(question_index)] = {
            "answer": answer,
            "answer_text": player_answer_text,
            "correct_answer": correct_answer,
            "is_correct": is_correct,
            "attempted": True,
            "answered_at": datetime.utcnow().isoformat(),
            "feedback": None  # Technical theory has no feedback
        }
        
        # Store score incrementally in game_state
        # Ensure structure is correct
        if "technical_theory_scores" not in game_state:
            game_state["technical_theory_scores"] = {}
        
        # Ensure player_id entry is a dict (not an int or other type)
        if player_id not in game_state["technical_theory_scores"]:
            game_state["technical_theory_scores"][player_id] = {}
        elif not isinstance(game_state["technical_theory_scores"][player_id], dict):
            # Fix corrupted structure
            print(f"[TECHNICAL_THEORY_SCORING] WARNING: Found corrupted structure for player {player_id}, fixing...")
            game_state["technical_theory_scores"][player_id] = {}
        
        # Store individual question score (200 if correct, 0 if incorrect)
        game_state["technical_theory_scores"][player_id][str(question_index)] = {
            "score": score,
            "is_correct": is_correct,
            "question_index": question_index,
            "answer": answer,
            "correct_answer": correct_answer,
            "scored_at": datetime.utcnow().isoformat()
        }
        
        # Calculate total score: count correct answers and multiply by 200
        # This ensures we're using the Python logic: correct_answers * 200
        player_scores = game_state["technical_theory_scores"][player_id]
        
        # Get question count from phase_metadata to iterate through all questions
        # This ensures we count correctly even if some questions aren't answered yet
        question_count = 10  # Default fallback
        phase_metadata = game_state.get("phase_metadata", {})
        if "technical_theory" in phase_metadata:
            question_count = phase_metadata["technical_theory"].get("question_count", 10)
        
        # Count correct answers by iterating through all question indices
        # This is robust and handles unanswered questions correctly
        correct_count = 0
        for q_idx in range(question_count):
            q_idx_str = str(q_idx)
            score_data = player_scores.get(q_idx_str)
            # Only count if question was answered AND is correct
            if isinstance(score_data, dict) and score_data.get("is_correct", False):
                correct_count += 1
        
        cumulative_score = correct_count * 200
        game_state["technical_theory_scores"][player_id]["_total"] = cumulative_score
        
        print(f"[TECHNICAL_THEORY_SCORING] Player {player_id}: {correct_count}/{question_count} correct answers = {cumulative_score} points (correct_count * 200)")
        
        # Use flag_modified to ensure SQLAlchemy tracks the change
        from sqlalchemy.orm.attributes import flag_modified
        match_record.game_state = game_state
        flag_modified(match_record, "game_state")
        db.commit()
        
        print(f"[TECHNICAL_THEORY_SCORING] Stored score. Player {player_id} cumulative: {cumulative_score}")
        
        return score
        
    except Exception as e:
        db.rollback()
        print(f"[TECHNICAL_THEORY_SCORING] Error scoring answer: {e}")
        import traceback
        traceback.print_exc()
        return None
    finally:
        db.close()


async def get_technical_theory_total_score(
    match_id: str,
    player_id: str
) -> int:
    """
    Get the total score for a player's technical theory answers
    Uses pre-calculated scores if available, otherwise returns 0
    
    Args:
        match_id: The match ID
        player_id: The player ID
    
    Returns:
        Total score for all technical theory questions
    """
    db = SessionLocal()
    try:
        match_record = db.query(OngoingMatch).filter(OngoingMatch.match_id == match_id).first()
        if not match_record:
            return 0
        
        game_state = match_record.game_state or {}
        if not isinstance(game_state, dict):
            return 0
        
        technical_theory_scores = game_state.get("technical_theory_scores", {})
        if not isinstance(technical_theory_scores, dict):
            print(f"[TECHNICAL_THEORY_SCORING] technical_theory_scores is not a dict: {type(technical_theory_scores)}, value: {technical_theory_scores}")
            return 0
        
        player_scores = technical_theory_scores.get(player_id)
        
        # Handle case where player_scores might be corrupted (int instead of dict)
        if not isinstance(player_scores, dict):
            print(f"[TECHNICAL_THEORY_SCORING] player_scores is not a dict for player {player_id}: {type(player_scores)}, value: {player_scores}")
            print(f"[TECHNICAL_THEORY_SCORING] Attempting to recover by recalculating from player_responses...")
            
            # Try to recover by recalculating from player_responses
            player_responses = game_state.get("player_responses", {})
            player_data = player_responses.get(player_id, {})
            technical_theory_responses = player_data.get("technical_theory", {})
            
            if technical_theory_responses:
                # Recalculate scores from responses
                total = 0
                questions_cache = game_state.get("questions", {})
                
                for q_idx_str, response_data in technical_theory_responses.items():
                    if not isinstance(response_data, dict):
                        continue
                    
                    answer_text = response_data.get("answer", "")
                    q_idx = int(q_idx_str) if q_idx_str.isdigit() else None
                    
                    if q_idx is not None and answer_text:
                        # Get question data
                        question_key = f"technical_theory_{q_idx}"
                        question_data = questions_cache.get(question_key)
                        
                        if question_data:
                            correct_answer = question_data.get("correct_answer")
                            option_mapping = question_data.get("option_mapping")
                            
                            if option_mapping and correct_answer:
                                # Map answer option ID to answer text
                                player_answer_text = option_mapping.get(answer_text.upper())
                                
                                if player_answer_text:
                                    # Score the answer
                                    judge = TheoreticalJudge()
                                    question_for_judge = {"correct": correct_answer}
                                    result = judge.judge(question_for_judge, player_answer_text)
                                    total += result.score
                                    print(f"[TECHNICAL_THEORY_SCORING] Recalculated Q{q_idx}: {result.score} points")
                
                # Fix the corrupted structure
                if "technical_theory_scores" not in game_state:
                    game_state["technical_theory_scores"] = {}
                game_state["technical_theory_scores"][player_id] = {"_total": total}
                match_record.game_state = game_state
                db.commit()
                
                print(f"[TECHNICAL_THEORY_SCORING] Recovered and stored total score: {total}")
                return total
            
            return 0
        
        # Check if we have a pre-calculated total
        if "_total" in player_scores:
            total_value = player_scores["_total"]
            if isinstance(total_value, (int, float)):
                return int(total_value)
            else:
                print(f"[TECHNICAL_THEORY_SCORING] _total is not a number: {type(total_value)}")
        
        # Otherwise calculate from individual scores
        total = 0
        for key, s in player_scores.items():
            if key == "_total":
                continue  # Skip the _total key itself
            if isinstance(s, dict) and "score" in s:
                score_value = s.get("score", 0)
                if isinstance(score_value, (int, float)):
                    total += int(score_value)
        
        return total
        
    except Exception as e:
        print(f"[TECHNICAL_THEORY_SCORING] Error getting total score: {e}")
        return 0
    finally:
        db.close()

