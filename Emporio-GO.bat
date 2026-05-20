@echo off
setlocal EnableDelayedExpansion

REM  Se ja foi instalado antes, vai direto pro quiosque
if exist "%LOCALAPPDATA%\EmporioGO\installed.txt" goto :kiosk

REM ============================================================
REM  MODO INSTALADOR — roda apenas quando executado manualmente
REM ============================================================

title Emporio GO  -  Instalador Pro v2.0
mode con: cols=66 lines=46
color 0A

cls
echo.
echo  +============================================================+
echo  ^|        EMPORIO GO  --  Instalador Pro v2.0                ^|
echo  ^|        Sistema de Quiosque Ultra Avancado                  ^|
echo  +============================================================+
echo.
timeout /t 1 /nobreak >nul
echo   Iniciando modulos de instalacao avancada...
echo.
timeout /t 2 /nobreak >nul

REM ---- Escreve os scripts temporarios das sub-janelas ----

set "T1=%TEMP%\eg_neural.bat"
set "T2=%TEMP%\eg_chain.bat"
set "T3=%TEMP%\eg_sat.bat"
set "T4=%TEMP%\eg_brunao.bat"

(
  echo @echo off
  echo title IA de Bebidas - Emporio GO
  echo color 0B
  echo mode con: cols=54 lines=18
  echo echo.
  echo echo  [IA NEURAL] Iniciando modelo de bebidas v4.2...
  echo echo.
  echo timeout /t 1 /nobreak ^>nul
  echo echo   Carregando dataset de cervejas...........  OK
  echo timeout /t 1 /nobreak ^>nul
  echo echo   Treinando rede neural anti-ressaca.......  OK
  echo timeout /t 1 /nobreak ^>nul
  echo echo   Calibrando sensor de sede................  OK
  echo timeout /t 1 /nobreak ^>nul
  echo echo   Otimizando sugestao de petisco...........  OK
  echo timeout /t 1 /nobreak ^>nul
  echo echo   Ajustando limiar de embriaguez...........  IGNORADO
  echo timeout /t 2 /nobreak ^>nul
  echo echo.
  echo echo  [IA NEURAL] Modelo pronto. Acuracia: 99.9 por cento.
  echo echo  Margem de erro: apenas 1 cerveja a mais.
  echo timeout /t 5 /nobreak ^>nul
) > "%T1%"

(
  echo @echo off
  echo title Blockchain Cervejeiro - Emporio GO
  echo color 0E
  echo mode con: cols=54 lines=18
  echo echo.
  echo echo  [BLOCKCHAIN] Sincronizando ledger cervejeiro...
  echo echo.
  echo timeout /t 1 /nobreak ^>nul
  echo echo   Block ^#00841  Hash: a3f9b2c1..e847d  [OK]
  echo timeout /t 1 /nobreak ^>nul
  echo echo   Block ^#00842  Hash: 7d2e1a9f..3c560  [OK]
  echo timeout /t 1 /nobreak ^>nul
  echo echo   Block ^#00843  Hash: f1b4e72a..d9038  [OK]
  echo timeout /t 1 /nobreak ^>nul
  echo echo   Block ^#00844  Hash: 9c3f6b8a..1e452  [OK]
  echo timeout /t 1 /nobreak ^>nul
  echo echo   Block ^#00845  Hash: 2a7d4e1b..8f903  [OK]
  echo timeout /t 2 /nobreak ^>nul
  echo echo.
  echo echo  [BLOCKCHAIN] 5 blocos validados. NFT de cerveja emitido.
  echo echo  Valor de mercado: R$ 0,00. Normal, e cerveja.
  echo timeout /t 5 /nobreak ^>nul
) > "%T2%"

(
  echo @echo off
  echo title Satelite NASA-Beer - Emporio GO
  echo color 0D
  echo mode con: cols=54 lines=18
  echo echo.
  echo echo  [NASA-BEER] Conectando ao satelite BR-420...
  echo echo.
  echo timeout /t 2 /nobreak ^>nul
  echo echo   Sinal recebido: 92.4 dBm..................  OK
  echo timeout /t 1 /nobreak ^>nul
  echo echo   Triangulando posicao do boteco...........  OK
  echo timeout /t 1 /nobreak ^>nul
  echo echo   Calculando rota de entrega orbital.......  OK
  echo timeout /t 1 /nobreak ^>nul
  echo echo   Atualizando mapa de clientes com sede....  OK
  echo timeout /t 2 /nobreak ^>nul
  echo echo.
  echo echo  [NASA-BEER] Missao confirmada.
  echo echo  Drone de cerveja a caminho. ETA: 3 minutos.
  echo timeout /t 5 /nobreak ^>nul
) > "%T3%"

