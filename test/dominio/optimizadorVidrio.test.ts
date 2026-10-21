import { describe, expect, it } from "vitest";

import {
  Panel,
  PiezaColocada,
  PiezaVidrio,
  crearPiezaVidrio,
  xFinCm,
  yFinCm,
} from "@/lib/dominio/modelos";
import {
  ParametrosVidrio,
  crearParametrosVidrio,
  porDefectoVidrio,
} from "@/lib/dominio/parametrosVidrio";
import { optimizarVidrio } from "@/lib/dominio/optimizadorVidrio";
import { totalPaneles, totalPiezas, aprovechamientoPct } from "@/lib/dominio/planVidrio";

// Tests unitarios del empaquetado 2D de vidrio.
// Portan OptimizadorVidrioTest del proyecto Java y verifican paridad de comportamiento:
// colocación básica (varias piezas en un panel), apertura de paneles nuevos para piezas
// grandes, rotación 90° cuando una pieza no cabe en orientación normal, error cuando una
// pieza no cabe sin rotación, y las invariantes de que las piezas colocadas no se salen
// del panel ni se solapan.
// Validates: Requirements 6.2, 6.3, 10.5

const pv: ParametrosVidrio = porDefectoVidrio(); // 180 x 260

const EPS = 1e-6;

/** ¿Dos piezas colocadas se solapan? Porta el helper `seSolapan` del test Java. */
function seSolapan(a: PiezaColocada, b: PiezaColocada): boolean {
  return (
    a.xCm < xFinCm(b) - EPS &&
    b.xCm < xFinCm(a) - EPS &&
    a.yCm < yFinCm(b) - EPS &&
    b.yCm < yFinCm(a) - EPS
  );
}

describe("optimizarVidrio", () => {
  it("dos piezas que caben usan un panel", () => {
    const piezas: PiezaVidrio[] = [
      crearPiezaVidrio("sala", "2PULG", 83.4, 106.7),
      crearPiezaVidrio("sala", "2PULG", 83.4, 106.7),
    ];
    const plan = optimizarVidrio(piezas, pv);
    expect(totalPaneles(plan)).toBe(1);
    expect(totalPiezas(plan)).toBe(2);
  });

  it("piezas grandes abren más paneles", () => {
    // Cada pieza ocupa casi todo el panel -> una pieza por panel
    const piezas: PiezaVidrio[] = [
      crearPiezaVidrio("a", "2PULG", 175.0, 255.0),
      crearPiezaVidrio("b", "2PULG", 175.0, 255.0),
    ];
    const plan = optimizarVidrio(piezas, pv);
    expect(totalPaneles(plan)).toBe(2);
  });

  it("una pieza más larga que el panel se rota para caber", () => {
    // 250 de "ancho" no cabe en 180, pero rotada (250 de alto <= 260) sí.
    const piezas: PiezaVidrio[] = [crearPiezaVidrio("a", "2PULG", 250.0, 100.0)];
    const plan = optimizarVidrio(piezas, pv);
    expect(totalPaneles(plan)).toBe(1);
    const c = plan.paneles[0].piezas[0];
    expect(c.rotada).toBe(true);
  });

  it("sin rotación una pieza que no cabe falla", () => {
    const sinRot = crearParametrosVidrio(
      180,
      260,
      "Zoclo",
      1.5,
      ["Cerco Fijo", "Cerco Corredizo"],
      -9.5,
      false,
    );
    const piezas: PiezaVidrio[] = [crearPiezaVidrio("a", "2PULG", 250.0, 100.0)];
    expect(() => optimizarVidrio(piezas, sinRot)).toThrow();
  });

  it("las piezas colocadas no se salen del panel ni se solapan", () => {
    const piezas: PiezaVidrio[] = [
      crearPiezaVidrio("a", "2PULG", 83.4, 106.7),
      crearPiezaVidrio("a", "2PULG", 83.4, 106.7),
      crearPiezaVidrio("b", "2PULG", 90.0, 120.0),
      crearPiezaVidrio("b", "2PULG", 90.0, 120.0),
    ];
    const plan = optimizarVidrio(piezas, pv);

    for (const panel of plan.paneles as readonly Panel[]) {
      const cs = panel.piezas;
      // Dentro de los límites del panel
      for (const c of cs) {
        expect(c.xCm).toBeGreaterThanOrEqual(-EPS);
        expect(c.yCm).toBeGreaterThanOrEqual(-EPS);
        expect(xFinCm(c)).toBeLessThanOrEqual(panel.anchoCm + EPS);
        expect(yFinCm(c)).toBeLessThanOrEqual(panel.altoCm + EPS);
      }
      // Sin solapamiento entre pares
      for (let i = 0; i < cs.length; i++) {
        for (let j = i + 1; j < cs.length; j++) {
          expect(seSolapan(cs[i], cs[j])).toBe(false);
        }
      }
    }
  });

  it("el aprovechamiento está entre 0 y 100", () => {
    const piezas: PiezaVidrio[] = [crearPiezaVidrio("a", "2PULG", 83.4, 106.7)];
    const plan = optimizarVidrio(piezas, pv);
    const pct = aprovechamientoPct(plan);
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThanOrEqual(100);
  });
});
