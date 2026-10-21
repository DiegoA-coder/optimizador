// lib/dominio/despiezador.ts
// Despiece de aluminio: expande cada ventana en las piezas concretas a cortar,
// según las reglas de su perfil. Porta `dominio.Despiezador` del proyecto Java
// para garantizar paridad numérica y de orden. TypeScript puro, sin React.

import { Parametros } from "./parametros";
import {
  Pieza,
  ReglaCorte,
  Ventana,
  longitudPara,
} from "./modelos";

/**
 * Expande cada ventana en sus piezas concretas a cortar, según las reglas de su perfil.
 * Porta `Despiezador.expandir` (Algoritmo 1 del diseño):
 * - Expande por cantidad de ventana (unidad 1..cantidad) y por cantidad de regla.
 * - Numera las unidades cuando `cantidad > 1` ("<etiqueta> #<n>"), si no usa la etiqueta tal cual.
 * - Conserva el orden de aparición de ventanas y reglas.
 *
 * Lanza `Error` con el mismo mensaje que Java si el perfil de una ventana no tiene reglas.
 */
export function expandir(
  ventanas: Ventana[],
  reglasPorPerfil: Record<string, ReglaCorte[]>,
  parametros: Parametros,
): Pieza[] {
  const piezas: Pieza[] = [];
  for (const ventana of ventanas) {
    const reglas = reglasPorPerfil[ventana.perfil];
    if (reglas == null) {
      const perfilesDisponibles = `[${Object.keys(reglasPorPerfil).join(", ")}]`;
      throw new Error(
        `Ventana '${ventana.etiqueta}': no hay reglas definidas en el .env para el perfil ` +
          `'${ventana.perfil}' (perfiles disponibles: ${perfilesDisponibles})`,
      );
    }
    for (let unidad = 1; unidad <= ventana.cantidad; unidad++) {
      const etiqueta =
        ventana.cantidad > 1 ? `${ventana.etiqueta} #${unidad}` : ventana.etiqueta;
      for (const regla of reglas) {
        const longitud = longitudPara(regla, ventana, parametros);
        const material = nombreCorte(regla.material);
        for (let i = 0; i < regla.cantidad; i++) {
          piezas.push({
            perfil: ventana.perfil,
            material,
            etiquetaVentana: etiqueta,
            longitudCm: longitud,
          });
        }
      }
    }
  }
  return piezas;
}

/**
 * Unifica, solo para el despiece de aluminio, las variantes de cerco que comparten perfil
 * y solo difieren en la medida: "Cerco Fijo"/"Cerco Corredizo" -> "Cerco" y
 * "Cerco Traslape Fijo"/"Cerco Traslape Corredizo" -> "Cerco Traslape".
 * El cálculo de vidrio sigue usando los nombres originales de las reglas, así que no se toca allí.
 * Porta `Despiezador.nombreCorte`.
 */
export function nombreCorte(material: string): string {
  const normalizado = material.trim().toLowerCase();
  if (normalizado.startsWith("cerco traslape")) {
    return "Cerco Traslape";
  }
  if (normalizado.startsWith("cerco")) {
    return "Cerco";
  }
  return material;
}
