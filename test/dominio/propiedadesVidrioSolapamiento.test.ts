import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { EPSILON } from "@/lib/dominio/parametros";
import {
  PiezaColocada,
  PiezaVidrio,
  crearPiezaVidrio,
  xFinCm,
  yFinCm,
} from "@/lib/dominio/modelos";
import { porDefectoVidrio } from "@/lib/dominio/parametrosVidrio";
import { optimizarVidrio } from "@/lib/dominio/optimizadorVidrio";

// Property-based test del optimizador de vidrio 2D (optimizadorVidrio.ts).
// Valida la Correctness Property 6 del diseño (no solapamiento 2D).

describe("Propiedades del optimizador de vidrio: no solapamiento (optimizadorVidrio.ts)", () => {
  const parametros = porDefectoVidrio();

  // Generador de piezas de vidrio que caben en el panel por defecto (180 x 260 cm).
  // Ancho en (0, panelAncho] y alto en (0, panelAlto], truncados a 1 decimal (como el dominio)
  // y acotados fuera del 0 para respetar el rango abierto de crearPiezaVidrio.
  const dim = (max: number) =>
    fc
      .double({ min: 0.1, max, noNaN: true, noDefaultInfinity: true })
      .map((v) => Math.max(0.1, Math.min(max, Math.round(v * 10) / 10)));

  const arbPiezas = fc.array(
    fc
      .tuple(dim(parametros.panelAnchoCm), dim(parametros.panelAltoCm))
      .map(([anchoCm, altoCm]): PiezaVidrio =>
        crearPiezaVidrio("V1", "Cerco Fijo", anchoCm, altoCm),
      ),
    { minLength: 0, maxLength: 30 },
  );

  // Dos rectángulos (alineados a los ejes) NO se solapan si uno queda
  // completamente a la izquierda/derecha/abajo/arriba del otro. Se admite el
  // contacto en los bordes dentro de la tolerancia EPSILON.
  const noSeSolapan = (a: PiezaColocada, b: PiezaColocada): boolean =>
    xFinCm(a) <= b.xCm + EPSILON ||
    xFinCm(b) <= a.xCm + EPSILON ||
    yFinCm(a) <= b.yCm + EPSILON ||
    yFinCm(b) <= a.yCm + EPSILON;

  // Property 6: No solapamiento 2D
  // Dentro de un mismo panel, ningún par de piezas colocadas se solapa.
  // Validates: Requirements 6.6
  describe("Property 6: No solapamiento 2D", () => {
    it("ningún par de piezas colocadas en un panel se solapa (tolerancia EPSILON)", () => {
      fc.assert(
        fc.property(arbPiezas, (piezas) => {
          const plan = optimizarVidrio(piezas, parametros);

          for (const panel of plan.paneles) {
            const colocadas = panel.piezas;
            for (let i = 0; i < colocadas.length; i++) {
              for (let j = i + 1; j < colocadas.length; j++) {
                expect(noSeSolapan(colocadas[i], colocadas[j])).toBe(true);
              }
            }
          }
        }),
      );
    });
  });
});
