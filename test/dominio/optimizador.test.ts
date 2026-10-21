import { describe, expect, it } from "vitest";

import { Parametros, crearParametros } from "@/lib/dominio/parametros";
import { Pieza } from "@/lib/dominio/modelos";
import { optimizar, planificar } from "@/lib/dominio/optimizador";
import { tirasDePerfil, tirasNumeradas } from "@/lib/dominio/planCorte";

// Tests unitarios de la optimización 1D del aluminio.
// Portan OptimizadorTest del proyecto Java y verifican paridad de comportamiento:
// Best Fit Decreasing (piezas que caben usan una sola tira, piezas grandes abren otra),
// planificación que separa por perfil/material, numeración continua por perfil y
// desperdicio total positivo.
// Validates: Requirements 5.2, 5.3, 5.6

const parametros: Parametros = crearParametros(600.0, 0.4);

/** Helper para construir piezas con la forma del dominio (equivale a `new Pieza(...)` del Java). */
function pieza(perfil: string, material: string, etiquetaVentana: string, longitudCm: number): Pieza {
  return { perfil, material, etiquetaVentana, longitudCm };
}

describe("optimizar", () => {
  it("piezas que caben en una tira usan una sola", () => {
    const piezas: Pieza[] = [
      pieza("2PULG", "X", "a", 300.0),
      pieza("2PULG", "X", "b", 250.0),
    ];
    const tiras = optimizar(piezas, parametros);
    expect(tiras).toHaveLength(1);
  });

  it("piezas que no caben abren otra tira", () => {
    const piezas: Pieza[] = [
      pieza("2PULG", "X", "a", 400.0),
      pieza("2PULG", "X", "b", 400.0),
    ];
    const tiras = optimizar(piezas, parametros);
    expect(tiras).toHaveLength(2);
  });
});

describe("planificar", () => {
  it("separa por perfil y material", () => {
    const piezas: Pieza[] = [
      pieza("2PULG", "Riel", "a", 100.0),
      pieza("2PULG", "Zoclo", "a", 100.0),
      pieza("3PULG", "Riel", "b", 100.0),
    ];
    const plan = planificar(piezas, parametros);

    expect(plan.perfiles).toEqual(["2PULG", "3PULG"]);
    // 2PULG tiene Riel y Zoclo (barras separadas) -> 2 tiras
    expect(tirasDePerfil(plan, "2PULG")).toBe(2);
    expect(tirasDePerfil(plan, "3PULG")).toBe(1);
    expect(plan.totalTiras).toBe(3);
  });

  it("la numeración de tiras es continua por perfil", () => {
    const piezas: Pieza[] = [
      pieza("2PULG", "Riel", "a", 100.0),
      pieza("2PULG", "Zoclo", "a", 100.0),
    ];
    const plan = planificar(piezas, parametros);
    const tiras = tirasNumeradas(plan, "2PULG");
    expect(tiras[0].numero).toBe(1);
    expect(tiras[1].numero).toBe(2);
  });

  it("el desperdicio total es positivo", () => {
    const piezas: Pieza[] = [pieza("2PULG", "X", "a", 100.0)];
    const plan = planificar(piezas, parametros);
    expect(plan.desperdicioTotal).toBeGreaterThan(0);
  });
});
