from __future__ import annotations

from typing import Any, Dict, Optional

from pydantic import BaseModel


class ChatMessage(BaseModel):
	role: str  # 'system' | 'user' | 'assistant'
	content: str


class GenerateRequestBody(BaseModel):
	messages: Optional[list[ChatMessage]] = None
	prompt: Optional[str] = None
	stream: Optional[bool] = None
	metadata: Optional[Dict[str, Any]] = None


class TokenUsage(BaseModel):
	prompt_tokens: Optional[int] = None
	completion_tokens: Optional[int] = None
	total_tokens: Optional[int] = None


class GenerateResponseBody(BaseModel):
	text: str
	usage: Optional[TokenUsage] = None


class RoleQuestionsRequest(BaseModel):
	role: str
	max_questions: int = 10


class RoleQuestionsResponse(BaseModel):
	role: str
	behavioural_questions: list[str]


