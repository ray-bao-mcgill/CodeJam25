import json
import re
import sys
from .schemas import BehaviouralJudgeResult, TheoreticalJudgeResult, IDEJudgeResult, TextJudgeResult
from .client import LLMTextRequest
from .prompts.renderer import render as render_prompt
from .video_processor import VideoProcessor

class BehaviouralJudge:
    def __init__(self, openai_client):
        self.client = openai_client
        self.video_processor = VideoProcessor(openai_client)

    async def judge(self, question: str, answer: str) -> BehaviouralJudgeResult:
        # Check if answer is video data and transcribe if needed
        if self.video_processor.is_video_data(answer):
            answer = await self.video_processor.transcribe_video(answer)
        
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
        total_score = self._calculate_total_score(results)
        results["total_score"] = total_score
        # Build one overall reasoning string for the whole practical round (0-3000 scale)
        if results.get("ide") or results.get("text"):
            results["reasoning"] = self._build_overall_reasoning(results, total_score)
        return results

    def _format_code_for_llm(self, code: str) -> str:
        """
        Format code submission for LLM evaluation.
        Structures code clearly for ChatGPT to evaluate - wraps in markdown code blocks
        and formats multi-file submissions with clear separators.
        """
        if not code:
            return ""
        
        # Remove leading/trailing whitespace
        code = code.strip()
        
        lines = code.split('\n')
        
        # Detect language from file markers or code patterns
        language = None
        if '//' in code and ('function' in code or 'const' in code or 'let' in code):
            language = 'javascript'
        elif 'def ' in code or 'import ' in code or 'print(' in code:
            language = 'python'
        elif 'function' in code and '{' in code and '=>' in code:
            language = 'typescript'
        
        # Check if it's multi-file (has // filename markers)
        has_file_markers = any(
            line.strip().startswith('//') and 
            ('file' in line.lower() or any(ext in line.lower() for ext in ['.js', '.py', '.ts', '.java', '.cpp', '.c', '.go', '.rs', '.html', '.css']))
            for line in lines[:10]
        )
        
        if has_file_markers:
            # Multi-file submission - format each file clearly with separators
            formatted_parts = []
            current_file = []
            current_filename = None
            
            for line in lines:
                stripped = line.strip()
                # Check if this is a file marker (// filename or // File: filename)
                if stripped.startswith('//') and ('file' in stripped.lower() or any(ext in stripped.lower() for ext in ['.js', '.py', '.ts', '.java', '.cpp', '.c', '.go', '.rs', '.html', '.css'])):
                    # Save previous file if exists
                    if current_filename and current_file:
                        file_code = '\n'.join(current_file).strip()
                        formatted_parts.append(f"File: {current_filename}\n```{language or ''}\n{file_code}\n```")
                    # Extract filename from marker
                    filename = stripped.replace('//', '').replace('File:', '').replace('file:', '').strip()
                    current_filename = filename
                    current_file = []
                else:
                    current_file.append(line)
            
            # Add last file
            if current_filename and current_file:
                file_code = '\n'.join(current_file).strip()
                formatted_parts.append(f"File: {current_filename}\n```{language or ''}\n{file_code}\n```")
            elif not current_filename and current_file:
                # No file markers but we have code - treat as single file
                file_code = '\n'.join(current_file).strip()
                return f"```{language or ''}\n{file_code}\n```"
            
            return "\n\n".join(formatted_parts)
        else:
            # Single file - wrap in markdown code block for ChatGPT
            return f"```{language or ''}\n{code}\n```"

    async def judge_ide(self, question: dict, ide_code: str, score_max: int) -> IDEJudgeResult:
        # Use the dedicated technical_practical judge prompts
        try:
            system = render_prompt("role/technical_practical/judge/system_prompt.jinja")
            # Extract question text - handle both {"question": "..."} and just string
            question_text = question.get("question", "") if isinstance(question, dict) else str(question)
            
            # Format code nicely for ChatGPT evaluation
            formatted_code = self._format_code_for_llm(ide_code)
            
            # Log what we're sending to ChatGPT
            print(f"[PRACTICAL_JUDGE] Sending to ChatGPT:")
            print(f"  Question: {question_text[:200]}...")
            print(f"  Code length: {len(formatted_code)} chars (original: {len(ide_code)} chars)")
            print(f"  Code preview: {formatted_code[:300]}...")
            
            prompt = render_prompt(
                "role/technical_practical/judge/user_prompt.jinja",
                question=question_text,
                user_code=formatted_code,  # Pass formatted code to ChatGPT
                evaluation_type="ide",
                score_max=score_max,
            )
            
            print(f"[PRACTICAL_JUDGE] Calling OpenAI API...")
            llm_resp = await self.client.generate_text(
                LLMTextRequest(
                    prompt=prompt,
                    system=system,
                    temperature=0.0,
                    max_tokens=700,
                )
            )
            raw_text = llm_resp.text or ""
            print(f"[PRACTICAL_JUDGE] ChatGPT response length: {len(raw_text)} chars")
            print(f"[PRACTICAL_JUDGE] ChatGPT response preview: {raw_text[:300]}...")
            
            if not raw_text:
                print("[PRACTICAL_JUDGE] ERROR: LLM returned empty response for IDE judging")
                raise ValueError("Empty LLM response")
            data = self._parse_llm_json(raw_text)
            print(f"[PRACTICAL_JUDGE] Parsed JSON successfully: {data}")
            return IDEJudgeResult(**data)
        except Exception as e:
            print(f"[PRACTICAL_JUDGE] ERROR in judge_ide: {e}")
            import traceback
            traceback.print_exc()
            # Return a default result instead of failing completely
            return IDEJudgeResult(
                completeness=0,
                correctness=0,
                efficiency=0,
                reasoning=f"Error judging code: {str(e)}"
            )

    async def judge_text(self, question: dict, text_answer: str, score_max: int) -> TextJudgeResult:
        # Use the dedicated technical_practical judge prompts
        try:
            system = render_prompt("role/technical_practical/judge/system_prompt.jinja")
            # Extract question text - handle both {"question": "..."} and just string
            question_text = question.get("question", "") if isinstance(question, dict) else str(question)
            
            print(f"[PRACTICAL_JUDGE] Sending text answer to ChatGPT:")
            print(f"  Question: {question_text[:200]}...")
            print(f"  Text answer length: {len(text_answer)} chars")
            print(f"  Text answer preview: {text_answer[:300]}...")
            
            prompt = render_prompt(
                "role/technical_practical/judge/user_prompt.jinja",
                question=question_text,
                text_answer=text_answer,  # Pass text directly to ChatGPT
                evaluation_type="text",
                score_max=score_max,
            )
            
            print(f"[PRACTICAL_JUDGE] Calling OpenAI API for text...")
            llm_resp = await self.client.generate_text(
                LLMTextRequest(
                    prompt=prompt,
                    system=system,
                    temperature=0.0,
                    max_tokens=700,
                )
            )
            raw_text = llm_resp.text or ""
            print(f"[PRACTICAL_JUDGE] ChatGPT text response length: {len(raw_text)} chars")
            print(f"[PRACTICAL_JUDGE] ChatGPT text response preview: {raw_text[:300]}...")
            
            if not raw_text:
                print("[PRACTICAL_JUDGE] ERROR: LLM returned empty response for text judging")
                raise ValueError("Empty LLM response")
            data = self._parse_llm_json(raw_text)
            print(f"[PRACTICAL_JUDGE] Parsed text JSON successfully: {data}")
            return TextJudgeResult(**data)
        except Exception as e:
            print(f"[PRACTICAL_JUDGE] ERROR in judge_text: {e}")
            import traceback
            traceback.print_exc()
            # Return a default result instead of failing completely
            return TextJudgeResult(
                completeness=0,
                clarity=0,
                correctness=0,
                reasoning=f"Error judging text: {str(e)}"
            )

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

    def _build_overall_reasoning(self, results: dict, total_score: int) -> str:
        """Compose a single game-style reasoning string from per-tab reasonings and total score.

        Tone bands (0-3000):
        - 2001–3000: very positive / \"instant hire\"
        - 1001–2000: neutral / balanced
        -    0–1000: roasting / \"do not deploy\"
        """
        ide = results.get("ide")
        text = results.get("text")

        # Start with a tone prefix based on total_score
        if total_score >= 2001:
            prefix = "You absolutely crushed this practical round. "
        elif total_score >= 1001:
            prefix = "You did okay overall in this practical round. "
        else:
            prefix = "This practical round was rough for you. "

        parts = []
        if isinstance(ide, IDEJudgeResult) and ide.reasoning:
            parts.append(f"For your code: {ide.reasoning}")
        if isinstance(text, TextJudgeResult) and text.reasoning:
            parts.append(f"For your written answer: {text.reasoning}")

        detail = " ".join(parts).strip()
        if detail:
            return prefix + detail
        return prefix.strip()