// lib/dominio/planVidrio.ts
// Resultado de la optimización de vidrio: los paneles usados y sus agregaciones.
// Porta la clase `dominio.PlanVidrio` del proyecto Java para garantizar paridad numérica.
// TypeScript puro, sin React. Importa de modelos.ts y parametrosVidrio.ts (nunca al revés,
// para evitar dependencias circulares).

import { redondear } from "./parametros";
import { Panel, areaDesperdicioCm2, areaUtilizadaCm2 } from "./modelos";
import { ParametrosVidrio, areaPanelCm2 } from "./parametrosVidrio";

/**
 * Resultado de la optimización de vidrio: los paneles usados y sus agregaciones.
 * Porta el record/clase `dominio.PlanVidrio`.
 */
export type PlanVidrio = {
  readonly parametros: ParametrosVidrio;
  readonly paneles: readonly Panel[];
};

/** Crea un plan de vidrio a partir de los parámetros y los paneles resultantes. */
export function crearPlanVidrio(
  parametros: ParametrosVidrio,
  paneles: readonly Panel[],
): PlanVidrio {
  return { parametros, paneles };
}

/** Número total de paneles usados. Porta `PlanVidrio.totalPaneles`. */
export function totalPaneles(plan: PlanVidrio): number {
  return plan.paneles.length;
}

/** Número total de piezas colocadas en todos los paneles. Porta `PlanVidrio.totalPiezas`. */
export function totalPiezas(plan: PlanVidrio): number {
  return plan.paneles.reduce((acc, p) => acc + p.piezas.length, 0);
}

/** Área de vidrio aprovechada en todos los paneles (cm²). Porta `PlanVidrio.areaUtilizadaCm2`. */
export function areaUtilizadaTotalCm2(plan: PlanVidrio): number {
  return redondear(plan.paneles.reduce((acc, p) => acc + areaUtilizadaCm2(p), 0));
}

/** Área de recorte / desperdicio en todos los paneles (cm²). Porta `PlanVidrio.areaDesperdicioCm2`. */
export function areaDesperdicioTotalCm2(plan: PlanVidrio): number {
  return redondear(plan.paneles.reduce((acc, p) => acc + areaDesperdicioCm2(p), 0));
}

/**
 * Porcentaje de aprovechamiento del vidrio (0-100). Porta `PlanVidrio.aprovechamientoPct`.
 * aprovechamiento = areaUtilizada / (totalPaneles * areaPanel) * 100, redondeado a 1 decimal.
 * Devuelve 0 si no hay paneles (área total <= 0).
 */
export function aprovechamientoPct(plan: PlanVidrio): number {
  const areaTotal = totalPaneles(plan) * areaPanelCm2(plan.parametros);
  if (areaTotal <= 0) return 0;
  return redondear((areaUtilizadaTotalCm2(plan) / areaTotal) * 100.0);
}
