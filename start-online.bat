@echo off
title CoinRush Launcher
echo ========================================================
echo   Starting CoinRush Server and Public Tunnel...
echo ========================================================
echo.

:: Launch the Node.js backend server in a dedicated window
start "CoinRush - Backend Server Logs" cmd /k "npm start"

:: Wait 3 seconds for server to connect to MongoDB and start listening
timeout /t 3 /nobreak >nul

:: Launch the public tunnel in a dedicated window
start "CoinRush - Public Tunnel" cmd /k "npm run tunnel"

echo Done! Both the server and public tunnel are running in separate windows.
echo Keep those windows open while you want your site accessible online.
echo.
pause
