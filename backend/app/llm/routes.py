from fastapi import APIRouter
from .client import LLMTextRequest
from .schemas import RoleQuestionsRequest, RoleQuestionsResponse
from .prompts.renderer import render as render_prompt

def create_llm_router(client):
    router = APIRouter()

    @router.post("/llm/questions", response_model=RoleQuestionsResponse)
    async def post_questions(body: RoleQuestionsRequest):
        role_lc = body.role.lower()
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
        return RoleQuestionsResponse(role=role_lc, behavioural_questions=lines)

    return router


