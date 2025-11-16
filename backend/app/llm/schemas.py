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

class IDEJudgeResult(BaseModel):
    """
    LLM judge output for practical IDE/code evaluations.
    When both tabs are present, each field (completeness, correctness, efficiency) is 0-500 (total 1,500/max 3,000). With only IDE, each field is 0-1,000 (total 3,000).
    Fields:
        completeness (int): 0-500 or 0-1,000
        correctness (int): 0-500 or 0-1,000
        efficiency (int): 0-500 or 0-1,000
        reasoning (str): Explanation for the scores
    """
    completeness: int
    correctness: int
    efficiency: int
    reasoning: str

class TextJudgeResult(BaseModel):
    """
    LLM judge output for practical text evaluations.
    When both tabs are present, each field (completeness, clarity, correctness) is 0-500 (total 1,500/max 3,000). With only Text, each field is 0-1,000 (total 3,000).
    Fields:
        completeness (int): 0-500 or 0-1,000
        clarity (int): 0-500 or 0-1,000
        correctness (int): 0-500 or 0-1,000
        reasoning (str): Explanation for the scores
    """
    completeness: int
    clarity: int
    correctness: int
    reasoning: str


