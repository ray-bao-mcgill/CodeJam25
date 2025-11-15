from __future__ import annotations

from fastapi import APIRouter

from .client import LLMClient, LLMTextRequest
from .schemas import GenerateRequestBody, GenerateResponseBody, RoleQuestionsRequest, RoleQuestionsResponse
from .prompts.renderer import render as render_prompt


def create_llm_router(client: LLMClient) -> APIRouter:
	router = APIRouter()

	@router.post("/llm/generate", response_model=GenerateResponseBody)
	async def post_generate(_body: GenerateRequestBody) -> GenerateResponseBody:
		# Stub: no implementation yet
		raise NotImplementedError("Not implemented")

	@router.post("/llm/questions", response_model=RoleQuestionsResponse)
	async def post_questions(body: RoleQuestionsRequest) -> RoleQuestionsResponse:
		system = render_prompt("role/system_prompt.jinja")
		prompt = render_prompt("role/user_prompt.jinja", role=body.role, max_questions=body.max_questions)
		resp = await client.generate_text(
			LLMTextRequest(
				prompt=prompt,
				system=system,
				temperature=0.7,
				max_tokens=800,
			)
		)
		lines = [line.strip() for line in resp.text.splitlines() if line.strip()]
		if len(lines) > body.max_questions:
			lines = lines[: body.max_questions]
		return RoleQuestionsResponse(questions=lines)

	return router


