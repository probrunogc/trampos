@echo off
title Emporio das Bebidas - Instalador do Quiosque
REM ============================================================
REM  Instala o sistema como QUIOSQUE neste computador:
REM   - Cria atalho na Area de Trabalho
REM   - Faz abrir junto com o Windows (inicializacao)
REM  Rode este arquivo UMA vez. Mantenha o Emporio-Quiosque.bat
REM  na mesma pasta ao executar.
REM ============================================================

echo.
echo  Instalando o Quiosque do Emporio das Bebidas...
echo.

set "DEST=%LOCALAPPDATA%\EmporioQuiosque"
if not exist "%DEST%" mkdir "%DEST%"

REM ---- Copia o lancador para um local fixo ----
copy /Y "%~dp0Emporio-Quiosque.bat" "%DEST%\Emporio-Quiosque.bat" >nul
if errorlevel 1 (
  echo [ERRO] Coloque o arquivo Emporio-Quiosque.bat na mesma pasta deste instalador.
  pause
  exit /b 1
)

set "LAUNCHER=%DEST%\Emporio-Quiosque.bat"
set "DESKTOP=%USERPROFILE%\Desktop"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"

REM ---- Atalho na Area de Trabalho ----
powershell -NoProfile -Command "$w=New-Object -ComObject WScript.Shell;$s=$w.CreateShortcut('%DESKTOP%\Emporio das Bebidas.lnk');$s.TargetPath='%LAUNCHER%';$s.WorkingDirectory='%DEST%';$s.WindowStyle=7;$s.Description='Emporio das Bebidas - Caixa';$s.Save()"

REM ---- Atalho na Inicializacao do Windows ----
powershell -NoProfile -Command "$w=New-Object -ComObject WScript.Shell;$s=$w.CreateShortcut('%STARTUP%\Emporio das Bebidas.lnk');$s.TargetPath='%LAUNCHER%';$s.WorkingDirectory='%DEST%';$s.WindowStyle=7;$s.Description='Emporio das Bebidas - Caixa';$s.Save()"

echo.
echo  ====================================================
echo    QUIOSQUE INSTALADO COM SUCESSO
echo.
echo    - Atalho criado na Area de Trabalho
echo    - O sistema abre sozinho quando o Windows ligar
echo.
echo    Para sair do modo quiosque: Alt + F4
echo  ====================================================
echo.
echo  Pressione uma tecla para abrir o sistema agora...
pause >nul
start "" "%LAUNCHER%"
exit /b 0
