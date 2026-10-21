import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { EPSILON, crearParametros, redondear, truncar } from "@/lib/dominio/parametros";
import { Pieza } from "@/lib/dominio/modelos";
import { optimizar } from "@/lib/dominio/optimizador";

// Property-based tests de las utilidades aritméticas base (parametros.ts).
// Validan las Correctness Properties 7 y 8 del diseño.

describe("Propiedades aritméticas de parametros.ts", () => {
  // Property 7: Idempotencia aritmética del truncado
  // truncar(truncar(v)) == truncar(v) y truncar(v) <= v + EPSILON.
  // Validates: Requirements 7.2, 7.3, 7.4
  describe("Property 7: Idempotencia aritmética del truncado", () => {
    it("truncar es idempotente: truncar(truncar(v)) === truncar(v)", () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 1e6, noNaN: true, noDefaultInfinity: true }),
          (v) => {
            const una = truncar(v);
            const dos = truncar(una);
            expect(dos).toBe(una);
          },
        ),
      );
    });

    it("truncar nunca excede el valor original más EPSILON: truncar(v) <= v + EPSILON", () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 1e6, noNaN: true, noDefaultInfinity: true }),
          (v) => {
            expect(truncar(v)).toBeLessThanOrEqual(v + EPSILON);
          },
        ),
      );
    });
  });

  // Property 8: Paridad de redondeo
  // Para v >= 0, redondear(v) reproduce Math.round(v*10)/10 de Java (coincide por ser v no negativo).
  // Validates: Requirements 7.2, 7.3, 7.4
  describe("Property 8: Paridad de redondeo", () => {
    it("redondear(v) reproduce Math.round(v*10)/10 para v >= 0", () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 1e6, noNaN: true, noDefaultInfinity: true }),
          (v) => {
            expect(redondear(v)).toBe(Math.round(v * 10) / 10);
          },
        ),
      );
    });
  });
});

// Property-based test del optimizador 1D (optimizador.ts).
// Valida la Correctness Property 1 del diseño.

describe("Propiedades del optimizador 1D (optimizador.ts)", () => {
  const LARGO_TIRA = 600.0;
  const SIERRA = 0.4;
  const parametros = crearParametros(LARGO_TIRA, SIERRA);

  /**
   * Cuenta las piezas por longitud: devuelve un Map longitudCm -> cantidad.
   * Como todas las piezas comparten perfil/material/etiqueta, la longitud identifica
   * el multiconjunto por completo.
   */
  function conteoPorLongitud(piezas: readonly Pieza[]): Map<number, number> {
    const conteo = new Map<number, number>();
    for (const pieza of piezas) {
      conteo.set(pieza.longitudCm, (conteo.get(pieza.longitudCm) ?? 0) + 1);
    }
    return conteo;
  }

  // Generador de piezas del mismo perfil/material con longitud en (0, largoTira].
  // Truncamos a 1 decimal (como el dominio) y descartamos el 0 para respetar el rango abierto.
  const arbPiezas = fc.array(
    fc
      .double({ min: 0.1, max: LARGO_TIRA, noNaN: true, noDefaultInfinity: true })
      .map((v) => Math.max(0.1, Math.min(LARGO_TIRA, Math.round(v * 10) / 10)))
      .map(
        (longitudCm): Pieza => ({
          perfil: "P1",
          material: "aluminio",
          etiquetaVentana: "V1",
          longitudCm,
        }),
      ),
    { minLength: 0, maxLength: 40 },
  );

  // Property 1: Conservación de piezas (BFD 1D)
  // El multiconjunto de piezas de todas las tiras iguala la entrada.
  // Validates: Requirements 5.4
  describe("Property 1: Conservación de piezas (BFD 1D)", () => {
    it("el multiconjunto de piezas de todas las tiras iguala la entrada", () => {
      fc.assert(
        fc.property(arbPiezas, (piezas) => {
          const tiras = optimizar(piezas, parametros);
          const salida = tiras.flatMap((tira) => [...tira.piezas]);

          // Mismo número total de piezas.
          expect(salida.length).toBe(piezas.length);

          // Mismo multiconjunto (comparado por conteo de longitudes, independiente del orden).
          expect(conteoPorLongitud(salida)).toEqual(conteoPorLongitud(piezas));
        }),
      );
    });
  });
});
