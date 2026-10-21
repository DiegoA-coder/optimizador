// lib/dominio/optimizadorVidrio.ts
// Optimizador de corte 2D para paneles de vidrio. Empaqueta rectángulos en láminas con una
// heurística de guillotina basada en rectángulos libres (Best Area Fit) con rotación opcional.
// Porta `dominio.OptimizadorVidrio` del proyecto Java para garantizar paridad numérica y de orden.
// TypeScript puro, sin React.
//
// No hay desperdicio por sierra (kerf = 0). Las piezas se ordenan de mayor a menor área y se
// colocan en el primer panel donde quepan; si no caben en ninguno, se abre un panel nuevo. El
// resultado conserva las posiciones exactas para poder dibujar el esquema de corte. El sistema de
// coordenadas tiene el origen en la esquina inferior-izquierda del panel.

import { EPSILON, cm } from "./parametros";
import {
  Panel,
  PiezaColocada,
  PiezaVidrio,
  areaCm2,
  crearPanel,
} from "./modelos";
import { ParametrosVidrio } from "./parametrosVidrio";
import { PlanVidrio, crearPlanVidrio } from "./planVidrio";

/** Un hueco rectangular libre dentro del panel. Porta el record interno `Libre`. */
type Libre = {
  readonly x: number;
  readonly y: number;
  readonly ancho: number;
  readonly alto: number;
};

/** Panel en construcción con sus huecos libres y las piezas ya colocadas. */
type PanelEnProgreso = {
  readonly libres: Libre[];
  readonly colocadas: PiezaColocada[];
};

/**
 * Optimiza el corte de vidrio (Algoritmo 5 del diseño). Porta `OptimizadorVidrio.optimizar`:
 * - Ordena las piezas de mayor a menor área (orden descendente estable por `areaCm2`).
 * - Para cada pieza, intenta colocarla en el primer panel que la acepte (Best Area Fit por panel);
 *   `break` al primer panel que la acepta. Si ninguno la acepta, abre un panel nuevo.
 * - Si una pieza no cabe en un panel vacío ni normal ni rotada, lanza `Error` con las medidas de
 *   la pieza y del panel (mismo mensaje que Java).
 */
export function optimizarVidrio(
  piezas: PiezaVidrio[],
  parametros: ParametrosVidrio,
): PlanVidrio {
  // Mayor área primero: mejora el aprovechamiento de la heurística. Orden descendente estable.
  const ordenadas = [...piezas].sort((a, b) => areaCm2(b) - areaCm2(a));

  const enProgreso: PanelEnProgreso[] = [];
  for (const pieza of ordenadas) {
    if (noCabeEnPanel(pieza, parametros)) {
      throw new Error(
        `La pieza de vidrio de '${pieza.etiquetaVentana}' (${cm(pieza.anchoCm)} x ${cm(
          pieza.altoCm,
        )} cm) no cabe en un panel de ${cm(parametros.panelAnchoCm)} x ${cm(
          parametros.panelAltoCm,
        )} cm`,
      );
    }
    let colocada = false;
    for (const panel of enProgreso) {
      if (colocar(panel, pieza, parametros)) {
        colocada = true;
        break;
      }
    }
    if (!colocada) {
      const nuevo = nuevoPanel(parametros);
      colocar(nuevo, pieza, parametros);
      enProgreso.push(nuevo);
    }
  }

  const paneles: Panel[] = enProgreso.map((p) => aPanel(p, parametros));
  return crearPlanVidrio(parametros, paneles);
}

/** ¿La pieza no cabe en un panel vacío, ni normal ni rotada? Porta `noCabeEnPanel`. */
function noCabeEnPanel(pieza: PiezaVidrio, parametros: ParametrosVidrio): boolean {
  const normal = cabeEn(
    pieza.anchoCm,
    pieza.altoCm,
    parametros.panelAnchoCm,
    parametros.panelAltoCm,
  );
  const rotada =
    parametros.permitirRotacion &&
    cabeEn(pieza.altoCm, pieza.anchoCm, parametros.panelAnchoCm, parametros.panelAltoCm);
  return !normal && !rotada;
}

