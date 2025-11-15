from pydantic import BaseModel
from typing import Dict

class RoleQuestionsRequest(BaseModel):
    role: str
    max_questions: int = 10

class RoleQuestionsResponse(BaseModel):
    role: str
    behavioural_questions: list[str]

class BehaviouralJudgeResult(BaseModel):
    score: int
    star_points: Dict[str, int]
    reasoning: str


