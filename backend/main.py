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
# Router includes: /, /api/*, /ws/*
app.include_router(router)

# Serve frontend static files
frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
frontend_dist = os.path.abspath(frontend_dist)  # Get absolute path

# Use print with flush=True to ensure logs appear immediately
import sys
print(f"[STARTUP] Checking for frontend dist at: {frontend_dist}", flush=True)
print(f"[STARTUP] Current working directory: {os.getcwd()}", flush=True)
print(f"[STARTUP] __file__ location: {__file__}", flush=True)
print(f"[STARTUP] Frontend dist exists: {os.path.exists(frontend_dist)}", flush=True)

if os.path.exists(frontend_dist):
    print(f"[STARTUP] Frontend dist found! Listing contents:", flush=True)
    try:
        contents = os.listdir(frontend_dist)
        print(f"[STARTUP] Contents: {contents}", flush=True)
    except Exception as e:
        print(f"[STARTUP] Error listing contents: {e}", flush=True)
    
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/static", StaticFiles(directory=assets_dir), name="static")
        print(f"[STARTUP] ✓ Mounted static files from: {assets_dir}", flush=True)
    else:
        print(f"[STARTUP] WARNING: Assets directory not found at: {assets_dir}", flush=True)
    
    # Serve index.html for all non-API routes (SPA routing)
    # FastAPI matches routes in order - more specific routes (from router) match first
    # This catch-all only matches if no other route matched
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # This should only be reached if no other route matched
        # FastAPI will have already tried /, /api/*, /ws/* from the router
        index_path = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        return {"error": "Frontend not found"}, 404
else:
    print(f"[STARTUP] ✗ ERROR: Frontend dist folder not found at {frontend_dist}", flush=True)
    print(f"[STARTUP] Attempting to list parent directory:", flush=True)
    parent_dir = os.path.dirname(frontend_dist)
    if os.path.exists(parent_dir):
        try:
            print(f"[STARTUP] Parent dir contents: {os.listdir(parent_dir)}", flush=True)
        except Exception as e:
            print(f"[STARTUP] Error: {e}", flush=True)


if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 8000))
    # Use 127.0.0.1 for localhost when PORT is default, 0.0.0.0 for Railway/production
    host = "127.0.0.1" if port == 8000 and "PORT" not in os.environ else "0.0.0.0"
    print(f"Starting FastAPI server on {host}:{port}")
    print("NOTE: Using reload=False to prevent losing in-memory lobbies")
    uvicorn.run("main:app", host=host, port=port, reload=False)
