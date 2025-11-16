"""
LLM-based scoring for behavioural phase
Scores Q0 and Q1 answers using BehaviouralJudge
"""
from typing import Dict, Optional, Any
from database import SessionLocal, OngoingMatch


async def get_behavioural_questions_and_answers(
    match_id: str,
    player_id: str
) -> Dict[str, Optional[str]]:
    """
    Retrieve Q0 and Q1 questions and answers for a player
    
    Args:
        match_id: The match ID
        player_id: The player ID
    
    Returns:
        Dictionary with keys: q0_question, q0_answer, q1_question, q1_answer
        Values are None if not found
    """
    db = SessionLocal()
    try:
        match_record = db.query(OngoingMatch).filter(OngoingMatch.match_id == match_id).first()
        if not match_record:
            return {
                "q0_question": None,
                "q0_answer": None,
                "q1_question": None,
                "q1_answer": None
            }
        
        game_state = match_record.game_state or {}
        if not isinstance(game_state, dict):
            return {
                "q0_question": None,
                "q0_answer": None,
                "q1_question": None,
                "q1_answer": None
            }
        
        # Get questions from questions cache
        questions_cache = game_state.get("questions", {})
        
        # Q0 question (shared across all players)
        q0_key = "behavioural_0"
        q0_question_data = questions_cache.get(q0_key)
        q0_question = q0_question_data.get("question") if q0_question_data else None
        
        # Q1 question (personalized per player)
        q1_key = f"behavioural_1_{player_id}"
        q1_question_data = questions_cache.get(q1_key)
        q1_question = q1_question_data.get("question") if q1_question_data else None
        
        # Get answers from player_responses
        player_responses = game_state.get("player_responses", {})
        player_data = player_responses.get(player_id, {})
        behavioural_data = player_data.get("behavioural", {})
        
        # Q0 answer (question_index 0)
        q0_answer_data = behavioural_data.get("0") or behavioural_data.get(0)
        q0_answer = q0_answer_data.get("answer") if q0_answer_data else None
        
        # Q1 answer (question_index 1)
        q1_answer_data = behavioural_data.get("1") or behavioural_data.get(1)
        q1_answer = q1_answer_data.get("answer") if q1_answer_data else None
        
        return {
            "q0_question": q0_question,
            "q0_answer": q0_answer,
            "q1_question": q1_question,
            "q1_answer": q1_answer
        }
    finally:
        db.close()


async def score_behavioural_answers(
    match_id: str,
    player_id: str,
    judge
) -> int:
    """
    Score a player's behavioural answers using LLM judge
    
    Args:
        match_id: The match ID
        player_id: The player ID
        judge: BehaviouralJudge instance
    
    Returns:
        Total score (Q0 score + Q1 score), or 0 if questions/answers not found
    """
    # Get questions and answers
    data = await get_behavioural_questions_and_answers(match_id, player_id)
    
    q0_question = data.get("q0_question")
    q0_answer = data.get("q0_answer")
    q1_question = data.get("q1_question")
    q1_answer = data.get("q1_answer")
    
    total_score = 0
    
    # Score Q0 if we have both question and answer
    if q0_question and q0_answer:
        try:
            print(f"[BEHAVIOURAL_SCORING] Scoring Q0 for player {player_id}")
            q0_result = await judge.judge(q0_question, q0_answer)
            q0_score = q0_result.score
            total_score += q0_score
            print(f"[BEHAVIOURAL_SCORING] Q0 score: {q0_score} (reasoning: {q0_result.reasoning[:100]}...)")
        except Exception as e:
            print(f"[BEHAVIOURAL_SCORING] Error scoring Q0 for player {player_id}: {e}")
            import traceback
            traceback.print_exc()
            # Continue with Q1 even if Q0 fails
    else:
        print(f"[BEHAVIOURAL_SCORING] Missing Q0 data for player {player_id}: question={q0_question is not None}, answer={q0_answer is not None}")
    
    # Score Q1 if we have both question and answer
    if q1_question and q1_answer:
        try:
            print(f"[BEHAVIOURAL_SCORING] Scoring Q1 for player {player_id}")
            q1_result = await judge.judge(q1_question, q1_answer)
            q1_score = q1_result.score
            total_score += q1_score
            print(f"[BEHAVIOURAL_SCORING] Q1 score: {q1_score} (reasoning: {q1_result.reasoning[:100]}...)")
        except Exception as e:
            print(f"[BEHAVIOURAL_SCORING] Error scoring Q1 for player {player_id}: {e}")
            import traceback
            traceback.print_exc()
            # Continue even if Q1 fails
    else:
        print(f"[BEHAVIOURAL_SCORING] Missing Q1 data for player {player_id}: question={q1_question is not None}, answer={q1_answer is not None}")
    
    print(f"[BEHAVIOURAL_SCORING] Total score for player {player_id}: {total_score}")
    return total_score

