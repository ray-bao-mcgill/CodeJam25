"""
Scoring for technical practical phase
Scores submissions immediately when players submit using PracticalJudge
Stores incremental scores to avoid recalculation at the end
"""
import json
from typing import Dict, Optional
from datetime import datetime
from database import SessionLocal, OngoingMatch
from app.llm.judge import PracticalJudge
from app.llm.openai import OpenAIClient
import os


async def score_technical_practical_submission(
    match_id: str,
    player_id: str,
    question_index: int,
    submission_data: str
) -> Optional[int]:
    """
    Score a technical practical submission immediately when submitted
    
    Args:
        match_id: The match ID
        player_id: The player ID
        question_index: The question index (should be 0 for practical)
        submission_data: The submission string (can be JSON for IDE, HTML for text, or data URL for drawing)
    
    Returns:
        Total score for this submission, or None if question/submission not found
    """
    db = SessionLocal()
    try:
        match_record = db.query(OngoingMatch).filter(OngoingMatch.match_id == match_id).first()
        if not match_record:
            print(f"[TECHNICAL_PRACTICAL_SCORING] Match {match_id} not found")
            return None
        
        game_state = match_record.game_state or {}
        if not isinstance(game_state, dict):
            print(f"[TECHNICAL_PRACTICAL_SCORING] game_state is not a dict")
            return None
        
        # Get question from questions cache
        questions_cache = game_state.get("questions", {})
        question_key = f"technical_practical_{question_index}"
        question_data = questions_cache.get(question_key)
        
        if not question_data:
            print(f"[TECHNICAL_PRACTICAL_SCORING] Question {question_index} not found in cache")
            return None
        
        # Parse submission to extract IDE code and text answer
        # Submission format can be:
        # 1. JSON object with both: {"ide_files": [...], "text_answer": "..."}
        # 2. JSON stringified array of files: [{"name": "...", "code": "...", "language": "..."}]
        # 3. HTML string (rich text from text editor)
        # 4. Data URL (canvas image - should be ignored)
        
        ide_code = ""
        text_answer = ""
        
        # Try to parse as JSON first
        try:
            parsed = json.loads(submission_data)
            
            if isinstance(parsed, dict):
                # New format: JSON object with both IDE files and text answer
                ide_files = parsed.get("ide_files", [])
                text_answer = parsed.get("text_answer", "")
                
                # Process IDE files
                if isinstance(ide_files, list) and len(ide_files) > 0:
                    code_parts = []
                    for file_data in ide_files:
                        if isinstance(file_data, dict):
                            file_name = file_data.get("name", "")
                            file_code = file_data.get("code", "")
                            if file_code:
                                code_parts.append(f"// File: {file_name}\n{file_code}")
                    ide_code = "\n\n".join(code_parts)
                    print(f"[TECHNICAL_PRACTICAL_SCORING] Parsed combined submission: {len(ide_files)} IDE files, {len(text_answer)} chars text")
                elif text_answer:
                    print(f"[TECHNICAL_PRACTICAL_SCORING] Parsed JSON with text answer only: {len(text_answer)} chars")
                else:
                    print(f"[TECHNICAL_PRACTICAL_SCORING] Empty JSON object submission")
                    
            elif isinstance(parsed, list):
                # IDE submission - concatenate all files' code
                code_parts = []
                for file_data in parsed:
                    if isinstance(file_data, dict):
                        file_name = file_data.get("name", "")
                        file_code = file_data.get("code", "")
                        if file_code:
                            code_parts.append(f"// File: {file_name}\n{file_code}")
                ide_code = "\n\n".join(code_parts)
                print(f"[TECHNICAL_PRACTICAL_SCORING] Parsed IDE submission: {len(parsed)} files, {len(ide_code)} chars")
            else:
                print(f"[TECHNICAL_PRACTICAL_SCORING] Unexpected JSON format: {type(parsed)}")
                
        except (json.JSONDecodeError, TypeError):
            # Not JSON, check if it's HTML (text submission) or data URL (drawing)
            if submission_data.startswith("data:image"):
                # Drawing submission - ignore it
                print(f"[TECHNICAL_PRACTICAL_SCORING] Ignoring drawing submission (data URL)")
                ide_code = ""
                text_answer = ""
            elif submission_data.startswith("<") or "html" in submission_data.lower():
                # HTML/text submission
                text_answer = submission_data
                print(f"[TECHNICAL_PRACTICAL_SCORING] Parsed text submission: {len(text_answer)} chars")
            else:
                # Plain text submission
                text_answer = submission_data
                print(f"[TECHNICAL_PRACTICAL_SCORING] Parsed plain text submission: {len(text_answer)} chars")
        
        # If we have neither IDE code nor text answer, skip judging
        if not ide_code and not text_answer:
            print(f"[TECHNICAL_PRACTICAL_SCORING] No IDE code or text answer found in submission")
            return None
        
        # Prepare question for judge (just the question text)
        question_for_judge = {
            "question": question_data.get("question", "")
        }
        
        # Prepare submission dict for judge
        submission_dict = {
            "ide_file": ide_code,
            "text_answer": text_answer
        }
        
        # Initialize judge and score
        llm_client = OpenAIClient(api_key=os.environ.get("OPENAI_API_KEY"))
        judge = PracticalJudge(llm_client)
        
        print(f"[TECHNICAL_PRACTICAL_SCORING] Judging submission for player {player_id}...")
        print(f"[TECHNICAL_PRACTICAL_SCORING] IDE code present: {bool(ide_code)}, Text answer present: {bool(text_answer)}")
        
        result = await judge.judge_submission(question_for_judge, submission_dict)
        
        total_score = result.get("total_score", 0)
        ide_result = result.get("ide")
        text_result = result.get("text")
        
        print(f"[TECHNICAL_PRACTICAL_SCORING] Player {player_id} scored:")
        if ide_result:
            print(f"  IDE: completeness={ide_result.completeness}, correctness={ide_result.correctness}, efficiency={ide_result.efficiency}")
            print(f"  IDE Reasoning: {ide_result.reasoning}")
        if text_result:
            print(f"  Text: completeness={text_result.completeness}, clarity={text_result.clarity}, correctness={text_result.correctness}")
            print(f"  Text Reasoning: {text_result.reasoning}")
        print(f"  Total score: {total_score}")
        
        # Track answer with feedback in game_state
        # Initialize answer_tracking structure
        if "answer_tracking" not in game_state:
            game_state["answer_tracking"] = {}
        if "technical_practical" not in game_state["answer_tracking"]:
            game_state["answer_tracking"]["technical_practical"] = {}
        if player_id not in game_state["answer_tracking"]["technical_practical"]:
            game_state["answer_tracking"]["technical_practical"][player_id] = {}
        
        # Combine feedback from IDE and text
        feedback_parts = []
        if ide_result and ide_result.reasoning:
            feedback_parts.append(f"IDE: {ide_result.reasoning}")
        if text_result and text_result.reasoning:
            feedback_parts.append(f"Text: {text_result.reasoning}")
        combined_feedback = " | ".join(feedback_parts) if feedback_parts else None
        
        # Store answer with feedback
        game_state["answer_tracking"]["technical_practical"][player_id][str(question_index)] = {
            "ide_code": ide_code if ide_code else None,
            "text_answer": text_answer if text_answer else None,
            "score": total_score,
            "feedback": combined_feedback,
            "attempted": True,
            "answered_at": datetime.utcnow().isoformat(),
            "ide_feedback": ide_result.reasoning if ide_result else None,
            "text_feedback": text_result.reasoning if text_result else None
        }
        
        # Store score incrementally in game_state
        if "technical_practical_scores" not in game_state:
            game_state["technical_practical_scores"] = {}
        
        # Ensure player_id entry is a dict
        if player_id not in game_state["technical_practical_scores"]:
            game_state["technical_practical_scores"][player_id] = {}
        elif not isinstance(game_state["technical_practical_scores"][player_id], dict):
            print(f"[TECHNICAL_PRACTICAL_SCORING] WARNING: Found corrupted structure for player {player_id}, fixing...")
            game_state["technical_practical_scores"][player_id] = {}
        
        # Store individual submission score
        score_record = {
            "score": total_score,
            "question_index": question_index,
            "scored_at": datetime.utcnow().isoformat(),
            "ide_present": bool(ide_code),
            "text_present": bool(text_answer)
        }
        
        if ide_result:
            score_record["ide"] = {
                "completeness": ide_result.completeness,
                "correctness": ide_result.correctness,
                "efficiency": ide_result.efficiency,
                "reasoning": ide_result.reasoning
            }
        
        if text_result:
            score_record["text"] = {
                "completeness": text_result.completeness,
                "clarity": text_result.clarity,
                "correctness": text_result.correctness,
                "reasoning": text_result.reasoning
            }
        
        game_state["technical_practical_scores"][player_id][str(question_index)] = score_record
        game_state["technical_practical_scores"][player_id]["_total"] = total_score
        
        # Use flag_modified to ensure SQLAlchemy tracks the change
        from sqlalchemy.orm.attributes import flag_modified
        match_record.game_state = game_state
        flag_modified(match_record, "game_state")
        db.commit()
        
        print(f"[TECHNICAL_PRACTICAL_SCORING] Stored score. Player {player_id} total: {total_score}")
        
        return total_score
        
    except Exception as e:
        db.rollback()
        print(f"[TECHNICAL_PRACTICAL_SCORING] Error scoring submission: {e}")
        import traceback
        traceback.print_exc()
        return None
    finally:
        db.close()


