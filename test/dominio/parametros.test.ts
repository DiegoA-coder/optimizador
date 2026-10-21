import { describe, expect, it } from "vitest";
import {
  EPSILON,
  LARGO_TIRA_POR_DEFECTO,
  SIERRA_POR_DEFECTO,
  capacidadEfectivaCm,
  cm,
  crearParametros,
  porDefecto,
  redondear,
  truncar,
} from "@/lib/dominio/parametros";

// Tests unitarios de lib/dominio/parametros.ts.
// Portan los casos de config.ParametrosTest del proyecto Java para garantizar
// paridad numérica, cubriendo valores por defecto, validaciones y mensajes de error.

describe("parametros", () => {
  describe("valores por defecto", () => {
    it("expone las constantes por defecto del Java", () => {
      expect(LARGO_TIRA_POR_DEFECTO).toBe(600.0);
      expect(SIERRA_POR_DEFECTO).toBe(0.4);
      expect(EPSILON).toBe(1e-6);
    });

    it("porDefecto() usa largoTiraCm=600 y sierraCm=0.4", () => {
      const p = porDefecto();
      expect(p.largoTiraCm).toBe(600.0);
      expect(p.sierraCm).toBe(0.4);
    });
  });

  describe("capacidadEfectivaCm", () => {
    // Porta capacidadEfectivaSumaLargoYSierra.
    it("suma el largo de la tira y la sierra", () => {
      const p = crearParametros(600.0, 0.4);
      expect(capacidadEfectivaCm(p)).toBeCloseTo(600.4, 9);
    });

    it("capacidadEfectivaCm === largoTiraCm + sierraCm", () => {
      const casos: ReadonlyArray<readonly [number, number]> = [
        [600.0, 0.4],
        [300.0, 0.0],
        [123.5, 2.5],
        [1.0, 10.0],
      ];
      for (const [largo, sierra] of casos) {
        const p = crearParametros(largo, sierra);
        expect(capacidadEfectivaCm(p)).toBe(largo + sierra);
      }
    });
  });

  describe("redondear", () => {
    // Porta redondearDejaUnDecimal.
    it("deja un decimal", () => {
      expect(redondear(117.16)).toBeCloseTo(117.2, 9);
      expect(redondear(81.85)).toBeCloseTo(81.9, 9);
    });
  });

  describe("truncar", () => {
    it("trunca a 1 decimal hacia abajo", () => {
      expect(truncar(23.15)).toBeCloseTo(23.1, 9);
      expect(truncar(23.19)).toBeCloseTo(23.1, 9);
    });

    it("el EPSILON evita el arrastre de error de punto flotante", () => {
      // 23.1999999 proviene de un error de punto flotante sobre 23.2; el EPSILON
      // empuja el valor hacia arriba para que no caiga indebidamente a 23.1.
      expect(truncar(23.1999999)).toBeCloseTo(23.2, 9);
    });
  });

  describe("cm", () => {
    // Porta cmFormateaConPuntoYUnDecimal.
    it("formatea con punto y un decimal", () => {
      expect(cm(117.2)).toBe("117.2");
      expect(cm(88.0)).toBe("88.0");
    });
  });

  describe("validaciones", () => {
    // Porta rechazaLargoNoPositivo.
    it("rechaza largo no positivo con el mensaje exacto", () => {
      expect(() => crearParametros(0, 0.4)).toThrow(
        "El largo de la tira debe ser mayor a 0",
      );
    });

    it("rechaza largo negativo", () => {
      expect(() => crearParametros(-10, 0.4)).toThrow(
        "El largo de la tira debe ser mayor a 0",
      );
    });

    // Porta rechazaSierraNegativa.
    it("rechaza sierra negativa con el mensaje exacto", () => {
      expect(() => crearParametros(600, -1)).toThrow(
        "La sierra (kerf) no puede ser negativa",
      );
    });

    it("acepta sierra cero", () => {
      const p = crearParametros(600, 0);
      expect(p.sierraCm).toBe(0);
    });
  });
});
