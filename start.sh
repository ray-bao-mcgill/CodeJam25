#!/bin/bash
set -e

# Backend serves both API and frontend static files
cd /app/backend
exec python main.py

