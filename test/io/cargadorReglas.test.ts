import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import {
  ConfiguracionCorte,
  Medida,
  ReglaCorte,
  crearReglaCorte,
} from "@/lib/dominio/modelos";
import { Parametros, crearParametros } from "@/lib/dominio/parametros";
import {
  ParametrosVidrio,
  crearParametrosVidrio,
} from "@/lib/dominio/parametrosVidrio";
import { parsearEnv, serializarEnv } from "@/lib/io/cargadorReglas";

// Tests de round-trip (ida y vuelta) y de errores de parseo de `cargadorReglas`.
// Property: parsearEnv(serializarEnv(config)) ≡ config para configuraciones válidas.
// Portan además `io.CargadorReglasTest` del proyecto Java (parseo de parámetros/reglas,
// valores por defecto, vidrio) y los errores con número de línea.
// Validates: Requirements 4.6, 10.6

// --- Generadores ------------------------------------------------------------

// Decimal positivo con a lo sumo 1 decimal, construido desde un entero de "décimas".
// Al dividir un entero entre 10 el valor sobrevive al round-trip de texto sin pérdida
// de precisión (p. ej. 6050 → 605) y `String()`/`Number()` lo reconstruyen idéntico.
const decimalPositivo = fc.integer({ min: 1, max: 1_000_000 }).map((d) => d / 10);

// Decimal con signo (puede ser 0 o negativo), también a 1 decimal como máximo.
// Se usa para ajustes de vidrio y descuentos, que admiten valores <= 0.
const decimalConSigno = fc.integer({ min: -1_000_000, max: 1_000_000 }).map((d) => d / 10);

// Descuento de regla: >= 0 (invariante de `crearReglaCorte`).
const descuentoCm = fc.integer({ min: 0, max: 1_000_000 }).map((d) => d / 10);

// Entero positivo (cantidad/divisor de regla).
const enteroPositivo = fc.integer({ min: 1, max: 500 });

