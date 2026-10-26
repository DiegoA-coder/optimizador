// app/page.tsx
// Menú general de la aplicación: punto de entrada que enlaza a las dos pantallas disponibles.
// Es un Server Component (no necesita estado ni interactividad): solo muestra tarjetas de
// navegación hacia `/ventanas` (optimizador completo de ventanas) y `/despiece` (despiece 1D
// por perfil con mapa de corte 2D).

import Link from "next/link";
import type { CSSProperties } from "react";

/** Metadatos de cada pantalla que se muestra como tarjeta en el menú. */
interface Pantalla {
  href: string;
  titulo: string;
  descripcion: string;
}

const PANTALLAS: Pantalla[] = [
  {
    href: "/ventanas",
    titulo: "Optimizador de ventanas",
    descripcion:
      "Despiece completo de ventanas: calcula las piezas de aluminio por perfil y las de vidrio, " +
      "las acomoda en tiras y paneles, y genera los reportes.",
  },
  {
    href: "/despiece",
    titulo: "Despiece por perfil (1D)",
    descripcion:
      "Carga las medidas de la Perfil y las piezas necesarias, y obtén el mapa de corte en 2D con " +
      "el acomodo óptimo, el usado y el sobrante de cada Perfil.",
  },
];

const estiloTarjeta: CSSProperties = {
  display: "block",
  padding: "1.25rem 1.5rem",
  border: "1px solid var(--color-borde)",
  borderRadius: 10,
  background: "var(--color-superficie)",
  color: "inherit",
  textDecoration: "none",
};

export default function PaginaMenu() {
  return (
    <main style={{ padding: "2rem", maxWidth: 760, margin: "0 auto" }}>
      <h1>Optimizador de Corte</h1>
      <p style={{ color: "var(--color-texto-tenue)", marginTop: 0 }}>Elige una herramienta para empezar.</p>

      <nav
        aria-label="Pantallas disponibles"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "1rem",
          marginTop: "1.5rem",
        }}
      >
        {PANTALLAS.map((pantalla) => (
          <Link key={pantalla.href} href={pantalla.href} style={estiloTarjeta}>
            <h2 style={{ margin: "0 0 0.4rem", fontSize: "1.15rem", color: "var(--color-acento)" }}>
              {pantalla.titulo}
            </h2>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--color-texto-tenue)" }}>{pantalla.descripcion}</p>
          </Link>
        ))}
      </nav>
    </main>
  );
}
