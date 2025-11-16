import os
import json


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "output")
TECH_THEORY_PATH = os.path.join(OUTPUT_DIR, "technical_theory.json")


LEVEL_DEFAULT_DIFFICULTY = {
    "intern": 20,
    "junior": 40,
    "midlevel": 60,
    "senior": 80,
    "lead": 90,
}


def main() -> None:
    if not os.path.exists(TECH_THEORY_PATH):
        print(f"No technical_theory.json found at {TECH_THEORY_PATH}")
        return

    try:
        with open(TECH_THEORY_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"Failed to load technical_theory.json: {e}")
        return

    if not isinstance(data, dict):
        print("Unexpected JSON structure: expected top-level object (dict).")
        return

    updated = 0

    for role, level_dict in data.items():
        if not isinstance(level_dict, dict):
            continue
        for level, questions in level_dict.items():
            if not isinstance(questions, list):
                continue
            default_diff = LEVEL_DEFAULT_DIFFICULTY.get(level.lower(), 50)

            for idx, q in enumerate(questions):
                if not isinstance(q, dict):
                    continue
                if "question" not in q:
                    continue
                if "difficulty" in q:
                    continue

                # Backfill difficulty and normalize key order
                ordered_q = {
                    "question": q.get("question", ""),
                    "difficulty": default_diff,
                    "correct": q.get("correct", ""),
                    "incorrect": q.get("incorrect", []),
                }
                questions[idx] = ordered_q
                updated += 1

    if updated == 0:
        print("No questions were missing difficulty; nothing changed.")
        return

    with open(TECH_THEORY_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Backfilled difficulty for {updated} questions in technical_theory.json.")


if __name__ == "__main__":
    main()


