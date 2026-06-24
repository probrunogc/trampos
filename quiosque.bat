@echo off
chcp 65001 >nul
title Emporio GO — Instalando Quiosque...

:: ============================================================
::  Empório GO — Quiosque
::  Baixe este arquivo e clique duas vezes para instalar.
::  Instala o ícone, cria atalho na área de trabalho,
::  coloca no Inicializar e abre o quiosque automaticamente.
:: ============================================================

set PS=%TEMP%\emporio-setup.ps1

(
echo Add-Type -AssemblyName System.Windows.Forms
echo Add-Type -AssemblyName System.Drawing
echo $ErrorActionPreference = 'Stop'
echo.
echo try {
echo.
echo $kioskUrl   = 'https://adegas-pf.web.app/kiosk.html'
echo $iconUrl    = 'https://adegas-pf.web.app/assets/logo-emporio.png'
echo $dataDir    = "$env:APPDATA\Emporio-GO"
echo $icoPath    = "$dataDir\emporio-go.ico"
echo $profileDir = "$env:LOCALAPPDATA\Emporio-GO-Quiosque"
echo.
echo # --- Encontrar Chrome ---
echo $chromePaths = @(
echo     "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
echo     "${env:ProgramFiles^(x86^)}\Google\Chrome\Application\chrome.exe",
echo     "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
echo ^)
echo $chrome = $chromePaths ^| Where-Object { Test-Path $_ } ^| Select-Object -First 1
echo if ^(-not $chrome^) {
echo     [System.Windows.Forms.MessageBox]::Show^('Google Chrome nao encontrado. Instale o Chrome e tente novamente.', 'Emporio GO', 'OK', 'Error'^) ^| Out-Null
echo     exit 1
echo }
echo.
echo # --- Criar pasta de dados ---
echo New-Item -ItemType Directory -Force -Path $dataDir ^| Out-Null
echo.
echo # --- Baixar e converter icone PNG para ICO ---
echo Write-Host 'Baixando icone...'
echo $pngPath = "$dataDir\logo.png"
echo Invoke-WebRequest -Uri $iconUrl -OutFile $pngPath -UseBasicParsing
echo.
echo $bmp = [System.Drawing.Bitmap]::new^($pngPath^)
echo $sq  = [System.Drawing.Bitmap]::new^(256, 256^)
echo $g   = [System.Drawing.Graphics]::FromImage^($sq^)
echo $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
echo $g.DrawImage^($bmp, 0, 0, 256, 256^)
echo $g.Dispose^(^); $bmp.Dispose^(^)
echo $pngMs = [System.IO.MemoryStream]::new^(^)
echo $sq.Save^($pngMs, [System.Drawing.Imaging.ImageFormat]::Png^)
echo $pngBytes = $pngMs.ToArray^(^)
echo $sq.Dispose^(^)
echo $ms  = [System.IO.MemoryStream]::new^(^)
echo $bw  = [System.IO.BinaryWriter]::new^($ms^)
echo $bw.Write^([int16]0^); $bw.Write^([int16]1^); $bw.Write^([int16]1^)
echo $bw.Write^([byte]0^); $bw.Write^([byte]0^); $bw.Write^([byte]0^); $bw.Write^([byte]0^)
echo $bw.Write^([int16]1^); $bw.Write^([int16]32^)
echo $bw.Write^([int32]$pngBytes.Length^)
echo $bw.Write^([int32]22^)
echo $bw.Write^($pngBytes^)
echo [System.IO.File]::WriteAllBytes^($icoPath, $ms.ToArray^(^)^)
echo $bw.Dispose^(^); $ms.Dispose^(^)
echo Write-Host 'Icone criado.'
echo.
echo # --- Argumentos do Chrome ---
echo $chromeArgs = "--app=`"$kioskUrl`" --user-data-dir=`"$profileDir`" --start-fullscreen --no-first-run --no-default-browser-check --disable-infobars --disable-session-crashed-bubble --disable-restore-session-state --disable-translate --disable-features=TranslateUI --disable-extensions --kiosk-printing"
echo.
echo # --- Atalho na Area de Trabalho ---
echo Write-Host 'Criando atalho na area de trabalho...'
echo $wsh = New-Object -ComObject WScript.Shell
echo $sc  = $wsh.CreateShortcut^("$env:USERPROFILE\Desktop\Emporio GO.lnk"^)
echo $sc.TargetPath       = $chrome
echo $sc.Arguments        = $chromeArgs
echo $sc.WorkingDirectory = Split-Path $chrome
echo $sc.Description      = 'Terminal de Caixa - Emporio das Bebidas'
echo $sc.IconLocation     = "$icoPath,0"
echo $sc.WindowStyle      = 3
echo $sc.Save^(^)
echo.
echo # --- Atalho na pasta Inicializar ---
echo Write-Host 'Adicionando ao Inicializar...'
echo $startupDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
echo $sc2 = $wsh.CreateShortcut^("$startupDir\Emporio GO.lnk"^)
echo $sc2.TargetPath       = $chrome
echo $sc2.Arguments        = $chromeArgs
echo $sc2.WorkingDirectory = Split-Path $chrome
echo $sc2.Description      = 'Terminal de Caixa - Emporio das Bebidas'
echo $sc2.IconLocation     = "$icoPath,0"
echo $sc2.WindowStyle      = 3
echo $sc2.Save^(^)
echo.
echo Write-Host 'Abrindo o quiosque...'
echo Start-Process $chrome -ArgumentList $chromeArgs
echo.
echo [System.Windows.Forms.MessageBox]::Show^('Emporio GO instalado com sucesso!^`n^`nAtalho criado na area de trabalho.^`nO quiosque abrira automaticamente ao ligar o PC.', 'Emporio GO', 'OK', 'Information'^) ^| Out-Null
echo.
echo } catch {
echo     $msg = $_.Exception.Message
echo     [System.Windows.Forms.MessageBox]::Show^("Erro durante a instalacao:^`n^`n$msg", 'Emporio GO - Erro', 'OK', 'Error'^) ^| Out-Null
echo     exit 1
echo }
) > "%PS%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS%"
del "%PS%" 2>nul

exit /b
