"use client";

// components/MapaCorteAluminio.tsx
// Mapa visual del plan de corte de aluminio de la pantalla de ventanas: dibuja, barra por barra y
// con colores, el acomodo de los cortes en cada tira, igual que el mapa de la pantalla de despiece
// 1D. Reutiliza `MapaCorteBarras` (el mismo dibujo SVG de la 1D) por cada grupo de tiras.
//
// El `PlanCorte` agrupa las tiras por perfil → material, así que este componente itera esa
// jerarquía y, por cada material de cada perfil, renderiza su bloque de barras. De esa forma el
// mapa queda organizado igual que las tablas del panel de resultados (por perfil y material),
// conservando el estilo visual de la 1D.

import type { PlanCorte } from "@/lib/dominio/planCorte";
import { tirasDePerfil, desperdicioDePerfil } from "@/lib/dominio/planCorte";
import { cm } from "@/lib/dominio/parametros";
import MapaCorteBarras from "@/components/MapaCorteBarras";

export interface MapaCorteAluminioProps {
  /** Plan de corte de aluminio ya calculado por el pipeline. */
  plan: PlanCorte;
}

export default function MapaCorteAluminio({ plan }: MapaCorteAluminioProps) {
  if (plan.perfiles.length === 0) {
    return (
      <p style={{ fontSize: "0.9rem", color: "var(--color-texto-tenue)" }}>
        No hay barras de aluminio para mostrar.
      </p>
    );
  }

  const { largoTiraCm, sierraCm } = plan.parametros;

  return (
    <section aria-label="Mapa de corte de aluminio por barra">
      <h3 style={{ marginBottom: "0.25rem" }}>Mapa de corte de aluminio</h3>
      <p style={{ margin: "0 0 1rem", fontSize: "0.85rem", color: "var(--color-texto-tenue)" }}>
        Barra: {cm(largoTiraCm)} cm · Sierra (kerf): {cm(sierraCm)} cm
      </p>

      {plan.perfiles.map((perfil) => {
        const porMaterial = plan.porPerfilMaterial.get(perfil);
        if (porMaterial === undefined) return null;
        return (
          <div key={perfil} style={{ marginBottom: "1.5rem" }}>
            <h4 style={{ marginBottom: "0.5rem" }}>
              Perfil {perfil} — {tirasDePerfil(plan, perfil)} barra(s) · desperdicio:{" "}
              {cm(desperdicioDePerfil(plan, perfil))} cm
            </h4>

            {[...porMaterial.entries()].map(([material, tiras]) => (
              <div key={`${perfil}-${material}`} style={{ marginBottom: "0.75rem" }}>
                <p
                  style={{
                    margin: "0.25rem 0",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    color: "var(--color-texto-tenue)",
                  }}
                >
                  {material.toUpperCase()} — {tiras.length} barra(s)
                </p>
                <MapaCorteBarras tiras={tiras} largoBarraCm={largoTiraCm} sierraCm={sierraCm} />
              </div>
            ))}
          </div>
        );
      })}
    </section>
  );
}
