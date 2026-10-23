"use client";

// components/PanelResultados.tsx
// Panel de resultados de la optimización: compone las vistas de solo lectura del
// `ResultadoCompleto` que entrega el pipeline. Pasa a cada hija la porción del resultado
// que le corresponde:
//   - TablaTiras            → plan de corte de aluminio (resultado.planCorte)
//   - MapaCorteAluminio     → mapa visual por barra, con colores, del plan de aluminio (resultado.planCorte)
//   - TablaCortesPorVentana → despiece plano agrupado por ventana (resultado.piezas)
//   - TablaPanelesVidrio    → plan de vidrio (resultado.planVidrio)
//   - EsquemaCorteVidrio    → esquema SVG a escala del plan de vidrio (resultado.planVidrio)
//
// Puro de presentación: no calcula nada, solo distribuye los datos ya calculados.
// Requirements: 8.1, 8.2, 8.3, 8.4

import type { ResultadoCompleto } from "@/lib/dominio/modelos";
import TablaTiras from "./TablaTiras";
import MapaCorteAluminio from "./MapaCorteAluminio";
import TablaCortesPorVentana from "./TablaCortesPorVentana";
import TablaPanelesVidrio from "./TablaPanelesVidrio";
import EsquemaCorteVidrio from "./EsquemaCorteVidrio";

export interface PanelResultadosProps {
  /** Resultado completo del pipeline de optimización (aluminio + vidrio). */
  resultado: ResultadoCompleto;
}

export default function PanelResultados({ resultado }: PanelResultadosProps) {
  return (
    <section aria-label="Resultados de la optimización" className="panel-resultados">
      <TablaTiras plan={resultado.planCorte} />
      <MapaCorteAluminio plan={resultado.planCorte} />
      <TablaCortesPorVentana piezas={resultado.piezas} />
      <TablaPanelesVidrio plan={resultado.planVidrio} />
      <EsquemaCorteVidrio plan={resultado.planVidrio} />
    </section>
  );
}
