import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// /robots.txt: Google puede leer la portada; las zonas privadas no se indexan.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/auth/", "/reset", "/clips", "/nuevo", "/planes"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
