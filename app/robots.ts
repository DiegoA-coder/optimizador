// app/robots.ts
// Genera /robots.txt mediante la API de metadata de Next.js (App Router).
// Da instrucciones a los crawlers que respetan el estándar robots: permite el rastreo general
// pero bloquea explícitamente una lista de bots de scraping / IA conocidos. Esto NO es una
// barrera de seguridad (un bot malicioso puede ignorar robots.txt); el bloqueo efectivo de
// tráfico automatizado abusivo lo hace el middleware de rate limiting (middleware.ts).

import type { MetadataRoute } from "next";

/**
 * URL pública del sitio, usada para declarar el sitemap en robots.txt.
 * Se toma de la variable de entorno `NEXT_PUBLIC_SITE_URL` (configúrala en el despliegue);
 * si no está definida se omite el sitemap.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

/** Bots de scraping masivo / entrenamiento de IA que se bloquean por completo. */
const BOTS_BLOQUEADOS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "CCBot",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "Google-Extended",
  "PerplexityBot",
  "Amazonbot",
  "Bytespider",
  "FacebookBot",
  "Diffbot",
  "ImagesiftBot",
  "Omgilibot",
  "Omgili",
  "cohere-ai",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Regla general: el resto de crawlers puede rastrear todo el sitio.
      {
        userAgent: "*",
        allow: "/",
      },
      // Bots de scraping / IA: bloqueados por completo.
      {
        userAgent: BOTS_BLOQUEADOS,
        disallow: "/",
      },
    ],
    ...(SITE_URL ? { sitemap: `${SITE_URL}/sitemap.xml` } : {}),
  };
}
