# Worker de YouTube en un equipo Debian de casa

YouTube bloquea las descargas que llegan desde servidores en la nube (Render), pero no desde una conexión de casa.
Por eso los enlaces y clips de **YouTube** los procesa un equipo Debian encendido 24 h en casa, mientras
**Render** sigue con la web y con Twitch, Kick y TikTok. Todo se conecta por la cola de Supabase.

Requisitos que ya cumple tu portátil: Debian 13, x86_64, 15 GB de RAM, conexión a internet.
En Render, los dos servicios (`cliplive-web` y `cliplive-worker`) deben tener `YOUTUBE_WORKER_MODE=external`.

---

## Instalación (una sola vez)

Escribe en el portátil (directamente o por SSH desde tu PC: `ssh usuario@IP-del-portátil`):

```bash
sudo apt-get update && sudo apt-get install -y git
git clone https://github.com/Yoel890-hub/videoclip2.git ~/cliplive
cd ~/cliplive/"cliplive-proyecto (1)"
bash scripts/install-debian-worker.sh
```

El script tarda unos 5-10 minutos. A mitad te pedirá **dos datos** (los mismos de tu `.env.local` del PC):

| Te pide | Qué escribir |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://dogfatgiryrhwnrrniam.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Tu clave `sb_secret_…` (al pegarla **no se ve nada**: es normal, pulsa Enter) |

Al final tiene que salir `active (running)` y `✓ Listo`.

## Comprobar que funciona

```bash
journalctl -u cliplive-youtube -f
```
Debe aparecer `Worker de ClipLive listo · youtube`. Deja esa pantalla abierta, ve a **clipvidieo.com**,
pega un enlace de YouTube y crea un clip: verás aquí cómo el portátil lo procesa. Para salir: `Ctrl + C`
(el worker sigue funcionando).

## Uso diario

No hay que hacer nada: el worker **arranca solo** al encender el portátil y **se reinicia solo** si falla.
Tu PC puede estar apagado.

| Para… | Comando (desde la carpeta del proyecto) |
|---|---|
| Ver lo que hace | `journalctl -u cliplive-youtube -f` |
| Ver si está encendido | `systemctl status cliplive-youtube` |
| Reiniciarlo | `sudo systemctl restart cliplive-youtube` |
| Actualizar (cambios de GitHub + yt-dlp nuevo) | `cd ~/cliplive/"cliplive-proyecto (1)" && bash scripts/update-debian-worker.sh` |

Actualiza cuando subamos cambios al worker o si YouTube empieza a fallar: las versiones nuevas de
**yt-dlp** suelen arreglarlo.

## Si el portátil se apaga
Los enlaces de YouTube en la web dirán que el servicio no está disponible y los clips esperarán en la cola
hasta que vuelva. Si va a estar apagado mucho tiempo, en Render cambia `YOUTUBE_WORKER_MODE` a `direct`
en los dos servicios (YouTube funcionará solo cuando no bloquee al servidor).
