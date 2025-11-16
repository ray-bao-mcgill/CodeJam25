"""
Question Manager - Selects questions from database pools based on match configuration
"""
import random
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from database import SessionLocal, BehaviouralPool, TechnicalTheoryPool, TechnicalPracticalPool


class QuestionManager:
    """Manages question selection from database pools"""
    
    @staticmethod
    def get_question_for_phase(
        match_type: str,
        phase: str,
        match_config: Dict[str, Any],
        question_index: Optional[int] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get a question for a specific game phase
        
        Args:
            match_type: "job_posting" or "generalized"
            phase: Game phase - "behavioural", "technical_theory", "technical_practical"
            match_config: Match configuration dict containing role, level, etc.
            question_index: Optional index for phases with multiple questions (e.g., behavioural Q0, Q1)
        
        Returns:
            Question dict with question data, or None if not found
        """
        # For job_posting type, we'll use LLM generation (not implemented yet)
        # For now, only handle generalized matches
        if match_type != "generalized":
            # TODO: Implement LLM-based question generation for job_posting
            return None
        
        # Get role and level from match_config
        role = match_config.get("role")
        level = match_config.get("level")
        
        if not role or not level:
            print(f"[QUESTION_MANAGER] Missing role or level in match_config: {match_config}")
            return None
        
        # Normalize role and level to match database/JSON values
        # Roles: Keep spaces (e.g., "software engineering"), just lowercase and strip
        role = role.lower().strip()
        
        # Levels: Remove hyphens, underscores, spaces (e.g., "mid-level" -> "midlevel")
        # Database stores: "intern", "junior", "midlevel", "senior", "lead"
        level = level.lower().strip().replace("-", "").replace("_", "").replace(" ", "")
        
        print(f"[QUESTION_MANAGER] Normalized role='{role}', level='{level}' (from role='{match_config.get('role')}', level='{match_config.get('level')}')")
        
        # Map phase to pool table
        if phase == "behavioural":
            # Only query database for Q0 (question_index 0)
            # Q1 (question_index 1) will be LLM-generated based on player's answer
            if question_index == 1:
                print(f"[QUESTION_MANAGER] Q1 requested - should be LLM-generated (not implemented yet)")
                return None  # Will be handled by LLM generation later
            return QuestionManager._get_behavioural_question(role, level, question_index)
        elif phase == "technical_theory":
            return QuestionManager._get_technical_theory_question(role, level)
        elif phase == "technical_practical":
            return QuestionManager._get_technical_practical_question(role, level)
        else:
            print(f"[QUESTION_MANAGER] Unknown phase: {phase}")
            return None
    
    @staticmethod
    def _get_behavioural_question(
        role: str,
        level: str,
        question_index: Optional[int] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get a random behavioural question from the pool
        
        Args:
            role: Role name (e.g., "software engineering", "backend")
            level: Level name (e.g., "intern", "junior", "midlevel", "senior", "lead")
            question_index: Question index (0 for first question, 1 for follow-up)
        
        Returns:
            Question dict with question data
        """
        db: Session = SessionLocal()
        try:
            # Query questions matching role and level
            query = db.query(BehaviouralPool).filter(
                BehaviouralPool.role == role,
                BehaviouralPool.level == level
            )
            
            questions = query.all()
            
            if not questions:
                print(f"[QUESTION_MANAGER] No behavioural questions found for role={role}, level={level}")
                # Try to find questions with similar role/level
                # For now, return None - could implement fallback logic
                return None
            
            # Select a random question
            selected_question = random.choice(questions)
            
            # Increment used_count
            selected_question.used_count += 1
            db.commit()
            
            print(f"[QUESTION_MANAGER] Selected behavioural question (id={selected_question.id}) for role={role}, level={level}")
            
            return {
                "question_id": f"behavioural_{selected_question.id}_{question_index or 0}",
                "question": selected_question.question,
                "phase": "behavioural",
                "question_index": question_index or 0,
                "role": selected_question.role,
                "level": selected_question.level
            }
        except Exception as e:
            db.rollback()
            print(f"[QUESTION_MANAGER] Error getting behavioural question: {e}")
            import traceback
            traceback.print_exc()
            return None
        finally:
            db.close()
    
    @staticmethod
    def _get_technical_theory_question(
        role: str,
        level: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get a random technical theory question from the pool
        
        Args:
            role: Role name
            level: Level name
        
        Returns:
            Question dict with question data including correct/incorrect answers
        """
        db: Session = SessionLocal()
        try:
            query = db.query(TechnicalTheoryPool).filter(
                TechnicalTheoryPool.role == role,
                TechnicalTheoryPool.level == level
            )
            
            questions = query.all()
            
            if not questions:
                print(f"[QUESTION_MANAGER] No technical theory questions found for role={role}, level={level}")
                return None
            
            selected_question = random.choice(questions)
            selected_question.used_count += 1
            db.commit()
            
            print(f"[QUESTION_MANAGER] Selected technical theory question (id={selected_question.id}) for role={role}, level={level}")
            
            return {
                "question_id": f"technical_theory_{selected_question.id}",
                "question": selected_question.question,
                "correct_answer": selected_question.correct_answer,
                "incorrect_answers": selected_question.incorrect_answers,
                "phase": "technical_theory",
                "role": selected_question.role,
                "level": selected_question.level
            }
        except Exception as e:
            db.rollback()
            print(f"[QUESTION_MANAGER] Error getting technical theory question: {e}")
            import traceback
            traceback.print_exc()
            return None
        finally:
            db.close()
    
    @staticmethod
    def get_technical_theory_questions(
        role: str,
        level: str,
        count: int = 10,
        seed: Optional[str] = None
    ) -> list[Dict[str, Any]]:
        """
        Get multiple technical theory questions in a deterministic order (same for all clients)
        
        Args:
            role: Role name
            level: Level name
            count: Number of questions to return (default 10)
            seed: Optional seed for deterministic selection (e.g., match_id)
        
        Returns:
            List of question dicts with question data including correct/incorrect answers
        """
        db: Session = SessionLocal()
        try:
            query = db.query(TechnicalTheoryPool).filter(
                TechnicalTheoryPool.role == role,
                TechnicalTheoryPool.level == level
            )
            
            questions = query.all()
            
            if not questions:
                print(f"[QUESTION_MANAGER] No technical theory questions found for role={role}, level={level}")
                return []
            
            if len(questions) < count:
                print(f"[QUESTION_MANAGER] WARNING: Only {len(questions)} questions available, requested {count}")
                count = len(questions)
            
            # Use seed for deterministic selection if provided
            if seed:
                # Create a deterministic random state from seed
                seed_hash = hash(seed)
                rng = random.Random(seed_hash)
                selected_questions = rng.sample(questions, min(count, len(questions)))
            else:
                # Random selection (not deterministic)
                selected_questions = random.sample(questions, min(count, len(questions)))
            
            # Increment used_count for all selected questions
            for q in selected_questions:
                q.used_count += 1
            db.commit()
            
            print(f"[QUESTION_MANAGER] Selected {len(selected_questions)} technical theory questions for role={role}, level={level}")
            
            # Return questions in a list with their index
            result = []
            for idx, selected_question in enumerate(selected_questions):
                result.append({
                    "question_id": f"technical_theory_{selected_question.id}_{idx}",
                    "question": selected_question.question,
                    "correct_answer": selected_question.correct_answer,
                    "incorrect_answers": selected_question.incorrect_answers,
                    "phase": "technical_theory",
                    "question_index": idx,
                    "role": selected_question.role,
                    "level": selected_question.level
                })
            
            return result
        except Exception as e:
            db.rollback()
            print(f"[QUESTION_MANAGER] Error getting technical theory questions: {e}")
            import traceback
            traceback.print_exc()
            return []
        finally:
            db.close()
    
    @staticmethod
    def _get_technical_practical_question(
        role: str,
        level: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get a random technical practical question from the pool
        
        Args:
            role: Role name
            level: Level name
        
        Returns:
            Question dict with question data
        """
        db: Session = SessionLocal()
        try:
            query = db.query(TechnicalPracticalPool).filter(
                TechnicalPracticalPool.role == role,
                TechnicalPracticalPool.level == level
            )
            
            questions = query.all()
            
            if not questions:
                print(f"[QUESTION_MANAGER] No technical practical questions found for role={role}, level={level}")
                return None
            
            selected_question = random.choice(questions)
            selected_question.used_count += 1
            db.commit()
            
            print(f"[QUESTION_MANAGER] Selected technical practical question (id={selected_question.id}) for role={role}, level={level}")
            
            return {
                "question_id": f"technical_practical_{selected_question.id}",
                "question": selected_question.question,
                "phase": "technical_practical",
                "role": selected_question.role,
                "level": selected_question.level
            }
        except Exception as e:
            db.rollback()
            print(f"[QUESTION_MANAGER] Error getting technical practical question: {e}")
            import traceback
            traceback.print_exc()
            return None
        finally:
            db.close()


# Global instance
question_manager = QuestionManager()

