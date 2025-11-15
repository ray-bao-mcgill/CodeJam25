from fastapi import FastAPI
import os
from dotenv import load_dotenv

from .llm.routes import create_llm_router
from .llm.openai import OpenAIClient


def create_app() -> FastAPI:
	load_dotenv()  # load variables from a local .env if present
	app = FastAPI(title="LLM Backend (Python)")

	# Stub client; methods raise NotImplementedError until implemented
	client = OpenAIClient(
		api_key=os.environ.get("OPENAI_API_KEY"),
	)
	app.include_router(create_llm_router(client), prefix="/api")

	return app


app = create_app()


