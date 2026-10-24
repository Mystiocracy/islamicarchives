@echo off
rem One-time setup for publishing from this PC. Run it once, from the islamicarchives folder.
cd /d "%~dp0"
echo.
echo === Step 1 of 3: FTP login (hPanel - Files - FTP Accounts) ===
set /p FTP_HOST=FTP host (e.g. ftp.islamicarchives.org): 
set /p FTP_USER=FTP username: 
set /p FTP_PASS=FTP password: 
(
echo FTP_HOST=%FTP_HOST%
echo FTP_USER=%FTP_USER%
echo FTP_PASS=%FTP_PASS%
echo FTP_DIR=.
echo FTP_SECURE=true
) > .deploy.env
echo.
echo === Step 2 of 3: installing the site's tools ===
call npm ci || goto :fail
echo.
echo === Step 3 of 3: building the hadith text from Sanadset ===
set CSV=%USERPROFILE%\Downloads\sanadset (1).csv
if not exist "%CSV%" set /p CSV=Where is the Sanadset csv file? Paste its full path: 
python scripts\sanadset\build.py "%CSV%" || goto :fail
echo.
echo Setup finished. From now on just double-click deploy.cmd
pause
exit /b 0
:fail
echo.
echo Something went wrong. Copy the message above and send it to Claude.
pause
exit /b 1
