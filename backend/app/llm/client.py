from __future__ import annotations

from typing import Any, Dict, Optional, Protocol

from pydantic import BaseModel


class LLMTextRequest(BaseModel):
	prompt: str
	system: Optional[str] = None
	temperature: Optional[float] = None
	max_tokens: Optional[int] = None
	metadata: Optional[Dict[str, Any]] = None


class LLMUsage(BaseModel):
	prompt_tokens: Optional[int] = None
	completion_tokens: Optional[int] = None
	total_tokens: Optional[int] = None


class LLMTextResponse(BaseModel):
	text: str
	usage: Optional[LLMUsage] = None
	raw: Optional[Any] = None


class LLMClient(Protocol):
	async def generate_text(self, input: LLMTextRequest) -> LLMTextResponse: ...


