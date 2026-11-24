#!/usr/bin/env bash
# Actualiza el worker de YouTube de ClipLive en el equipo Debian: baja los últimos cambios de GitHub,
# reinstala dependencias, actualiza yt-dlp (importante: YouTube cambia a menudo) y reinicia el servicio.
#   bash scripts/update-debian-worker.sh
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/node/bin:$PATH"
export ONNXRUNTIME_NODE_INSTALL=skip  # sin binarios de NVIDIA (CUDA): basta la versión de CPU
echo "→ Bajando cambios de GitHub"
git -C .. pull --ff-only
echo "→ Dependencias"
npm ci --no-audit --no-fund
echo "→ Programas (yt-dlp, ffmpeg, modelos…)"
bash scripts/render-setup.sh worker
echo "→ Reiniciando el worker"
sudo systemctl restart cliplive-youtube
sleep 5
sudo systemctl --no-pager --lines=5 status cliplive-youtube || true
echo "✓ Worker de YouTube actualizado"
