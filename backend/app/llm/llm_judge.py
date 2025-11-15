"""
llm_judge.py -- For LLM-based answer judging/scoring of user responses.
Sections: behavioral, (future: technical_theory, technical_practical, ...)
"""

# Example: Behavioral answer judge
class BehaviouralJudge:
    """
    Judge or score a behavioral question answer from a user using LLM logic.
    """
    def __init__(self, openai_client):
        self.client = openai_client

    def judge(self, question: str, answer: str) -> dict:
        """
        Parameters:
            question (str): The behavioral interview question.
            answer (str): The user's submitted answer.
        Returns:
            dict: Structured judgment result (TBD: e.g., {"score": 8, "explanation": "..."})
        """
        # TODO: Compose prompt and call LLM to get score/judgment
        pass

# Future: TechnicalTheoryJudge, TechnicalPracticalJudge, etc.
