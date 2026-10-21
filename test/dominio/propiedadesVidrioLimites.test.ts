import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { EPSILON } from "@/lib/dominio/parametros";
import { PiezaVidrio, crearPiezaVidrio, xFinCm, yFinCm } from "@/lib/dominio/modelos";
import { porDefectoVidrio } from "@/lib/dominio/parametrosVidrio";
import { optimizarVidrio } from "@/lib/dominio/optimizadorVidrio";

// Property-based test del optimizador de vidrio 2D (optimizadorVidrio.ts).

describe("Propiedades del optimizador de vidrio 2D (límites)", () => {
  const parametros = porDefectoVidrio();

  // Generador de piezas de vidrio que QUEPAN en el panel por defecto (180 x 260).
  // Se construyen a partir de fracciones en (0, 1] escaladas a las dimensiones del panel
  // y truncadas a 1 decimal (como el dominio); se garantiza un mínimo positivo para
  // respetar la invariante `ancho > 0, alto > 0` de `crearPiezaVidrio`.
  const arbPiezas = fc.array(
    fc
      .record({
        fAncho: fc.double({ min: Number.MIN_VALUE, max: 1, noNaN: true }),
        fAlto: fc.double({ min: Number.MIN_VALUE, max: 1, noNaN: true }),
      })
      .map(({ fAncho, fAlto }): PiezaVidrio => {
        const anchoCm = Math.max(
          0.1,
          Math.min(parametros.panelAnchoCm, Math.round(fAncho * parametros.panelAnchoCm * 10) / 10),
        );
        const altoCm = Math.max(
          0.1,
          Math.min(parametros.panelAltoCm, Math.round(fAlto * parametros.panelAltoCm * 10) / 10),
        );
        return crearPiezaVidrio("V", "Perfil", anchoCm, altoCm);
      }),
    { minLength: 0, maxLength: 30 },
  );

  // Property 5: Dentro del panel (límites)
  // Para toda pieza colocada en cualquier panel:
  //   0 <= x, 0 <= y, xFin <= panelAncho + EPSILON, yFin <= panelAlto + EPSILON
  // Validates: Requirements 6.5
  describe("Property 5: Dentro del panel (límites)", () => {
    it("toda pieza colocada queda dentro de los límites del panel", () => {
      fc.assert(
        fc.property(arbPiezas, (piezas) => {
          const plan = optimizarVidrio(piezas, parametros);
          for (const panel of plan.paneles) {
            for (const colocada of panel.piezas) {
              expect(colocada.xCm).toBeGreaterThanOrEqual(0);
              expect(colocada.yCm).toBeGreaterThanOrEqual(0);
              expect(xFinCm(colocada)).toBeLessThanOrEqual(parametros.panelAnchoCm + EPSILON);
              expect(yFinCm(colocada)).toBeLessThanOrEqual(parametros.panelAltoCm + EPSILON);
            }
          }
        }),
      );
    });
  });
});
