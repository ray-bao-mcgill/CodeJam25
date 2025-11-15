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
from app.llm.judge import BehaviouralJudge, TheoreticalJudge
from app.llm.schemas import BehaviouralJudgeResult, TheoreticalJudgeResult

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
        if not isinstance(v, (list, dict)):
            existing[k] = []
    return existing

def save_type_file(path, d):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(d, f, indent=2, ensure_ascii=False)

def get_nested_question_list(data, role, level):
    if isinstance(data.get(role), dict):
        level_dict = data[role]
        if level in level_dict and isinstance(level_dict[level], list):
            return level_dict[level]
        return []
    return []

def _parse_technical_theory_questions(text, max_questions):
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
            current_q = {"question": line[2:].strip(), "correct": "", "incorrect": []}
        elif line.startswith("Correct:") and current_q:
            current_q["correct"] = line[8:].strip()
        elif line.startswith("Incorrect:") and current_q:
            current_q["incorrect"].append(line[10:].strip())
    
    if current_q and current_q.get("question") and len(questions) < max_questions:
        questions.append(current_q)
    
    return questions[:max_questions]

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
    data = load_type_file(outfile)
    
    # Prompt for role group
    role_lookup = {k.strip().lower(): k for k in data}
    print("\nAvailable roles:", ", ".join(data.keys()) if data else "(none - will create new)")
    while True:
        role_input = input("Enter the role group (case/spacing insensitive): ").strip()
        if not role_input:
            print("Role group cannot be empty.")
            continue
        role_normalized = role_input.lower()
        if role_normalized in role_lookup:
            role = role_lookup[role_normalized]
            break
        else:
            # Allow creating new role
            create = input(f"Role '{role_input}' not found. Create new role? (y/n): ").strip().lower()
            if create in ["y", "yes", ""]:
                role = role_input  # Use original casing
                break
            else:
                print("Please enter an existing role or choose 'y' to create a new one.")
    
    # Prompt for level (always use nested structure)
    valid_levels = ["intern", "junior", "midlevel", "senior", "lead"]
    level_lookup = {k.strip().lower(): k for k in valid_levels}
    print(f"\nAvailable levels: {', '.join(valid_levels)}")
    while True:
        level_input = input("Enter the level (case/spacing insensitive): ").strip().lower()
        if level_input in level_lookup:
            level = level_lookup[level_input]
            break
        else:
            print(f"Invalid level. Please choose from: {', '.join(valid_levels)}")
    
    num = input("How many questions? (Default 5): ").strip()
    try:
        max_questions = int(num)
    except Exception:
        max_questions = 5
    
    # Handle different prompt paths
    if qtype_path == "behavioural":
        system_path = f"role/{qtype_path}/question/system_prompt.jinja"
        prompt_path = f"role/{qtype_path}/question/user_prompt.jinja"
    else:
        system_path = f"role/{qtype_path}/system_prompt.jinja"
        prompt_path = f"role/{qtype_path}/user_prompt.jinja"
    
    system = render_prompt(system_path)
    prompt = render_prompt(prompt_path, role=role, max_questions=max_questions)
    client = OpenAIClient(api_key=os.getenv("OPENAI_API_KEY"))
    resp = await client.generate_text(LLMTextRequest(
        prompt=prompt,
        system=system,
        temperature=0.7,
        max_tokens=1200 if qtype == "technical_theory" else 800,
    ))
    
    # Parse questions differently for technical_theory vs others
    if qtype == "technical_theory":
        questions = _parse_technical_theory_questions(resp.text, max_questions)
    else:
        lines = [line.strip() for line in resp.text.splitlines() if line.strip()]
        if len(lines) > max_questions:
            lines = lines[:max_questions]
        questions = lines
    
    # Ensure nested structure exists and add questions
    if role not in data or not isinstance(data[role], dict):
        data[role] = {}
    if level not in data[role] or not isinstance(data[role][level], list):
        data[role][level] = []
    
    # Add new questions to existing list (avoid duplicates)
    ex = data[role][level]
    existing_questions = {q.get("question", q) if isinstance(q, dict) else q for q in ex}
    for q in questions:
        q_text = q.get("question", q) if isinstance(q, dict) else q
        if q_text not in existing_questions:
            ex.append(q)
            existing_questions.add(q_text)
    data[role][level] = ex
    
    save_type_file(outfile, data)
    print(f"\nLLM Output for {qtype} / role '{role}' / level '{level}':")
    print(json.dumps({"role": role, "level": level, "questions": ex}, indent=2, ensure_ascii=False))
    print(f"Saved/updated role entry (stored as '{role}' / '{level}') in {outfile}\n")

