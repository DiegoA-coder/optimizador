// lib/io/reporteDespiece.ts
// Reporte HTML imprimible del despiece por perfil (1D), listo para "Imprimir -> Guardar como PDF".
// Reproduce en una cadena HTML (A4, @media print) el resumen y el mapa de corte 2D que la pantalla
// `/despiece` muestra en vivo, para que el PDF sea fiel a lo que se ve en pantalla.
//
// Reutiliza el dominio existente: cada Perfil es una `Tira` (`@/lib/dominio/tira`), de la que se
// leen piezas, lo usado (`usadoCm`) y el sobrante. No duplica la lógica de acomodo.

import { cm } from "@/lib/dominio/parametros";
import { Tira, usadoCm } from "@/lib/dominio/tira";

/** Datos del despiece que se vuelcan al reporte, ya calculados por la pantalla. */
export interface DatosReporteDespiece {
  tiras: Tira[];
  largoBarraCm: number;
  sierraCm: number;
  totalPiezas: number;
  desperdicioCm: number;
  aprovechamientoPct: number;
}

/** Ancho del dibujo de cada Perfil en el reporte (px) y su alto fijo. */
const ANCHO_PX = 760;
const ALTO_BARRA_PX = 54;

// Paleta alineada con el componente `MapaCortePerfils` para que el PDF se vea igual que la pantalla.
const COLOR_BARRA_FILL = "#ece3cc";
const COLOR_BARRA_STROKE = "#b9ad8a";
const COLOR_SOBRA_FILL = "#f6cccc";
const COLOR_SOBRA_STROKE = "#d89a9a";
const COLOR_PIEZA_STROKE = "#2f6ca3";

function colorPieza(indice: number): string {
  const colores = ["#cfe3f7", "#d6f0d6", "#f7e6c8", "#e6d6f0", "#f7d6e0", "#d6f0ee", "#e8ecc8"];
  return colores[indice % colores.length];
}

/** Formatea a 1 decimal con punto, igual que el resto de reportes. */
function f1(valor: number): string {
  return valor.toFixed(1);
}

