#!/bin/bash

# Start backend
cd backend
if [ -f "requirements.txt" ]; then
    python3 main.py &
    BACKEND_PID=$!
else
    python main.py &
    BACKEND_PID=$!
fi

# Start frontend
cd ../frontend
if [ -f "package.json" ]; then
    npm run build
    npm run start &
    FRONTEND_PID=$!
fi

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID

