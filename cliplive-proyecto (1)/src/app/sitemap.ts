import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// /sitemap.xml: las páginas públicas que Google debe conocer.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/bienvenida`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/login`, changeFrequency: "monthly", priority: 0.5 },
  ];
}
