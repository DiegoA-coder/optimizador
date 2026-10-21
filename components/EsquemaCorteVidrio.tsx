// components/EsquemaCorteVidrio.tsx
// Dibuja cada panel de vidrio del plan a escala en SVG, replicando el esquema del
// `ReporteHtml` Java (ver web/lib/io/reporteHtml.ts, función `esquemaSvg`) para mantener
// paridad visual. Cada `PiezaColocada` se identifica con una LETRA (A, B, C, ...) corta en el
// dibujo, en vez de la etiqueta larga de la ventana (p. ej. "sala (Cerco Fijo)"), que saturaba
// el esquema. La etiqueta completa queda en el tooltip (`<title>`) y en la lista de la tabla.
//
// Regla de dibujo (igual que el HTML Java y el requisito 8.6): el origen de coordenadas del
// dominio está en la esquina inferior-izquierda, pero el SVG tiene el eje Y hacia abajo. Por
// eso se invierte la vertical:  ySvg = panelAltoCm - yCm - altoCm  (y luego se escala a px).
//
// Importante: los estilos van como ATRIBUTOS SVG inline (fill/stroke/...), no por clases CSS.
// En la app React no hay una hoja de estilos que defina `.panel`/`.pieza`/etc. (esas clases solo
// existen embebidas en el reporte HTML), así que depender de ellas dejaba el `<rect>` del panel
// sin `fill` -> el SVG lo pinta de negro por defecto y tapaba todo el esquema.

"use client";

import { cm } from "@/lib/dominio/parametros";
import { Panel, PiezaColocada } from "@/lib/dominio/modelos";
import { PlanVidrio } from "@/lib/dominio/planVidrio";

interface EsquemaCorteVidrioProps {
  plan: PlanVidrio;
  escala?: number; // px por cm (default calculada para caber en pantalla)
}

/** Lado máximo (px) al que se ajusta el panel cuando no se pasa `escala` explícita. */
const LADO_MAXIMO_PX = 360;

// Paleta replicada de `estilos()` en reporteHtml.ts para mantener paridad visual.
const COLOR_PANEL_FILL = "#f0e9d8";
const COLOR_PANEL_STROKE = "#b9ad8a";
const COLOR_PIEZA_FILL = "#cfe3f7";
const COLOR_PIEZA_FILL_ROTADA = "#ffe3bf"; // tinte distinto para piezas rotadas
const COLOR_PIEZA_STROKE = "#2f6ca3";
const COLOR_ETQ = "#14425f";
const COLOR_MED = "#333333";

/**
 * Genera el identificador por letra de una pieza según su posición en el panel:
 * 0 -> "A", 1 -> "B", ... 25 -> "Z", 26 -> "AA", 27 -> "AB", ...
 * Se usa tanto en el esquema SVG como en la tabla, de modo que la letra del dibujo
 * y la de la lista coinciden (misma pieza, misma letra).
 */
export function letraPieza(indice: number): string {
  let n = indice;
  let letra = "";
  do {
    letra = String.fromCharCode(65 + (n % 26)) + letra;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letra;
}

/** Formatea un número a 1 decimal con punto, igual que el `f1` del reporte HTML Java. */
function f1(valor: number): string {
  return valor.toFixed(1);
}

export default function EsquemaCorteVidrio({ plan, escala }: EsquemaCorteVidrioProps) {
  const p = plan.parametros;
  // Escala por defecto: encaja el lado mayor del panel en LADO_MAXIMO_PX, como el Java.
  const escalaPx = escala ?? LADO_MAXIMO_PX / Math.max(p.panelAnchoCm, p.panelAltoCm);

  return (
    <section
      aria-label="Esquema de corte de vidrio"
      className="esquema-corte"
      style={{ display: "flex", flexWrap: "wrap", gap: "1rem", margin: "1rem 0" }}
    >
      {plan.paneles.map((panel, i) => (
        <figure key={i} className="esquema-corte-panel" style={{ margin: 0 }}>
          <figcaption style={{ fontSize: "0.85rem", marginBottom: 4, color: "#444" }}>
            Panel {i + 1} ({panel.piezas.length} pieza(s))
          </figcaption>
          <PanelSvg panel={panel} escala={escalaPx} indice={i + 1} />
        </figure>
      ))}
    </section>
  );
}

interface PanelSvgProps {
  panel: Panel;
  escala: number;
  indice: number;
}

/**
 * Dibuja un panel y sus piezas a escala en SVG. Invierte el eje Y para que el dibujo coincida
 * con la orientación física del panel (origen abajo en el dominio, arriba en el SVG).
 */
function PanelSvg({ panel, escala, indice }: PanelSvgProps) {
  const w = panel.anchoCm * escala;
  const alto = panel.altoCm * escala;

  return (
    <svg
      className="esquema"
      width={f1(w)}
      height={f1(alto)}
      viewBox={`0 0 ${f1(w)} ${f1(alto)}`}
      role="img"
      aria-label={`Panel ${indice} de ${cm(panel.anchoCm)} por ${cm(panel.altoCm)} cm con ${panel.piezas.length} pieza(s)`}
      style={{ border: "1px solid #999", background: "#fafafa", display: "block" }}
    >
      {/* Fondo del panel (zona de recorte) */}
      <rect
        x="0"
        y="0"
        width={f1(w)}
        height={f1(alto)}
        fill={COLOR_PANEL_FILL}
        stroke={COLOR_PANEL_STROKE}
        strokeWidth={1}
      />

      {panel.piezas.map((c: PiezaColocada, idx: number) => {
        const px = c.xCm * escala;
        const pw = c.anchoCm * escala;
        const ph = c.altoCm * escala;
        // Invertir Y: en SVG el origen está arriba. ySvg = panelAltoCm - yCm - altoCm (en cm),
        // escalado a px queda: alto - yCm*escala - ph.
        const py = alto - c.yCm * escala - ph;
        const cx = px + pw / 2;
        const cy = py + ph / 2;
        const letra = letraPieza(idx);
        const etiqueta = c.pieza.etiquetaVentana;

        return (
          <g key={idx}>
            <rect
              x={f1(px)}
              y={f1(py)}
              width={f1(pw)}
              height={f1(ph)}
              className={c.rotada ? "pieza rotada" : "pieza"}
              fill={c.rotada ? COLOR_PIEZA_FILL_ROTADA : COLOR_PIEZA_FILL}
              stroke={COLOR_PIEZA_STROKE}
              strokeWidth={1.2}
              strokeDasharray={c.rotada ? "4 2" : undefined}
            >
              {/* La etiqueta completa (ventana + material) queda en el tooltip. */}
              <title>
                {letra}: {etiqueta} — {cm(c.anchoCm)}×{cm(c.altoCm)} cm
                {c.rotada ? " (rotada)" : ""}
              </title>
            </rect>
            {/* Identificador corto por letra (A, B, C, ...) bien visible en el centro. */}
            <text
              x={f1(cx)}
              y={f1(cy - 2)}
              className="etq"
              fill={COLOR_ETQ}
              fontSize={16}
              fontWeight={700}
              textAnchor="middle"
            >
              {letra}
            </text>
            {/* Medidas y marca de rotación ("R") si la pieza está rotada */}
            <text
              x={f1(cx)}
              y={f1(cy + 12)}
              className="med"
              fill={COLOR_MED}
              fontSize={10}
              textAnchor="middle"
            >
              {cm(c.anchoCm)}×{cm(c.altoCm)}
              {c.rotada ? " ↻R" : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
