// lib/io/cargadorVentanas.ts
// Importa y exporta el arreglo de ventanas en el mismo formato JSON que consume el
// proyecto Java (`io.CargadorVentanas`). Las medidas están en centímetros.
//
// A diferencia del Java, que usa un analizador JSON manual (`io.AnalizadorJson`),
// aquí se usa `JSON.parse` nativo. Las validaciones de tipo y los mensajes de error
// (con el índice del elemento) se portan fielmente para mantener la paridad.

import { Ventana, crearVentana } from "../dominio/modelos";

/**
 * Parsea el contenido de un `ventanas.json` en una lista de ventanas.
 * Porta `CargadorVentanas.parsear`.
 *
 * Lanza `Error` si:
 * - La raíz no es un arreglo.
 * - Un elemento no es un objeto.
 * - Un campo tiene un tipo incorrecto (indicando el índice del elemento).
 * Además propaga los errores de validación de dominio de `crearVentana`.
 */
export function parsearVentanas(json: string): Ventana[] {
  const raiz: unknown = JSON.parse(json);
  if (!Array.isArray(raiz)) {
    throw new Error("El JSON debe ser un arreglo de ventanas");
  }

  const ventanas: Ventana[] = [];
  for (let i = 0; i < raiz.length; i++) {
    const crudo = raiz[i];
    if (crudo === null || typeof crudo !== "object" || Array.isArray(crudo)) {
      throw new Error(`Elemento ${i}: se esperaba un objeto`);
    }
    const obj = crudo as Record<string, unknown>;
    ventanas.push(
      crearVentana(
        exigirTexto(obj, "etiqueta", i),
        exigirTexto(obj, "perfil", i),
        exigirDecimal(obj, "inferiorCm", i),
        exigirDecimal(obj, "lateralCm", i),
        exigirEntero(obj, "cantidad", i),
      ),
    );
  }
  return ventanas;
}

/**
 * Serializa la lista de ventanas al mismo formato JSON que consume el proyecto Java:
 * un arreglo de objetos con los campos `etiqueta`, `perfil`, `inferiorCm`, `lateralCm`
 * y `cantidad`, en ese orden, con indentación de 2 espacios.
 */
export function serializarVentanas(ventanas: Ventana[]): string {
  return JSON.stringify(
    ventanas.map((v) => ({
      etiqueta: v.etiqueta,
      perfil: v.perfil,
      inferiorCm: v.inferiorCm,
      lateralCm: v.lateralCm,
      cantidad: v.cantidad,
    })),
    null,
    2,
  );
}

/** Exige que el campo sea texto. Porta `CargadorVentanas.exigirTexto`. */
function exigirTexto(obj: Record<string, unknown>, clave: string, indice: number): string {
  const valor = obj[clave];
  if (typeof valor !== "string") {
    throw new Error(`Elemento ${indice}: el campo '${clave}' debe ser texto`);
  }
  return valor;
}

/** Exige que el campo sea un número (cm). Porta `CargadorVentanas.exigirDecimal`. */
function exigirDecimal(obj: Record<string, unknown>, clave: string, indice: number): number {
  const valor = obj[clave];
  if (typeof valor !== "number" || !Number.isFinite(valor)) {
    throw new Error(`Elemento ${indice}: el campo '${clave}' debe ser un número en cm`);
  }
  return valor;
}

/** Exige que el campo sea un entero. Porta `CargadorVentanas.exigirEntero`. */
function exigirEntero(obj: Record<string, unknown>, clave: string, indice: number): number {
  const valor = obj[clave];
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor !== Math.round(valor)) {
    throw new Error(`Elemento ${indice}: el campo '${clave}' debe ser un entero`);
  }
  return valor;
}
