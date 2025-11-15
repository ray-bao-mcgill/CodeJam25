from pydantic import BaseModel
from typing import Dict, Optional

class RoleQuestionsRequest(BaseModel):
    role: str
    level: Optional[str] = None
    max_questions: int = 10
    question_type: str = "behavioural"

class RoleQuestionsResponse(BaseModel):
    role: str
    level: Optional[str] = None
    question_type: str
    questions: list[str]

class BehaviouralJudgeResult(BaseModel):
    """
    LLM judge output format for behavioral question evaluation.
    Fields:
        score (int): 0-500, standardized overall score.
        star_points (dict): Mapping of STAR section name ('Situation', 'Task', etc) to integer points (each 0-125 points).
        reasoning (str): Explanation/rationale for score, referencing star_points.
    """
    score: int
    star_points: Dict[str, int]
    reasoning: str

class TheoreticalJudgeResult(BaseModel):
    """
    Judge output format for technical theory question evaluation.
    Fields:
        score (int): 200 if correct, 0 if incorrect.
        is_correct (bool): Whether the answer matches the correct answer.
        correct_answer (str): The correct answer for reference.
    """
    score: int
    is_correct: bool
    correct_answer: str


