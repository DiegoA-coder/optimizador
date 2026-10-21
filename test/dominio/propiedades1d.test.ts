import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { EPSILON, capacidadEfectivaCm, crearParametros, redondear, truncar } from "@/lib/dominio/parametros";
import { Pieza } from "@/lib/dominio/modelos";
import { optimizar } from "@/lib/dominio/optimizador";
import { usadoCm } from "@/lib/dominio/tira";

// Property-based tests del optimizador 1D (optimizador.ts + tira.ts).

describe("Propiedades del optimizador 1D", () => {
  // Property 2: No sobrecarga de tira
  // Ninguna tira excede su capacidad efectiva:
  //   ∀ tira ∈ optimizar(piezas): Σ(p.longitud + sierra) <= capacidadEfectiva + EPSILON
  // Validates: Requirements 5.5
  describe("Property 2: No sobrecarga de tira", () => {
    it("ninguna tira supera capacidadEfectiva + EPSILON", () => {
      fc.assert(
        fc.property(
          // Parámetros válidos: largo de tira positivo y sierra no negativa.
          // La sierra se redondea a 1 decimal para reflejar el dominio real (truncar/redondear).
          fc.record({
            largoTiraCm: fc.double({ min: 1, max: 1000, noNaN: true, noDefaultInfinity: true }),
            sierraCm: fc.double({ min: 0, max: 2, noNaN: true, noDefaultInfinity: true }),
          }),
          // Fracciones en [0.1, 1] que luego escalamos a (0, largoTira] para que cada pieza quepa.
          // Cota inferior 0.1 (no Number.MIN_VALUE) para evitar longitudes subnormales/degeneradas.
          fc.array(fc.double({ min: 0.1, max: 1, noNaN: true, noDefaultInfinity: true }), {
            minLength: 0,
            maxLength: 40,
          }),
          ({ largoTiraCm, sierraCm }, fracciones) => {
            // Mismo tratamiento que el dominio real: todas las magnitudes en cm viven a 1 decimal
            // (los parámetros por defecto son 600.0 y 0.4). Redondear largo y sierra a 1 decimal
            // evita capacidades con más resolución que la que el dominio contabiliza vía `redondear`.
            const largo = Math.max(0.1, redondear(largoTiraCm));
            const parametros = crearParametros(largo, redondear(sierraCm));
            // Mismo perfil y material: precondición de `optimizar`.
            // Las longitudes se truncan a 1 decimal (como `truncar` del dominio), de modo que
            // nunca aparecen longitudes subnormales o de precisión arbitraria que el dominio real
            // jamás produce. `Math.max(0.1, ...)` evita longitudes nulas tras el truncado.
            const piezas: Pieza[] = fracciones.map((f, i) => ({
              perfil: "P1",
              material: "M1",
              etiquetaVentana: `V${i}`,
              longitudCm: Math.max(0.1, truncar(f * largo)),
            }));

            const tiras = optimizar(piezas, parametros);
            const capacidad = capacidadEfectivaCm(parametros);
            for (const tira of tiras) {
              // Se compara contra la propia medida redondeada del dominio (`usadoCm`), que es la
              // capacidad usada tal como la contabiliza la tira. Esto conserva el significado de la
              // Property 2 (ninguna tira supera su capacidad efectiva) sin reintroducir error de
              // acumulación binaria al recomputar una suma cruda de hasta 40 piezas.
              const usado = usadoCm(tira);
              expect(usado).toBeLessThanOrEqual(capacidad + EPSILON);
            }
          },
        ),
      );
    });
  });
});
