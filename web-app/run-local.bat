@echo off
chcp 65001 > nul
echo 🚀 Dang khoi dong CareBot System tren may Local (Windows)...

:: Di chuyển tới thư mục chứa file bat
cd /d "%~dp0"

echo 📦 Dang kiem tra thu vien...
call npm install

echo 🌐 Dang mo Local Server...
npm run dev

pause
