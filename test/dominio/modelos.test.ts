import { describe, expect, it } from "vitest";

import { EPSILON, Parametros, crearParametros } from "@/lib/dominio/parametros";
import {
  Medida,
  areaCm2,
  areaDesperdicioCm2,
  areaUtilizadaCm2,
  crearPanel,
  crearPiezaVidrio,
  crearReglaCorte,
  crearVentana,
  longitudPara,
  medidaDe,
  xFinCm,
  yFinCm,
  type PiezaColocada,
  type PiezaVidrio,
} from "@/lib/dominio/modelos";
import {
  areaPanelCm2,
  crearParametrosVidrio,
  porDefectoVidrio,
} from "@/lib/dominio/parametrosVidrio";

// Tests unitarios de los modelos del dominio y de `longitudPara`.
// Portan ReglaCorteTest del proyecto Java y verifican paridad numérica y de mensajes.
// Validates: Requirements 2.2, 6.1, 10.2, 10.3

const parametros: Parametros = crearParametros(600.0, 0.4);

// --- Ventana / medidaDe -----------------------------------------------------

describe("crearVentana / medidaDe", () => {
  it("devuelve la medida inferior o lateral según el enum", () => {
    const v = crearVentana("sala", "2PULG", 180.0, 119.0, 1);
    expect(medidaDe(v, "INFERIOR")).toBe(180.0);
    expect(medidaDe(v, "LATERAL")).toBe(119.0);
  });

  it("lanza si la etiqueta está vacía", () => {
    expect(() => crearVentana("  ", "2PULG", 180, 119, 1)).toThrow(
      "La etiqueta no puede estar vacía",
    );
  });

  it("lanza si el perfil está vacío", () => {
    expect(() => crearVentana("sala", "", 180, 119, 1)).toThrow(
      "Ventana 'sala': el perfil no puede estar vacío",
    );
  });

  it("lanza si una medida o la cantidad no es mayor a 0", () => {
    expect(() => crearVentana("sala", "2PULG", 0, 119, 1)).toThrow(
      "Ventana 'sala': las medidas y la cantidad deben ser mayores a 0",
    );
    expect(() => crearVentana("sala", "2PULG", 180, -1, 1)).toThrow(
      "Ventana 'sala': las medidas y la cantidad deben ser mayores a 0",
    );
    expect(() => crearVentana("sala", "2PULG", 180, 119, 0)).toThrow(
      "Ventana 'sala': las medidas y la cantidad deben ser mayores a 0",
    );
  });
});

// --- ReglaCorte / longitudPara ----------------------------------------------

