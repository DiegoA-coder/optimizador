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
import { usadoCm } from "@/lib/dominio/tira";
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
  }

  // ---- Cortes por ventana ----
  h.push('<h2 class="page-break">Cortes por ventana</h2>\n');
  for (const vt of agruparPorVentana(r.piezas)) {
    h.push(
      "<h3>",
      esc(vt.etiqueta),
      " <small>(",
      esc(vt.perfil),
      ", ",
      String(vt.totalPiezas),
      " pieza(s))</small></h3>\n",
    );
    h.push("<table>\n<thead><tr><th>Material</th><th>Piezas</th></tr></thead>\n<tbody>\n");
    for (const material of Object.keys(vt.porMaterial)) {
      const piezasStr = vt.porMaterial[material]
        .map((a) => `${a.cantidad} &times; ${cm(a.longitudCm)} cm`)
        .join(", ");
      h.push("<tr><td>", esc(material), "</td>", "<td>", piezasStr, "</td></tr>\n");
    }
    h.push("</tbody>\n</table>\n");
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
@media print {
  body { margin: 0; }
  @page { size: A4; margin: 14mm; }
  h2, h3 { page-break-after: avoid; }
  tr { page-break-inside: avoid; }
  .page-break { page-break-before: always; }
}
`;
}
