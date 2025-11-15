# Multi-stage build for backend and frontend

# Stage 1: Build frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Python backend + serve frontend
FROM python:3.11-slim
WORKDIR /app

# No need for Node.js - backend serves static files directly

# Copy and install backend dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose port (Railway will set PORT env var)
EXPOSE 8000

# Start script that runs both services
WORKDIR /app
COPY start.sh ./
RUN chmod +x start.sh

CMD ["./start.sh"]

