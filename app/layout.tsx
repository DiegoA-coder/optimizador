import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Optimizador de Corte",
  description:
    "Optimizador de corte de aluminio y vidrio (port del proyecto Java a Next.js).",
  // Control de indexación a nivel de etiqueta <meta> (complementa a /robots.txt).
  // Permite indexar y seguir enlaces, pero restringe a los bots las vistas previas
  // grandes de texto/imagen/video usadas para scraping de contenido.
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
