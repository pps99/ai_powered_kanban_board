#!/bin/bash

# Stop Project Management MVP on Linux

echo "Stopping Project Management MVP..."

# Stop and remove container
if docker ps -a --format '{{.Names}}' | grep -q '^pm-mvp-container$'; then
    docker stop pm-mvp-container 2>/dev/null || true
    docker rm pm-mvp-container 2>/dev/null || true
    echo "✓ Container stopped"
else
    echo "Container is not running"
fi

echo "Done"
