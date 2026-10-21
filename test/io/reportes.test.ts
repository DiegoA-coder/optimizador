import { describe, expect, it } from "vitest";
import { crearParametros } from "@/lib/dominio/parametros";
import { porDefectoVidrio } from "@/lib/dominio/parametrosVidrio";
import { ejecutarPipeline } from "@/lib/dominio/pipeline";
import {
  ConfiguracionCorte,
  ResultadoCompleto,
  Ventana,
  crearReglaCorte,
  crearVentana,
} from "@/lib/dominio/modelos";
import { generarJson } from "@/lib/io/reporteJson";
import { generarTexto } from "@/lib/io/reporteTexto";
import { generarHtml } from "@/lib/io/reporteHtml";

// Tests unitarios de los tres generadores de reporte. Construyen un `ResultadoCompleto`
// con el ejemplo del design.md (ventana V1 Serie25 120x150, cantidad 2, con reglas de
// Zoclo / Cerco Fijo / Cerco Corredizo y parámetros de vidrio por defecto) a través de
// `ejecutarPipeline`, y verifican que cada generador produce la estructura esperada.
// Validates: Requirements 9.1, 9.2, 9.3

// --- Resultado de ejemplo (design.md) ---------------------------------------

function resultadoEjemplo(): ResultadoCompleto {
  const ventanas: Ventana[] = [
    crearVentana("V1", "Serie25", 120, 150, 2),
  ];

  const config: ConfiguracionCorte = {
    parametros: crearParametros(600, 0.4),
    parametrosVidrio: porDefectoVidrio(),
    reglasPorPerfil: {
      Serie25: [
        crearReglaCorte("Zoclo", 2, "INFERIOR", 1.4, 1),
        crearReglaCorte("Cerco Fijo", 1, "LATERAL", 0, 1),
        crearReglaCorte("Cerco Corredizo", 1, "LATERAL", 0, 1),
      ],
    },
  };

  return ejecutarPipeline(ventanas, config);
}

// --- generarJson (Requirement 9.1) ------------------------------------------

describe("generarJson", () => {
  // Validates: Requirements 9.1
  it("produce JSON válido parseable por JSON.parse", () => {
    const json = generarJson(resultadoEjemplo());
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("contiene las secciones esperadas: resumen, descripcion, perfiles, ventanas, vidrio", () => {
    const data = JSON.parse(generarJson(resultadoEjemplo()));

    expect(data).toHaveProperty("resumen");
    expect(data).toHaveProperty("descripcion");
    expect(data).toHaveProperty("perfiles");
    expect(data).toHaveProperty("ventanas");
    expect(data).toHaveProperty("vidrio");
  });

  it("el resumen y el vidrio tienen los campos clave del dominio", () => {
    const data = JSON.parse(generarJson(resultadoEjemplo()));

    expect(data.resumen).toMatchObject({
      largoTiraCm: expect.any(Number),
      sierraCm: expect.any(Number),
      totalTiras: expect.any(Number),
      desperdicioTotalCm: expect.any(Number),
    });

    expect(data.vidrio).toMatchObject({
      panelAnchoCm: expect.any(Number),
      panelAltoCm: expect.any(Number),
      totalPaneles: expect.any(Number),
      totalPiezas: expect.any(Number),
    });
    expect(Array.isArray(data.vidrio.paneles)).toBe(true);
  });

  it("refleja el perfil Serie25 y las ventanas del ejemplo", () => {
    const data = JSON.parse(generarJson(resultadoEjemplo()));

    expect(Array.isArray(data.perfiles)).toBe(true);
    expect(data.perfiles.some((p: { nombre: string }) => p.nombre === "Serie25")).toBe(true);

    expect(Array.isArray(data.ventanas)).toBe(true);
    expect(data.ventanas.length).toBeGreaterThan(0);
    expect(data.ventanas[0]).toMatchObject({ perfil: "Serie25" });
  });
});

// --- generarTexto (Requirement 9.2) -----------------------------------------

describe("generarTexto", () => {
  // Validates: Requirements 9.2
  it("incluye los encabezados de todas las secciones", () => {
    const texto = generarTexto(resultadoEjemplo());

    expect(texto).toContain("PLAN DE CORTE DE ALUMINIO");
    expect(texto).toContain("CORTES POR VENTANA");
    expect(texto).toContain("VIDRIO");
    expect(texto).toContain("RESUMEN ALUMINIO");
    expect(texto).toContain("RESUMEN VIDRIO");
  });

  it("menciona el perfil y la ventana del ejemplo", () => {
    const texto = generarTexto(resultadoEjemplo());

    expect(texto).toContain("Serie25");
    expect(texto).toContain("V1");
  });
});

// --- generarHtml (Requirement 9.3) ------------------------------------------

describe("generarHtml", () => {
  // Validates: Requirements 9.3
  it("produce un documento HTML completo con doctype y cierre de etiquetas", () => {
    const html = generarHtml(resultadoEjemplo());

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html lang=\"es\">");
    expect(html).toContain("</body>");
    expect(html).toContain("</html>");
  });

  it("incluye el esquema de corte de vidrio en SVG", () => {
    const html = generarHtml(resultadoEjemplo());

    expect(html).toContain("<svg");
    expect(html).toContain("class=\"esquema\"");
  });

  it("dibuja las piezas de vidrio con el esquema de Y invertida", () => {
    const r = resultadoEjemplo();
    const html = generarHtml(r);

    // El SVG invierte el eje Y: ySvg = altoPanelPx - (yCm * escala) - altoPiezaPx.
    // Reproducimos el cálculo del primer rect de pieza y verificamos que aparece en el HTML.
    const p = r.planVidrio.parametros;
    const escala = 360.0 / Math.max(p.panelAnchoCm, p.panelAltoCm);
    const alto = p.panelAltoCm * escala;

    const panel = r.planVidrio.paneles[0];
    expect(panel).toBeDefined();
    const c = panel.piezas[0];
    expect(c).toBeDefined();

    const ph = c.altoCm * escala;
    const ySvg = alto - c.yCm * escala - ph;

    expect(html).toContain(`y="${ySvg.toFixed(1)}"`);
    expect(html).toContain(`class="pieza"`);
  });
});