async def run_behavioural_scoring():
    print("\n[Behavioural LLM Judge: Score an answer]\n")
    behavioural_data = load_type_file(OUTPUT_FILES["behavioural"])
    role_lookup = {k.strip().lower(): k for k in behavioural_data}
    print("Available roles:", ", ".join(behavioural_data.keys()))
    while True:
        role_input = input("Enter the role group (case/spacing insensitive): ").strip().lower()
        if role_input in role_lookup:
            role = role_lookup[role_input]
            print(f"Matched role group: '{role}' (raw key from file)")
            break
        else:
            print(f"Input '{role_input}' did not match any available role.")
            print("Available roles:", ", ".join(behavioural_data.keys()))
    level = None
    question_list = None
    if isinstance(behavioural_data[role], dict):
        level_lookup = {k.strip().lower(): k for k in behavioural_data[role]}
        print(f"Levels for {role}: {', '.join(level_lookup.values())}")
        while True:
            level_input = input("Enter the level (case/spacing insensitive): ").strip().lower()
            if level_input in level_lookup:
                level = level_lookup[level_input]
                print(f"Matched level: '{level}' (raw key from file)")
                question_list = get_nested_question_list(behavioural_data, role, level)
                break
            else:
                print(f"Input '{level_input}' did not match any level for role '{role}'.")
                print("Available levels:", ", ".join(level_lookup.values()))
    else:
        question_list = behavioural_data.get(role, [])
    if not question_list:
        missing = f"role '{role}'"
        if level:
            missing += f" / level '{level}'"
        print(f"No questions found for {missing}. Please generate or add some first.")
        return
    question = random.choice(question_list)
    print(f"Random question for {role}{' / ' + level if level else ''}:\n>> {question}\n")
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

async def run_theoretical_scoring():
    print("\n[Theoretical Judge: Score an answer]\n")
    theory_data = load_type_file(OUTPUT_FILES["technical_theory"])
    role_lookup = {k.strip().lower(): k for k in theory_data}
    print("Available roles:", ", ".join(theory_data.keys()))
    while True:
        role_input = input("Enter the role group (case/spacing insensitive): ").strip().lower()
        if role_input in role_lookup:
            role = role_lookup[role_input]
            print(f"Matched role group: '{role}' (raw key from file)")
            break
        else:
            print(f"Input '{role_input}' did not match any available role.")
            print("Available roles:", ", ".join(theory_data.keys()))
    level = None
    question_list = None
    if isinstance(theory_data[role], dict):
        level_lookup = {k.strip().lower(): k for k in theory_data[role]}
        print(f"Levels for {role}: {', '.join(level_lookup.values())}")
        while True:
            level_input = input("Enter the level (case/spacing insensitive): ").strip().lower()
            if level_input in level_lookup:
                level = level_lookup[level_input]
                print(f"Matched level: '{level}' (raw key from file)")
                question_list = get_nested_question_list(theory_data, role, level)
                break
            else:
                print(f"Input '{level_input}' did not match any level for role '{role}'.")
                print("Available levels:", ", ".join(level_lookup.values()))
    else:
        question_list = theory_data.get(role, [])
    if not question_list:
        missing = f"role '{role}'"
        if level:
            missing += f" / level '{level}'"
        print(f"No questions found for {missing}. Please generate or add some first.")
        return
    question_data = random.choice(question_list)
    if not isinstance(question_data, dict) or "question" not in question_data:
        print("Invalid question format.")
        return
    print(f"\nQuestion for {role} / {level}:")
    print(f">> {question_data['question']}\n")
    if question_data.get("incorrect"):
        print("Options:")
        all_answers = [question_data["correct"]] + question_data["incorrect"]
        random.shuffle(all_answers)
        for i, ans in enumerate(all_answers, 1):
            print(f"  {i}. {ans}")
        print()
    answer = input("Enter your answer: ").strip()
    judge = TheoreticalJudge()
    result = judge.judge(question_data, answer)
    print("\nJudge Result:")
    print(json.dumps(result.dict(), indent=2, ensure_ascii=False))

async def main():
    print("--- LLM Question/Test Utility ---")
    print("g: Generate questions by type and role")
    print("s: Score (judge) a behavioral answer (random question by role)")
    print("t: Score (judge) a theoretical answer (random question by role)")
    mode = input("Mode ([g]enerate, [s]core behavioural, or [t]score theoretical)? ").strip().lower()
    if mode in ("g", "generate", ""):  # default
        await run_generation()
    elif mode in ("s", "score"):
        await run_behavioural_scoring()
    elif mode in ("t", "theory", "theoretical"):
        await run_theoretical_scoring()
    else:
        print(f"Unknown choice '{mode}', use 'g', 's', or 't'.")

if __name__ == "__main__":
    asyncio.run(main())
