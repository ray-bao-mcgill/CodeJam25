#!/bin/bash

# Start backend in background
cd /app/backend
python main.py &
BACKEND_PID=$!

# Start frontend in background
cd /app/frontend
npm run start &
FRONTEND_PID=$!

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID

