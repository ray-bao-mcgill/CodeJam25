"""
llm_judge.py -- For LLM-based answer judging/scoring of user responses.
Sections: behavioral, (future: technical_theory, technical_practical, ...)
"""

import os
import json
from .schemas import BehaviouralJudgeResult
from .prompts.renderer import render as render_prompt

class BehaviouralJudge:
    """
    Judge or score a behavioral question answer from a user using LLM logic.
    Uses system/user prompts from prompts/role/behavioural/judge/.
    """
    def __init__(self, openai_client):
        self.client = openai_client

    async def judge(self, question: str, answer: str) -> BehaviouralJudgeResult:
        system = render_prompt("role/behavioural/judge/system_prompt.jinja")
        prompt = render_prompt(
            "role/behavioural/judge/user_prompt.jinja", question=question, answer=answer
        )
        llm_resp = await self.client.generate_text(
            input=self.client.LLMTextRequest(
                prompt=prompt,
                system=system,
                temperature=0.0,
                max_tokens=700,
            )
        )
        try:
            result_data = json.loads(llm_resp.text)
            # Validate/parse with Pydantic
            return BehaviouralJudgeResult(**result_data)
        except Exception as e:
            raise ValueError(f"LLM did not produce valid JSON judge output: {llm_resp.text}")

# Future: TechnicalTheoryJudge, TechnicalPracticalJudge, etc.
