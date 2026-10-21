// lib/io/reporteJson.ts
// Genera el reporte JSON con cinco secciones: resumen global, descripcion (por perfil),
// perfiles (detalle de cortes por tira con utilizado/sobrante), ventanas (cortes por ventana)
// y vidrio (paneles con sus piezas y posiciones).
// Porta la clase `reporte.ReporteJson` del proyecto Java para garantizar paridad de salida.
// TypeScript puro, sin React.

import { cm } from "../dominio/parametros";
import { tirasNumeradas } from "../dominio/planCorte";
import { desperdicioDePerfil } from "../dominio/planCorte";
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

/** Escapa comillas y barras invertidas para incrustar un valor en una cadena JSON. */
function esc(valor: string): string {
  return valor.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Maneja la sangría del JSON (2 espacios por nivel). Porta la clase interna `Sangria`. */
class Sangria {
  private nivel = 0;
  mas(): void {
    this.nivel++;
  }
  menos(): void {
    this.nivel--;
  }
  toString(): string {
    return "  ".repeat(this.nivel);
  }
}

/**
 * Genera el reporte completo en formato JSON como una cadena.
 * Porta `ReporteJson.generar(plan, piezas, planVidrio)`.
 */
export function generarJson(r: ResultadoCompleto): string {
  const plan = r.planCorte;
  const piezas = r.piezas;
  const planVidrio = r.planVidrio;

  const p = plan.parametros;
  const perfiles = plan.perfiles;
  const s = new Sangria();
  let sb = "";
  sb += "{\n";

  // ---- resumen global ----
  s.mas();
  sb += `${s}"resumen": {\n`;
  s.mas();
  sb += `${s}"largoTiraCm": ${cm(p.largoTiraCm)},\n`;
  sb += `${s}"sierraCm": ${cm(p.sierraCm)},\n`;
  sb += `${s}"totalTiras": ${plan.totalTiras},\n`;
  sb += `${s}"desperdicioTotalCm": ${cm(plan.desperdicioTotal)}\n`;
  s.menos();
  sb += `${s}},\n`;

  // ---- descripcion: resumen por perfil ----
  sb += `${s}"descripcion": [\n`;
  s.mas();
  for (let i = 0; i < perfiles.length; i++) {
    const perfil = perfiles[i];
    const tiras = tirasNumeradas(plan, perfil);

    sb += `${s}{\n`;
    s.mas();
    sb += `${s}"perfil": "${esc(perfil)}",\n`;
    sb += `${s}"totalTiras": ${tiras.length},\n`;
    sb += `${s}"desperdicioTotalCm": ${cm(desperdicioDePerfil(plan, perfil))},\n`;
    sb += `${s}"tiraInfo": [\n`;
    s.mas();
    for (let t = 0; t < tiras.length; t++) {
      const tn = tiras[t];
      sb +=
        `${s}{ "tira": ${tn.numero}` +
        `, "material": "${esc(tn.material)}"` +
        `, "utilizadoCm": ${cm(tiraUsadoCm(tn.tira))}` +
        `, "desperdicioCm": ${cm(tiraRestanteCm(tn.tira))} }` +
        (t < tiras.length - 1 ? ",\n" : "\n");
    }
    s.menos();
    sb += `${s}]\n`;
    s.menos();
    sb += `${s}${i < perfiles.length - 1 ? "},\n" : "}\n"}`;
  }
  s.menos();
  sb += `${s}],\n`;

  // ---- perfiles: detalle de cortes por tira ----
  sb += `${s}"perfiles": [\n`;
  s.mas();
  for (let i = 0; i < perfiles.length; i++) {
    const perfil = perfiles[i];
    const tiras = tirasNumeradas(plan, perfil);

    sb += `${s}{\n`;
    s.mas();
    sb += `${s}"nombre": "${esc(perfil)}",\n`;
    sb += `${s}"cortes": [\n`;
    s.mas();
    for (let t = 0; t < tiras.length; t++) {
      const tn = tiras[t];
      const tira = tn.tira;
      const cortes = tira.piezas.map((pz) => cm(pz.longitudCm)).join(", ");
      const ventanas = tira.piezas.map((pz) => `"${esc(pz.etiquetaVentana)}"`).join(", ");
      sb += `${s}{\n`;
      s.mas();
      sb += `${s}"tira": ${tn.numero},\n`;
      sb += `${s}"material": "${esc(tn.material)}",\n`;
      sb += `${s}"cortes": [${cortes}],\n`;
      sb += `${s}"ventanas": [${ventanas}],\n`;
      sb += `${s}"utilizadoCm": ${cm(tiraUsadoCm(tira))},\n`;
      sb += `${s}"sobranteCm": ${cm(tiraRestanteCm(tira))}\n`;
      s.menos();
      sb += `${s}${t < tiras.length - 1 ? "},\n" : "}\n"}`;
    }
    s.menos();
    sb += `${s}]\n`;
    s.menos();
    sb += `${s}${i < perfiles.length - 1 ? "},\n" : "}\n"}`;
  }
  s.menos();
  sb += `${s}],\n`;

  // ---- ventanas: cortes agrupados por ventana ----
  const ventanas = agruparPorVentana(piezas);
  sb += `${s}"ventanas": [\n`;
  s.mas();
  for (let v = 0; v < ventanas.length; v++) {
    const vt = ventanas[v];
    sb += `${s}{\n`;
    s.mas();
    sb += `${s}"ventana": "${esc(vt.etiqueta)}",\n`;
    sb += `${s}"perfil": "${esc(vt.perfil)}",\n`;
    sb += `${s}"totalPiezas": ${vt.totalPiezas},\n`;
    sb += `${s}"cortes": [\n`;
    s.mas();
    const materiales = Object.keys(vt.porMaterial);
    for (let m = 0; m < materiales.length; m++) {
      const material = materiales[m];
      const piezasStr = vt.porMaterial[material]
        .map((a) => `{ "longitudCm": ${cm(a.longitudCm)}, "cantidad": ${a.cantidad} }`)
        .join(", ");
      sb +=
        `${s}{ "material": "${esc(material)}", ` +
        `"piezas": [${piezasStr}] }` +
        (m < materiales.length - 1 ? ",\n" : "\n");
    }
    s.menos();
    sb += `${s}]\n`;
    s.menos();
    sb += `${s}${v < ventanas.length - 1 ? "},\n" : "}\n"}`;
  }
  s.menos();
  sb += `${s}],\n`;

  // ---- vidrio: paneles con sus piezas y posiciones (esquema de corte) ----
  sb += escribirVidrio(s, planVidrio);

  sb += "}\n";
  return sb;
}

/** Escribe la sección de vidrio. Porta `ReporteJson.escribirVidrio`. */
function escribirVidrio(s: Sangria, plan: PlanVidrio): string {
  const p = plan.parametros;
  let sb = "";
  sb += `${s}"vidrio": {\n`;
  s.mas();
  sb += `${s}"panelAnchoCm": ${cm(p.panelAnchoCm)},\n`;
  sb += `${s}"panelAltoCm": ${cm(p.panelAltoCm)},\n`;
  sb += `${s}"piezasPorVentana": ${piezasPorVentana(p)},\n`;
  sb += `${s}"permitirRotacion": ${p.permitirRotacion},\n`;
  sb += `${s}"totalPaneles": ${totalPaneles(plan)},\n`;
  sb += `${s}"totalPiezas": ${totalPiezas(plan)},\n`;
  sb += `${s}"aprovechamientoPct": ${cm(aprovechamientoPct(plan))},\n`;
  sb += `${s}"paneles": [\n`;
  s.mas();
  const paneles = plan.paneles;
  for (let i = 0; i < paneles.length; i++) {
    const panel = paneles[i];
    sb += `${s}{\n`;
    s.mas();
    sb += `${s}"numero": ${i + 1},\n`;
    sb += `${s}"utilizadoCm2": ${cm(areaUtilizadaCm2(panel))},\n`;
    sb += `${s}"recorteCm2": ${cm(areaDesperdicioCm2(panel))},\n`;
    sb += `${s}"piezas": [\n`;
    s.mas();
    const colocadas = panel.piezas;
    for (let j = 0; j < colocadas.length; j++) {
      const c = colocadas[j];
      sb +=
        `${s}{ "ventana": "${esc(c.pieza.etiquetaVentana)}"` +
        `, "anchoCm": ${cm(c.anchoCm)}` +
        `, "altoCm": ${cm(c.altoCm)}` +
        `, "xCm": ${cm(c.xCm)}` +
        `, "yCm": ${cm(c.yCm)}` +
        `, "rotada": ${c.rotada} }` +
        (j < colocadas.length - 1 ? ",\n" : "\n");
    }
    s.menos();
    sb += `${s}]\n`;
    s.menos();
    sb += `${s}${i < paneles.length - 1 ? "},\n" : "}\n"}`;
  }
  s.menos();
  sb += `${s}]\n`;
  s.menos();
  sb += `${s}}\n`;
  return sb;
}
