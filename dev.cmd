@echo off
:: Bestowd dev server
:: Usage: dev
::   Starts the API on http://localhost:3000 (hot-reload via tsx watch)

if not exist "%~dp0apps\api\.env" (
    echo ERROR: Missing apps\api\.env - fill in your credentials first
    exit /b 1
)

:: Load .env file into environment
for /f "usebackq tokens=1,* delims==" %%A in (`findstr /v "^#" "%~dp0apps\api\.env"`) do (
    set "%%A=%%B"
)

set "PATH=C:\Program Files\nodejs;%APPDATA%\npm;%PATH%"

echo Starting Bestowd API...
echo   http://localhost:3000/health
echo.

pnpm.cmd --filter api dev
