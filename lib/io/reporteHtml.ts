// lib/io/reporteHtml.ts
// Reporte HTML imprimible (listo para "Imprimir -> Guardar como PDF"), con estilos para A4
// y total usado / sobrante por cada tira, incluyendo el esquema de corte de vidrio en SVG.
// Porta la clase `reporte.ReporteHtml` del proyecto Java para garantizar paridad visual y de
// estructura. TypeScript puro, sin React: `generarHtml` devuelve una cadena HTML.

import { cm } from "@/lib/dominio/parametros";
import {
  ResultadoCompleto,
  Panel,
  PiezaColocada,
} from "@/lib/dominio/modelos";
import {
  PlanCorte,
  materialesDe,
  tirasDePerfil,
  desperdicioDePerfil,
} from "@/lib/dominio/planCorte";
import {
  PlanVidrio,
  totalPaneles,
  totalPiezas,
  aprovechamientoPct,
} from "@/lib/dominio/planVidrio";
import { Tira, usadoCm } from "@/lib/dominio/tira";
import { agruparPorVentana } from "@/lib/dominio/cortesPorVentana";
import { areaDesperdicioCm2 } from "@/lib/dominio/modelos";
import {
  ParametrosVidrio,
  piezasPorVentana,
} from "@/lib/dominio/parametrosVidrio";

/**
 * Genera el reporte HTML completo e imprimible en A4 a partir del resultado del pipeline.
 * Reproduce la estructura, los estilos y el esquema SVG del `ReporteHtml` Java.
 */
export function generarHtml(r: ResultadoCompleto): string {
  const plan: PlanCorte = r.planCorte;
  const planVidrio: PlanVidrio = r.planVidrio;
  const p = plan.parametros;

  const h: string[] = [];
  h.push('<!DOCTYPE html>\n<html lang="es">\n<head>\n');
  h.push('<meta charset="UTF-8">\n');
  h.push("<title>Plan de corte de aluminio</title>\n");
  h.push("<style>\n", estilos(), "</style>\n");
  h.push("</head>\n<body>\n");

  h.push("<h1>Plan de corte de aluminio</h1>\n");
  h.push(
    '<p class="meta">Tira: <strong>',
    cm(p.largoTiraCm),
    " cm</strong> &nbsp;|&nbsp; Sierra (kerf): <strong>",
    cm(p.sierraCm),
    " cm</strong></p>\n",
  );

  h.push('<div class="resumen">');
  h.push("<span>Total de tiras: <strong>", String(plan.totalTiras), "</strong></span>");
  h.push("<span>Desperdicio aluminio: <strong>", cm(plan.desperdicioTotal), " cm</strong></span>");
  h.push("<span>Paneles de vidrio: <strong>", String(totalPaneles(planVidrio)), "</strong></span>");
  h.push("<span>Aprovechamiento vidrio: <strong>", cm(aprovechamientoPct(planVidrio)), "%</strong></span>");
  h.push("</div>\n");

  // ---- Tiras por perfil y material ----
  for (const perfil of plan.perfiles) {
    h.push(
      "<h2>Perfil ",
      esc(perfil),
      ' <small>(',
      String(tirasDePerfil(plan, perfil)),
      " tira(s), desperdicio ",
      cm(desperdicioDePerfil(plan, perfil)),
      " cm)</small></h2>\n",
    );

    h.push(
      '<table>\n<thead><tr>',
      "<th>Material</th><th>Tira</th><th>Cortes (cm)</th>",
      '<th class="num">Total usado (cm)</th><th class="num">Sobrante (cm)</th>',
      "</tr></thead>\n<tbody>\n",
    );

    const porMaterial = materialesDe(plan, perfil);
    if (porMaterial !== undefined) {
      for (const [material, tiras] of porMaterial) {
        for (let i = 0; i < tiras.length; i++) {
          const tira = tiras[i];
          const cortes = tira.piezas
            .map(
              (pz) =>
                `${cm(pz.longitudCm)} <span class="win">(${esc(pz.etiquetaVentana)})</span>`,
            )
            .join(" + ");
          h.push(
            "<tr>",
            "<td>",
            esc(material),
            "</td>",
            '<td class="num">',
            String(i + 1),
            "</td>",
            "<td>",
            cortes,
            "</td>",
            '<td class="num">',
            cm(usadoCm(tira)),
            "</td>",
            '<td class="num">',
            cm(tira.restanteCm),
            "</td>",
            "</tr>\n",
          );
        }
      }
    }
    h.push("</tbody>\n</table>\n");

    // ---- Mapa de corte visual por barra (una fila por tira, con colores) ----
    if (porMaterial !== undefined) {
      for (const [material, tiras] of porMaterial) {
        h.push('<p class="barra-material">', esc(material), " — ", String(tiras.length), " barra(s)</p>\n");
        tiras.forEach((tira, i) => {
          h.push(
            '<p class="barra-cap">Perfil ',
            String(i + 1),
            " — usado ",
            cm(usadoCm(tira)),
            " cm · sobrante ",
            cm(tira.restanteCm),
            " cm</p>\n",
            barraSvg(tira, p.largoTiraCm, p.sierraCm),
          );
        });
      }
    }
  }


  // ---- Vidrio: tabla de paneles + esquema de corte visual ----
  agregarVidrio(h, planVidrio);

  h.push('<p class="pie">Generado por OptimizadorCorteAluminio.</p>\n');
  h.push("</body>\n</html>\n");
  return h.join("");
}

