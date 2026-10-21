import { describe, expect, it } from "vitest";

import { crearParametros } from "@/lib/dominio/parametros";
import {
  crearParametrosVidrio,
  porDefectoVidrio,
} from "@/lib/dominio/parametrosVidrio";
import {
  ConfiguracionCorte,
  Pieza,
  ReglaCorte,
  Ventana,
  crearReglaCorte,
  crearVentana,
} from "@/lib/dominio/modelos";
import { agruparPorVentana } from "@/lib/dominio/cortesPorVentana";
import { ejecutarPipeline } from "@/lib/dominio/pipeline";
import {
  aprovechamientoPct,
  totalPaneles,
} from "@/lib/dominio/planVidrio";

// Tests unitarios de agrupamiento de cortes por ventana y test de integración del pipeline.
// La parte unitaria porta CortesPorVentanaTest del proyecto Java y verifica la consolidación
// de longitudes por material y la separación de ventanas distintas. La parte de integración
// usa el ejemplo del diseño (ventana V1 Serie25) y verifica planCorte.totalTiras,
// planVidrio.totalPaneles y aprovechamientoPct a través de ejecutarPipeline.
// Validates: Requirements 7.1, 8.2

// Pequeño helper para construir piezas de aluminio directamente (como el Java hace con el
// constructor de Pieza), sin pasar por el despiece. El orden de los campos del record Java es
// (perfil, material, etiquetaVentana, longitudCm).
function pieza(
  perfil: string,
  material: string,
  etiquetaVentana: string,
  longitudCm: number,
): Pieza {
  return { perfil, material, etiquetaVentana, longitudCm };
}

describe("agruparPorVentana", () => {
  it("consolida longitudes repetidas por material", () => {
    const piezas: Pieza[] = [
      pieza("2PULG", "Chambrana", "sala", 79.0),
      pieza("2PULG", "Chambrana", "sala", 79.0),
      pieza("2PULG", "Chambrana", "sala", 180.0),
      pieza("2PULG", "Riel", "sala", 180.0),
    ];

    const agrupado = agruparPorVentana(piezas);
    expect(agrupado).toHaveLength(1);

    const sala = agrupado[0];
    expect(sala.etiqueta).toBe("sala");
    expect(sala.perfil).toBe("2PULG");
    expect(sala.totalPiezas).toBe(4);

    const chambrana = sala.porMaterial["Chambrana"];
    // 2 x 79.0 y 1 x 180.0
    const de79 = chambrana.find((a) => a.longitudCm === 79.0);
    expect(de79).toBeDefined();
    expect(de79!.cantidad).toBe(2);
  });

  it("separa ventanas distintas", () => {
    const piezas: Pieza[] = [
      pieza("2PULG", "Riel", "sala", 180.0),
      pieza("3PULG", "Riel", "B", 150.0),
    ];
    expect(agruparPorVentana(piezas)).toHaveLength(2);
  });
});

describe("ejecutarPipeline (integración)", () => {
  // Ejemplo del diseño: ventana V1 Serie25, inferior 120, lateral 150, 2 unidades.
  const ventanas: Ventana[] = [
    crearVentana("V1", "Serie25", 120, 150, 2),
  ];

  const reglas: ReglaCorte[] = [
    crearReglaCorte("Zoclo", 2, "INFERIOR", 1.4, 1),
    crearReglaCorte("Cerco Fijo", 1, "LATERAL", 0, 1),
    crearReglaCorte("Cerco Corredizo", 1, "LATERAL", 0, 1),
  ];

  const config: ConfiguracionCorte = {
    parametros: crearParametros(600, 0.4),
    parametrosVidrio: crearParametrosVidrio(
      180,
      260,
      "Zoclo",
      1.8,
      ["Cerco Fijo", "Cerco Corredizo"],
      -9.3,
      true,
    ),
    reglasPorPerfil: { Serie25: reglas },
  };

  it("produce el plan de corte y de vidrio esperados del ejemplo del diseño", () => {
    const resultado = ejecutarPipeline(ventanas, config);

    // Aluminio: 4 Zoclo (118.6) en 1 tira, 2 Cerco Fijo (150.0) en 1 tira,
    // 2 Cerco Corredizo (150.0) en 1 tira => 3 tiras.
    expect(resultado.planCorte.totalTiras).toBe(3);

    // Vidrio: 4 piezas de 120.4 x 140.7; cada una ocupa su propio panel => 4 paneles.
    expect(totalPaneles(resultado.planVidrio)).toBe(4);

    // Aprovechamiento: 4 * (120.4 * 140.7) / (4 * 180 * 260) * 100 ~= 36.2 %.
    expect(aprovechamientoPct(resultado.planVidrio)).toBeCloseTo(36.2, 1);
  });

  it("usa los parámetros de vidrio por defecto sin cambiar el conteo de paneles", () => {
    // porDefectoVidrio() tiene los mismos valores que el ejemplo del diseño, de modo que el
    // resultado del pipeline no cambia al usarlos.
    const configPorDefecto: ConfiguracionCorte = {
      ...config,
      parametrosVidrio: porDefectoVidrio(),
    };

    const resultado = ejecutarPipeline(ventanas, configPorDefecto);
    expect(totalPaneles(resultado.planVidrio)).toBe(4);
  });
});
