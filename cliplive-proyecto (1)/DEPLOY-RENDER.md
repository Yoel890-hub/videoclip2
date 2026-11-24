# Publicar ClipLive en Render

La web y el worker funcionan en Render, la base de datos y los clips siguen en Supabase. Sin Docker.

| Servicio en Render | Qué hace | Plan | Precio aprox. |
|---|---|---|---|
| `cliplive-web` | Páginas, login y API | Starter | $7/mes |
| `cliplive-worker` | Descargas, recortes, encuadre y subtítulos | Standard (2 GB) | $25/mes |

Todo lo crea el archivo `render.yaml` (en la raíz del repositorio) de una vez.

---

## 1. Antes de empezar
- El código tiene que estar subido a GitHub (repositorio `videoclip2`, rama `main`).
- Ten a mano tus claves de Supabase (Supabase → Project Settings → API Keys):
  - **Project URL** (`https://xxxx.supabase.co`)
  - **Publishable key** (`sb_publishable_…`)
  - **Secret key** (`sb_secret_…`)
- Ten a mano tu **dominio** (por ejemplo `cliplive.app`).

## 2. Crear los servicios con el Blueprint
1. Entra en **dashboard.render.com** → botón **New** → **Blueprint**.
2. Conecta tu cuenta de GitHub si no lo está y elige el repositorio **videoclip2**.
3. Render lee `render.yaml` y muestra los dos servicios: `cliplive-web` y `cliplive-worker`.
4. Te pedirá las variables marcadas como secretas. Rellénalas:

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://tu-dominio.com` (con https, sin barra al final) |
| `NEXT_PUBLIC_SUPABASE_URL` | La Project URL de Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | La `sb_publishable_…` |
| `SUPABASE_SERVICE_ROLE_KEY` | La `sb_secret_…` (en la web **y** en el worker) |
| `ADMIN_USERS` | `Dadito23` |
| `PAYPAL_…` | Variables del servicio `cliplive-web`. Usa `sandbox` para pruebas. [Cómo activar los cobros con PayPal](README.md#activar-los-cobros-con-paypal) |

5. Pulsa **Apply / Deploy Blueprint**. La primera vez tarda unos 5-10 minutos (descarga ffmpeg, yt-dlp y los modelos de IA).

## 3. Comprobar que todo arrancó
- **Worker** → pestaña **Logs**. Tiene que salir:
  - durante la instalación: `✓ ffmpeg incluye Whisper: los subtítulos funcionarán`
  - al arrancar: `Worker de ClipLive listo · cola en Supabase · 1 trabajos a la vez`
- **Web** → pestaña **Logs**: `✓ Ready`. Abre la dirección `https://cliplive-web.onrender.com` y entra con tu cuenta.

> ⚠ Si en la instalación del worker sale `AVISO: este ffmpeg NO incluye Whisper`, los clips se crean pero **sin subtítulos**.
> Avísame y cambio la descarga de ffmpeg por otra versión que lo incluya.

## 4. Poner tu dominio
1. Render → servicio **cliplive-web** → **Settings** → **Custom Domains** → **Add Custom Domain**.
2. Añade tu dominio (`tu-dominio.com`) y también `www.tu-dominio.com`.
3. Render te muestra **qué registros DNS poner**. Ve al panel donde compraste el dominio (Namecheap, GoDaddy, Cloudflare…) → **DNS** y crea exactamente esos registros. Normalmente:
   - `www` → registro **CNAME** apuntando a `cliplive-web.onrender.com`
   - el dominio sin www (`@`) → registro **A** (o ALIAS/ANAME) con la IP que indique Render
4. Espera a que Render marque el dominio como **Verified** y emita el certificado **HTTPS** (de minutos a unas horas).

## 5. Avisar a Supabase del dominio nuevo
Supabase → **Authentication** → **URL Configuration**:
- **Site URL**: `https://tu-dominio.com`
- **Redirect URLs** → **Add URL**: `https://tu-dominio.com/**`

Sin esto, el enlace de "¿Olvidaste tu contraseña?" llevaría a `localhost`.

## 6. El worker de tu PC
Ya no hace falta encenderlo: el de Render trabaja 24 h. Si lo dejas encendido no pasa nada (los dos comparten la cola sin pisarse),
pero lo normal es apagarlo para que todo lo haga Render.

## 7. Actualizar la web en el futuro
Cada vez que se sube un cambio a GitHub (`main`), Render vuelve a publicar la web y el worker solo.

## Si YouTube bloquea las consultas desde Render

Comprueba el mismo enlace desde el otro equipo con `yt-dlp --skip-download --print duration URL`. Instala `yt-dlp` 2026.11.23 o más reciente, Deno y FFmpeg. Usa una conexión desde la que YouTube permita consultar y descargar el video.

1. Aplica [`0015_youtube_worker.sql`](supabase/migrations/0015_youtube_worker.sql) en el SQL Editor del proyecto de ClipLive.
2. En `cliplive-worker`, añade `YOUTUBE_WORKER_MODE=external` y espera a que Render despliegue el cambio. Ese servicio procesará Twitch, Kick y TikTok.
3. En el otro equipo, guarda en `.env.local` las variables de Supabase del mismo proyecto. Arranca el worker desde la carpeta de ClipLive y espera a que el log indique `Worker de ClipLive listo · youtube`.

   ```powershell
   $env:YOUTUBE_WORKER_MODE = 'youtube-only'
   $env:WORKER_CONCURRENCY = '1'
   npm.cmd run worker
   ```

4. En `cliplive-web`, añade `YOUTUBE_WORKER_MODE=external` y despliega. Comprueba desde la web que puedes abrir un enlace de YouTube y descargar un clip generado.

El worker externo usa la cola privada de Supabase y debe permanecer encendido para que funcionen los enlaces de YouTube. Para volver al procesamiento directo después de comprobar que Render tiene acceso a YouTube, detén el worker externo, quita `YOUTUBE_WORKER_MODE` de ambos servicios de Render y despliega.

---

### Cosas a tener en cuenta
- **Velocidad del worker:** el plan Standard tiene 1 CPU, así que los clips con subtítulos y encuadre automático tardan más que en tu PC.
  Si se queda corto, sube el worker al plan **Pro** en Render y cambia `WORKER_CONCURRENCY` a `2`.
- **TikTok** puede limitar las descargas desde servidores en la nube. Revisa los registros de `cliplive-worker` si falla una captura.
- **Almacenamiento:** el plan gratis de Supabase guarda 1 GB de clips. Con usuarios reales hará falta Supabase Pro ($25/mes, 100 GB).
- **Fuentes de los subtítulos:** en Render (Linux) se usan equivalentes gratuitas de las de Windows
  (Archivo Black ≈ Arial Black, Anton ≈ Impact, Gelasio ≈ Georgia, Courier Prime ≈ Courier New, Arimo ≈ Arial). Se ven casi iguales.