/** Añade la sección de vidrio: resumen, paneles con esquema SVG y detalle textual. */
function agregarVidrio(h: string[], plan: PlanVidrio): void {
  const p = plan.parametros;
  h.push('<h2 class="page-break">Vidrio</h2>\n');
  h.push(
    '<p class="meta">Panel: <strong>',
    cm(p.panelAnchoCm),
    " &times; ",
    cm(p.panelAltoCm),
    " cm</strong> &nbsp;|&nbsp; Rotación: <strong>",
    p.permitirRotacion ? "sí" : "no",
    "</strong> &nbsp;|&nbsp; Piezas por ventana: <strong>",
    String(piezasPorVentana(p)),
    "</strong></p>\n",
  );
  h.push(
    '<div class="resumen">',
    "<span>Paneles necesarios: <strong>",
    String(totalPaneles(plan)),
    "</strong></span>",
    "<span>Piezas de vidrio: <strong>",
    String(totalPiezas(plan)),
    "</strong></span>",
    "<span>Aprovechamiento: <strong>",
    cm(aprovechamientoPct(plan)),
    "%</strong></span>",
    "</div>\n",
  );

  const paneles = plan.paneles;
  for (let i = 0; i < paneles.length; i++) {
    const panel = paneles[i];
    h.push(
      "<h3>Panel ",
      String(i + 1),
      " <small>(",
      String(panel.piezas.length),
      " pieza(s), recorte ",
      cm(areaDesperdicioCm2(panel)),
      " cm²)</small></h3>\n",
    );
    // Esquema de corte a escala
    h.push(esquemaSvg(panel, p));
    // Detalle textual de las piezas del panel
    h.push(
      '<table>\n<thead><tr><th>Ventana</th><th class="num">Ancho (cm)</th>',
      '<th class="num">Alto (cm)</th><th>Rotada</th><th>Posición (x, y)</th></tr></thead>\n<tbody>\n',
    );
    for (const c of panel.piezas) {
      h.push(
        "<tr>",
        "<td>",
        esc(c.pieza.etiquetaVentana),
        "</td>",
        '<td class="num">',
        cm(c.anchoCm),
        "</td>",
        '<td class="num">',
        cm(c.altoCm),
        "</td>",
        "<td>",
        c.rotada ? "sí" : "no",
        "</td>",
        "<td>(",
        cm(c.xCm),
        ", ",
        cm(c.yCm),
        ")</td>",
        "</tr>\n",
      );
    }
    h.push("</tbody>\n</table>\n");
  }
}

/**
 * Dibuja el panel y sus piezas a escala en SVG. El eje Y del panel (origen abajo) se invierte
 * para el SVG (origen arriba), de modo que el dibujo coincide con la orientación física:
 *   ySvg = altoPanelPx - (yCm * escala) - altoPiezaPx
 */
