"""
Scoring system - calculates scores for players based on their answers
Can be replaced with LLM-based scoring later
"""
from typing import Dict, List, Optional, Any
import random
import hashlib


def calculate_player_score(
    match_id: str,
    player_id: str,
    phase: str,
    answers: List[Dict[str, Any]],
    correct_answers: Optional[Dict[str, str]] = None
) -> int:
    """
    Calculate score for a single player for a phase
    
    Args:
        match_id: The match ID (for deterministic randomness)
        player_id: The player ID
        phase: The phase name (behavioural, technical_theory, technical_practical)
        answers: List of answer dictionaries with question_id, answer, question_index
        correct_answers: Optional dict mapping question_id to correct answer
    
    Returns:
        Score for this player (0-100)
    """
    # For now, use deterministic random based on match_id + player_id + phase
    # This ensures consistent scores across requests but different per player
    seed_string = f"{match_id}_{player_id}_{phase}"
    seed = int(hashlib.md5(seed_string.encode()).hexdigest()[:8], 16)
    random.seed(seed)
    
    # Generate random score between 50-100 for testing
    # TODO: Replace with LLM-based scoring that evaluates answers
    score = random.randint(50, 100)
    
    # If we have correct answers, calculate based on correctness
    if correct_answers and answers:
        correct_count = 0
        total_questions = len(answers)
        
        for answer_data in answers:
            question_id = answer_data.get("question_id", "")
            player_answer = answer_data.get("answer", "")
            
            if question_id in correct_answers:
                if player_answer.strip().upper() == correct_answers[question_id].strip().upper():
                    correct_count += 1
        
        # Score based on percentage correct (50-100 range)
        if total_questions > 0:
            percentage = correct_count / total_questions
            score = int(50 + (percentage * 50))  # 50-100 range
    
    return score


def calculate_phase_scores(
    match_id: str,
    phase: str,
    player_ids: List[str],
    player_answers: Dict[str, List[Dict[str, Any]]],
    correct_answers: Optional[Dict[str, str]] = None
) -> Dict[str, int]:
    """
    Calculate scores for all players in a phase
    
    Args:
        match_id: The match ID
        phase: The phase name
        player_ids: List of player IDs
        player_answers: Dict mapping player_id to list of their answers
        correct_answers: Optional dict mapping question_id to correct answer
    
    Returns:
        Dictionary mapping player_id to score
    """
    scores = {}
    
    for player_id in player_ids:
        answers = player_answers.get(player_id, [])
        score = calculate_player_score(
            match_id=match_id,
            player_id=player_id,
            phase=phase,
            answers=answers,
            correct_answers=correct_answers
        )
        scores[player_id] = score
    
    return scores

