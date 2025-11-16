import json
import re
import sys
from .schemas import BehaviouralJudgeResult, TheoreticalJudgeResult, IDEJudgeResult, TextJudgeResult
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
        """Attempt to extract a JSON object from an LLM response with aggressive clean-up"""
        cleaned = text.strip()
        # Remove markdown code fences if present
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\\s*", "", cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r"```$", "", cleaned.strip())
        # Debug: always print the raw cleaned LLM output in full
        print("[DEBUG] Raw LLM output:")
        print(cleaned)
        sys.stdout.flush()
        with open("llm_judge_debug.log", "a", encoding="utf-8") as debug_log:
            debug_log.write("\n--- LLM Output ---\n" + cleaned + "\n")
        # Quick json.loads attempt
        try:
            result = json.loads(cleaned)
            if isinstance(result, dict):
                return result
            if isinstance(result, list) and result and isinstance(result[0], dict):
                return result[0]
        except Exception:
            pass
        # Regex: find first JSON object
        match = re.search(r"{[\s\S]*}", cleaned)
        if match:
            candidate = match.group(0)
            last_brace = candidate.rfind("}")
            candidate = candidate[: last_brace + 1]
            try:
                result2 = json.loads(candidate)
                if isinstance(result2, dict):
                    return result2
                if isinstance(result2, list) and result2 and isinstance(result2[0], dict):
                    return result2[0]
            except Exception:
                pass
        # Line by line brace-block fallback as before
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
                result3 = json.loads(candidate2)
                if isinstance(result3, dict):
                    return result3
                if isinstance(result3, list) and result3 and isinstance(result3[0], dict):
                    return result3[0]
            except Exception:
                pass
        # On failure, print raw for debug
        print("[DEBUG] Could not parse LLM output with any strategy! - See llm_judge_debug.log for the full text.")
        raise ValueError(f"Failed to parse JSON from LLM response after multiple strategies.\nRaw output was:\n{text}")

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

class PracticalJudge:
    def __init__(self, openai_client):
        self.client = openai_client

    async def judge_submission(self, question: dict, submission: dict) -> dict:
        results = {}
        ide_code = submission.get("ide_file", "")
        text_ans = submission.get("text_answer", "")
        both = bool(ide_code) and bool(text_ans)
        score_max = 500 if both else 1000
        if ide_code:
            results["ide"] = await self.judge_ide(question, ide_code, score_max)
        if text_ans:
            results["text"] = await self.judge_text(question, text_ans, score_max)
        results["total_score"] = self._calculate_total_score(results)
        return results

    async def judge_ide(self, question: dict, ide_code: str, score_max: int) -> IDEJudgeResult:
        # Use the dedicated technical_practical judge prompts
        system = render_prompt("role/technical_practical/judge/system_prompt.jinja")
        prompt = render_prompt(
            "role/technical_practical/judge/user_prompt.jinja",
            question=question,
            user_code=ide_code,
            evaluation_type="ide",
            score_max=score_max,
        )
        llm_resp = await self.client.generate_text(
            LLMTextRequest(
                prompt=prompt,
                system=system,
                temperature=0.0,
                max_tokens=700,
            )
        )
        raw_text = llm_resp.text or ""
        data = self._parse_llm_json(raw_text)
        return IDEJudgeResult(**data)

    async def judge_text(self, question: dict, text_answer: str, score_max: int) -> TextJudgeResult:
        # Use the dedicated technical_practical judge prompts
        system = render_prompt("role/technical_practical/judge/system_prompt.jinja")
        prompt = render_prompt(
            "role/technical_practical/judge/user_prompt.jinja",
            question=question,
            text_answer=text_answer,
            evaluation_type="text",
            score_max=score_max,
        )
        llm_resp = await self.client.generate_text(
            LLMTextRequest(
                prompt=prompt,
                system=system,
                temperature=0.0,
                max_tokens=700,
            )
        )
        raw_text = llm_resp.text or ""
        data = self._parse_llm_json(raw_text)
        return TextJudgeResult(**data)

    def _parse_llm_json(self, text: str) -> dict:
        """Attempt to extract a JSON object from an LLM response with aggressive clean-up.

        This mirrors the BehaviouralJudge parser so both judges behave consistently.
        """
        cleaned = text.strip()
        # Remove markdown code fences if present
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\\s*", "", cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r"```$", "", cleaned.strip())
        # Debug: always print the raw cleaned LLM output in full
        print("[DEBUG] PracticalJudge raw LLM output:")
        print(cleaned)
        sys.stdout.flush()
        # Quick json.loads attempt
        try:
            result = json.loads(cleaned)
            if isinstance(result, dict):
                return result
            if isinstance(result, list) and result and isinstance(result[0], dict):
                return result[0]
        except Exception:
            pass
        # Regex: find first JSON object
        match = re.search(r"{[\s\S]*}", cleaned)
        if match:
            candidate = match.group(0)
            last_brace = candidate.rfind("}")
            candidate = candidate[: last_brace + 1]
            try:
                result2 = json.loads(candidate)
                if isinstance(result2, dict):
                    return result2
                if isinstance(result2, list) and result2 and isinstance(result2[0], dict):
                    return result2[0]
            except Exception:
                pass
        # Line by line brace-block fallback
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
                result3 = json.loads(candidate2)
                if isinstance(result3, dict):
                    return result3
                if isinstance(result3, list) and result3 and isinstance(result3[0], dict):
                    return result3[0]
            except Exception:
                pass
        print("[DEBUG] PracticalJudge could not parse LLM output with any strategy!")
        raise ValueError("Failed to parse JSON from LLM response after multiple strategies")

    def _calculate_total_score(self, results: dict) -> int:
        ide = results.get("ide")
        text = results.get("text")
        total = 0
        if isinstance(ide, IDEJudgeResult):
            total += ide.completeness + ide.correctness + ide.efficiency
        if isinstance(text, TextJudgeResult):
            total += text.completeness + text.clarity + text.correctness
        return total