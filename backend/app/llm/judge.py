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
        print(f"\n{'='*80}")
        print(f"⚖️  [JUDGE] Behavioural judge called")
        print(f"{'='*80}")
        print(f"❓ Question: {question[:100]}{'...' if len(question) > 100 else ''}")
        print(f"💬 Answer type: {'VIDEO DATA' if self.video_processor.is_video_data(answer) else 'TEXT'}")
        print(f"📊 Answer length: {len(answer)} characters")
        print(f"📄 Answer preview: {answer[:200]}{'...' if len(answer) > 200 else ''}")
        print(f"{'='*80}\n")
        
        # Check if answer is video data and transcribe if needed
        if self.video_processor.is_video_data(answer):
            print(f"🎥 [JUDGE] Video answer detected, transcribing...")
            answer = await self.video_processor.transcribe_video(answer)
            print(f"✅ [JUDGE] Received transcribed text ({len(answer)} characters)")
            print(f"📄 [JUDGE] Preview: {answer[:200]}{'...' if len(answer) > 200 else ''}\n")
        else:
            print(f"✅ [JUDGE] Text answer received directly (no transcription needed)")
        
        print(f"🤖 [JUDGE] Sending to LLM for evaluation...")
        print(f"📝 [JUDGE] Final text being judged: {answer[:300]}{'...' if len(answer) > 300 else ''}\n")
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
        print(f"✅ [JUDGE] LLM evaluation complete\n")
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

