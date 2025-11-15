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

# Install Node.js for serving frontend
RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*

# Copy and install backend dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
COPY frontend/package.json ./frontend/
COPY frontend/vite.config.js ./frontend/

# Install serve dependencies for frontend
WORKDIR /app/frontend
RUN npm install --only=production

# Expose ports
EXPOSE 8000 3000

# Start script that runs both services
WORKDIR /app
COPY start.sh ./
RUN chmod +x start.sh

CMD ["./start.sh"]

