# ClipLive

Clips de directos de YouTube, Twitch, Kick y TikTok, y de vídeos normales de YouTube. Next.js 15 + Tailwind, Supabase (auth + Postgres), Redis/BullMQ, worker con yt-dlp + ffmpeg, R2/S3 y Stripe.

**Estado:** código escrito pero **no ejecutado ni compilado** (el entorno donde lo generé no tenía red para instalar dependencias). Espera algún ajuste al primer arranque. La captura con retroceso (`--live-from-start` + `--download-sections` negativo) es lo más frágil: pruébalo primero con un directo de YouTube.

## Arquitectura
`Navegador → Next.js (pantallas + /api) → Redis (BullMQ) → worker (yt-dlp + ffmpeg) → R2/S3 → URL firmada de descarga`
Los créditos se descuentan y devuelven con funciones SQL atómicas (`create_clip`, `refund_clip`), no desde la app.

## Requisitos
Node 20+, Docker (para Redis), `ffmpeg`, `yt-dlp` y **Deno** (yt-dlp lo necesita para YouTube; instala también `yt-dlp-ejs`). Cuenta de Supabase, bucket R2/S3 y cuenta de Stripe.

## Instalación
1. `npm install`
2. `cp .env.example .env.local` y rellena los valores.
3. Supabase: ejecuta `supabase/migrations/0001_init.sql` en el SQL editor. Activa Google en Authentication → Providers y añade `http://localhost:3000/auth/callback` a las URL permitidas.
4. Bucket: crea `cliplive-clips` (privado) y aplica `infra/lifecycle.json` para borrar a los 30 días (en R2: Settings → Object lifecycle rules).
5. Stripe: crea 3 precios mensuales (Starter, Creator, Pro) y pon sus IDs en `.env.local`. En local: `stripe listen --forward-to localhost:3000/api/webhook` y copia el `whsec_…` a `STRIPE_WEBHOOK_SECRET`. Eventos usados: `invoice.paid`, `customer.subscription.deleted`.
6. `docker compose up -d` (Redis).
7. Dos terminales: `npm run dev` y `npm run worker`.

## Producción
Next.js en Vercel o similar; el worker en una máquina propia o contenedor con ffmpeg, yt-dlp y Deno (no sirve en serverless: los clips tardan minutos). `/api/probe` también ejecuta yt-dlp, así que necesita yt-dlp en el servidor que lo aloje (o muévelo al worker).

## Pendiente / a decidir
- Vídeos normales (VOD): solo YouTube. Hay que ejecutar también `supabase/migrations/0002_vod.sql`. El recorte usa `--download-sections` + `--force-keyframes-at-cuts`; tampoco está probado.
- Precios, créditos y límites en `src/lib/plans.ts` son marcadores.
- `dvrSeconds` en `/api/probe` es una estimación por plataforma, no se lee del directo.
- Herramientas de edición (subtítulos, destacados IA, mejorar audio, exportar, portada) no están implementadas.
- Sin límite de peticiones (rate limiting), sin tests, sin gestión de la suscripción desde la app (portal de Stripe).
- Respeta las condiciones de cada plataforma y los derechos de autor del contenido que se clipea.
