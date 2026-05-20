@echo off
setlocal
title Emporio GO  -  Reinstalar

color 0C
cls
echo.
echo  +============================================================+
echo  ^|         EMPORIO GO  --  Reinstalador                      ^|
echo  +============================================================+
echo.
echo   Isso vai apagar o perfil do Chrome e todas as
echo   configuracoes locais do quiosque.
echo.
echo   O sistema sera reinstalado automaticamente em seguida.
echo.
set /p "OK=  Confirma? (S = sim / qualquer tecla = cancelar): "
if /i not "%OK%"=="S" (
  echo.
  echo   Cancelado.
  timeout /t 2 /nobreak >nul
  exit /b 0
)

echo.
echo   Encerrando Chrome...
taskkill /F /IM chrome.exe >nul 2>&1
timeout /t 1 /nobreak >nul

echo   Removendo instalacao anterior...
set "DEST=%LOCALAPPDATA%\EmporioGO"
if exist "%DEST%" rd /s /q "%DEST%" >nul 2>&1

echo   Removendo atalhos...
for %%F in ("Emporio das Bebidas" "Emporio GO") do (
  if exist "%USERPROFILE%\Desktop\%%~F.lnk"                                del /Q "%USERPROFILE%\Desktop\%%~F.lnk" 2>nul
  if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\%%~F.lnk" del /Q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\%%~F.lnk" 2>nul
)

echo.
echo   Reinstalando...
echo.
timeout /t 1 /nobreak >nul

REM Roda o instalador principal (mesmo diretorio deste arquivo)
if exist "%~dp0Emporio-GO.bat" (
  start "" cmd /c "%~dp0Emporio-GO.bat"
) else (
  color 0E
  echo  [AVISO] Emporio-GO.bat nao encontrado na mesma pasta.
  echo  Copie os dois arquivos juntos e tente novamente.
  echo.
  pause
)

exit /b 0