describe("crearReglaCorte / longitudPara", () => {
  const ventana = crearVentana("sala", "2PULG", 180.0, 119.0, 1);

  it("calcula la longitud con descuento y divisor (truncado a 1 decimal)", () => {
    // Zoclo: (180 - 16.2) / 2 = 81.9
    const zoclo = crearReglaCorte("Zoclo", 2, "INFERIOR", 16.2, 2);
    expect(longitudPara(zoclo, ventana, parametros)).toBeCloseTo(81.9, 9);
  });

  it("usa la medida lateral", () => {
    // Cerco lateral: 119 - 2.8 = 116.2
    const cerco = crearReglaCorte("Cerco", 1, "LATERAL", 2.8, 1);
    expect(longitudPara(cerco, ventana, parametros)).toBeCloseTo(116.2, 9);
  });

  it("trunca hacia abajo (no redondea) el resultado", () => {
    // (119 - 0) / 3 = 39.666... -> truncado a 39.6
    const r = crearReglaCorte("X", 1, "LATERAL", 0, 3);
    expect(longitudPara(r, ventana, parametros)).toBeCloseTo(39.6, 9);
  });

  it("lanza con mensaje de medida inválida cuando la longitud es <= 0", () => {
    // (10 - 20) / 1 = -10 -> truncado -10 <= 0
    const chica = crearVentana("x", "2PULG", 10.0, 10.0, 1);
    const r = crearReglaCorte("Zoclo", 1, "INFERIOR", 20.0, 1);
    expect(() => longitudPara(r, chica, parametros)).toThrow(
      "Medida inválida en ventana 'x': Zoclo da longitud -10.0 cm",
    );
  });

  it("lanza con mensaje de exceso cuando la pieza supera el largo de la tira", () => {
    const grande = crearVentana("g", "2PULG", 700.0, 100.0, 1);
    const enorme = crearReglaCorte("X", 1, "INFERIOR", 0, 1);
    expect(() => longitudPara(enorme, grande, parametros)).toThrow(
      "Pieza de X en ventana 'g' (700.0 cm) excede la tira de 600.0 cm",
    );
  });

  it("acepta una pieza justo en el límite de la tira (largoTiraCm + EPSILON)", () => {
    const justa = crearVentana("limite", "2PULG", 600.0, 100.0, 1);
    const r = crearReglaCorte("X", 1, "INFERIOR", 0, 1);
    expect(longitudPara(r, justa, parametros)).toBeCloseTo(600.0, 9);
    // Confirma que la holgura es por EPSILON, no por un cm completo.
    expect(600.0 <= parametros.largoTiraCm + EPSILON).toBe(true);
  });

  it("valida las invariantes del constructor", () => {
    expect(() => crearReglaCorte("", 1, "INFERIOR", 0, 1)).toThrow(
      "El material no puede estar vacío",
    );
    expect(() => crearReglaCorte("X", 0, "INFERIOR", 0, 1)).toThrow(
      "Regla 'X': cantidad y divisor deben ser > 0, descuentoCm >= 0",
    );
    expect(() => crearReglaCorte("X", 1, "INFERIOR", 0, 0)).toThrow(
      "Regla 'X': cantidad y divisor deben ser > 0, descuentoCm >= 0",
    );
    expect(() => crearReglaCorte("X", 1, "INFERIOR", -1, 1)).toThrow(
      "Regla 'X': cantidad y divisor deben ser > 0, descuentoCm >= 0",
    );
  });
});

// --- PiezaVidrio / areaCm2 --------------------------------------------------

describe("crearPiezaVidrio / areaCm2", () => {
  it("calcula el área nominal como ancho * alto", () => {
    const p = crearPiezaVidrio("sala", "Zoclo", 50.0, 30.0);
    expect(areaCm2(p)).toBe(1500.0);
  });

  it("lanza si el ancho o el alto no son mayores a 0", () => {
    expect(() => crearPiezaVidrio("sala", "Zoclo", 0, 30)).toThrow(
      "Pieza de vidrio de 'sala': ancho y alto deben ser mayores a 0",
    );
    expect(() => crearPiezaVidrio("sala", "Zoclo", 50, -1)).toThrow(
      "Pieza de vidrio de 'sala': ancho y alto deben ser mayores a 0",
    );
  });
});

// --- PiezaColocada / xFinCm, yFinCm -----------------------------------------

describe("xFinCm / yFinCm", () => {
  const pieza: PiezaVidrio = crearPiezaVidrio("sala", "Zoclo", 50.0, 30.0);

  it("suma el ancho/alto efectivos a la esquina inferior-izquierda", () => {
    const colocada: PiezaColocada = {
      pieza,
      xCm: 10.0,
      yCm: 20.0,
      anchoCm: 50.0,
      altoCm: 30.0,
      rotada: false,
    };
    expect(xFinCm(colocada)).toBe(60.0);
    expect(yFinCm(colocada)).toBe(50.0);
  });

  it("usa las dimensiones efectivas cuando la pieza está rotada", () => {
    const rotada: PiezaColocada = {
      pieza,
      xCm: 0.0,
      yCm: 0.0,
      anchoCm: 30.0,
      altoCm: 50.0,
      rotada: true,
    };
    expect(xFinCm(rotada)).toBe(30.0);
    expect(yFinCm(rotada)).toBe(50.0);
  });
});

// --- Panel: areaUtilizadaCm2 / areaDesperdicioCm2 ---------------------------

