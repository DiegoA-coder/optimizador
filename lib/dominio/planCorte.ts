// lib/dominio/planCorte.ts
// Resultado de la planificación de aluminio: tiras agrupadas por perfil y material, con
// utilidades de agregación para que los reportes no repitan la lógica de conteo.
// Porta la clase `dominio.PlanCorte` del proyecto Java. TypeScript puro, sin React.

import { Parametros, redondear } from "./parametros";
import { Tira } from "./tira";

/**
 * Estructura agrupada por perfil → material → tiras, conservando el orden de aparición
 * (los `Map` de JS iteran en orden de inserción, como el `LinkedHashMap` del Java).
 */
export type PorPerfilMaterialTiras = Map<string, Map<string, Tira[]>>;

/** Tira numerada dentro de un perfil, recordando a qué material pertenece. Porta `TiraNumerada`. */
export type TiraNumerada = {
  readonly numero: number;
  readonly material: string;
  readonly tira: Tira;
};

/**
 * Plan de corte de aluminio. Expone las agregaciones precalculadas (`totalTiras`,
 * `desperdicioTotal`, `perfiles`) como propiedades para que los consumidores (pipeline,
 * reportes, UI) las lean directamente, y conserva el mapa agrupado para las consultas por perfil.
 */
export type PlanCorte = {
  readonly parametros: Parametros;
  /** Mapa agrupado perfil → material → tiras, en orden de aparición. */
  readonly porPerfilMaterial: PorPerfilMaterialTiras;
  /** Perfiles en orden de aparición. */
  readonly perfiles: string[];
  /** Número total de tiras del plan (across perfiles y materiales). */
  readonly totalTiras: number;
  /** Desperdicio total (suma de sobrantes), redondeado a 1 decimal. */
  readonly desperdicioTotal: number;
};

/** Mapa material → tiras de un perfil. Porta `PlanCorte.materialesDe`. */
export function materialesDe(plan: PlanCorte, perfil: string): Map<string, Tira[]> | undefined {
  return plan.porPerfilMaterial.get(perfil);
}

/** Número de tiras de un perfil (suma sobre sus materiales). Porta `PlanCorte.tirasDePerfil`. */
export function tirasDePerfil(plan: PlanCorte, perfil: string): number {
  const porMaterial = plan.porPerfilMaterial.get(perfil);
  if (porMaterial === undefined) return 0;
  let total = 0;
  for (const tiras of porMaterial.values()) {
    total += tiras.length;
  }
  return total;
}

/** Desperdicio de un perfil (suma de sobrantes de sus tiras), redondeado. Porta `PlanCorte.desperdicioDePerfil`. */
export function desperdicioDePerfil(plan: PlanCorte, perfil: string): number {
  const porMaterial = plan.porPerfilMaterial.get(perfil);
  if (porMaterial === undefined) return 0;
  let suma = 0;
  for (const tiras of porMaterial.values()) {
    for (const tira of tiras) {
      suma += tira.restanteCm;
    }
  }
  return redondear(suma);
}

/**
 * Numera las tiras de un perfil de forma continua (across materiales) para reportes consistentes.
 * Porta `PlanCorte.tirasNumeradas`.
 */
export function tirasNumeradas(plan: PlanCorte, perfil: string): TiraNumerada[] {
  const numeradas: TiraNumerada[] = [];
  const porMaterial = plan.porPerfilMaterial.get(perfil);
  if (porMaterial === undefined) return numeradas;
  let numero = 1;
  for (const [material, tiras] of porMaterial) {
    for (const tira of tiras) {
      numeradas.push({ numero: numero++, material, tira });
    }
  }
  return numeradas;
}

/**
 * Construye un `PlanCorte` a partir del mapa agrupado perfil → material → tiras, precalculando
 * las agregaciones. Equivale al constructor `PlanCorte(parametros, porPerfilMaterial)` del Java.
 */
export function crearPlanCorte(parametros: Parametros, porPerfilMaterial: PorPerfilMaterialTiras): PlanCorte {
  const perfiles = [...porPerfilMaterial.keys()];

  // Agregaciones calculadas con el MISMO esquema de redondeo que el Java: el desperdicio de cada
  // perfil se redondea, y el total es el redondeo de la suma de esos desperdicios por perfil.
  const base: Pick<PlanCorte, "parametros" | "porPerfilMaterial" | "perfiles"> & {
    totalTiras: number;
    desperdicioTotal: number;
  } = { parametros, porPerfilMaterial, perfiles, totalTiras: 0, desperdicioTotal: 0 };

  let totalTiras = 0;
  let sumaDesperdicioPorPerfil = 0;
  for (const perfil of perfiles) {
    totalTiras += tirasDePerfil(base, perfil);
    sumaDesperdicioPorPerfil += desperdicioDePerfil(base, perfil);
  }

  return {
    parametros,
    porPerfilMaterial,
    perfiles,
    totalTiras,
    desperdicioTotal: redondear(sumaDesperdicioPorPerfil),
  };
}
