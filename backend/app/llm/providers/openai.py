from __future__ import annotations

from typing import Optional

from ..client import LLMClient, LLMTextRequest, LLMTextResponse


class OpenAIClient(LLMClient):
	def __init__(
		self,
		api_key: Optional[str] = None,
		base_url: Optional[str] = None,
		model: Optional[str] = None,
		timeout_ms: Optional[int] = None,
		max_retries: Optional[int] = None,
	) -> None:
		self._api_key = api_key
		self._base_url = base_url
		self._model = model
		self._timeout_ms = timeout_ms
		self._max_retries = max_retries

	async def generate_text(self, input: LLMTextRequest) -> LLMTextResponse:
		raise NotImplementedError("Not implemented")


