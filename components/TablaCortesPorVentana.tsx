"use client";

// components/TablaCortesPorVentana.tsx
// Tabla de solo lectura de los cortes agrupados por ventana. Recibe el despiece plano
// (`Pieza[]`) y lo agrupa con `agruparPorVentana` (ventana → material → longitudes consolidadas),
// mostrando por cada ventana sus materiales con longitud y cantidad.
//
// Porta la sección "CORTES POR VENTANA" del `ReporteTexto` Java. La agrupación vive en el dominio
// (`@/lib/dominio/cortesPorVentana`), por lo que este componente solo lee y presenta.

import type { Pieza } from "@/lib/dominio/modelos";
import { agruparPorVentana } from "@/lib/dominio/cortesPorVentana";
import { cm } from "@/lib/dominio/parametros";

export interface TablaCortesPorVentanaProps {
  /** Despiece plano (todas las piezas) tal como lo entrega el pipeline. */
  piezas: Pieza[];
}

const estiloTabla: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  marginBottom: "1rem",
};

const estiloTh: React.CSSProperties = {
  textAlign: "left",
  padding: "0.4rem 0.6rem",
  borderBottom: "2px solid var(--color-borde)",
  fontSize: "0.85rem",
};

const estiloTd: React.CSSProperties = {
  padding: "0.35rem 0.6rem",
  borderBottom: "1px solid var(--color-borde-suave)",
  verticalAlign: "top",
  fontSize: "0.85rem",
};

const estiloNum: React.CSSProperties = { ...estiloTd, textAlign: "right", whiteSpace: "nowrap" };

export default function TablaCortesPorVentana({ piezas }: TablaCortesPorVentanaProps) {
  const ventanas = agruparPorVentana(piezas);

  if (ventanas.length === 0) {
    return <p style={{ fontSize: "0.9rem", color: "var(--color-texto-tenue)" }}>No hay cortes para mostrar.</p>;
  }

  return (
    <section aria-label="Cortes por ventana">
      <h3 style={{ marginBottom: "1rem" }}>Cortes por ventana</h3>

      {ventanas.map((ventana) => (
        <div key={ventana.etiqueta} style={{ marginBottom: "1.5rem" }}>
          <h4 style={{ marginBottom: "0.5rem" }}>
            {ventana.etiqueta} ({ventana.perfil}) — {ventana.totalPiezas} pieza(s)
          </h4>
          <table style={estiloTabla}>
            <thead>
              <tr>
                <th style={estiloTh}>Material</th>
                <th style={{ ...estiloTh, textAlign: "right" }}>Longitud (cm)</th>
                <th style={{ ...estiloTh, textAlign: "right" }}>Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(ventana.porMaterial).flatMap(([material, agrupadas]) =>
                agrupadas.map((a, i) => (
                  <tr key={`${ventana.etiqueta}-${material}-${a.longitudCm}-${i}`}>
                    <td style={estiloTd}>{material.toUpperCase()}</td>
                    <td style={estiloNum}>{cm(a.longitudCm)}</td>
                    <td style={estiloNum}>{a.cantidad}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}