function esquemaSvg(panel: Panel, p: ParametrosVidrio): string {
  const escala = 360.0 / Math.max(p.panelAnchoCm, p.panelAltoCm); // px por cm
  const w = p.panelAnchoCm * escala;
  const alto = p.panelAltoCm * escala;

  const svg: string[] = [];
  svg.push(
    `<svg class="esquema" width="${f1(w)}" height="${f1(alto)}" viewBox="0 0 ${f1(w)} ${f1(alto)}">\n`,
  );
  // Fondo del panel (zona de recorte)
  svg.push(`<rect x="0" y="0" width="${f1(w)}" height="${f1(alto)}" class="panel"/>\n`);

  let idx = 1;
  for (const c of panel.piezas as readonly PiezaColocada[]) {
    const px = c.xCm * escala;
    const pw = c.anchoCm * escala;
    const ph = c.altoCm * escala;
    // Invertir Y: en SVG el origen está arriba.
    const py = alto - c.yCm * escala - ph;
    svg.push(
      `<rect x="${f1(px)}" y="${f1(py)}" width="${f1(pw)}" height="${f1(ph)}" class="pieza"/>\n`,
    );
    svg.push(
      `<text x="${f1(px + pw / 2)}" y="${f1(py + ph / 2 - 4)}" class="etq">${idx}</text>\n`,
    );
    svg.push(
      `<text x="${f1(px + pw / 2)}" y="${f1(py + ph / 2 + 10)}" class="med">${cm(c.anchoCm)}&times;${cm(
        c.altoCm,
      )}${c.rotada ? " R" : ""}</text>\n`,
    );
    idx++;
  }
  svg.push("</svg>\n");
  return svg.join("");
}

/** Ancho del dibujo de cada barra de aluminio en el reporte (px) y su alto fijo. */
const BARRA_ANCHO_PX = 760;
const BARRA_ALTO_PX = 54;

/** Tono de relleno de cada corte, igual que `MapaCorteBarras`/`reporteDespiece` para coherencia. */
function colorPieza(indice: number): string {
  const colores = ["#cfe3f7", "#d6f0d6", "#f7e6c8", "#e6d6f0", "#f7d6e0", "#d6f0ee", "#e8ecc8"];
  return colores[indice % colores.length];
}

/**
 * Dibuja una tira (barra de aluminio) a escala en SVG: sus cortes de izquierda a derecha con
 * colores y el sobrante marcado al final. Reproduce el mapa de la pantalla (MapaCorteBarras) para
 * que el PDF coincida con lo que se ve.
 */
function barraSvg(tira: Tira, largoBarraCm: number, sierraCm: number): string {
  const escala = BARRA_ANCHO_PX / largoBarraCm; // px por cm
  const svg: string[] = [];
  svg.push(
    `<svg class="barra" width="${BARRA_ANCHO_PX}" height="${BARRA_ALTO_PX}" viewBox="0 0 ${BARRA_ANCHO_PX} ${BARRA_ALTO_PX}">\n`,
  );
  // Fondo de la barra (largo nominal completo).
  svg.push(
    `<rect x="0" y="0" width="${f1(largoBarraCm * escala)}" height="${BARRA_ALTO_PX}" class="barra-fondo"/>\n`,
  );

  // Cortes acumulando longitud + sierra, igual que el consumo real de la tira.
  let xCm = 0;
  tira.piezas.forEach((pz, idx) => {
    const x = xCm * escala;
    const w = pz.longitudCm * escala;
    const cx = x + w / 2;
    svg.push(
      `<rect x="${f1(x)}" y="4" width="${f1(Math.max(w, 1))}" height="${BARRA_ALTO_PX - 8}" ` +
        `class="barra-pieza" fill="${colorPieza(idx)}"/>\n`,
      `<text x="${f1(cx)}" y="${BARRA_ALTO_PX / 2 - 2}" class="barra-etq">${esc(
        pz.etiquetaVentana || "Pieza",
      )}</text>\n`,
      `<text x="${f1(cx)}" y="${BARRA_ALTO_PX / 2 + 12}" class="barra-med">${cm(pz.longitudCm)} cm</text>\n`,
    );
    xCm += pz.longitudCm + sierraCm;
  });

  // Sobrante al final de la barra (si queda espacio).
  const usadoConSierra = tira.piezas.reduce((acc, pz) => acc + pz.longitudCm + sierraCm, 0);
  const sobranteCm = Math.max(largoBarraCm - usadoConSierra, 0);
  if (sobranteCm > 0) {
    const x = usadoConSierra * escala;
    const w = sobranteCm * escala;
    svg.push(
      `<rect x="${f1(x)}" y="4" width="${f1(w)}" height="${BARRA_ALTO_PX - 8}" class="barra-sobra"/>\n`,
      `<text x="${f1(x + w / 2)}" y="${BARRA_ALTO_PX / 2 + 4}" class="barra-sobra-txt">${cm(
        tira.restanteCm,
      )} cm</text>\n`,
    );
  }

  svg.push("</svg>\n");
  return svg.join("");
}

