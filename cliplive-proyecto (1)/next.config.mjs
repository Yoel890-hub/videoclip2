/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  // Carpeta de compilación (por defecto .next). Permite compilar la versión rápida sin tocar la de npm run dev.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Oculta el botón "N" de herramientas de desarrollo de Next.js (solo aparece con npm run dev).
  devIndicators: false,
  experimental: {
    // Navegación instantánea: el navegador recuerda las páginas ya visitadas (30 s las de datos,
    // 3 min las fijas), así que ir y volver entre pestañas no espera al servidor.
    // Las acciones que cambian datos (crear, borrar, renombrar) refrescan la página igualmente.
    staleTimes: { dynamic: 30, static: 180 },
  },
};
