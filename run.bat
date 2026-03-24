@echo off
echo ==========================================
echo Starting Academy Management System
echo ==========================================

echo [1/2] Starting Backend Server...
start "Academy Backend" cmd /k "cd backend && uvicorn main:app --reload --host 0.0.0.0 --port 8001"

echo [2/2] Starting Frontend Server...
start "Academy Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Both backend and frontend are starting in separate windows.
echo You can close this window now.
pause
