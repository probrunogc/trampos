@echo off
setlocal

set "PROFILE=%LOCALAPPDATA%\EmporioGO\ChromeProfile"
set "BAT=%LOCALAPPDATA%\EmporioGO\Emporio-GO.bat"

REM Fecha o Chrome se estiver aberto
taskkill /F /IM chrome.exe >nul 2>&1
timeout /t 2 /nobreak >nul

REM Apaga só o perfil do Chrome (limpa sessão, localStorage, cookies)
if exist "%PROFILE%" (
  rd /s /q "%PROFILE%"
)

REM Relança o quiosque direto (sem animação de instalação)
if exist "%BAT%" (
  start "" "%BAT%"
) else (
  start "" "%~dp0Emporio-GO.bat"
)

exit /b 0
