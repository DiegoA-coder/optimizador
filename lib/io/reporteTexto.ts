// lib/io/reporteTexto.ts
// Genera el reporte legible en texto plano (consola y archivo .txt), con total usado y
// sobrante por tira, cortes por ventana y el detalle del plan de vidrio.
// Porta la clase `reporte.ReporteTexto` del proyecto Java para garantizar paridad de salida.
// TypeScript puro, sin React.

import { cm } from "../dominio/parametros";
import {
  tirasDePerfil,
  desperdicioDePerfil,
  materialesDe,
} from "../dominio/planCorte";
import {
  totalPaneles,
  totalPiezas,
  aprovechamientoPct,
  type PlanVidrio,
} from "../dominio/planVidrio";
import { agruparPorVentana } from "../dominio/cortesPorVentana";
import { piezasPorVentana } from "../dominio/parametrosVidrio";
import { usadoCm as tiraUsadoCm, restanteCm as tiraRestanteCm } from "../dominio/tira";
import {
  areaUtilizadaCm2,
  areaDesperdicioCm2,
  type ResultadoCompleto,
} from "../dominio/modelos";

/** Alinea a la izquierda rellenando con espacios hasta `ancho`. Porta el formato `%-16s` de Java. */
function padDerecha(valor: string, ancho: number): string {
  return valor.length >= ancho ? valor : valor + " ".repeat(ancho - valor.length);
}

/**
 * Genera el reporte completo en texto plano como una cadena.
 * Porta `ReporteTexto.generar(plan, piezas, planVidrio)`.
 */
export function generarTexto(r: ResultadoCompleto): string {
  const plan = r.planCorte;
  const piezas = r.piezas;
  const planVidrio = r.planVidrio;

  const p = plan.parametros;
  let sb = "";
  sb += "\n============================================================\n";
  sb += " PLAN DE CORTE DE ALUMINIO\n";
  sb += ` Tira: ${cm(p.largoTiraCm)} cm | Sierra (kerf): ${cm(p.sierraCm)} cm\n`;
  sb += "============================================================\n";

  for (const perfil of plan.perfiles) {
    sb += `\n### PERFIL ${perfil} — ${tirasDePerfil(plan, perfil)} tira(s) | desperdicio: ${cm(
      desperdicioDePerfil(plan, perfil),
    )} cm\n`;

    const porMaterial = materialesDe(plan, perfil);
    if (porMaterial !== undefined) {
      for (const [material, tiras] of porMaterial) {
        sb += `  ■ ${material.toUpperCase()} — ${tiras.length} tira(s)\n`;
        for (let i = 0; i < tiras.length; i++) {
          const tira = tiras[i];
          const cortes = tira.piezas
            .map((pz) => `${cm(pz.longitudCm)} cm (${pz.etiquetaVentana})`)
            .join(" + ");
          sb += `      Tira ${i + 1}: ${cortes}\n`;
          sb += `              total usado: ${cm(tiraUsadoCm(tira))} cm  |  sobrante: ${cm(
            tiraRestanteCm(tira),
          )} cm\n`;
        }
      }
    }
  }

  sb += "\n============================================================\n";
  sb += " CORTES POR VENTANA\n";
  sb += "============================================================\n";
  for (const v of agruparPorVentana(piezas)) {
    sb += `\n● ${v.etiqueta} (${v.perfil}) — ${v.totalPiezas} pieza(s)\n`;
    for (const material of Object.keys(v.porMaterial)) {
      const piezasStr = v.porMaterial[material]
        .map((a) => `${a.cantidad} x ${cm(a.longitudCm)} cm`)
        .join(", ");
      sb += `    ${padDerecha(material + ":", 16)} ${piezasStr}\n`;
    }
  }

  sb += agregarVidrio(planVidrio);

  sb += "\n------------------------------------------------------------\n";
  sb += ` RESUMEN ALUMINIO  |  Total de tiras: ${plan.totalTiras}  |  Desperdicio total: ${cm(
    plan.desperdicioTotal,
  )} cm\n`;
  sb += ` RESUMEN VIDRIO    |  Total de paneles: ${totalPaneles(planVidrio)}  |  Aprovechamiento: ${cm(
    aprovechamientoPct(planVidrio),
  )}%\n`;
  sb += "------------------------------------------------------------\n";
  return sb;
}

/** Escribe la sección de vidrio del reporte de texto. Porta `ReporteTexto.agregarVidrio`. */
function agregarVidrio(plan: PlanVidrio): string {
  const p = plan.parametros;
  let sb = "";
  sb += "\n============================================================\n";
  sb += " VIDRIO\n";
  sb += ` Panel: ${cm(p.panelAnchoCm)} x ${cm(p.panelAltoCm)} cm | Rotación: ${
    p.permitirRotacion ? "sí" : "no"
  } | Piezas por ventana: ${piezasPorVentana(p)}\n`;
  sb += "============================================================\n";
  sb += ` Paneles necesarios: ${totalPaneles(plan)}  |  Piezas: ${totalPiezas(
    plan,
  )}  |  Aprovechamiento: ${cm(aprovechamientoPct(plan))}%\n`;

  const paneles = plan.paneles;
  for (let i = 0; i < paneles.length; i++) {
    const panel = paneles[i];
    sb += `\n  ■ Panel ${i + 1} — ${panel.piezas.length} pieza(s) | utilizado: ${cm(
      areaUtilizadaCm2(panel),
    )} cm² | recorte: ${cm(areaDesperdicioCm2(panel))} cm²\n`;
    for (const c of panel.piezas) {
      sb += `      ${cm(c.anchoCm)} x ${cm(c.altoCm)} cm${
        c.rotada ? " [rotada]" : ""
      }  (${c.pieza.etiquetaVentana})  @ x=${cm(c.xCm)} y=${cm(c.yCm)}\n`;
    }
  }
  return sb;
}
