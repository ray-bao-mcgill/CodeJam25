from __future__ import annotations

import os
from typing import Optional

import httpx

from ..client import LLMClient, LLMTextRequest, LLMTextResponse, LLMUsage


class OpenAIClient(LLMClient):
	def __init__(
		self,
		api_key: Optional[str] = None,
		base_url: Optional[str] = None,
		model: Optional[str] = None,
		timeout_ms: Optional[int] = None,
		max_retries: Optional[int] = None,
	) -> None:
		self._api_key = api_key or os.environ.get("OPENAI_API_KEY")
		self._base_url = base_url or os.environ.get("OPENAI_BASE_URL") or "https://api.openai.com/v1"
		self._model = model or os.environ.get("LLM_MODEL") or "gpt-4o-mini"
		self._timeout_ms = timeout_ms or 30000
		self._max_retries = max_retries or 1

	async def generate_text(self, input: LLMTextRequest) -> LLMTextResponse:
		url = f"{self._base_url}/chat/completions"
		headers = {
			"Authorization": f"Bearer {self._api_key}",
			"Content-Type": "application/json",
		}
		messages = []
		if input.system:
			messages.append({"role": "system", "content": input.system})
		messages.append({"role": "user", "content": input.prompt})

		payload = {
			"model": self._model,
			"messages": messages,
		}
		if input.temperature is not None:
			payload["temperature"] = input.temperature
		if input.max_tokens is not None:
			payload["max_tokens"] = input.max_tokens

		timeout = httpx.Timeout(self._timeout_ms / 1000)
		async with httpx.AsyncClient(timeout=timeout) as client:
			response = await client.post(url, headers=headers, json=payload)
			response.raise_for_status()
			data = response.json()

		text = data["choices"][0]["message"]["content"]
		usage_data = data.get("usage") or {}
		usage = LLMUsage(
			prompt_tokens=usage_data.get("prompt_tokens"),
			completion_tokens=usage_data.get("completion_tokens"),
			total_tokens=usage_data.get("total_tokens"),
		)
		return LLMTextResponse(text=text, usage=usage, raw=data)


