from fastapi import FastAPI

from .llm.routes import create_llm_router
from .llm.providers.openai import OpenAIClient


def create_app() -> FastAPI:
	app = FastAPI(title="LLM Backend (Python)")

	# Stub client; methods raise NotImplementedError until implemented
	client = OpenAIClient()
	app.include_router(create_llm_router(client), prefix="/api")

	return app


app = create_app()


