import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { EPSILON } from "@/lib/dominio/parametros";
import { PiezaVidrio, areaCm2, crearPiezaVidrio } from "@/lib/dominio/modelos";
import { porDefectoVidrio } from "@/lib/dominio/parametrosVidrio";
import { optimizarVidrio } from "@/lib/dominio/optimizadorVidrio";

// Property-based test del optimizador de vidrio 2D (optimizadorVidrio.ts).
// Valida la Correctness Property 4 del diseño.

describe("Propiedades del optimizador de vidrio (optimizadorVidrio.ts)", () => {
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

  // Property 4: Conservación de área de vidrio
  // La suma de áreas de las piezas colocadas en todos los paneles iguala la suma de áreas
  // de las piezas de entrada (tolerancia EPSILON).
  // Validates: Requirements 6.4
  describe("Property 4: Conservación de área de vidrio", () => {
    it("Σ áreas colocadas ≈ Σ áreas de entrada (tolerancia EPSILON)", () => {
      fc.assert(
        fc.property(arbPiezas, (piezas) => {
          const plan = optimizarVidrio(piezas, parametros);

          const areaColocadas = plan.paneles
            .flatMap((panel) => panel.piezas)
            .reduce((acc, c) => acc + c.anchoCm * c.altoCm, 0);

          const areaEntrada = piezas.reduce((acc, p) => acc + areaCm2(p), 0);

          expect(Math.abs(areaColocadas - areaEntrada)).toBeLessThanOrEqual(EPSILON);
        }),
      );
    });
  });
});
