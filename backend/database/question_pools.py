"""
Predefined question pools loaded from JSON files
"""
import json
import os
from typing import Dict, List, Any

# Get the directory where this file is located
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_DIR = os.path.join(BASE_DIR, "..", "app", "llm", "output")


def load_behavioural_questions() -> Dict[str, Dict[str, List[str]]]:
    """Load behavioural questions from JSON file"""
    json_path = os.path.join(JSON_DIR, "behavioural.json")
    if not os.path.exists(json_path):
        raise FileNotFoundError(f"Behavioural questions JSON not found at {json_path}")
    with open(json_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def load_technical_theory_questions() -> Dict[str, Dict[str, List[Dict[str, Any]]]]:
    """Load technical theory questions from JSON file"""
    json_path = os.path.join(JSON_DIR, "technical_theory.json")
    if not os.path.exists(json_path):
        raise FileNotFoundError(f"Technical theory questions JSON not found at {json_path}")
    with open(json_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def load_technical_practical_questions() -> Dict[str, Dict[str, List[str]]]:
    """Load technical practical questions from JSON file"""
    json_path = os.path.join(JSON_DIR, "technical_practical.json")
    if not os.path.exists(json_path):
        raise FileNotFoundError(f"Technical practical questions JSON not found at {json_path}")
    with open(json_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def get_all_behavioural_questions() -> List[Dict[str, Any]]:
    """Flatten behavioural questions into list of dicts for database insertion"""
    questions = []
    data = load_behavioural_questions()
    for role, levels in data.items():
        for level, question_list in levels.items():
            for question_text in question_list:
                questions.append({
                    "role": role,
                    "level": level,
                    "question": question_text
                })
    return questions


def get_all_technical_theory_questions() -> List[Dict[str, Any]]:
    """Flatten technical theory questions into list of dicts for database insertion"""
    questions = []
    data = load_technical_theory_questions()
    for role, levels in data.items():
        for level, question_list in levels.items():
            for q_data in question_list:
                questions.append({
                    "role": role,
                    "level": level,
                    "question": q_data["question"],
                    "correct_answer": q_data["correct"],
                    "incorrect_answers": q_data["incorrect"],
                    "difficulty": q_data.get("difficulty")  # Extract difficulty from JSON
                })
    return questions


def get_all_technical_practical_questions() -> List[Dict[str, Any]]:
    """Flatten technical practical questions into list of dicts for database insertion"""
    questions = []
    data = load_technical_practical_questions()
    for role, levels in data.items():
        for level, question_list in levels.items():
            for question_text in question_list:
                questions.append({
                    "role": role,
                    "level": level,
                    "question": question_text
                })
    return questions

