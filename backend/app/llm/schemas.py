from pydantic import BaseModel

class RoleQuestionsRequest(BaseModel):
    role: str
    max_questions: int = 10

class RoleQuestionsResponse(BaseModel):
    role: str
    behavioural_questions: list[str]


