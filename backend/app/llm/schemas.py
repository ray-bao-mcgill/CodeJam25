from pydantic import BaseModel
from typing import Dict

class RoleQuestionsRequest(BaseModel):
    role: str
    max_questions: int = 10

class RoleQuestionsResponse(BaseModel):
    role: str
    behavioural_questions: list[str]

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


