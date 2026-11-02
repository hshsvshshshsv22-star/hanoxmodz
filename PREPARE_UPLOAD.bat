@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === CHUAN BI FILE ANH CHO GITHUB PAGES ===
py -3 prepare_upload.py
if errorlevel 1 (echo. & echo Chuan bi chua hoan tat. Xem UPLOAD_ASSETS_REPORT.txt neu co. & pause & exit /b 1)
echo.
echo Da chuan bi xong. Hay upload TOAN BO noi dung thu muc nay len repository GitHub.
pause
