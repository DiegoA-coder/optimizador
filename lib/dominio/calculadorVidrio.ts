// lib/dominio/calculadorVidrio.ts
// Deriva las piezas de vidrio de cada ventana. Por cada ventana se genera una pieza
// por cada material de alto configurado (p. ej. "Cerco Fijo" y "Cerco Corredizo"):
// todas comparten el ancho (derivado del material de ancho) y cada una toma su alto
// del cerco correspondiente:
//   ancho = longitud(materialAncho)       + anchoAjusteCm
//   alto  = longitud(materialAlto pareja) + altoAjusteCm
// Cuando un material aparece en varias reglas con distintos descuentos, se usa la de
// menor descuento (la pieza de aluminio más larga). Porta `dominio.CalculadorVidrio`
// del proyecto Java para garantizar paridad numérica y de orden. TypeScript puro, sin React.

import { Parametros, cm, truncar } from "./parametros";
import {
  PiezaVidrio,
  ReglaCorte,
  Ventana,
  crearPiezaVidrio,
  longitudPara,
} from "./modelos";
import { ParametrosVidrio } from "./parametrosVidrio";

/**
 * Genera todas las piezas de vidrio (una por material de alto, por cada unidad de cada ventana).
 * Porta `CalculadorVidrio.calcular` (Algoritmo 4 del diseño):
 * - El ancho se calcula UNA vez por ventana (fuera del lazo de unidad).
 * - El alto se calcula una vez por cada material de alto.
 * - Numera las unidades cuando `cantidad > 1` ("<etiqueta> #<n>"), si no usa la etiqueta tal cual.
 * - La etiqueta de la pieza incluye el material de alto: "<base> (<materialAlto>)".
 * - Conserva el orden de aparición de ventanas, unidades y materiales de alto.
 *
 * Lanza `Error` con el mismo mensaje que Java si el perfil de una ventana no tiene reglas,
 * o si una medida de vidrio resulta `<= 0`.
 */
export function calcularVidrio(
  ventanas: Ventana[],
  reglasPorPerfil: Record<string, ReglaCorte[]>,
  paramsAluminio: Parametros,
  paramsVidrio: ParametrosVidrio,
): PiezaVidrio[] {
  const piezas: PiezaVidrio[] = [];
  for (const ventana of ventanas) {
    const reglas = reglasPorPerfil[ventana.perfil];
    if (reglas == null) {
      throw new Error(
        `Ventana '${ventana.etiqueta}': no hay reglas para el perfil '${ventana.perfil}'`,
      );
    }

    const longitudAncho = longitudDe(
      paramsVidrio.materialAncho,
      ventana,
      reglas,
      paramsAluminio,
    );
    const anchoCm = truncar(longitudAncho + paramsVidrio.anchoAjusteCm);

    for (let unidad = 1; unidad <= ventana.cantidad; unidad++) {
      const base =
        ventana.cantidad > 1 ? `${ventana.etiqueta} #${unidad}` : ventana.etiqueta;
      // Una pieza por cada material de alto (p. ej. Cerco Fijo y Cerco Corredizo).
      for (const materialAlto of paramsVidrio.materialesAlto) {
        const longitudAlto = longitudDe(materialAlto, ventana, reglas, paramsAluminio);
        const altoCm = truncar(longitudAlto + paramsVidrio.altoAjusteCm);

        if (anchoCm <= 0 || altoCm <= 0) {
          throw new Error(
            `Ventana '${ventana.etiqueta}' (${materialAlto}): medida de vidrio inválida (${cm(
              anchoCm,
            )} x ${cm(altoCm)} cm)`,
          );
        }
        // La etiqueta incluye el tipo de cerco para distinguir las piezas en el reporte.
        const etiqueta = `${base} (${materialAlto})`;
        piezas.push(crearPiezaVidrio(etiqueta, ventana.perfil, anchoCm, altoCm));
      }
    }
  }
  return piezas;
}

/**
 * Longitud final (cm) del material indicado para la ventana; usa la regla de menor descuento.
 * Porta `CalculadorVidrio.longitudDe`:
 * - Filtra las reglas cuyo material coincide ignorando mayúsculas/minúsculas.
 * - Si no hay candidatas, lanza `Error` con el mensaje de Java.
 * - Elige la de `descuentoCm` mínimo; en caso de empate, la primera (orden estable, igual que `min`).
 */
function longitudDe(
  material: string,
  ventana: Ventana,
  reglas: ReglaCorte[],
  paramsAluminio: Parametros,
): number {
  let elegida: ReglaCorte | null = null;
  for (const r of reglas) {
    if (r.material.toLowerCase() === material.toLowerCase()) {
      if (elegida == null || r.descuentoCm < elegida.descuentoCm) {
        elegida = r;
      }
    }
  }
  if (elegida == null) {
    throw new Error(
      `No hay regla de '${material}' en el perfil '${ventana.perfil}' para calcular el vidrio`,
    );
  }
  return longitudPara(elegida, ventana, paramsAluminio);
}
