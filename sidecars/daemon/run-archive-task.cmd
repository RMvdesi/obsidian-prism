@echo off
title Obsidian Prism - Archiving Conversations
set "WORKER=%~dp0conversation-archive.mjs"
set "TASK=%USERPROFILE%\.gemini\antigravity\conversations_archive\.archive-task-explorer.json"
if not exist "%TASK%" exit /b 0
where node.exe >nul 2>&1
if not errorlevel 1 goto :run_node
if exist "%APPDATA%\Antigravity\bin\agy-node.exe" goto :run_agynode_exe
if exist "%LOCALAPPDATA%\Programs\Antigravity\Antigravity.exe" goto :run_local_agy
if exist "%ProgramFiles%\Antigravity\Antigravity.exe" goto :run_prog_agy
exit /b 1

:run_node
node.exe "%WORKER%" "--run-task=%TASK%"
exit /b %ERRORLEVEL%

:run_agynode_exe
"%APPDATA%\Antigravity\bin\agy-node.exe" "%WORKER%" "--run-task=%TASK%"
exit /b %ERRORLEVEL%

:run_local_agy
set "ELECTRON_RUN_AS_NODE=1"
"%LOCALAPPDATA%\Programs\Antigravity\Antigravity.exe" "%WORKER%" "--run-task=%TASK%"
exit /b %ERRORLEVEL%

:run_prog_agy
set "ELECTRON_RUN_AS_NODE=1"
"%ProgramFiles%\Antigravity\Antigravity.exe" "%WORKER%" "--run-task=%TASK%"
exit /b %ERRORLEVEL%
