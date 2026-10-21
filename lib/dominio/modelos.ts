// lib/dominio/modelos.ts
// Tipos del dominio (modelo + configuración + resultado) en TypeScript puro, sin React.
// Portan los records/clases de los paquetes `modelo` e `io` del proyecto Java,
// con validaciones equivalentes a los compact constructors y funciones derivadas.

import { EPSILON, Parametros, cm, truncar, redondear } from "./parametros";
import { ParametrosVidrio } from "./parametrosVidrio";
// Importación SOLO de tipo: se borra en compilación, por lo que el ciclo
// modelos → planCorte → tira → modelos no existe en tiempo de ejecución.
import type { PlanCorte } from "./planCorte";
// Igual que `PlanCorte`: `import type` evita el ciclo en tiempo de ejecución
// (planVidrio → modelos → planVidrio).
import type { PlanVidrio } from "./planVidrio";

// --- Medida -----------------------------------------------------------------

/** Qué medida de la ventana se usa como base de cada pieza. Porta el enum `modelo.Medida`. */
export type Medida = "INFERIOR" | "LATERAL";

// --- Ventana ----------------------------------------------------------------

/**
 * Ventana a despiezar. Las medidas están en centímetros.
 * Porta el record `modelo.Ventana`.
 */
export type Ventana = {
  readonly etiqueta: string;
  readonly perfil: string;
  readonly inferiorCm: number;
  readonly lateralCm: number;
  readonly cantidad: number; // entero > 0
};

/**
 * Crea una ventana validando las invariantes del compact constructor Java.
 * Lanza `Error` con los mensajes exactos del Java.
 */
export function crearVentana(
  etiqueta: string,
  perfil: string,
  inferiorCm: number,
  lateralCm: number,
  cantidad: number,
): Ventana {
  if (etiqueta == null || etiqueta.trim().length === 0) {
    throw new Error("La etiqueta no puede estar vacía");
  }
  if (perfil == null || perfil.trim().length === 0) {
    throw new Error(`Ventana '${etiqueta}': el perfil no puede estar vacío`);
  }
  if (inferiorCm <= 0 || lateralCm <= 0 || cantidad <= 0) {
    throw new Error(`Ventana '${etiqueta}': las medidas y la cantidad deben ser mayores a 0`);
  }
  return { etiqueta, perfil, inferiorCm, lateralCm, cantidad };
}

/** Devuelve la medida indicada de la ventana. Porta `Ventana.medida`. */
export function medidaDe(ventana: Ventana, medida: Medida): number {
  switch (medida) {
    case "INFERIOR":
      return ventana.inferiorCm;
    case "LATERAL":
      return ventana.lateralCm;
  }
}

// --- ReglaCorte -------------------------------------------------------------

/**
 * Regla de despiece: longitud = (medida base - descuento) / divisor, truncada a 1 decimal
 * (hacia abajo, para no cortar de más). Las medidas están en centímetros.
 * Porta el record `modelo.ReglaCorte`.
 */
export type ReglaCorte = {
  readonly material: string;
  readonly cantidad: number; // entero > 0
  readonly base: Medida;
  readonly descuentoCm: number; // >= 0
  readonly divisor: number; // entero > 0
};

/**
 * Crea una regla de corte validando las invariantes del compact constructor Java.
 * Lanza `Error` con los mensajes exactos del Java.
 */
export function crearReglaCorte(
  material: string,
  cantidad: number,
  base: Medida,
  descuentoCm: number,
  divisor: number,
): ReglaCorte {
  if (material == null || material.trim().length === 0) {
    throw new Error("El material no puede estar vacío");
  }
  if (base == null) {
    throw new Error("La base no puede ser nula");
  }
  if (cantidad <= 0 || divisor <= 0 || descuentoCm < 0) {
    throw new Error(`Regla '${material}': cantidad y divisor deben ser > 0, descuentoCm >= 0`);
  }
  return { material, cantidad, base, descuentoCm, divisor };
}

/**
 * Calcula la longitud (cm) de una pieza para la ventana dada, validando contra el largo de tira.
 * Porta `ReglaCorte.longitudPara`.
 * Devuelve `truncar((medidaBase - descuentoCm) / divisor)`.
 * Lanza `Error` si el resultado es `<= 0` (medida inválida) o si excede la tira.
 */
export function longitudPara(regla: ReglaCorte, ventana: Ventana, parametros: Parametros): number {
  const longitud = truncar((medidaDe(ventana, regla.base) - regla.descuentoCm) / regla.divisor);
  if (longitud <= 0) {
    throw new Error(
      `Medida inválida en ventana '${ventana.etiqueta}': ${regla.material} da longitud ${cm(longitud)} cm`,
    );
  }
  if (longitud > parametros.largoTiraCm + EPSILON) {
    throw new Error(
      `Pieza de ${regla.material} en ventana '${ventana.etiqueta}' (${cm(longitud)} cm) excede la tira de ${cm(
        parametros.largoTiraCm,
      )} cm`,
    );
  }
  return longitud;
}

// --- Pieza ------------------------------------------------------------------

