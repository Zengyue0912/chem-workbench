@echo off
setlocal
cd /d "%~dp0"
set "CHEM_NODE="
if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "CHEM_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if defined CHEM_NODE goto node_found
for /f "delims=" %%N in ('where node.exe 2^>nul') do if not defined CHEM_NODE set "CHEM_NODE=%%N"
if defined CHEM_NODE goto node_found
echo Node.js 22.16 or newer is required.
echo See the README in this folder, then try again.
pause
exit /b 1
:node_found
if "%~1"=="--check" goto check_only
"%CHEM_NODE%" --no-warnings "%~dp0server\setup.mjs"
if errorlevel 1 goto start_failed
exit /b 0
:check_only
"%CHEM_NODE%" -e "const p=process.versions.node.split('.').map(Number);if(p[0]>22 || (p[0]===22 && p[1]>=16)){console.log('LAUNCHER_OK '+process.version)}else{console.error('Node.js version is too old');process.exit(1)}"
exit /b %errorlevel%
:start_failed
echo Startup failed. Please read the message above.
pause
exit /b 1
