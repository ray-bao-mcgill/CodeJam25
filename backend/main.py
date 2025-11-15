from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from router import router

app = FastAPI()

# CORS for React frontend
import os
cors_origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routes
app.include_router(router)


if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 8000))
    # Use 127.0.0.1 for localhost when PORT is default, 0.0.0.0 for Railway/production
    host = "127.0.0.1" if port == 8000 and "PORT" not in os.environ else "0.0.0.0"
    print(f"Starting FastAPI server on {host}:{port}")
    print("NOTE: Using reload=False to prevent losing in-memory lobbies")
    uvicorn.run("main:app", host=host, port=port, reload=False)
