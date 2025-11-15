#!/bin/bash

# Start backend
cd backend
bash start.sh &
BACKEND_PID=$!

# Start frontend
cd ../frontend
bash start.sh &
FRONTEND_PID=$!

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID

