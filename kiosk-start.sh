#!/bin/bash
# =============================================================
#  Empório GO — Quiosque
#  Instala o atalho e inicia em modo aplicativo (sem barra de URL)
#
#  Primeira vez:  bash kiosk-start.sh --instalar
#  Iniciar:       bash kiosk-start.sh
# =============================================================

set -euo pipefail

# --- Configuração -----------------------------------------------------------
KIOSK_URL="https://adegas-pf.web.app/kiosk.html"
APP_NAME="Empório GO"
PROFILE_DIR="$HOME/.config/emporio-go-quiosque"
ICON_DIR="$HOME/.local/share/icons/hicolor/256x256/apps"
ICON_PATH="$ICON_DIR/emporio-go.png"
DESKTOP_DIR="$HOME/.local/share/applications"
SCRIPT_PATH="$(realpath "${BASH_SOURCE[0]}")"

# --- Detectar Chromium/Chrome -----------------------------------------------
detect_browser() {
  for cmd in chromium-browser chromium google-chrome google-chrome-stable; do
    if command -v "$cmd" &>/dev/null; then echo "$cmd"; return; fi
  done
  echo ""
}

BROWSER="$(detect_browser)"

# --- Instalar atalho e ícone ------------------------------------------------
instalar() {
  echo "📦  Instalando Empório GO Quiosque..."

  # Ícone
  mkdir -p "$ICON_DIR"
  ICON_SRC="$(dirname "$SCRIPT_PATH")/assets/logo-emporio.png"
  if [ -f "$ICON_SRC" ]; then
    cp "$ICON_SRC" "$ICON_PATH"
    echo "✔   Ícone instalado em $ICON_PATH"
  else
    echo "⚠   assets/logo-emporio.png não encontrado; ícone padrão será usado."
  fi

  # Atalho .desktop
  mkdir -p "$DESKTOP_DIR"
  cat > "$DESKTOP_DIR/emporio-go-quiosque.desktop" <<DESKTOP
[Desktop Entry]
Version=1.0
Name=$APP_NAME
GenericName=Terminal de Caixa
Comment=PDV do Empório das Bebidas
Exec=bash "$SCRIPT_PATH"
Icon=$ICON_PATH
Terminal=false
Type=Application
Categories=Office;Finance;
StartupWMClass=emporio-go-quiosque
StartupNotify=true
DESKTOP

  chmod +x "$DESKTOP_DIR/emporio-go-quiosque.desktop"

  # Atualizar banco de ícones
  if command -v gtk-update-icon-cache &>/dev/null; then
    gtk-update-icon-cache -f "$HOME/.local/share/icons/hicolor" 2>/dev/null || true
  fi
  if command -v update-desktop-database &>/dev/null; then
    update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
  fi

  echo ""
  echo "✅  Instalação concluída!"
  echo "    Atalho criado em: $DESKTOP_DIR/emporio-go-quiosque.desktop"
  echo "    Agora execute:  bash \"$SCRIPT_PATH\""
  echo ""
}

# --- Iniciar quiosque -------------------------------------------------------
iniciar() {
  if [ -z "$BROWSER" ]; then
    echo "❌  Chrome ou Chromium não encontrado."
    echo "    Instale com:  sudo apt install chromium-browser"
    exit 1
  fi

  # Encerrar instância anterior do quiosque (mesmo perfil)
  pkill -f "user-data-dir=$PROFILE_DIR" 2>/dev/null || true
  sleep 0.4

  echo "🚀  Iniciando Empório GO em modo aplicativo..."

  exec "$BROWSER" \
    --app="$KIOSK_URL" \
    --user-data-dir="$PROFILE_DIR" \
    --start-fullscreen \
    --no-first-run \
    --no-default-browser-check \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --disable-restore-session-state \
    --disable-translate \
    --disable-features=TranslateUI,Translate \
    --disable-extensions \
    --disable-popup-blocking \
    --kiosk-printing \
    --window-position=0,0 \
    2>/dev/null
}

# --- Main -------------------------------------------------------------------
case "${1:-}" in
  --instalar|-i)
    instalar
    ;;
  *)
    if [ -z "$BROWSER" ]; then
      echo "❌  Chrome ou Chromium não encontrado."
      echo "    Instale com:  sudo apt install chromium-browser"
      exit 1
    fi
    iniciar
    ;;
esac
