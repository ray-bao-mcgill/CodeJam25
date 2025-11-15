from fastapi import APIRouter
from .client import LLMTextRequest
from .schemas import RoleQuestionsRequest, RoleQuestionsResponse
from .prompts.renderer import render as render_prompt
import os
import json

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "output")
OUTPUT_FILES = {
    "behavioural": os.path.join(OUTPUT_DIR, "behavioural.json"),
    "technical_theory": os.path.join(OUTPUT_DIR, "technical_theory.json"),
    "technical_practical": os.path.join(OUTPUT_DIR, "technical_practical.json"),
}

def create_llm_router(client):
    router = APIRouter()

    @router.post("/llm/questions", response_model=RoleQuestionsResponse)
    async def post_questions(body: RoleQuestionsRequest):
        level = body.level or "intern"
        qtype_path = body.question_type
        system = render_prompt(f"role/{qtype_path}/question/system_prompt.jinja")
        prompt = render_prompt(f"role/{qtype_path}/question/user_prompt.jinja", role=body.role, max_questions=body.max_questions)
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
            lines = lines[:body.max_questions]
        
        # Save to file in nested format
        outfile = OUTPUT_FILES[body.question_type]
        data = {}
        if os.path.exists(outfile):
            with open(outfile, "r", encoding="utf-8") as f:
                data = json.load(f)
        role = body.role.lower()
        if role not in data:
            data[role] = {}
        if level not in data[role]:
            data[role][level] = []
        for q in lines:
            if q not in data[role][level]:
                data[role][level].append(q)
        with open(outfile, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        return RoleQuestionsResponse(role=role, level=level, question_type=body.question_type, questions=lines)

    return router


