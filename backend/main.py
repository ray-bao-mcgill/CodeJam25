from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn
import os
from router import router

app = FastAPI()

# CORS for React frontend
cors_origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173,https://codejam25-production.up.railway.app").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes first (before static files)
app.include_router(router)

# Serve frontend static files
frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/static", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="static")
    
    # Serve index.html for all non-API routes (SPA routing)
    # This must be registered LAST so API routes take precedence
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Explicitly exclude API and WebSocket routes
        if full_path.startswith("api/") or full_path.startswith("ws/") or full_path == "health":
            return {"error": "Not found"}, 404
        index_path = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        return {"error": "Frontend not found"}, 404


if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 8000))
    # Use 127.0.0.1 for localhost when PORT is default, 0.0.0.0 for Railway/production
    host = "127.0.0.1" if port == 8000 and "PORT" not in os.environ else "0.0.0.0"
    print(f"Starting FastAPI server on {host}:{port}")
    print("NOTE: Using reload=False to prevent losing in-memory lobbies")
    uvicorn.run("main:app", host=host, port=port, reload=False)
