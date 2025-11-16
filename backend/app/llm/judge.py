import json
from .schemas import BehaviouralJudgeResult, TheoreticalJudgeResult
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
            result_data = json.loads(llm_resp.text)
            return BehaviouralJudgeResult(**result_data)
        except Exception as e:
            raise ValueError(f"LLM did not produce valid JSON judge output: {llm_resp.text}")

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

