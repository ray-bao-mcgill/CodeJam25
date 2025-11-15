import httpx
from .client import LLMTextRequest, LLMTextResponse, LLMUsage

class OpenAIClient:
    def __init__(self, api_key):
        self._api_key = api_key
        self._base_url = "https://api.openai.com/v1"
        self._model = "gpt-4o-mini"
        self._timeout_s = 30

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
            "temperature": input.temperature or 0.7,
            "max_tokens": input.max_tokens or 800,
        }
        async with httpx.AsyncClient(timeout=self._timeout_s) as client:
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
