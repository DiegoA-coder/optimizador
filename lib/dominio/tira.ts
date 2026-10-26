// lib/dominio/tira.ts
// Tira (Perfil) de aluminio en estilo funcional. Porta la clase `modelo.Tira` del proyecto Java.
//
// Invariante de capacidad: la capacidad efectiva de la tira es `largo + sierra`, y cada pieza
// consume `longitud + sierra`. Así el último corte no cuenta la sierra doble y el sobrante
// (`restanteCm`) queda correcto.

import { EPSILON, Parametros, capacidadEfectivaCm, redondear } from "./parametros";
import { Pieza } from "./modelos";

/**
 * Tira de aluminio: sus parámetros, las piezas que se cortan de ella y el centímetro restante.
 * Es inmutable: `agregar` devuelve una nueva tira en lugar de mutar la actual.
 * Porta la clase `modelo.Tira` (campos `parametros`, `piezas`, `restanteCm`).
 */
export type Tira = {
  readonly parametros: Parametros;
  readonly piezas: readonly Pieza[];
  readonly restanteCm: number;
};

/**
 * Crea una tira vacía a partir de los parámetros.
 * `restanteCm` arranca en la capacidad efectiva (`largoTiraCm + sierraCm`).
 * Porta el constructor `Tira(Parametros)`.
 */
export function crearTira(parametros: Parametros): Tira {
  return {
    parametros,
    piezas: [],
    restanteCm: capacidadEfectivaCm(parametros),
  };
}

/**
 * Indica si la pieza cabe en la tira: `longitud + sierra <= restanteCm + EPSILON`.
 * Porta `Tira.cabe`.
 */
export function cabe(tira: Tira, pieza: Pieza): boolean {
  return pieza.longitudCm + tira.parametros.sierraCm <= tira.restanteCm + EPSILON;
}

/**
 * Agrega una pieza a la tira y devuelve una nueva tira con el restante actualizado:
 * `restanteCm = redondear(restanteCm - longitud - sierra)`.
 * Lanza `Error` si la pieza no cabe. Porta `Tira.agregar`.
 */
export function agregar(tira: Tira, pieza: Pieza): Tira {
  if (!cabe(tira, pieza)) {
    throw new Error("La pieza no cabe en la tira");
  }
  return {
    parametros: tira.parametros,
    piezas: [...tira.piezas, pieza],
    restanteCm: redondear(tira.restanteCm - pieza.longitudCm - tira.parametros.sierraCm),
  };
}

/** Centímetros restantes (sobrante) de la tira. Porta `Tira.restanteCm`. */
export function restanteCm(tira: Tira): number {
  return tira.restanteCm;
}

/**
 * Longitud total consumida de la Perfil (incluye el ancho de sierra de cada corte):
 * `redondear(capacidadEfectiva - restanteCm)`. Porta `Tira.usadoCm`.
 */
export function usadoCm(tira: Tira): number {
  return redondear(capacidadEfectivaCm(tira.parametros) - tira.restanteCm);
}
