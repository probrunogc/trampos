@echo off
REM ============================================================
REM  EMPORIO GO - Lancador do Quiosque
REM  Abre o sistema em tela cheia (kiosk), instancia propria
REM  do Chrome, sem barras nem historico.
REM  Para sair do modo quiosque: Alt + F4
REM ============================================================

set "URL=https://adegas-pf.web.app"
set "PROFILE=%LOCALAPPDATA%\EmporioGO\ChromeProfile"

REM ---- Localiza o Google Chrome ----
set "CHROME="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe"      set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe"      set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if not defined CHROME (
  echo.
  echo  [ERRO] Google Chrome nao foi encontrado neste computador.
  echo  Instale o Chrome em https://www.google.com/chrome e tente novamente.
  echo.
  pause
  exit /b 1
)

REM ---- Abre o Emporio GO em modo quiosque (tela cheia, sem barras) ----
start "" "%CHROME%" ^
 --kiosk ^
 --new-window ^
 --no-first-run ^
 --no-default-browser-check ^
 --disable-pinch ^
 --disable-translate ^
 --disable-session-crashed-bubble ^
 --noerrdialogs ^
 --disable-features=TranslateUI ^
 --overscroll-history-navigation=0 ^
 --user-data-dir="%PROFILE%" ^
 "%URL%"

exit /b 0
