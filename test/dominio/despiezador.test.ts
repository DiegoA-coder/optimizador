import { describe, expect, it } from "vitest";

import { Parametros, crearParametros } from "@/lib/dominio/parametros";
import {
  ReglaCorte,
  Ventana,
  crearReglaCorte,
  crearVentana,
} from "@/lib/dominio/modelos";
import { expandir, nombreCorte } from "@/lib/dominio/despiezador";

// Tests unitarios del despiece de aluminio.
// Portan DespiezadorTest del proyecto Java y verifican paridad de comportamiento:
// expansión por cantidad de regla y de ventana, numeración de unidades, y error
// cuando el perfil no tiene reglas. También cubren la normalización de nombreCorte.
// Validates: Requirements 5.1, 10.1

const parametros: Parametros = crearParametros(600.0, 0.4);

describe("expandir", () => {
  it("expande según cantidad de regla y de ventana", () => {
    const reglas: Record<string, ReglaCorte[]> = {
      "2PULG": [
        crearReglaCorte("Riel", 1, "INFERIOR", 0, 1),
        crearReglaCorte("Zoclo", 2, "INFERIOR", 16.2, 2),
      ],
    };
    const ventanas: Ventana[] = [crearVentana("sala", "2PULG", 180.0, 119.0, 2)];

    const piezas = expandir(ventanas, reglas, parametros);

    // (1 + 2) reglas x 2 unidades = 6 piezas
    expect(piezas).toHaveLength(6);
    // La ventana con cantidad > 1 numera las unidades
    expect(piezas.some((p) => p.etiquetaVentana === "sala #1")).toBe(true);
    expect(piezas.some((p) => p.etiquetaVentana === "sala #2")).toBe(true);
  });

  it("falla si el perfil no tiene reglas", () => {
    const reglas: Record<string, ReglaCorte[]> = {
      "2PULG": [crearReglaCorte("Riel", 1, "INFERIOR", 0, 1)],
    };
    const ventanas: Ventana[] = [crearVentana("x", "3PULG", 100.0, 100.0, 1)];

    expect(() => expandir(ventanas, reglas, parametros)).toThrow();
  });
});

describe("nombreCorte", () => {
  it("normaliza las variantes de 'cerco traslape' a 'Cerco Traslape'", () => {
    expect(nombreCorte("Cerco Traslape Fijo")).toBe("Cerco Traslape");
    expect(nombreCorte("Cerco Traslape Corredizo")).toBe("Cerco Traslape");
  });

  it("normaliza las variantes de 'cerco' a 'Cerco'", () => {
    expect(nombreCorte("Cerco Fijo")).toBe("Cerco");
    expect(nombreCorte("Cerco Corredizo")).toBe("Cerco");
  });

  it("deja intactos los materiales que no empiezan con 'cerco'", () => {
    expect(nombreCorte("Riel")).toBe("Riel");
    expect(nombreCorte("Zoclo")).toBe("Zoclo");
  });
});
