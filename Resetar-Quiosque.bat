@echo off
setlocal EnableDelayedExpansion

set "PROFILE=%LOCALAPPDATA%\EmporioGO\ChromeProfile"
set "URL=https://adegas-pf.web.app/kiosk.html"

REM Fecha o Chrome
taskkill /F /IM chrome.exe 2>nul
ping -n 3 127.0.0.1 >nul

REM Apaga o perfil do Chrome (limpa sessao e localStorage)
if exist "%PROFILE%" rd /s /q "%PROFILE%" 2>nul

REM Atualiza o bat instalado com esta versao atualizada
set "DEST=%LOCALAPPDATA%\EmporioGO"
if exist "%DEST%" copy /Y "%~f0" "%DEST%\Resetar-Quiosque.bat" >nul 2>&1

REM Localiza o Chrome
set "CHROME="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe"      set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe"      set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if not defined CHROME (
  echo Chrome nao encontrado. Instale em https://www.google.com/chrome
  pause
  exit /b 1
)

REM Abre direto no kiosk.html (sem depender do bat instalado)
start "" "%CHROME%" ^
 --kiosk ^
 --no-first-run ^
 --no-default-browser-check ^
 --disable-pinch ^
 --disable-translate ^
 --disable-infobars ^
 --disable-session-crashed-bubble ^
 --noerrdialogs ^
 --disable-features=TranslateUI ^
 --overscroll-history-navigation=0 ^
 --user-data-dir="%PROFILE%" ^
 "%URL%"

exit /b 0
