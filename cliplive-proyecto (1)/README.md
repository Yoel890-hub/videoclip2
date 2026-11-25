# ClipLive

Clips de directos de YouTube, Twitch, Kick y TikTok, y de vídeos normales de YouTube. Next.js 15 + Tailwind, Supabase (auth, Postgres, Storage y cola de trabajos), worker con yt-dlp + ffmpeg + Whisper, y suscripciones con PayPal.

**Estado:** código escrito pero **no ejecutado ni compilado** (el entorno donde lo generé no tenía red para instalar dependencias). Espera algún ajuste al primer arranque. La captura con retroceso (`--live-from-start` + `--download-sections` negativo) es lo más frágil: pruébalo primero con un directo de YouTube.

## Arquitectura
`Navegador → Next.js (pantallas + /api) → tabla en Supabase (cola) → worker (yt-dlp + ffmpeg) → Supabase Storage → URL firmada de descarga`
Los créditos se descuentan y devuelven con funciones SQL atómicas (`create_clip`, `refund_clip`), no desde la app.

## Requisitos
Node 20+ (la cola de trabajos está en Supabase), `ffmpeg`, `yt-dlp`, `yt-dlp-ejs` y **Deno**. Cuenta de Supabase, bucket R2/S3 y cuenta PayPal Business del dueño para cobrar.

## Instalación
1. `npm install`
2. `cp .env.example .env.local` y rellena los valores.
3. Ejecuta en orden las migraciones de `supabase/migrations/` en Supabase. Si ya tienes una base de datos, aplica solo las migraciones pendientes. Para el login con Google, actívalo en Authentication → Providers y añade `http://localhost:3000/auth/callback` a las URL permitidas.
4. Bucket: crea `cliplive-clips` (privado) y aplica `infra/lifecycle.json` para borrar a los 30 días (en R2: Settings → Object lifecycle rules).
5. Ejecuta `npm run dev` y `npm run worker` en terminales separadas.

## Activar los cobros con PayPal

1. Aplica la migración [`0014_paypal_subscriptions.sql`](supabase/migrations/0014_paypal_subscriptions.sql) antes de activar PayPal. Empieza en Sandbox con un entorno de pruebas de ClipLive y una base de datos separada de la de producción.
2. Abre **Apps & Credentials** en el panel de PayPal Developer con la cuenta Business que recibirá los cobros. Crea una aplicación en Sandbox, selecciona la cuenta Business de pruebas y copia su Client ID y su Secret en `PAYPAL_CLIENT_ID` y `PAYPAL_CLIENT_SECRET`. [Panel de PayPal Developer](https://developer.paypal.com/dashboard/applications/)
3. Crea un producto de servicio digital para ClipLive y cuatro planes activos de precio fijo en USD. Usa ciclos regulares sin límite, sin período de prueba y sin cuota inicial. Copia los IDs `P-…` a las variables de la tabla. [Guía de suscripciones de PayPal](https://developer.paypal.com/platforms/subscriptions/integrate/)

   | Variable | Plan | Cobro | Créditos por ciclo |
   |---|---|---|---:|
   | `PAYPAL_PLAN_STARTER` | Starter | $9 cada mes | 300 |
   | `PAYPAL_PLAN_CREATOR` | Creator | $24 cada 2 meses | 2 000 |
   | `PAYPAL_PLAN_PRO` | Pro | $59 cada 5 meses | 15 000 |
   | `PAYPAL_PLAN_PREMIUM` | Premium | $99 cada año | 36 000 |

4. En la misma aplicación de PayPal, agrega la URL pública `https://tu-dominio.com/api/webhook/paypal` y copia el identificador del webhook en `PAYPAL_WEBHOOK_ID`. Si ejecutas la web en tu PC, usa una URL HTTPS accesible desde PayPal para recibir esas notificaciones. Selecciona estos eventos. [Guía de webhooks de PayPal](https://developer.paypal.com/api/rest/webhooks/rest/)

   - `PAYMENT.SALE.COMPLETED`
   - `BILLING.SUBSCRIPTION.ACTIVATED`
   - `BILLING.SUBSCRIPTION.CANCELLED`
   - `BILLING.SUBSCRIPTION.EXPIRED`

5. En `/planes`, completa una compra Sandbox con un comprador de prueba. Confirma que aparece en la cuenta Business de prueba y que ClipLive activa el plan y acredita una sola vez. Cancela desde `/planes` y comprueba que el plan se desactiva y PayPal detiene las renovaciones. El comprador puede cambiar de plan después de cancelar la suscripción anterior. PayPal muestra la tarjeta de débito o crédito cuando la cuenta del comercio y la compra son elegibles. [Formas de pago en suscripciones de PayPal](https://www.paypal.com/us/cshelp/article/merchant-subscription-faqs-help289)
6. Para cobrar en producción, configura `PAYPAL_ENV=live` y usa credenciales, planes y webhook del entorno Live de la cuenta Business del dueño. El producto, los 4 planes y el webhook se crean solos con `node scripts/paypal-setup.mjs live` (pide el Client ID y el Secret Live y muestra las variables para Render). Al pasar a Live, cierra las suscripciones de Sandbox de la base de datos: no existen en Live y bloquearían una compra real. Mantén `PAYPAL_CLIENT_SECRET` en las variables del servidor. Si existen suscripciones históricas de Stripe, conserva las dos variables `STRIPE_…` y su webhook anterior durante la transición para que sus cobros sigan acreditando créditos. Cancela la renovación anterior antes de que ese mismo cliente contrate su plan con PayPal.

## Producción
Next.js en Vercel o similar; el worker en una máquina propia o contenedor con ffmpeg, yt-dlp y Deno (no sirve en serverless: los clips tardan minutos). `/api/probe` también ejecuta yt-dlp, así que necesita yt-dlp en el servidor que lo aloje (o muévelo al worker).

## Pendiente / a decidir
- Vídeos normales (VOD): solo YouTube. Hay que ejecutar también `supabase/migrations/0002_vod.sql`. El recorte usa `--download-sections` + `--force-keyframes-at-cuts`; tampoco está probado.
- Precios, créditos y límites en `src/lib/plans.ts` son marcadores.
- `dvrSeconds` en `/api/probe` es una estimación por plataforma, no se lee del directo.
- Herramientas de edición (subtítulos, destacados IA, mejorar audio, exportar, portada) no están implementadas.
- Sin límite de peticiones (rate limiting).
- Respeta las condiciones de cada plataforma y los derechos de autor del contenido que se clipea.
