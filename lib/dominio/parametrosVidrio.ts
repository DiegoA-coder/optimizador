// lib/dominio/parametrosVidrio.ts
// Parámetros del cálculo y corte de vidrio (en centímetros), inmutables.
// Porta config.ParametrosVidrio del proyecto Java para garantizar paridad numérica.
//
// Por cada ventana sale una pieza de vidrio por cada material de `materialesAlto`
// (p. ej. una para "Cerco Fijo" y otra para "Cerco Corredizo"). Todas comparten el
// mismo ancho, derivado del `materialAncho`; el alto se deriva del material de alto
// correspondiente:
//   ancho = longitud(materialAncho)     + anchoAjusteCm
//   alto  = longitud(materialAlto)      + altoAjusteCm
// El corte de vidrio no tiene desperdicio por sierra (kerf = 0). Las piezas pueden
// rotarse 90° si `permitirRotacion` es verdadero.

export const PANEL_ANCHO_POR_DEFECTO = 180.0;
export const PANEL_ALTO_POR_DEFECTO = 260.0;
export const MATERIAL_ANCHO_POR_DEFECTO = "Zoclo";
export const ANCHO_AJUSTE_POR_DEFECTO = 1.8;
export const MATERIALES_ALTO_POR_DEFECTO: readonly string[] = ["Cerco Fijo", "Cerco Corredizo"];
export const ALTO_AJUSTE_POR_DEFECTO = -9.3;
export const PERMITIR_ROTACION_POR_DEFECTO = true;

/**
 * Parámetros del cálculo y corte de vidrio, inmutables.
 * Equivale al record `config.ParametrosVidrio` de Java.
 */
export type ParametrosVidrio = {
  readonly panelAnchoCm: number;
  readonly panelAltoCm: number;
  readonly materialAncho: string;
  readonly anchoAjusteCm: number;
  readonly materialesAlto: readonly string[];
  readonly altoAjusteCm: number;
  readonly permitirRotacion: boolean;
};

/**
 * Crea unos parámetros de vidrio validando las invariantes del record Java.
 * Lanza `Error` con los mensajes exactos del compact constructor de Java.
 */
export function crearParametrosVidrio(
  panelAnchoCm: number,
  panelAltoCm: number,
  materialAncho: string,
  anchoAjusteCm: number,
  materialesAlto: readonly string[],
  altoAjusteCm: number,
  permitirRotacion: boolean,
): ParametrosVidrio {
  if (panelAnchoCm <= 0 || panelAltoCm <= 0) {
    throw new Error("Las dimensiones del panel de vidrio deben ser mayores a 0");
  }
  if (materialAncho == null || materialAncho.trim().length === 0) {
    throw new Error("El material base del ancho no puede estar vacío");
  }
  if (materialesAlto == null || materialesAlto.length === 0) {
    throw new Error("Debe haber al menos un material de alto para el vidrio");
  }
  if (materialesAlto.some((m) => m == null || m.trim().length === 0)) {
    throw new Error("Los materiales de alto del vidrio no pueden estar vacíos");
  }
  // Copia defensiva e inmutable de la lista.
  return {
    panelAnchoCm,
    panelAltoCm,
    materialAncho,
    anchoAjusteCm,
    materialesAlto: Object.freeze([...materialesAlto]),
    altoAjusteCm,
    permitirRotacion,
  };
}

/** Parámetros de vidrio con los valores por defecto. */
export function porDefectoVidrio(): ParametrosVidrio {
  return crearParametrosVidrio(
    PANEL_ANCHO_POR_DEFECTO,
    PANEL_ALTO_POR_DEFECTO,
    MATERIAL_ANCHO_POR_DEFECTO,
    ANCHO_AJUSTE_POR_DEFECTO,
    MATERIALES_ALTO_POR_DEFECTO,
    ALTO_AJUSTE_POR_DEFECTO,
    PERMITIR_ROTACION_POR_DEFECTO,
  );
}

/** Número de piezas de vidrio que salen por cada ventana (una por material de alto). */
export function piezasPorVentana(p: ParametrosVidrio): number {
  return p.materialesAlto.length;
}

/** Área de un panel completo (cm²). */
export function areaPanelCm2(p: ParametrosVidrio): number {
  return p.panelAnchoCm * p.panelAltoCm;
}
