@echo off
setlocal
cd /d "%~dp0"
echo Building Oyama for Windows and Linux. This can take several minutes.
call pnpm package:all
set "BUILD_RESULT=%ERRORLEVEL%"
if not "%BUILD_RESULT%"=="0" echo Build failed. Review the errors above and platform logs in release.
if "%BUILD_RESULT%"=="0" echo Both packages are ready in the versioned release folder.
pause
exit /b %BUILD_RESULT%
