"""
LLM-based follow-up question generator for behavioural interviews
"""
import os
from .client import LLMTextRequest
from .openai import OpenAIClient
from .prompts.renderer import render as render_prompt


class FollowUpQuestionGenerator:
    """Generates follow-up questions based on candidate answers"""
    
    def __init__(self, openai_client: OpenAIClient):
        self.client = openai_client
    
    async def generate_followup(
        self,
        original_question: str,
        candidate_answer: str,
        role: str = None,
        level: str = None
    ) -> str:
        """
        Generate a follow-up question based on the candidate's answer
        
        Args:
            original_question: The original behavioural question (Q0) - used for context only
            candidate_answer: The candidate's answer to Q0 - this is the primary input
            role: Optional role context (e.g., "software engineering")
            level: Optional level context (e.g., "midlevel")
        
        Returns:
            Generated follow-up question string
        """
        system_prompt = render_prompt("role/behavioural/followup/system_prompt.jinja")
        # Focus on the candidate's answer - original question is just for context if needed
        user_prompt = render_prompt(
            "role/behavioural/followup/user_prompt.jinja",
            candidate_answer=candidate_answer
        )
        
        llm_resp = await self.client.generate_text(
            LLMTextRequest(
                prompt=user_prompt,
                system=system_prompt,
                temperature=0.7,  # Some creativity for natural follow-ups
                max_tokens=150,  # Follow-up questions should be concise
            )
        )
        
        # Clean up the response - remove any extra formatting
        followup_question = llm_resp.text.strip()
        # Remove quotes if the LLM wrapped it
        if followup_question.startswith('"') and followup_question.endswith('"'):
            followup_question = followup_question[1:-1]
        if followup_question.startswith("'") and followup_question.endswith("'"):
            followup_question = followup_question[1:-1]
        
        return followup_question.strip()