/** Formatea un número a 1 decimal con punto (equivale a String.format(Locale.US, "%.1f", v)). */
function f1(valor: number): string {
  return valor.toFixed(1);
}

/** Escapa los caracteres especiales de HTML en el mismo orden que el `esc` del Java. */
function esc(valor: string): string {
  return valor.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Hoja de estilos del reporte, con reglas de impresión para A4 (@page / @media print). */
function estilos(): string {
  return `* { box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; margin: 24px; font-size: 13px; }
h1 { font-size: 22px; margin: 0 0 4px; }
h2 { font-size: 17px; margin: 22px 0 8px; border-bottom: 2px solid #333; padding-bottom: 4px; }
h3 { font-size: 14px; margin: 14px 0 6px; }
small { font-weight: normal; color: #666; font-size: 0.8em; }
.meta { color: #444; margin: 0 0 12px; }
.resumen { display: flex; gap: 28px; background: #f2f4f7; border: 1px solid #d7dbe0;
           border-radius: 6px; padding: 10px 16px; margin-bottom: 10px; }
table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
th, td { border: 1px solid #cfd4da; padding: 6px 9px; text-align: left; vertical-align: top; }
th { background: #e9edf2; }
td.num, th.num { text-align: right; white-space: nowrap; }
tbody tr:nth-child(even) { background: #f7f9fb; }
.win { color: #777; font-size: 0.85em; }
.pie { margin-top: 24px; color: #999; font-size: 11px; }
.esquema { border: 1px solid #999; margin: 6px 0 12px; background: #fafafa; }
.esquema .panel { fill: #f0e9d8; stroke: #b9ad8a; stroke-width: 1; }
.esquema .pieza { fill: #cfe3f7; stroke: #2f6ca3; stroke-width: 1.2; }
.esquema .etq { font: bold 12px Arial; fill: #14425f; text-anchor: middle; }
.esquema .med { font: 10px Arial; fill: #333; text-anchor: middle; }
.barra-material { margin: 10px 0 2px; font-weight: bold; font-size: 0.9em; color: #444; }
.barra-cap { margin: 4px 0 2px; font-size: 0.82em; color: #555; }
.barra { width: 100%; height: auto; border: 1px solid #ccc; border-radius: 4px;
         background: #fafafa; margin-bottom: 8px; }
.barra .barra-fondo { fill: #ece3cc; stroke: #b9ad8a; stroke-width: 1; }
.barra .barra-pieza { stroke: #2f6ca3; stroke-width: 1; }
.barra .barra-sobra { fill: #f6cccc; stroke: #d89a9a; stroke-width: 1; }
.barra .barra-etq { font: bold 11px Arial; fill: #0f2f44; text-anchor: middle; }
.barra .barra-med { font: 10px Arial; fill: #1a1a1a; text-anchor: middle; }
.barra .barra-sobra-txt { font: 10px Arial; fill: #8a2b2b; text-anchor: middle; }
@media print {
  body { margin: 0; }
  @page { size: A4; margin: 14mm; }
  h2, h3 { page-break-after: avoid; }
  tr { page-break-inside: avoid; }
  .page-break { page-break-before: always; }
}
`;
}