/** Una pieza concreta a cortar, con su perfil, material, ventana de origen y longitud en cm. */
export type Pieza = {
  readonly perfil: string;
  readonly material: string;
  readonly etiquetaVentana: string;
  readonly longitudCm: number;
};

// --- PiezaVidrio ------------------------------------------------------------

/**
 * Una pieza de vidrio a cortar, con su medida nominal (ancho x alto en cm) y la ventana de origen.
 * El ancho y el alto son las medidas tal como se piden; el optimizador puede rotarlas al colocarlas.
 * Porta el record `modelo.PiezaVidrio`.
 */
export type PiezaVidrio = {
  readonly etiquetaVentana: string;
  readonly perfil: string;
  readonly anchoCm: number;
  readonly altoCm: number;
};

/**
 * Crea una pieza de vidrio validando las invariantes del compact constructor Java.
 * Lanza `Error` con el mensaje exacto del Java.
 */
export function crearPiezaVidrio(
  etiquetaVentana: string,
  perfil: string,
  anchoCm: number,
  altoCm: number,
): PiezaVidrio {
  if (anchoCm <= 0 || altoCm <= 0) {
    throw new Error(`Pieza de vidrio de '${etiquetaVentana}': ancho y alto deben ser mayores a 0`);
  }
  return { etiquetaVentana, perfil, anchoCm, altoCm };
}

/** Área nominal de la pieza de vidrio (cm²). Porta `PiezaVidrio.areaCm2`. */
export function areaCm2(pieza: PiezaVidrio): number {
  return pieza.anchoCm * pieza.altoCm;
}

// --- PiezaColocada ----------------------------------------------------------

/**
 * Una pieza de vidrio ya ubicada en un panel: posición de su esquina inferior-izquierda (x, y),
 * sus dimensiones efectivas (anchoCm x altoCm, ya con la rotación aplicada) y si fue rotada 90°.
 * El sistema de coordenadas tiene el origen en la esquina inferior-izquierda del panel.
 * Porta el record `modelo.PiezaColocada`.
 */
export type PiezaColocada = {
  readonly pieza: PiezaVidrio;
  readonly xCm: number;
  readonly yCm: number;
  readonly anchoCm: number;
  readonly altoCm: number;
  readonly rotada: boolean;
};

/** Coordenada X del borde derecho de la pieza colocada. Porta `PiezaColocada.xFinCm`. */
export function xFinCm(colocada: PiezaColocada): number {
  return colocada.xCm + colocada.anchoCm;
}

/** Coordenada Y del borde superior de la pieza colocada. Porta `PiezaColocada.yFinCm`. */
export function yFinCm(colocada: PiezaColocada): number {
  return colocada.yCm + colocada.altoCm;
}

// --- Panel ------------------------------------------------------------------

/**
 * Un panel (lámina) de vidrio con las piezas que se cortan de él y su posición.
 * Porta la clase `modelo.Panel`. `anchoCm`/`altoCm` provienen de los parámetros de vidrio.
 */
export type Panel = {
  readonly anchoCm: number;
  readonly altoCm: number;
  readonly piezas: PiezaColocada[];
};

/** Crea un panel vacío a partir de los parámetros de vidrio. */
export function crearPanel(parametros: ParametrosVidrio): Panel {
  return {
    anchoCm: parametros.panelAnchoCm,
    altoCm: parametros.panelAltoCm,
    piezas: [],
  };
}

/** Área de vidrio aprovechada (suma de las piezas colocadas). Porta `Panel.areaUtilizadaCm2`. */
export function areaUtilizadaCm2(panel: Panel): number {
  return redondear(panel.piezas.reduce((acc, p) => acc + p.anchoCm * p.altoCm, 0));
}

/** Área de recorte / desperdicio del panel. Porta `Panel.areaDesperdicioCm2`. */
export function areaDesperdicioCm2(panel: Panel): number {
  return redondear(panel.anchoCm * panel.altoCm - areaUtilizadaCm2(panel));
}

// --- ConfiguracionCorte -----------------------------------------------------

/**
 * Resultado de leer el .env: parámetros de aluminio y vidrio, y las reglas de despiece por perfil.
 * Porta el record `io.ConfiguracionCorte`.
 */
export type ConfiguracionCorte = {
  readonly parametros: Parametros;
  readonly parametrosVidrio: ParametrosVidrio;
  readonly reglasPorPerfil: Record<string, ReglaCorte[]>;
};

// --- ResultadoCompleto ------------------------------------------------------

// El plan de aluminio (`PlanCorte`) y el de vidrio (`PlanVidrio`) se definen en sus propios
// módulos (`planCorte.ts` y `planVidrio.ts`) y se referencian aquí mediante `import type` para
// no crear un ciclo en tiempo de ejecución.

/**
 * Resultado completo del pipeline de optimización: plan de aluminio, despiece plano
 * (para cortes por ventana) y plan de vidrio.
 */
export type ResultadoCompleto = {
  readonly planCorte: PlanCorte;
  readonly piezas: Pieza[];
  readonly planVidrio: PlanVidrio;
};
