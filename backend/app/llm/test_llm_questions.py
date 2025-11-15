import sys
import os
import asyncio
import json
import random
from datetime import datetime
from dotenv import load_dotenv
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Output files by type
OUTPUT_FILES = {
    "behavioural": os.path.join(OUTPUT_DIR, "behavioural.json"),
    "technical_theory": os.path.join(OUTPUT_DIR, "technical_theory.json"),
    "technical_practical": os.path.join(OUTPUT_DIR, "technical_practical.json"),
}

APP_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
if APP_DIR not in sys.path:
    sys.path.insert(0, APP_DIR)
from app.llm.openai import OpenAIClient
from app.llm.client import LLMTextRequest
from app.llm.prompts.renderer import render as render_prompt
from app.llm.llm_judge import BehaviouralJudge
from app.llm.schemas import BehaviouralJudgeResult

def load_type_file(path):
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                existing = json.load(f)
        except Exception:
            existing = {}
        if not isinstance(existing, dict):
            existing = {}
    else:
        existing = {}
    for k, v in list(existing.items()):
        if not isinstance(v, list):
            existing[k] = []
    return existing

def save_type_file(path, d):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(d, f, indent=2, ensure_ascii=False)

async def run_generation():
    allowed_types = ["behavioural", "technical_theory", "technical_practical"]
    typeinp = input("Question type ([b]ehavioural, [t]echnical_theory, [p]ractical)? ").strip().lower()
    if typeinp in ["b", "behavioural", ""]:
        qtype = "behavioural"
        qtype_path = "behavioural"
    elif typeinp in ["t", "technical_theory", "theory"]:
        qtype = "technical_theory"
        qtype_path = "technical_theory"
    elif typeinp in ["p", "practical", "technical_practical"]:
        qtype = "technical_practical"
        qtype_path = "technical_practical"
    else:
        print(f"Unknown type '{typeinp}', defaulting to behavioural.")
        qtype = "behavioural"
        qtype_path = "behavioural"
    outfile = OUTPUT_FILES[qtype]
    role_input = input("Enter the role: ").strip()
    role = role_input.lower()
    num = input("How many questions? (Default 5): ").strip()
    try:
        max_questions = int(num)
    except Exception:
        max_questions = 5
    system = render_prompt(f"role/{qtype_path}/question/system_prompt.jinja")
    prompt = render_prompt(f"role/{qtype_path}/question/user_prompt.jinja", role=role_input, max_questions=max_questions)
    client = OpenAIClient(api_key=os.getenv("OPENAI_API_KEY"))
    resp = await client.generate_text(LLMTextRequest(
        prompt=prompt,
        system=system,
        temperature=0.7,
        max_tokens=800,
    ))
    lines = [line.strip() for line in resp.text.splitlines() if line.strip()]
    if len(lines) > max_questions:
        lines = lines[:max_questions]
    data = load_type_file(outfile)
    ex = data.get(role, [])
    for q in lines:
        if q not in ex:
            ex.append(q)
    data[role] = ex
    save_type_file(outfile, data)
    print(f"\nLLM Output for {qtype} / role '{role_input}':")
    print(json.dumps({"role": role_input, "questions": ex}, indent=2, ensure_ascii=False))
    print(f"Saved/updated role entry (stored as '{role}') in {outfile}\n")

async def run_behavioural_scoring():
    print("\n[Behavioural LLM Judge: Score an answer]\n")
    role_input = input("Enter the role: ").strip()
    role = role_input.lower()
    behavioural_data = load_type_file(OUTPUT_FILES["behavioural"])
    if role not in behavioural_data or not behavioural_data[role]:
        print(f"No questions found for role '{role}'. Please generate or add some first.")
        return
    question = random.choice(behavioural_data[role])
    print(f"Random question for role '{role}':\n>> {question}\n")
    answer = input("Enter the user's answer: ").strip()
    client = OpenAIClient(api_key=os.getenv("OPENAI_API_KEY"))
    judge = BehaviouralJudge(client)
    try:
        result = await judge.judge(question, answer)
    except Exception as e:
        print("[ERROR] LLM returned invalid output:")
        print(e)
        return
    print("\nLLM Judge Result:")
    print(json.dumps(result.dict(), indent=2, ensure_ascii=False))

async def main():
    print("--- LLM Question/Test Utility ---")
    print("g: Generate questions by type and role")
    print("s: Score (judge) a behavioral answer (random question by role)")
    mode = input("Mode ([g]enerate or [s]core)? ").strip().lower()
    if mode in ("g", "generate", ""):  # default
        await run_generation()
    elif mode in ("s", "score"):
        await run_behavioural_scoring()
    else:
        print(f"Unknown choice '{mode}', use 'g' or 's'.")

if __name__ == "__main__":
    asyncio.run(main())
