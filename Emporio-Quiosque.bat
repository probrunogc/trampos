@echo off
REM ============================================================
REM  EMPORIO DAS BEBIDAS - Lancador do Quiosque
REM  Abre o sistema em tela cheia (kiosk), instancia propria
REM  do Chrome, sem barras. Sair do modo quiosque: Alt + F4
REM ============================================================

set "URL=https://adegas-pf.web.app"
set "PROFILE=%LOCALAPPDATA%\EmporioQuiosque\ChromeProfile"

REM ---- Localiza o Google Chrome ----
set "CHROME="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if not defined CHROME (
  echo Google Chrome nao foi encontrado neste computador.
  echo Instale o Chrome e tente novamente.
  pause
  exit /b 1
)

REM ---- Abre o sistema em modo quiosque numa instancia propria ----
start "" "%CHROME%" ^
 --kiosk ^
 --new-window ^
 --no-first-run ^
 --no-default-browser-check ^
 --disable-pinch ^
 --disable-translate ^
 --disable-session-crashed-bubble ^
 --noerrdialogs ^
 --user-data-dir="%PROFILE%" ^
 "%URL%"

exit /b 0
