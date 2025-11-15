import requests

API_URL = "http://localhost:8000/api/llm/questions"

def main():
    role = input("Enter the role: ").strip()
    num = input("How many questions? (Default 5): ").strip()
    try:
        max_questions = int(num)
    except Exception:
        max_questions = 5
    data = {"role": role, "max_questions": max_questions}
    response = requests.post(API_URL, json=data)
    print("\n--- LLM Response JSON ---")
    try:
        import json
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    except Exception:
        print(response.text)

if __name__ == "__main__":
    main()
