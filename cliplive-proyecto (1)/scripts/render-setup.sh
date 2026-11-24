#!/usr/bin/env bash
# Instala lo que ClipLive necesita en Render (Linux), sin Docker. Se ejecuta solo al publicar (buildCommand).
#   bash scripts/render-setup.sh web     → yt-dlp + Deno (la web comprueba los enlaces con yt-dlp)
#   bash scripts/render-setup.sh worker  → además ffmpeg, modelos de IA (Whisper y caras) y fuentes de subtítulos
set -euo pipefail
ROLE="${1:-worker}"
cd "$(dirname "$0")/.."
mkdir -p bin models worker/fonts
dl() { echo "   ↓ $2"; curl -fL -4 --progress-bar --connect-timeout 20 --retry 5 --retry-delay 3 -o "$2" "$1"; }

echo "→ yt-dlp (descarga de vídeos)"
dl "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux" bin/yt-dlp
chmod +x bin/yt-dlp
yt_dlp_version=$(./bin/yt-dlp --version)
if [[ "$yt_dlp_version" < "2026.11.23" ]]; then
  echo "La versión $yt_dlp_version de yt-dlp es anterior al arreglo del reproductor de YouTube. Reintenta la compilación." >&2
  exit 1
fi

echo "→ Deno (yt-dlp lo necesita para YouTube)"
dl "https://github.com/denoland/deno/releases/latest/download/deno-x86_64-unknown-linux-gnu.zip" /tmp/deno.zip
if command -v unzip >/dev/null; then unzip -o -q /tmp/deno.zip -d bin
else python3 -c "import zipfile; zipfile.ZipFile('/tmp/deno.zip').extractall('bin')"; fi
chmod +x bin/deno

if [ "$ROLE" = "worker" ]; then
  echo "→ ffmpeg 8+ (recortar, encuadrar y subtítulos con Whisper)"
  dl "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz" /tmp/ffmpeg.tar.xz
  rm -rf /tmp/ffmpeg-build && mkdir -p /tmp/ffmpeg-build
  tar -xJf /tmp/ffmpeg.tar.xz -C /tmp/ffmpeg-build --strip-components=1
  cp /tmp/ffmpeg-build/bin/ffmpeg /tmp/ffmpeg-build/bin/ffprobe bin/
  chmod +x bin/ffmpeg bin/ffprobe

  echo "→ Modelos de IA"
  [ -s models/ggml-base.bin ] || dl "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin" models/ggml-base.bin
  [ -s models/ultraface-rfb-320.onnx ] || dl "https://github.com/onnx/models/raw/main/validated/vision/body_analysis/ultraface/models/version-RFB-320.onnx" models/ultraface-rfb-320.onnx

  echo "→ Fuentes de los subtítulos (gratuitas, sustituyen a las de Windows)"
  G="https://github.com/google/fonts/raw/main"
  dl "$G/ofl/archivoblack/ArchivoBlack-Regular.ttf" worker/fonts/ArchivoBlack-Regular.ttf   # ≈ Arial Black
  dl "$G/ofl/anton/Anton-Regular.ttf"               worker/fonts/Anton-Regular.ttf          # ≈ Impact
  dl "$G/ofl/gelasio/Gelasio%5Bwght%5D.ttf"         worker/fonts/Gelasio.ttf                # ≈ Georgia
  dl "$G/ofl/courierprime/CourierPrime-Bold.ttf"    worker/fonts/CourierPrime-Bold.ttf      # ≈ Courier New
  dl "$G/ofl/arimo/Arimo%5Bwght%5D.ttf"             worker/fonts/Arimo.ttf                  # ≈ Arial

  echo "→ Comprobaciones"
  ./bin/ffmpeg -hide_banner -version | head -1
  if ./bin/ffmpeg -hide_banner -filters 2>/dev/null | grep -q " whisper "; then
    echo "   ✓ ffmpeg incluye Whisper: los subtítulos funcionarán"
  elif [ -x bin/whisper-cli ] && ./bin/whisper-cli --help >/dev/null 2>&1; then
    echo "   ✓ ffmpeg sin Whisper, pero whisper-cli ya está instalado: los subtítulos funcionarán"
  elif command -v cmake >/dev/null && command -v c++ >/dev/null; then
    echo "→ ffmpeg sin Whisper: compilando whisper-cli (whisper.cpp), tarda unos minutos"
    rm -rf /tmp/whisper.cpp
    git clone -q --depth 1 https://github.com/ggml-org/whisper.cpp.git /tmp/whisper.cpp
    cmake -S /tmp/whisper.cpp -B /tmp/whisper.cpp/build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF \
      -DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_EXAMPLES=ON -DWHISPER_SDL2=OFF -DGGML_NATIVE=OFF >/dev/null
    cmake --build /tmp/whisper.cpp/build -j"$(nproc)" --target whisper-cli >/dev/null
    cp /tmp/whisper.cpp/build/bin/whisper-cli bin/ && chmod +x bin/whisper-cli
    rm -rf /tmp/whisper.cpp
    echo "   ✓ whisper-cli listo: los subtítulos funcionarán"
  else
    echo "   ⚠ AVISO: este ffmpeg NO incluye Whisper y no hay cmake para compilar whisper-cli → clips SIN subtítulos"
  fi
  ./bin/ffmpeg -hide_banner -filters 2>/dev/null | grep -q " subtitles " && echo "   ✓ ffmpeg puede dibujar subtítulos (libass)"
fi

echo "   yt-dlp $yt_dlp_version"
./bin/deno --version | head -1 | sed 's/^/   /'
echo "✓ Instalación de ClipLive ($ROLE) terminada"
