"use client";

// components/TablaPanelesVidrio.tsx
// Tabla de paneles de vidrio del resultado: por cada panel muestra el número de
// piezas, el área utilizada, el desperdicio (recorte) y el porcentaje de
// aprovechamiento, más una fila de totales. Debajo del resumen incluye, por panel,
// la LISTA de vidrios a cortar identificados por letra (A, B, C, ...), con la misma
// letra que usa el visualizador (`EsquemaCorteVidrio`), su ventana de origen, las
// medidas (ancho × alto) y si la pieza va rotada.
//
// Puro de presentación: toda la aritmética proviene de las funciones del dominio
// (`planVidrio.ts`, `modelos.ts`, `parametros.ts`) para conservar la paridad numérica
// con el Java.
// Requirements: 8.3

import {
  PlanVidrio,
  totalPaneles,
  aprovechamientoPct,
  areaUtilizadaTotalCm2,
  areaDesperdicioTotalCm2,
} from "@/lib/dominio/planVidrio";
import { Panel, areaUtilizadaCm2, areaDesperdicioCm2 } from "@/lib/dominio/modelos";
import { cm } from "@/lib/dominio/parametros";
import { letraPieza } from "@/components/EsquemaCorteVidrio";

export interface TablaPanelesVidrioProps {
  /** Plan de vidrio resultante de la optimización. */
  plan: PlanVidrio;
}

/**
 * Porcentaje de aprovechamiento de un panel individual (0-100).
 * aprovechamiento = areaUtilizada(panel) / areaPanel * 100.
 * Devuelve 0 si el panel no tiene área (dimensiones <= 0).
 */
export function aprovechamientoPanelPct(panel: Panel): number {
  const areaPanel = panel.anchoCm * panel.altoCm;
  if (areaPanel <= 0) return 0;
  return (areaUtilizadaCm2(panel) / areaPanel) * 100;
}

const estiloTablaInterna: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: "0.5rem",
  fontSize: "0.85rem",
};

const thIzq: React.CSSProperties = {
  textAlign: "left",
  padding: "0.3rem 0.5rem",
  borderBottom: "1px solid var(--color-borde)",
};

const thDer: React.CSSProperties = { ...thIzq, textAlign: "right" };

const tdIzq: React.CSSProperties = {
  padding: "0.25rem 0.5rem",
  borderBottom: "1px solid var(--color-borde-suave)",
};

const tdDer: React.CSSProperties = { ...tdIzq, textAlign: "right", whiteSpace: "nowrap" };

/** Lista de los vidrios a cortar de un panel, identificados por letra (A, B, C, ...). */
function ListaCortesPanel({ panel }: { panel: Panel }) {
  if (panel.piezas.length === 0) {
    return <p style={{ fontSize: "0.85rem", color: "var(--color-texto-tenue)" }}>Este panel no tiene piezas.</p>;
  }
  return (
    <table style={estiloTablaInterna}>
      <thead>
        <tr>
          <th style={thIzq} scope="col">
            Id
          </th>
          <th style={thIzq} scope="col">
            Vidrio (ventana)
          </th>
          <th style={thDer} scope="col">
            Ancho (cm)
          </th>
          <th style={thDer} scope="col">
            Alto (cm)
          </th>
          <th style={thIzq} scope="col">
            Rotada
          </th>
        </tr>
      </thead>
      <tbody>
        {panel.piezas.map((c, idx) => (
          <tr key={idx}>
            <td style={{ ...tdIzq, fontWeight: 700 }}>{letraPieza(idx)}</td>
            <td style={tdIzq}>{c.pieza.etiquetaVentana}</td>
            <td style={tdDer}>{cm(c.anchoCm)}</td>
            <td style={tdDer}>{cm(c.altoCm)}</td>
            <td style={tdIzq}>{c.rotada ? "Sí" : "No"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function TablaPanelesVidrio({ plan }: TablaPanelesVidrioProps) {
  const paneles = plan.paneles;
  const total = totalPaneles(plan);

  return (
    <section className="tabla-paneles-vidrio">
      <h2>Mapa de cortes vidrio</h2>

      <p className="tabla-paneles-vidrio__resumen">
        Hoja: {cm(plan.parametros.panelAnchoCm)} x {cm(plan.parametros.panelAltoCm)} cm · Total de hojas:{" "}
        {total} · Aprovechamiento: {cm(aprovechamientoPct(plan))}%
      </p>

      {total === 0 ? (
        <p className="tabla-paneles-vidrio__vacio">No hay paneles de vidrio en el resultado.</p>
      ) : (
        <>
          {/* Lista de los vidrios a cortar por panel, identificados por letra. */}
          <h3 style={{ marginTop: "1.25rem" }}>Vidrios a cortar</h3>
          {paneles.map((panel, indice) => (
            <div key={indice} style={{ marginBottom: "1rem" }}>
              <h4 style={{ margin: "0.5rem 0 0.25rem" }}>
                Hoja {indice + 1} — {panel.piezas.length} pieza(s)
              </h4>
              <ListaCortesPanel panel={panel} />
            </div>
          ))}
        </>
      )}
    </section>
  );
}
