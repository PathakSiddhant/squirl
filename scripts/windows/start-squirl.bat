@echo off
cd /d "%~dp0..\.."
if not exist "logs" mkdir "logs"
echo ---- %date% %time% ---- >> "logs\squirl.log"
call npm start >> "logs\squirl.log" 2>&1