(
  echo @echo off
  echo :loop
  echo cls
  echo color 4E
  echo mode con: cols=56 lines=10
  echo echo.
  echo echo   ooooooooooooooooooooooooooooooooooooooooooooooo
  echo echo         BRUNAO ta te configurando por dentro...
  echo echo   ooooooooooooooooooooooooooooooooooooooooooooooo
  echo timeout /t 2 /nobreak ^>nul
  echo cls
  echo color 0C
  echo mode con: cols=56 lines=10
  echo echo.
  echo echo   ***********************************************
  echo echo      BRUNAO colocando na tua entrada USB...
  echo echo   ***********************************************
  echo timeout /t 2 /nobreak ^>nul
  echo cls
  echo color 1E
  echo mode con: cols=56 lines=10
  echo echo.
  echo echo   ===============================================
  echo echo      Detectada FALHA no hardware do usuario.
  echo echo      Brunao ja esta ciente e na fila.
  echo echo   ===============================================
  echo timeout /t 2 /nobreak ^>nul
  echo cls
  echo color 0D
  echo mode con: cols=56 lines=10
  echo echo.
  echo echo   ###############################################
  echo echo      Brunao FORMATANDO o seu cerebro...
  echo echo      (Nao achou muita coisa, mas ok.)
  echo echo   ###############################################
  echo timeout /t 2 /nobreak ^>nul
  echo cls
  echo color 0B
  echo mode con: cols=56 lines=10
  echo echo.
  echo echo   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  echo echo      VIRUS encontrado no sistema.
  echo echo      Virus viu o Brunao e FUGIU.
  echo echo   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  echo timeout /t 2 /nobreak ^>nul
  echo cls
  echo color 6E
  echo mode con: cols=56 lines=10
  echo echo.
  echo echo   ^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+
  echo echo      Brunao checando historico do navegador...
  echo echo      Muita coisa feia aqui, hein rapaz.
  echo echo   ^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+^+
  echo timeout /t 2 /nobreak ^>nul
  echo cls
  echo color 0E
  echo mode con: cols=56 lines=10
  echo echo.
  echo echo   ===============================================
  echo echo      Instalando BRUNAO versao Premium...
  echo echo      (Voce nao pediu, mas vai precisar.)
  echo echo   ===============================================
  echo timeout /t 2 /nobreak ^>nul
  echo cls
  echo color 4C
  echo mode con: cols=56 lines=10
  echo echo.
  echo echo   ooooooooooooooooooooooooooooooooooooooooooooooo
  echo echo      BRUNAO acessando seus arquivos secretos...
  echo echo      Encontrou as fotos. Nao vai falar nada.
  echo echo   ooooooooooooooooooooooooooooooooooooooooooooooo
  echo timeout /t 2 /nobreak ^>nul
  echo cls
  echo color 0A
  echo mode con: cols=56 lines=10
  echo echo.
  echo echo   ***********************************************
  echo echo      Brunao: sinal 100 por cento.
  echo echo      Voce: so assistindo e rezando.
  echo echo   ***********************************************
  echo timeout /t 2 /nobreak ^>nul
  echo cls
  echo color 0C
  echo mode con: cols=56 lines=10
  echo echo.
  echo echo   ###############################################
  echo echo      Modulo de vergonha alheia: DESATIVADO.
  echo echo      Era pra voce mesmo.
  echo echo   ###############################################
  echo timeout /t 2 /nobreak ^>nul
  echo goto :loop
) > "%T4%"

REM ---- Abre as 3 sub-janelas fake ----
start "" cmd /c "%T1%"
timeout /t 1 /nobreak >nul
start "" cmd /c "%T2%"
timeout /t 1 /nobreak >nul
start "" cmd /c "%T3%"
timeout /t 1 /nobreak >nul
start "" cmd /c "%T4%"
timeout /t 1 /nobreak >nul

REM ---- Passos da instalacao (janela principal) ----
call :step "Verificando temperatura das cervejas" 2
call :step "Inicializando modulo de pagamento via Pix" 2
call :bar  "Sincronizando cardapio com a distribuidora" 12
call :step "Configurando modo quiosque blindado" 2
call :bar  "Instalando antivirus cervejeiro v9.9" 10

echo.
echo   [ERRO 0x00B33R] Modulo de ressaca detectado no sistema!
timeout /t 2 /nobreak >nul
echo   Aplicando patch de emergencia...
timeout /t 2 /nobreak >nul
echo   [AVISO] Patch falhou. Ressaca e inevitavel neste sistema.
timeout /t 1 /nobreak >nul
echo   Aceitando como feature. Continuando instalacao...
echo.
timeout /t 2 /nobreak >nul

call :step "Treinando IA para sugerir o petisco certo" 2
call :bar  "Baixando 3.2 GB de dados essenciais" 10
call :step "Verificando se o Zezinho pagou o fiado" 2

