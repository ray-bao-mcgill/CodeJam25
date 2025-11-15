from __future__ import annotations

from fastapi import APIRouter

from .client import LLMClient, LLMTextRequest
from .schemas import GenerateRequestBody, GenerateResponseBody


def create_llm_router(client: LLMClient) -> APIRouter:
	router = APIRouter()

	@router.post("/llm/generate", response_model=GenerateResponseBody)
	async def post_generate(_body: GenerateRequestBody) -> GenerateResponseBody:
		# Stub: no implementation yet
		raise NotImplementedError("Not implemented")

	return router


