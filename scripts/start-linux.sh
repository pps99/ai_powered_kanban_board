#!/bin/bash

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "Starting Project Management MVP..."
echo ""

if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

docker rm -f pm-mvp-container 2>/dev/null || true

echo "Building Docker image..."
docker build -t pm-mvp:latest .

echo "Starting container..."
docker run -d \
    --name pm-mvp-container \
    -p 8000:8000 \
    --env-file .env \
    -v "$PROJECT_ROOT/data":/app/data \
    pm-mvp:latest

echo ""
echo "Application started at http://localhost:8000"
echo "To stop: ./scripts/stop-linux.sh"