echo.
echo   [OK] Zezinho pagou. (Milagre do dia.) Sistema liberado.
echo.
timeout /t 2 /nobreak >nul

call :step "Alinhando chakras do servidor" 1
call :step "Aplicando configuracoes definitivas" 1

REM ---- Instalacao real (silenciosa, acontece aqui) ----
set "DEST=%LOCALAPPDATA%\EmporioGO"
if not exist "%DEST%" mkdir "%DEST%"
copy /Y "%~f0" "%DEST%\Emporio-GO.bat" >nul 2>&1

set "BAT=%DEST%\Emporio-GO.bat"
set "DSK=%USERPROFILE%\Desktop"
set "STP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"

REM Cria marcador de instalacao (usado na proxima execucao para ir direto ao quiosque)
echo instalado > "%DEST%\installed.txt"

REM Remove atalhos antigos
for %%F in ("Emporio das Bebidas" "Emporio GO") do (
  if exist "%DSK%\%%~F.lnk" del /Q "%DSK%\%%~F.lnk" 2>nul
  if exist "%STP%\%%~F.lnk" del /Q "%STP%\%%~F.lnk" 2>nul
)

REM Cria atalhos via VBScript (mais confiavel que PowerShell em qualquer Windows)
set "VBS=%TEMP%\eg_link.vbs"
(
  echo Set oWS = WScript.CreateObject^("WScript.Shell"^)
  echo Set oD = oWS.CreateShortcut^("%DSK%\Emporio GO.lnk"^)
  echo oD.TargetPath = ^"%BAT%^"
  echo oD.WorkingDirectory = ^"%DEST%^"
  echo oD.WindowStyle = 1
  echo oD.Description = "Emporio GO - Caixa"
  echo oD.Save
  echo Set oS = oWS.CreateShortcut^("%STP%\Emporio GO.lnk"^)
  echo oS.TargetPath = ^"%BAT%^"
  echo oS.WorkingDirectory = ^"%DEST%^"
  echo oS.WindowStyle = 7
  echo oS.Description = "Emporio GO - Caixa"
  echo oS.Save
) > "%VBS%"
cscript //NoLogo "%VBS%" >nul 2>&1
del /Q "%VBS%" >nul 2>&1

del /Q "%T1%" "%T2%" "%T3%" "%T4%" >nul 2>&1

call :bar "Finalizando e lacando tudo com cera" 8

REM ---- Tela de sucesso ----
cls
color 0A
echo.
echo  +============================================================+
echo  ^|                                                            ^|
echo  ^|         INSTALACAO CONCLUIDA COM SUCESSO!                  ^|
echo  ^|                                                            ^|
echo  ^|   [OK]  Atalho "Emporio GO" na Area de Trabalho           ^|
echo  ^|   [OK]  Sistema inicia junto com o Windows                 ^|
echo  ^|   [OK]  IA de bebidas: 99.9 por cento calibrada           ^|
echo  ^|   [OK]  Blockchain cervejeiro: sincronizado                ^|
echo  ^|   [OK]  Satelite NASA-Beer: online e operacional           ^|
echo  ^|   [OK]  Cervejas: geladas e prontas                        ^|
echo  ^|   [OK]  Ressaca: inevitavel (recurso, nao bug)             ^|
echo  ^|                                                            ^|
echo  ^|   Para sair do quiosque:  Alt + F4                         ^|
echo  ^|   Para reinstalar:  delete a pasta EmporioGO em AppData      ^|
echo  ^|                                                            ^|
echo  +============================================================+
echo.
echo   Pressione qualquer tecla para abrir o sistema agora...
echo   (A culpa de qualquer ressaca e 100 por cento sua, ok?)
echo.
pause >nul

goto :kiosk

REM ============================================================
REM  MODO QUIOSQUE — execucao normal via atalho (/launch)
REM ============================================================
:kiosk

set "URL=https://adegas-pf.web.app"
set "PROFILE=%LOCALAPPDATA%\EmporioGO\ChromeProfile"

set "CHROME="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe"      set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe"      set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if not defined CHROME (
  echo.
  echo  [ERRO] Google Chrome nao encontrado neste computador.
  echo  Instale em https://www.google.com/chrome e tente novamente.
  echo.
  pause
  exit /b 1
)

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

REM ============================================================
REM  SUBROUTINES
REM ============================================================

:step
echo   %~1...
timeout /t %~2 /nobreak >nul
echo   ^> OK
echo.
goto :eof

:bar
set "_lbl=%~1"
set /a "_tot=%~2"
echo.
echo   !_lbl!
<nul set /p "=  ["
for /l %%i in (1,1,!_tot!) do (
  timeout /t 1 /nobreak >nul
  <nul set /p "=##"
)
echo ]  OK
echo.
goto :eof
