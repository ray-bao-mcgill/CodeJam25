import os
import sys
import asyncio
import json
import argparse
from dotenv import load_dotenv


def _setup_paths():
    """
    Ensure the project root is on sys.path so that `app.llm` imports work
    when running this file directly.
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    app_dir = os.path.abspath(os.path.join(script_dir, "..", ".."))
    if app_dir not in sys.path:
        sys.path.insert(0, app_dir)
    return script_dir


SCRIPT_DIR = _setup_paths()
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "output")
TECH_THEORY_PATH = os.path.join(OUTPUT_DIR, "technical_theory.json")


# Now that sys.path is configured, import project modules
from app.llm.openai import OpenAIClient  # type: ignore  # noqa: E402
from app.llm.client import LLMTextRequest  # type: ignore  # noqa: E402
from app.llm.prompts.renderer import render as render_prompt  # type: ignore  # noqa: E402
from app.llm.routes import _parse_technical_theory_questions  # type: ignore  # noqa: E402


async def run_single_theory_generation(
    role: str = "software engineering",
    level: str = "intern",
) -> None:
    """
    Temporary helper to run the technical_theory LLM pipeline end-to-end
    using the updated templates (with Difficulty: 1–100) and parser.

    - Calls the technical_theory system/user prompts
    - Lets the LLM generate question blocks with Difficulty
    - Parses them into dicts with question/difficulty/correct/incorrect
    - Prints them for review (no file writes).
    """
    load_dotenv(dotenv_path=os.path.join(SCRIPT_DIR, "..", "..", ".env"))

    # Load existing data to determine how many more questions we need.
    if os.path.exists(TECH_THEORY_PATH):
        try:
            with open(TECH_THEORY_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            data = {}
    else:
        data = {}

    role_key = role
    level_key = level

    # Normalize structure
    if role_key not in data or not isinstance(data[role_key], dict):
        data[role_key] = {}
    if level_key not in data[role_key] or not isinstance(data[role_key][level_key], list):
        data[role_key][level_key] = []

    existing_list = data[role_key][level_key]
    existing_count = len(existing_list)

    # Target 10 questions per role/level, adding up to 7 at a time.
    missing = max(0, 10 - existing_count)
    if missing <= 0:
        print(f"Role='{role_key}', level='{level_key}' already has {existing_count} questions (>=10). Nothing to add.")
        return

    to_generate = min(7, missing)

    load_dotenv(dotenv_path=os.path.join(SCRIPT_DIR, "..", "..", ".env"))

    client = OpenAIClient(api_key=os.getenv("OPENAI_API_KEY"))

    system = render_prompt("role/technical_theory/system_prompt.jinja")
    prompt = render_prompt(
        "role/technical_theory/user_prompt.jinja",
        role=role,
        max_questions=to_generate,
    )

    resp = await client.generate_text(
        LLMTextRequest(
            prompt=prompt,
            system=system,
            temperature=0.7,
            max_tokens=1200,
        )
    )

    questions = _parse_technical_theory_questions(resp.text or "", to_generate)

    # Append new questions, avoiding duplicates by question text.
    existing_questions = {
        q.get("question", q) if isinstance(q, dict) else q for q in existing_list
    }

    added = 0
    for q in questions:
        q_text = q.get("question", q) if isinstance(q, dict) else q
        if q_text and q_text not in existing_questions:
            existing_list.append(q)
            existing_questions.add(q_text)
            added += 1

    data[role_key][level_key] = existing_list

    with open(TECH_THEORY_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(
        f"Generated and saved {added} technical theory questions with difficulty "
        f"for role='{role_key}', level='{level_key}'. "
        f"Total now: {len(existing_list)} (target 10)."
    )


async def run_all_existing() -> None:
    """
    Iterate over all existing role/level combinations in technical_theory.json
    and top each up to 10 questions (adding up to 7 at a time).
    """
    if not os.path.exists(TECH_THEORY_PATH):
        print(f"No existing file at {TECH_THEORY_PATH}; nothing to do.")
        return

    try:
        with open(TECH_THEORY_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        print(f"Could not read/parse {TECH_THEORY_PATH}; nothing to do.")
        return

    if not isinstance(data, dict):
        print(f"Unexpected structure in {TECH_THEORY_PATH}; expected top-level dict.")
        return

    for role_key, level_dict in data.items():
        if not isinstance(level_dict, dict):
            continue
        for level_key in level_dict.keys():
            print(f"\n[RUN] Filling role='{role_key}', level='{level_key}'...")
            await run_single_theory_generation(role=role_key, level=level_key)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Temporary runner for technical_theory LLM pipeline (DRY RUN)."
    )
    parser.add_argument(
        "--role",
        type=str,
        default="software engineering",
        help="Role name to generate questions for (default: 'software engineering').",
    )
    parser.add_argument(
        "--level",
        type=str,
        default="intern",
        help="Level to generate questions for (default: 'intern').",
    )
    parser.add_argument(
        "--max-questions",  # kept for backward compatibility, but ignored
        type=int,
        default=1,
        help="(Ignored) Previously used to control question count; now the script auto-fills up to 10 per role/level.",
    )
    parser.add_argument(
        "--all-existing",
        action="store_true",
        help="If set, ignore role/level and fill all existing role/level combos to 10 questions.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    if args.all_existing:
        asyncio.run(run_all_existing())
    else:
        asyncio.run(
            run_single_theory_generation(
                role=args.role,
                level=args.level,
            )
        )


