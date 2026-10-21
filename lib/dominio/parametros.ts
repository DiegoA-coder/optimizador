// lib/dominio/parametros.ts
// Aritmética base y parámetros globales del corte (en centímetros), inmutables.
// Porta config.Parametros del proyecto Java para garantizar paridad numérica.

/** Tolerancia para comparaciones de punto flotante. */
export const EPSILON = 1e-6;

export const LARGO_TIRA_POR_DEFECTO = 600.0;
export const SIERRA_POR_DEFECTO = 0.4;

/**
 * Parámetros globales del corte, inmutables.
 * Equivale al record `config.Parametros(double largoTiraCm, double sierraCm)` de Java.
 */
export type Parametros = {
  readonly largoTiraCm: number;
  readonly sierraCm: number;
};

/** Redondea a 1 decimal: Math.round(v*10)/10 (equivale a Math.round de Java para +). */
export function redondear(valor: number): number {
  return Math.round(valor * 10) / 10;
}

/** Trunca a 1 decimal hacia abajo con EPSILON anti-arrastre: Math.floor(v*10 + EPSILON)/10. */
export function truncar(valor: number): number {
  return Math.floor(valor * 10 + EPSILON) / 10;
}

/** Formatea cm con 1 decimal, punto como separador (Locale US). */
export function cm(valor: number): string {
  return valor.toFixed(1);
}

/** Capacidad efectiva de una tira: largo + una sierra, para que el último corte no cuente doble. */
export function capacidadEfectivaCm(p: Parametros): number {
  return p.largoTiraCm + p.sierraCm;
}

/**
 * Crea unos parámetros validando las invariantes del record Java.
 * Lanza `Error` con los mensajes exactos del compact constructor de Java.
 */
export function crearParametros(largoTiraCm: number, sierraCm: number): Parametros {
  if (largoTiraCm <= 0) throw new Error("El largo de la tira debe ser mayor a 0");
  if (sierraCm < 0) throw new Error("La sierra (kerf) no puede ser negativa");
  return { largoTiraCm, sierraCm };
}

/** Parámetros con los valores por defecto. */
export function porDefecto(): Parametros {
  return crearParametros(LARGO_TIRA_POR_DEFECTO, SIERRA_POR_DEFECTO);
}