/** Escapa los caracteres especiales de HTML. */
function esc(valor: string): string {
  return valor.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Dibuja una Perfil y sus cortes a escala en SVG, con el sobrante resaltado al final.
 * La posición inicial de cada corte se acumula sumando longitud + sierra, igual que el consumo
 * real de la tira, de modo que el dibujo coincide con el modelo de capacidad.
 */
function barraSvg(tira: Tira, largoBarraCm: number, sierraCm: number): string {
  const escala = ANCHO_PX / largoBarraCm; // px por cm
  const anchoPx = largoBarraCm * escala;
  const usado = usadoCm(tira);

  const svg: string[] = [];
  svg.push(
    `<svg class="mapa" width="${f1(anchoPx)}" height="${ALTO_BARRA_PX}" viewBox="0 0 ${f1(
      anchoPx,
    )} ${ALTO_BARRA_PX}">\n`,
  );
  svg.push(
    `<rect x="0" y="0" width="${f1(anchoPx)}" height="${ALTO_BARRA_PX}" fill="${COLOR_BARRA_FILL}" stroke="${COLOR_BARRA_STROKE}" stroke-width="1"/>\n`,
  );

  let inicioCm = 0;
  tira.piezas.forEach((pieza, idx) => {
    const x = inicioCm * escala;
    const w = pieza.longitudCm * escala;
    const cx = x + w / 2;
    inicioCm += pieza.longitudCm + sierraCm;
    svg.push(
      `<rect x="${f1(x)}" y="4" width="${f1(Math.max(w, 1))}" height="${ALTO_BARRA_PX - 8}" fill="${colorPieza(
        idx,
      )}" stroke="${COLOR_PIEZA_STROKE}" stroke-width="1"/>\n`,
    );
    if (w > 34) {
      svg.push(
        `<text x="${f1(cx)}" y="${ALTO_BARRA_PX / 2 - 2}" class="etq">${esc(
          pieza.etiquetaVentana || "Pieza",
        )}</text>\n`,
      );
      svg.push(`<text x="${f1(cx)}" y="${ALTO_BARRA_PX / 2 + 12}" class="med">${cm(pieza.longitudCm)} cm</text>\n`);
    }
  });

  if (largoBarraCm - usado > 0.05) {
    const xs = usado * escala;
    const ws = (largoBarraCm - usado) * escala;
    svg.push(
      `<rect x="${f1(xs)}" y="4" width="${f1(ws)}" height="${ALTO_BARRA_PX - 8}" fill="${COLOR_SOBRA_FILL}" stroke="${COLOR_SOBRA_STROKE}" stroke-width="1"/>\n`,
    );
    if (ws > 34) {
      svg.push(
        `<text x="${f1(xs + ws / 2)}" y="${ALTO_BARRA_PX / 2 + 4}" class="sobra-txt">sobra ${cm(
          tira.restanteCm,
        )} cm</text>\n`,
      );
    }
  }
  svg.push("</svg>\n");
  return svg.join("");
}

/** Genera el HTML completo e imprimible (A4) del despiece a partir de los datos de la pantalla. */
export function generarHtmlDespiece(d: DatosReporteDespiece): string {
  const h: string[] = [];
  h.push('<!DOCTYPE html>\n<html lang="es">\n<head>\n');
  h.push('<meta charset="UTF-8">\n');
  h.push("<title>Despiece por perfil</title>\n");
  h.push("<style>\n", estilos(), "</style>\n");
  h.push("</head>\n<body>\n");

  h.push("<h1>Despiece por perfil</h1>\n");
  h.push(
    '<p class="meta">Barra: <strong>',
    cm(d.largoBarraCm),
    " cm</strong> &nbsp;|&nbsp; Sierra (kerf): <strong>",
    cm(d.sierraCm),
    " cm</strong></p>\n",
  );

  h.push('<div class="resumen">');
  h.push("<span>Barras: <strong>", String(d.tiras.length), "</strong></span>");
  h.push("<span>Piezas: <strong>", String(d.totalPiezas), "</strong></span>");
  h.push("<span>Desperdicio: <strong>", cm(d.desperdicioCm), " cm</strong></span>");
  h.push("<span>Aprovechamiento: <strong>", cm(d.aprovechamientoPct), "%</strong></span>");
  h.push("</div>\n");

  h.push('<h2>Mapa de corte 2D</h2>\n');
  d.tiras.forEach((tira, i) => {
    h.push(
      '<div class="barra">\n<h3>Barra ',
      String(i + 1),
      " <small>(usado ",
      cm(usadoCm(tira)),
      " cm · sobrante ",
      cm(tira.restanteCm),
      " cm)</small></h3>\n",
    );
    h.push(barraSvg(tira, d.largoBarraCm, d.sierraCm));
    h.push("</div>\n");
  });

  h.push('<p class="pie">Generado por el Optimizador de Corte.</p>\n');
  h.push("</body>\n</html>\n");
  return h.join("");
}

/** Hoja de estilos del reporte, con reglas de impresión para A4 (@page / @media print). */
function estilos(): string {
  return `* { box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; margin: 24px; font-size: 13px; }
h1 { font-size: 22px; margin: 0 0 4px; }
h2 { font-size: 17px; margin: 22px 0 8px; border-bottom: 2px solid #333; padding-bottom: 4px; }
h3 { font-size: 13px; margin: 14px 0 4px; }
small { font-weight: normal; color: #666; font-size: 0.8em; }
.meta { color: #444; margin: 0 0 12px; }
.resumen { display: flex; gap: 28px; background: #f2f4f7; border: 1px solid #d7dbe0;
           border-radius: 6px; padding: 10px 16px; margin-bottom: 10px; }
.barra { margin-bottom: 10px; }
.mapa { border: 1px solid #ccc; background: #fafafa; width: 100%; height: auto; display: block; }
.mapa .etq { font: bold 11px Arial; fill: #0f2f44; text-anchor: middle; }
.mapa .med { font: 10px Arial; fill: #1a1a1a; text-anchor: middle; }
.mapa .sobra-txt { font: 10px Arial; fill: #8a2b2b; text-anchor: middle; }
.pie { margin-top: 24px; color: #999; font-size: 11px; }
@media print {
  body { margin: 0; }
  @page { size: A4; margin: 14mm; }
  h2, h3 { page-break-after: avoid; }
  .barra { page-break-inside: avoid; }
}
`;
}
