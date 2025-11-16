import json
import re
from .schemas import BehaviouralJudgeResult, TheoreticalJudgeResult
from .client import LLMTextRequest
from .prompts.renderer import render as render_prompt

class BehaviouralJudge:
    def __init__(self, openai_client):
        self.client = openai_client

    async def judge(self, question: str, answer: str) -> BehaviouralJudgeResult:
        system = render_prompt("role/behavioural/judge/system_prompt.jinja")
        prompt = render_prompt(
            "role/behavioural/judge/user_prompt.jinja", question=question, answer=answer
        )
        llm_resp = await self.client.generate_text(
            LLMTextRequest(
                prompt=prompt,
                system=system,
                temperature=0.0,
                max_tokens=700,
            )
        )
        try:
            raw_text = llm_resp.text or ""
            result_data = self._parse_llm_json(raw_text)
            return BehaviouralJudgeResult(**result_data)
        except Exception:
            # Truncate very long responses for readability
            snippet = (llm_resp.text[:500] + "...") if len(llm_resp.text) > 500 else llm_resp.text
            raise ValueError(f"LLM did not produce valid JSON judge output (sanitized attempt failed). Raw snippet: {snippet}")

    def _parse_llm_json(self, text: str) -> dict:
        """Attempt to extract a JSON object from an LLM response that may include
        markdown code fences, extra commentary, or multiple JSON blocks.

        Strategy:
        1. Strip leading/trailing whitespace
        2. Remove ```json / ``` fences if present
        3. Find the first balanced JSON object via regex
        4. Fallback to direct json.loads 
        5. Raise if all parsing attempts fail 
        """
        cleaned = text.strip()

        # Remove markdown fences if present
        if cleaned.startswith("```"):
            # Remove opening fence (``` or ```json)
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
            # Remove closing fence
            cleaned = re.sub(r"```$", "", cleaned.strip())

        # Quick attempt direct
        try:
            return json.loads(cleaned)
        except Exception:
            pass

        # Regex to capture first JSON object (handles nested braces crudely)
        match = re.search(r"{[\s\S]*}" , cleaned)
        if match:
            candidate = match.group(0)
            # Try progressively trimming trailing junk after last closing brace
            last_brace = candidate.rfind("}")
            candidate = candidate[: last_brace + 1]
            try:
                return json.loads(candidate)
            except Exception:
                pass

        # Attempt to extract fenced content line by line
        lines = [l for l in cleaned.splitlines() if l.strip()]
        json_lines = []
        in_obj = False
        brace_count = 0
        for line in lines:
            if not in_obj and "{" in line:
                in_obj = True
            if in_obj:
                json_lines.append(line)
                brace_count += line.count("{")
                brace_count -= line.count("}")
                if brace_count <= 0:
                    break
        if json_lines:
            candidate2 = "\n".join(json_lines).strip()
            try:
                return json.loads(candidate2)
            except Exception:
                pass

        raise ValueError("Failed to parse JSON from LLM response after multiple strategies")

class TheoreticalJudge:
    def judge(self, question_data: dict, user_answer: str) -> TheoreticalJudgeResult:
        correct_answer = question_data.get("correct", "").strip().lower()
        user_answer_clean = user_answer.strip().lower()
        is_correct = user_answer_clean == correct_answer
        score = 200 if is_correct else 0
        return TheoreticalJudgeResult(
            score=score,
            is_correct=is_correct,
            correct_answer=correct_answer
        )

