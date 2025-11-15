import sys
import os
import asyncio
import json
from datetime import datetime
from dotenv import load_dotenv
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

# Path setup
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "output", "behavioural")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "behavioural.json")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Project import setup
APP_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
if APP_DIR not in sys.path:
    sys.path.insert(0, APP_DIR)
from app.llm.providers.openai import OpenAIClient
from app.llm.client import LLMTextRequest
from app.llm.prompts.renderer import render as render_prompt

def to_structured(role, lines):
    return {
        "role": role,
        "behavioural_questions": lines
    }

def load_behavioural():
    """Loads role->questions dict, or returns {} if missing or invalid."""
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                existing = json.load(f)
        except Exception:
            existing = {}
        if not isinstance(existing, dict):
            existing = {}
    else:
        existing = {}
    # Ensure all values are lists
    for k, v in list(existing.items()):
        if not isinstance(v, list):
            existing[k] = []
    return existing

def save_behavioural(d):
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(d, f, indent=2, ensure_ascii=False)

async def main():
    role_input = input("Enter the role: ").strip()
    role = role_input.lower()
    num = input("How many questions? (Default 5): ").strip()
    try:
        max_questions = int(num)
    except Exception:
        max_questions = 5

    # Render system and user prompts
    system = render_prompt("role/system_prompt.jinja")
    prompt = render_prompt("role/user_prompt.jinja", role=role_input, max_questions=max_questions)
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
    # Deduplicate before save
    behavioural = load_behavioural()
    ex = behavioural.get(role, [])
    for q in lines:
        if q not in ex:
            ex.append(q)
    behavioural[role] = ex
    save_behavioural(behavioural)
    print(f"\nLLM Output for role '{role_input}':")
    print(json.dumps({"role": role_input, "behavioural_questions": ex}, indent=2, ensure_ascii=False))
    print(f"Saved/updated role entry (stored as '{role}') in {OUTPUT_FILE}\n")

if __name__ == "__main__":
    asyncio.run(main())
