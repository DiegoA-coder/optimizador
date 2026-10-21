// lib/dominio/cortesPorVentana.ts
// Agrupa las piezas por ventana y, dentro de cada ventana, por material, consolidando las
// longitudes repetidas en pares (longitud, cantidad). Lo usan los tres formatos de reporte.
// Porta la clase `dominio.CortesPorVentana` del proyecto Java (función `agrupar`).
// TypeScript puro, sin React.

import type { Pieza } from "./modelos";

/**
 * Una longitud consolidada: la longitud de corte (cm) y cuántas piezas idénticas la tienen.
 * Porta el record `CortesPorVentana.Agrupada`.
 */
export interface Agrupada {
  longitudCm: number;
  cantidad: number;
}

/**
 * Las piezas de una ventana agrupadas por material. `porMaterial` conserva el orden de
 * aparición de los materiales, y dentro de cada material el orden de aparición de las longitudes.
 * Porta el record `CortesPorVentana.Ventana`.
 */
export interface VentanaAgrupada {
  etiqueta: string;
  perfil: string;
  totalPiezas: number;
  porMaterial: Record<string, Agrupada[]>;
}

/**
 * Agrupa las piezas por ventana (en orden de aparición) y, dentro de cada ventana, por material
 * (en orden de aparición), consolidando longitudes idénticas en `Agrupada { longitudCm, cantidad }`.
 * Porta `CortesPorVentana.agrupar`.
 *
 * El perfil de la ventana es el de su primera pieza. `totalPiezas` suma las cantidades de todas
 * las longitudes de todos los materiales de la ventana.
 */
export function agruparPorVentana(piezas: Pieza[]): VentanaAgrupada[] {
  // ventana -> material -> (longitud -> cantidad).
  // Los Map de JS conservan el orden de inserción de las claves, igual que LinkedHashMap en Java.
  const acumulado = new Map<string, Map<string, Map<number, number>>>();
  const perfilDeVentana = new Map<string, string>();

  for (const pieza of piezas) {
    if (!perfilDeVentana.has(pieza.etiquetaVentana)) {
      perfilDeVentana.set(pieza.etiquetaVentana, pieza.perfil);
    }

    let porMaterial = acumulado.get(pieza.etiquetaVentana);
    if (porMaterial === undefined) {
      porMaterial = new Map<string, Map<number, number>>();
      acumulado.set(pieza.etiquetaVentana, porMaterial);
    }

    let porLongitud = porMaterial.get(pieza.material);
    if (porLongitud === undefined) {
      porLongitud = new Map<number, number>();
      porMaterial.set(pieza.material, porLongitud);
    }

    porLongitud.set(pieza.longitudCm, (porLongitud.get(pieza.longitudCm) ?? 0) + 1);
  }

  const resultado: VentanaAgrupada[] = [];
  for (const [etiqueta, materiales] of acumulado) {
    const porMaterial: Record<string, Agrupada[]> = {};
    let totalPiezas = 0;
    for (const [material, longitudes] of materiales) {
      const agrupadas: Agrupada[] = [];
      for (const [longitudCm, cantidad] of longitudes) {
        agrupadas.push({ longitudCm, cantidad });
        totalPiezas += cantidad;
      }
      porMaterial[material] = agrupadas;
    }
    resultado.push({
      etiqueta,
      perfil: perfilDeVentana.get(etiqueta) ?? "",
      totalPiezas,
      porMaterial,
    });
  }
  return resultado;
}