async def get_technical_practical_total_score(
    match_id: str,
    player_id: str
) -> int:
    """
    Get the total score for a player's technical practical submission
    Uses pre-calculated scores if available, otherwise returns 0
    
    Args:
        match_id: The match ID
        player_id: The player ID
    
    Returns:
        Total score for technical practical submission
    """
    db = SessionLocal()
    try:
        match_record = db.query(OngoingMatch).filter(OngoingMatch.match_id == match_id).first()
        if not match_record:
            return 0
        
        game_state = match_record.game_state or {}
        if not isinstance(game_state, dict):
            return 0
        
        technical_practical_scores = game_state.get("technical_practical_scores", {})
        if not isinstance(technical_practical_scores, dict):
            return 0
        
        player_scores = technical_practical_scores.get(player_id)
        
        if not isinstance(player_scores, dict):
            return 0
        
        # Check if we have a pre-calculated total
        if "_total" in player_scores:
            total_value = player_scores["_total"]
            if isinstance(total_value, (int, float)):
                return int(total_value)
        
        # Otherwise calculate from individual scores
        total = 0
        for key, s in player_scores.items():
            if key == "_total":
                continue
            if isinstance(s, dict) and "score" in s:
                score_value = s.get("score", 0)
                if isinstance(score_value, (int, float)):
                    total += int(score_value)
        
        return total
        
    except Exception as e:
        print(f"[TECHNICAL_PRACTICAL_SCORING] Error getting total score: {e}")
        return 0
    finally:
        db.close()

