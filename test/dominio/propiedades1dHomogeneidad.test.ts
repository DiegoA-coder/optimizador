import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { crearParametros } from "@/lib/dominio/parametros";
import { Pieza } from "@/lib/dominio/modelos";
import { planificar } from "@/lib/dominio/optimizador";

// Property-based test del optimizador 1D (optimizador.ts -> planificar).

describe("Propiedades del optimizador 1D (homogeneidad)", () => {
  // Property 3: Homogeneidad de tira
  // Toda tira de `planificar` tiene un único perfil y un único material:
  //   ∀ perfil, ∀ material, ∀ tira ∈ planCorte.porPerfilMaterial[perfil][material]:
  //     todas las piezas de la tira comparten el mismo perfil (= perfil) y el mismo material (= material).
  // Validates: Requirements 5.2, 5.6
  describe("Property 3: Homogeneidad de tira", () => {
    it("toda tira contiene piezas de un único perfil y un único material", () => {
      // Conjuntos pequeños de perfiles y materiales para que las piezas varíen de verdad.
      const perfiles = ["P1", "P2", "P3"];
      const materiales = ["M1", "M2", "M3"];

      fc.assert(
        fc.property(
          // Parámetros válidos: largo de tira positivo y sierra no negativa.
          fc.record({
            largoTiraCm: fc.double({ min: 1, max: 1000, noNaN: true, noDefaultInfinity: true }),
            sierraCm: fc.double({ min: 0, max: 2, noNaN: true, noDefaultInfinity: true }),
          }),
          // Cada pieza: índice de perfil, índice de material y una fracción en (0, 1]
          // que escalamos a (0, largoTira] para que la pieza siempre quepa en una tira.
          fc.array(
            fc.record({
              perfilIdx: fc.integer({ min: 0, max: perfiles.length - 1 }),
              materialIdx: fc.integer({ min: 0, max: materiales.length - 1 }),
              fraccion: fc.double({ min: Number.MIN_VALUE, max: 1, noNaN: true }),
            }),
            { minLength: 0, maxLength: 50 },
          ),
          ({ largoTiraCm, sierraCm }, especificaciones) => {
            const parametros = crearParametros(largoTiraCm, sierraCm);
            const piezas: Pieza[] = especificaciones.map((e, i) => ({
              perfil: perfiles[e.perfilIdx],
              material: materiales[e.materialIdx],
              etiquetaVentana: `V${i}`,
              longitudCm: e.fraccion * largoTiraCm,
            }));

            const plan = planificar(piezas, parametros);

            // Enumerar todas las tiras a través de perfiles y materiales. La clave del grupo
            // (perfil, material) es la referencia esperada: cada pieza de cada tira del grupo
            // debe coincidir con ella.
            for (const [perfil, porMaterial] of plan.porPerfilMaterial) {
              for (const [material, tiras] of porMaterial) {
                for (const tira of tiras) {
                  for (const pieza of tira.piezas) {
                    expect(pieza.perfil).toBe(perfil);
                    expect(pieza.material).toBe(material);
                  }
                }
              }
            }
          },
        ),
      );
    });
  });
});
