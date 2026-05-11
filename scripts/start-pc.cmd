@echo off
setlocal enabledelayedexpansion

for %%I in ("%~dp0..") do set "PROJECT_ROOT=%%~fI"
cd /d "%PROJECT_ROOT%"

echo Starting Project Management MVP...
echo.

docker info >nul 2>&1
if errorlevel 1 (
    echo Error: Docker is not running. Please start Docker and try again.
    exit /b 1
)

docker rm -f pm-mvp-container >nul 2>&1

echo Building Docker image...
docker build -t pm-mvp:latest .
if errorlevel 1 (
    echo Error building Docker image
    exit /b 1
)

echo Starting container...
docker run -d ^
    --name pm-mvp-container ^
    -p 8000:8000 ^
    --env-file .env ^
    -v "%PROJECT_ROOT%\data":/app/data ^
    pm-mvp:latest
if errorlevel 1 (
    echo Error starting container
    exit /b 1
)

echo.
echo Application started at http://localhost:8000
echo To stop: scripts\stop-pc.cmd