// Texto de un material: no vacío tras trim y sin caracteres que rompan el formato `.env`.
// Se excluyen '|' (separador de campos de regla), ',' (separador de materialesAlto),
// '#'/'=' (sintaxis de clave/comentario) y los saltos de línea. Se evitan además los
// espacios al borde porque el parser hace trim y no sobrevivirían al round-trip.
const textoMaterial = fc
  .string({ minLength: 1, maxLength: 12 })
  .map((s) => s.replace(/[|,#=\r\n\u0000]/g, " ").trim())
  .filter((s) => s.length > 0);

// Nombre de perfil: alfanumérico no vacío. `perfilDeClave` separa por el último '_'
// de `REGLA_<perfil>_<n>`, así que se restringe a caracteres seguros que no interfieran
// con esa partición ni con la sintaxis del `.env`.
const perfil = fc
  .string({ minLength: 1, maxLength: 8, unit: fc.constantFrom(..."ABCDEFGHIJ0123456789".split("")) })
  .filter((s) => s.length > 0);

const base: fc.Arbitrary<Medida> = fc.constantFrom<Medida>("INFERIOR", "LATERAL");

// Regla de corte válida construida con `crearReglaCorte` para respetar las invariantes.
const reglaArb: fc.Arbitrary<ReglaCorte> = fc
  .record({
    material: textoMaterial,
    cantidad: enteroPositivo,
    base,
    descuentoCm,
    divisor: enteroPositivo,
  })
  .map((r) => crearReglaCorte(r.material, r.cantidad, r.base, r.descuentoCm, r.divisor));

const parametrosArb: fc.Arbitrary<Parametros> = fc
  // `sierraCm` debe ser > 0: el formato `.env` usa `decimalPositivo` para SIERRA_CM (igual
  // que el Java `case "SIERRA_CM" -> decimalPositivo(...)`), así que un sierra de 0 no
  // sobrevive al round-trip. Se restringe el generador a [0.1, 100] (min 1 décima).
  .record({ largoTiraCm: decimalPositivo, sierraCm: fc.integer({ min: 1, max: 1000 }).map((d) => d / 10) })
  .map((p) => crearParametros(p.largoTiraCm, p.sierraCm));

const parametrosVidrioArb: fc.Arbitrary<ParametrosVidrio> = fc
  .record({
    panelAnchoCm: decimalPositivo,
    panelAltoCm: decimalPositivo,
    materialAncho: textoMaterial,
    anchoAjusteCm: decimalConSigno,
    materialesAlto: fc.array(textoMaterial, { minLength: 1, maxLength: 4 }),
    altoAjusteCm: decimalConSigno,
    permitirRotacion: fc.boolean(),
  })
  .map((v) =>
    crearParametrosVidrio(
      v.panelAnchoCm,
      v.panelAltoCm,
      v.materialAncho,
      v.anchoAjusteCm,
      v.materialesAlto,
      v.altoAjusteCm,
      v.permitirRotacion,
    ),
  );

// Configuración completa con al menos una regla (el parser falla si no hay ninguna).
const configArb: fc.Arbitrary<ConfiguracionCorte> = fc
  .record({
    parametros: parametrosArb,
    parametrosVidrio: parametrosVidrioArb,
    // Mapa no vacío perfil -> lista no vacía de reglas.
    reglasPorPerfil: fc
      .dictionary(perfil, fc.array(reglaArb, { minLength: 1, maxLength: 3 }), {
        minKeys: 1,
        maxKeys: 4,
      }),
  })
  .map((c) => ({
    parametros: c.parametros,
    parametrosVidrio: c.parametrosVidrio,
    reglasPorPerfil: c.reglasPorPerfil,
  }));

// --- Property: ida y vuelta -------------------------------------------------

describe("cargadorReglas: round-trip parsearEnv(serializarEnv(config)) ≡ config", () => {
  // Validates: Requirements 4.6, 10.6
  it("parsearEnv(serializarEnv(config)) es igual a config para configuraciones válidas", () => {
    fc.assert(
      fc.property(configArb, (config) => {
        const ida = parsearEnv(serializarEnv(config));
        expect(ida).toEqual(config);
      }),
    );
  });

  it("round-trip de un ejemplo concreto preserva parámetros, vidrio y reglas", () => {
    const config: ConfiguracionCorte = {
      parametros: crearParametros(605, 0.4),
      parametrosVidrio: crearParametrosVidrio(
        200,
        300,
        "Zoclo",
        2,
        ["Cerco Fijo", "Cerco Corredizo"],
        -10,
        false,
      ),
      reglasPorPerfil: {
        "2PULG": [
          crearReglaCorte("Riel", 1, "INFERIOR", 0, 1),
          crearReglaCorte("Zoclo", 2, "INFERIOR", 16.2, 2),
        ],
        "3PULG": [crearReglaCorte("Riel", 1, "LATERAL", 0, 1)],
      },
    };
    expect(parsearEnv(serializarEnv(config))).toEqual(config);
  });
});

// --- Port de CargadorReglasTest (Java) --------------------------------------

describe("cargadorReglas: parseo de parámetros y reglas (port de CargadorReglasTest)", () => {
  it("parsea parámetros y reglas agrupadas por perfil", () => {
    const texto = [
      "# comentario",
      "LARGO_TIRA_CM=605",
      "SIERRA_CM=0.4",
      "REGLA_2PULG_1=Riel|1|INFERIOR|0|1",
      "REGLA_2PULG_2=Zoclo|2|INFERIOR|16.2|2",
      "REGLA_3PULG_1=Riel|1|INFERIOR|0|1",
    ].join("\n");

    const c = parsearEnv(texto);

    expect(c.parametros.largoTiraCm).toBeCloseTo(605.0, 9);
    expect(c.parametros.sierraCm).toBeCloseTo(0.4, 9);
    expect(c.reglasPorPerfil["2PULG"]).toBeDefined();
    expect(c.reglasPorPerfil["3PULG"]).toBeDefined();
    expect(c.reglasPorPerfil["2PULG"]).toHaveLength(2);

    const zoclo = c.reglasPorPerfil["2PULG"][1];
    expect(zoclo.material).toBe("Zoclo");
    expect(zoclo.cantidad).toBe(2);
    expect(zoclo.base).toBe("INFERIOR");
    expect(zoclo.descuentoCm).toBeCloseTo(16.2, 9);
    expect(zoclo.divisor).toBe(2);
  });

  it("usa valores por defecto si faltan parámetros", () => {
    const c = parsearEnv("REGLA_2PULG_1=Riel|1|INFERIOR|0|1");
    expect(c.parametros.largoTiraCm).toBeCloseTo(600.0, 9);
    expect(c.parametros.sierraCm).toBeCloseTo(0.4, 9);
    expect(c.parametrosVidrio.panelAnchoCm).toBeCloseTo(180.0, 9);
    expect(c.parametrosVidrio.panelAltoCm).toBeCloseTo(260.0, 9);
    expect(c.parametrosVidrio.materialesAlto).toEqual(["Cerco Fijo", "Cerco Corredizo"]);
  });

  it("lee parámetros de vidrio del .env", () => {
    const texto = [
      "VIDRIO_PANEL_ANCHO_CM=200",
      "VIDRIO_PANEL_ALTO_CM=300",
      "VIDRIO_MATERIAL_ANCHO=Zoclo",
      "VIDRIO_ANCHO_AJUSTE_CM=2",
      "VIDRIO_MATERIALES_ALTO=Cerco Fijo, Cerco Corredizo",
      "VIDRIO_ALTO_AJUSTE_CM=-10",
      "VIDRIO_PERMITIR_ROTACION=false",
      "REGLA_2PULG_1=Riel|1|INFERIOR|0|1",
    ].join("\n");

    const c = parsearEnv(texto);

    expect(c.parametrosVidrio.panelAnchoCm).toBeCloseTo(200.0, 9);
    expect(c.parametrosVidrio.panelAltoCm).toBeCloseTo(300.0, 9);
    expect(c.parametrosVidrio.materialesAlto).toEqual(["Cerco Fijo", "Cerco Corredizo"]);
    expect(c.parametrosVidrio.anchoAjusteCm).toBeCloseTo(2.0, 9);
    expect(c.parametrosVidrio.altoAjusteCm).toBeCloseTo(-10.0, 9);
    expect(c.parametrosVidrio.permitirRotacion).toBe(false);
  });

  it("falla si no se define ninguna regla", () => {
    expect(() => parsearEnv("LARGO_TIRA_CM=600")).toThrow(
      "El archivo .env no define ninguna regla",
    );
  });

  it("falla con una regla mal formada (sin 5 campos)", () => {
    expect(() => parsearEnv("REGLA_2PULG_1=Riel|1|INFERIOR")).toThrow(
      "la regla debe tener 5 campos",
    );
  });

  it("falla con una base inválida", () => {
    expect(() => parsearEnv("REGLA_2PULG_1=Riel|1|ARRIBA|0|1")).toThrow(
      "la base debe ser INFERIOR o LATERAL",
    );
  });
});

// --- Errores con número de línea (Requirement 10.6) -------------------------

describe("cargadorReglas: errores de parseo con número de línea", () => {
  // Validates: Requirements 10.6
  it("reporta la línea de una línea sin '=' (1-indexada)", () => {
    const texto = ["REGLA_2PULG_1=Riel|1|INFERIOR|0|1", "LINEA_SIN_IGUAL"].join("\n");
    expect(() => parsearEnv(texto)).toThrow(".env línea 2: se esperaba 'CLAVE=valor'");
  });

  it("reporta la línea de una regla que no tiene 5 campos", () => {
    const texto = ["LARGO_TIRA_CM=600", "REGLA_2PULG_1=Riel|1|INFERIOR|0"].join("\n");
    expect(() => parsearEnv(texto)).toThrow(
      ".env línea 2: la regla debe tener 5 campos separados por '|'",
    );
  });

  it("reporta la línea de un parámetro numérico inválido", () => {
    const texto = ["LARGO_TIRA_CM=noesnumero", "REGLA_2PULG_1=Riel|1|INFERIOR|0|1"].join("\n");
    expect(() => parsearEnv(texto)).toThrow(".env línea 1: el campo 'LARGO_TIRA_CM' debe ser un número");
  });

  it("reporta la línea de un campo de regla numérico inválido", () => {
    const texto = ["REGLA_2PULG_1=Riel|dos|INFERIOR|0|1"].join("\n");
    expect(() => parsearEnv(texto)).toThrow(".env línea 1: el campo 'cantidad' debe ser un entero");
  });
});
