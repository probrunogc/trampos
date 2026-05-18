@echo off
REM ============================================================
REM  EMPORIO DAS BEBIDAS - Modo Quiosque
REM  Abre o sistema em tela cheia, sem barra de navegador.
REM  Para sair do modo quiosque: Alt + F4
REM ============================================================

set URL=https://adegas-pf.web.app

REM Tenta os caminhos mais comuns do Chrome no Windows
set CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist %CHROME% set CHROME="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if not exist %CHROME% set CHROME="%LocalAppData%\Google\Chrome\Application\chrome.exe"

start "" %CHROME% --kiosk --no-first-run --disable-pinch --overscroll-history-navigation=0 %URL%
