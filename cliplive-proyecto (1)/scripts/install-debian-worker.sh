#!/usr/bin/env bash
# Instala el worker de YouTube de ClipLive en un equipo Debian/Ubuntu sin interfaz que esté siempre encendido en casa.
# YouTube bloquea las descargas desde servidores en la nube (Render), pero no desde una conexión doméstica.
#
# Uso (como usuario normal con sudo, desde la carpeta del proyecto):
#   bash scripts/install-debian-worker.sh
#
# Qué hace:
#   1. Instala lo básico del sistema (curl, git, xz…).
#   2. Instala Node.js 22 en ~/.local/node (sin tocar el Node del sistema).
#   3. Instala las dependencias del proyecto y, con render-setup.sh, yt-dlp, Deno, ffmpeg 8, los modelos de IA y las fuentes.
#   4. Crea .env.local pidiéndote las claves de Supabase (solo las escribes tú; se guardan con permisos 600).
#   5. Crea el servicio "cliplive-youtube" para que el worker arranque solo al encender y se reinicie si falla.
set -euo pipefail
cd "$(dirname "$0")/.."
DIR="$(pwd)"
NODE_DIR="$HOME/.local/node"
SERVICE=cliplive-youtube

echo "═══ ClipLive · worker de YouTube para Debian ═══"
echo "Carpeta: $DIR"

echo "→ 1/5 Paquetes del sistema"
sudo apt-get update -qq
sudo apt-get install -y -qq curl git xz-utils unzip ca-certificates python3 >/dev/null

echo "→ 2/5 Node.js 22"
if [ ! -x "$NODE_DIR/bin/node" ]; then
  arch="$(uname -m)"; case "$arch" in x86_64) narch=x64 ;; aarch64) narch=arm64 ;; *) echo "Arquitectura no soportada: $arch"; exit 1 ;; esac
  file="$(curl -fsSL https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt | grep -o "node-v22[.0-9]*-linux-$narch.tar.xz" | head -1)"
  curl -fsSL "https://nodejs.org/dist/latest-v22.x/$file" -o /tmp/node.tar.xz
  rm -rf "$NODE_DIR" && mkdir -p "$NODE_DIR"
  tar -xJf /tmp/node.tar.xz -C "$NODE_DIR" --strip-components=1
fi
export PATH="$NODE_DIR/bin:$PATH"
# onnxruntime-node intenta bajar los binarios de NVIDIA (CUDA); no hacen falta: la versión de CPU ya viene incluida.
export ONNXRUNTIME_NODE_INSTALL=skip
echo "   node $(node -v) · npm $(npm -v)"

echo "→ 3/5 Dependencias y programas (yt-dlp, Deno, ffmpeg, modelos, fuentes)"
npm ci --no-audit --no-fund
if [ "$(uname -m)" = "x86_64" ]; then
  bash scripts/render-setup.sh worker
else
  echo "   ⚠ render-setup.sh descarga binarios x86_64: en ARM instala ffmpeg 8+, yt-dlp y deno a mano en ./bin"
fi

echo "→ 4/5 Claves (.env.local)"
if [ -f .env.local ] && grep -q '^SUPABASE_SERVICE_ROLE_KEY=.\+' .env.local; then
  echo "   .env.local ya existe: se mantiene"
else
  read -rp "   NEXT_PUBLIC_SUPABASE_URL (https://xxxx.supabase.co): " SB_URL
  read -rsp "   SUPABASE_SERVICE_ROLE_KEY (sb_secret_…, no se ve al escribir): " SB_KEY; echo
  umask 077
  cat > .env.local <<EOF
# Worker de YouTube de ClipLive (equipo de casa). No subir a GitHub.
NEXT_PUBLIC_SUPABASE_URL=$SB_URL
SUPABASE_SERVICE_ROLE_KEY=$SB_KEY
STORAGE_BUCKET=clips
EOF
  chmod 600 .env.local
  echo "   ✓ .env.local creado (solo lo puede leer tu usuario)"
fi

echo "→ 5/5 Servicio $SERVICE (arranca solo y se reinicia si falla)"
sudo tee "/etc/systemd/system/$SERVICE.service" >/dev/null <<EOF
[Unit]
Description=ClipLive - worker de YouTube
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$(id -un)
WorkingDirectory=$DIR
Environment=YOUTUBE_WORKER_MODE=youtube-only
Environment=WORKER_CONCURRENCY=1
Environment=PATH=$DIR/bin:$NODE_DIR/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=$NODE_DIR/bin/node --env-file=.env.local worker/index.mjs
Restart=always
RestartSec=10
# Los clips temporales van a /tmp; se limpian solos al terminar cada uno.
Nice=5

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now "$SERVICE"
sleep 5
echo
sudo systemctl --no-pager --lines=5 status "$SERVICE" || true
echo
echo "✓ Listo. El worker de YouTube ya está funcionando y arrancará solo cada vez que se encienda el equipo."
echo "  Ver lo que hace:   journalctl -u $SERVICE -f"
echo "  Actualizar:        bash scripts/update-debian-worker.sh"
