import { describe, expect, it } from "vitest";

import { Parametros, crearParametros } from "@/lib/dominio/parametros";
import {
  PiezaVidrio,
  ReglaCorte,
  Ventana,
  crearReglaCorte,
  crearVentana,
} from "@/lib/dominio/modelos";
import {
  ParametrosVidrio,
  crearParametrosVidrio,
  porDefectoVidrio,
} from "@/lib/dominio/parametrosVidrio";
import { calcularVidrio } from "@/lib/dominio/calculadorVidrio";

// Tests unitarios del cálculo de vidrio.
// Portan CalculadorVidrioTest del proyecto Java y verifican paridad de comportamiento:
// ancho/alto truncados correctos, selección de regla por descuento mínimo, etiquetas
// por material ("<base> (<materialAlto>)"), expansión por cantidad y error de medida
// inválida.
// Validates: Requirements 6.1, 10.4

const parametros: Parametros = crearParametros(600.0, 0.4);
// porDefectoVidrio: ancho +1.8, alto -9.3, [Cerco Fijo, Cerco Corredizo]
const pv: ParametrosVidrio = porDefectoVidrio();

function reglas(): Record<string, ReglaCorte[]> {
  return {
    "2PULG": [
      crearReglaCorte("Zoclo", 2, "INFERIOR", 16.2, 2),
      crearReglaCorte("Cerco Fijo", 1, "LATERAL", 4, 1),
      crearReglaCorte("Cerco Corredizo", 1, "LATERAL", 3, 1),
    ],
  };
}

describe("calcularVidrio", () => {
  it("genera una pieza por cada cerco con altos distintos", () => {
    // Zoclo: (180 - 16.2)/2 = 81.9 -> ancho = 81.9 + 1.8 = 83.7 (ambas piezas)
    // Cerco Fijo:      119 - 4 = 115.0 -> alto = 115.0 - 9.3 = 105.7
    // Cerco Corredizo: 119 - 3 = 116.0 -> alto = 116.0 - 9.3 = 106.7
    const ventanas: Ventana[] = [crearVentana("sala", "2PULG", 180.0, 119.0, 1)];
    const piezas: PiezaVidrio[] = calcularVidrio(ventanas, reglas(), parametros, pv);

    expect(piezas).toHaveLength(2);
    // Ambas comparten ancho
    expect(piezas[0].anchoCm).toBeCloseTo(83.7, 9);
    expect(piezas[1].anchoCm).toBeCloseTo(83.7, 9);
    // Alturas distintas, una por cada cerco
    const altos = piezas.map((p) => p.altoCm).sort((a, b) => a - b);
    expect(altos[0]).toBeCloseTo(105.7, 9);
    expect(altos[1]).toBeCloseTo(106.7, 9);
  });

  it("la etiqueta identifica el tipo de cerco", () => {
    const ventanas: Ventana[] = [crearVentana("sala", "2PULG", 180.0, 119.0, 1)];
    const piezas = calcularVidrio(ventanas, reglas(), parametros, pv);

    expect(piezas.some((p) => p.etiquetaVentana.includes("Cerco Fijo"))).toBe(true);
    expect(piezas.some((p) => p.etiquetaVentana.includes("Cerco Corredizo"))).toBe(true);
  });

  it("genera dos piezas por cada unidad de ventana", () => {
    const ventanas: Ventana[] = [crearVentana("sala", "2PULG", 180.0, 119.0, 3)];
    const piezas = calcularVidrio(ventanas, reglas(), parametros, pv);

    expect(piezas).toHaveLength(6); // 3 unidades x 2 cercos
  });

  it("elige la regla de menor descuento cuando el material aparece varias veces", () => {
    // Dos reglas de 'Cerco Fijo': descuentos 4 y 10. Debe usar la de descuento 4.
    // Cerco Fijo (desc 4): 119 - 4 = 115.0 -> alto = 115.0 - 9.3 = 105.7
    const reglasConDuplicado: Record<string, ReglaCorte[]> = {
      "2PULG": [
        crearReglaCorte("Zoclo", 2, "INFERIOR", 16.2, 2),
        crearReglaCorte("Cerco Fijo", 1, "LATERAL", 10, 1),
        crearReglaCorte("Cerco Fijo", 1, "LATERAL", 4, 1),
        crearReglaCorte("Cerco Corredizo", 1, "LATERAL", 3, 1),
      ],
    };
    const ventanas: Ventana[] = [crearVentana("sala", "2PULG", 180.0, 119.0, 1)];
    const piezas = calcularVidrio(ventanas, reglasConDuplicado, parametros, pv);

    const fijo = piezas.find((p) => p.etiquetaVentana.includes("Cerco Fijo"));
    expect(fijo).toBeDefined();
    expect(fijo!.altoCm).toBeCloseTo(105.7, 9);
  });

  it("falla si falta un material de alto", () => {
    const sinCorredizo: Record<string, ReglaCorte[]> = {
      "2PULG": [
        crearReglaCorte("Zoclo", 2, "INFERIOR", 16.2, 2),
        crearReglaCorte("Cerco Fijo", 1, "LATERAL", 4, 1),
      ],
    };
    const ventanas: Ventana[] = [crearVentana("sala", "2PULG", 180.0, 119.0, 1)];

    expect(() => calcularVidrio(ventanas, sinCorredizo, parametros, pv)).toThrow();
  });

  it("falla con medida de vidrio inválida (alto <= 0)", () => {
    // Lateral pequeño: con ajuste de alto -9.3 el alto queda <= 0.
    // Cerco Fijo: lateral - 4; Cerco Corredizo: lateral - 3. Con lateral = 10:
    //   Cerco Corredizo -> 10 - 3 = 7.0 -> alto = 7.0 - 9.3 = -2.3 (<= 0) -> error
    // El ancho sigue positivo (Zoclo con inferior 180). materialAncho es "Zoclo".
    const pvZocloAncho: ParametrosVidrio = crearParametrosVidrio(
      180.0,
      260.0,
      "Zoclo",
      1.8,
      ["Cerco Fijo", "Cerco Corredizo"],
      -9.3,
      true,
    );
    const ventanas: Ventana[] = [crearVentana("sala", "2PULG", 180.0, 10.0, 1)];

    expect(() => calcularVidrio(ventanas, reglas(), parametros, pvZocloAncho)).toThrow(
      /medida de vidrio inválida/,
    );
  });
});
