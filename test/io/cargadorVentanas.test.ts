import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { Ventana, crearVentana } from "@/lib/dominio/modelos";
import { parsearVentanas, serializarVentanas } from "@/lib/io/cargadorVentanas";

// Tests de round-trip (ida y vuelta) y de errores de parseo de `cargadorVentanas`.
// Property: parsearVentanas(serializarVentanas(v)) ≡ v para listas de ventanas válidas.
// Validates: Requirements 4.5, 10.7

// --- Generadores ------------------------------------------------------------

// Texto no vacío (tras trim) para `etiqueta`/`perfil`. Se evita el carácter nulo y
// se asegura al menos un carácter visible para que `crearVentana` no lo rechace.
const textoNoVacio = fc
  .string({ minLength: 1, maxLength: 12 })
  .map((s) => s.replace(/\u0000/g, " "))
  .filter((s) => s.trim().length > 0);

// Medida positiva en cm con a lo sumo 1 decimal, construida desde un entero de "décimas de cm".
// Al dividir un entero entre 10 el valor sobrevive al round-trip JSON sin pérdida de precisión
// (p. ej. 1234 → 123.4) y se mantiene en un rango realista de centímetros.
const medidaCm = fc.integer({ min: 1, max: 100000 }).map((decimas) => decimas / 10);

// Cantidad: entero positivo en rango razonable.
const cantidad = fc.integer({ min: 1, max: 500 });

// Ventana válida construida con `crearVentana` para respetar las invariantes de dominio.
const ventanaArb: fc.Arbitrary<Ventana> = fc
  .record({
    etiqueta: textoNoVacio,
    perfil: textoNoVacio,
    inferiorCm: medidaCm,
    lateralCm: medidaCm,
    cantidad,
  })
  .map((v) => crearVentana(v.etiqueta, v.perfil, v.inferiorCm, v.lateralCm, v.cantidad));

const listaVentanasArb: fc.Arbitrary<Ventana[]> = fc.array(ventanaArb, { maxLength: 10 });

// --- Property: ida y vuelta -------------------------------------------------

describe("cargadorVentanas: round-trip parsear(serializar(v)) ≡ v", () => {
  // Validates: Requirements 4.5, 10.7
  it("parsearVentanas(serializarVentanas(v)) es igual a v para listas válidas", () => {
    fc.assert(
      fc.property(listaVentanasArb, (ventanas) => {
        const ida = parsearVentanas(serializarVentanas(ventanas));
        expect(ida).toEqual(ventanas);
      }),
    );
  });

  it("round-trip de un ejemplo concreto preserva todos los campos", () => {
    const ventanas = [
      crearVentana("V1", "corredera", 120.5, 90.3, 2),
      crearVentana("V2", "fija", 60, 150.1, 1),
    ];
    expect(parsearVentanas(serializarVentanas(ventanas))).toEqual(ventanas);
  });
});

// --- Errores de JSON mal formado con índice del elemento --------------------

describe("cargadorVentanas: errores de parseo", () => {
  it("rechaza cuando la raíz no es un arreglo", () => {
    expect(() => parsearVentanas('{"etiqueta":"V1"}')).toThrow(
      "El JSON debe ser un arreglo de ventanas",
    );
  });

  it("rechaza cuando un elemento no es un objeto, indicando su índice", () => {
    const json = JSON.stringify([
      { etiqueta: "V1", perfil: "p", inferiorCm: 100, lateralCm: 80, cantidad: 1 },
      42,
    ]);
    expect(() => parsearVentanas(json)).toThrow("Elemento 1: se esperaba un objeto");
  });

  it("rechaza un campo de texto con tipo incorrecto, indicando índice y campo", () => {
    const json = JSON.stringify([
      { etiqueta: 123, perfil: "p", inferiorCm: 100, lateralCm: 80, cantidad: 1 },
    ]);
    expect(() => parsearVentanas(json)).toThrow(
      "Elemento 0: el campo 'etiqueta' debe ser texto",
    );
  });

  it("rechaza un campo decimal con tipo incorrecto, indicando índice y campo", () => {
    const json = JSON.stringify([
      { etiqueta: "V1", perfil: "p", inferiorCm: "100", lateralCm: 80, cantidad: 1 },
    ]);
    expect(() => parsearVentanas(json)).toThrow(
      "Elemento 0: el campo 'inferiorCm' debe ser un número en cm",
    );
  });

  it("rechaza un campo entero no entero, indicando índice y campo", () => {
    const json = JSON.stringify([
      { etiqueta: "V1", perfil: "p", inferiorCm: 100, lateralCm: 80, cantidad: 1.5 },
    ]);
    expect(() => parsearVentanas(json)).toThrow(
      "Elemento 0: el campo 'cantidad' debe ser un entero",
    );
  });

  it("reporta el índice correcto cuando el error está en un elemento posterior", () => {
    const json = JSON.stringify([
      { etiqueta: "V1", perfil: "p", inferiorCm: 100, lateralCm: 80, cantidad: 1 },
      { etiqueta: "V2", perfil: 999, inferiorCm: 100, lateralCm: 80, cantidad: 1 },
    ]);
    expect(() => parsearVentanas(json)).toThrow("Elemento 1: el campo 'perfil' debe ser texto");
  });
});
