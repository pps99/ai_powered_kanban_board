@echo off
REM Stop Project Management MVP on Windows

echo Stopping Project Management MVP...

REM Stop and remove container
docker ps -a --format "{{.Names}}" | find "pm-mvp-container" >nul
if %errorlevel% equ 0 (
    docker stop pm-mvp-container >nul 2>&1
    docker rm pm-mvp-container >nul 2>&1
    echo Container stopped
) else (
    echo Container is not running
)

echo Done
