"""
Generate match summary JSON for Comparison page
Creates condensed summary data with Q1-Q4 comparisons
"""
from typing import Dict, List, Any, Optional, Tuple
from database import SessionLocal, OngoingMatch, TechnicalTheoryPool, TechnicalPracticalPool
from sqlalchemy.orm import Session


def generate_match_summary_json(match_id: str) -> Optional[Dict[str, Any]]:
    """
    Generate condensed match summary JSON for Comparison page
    
    This function creates a summary with:
    - Q1: Shared behavioural question with both players' answers
    - Q2: Follow-up questions (personalized) with answers
    - Q3: Easiest question someone got wrong + hardest question someone got right
    - Q4: Shared final question with both players' answers
    
    Args:
        match_id: The match ID
        
    Returns:
        Dictionary with comparisons array, or None if error
    """
    db: Session = SessionLocal()
    try:
        match_record = db.query(OngoingMatch).filter(OngoingMatch.match_id == match_id).first()
        if not match_record:
            print(f"[MATCH_SUMMARY] Match {match_id} not found")
            return None
        
        game_state = match_record.game_state or {}
        if not isinstance(game_state, dict):
            print(f"[MATCH_SUMMARY] Invalid game_state for match {match_id}")
            return None
        
        players = match_record.players or []
        if not isinstance(players, list) or len(players) < 2:
            print(f"[MATCH_SUMMARY] Invalid players data for match {match_id}")
            return None
        
        # Get player IDs and names
        player_ids = [p.get("id") if isinstance(p, dict) else str(p) for p in players]
        player_names = {}
        for p in players:
            if isinstance(p, dict):
                player_names[p.get("id")] = p.get("name", p.get("id"))
            else:
                player_names[str(p)] = str(p)
        
        if len(player_ids) < 2:
            print(f"[MATCH_SUMMARY] Need at least 2 players, got {len(player_ids)}")
            return None
        
        left_player_id = player_ids[0]
        right_player_id = player_ids[1]
        left_player_name = player_names.get(left_player_id, left_player_id)
        right_player_name = player_names.get(right_player_id, right_player_id)
        
        # Get questions and answers from game_state
        questions_cache = game_state.get("questions", {})
        player_responses = game_state.get("player_responses", {})
        answer_tracking = game_state.get("answer_tracking", {})  # Contains judge responses and feedback
        
        # Get scores and feedback from answer_tracking (preferred) or fallback to scores dicts
        behavioural_scores = game_state.get("behavioural_scores", {})
        technical_theory_scores = game_state.get("technical_theory_scores", {})
        technical_practical_scores = game_state.get("technical_practical_scores", {})
        
        comparisons = []
        
        # Q1: Shared behavioural question (behavioural_0)
        q1_data = questions_cache.get("behavioural_0")
        if q1_data:
            q1_question = q1_data.get("question", "")
            q1_id = q1_data.get("question_id")
            
            # Use answer_tracking for answers and feedback (contains judge responses)
            left_q1_tracking = answer_tracking.get("behavioural", {}).get(left_player_id, {}).get("0", {})
            right_q1_tracking = answer_tracking.get("behavioural", {}).get(right_player_id, {}).get("0", {})
            
            # Fallback to player_responses if answer_tracking not available
            if not left_q1_tracking:
                left_q1_response = player_responses.get(left_player_id, {}).get("behavioural", {}).get("0", {})
                left_q1_answer = left_q1_response.get("answer", "") if left_q1_response else ""
            else:
                left_q1_answer = left_q1_tracking.get("answer", "")
            
            if not right_q1_tracking:
                right_q1_response = player_responses.get(right_player_id, {}).get("behavioural", {}).get("0", {})
                right_q1_answer = right_q1_response.get("answer", "") if right_q1_response else ""
            else:
                right_q1_answer = right_q1_tracking.get("answer", "")
            
            # Get scores and feedback from answer_tracking (judge responses)
            left_q1_score = left_q1_tracking.get("score", 0) if left_q1_tracking else 0
            right_q1_score = right_q1_tracking.get("score", 0) if right_q1_tracking else 0
            
            left_q1_feedback = left_q1_tracking.get("feedback", "") if left_q1_tracking else ""
            right_q1_feedback = right_q1_tracking.get("feedback", "") if right_q1_tracking else ""
            
            comparisons.append({
                "questionType": "shared",
                "question": q1_question,
                "phase": "behavioural",
                "questionId": q1_id or "behavioural_q0",
                "leftAnswer": {
                    "playerId": left_player_id,
                    "playerName": left_player_name,
                    "answer": left_q1_answer,
                    "score": left_q1_score,
                    "feedback": left_q1_feedback
                },
                "rightAnswer": {
                    "playerId": right_player_id,
                    "playerName": right_player_name,
                    "answer": right_q1_answer,
                    "score": right_q1_score,
                    "feedback": right_q1_feedback
                }
            })
        
        # Q2: Follow-up questions (behavioural_1 per player)
        left_q2_data = questions_cache.get(f"behavioural_1_{left_player_id}")
        right_q2_data = questions_cache.get(f"behavioural_1_{right_player_id}")
        
        if left_q2_data and right_q2_data:
            left_q2_question = left_q2_data.get("question", "")
            right_q2_question = right_q2_data.get("question", "")
            
            # Use answer_tracking for answers and feedback (contains judge responses)
            left_q2_tracking = answer_tracking.get("behavioural", {}).get(left_player_id, {}).get("1", {})
            right_q2_tracking = answer_tracking.get("behavioural", {}).get(right_player_id, {}).get("1", {})
            
            # Fallback to player_responses if answer_tracking not available
            if not left_q2_tracking:
                left_q2_response = player_responses.get(left_player_id, {}).get("behavioural", {}).get("1", {})
                left_q2_answer = left_q2_response.get("answer", "") if left_q2_response else ""
            else:
                left_q2_answer = left_q2_tracking.get("answer", "")
            
            if not right_q2_tracking:
                right_q2_response = player_responses.get(right_player_id, {}).get("behavioural", {}).get("1", {})
                right_q2_answer = right_q2_response.get("answer", "") if right_q2_response else ""
            else:
                right_q2_answer = right_q2_tracking.get("answer", "")
            
            # Get scores and feedback from answer_tracking (judge responses)
            left_q2_score = left_q2_tracking.get("score", 0) if left_q2_tracking else 0
            right_q2_score = right_q2_tracking.get("score", 0) if right_q2_tracking else 0
            
            left_q2_feedback = left_q2_tracking.get("feedback", "") if left_q2_tracking else ""
            right_q2_feedback = right_q2_tracking.get("feedback", "") if right_q2_tracking else ""
            
            comparisons.append({
                "questionType": "followup",
                "question": "",  # Not used for followup type
                "phase": "behavioural",
                "questionId": "behavioural_q1",
                "leftFollowUp": left_q2_question,
                "rightFollowUp": right_q2_question,
                "leftAnswer": {
                    "playerId": left_player_id,
                    "playerName": left_player_name,
                    "answer": left_q2_answer,
                    "score": left_q2_score,
                    "feedback": left_q2_feedback
                },
                "rightAnswer": {
                    "playerId": right_player_id,
                    "playerName": right_player_name,
                    "answer": right_q2_answer,
                    "score": right_q2_score,
                    "feedback": right_q2_feedback
                }
            })
        
        # Q3: Find easiest question someone got wrong and hardest question someone got right
        # Look through technical theory questions
        wrong_questions = []  # List of (difficulty, question_text, player_id, player_name, answer_text, score, feedback)
        right_questions = []  # List of (difficulty, question_text, player_id, player_name, answer_text, score, feedback)
        
        # Check technical theory questions using answer_tracking
        theory_tracking = answer_tracking.get("technical_theory", {})
        
        for key, question_data in questions_cache.items():
            if key.startswith("technical_theory_"):
                # Extract question index
                parts = key.split("_")
                if len(parts) >= 3:
                    try:
                        q_index = int(parts[2])
                        q_index_str = str(q_index)
                        
                        # Get question ID to look up difficulty
                        question_id = question_data.get("question_id")
                        difficulty = None
                        if question_id:
                            theory_q = db.query(TechnicalTheoryPool).filter(TechnicalTheoryPool.id == question_id).first()
                            if theory_q:
                                difficulty = theory_q.difficulty
                        
                        question_text = question_data.get("question", "")
                        
                        # Check both players' answers using answer_tracking
                        for player_id in [left_player_id, right_player_id]:
                            player_name = player_names.get(player_id, player_id)
                            player_tracking = theory_tracking.get(player_id, {})
                            
                            if isinstance(player_tracking, dict) and q_index_str in player_tracking:
                                tracking_data = player_tracking[q_index_str]
                                
                                # Use answer_text (the mapped answer text, not option letter)
                                answer_text = tracking_data.get("answer_text", "")
                                if not answer_text:
                                    # Fallback to answer (option letter) if answer_text not available
                                    answer_text = tracking_data.get("answer", "")
                                
                                # Get correctness and score from answer_tracking
                                is_correct = tracking_data.get("is_correct", False)
                                score = tracking_data.get("score", 0)
                                
                                # Get feedback if available
                                feedback = tracking_data.get("feedback", "")
                                
                                # If difficulty is None, try to get it from question_data or use a default
                                if difficulty is None:
                                    # Try to get difficulty from question_data if stored there
                                    difficulty = question_data.get("difficulty")
                                    if difficulty is None:
                                        # Use a default difficulty based on level if available
                                        # For now, skip questions without difficulty
                                        print(f"[MATCH_SUMMARY] Q3: Skipping question {q_index} - no difficulty found")
                                        continue
                                
                                if answer_text:
                                    if not is_correct:
                                        wrong_questions.append((difficulty, question_text, player_id, player_name, answer_text, score, feedback))
                                    else:
                                        right_questions.append((difficulty, question_text, player_id, player_name, answer_text, score, feedback))
                            else:
                                # Fallback: try player_responses if answer_tracking doesn't have it
                                theory_responses = player_responses.get(player_id, {}).get("technical_theory", {})
                                if isinstance(theory_responses, dict) and q_index_str in theory_responses:
                                    response = theory_responses[q_index_str]
                                    answer_text = response.get("answer", "")  # This will be option letter
                                    
                                    # Try to get score and correctness from technical_theory_scores
                                    theory_scores = technical_theory_scores.get(player_id, {})
                                    score_data = theory_scores.get(q_index_str, {}) if isinstance(theory_scores, dict) else {}
                                    score = score_data.get("score", 0) if isinstance(score_data, dict) else 0
                                    is_correct = score > 0
                                    
                                    # Get difficulty
                                    if difficulty is None:
                                        difficulty = question_data.get("difficulty")
                                        if difficulty is None:
                                            continue
                                    
                                    if answer_text:
                                        feedback = f"{'Correct!' if is_correct else 'Incorrect.'}"
                                        if not is_correct:
                                            wrong_questions.append((difficulty, question_text, player_id, player_name, answer_text, score, feedback))
                                        else:
                                            right_questions.append((difficulty, question_text, player_id, player_name, answer_text, score, feedback))
                    except (ValueError, IndexError) as e:
                        print(f"[MATCH_SUMMARY] Error processing Q3 question {key}: {e}")
                        continue
        
        # Find easiest wrong (lowest difficulty) and hardest right (highest difficulty)
        easiest_wrong = None
        hardest_right = None
        
        if wrong_questions:
            # Sort by difficulty ascending (easiest first)
            wrong_questions.sort(key=lambda x: x[0] if x[0] is not None else 999)
            easiest_wrong = wrong_questions[0]
        
        if right_questions:
            # Sort by difficulty descending (hardest first)
            right_questions.sort(key=lambda x: x[0] if x[0] is not None else -1, reverse=True)
            hardest_right = right_questions[0]
        
        # Add Q3 comparison
        if easiest_wrong or hardest_right:
            wrong_data = None
            right_data = None
            
            if easiest_wrong:
                difficulty, question_text, player_id, player_name, answer_text, score, feedback = easiest_wrong
                # Use feedback from judge if available, otherwise create default
                feedback_text = feedback if feedback else f"Easiest question ({difficulty} difficulty) that was missed"
                wrong_data = {
                    "wrongQuestion": question_text,
                    "wrongAnswer": {
                        "playerId": player_id,
                        "playerName": player_name,
                        "answer": answer_text,  # Use answer_text (mapped answer, not option letter)
                        "score": score,
                        "feedback": feedback_text
                    },
                    "wrongQuip": f"Even the easiest questions can trip you up!"
                }
            
            if hardest_right:
                difficulty, question_text, player_id, player_name, answer_text, score, feedback = hardest_right
                # Use feedback from judge if available, otherwise create default
                feedback_text = feedback if feedback else f"Hardest question ({difficulty} difficulty) answered correctly!"
                right_data = {
                    "rightQuestion": question_text,
                    "bestAnswer": {
                        "playerId": player_id,
                        "playerName": player_name,
                        "answer": answer_text,  # Use answer_text (mapped answer, not option letter)
                        "score": score,
                        "feedback": feedback_text
                    },
                    "rightQuip": f"Impressive! Nailed the hardest question!"
                }
            
            if wrong_data or right_data:
                q3_comparison = {
                    "questionType": "best_worst",
                    "question": "",  # Not used for best_worst type
                    "phase": "technical_theory",
                    "questionId": "technical_theory_q3"
                }
                q3_comparison.update(wrong_data or {})
                q3_comparison.update(right_data or {})
                comparisons.append(q3_comparison)
        
        # Q4: Shared final question (could be technical_practical or another shared question)
        # Look for technical_practical questions
        practical_questions = []
        for key, question_data in questions_cache.items():
            if key.startswith("technical_practical_"):
                parts = key.split("_")
                if len(parts) >= 3:
                    try:
                        q_index = int(parts[2])
                        practical_questions.append((q_index, question_data))
                    except (ValueError, IndexError):
                        continue
        
        # Use the last practical question as Q4, or first if only one
        if practical_questions:
            practical_questions.sort(key=lambda x: x[0])
            q4_index, q4_data = practical_questions[-1]  # Use last question
            q4_index_str = str(q4_index)
            
            q4_question = q4_data.get("question", "")
            q4_id = q4_data.get("question_id")
            
            # Use answer_tracking for answers and feedback (contains judge responses)
            practical_tracking = answer_tracking.get("technical_practical", {})
            left_q4_tracking = practical_tracking.get(left_player_id, {}).get(q4_index_str, {})
            right_q4_tracking = practical_tracking.get(right_player_id, {}).get(q4_index_str, {})
            
            # Get answer - prefer text_answer, fallback to ide_code or answer
            if left_q4_tracking:
                left_q4_answer = left_q4_tracking.get("text_answer", "") or left_q4_tracking.get("ide_code", "") or left_q4_tracking.get("answer", "")
            else:
                left_q4_response = player_responses.get(left_player_id, {}).get("technical_practical", {}).get(q4_index_str, {})
                left_q4_answer = left_q4_response.get("answer", "") if left_q4_response else ""
            
            if right_q4_tracking:
                right_q4_answer = right_q4_tracking.get("text_answer", "") or right_q4_tracking.get("ide_code", "") or right_q4_tracking.get("answer", "")
            else:
                right_q4_response = player_responses.get(right_player_id, {}).get("technical_practical", {}).get(q4_index_str, {})
                right_q4_answer = right_q4_response.get("answer", "") if right_q4_response else ""
            
            # Get scores and feedback from answer_tracking (judge responses)
            left_q4_score = left_q4_tracking.get("score", 0) if left_q4_tracking else 0
            right_q4_score = right_q4_tracking.get("score", 0) if right_q4_tracking else 0
            
            left_q4_feedback = left_q4_tracking.get("feedback", "") if left_q4_tracking else ""
            right_q4_feedback = right_q4_tracking.get("feedback", "") if right_q4_tracking else ""
            
            comparisons.append({
                "questionType": "shared_final",
                "question": q4_question,
                "phase": "technical_practical",
                "questionId": q4_id or f"technical_practical_q{q4_index}",
                "leftAnswer": {
                    "playerId": left_player_id,
                    "playerName": left_player_name,
                    "answer": left_q4_answer,
                    "score": left_q4_score,
                    "feedback": left_q4_feedback
                },
                "rightAnswer": {
                    "playerId": right_player_id,
                    "playerName": right_player_name,
                    "answer": right_q4_answer,
                    "score": right_q4_score,
                    "feedback": right_q4_feedback
                }
            })
        
        summary = {
            "comparisons": comparisons,
            "matchId": match_id,
            "players": [
                {"id": left_player_id, "name": left_player_name},
                {"id": right_player_id, "name": right_player_name}
            ]
        }
        
        print(f"[MATCH_SUMMARY] Generated summary with {len(comparisons)} comparisons for match {match_id}")
        print(f"[MATCH_SUMMARY] Q3 debug - wrong_questions found: {len(wrong_questions)}, right_questions found: {len(right_questions)}")
        if wrong_questions:
            print(f"[MATCH_SUMMARY] Q3 debug - easiest_wrong: difficulty={easiest_wrong[0]}, question={easiest_wrong[1][:50]}...")
        if right_questions:
            print(f"[MATCH_SUMMARY] Q3 debug - hardest_right: difficulty={hardest_right[0]}, question={hardest_right[1][:50]}...")
        return summary
        
    except Exception as e:
        print(f"[MATCH_SUMMARY] Error generating summary for match {match_id}: {e}")
        import traceback
        traceback.print_exc()
        return None
    finally:
        db.close()


def store_match_summary_json(match_id: str) -> bool:
    """
    Generate and store match summary JSON in database
    
    Args:
        match_id: The match ID
        
    Returns:
        True if successful, False otherwise
    """
    summary_json = generate_match_summary_json(match_id)
    if not summary_json:
        return False
    
    db: Session = SessionLocal()
    try:
        match_record = db.query(OngoingMatch).filter(OngoingMatch.match_id == match_id).first()
        if not match_record:
            print(f"[MATCH_SUMMARY] Match {match_id} not found for storage")
            return False
        
        from sqlalchemy.orm.attributes import flag_modified
        match_record.match_summary_json = summary_json
        flag_modified(match_record, "match_summary_json")
        db.commit()
        
        print(f"[MATCH_SUMMARY] Stored summary JSON for match {match_id}")
        return True
        
    except Exception as e:
        db.rollback()
        print(f"[MATCH_SUMMARY] Error storing summary for match {match_id}: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()