describe("Panel: areaUtilizadaCm2 / areaDesperdicioCm2", () => {
  it("un panel vacío no aprovecha nada y desperdicia toda su área", () => {
    const panel = crearPanel(porDefectoVidrio());
    expect(panel.anchoCm).toBe(180.0);
    expect(panel.altoCm).toBe(260.0);
    expect(areaUtilizadaCm2(panel)).toBe(0.0);
    // 180 * 260 = 46800
    expect(areaDesperdicioCm2(panel)).toBe(46800.0);
  });

  it("suma las piezas colocadas y calcula el desperdicio restante (redondeado a 1 decimal)", () => {
    const panel = crearPanel(porDefectoVidrio());
    const pieza: PiezaVidrio = crearPiezaVidrio("sala", "Zoclo", 100.0, 50.0);
    panel.piezas.push({
      pieza,
      xCm: 0,
      yCm: 0,
      anchoCm: 100.0,
      altoCm: 50.0,
      rotada: false,
    });
    // 100 * 50 = 5000
    expect(areaUtilizadaCm2(panel)).toBe(5000.0);
    // 46800 - 5000 = 41800
    expect(areaDesperdicioCm2(panel)).toBe(41800.0);
  });
});

// --- ParametrosVidrio: areaPanelCm2 + validaciones --------------------------

describe("parametrosVidrio: areaPanelCm2 / porDefectoVidrio / validaciones", () => {
  it("porDefectoVidrio devuelve los valores por defecto del Java", () => {
    const p = porDefectoVidrio();
    expect(p.panelAnchoCm).toBe(180.0);
    expect(p.panelAltoCm).toBe(260.0);
    expect(p.materialAncho).toBe("Zoclo");
    expect(p.anchoAjusteCm).toBe(1.8);
    expect(p.materialesAlto).toEqual(["Cerco Fijo", "Cerco Corredizo"]);
    expect(p.altoAjusteCm).toBe(-9.3);
    expect(p.permitirRotacion).toBe(true);
  });

  it("areaPanelCm2 = panelAnchoCm * panelAltoCm", () => {
    expect(areaPanelCm2(porDefectoVidrio())).toBe(180.0 * 260.0);
  });

  it("lanza si las dimensiones del panel no son mayores a 0", () => {
    expect(() =>
      crearParametrosVidrio(0, 260, "Zoclo", 1.8, ["Cerco"], -9.3, true),
    ).toThrow("Las dimensiones del panel de vidrio deben ser mayores a 0");
    expect(() =>
      crearParametrosVidrio(180, -1, "Zoclo", 1.8, ["Cerco"], -9.3, true),
    ).toThrow("Las dimensiones del panel de vidrio deben ser mayores a 0");
  });

  it("lanza si el material base del ancho está vacío", () => {
    expect(() =>
      crearParametrosVidrio(180, 260, "   ", 1.8, ["Cerco"], -9.3, true),
    ).toThrow("El material base del ancho no puede estar vacío");
  });

  it("lanza si no hay materiales de alto", () => {
    expect(() =>
      crearParametrosVidrio(180, 260, "Zoclo", 1.8, [], -9.3, true),
    ).toThrow("Debe haber al menos un material de alto para el vidrio");
  });

  it("lanza si algún material de alto está vacío", () => {
    expect(() =>
      crearParametrosVidrio(180, 260, "Zoclo", 1.8, ["Cerco Fijo", "  "], -9.3, true),
    ).toThrow("Los materiales de alto del vidrio no pueden estar vacíos");
  });

  it("hace copia defensiva inmutable de los materiales de alto", () => {
    const materiales = ["Cerco Fijo", "Cerco Corredizo"];
    const p = crearParametrosVidrio(180, 260, "Zoclo", 1.8, materiales, -9.3, true);
    // Mutar el arreglo original no debe afectar los parámetros.
    materiales.push("Extra");
    expect(p.materialesAlto).toEqual(["Cerco Fijo", "Cerco Corredizo"]);
    // Y la copia debe estar congelada.
    expect(Object.isFrozen(p.materialesAlto)).toBe(true);
  });
});