/** ¿Caben `ancho` x `alto` dentro de `maxAncho` x `maxAlto` (con EPSILON)? Porta `cabeEn`. */
function cabeEn(ancho: number, alto: number, maxAncho: number, maxAlto: number): boolean {
  return ancho <= maxAncho + EPSILON && alto <= maxAlto + EPSILON;
}

// ---- Empaquetado por rectángulos libres (guillotina) ----

/** Crea un panel en progreso con un único hueco libre del tamaño del panel. */
function nuevoPanel(parametros: ParametrosVidrio): PanelEnProgreso {
  return {
    libres: [{ x: 0, y: 0, ancho: parametros.panelAnchoCm, alto: parametros.panelAltoCm }],
    colocadas: [],
  };
}

/**
 * Intenta colocar la pieza en el mejor hueco (Best Area Fit). Devuelve true si lo logra.
 * Porta `PanelEnProgreso.colocar`:
 * - Recorre los huecos libres; prueba orientación normal y, si se permite, rotada 90°.
 * - El "mejor" hueco es el de menor sobra (`libre.ancho * libre.alto - pieza.areaCm2`).
 * - Al colocar, retira el hueco elegido y lo divide en guillotina (derecha y arriba).
 */
function colocar(
  panel: PanelEnProgreso,
  pieza: PiezaVidrio,
  parametros: ParametrosVidrio,
): boolean {
  let mejorIdx = -1;
  let mejorRotada = false;
  let mejorSobra = Number.MAX_VALUE;

  for (let i = 0; i < panel.libres.length; i++) {
    const libre = panel.libres[i];
    // Orientación normal
    if (cabe(pieza.anchoCm, pieza.altoCm, libre)) {
      const sobra = libre.ancho * libre.alto - areaCm2(pieza);
      if (sobra < mejorSobra) {
        mejorSobra = sobra;
        mejorIdx = i;
        mejorRotada = false;
      }
    }
    // Orientación rotada 90°
    if (parametros.permitirRotacion && cabe(pieza.altoCm, pieza.anchoCm, libre)) {
      const sobra = libre.ancho * libre.alto - areaCm2(pieza);
      if (sobra < mejorSobra) {
        mejorSobra = sobra;
        mejorIdx = i;
        mejorRotada = true;
      }
    }
  }

  if (mejorIdx < 0) return false;

  const libre = panel.libres.splice(mejorIdx, 1)[0];
  const ancho = mejorRotada ? pieza.altoCm : pieza.anchoCm;
  const alto = mejorRotada ? pieza.anchoCm : pieza.altoCm;

  panel.colocadas.push({
    pieza,
    xCm: libre.x,
    yCm: libre.y,
    anchoCm: ancho,
    altoCm: alto,
    rotada: mejorRotada,
  });

  // División en guillotina: genera el hueco a la derecha y el de arriba de la pieza.
  const sobranteDerecha = libre.ancho - ancho;
  const sobranteArriba = libre.alto - alto;
  if (sobranteDerecha > EPSILON) {
    panel.libres.push({ x: libre.x + ancho, y: libre.y, ancho: sobranteDerecha, alto });
  }
  if (sobranteArriba > EPSILON) {
    panel.libres.push({ x: libre.x, y: libre.y + alto, ancho: libre.ancho, alto: sobranteArriba });
  }
  return true;
}

/** ¿Caben `ancho` x `alto` dentro del hueco libre (con EPSILON)? Porta `cabe`. */
function cabe(ancho: number, alto: number, libre: Libre): boolean {
  return ancho <= libre.ancho + EPSILON && alto <= libre.alto + EPSILON;
}

/** Convierte un panel en progreso en un `Panel` del modelo, con sus piezas colocadas. */
function aPanel(progreso: PanelEnProgreso, parametros: ParametrosVidrio): Panel {
  const panel = crearPanel(parametros);
  for (const c of progreso.colocadas) {
    panel.piezas.push(c);
  }
  return panel;
}
