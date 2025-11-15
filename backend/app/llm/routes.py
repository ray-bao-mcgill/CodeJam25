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
        
        # Handle different prompt paths
        if qtype_path == "behavioural":
            system_path = f"role/{qtype_path}/question/system_prompt.jinja"
            prompt_path = f"role/{qtype_path}/question/user_prompt.jinja"
        else:
            system_path = f"role/{qtype_path}/system_prompt.jinja"
            prompt_path = f"role/{qtype_path}/user_prompt.jinja"
        
        system = render_prompt(system_path)
        prompt = render_prompt(prompt_path, role=body.role, max_questions=body.max_questions)
        resp = await client.generate_text(
            LLMTextRequest(
                prompt=prompt,
                system=system,
                temperature=0.7,
                max_tokens=1200 if body.question_type == "technical_theory" else 800,
            )
        )
        
        # Parse questions differently for technical_theory vs others
        if body.question_type == "technical_theory":
            questions = _parse_technical_theory_questions(resp.text, body.max_questions)
        else:
            lines = [line.strip() for line in resp.text.splitlines() if line.strip()]
            if len(lines) > body.max_questions:
                lines = lines[:body.max_questions]
            questions = lines
        
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
        
        # For technical_theory, check by question text to avoid duplicates
        existing_questions = {q.get("question", q) if isinstance(q, dict) else q for q in data[role][level]}
        for q in questions:
            q_text = q.get("question", q) if isinstance(q, dict) else q
            if q_text not in existing_questions:
                data[role][level].append(q)
                existing_questions.add(q_text)
        
        with open(outfile, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        return RoleQuestionsResponse(role=role, level=level, question_type=body.question_type, questions=questions)

    return router

def _parse_technical_theory_questions(text: str, max_questions: int):
    """Parse technical theory questions with answers from LLM output."""
    questions = []
    lines = text.split('\n')
    current_q = None
    
    for line in lines:
        line = line.strip()
        if not line:
            if current_q and current_q.get("question"):
                questions.append(current_q)
                current_q = None
                if len(questions) >= max_questions:
                    break
            continue
        
        if line.startswith("Q:"):
            if current_q and current_q.get("question"):
                questions.append(current_q)
                if len(questions) >= max_questions:
                    break
            current_q = {"question": line[2:].strip(), "correct_answer": "", "incorrect_answers": []}
        elif line.startswith("Correct:") and current_q:
            current_q["correct_answer"] = line[8:].strip()
        elif line.startswith("Incorrect:") and current_q:
            current_q["incorrect_answers"].append(line[10:].strip())
    
    if current_q and current_q.get("question") and len(questions) < max_questions:
        questions.append(current_q)
    
    return questions[:max_questions]


