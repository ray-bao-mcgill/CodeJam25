from pydantic import BaseModel

class LLMTextRequest(BaseModel):
    prompt: str
    system: str = None
    temperature: float = None
    max_tokens: int = None
    metadata: dict = None

class LLMUsage(BaseModel):
    prompt_tokens: int = None
    completion_tokens: int = None
    total_tokens: int = None

class LLMTextResponse(BaseModel):
    text: str
    usage: LLMUsage = None
    raw: dict = None


