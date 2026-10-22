"use client";

// app/despiece/page.tsx
// Pantalla "Despiece por perfil (1D)": el usuario carga el largo de la barra, la sierra (kerf) y
// la lista de piezas necesarias (etiqueta, longitud, cantidad), y obtiene el mapa de corte en 2D
// con el acomodo óptimo de cada barra, lo usado y el sobrante.
//
// Reutiliza el dominio existente SIN duplicar lógica:
//   - `optimizar` (@/lib/dominio/optimizador): acomoda las piezas en barras (Best Fit Decreasing).
//   - `Tira` / `usadoCm` (@/lib/dominio/tira): barra con su capacidad, lo usado y el sobrante.
//   - `crearParametros` (@/lib/dominio/parametros): valida largo de barra y sierra.
//   - `MapaCorteBarras` (@/components): dibuja el mapa de corte 2D a escala.
//
// Es independiente de ventanas, reglas y vidrio: trabaja directo con las piezas capturadas.

import Link from "next/link";
import { useState } from "react";

import MapaCorteBarras from "@/components/MapaCorteBarras";
import { Pieza } from "@/lib/dominio/modelos";
import { cm, crearParametros, redondear } from "@/lib/dominio/parametros";
import { optimizar } from "@/lib/dominio/optimizador";
import { Tira } from "@/lib/dominio/tira";
import { generarHtmlDespiece } from "@/lib/io/reporteDespiece";

/**
 * Fila editable de la pantalla. Los campos numéricos se guardan como texto para no forzar al
 * usuario a estados válidos mientras escribe; la conversión y validación ocurren al calcular.
 */
interface FilaPieza {
  etiqueta: string;
  longitud: string;
  cantidad: string;
}

/** Resultado del cálculo que se muestra: las barras y sus agregados. */
interface Resultado {
  tiras: Tira[];
  largoBarraCm: number;
  sierraCm: number;
  totalPiezas: number;
  desperdicioCm: number;
  aprovechamientoPct: number;
}

const FILAS_INICIALES: FilaPieza[] = [
  { etiqueta: "Marco superior", longitud: "120", cantidad: "2" },
  { etiqueta: "Marco lateral", longitud: "150", cantidad: "2" },
  { etiqueta: "Travesaño", longitud: "95", cantidad: "3" },
];

/**
 * Convierte las filas capturadas en el arreglo de `Pieza` del dominio, expandiendo cada fila
 * según su `cantidad`. Valida que longitud y cantidad sean números positivos (y cantidad entera).
 * Lanza `Error` con un mensaje claro si algún dato es inválido.
 */
function filasAPiezas(filas: FilaPieza[]): Pieza[] {
  const piezas: Pieza[] = [];
  filas.forEach((fila, i) => {
    const longitud = Number(fila.longitud);
    const cantidad = Number(fila.cantidad);
    if (!Number.isFinite(longitud) || longitud <= 0) {
      throw new Error(`Pieza ${i + 1}: la longitud debe ser un número mayor a 0`);
    }
    if (!Number.isFinite(cantidad) || cantidad <= 0 || cantidad !== Math.round(cantidad)) {
      throw new Error(`Pieza ${i + 1}: la cantidad debe ser un entero mayor a 0`);
    }
    const etiqueta = fila.etiqueta.trim() || "Pieza";
    for (let n = 0; n < cantidad; n++) {
      // El dominio exige perfil y material; para el despiece genérico usamos valores neutros y la
      // etiqueta como origen de la pieza (es lo que el mapa muestra sobre cada corte).
      piezas.push({ perfil: "PERFIL", material: "PERFIL", etiquetaVentana: etiqueta, longitudCm: longitud });
    }
  });
  if (piezas.length === 0) {
    throw new Error("Agrega al menos una pieza.");
  }
  return piezas;
}

/** Calcula el porcentaje de aprovechamiento: longitud útil cortada / longitud total de las barras. */
function aprovechamiento(tiras: Tira[], largoBarraCm: number): number {
  if (tiras.length === 0) return 0;
  const utilCortado = tiras.reduce(
    (acc, tira) => acc + tira.piezas.reduce((s, p) => s + p.longitudCm, 0),
    0,
  );
  return redondear((utilCortado / (tiras.length * largoBarraCm)) * 100);
}

const estiloInput: React.CSSProperties = {
  width: "100%",
  padding: "0.35rem 0.5rem",
  border: "1px solid var(--color-borde)",
  borderRadius: 5,
  background: "var(--color-superficie)",
  color: "var(--color-texto)",
};

export default function PaginaDespiece() {
  const [largoBarra, setLargoBarra] = useState("600");
  const [sierra, setSierra] = useState("0.4");
  const [filas, setFilas] = useState<FilaPieza[]>(FILAS_INICIALES);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState<string | null>(null);

  function agregarFila() {
    setFilas((previo) => [...previo, { etiqueta: "", longitud: "", cantidad: "1" }]);
  }

  function eliminarFila(indice: number) {
    setFilas((previo) => previo.filter((_, i) => i !== indice));
  }

  function cambiarFila(indice: number, campo: keyof FilaPieza, valor: string) {
    setFilas((previo) => previo.map((fila, i) => (i === indice ? { ...fila, [campo]: valor } : fila)));
  }

  /**
   * Valida los parámetros y las piezas, ejecuta el optimizador del dominio y guarda el resultado.
   * Cualquier `Error` de validación (parámetros, longitudes, pieza que excede la barra) se muestra
   * en el banner sin romper la pantalla.
   */
  function calcular() {
    try {
      const parametros = crearParametros(Number(largoBarra), Number(sierra));
      const piezas = filasAPiezas(filas);

      // Validación explícita: una pieza más larga que la barra no cabe en ninguna.
      for (const pieza of piezas) {
        if (pieza.longitudCm > parametros.largoTiraCm) {
          throw new Error(
            `La pieza '${pieza.etiquetaVentana}' (${cm(pieza.longitudCm)} cm) excede el largo de la barra (${cm(
              parametros.largoTiraCm,
            )} cm)`,
          );
        }
      }

      const tiras = optimizar(piezas, parametros);
      const desperdicioCm = redondear(tiras.reduce((acc, t) => acc + t.restanteCm, 0));
      setResultado({
        tiras,
        largoBarraCm: parametros.largoTiraCm,
        sierraCm: parametros.sierraCm,
        totalPiezas: piezas.length,
        desperdicioCm,
        aprovechamientoPct: aprovechamiento(tiras, parametros.largoTiraCm),
      });
      setError(null);
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e);
      setError(mensaje);
      setResultado(null);
    }
  }

  /**
   * Exporta el despiece actual a PDF. Genera el reporte HTML imprimible (A4) con el mismo resumen
   * y mapa de corte que la pantalla, lo abre en una ventana nueva y dispara el diálogo de impresión
   * del navegador, donde el usuario elige "Guardar como PDF". Si el navegador bloquea la ventana
   * emergente, se avisa en el banner.
   */
  function exportarPdf() {
    if (resultado === null) return;
    const html = generarHtmlDespiece(resultado);
    const ventana = window.open("", "_blank");
    if (ventana === null) {
      setError("El navegador bloqueó la ventana para el PDF. Permite las ventanas emergentes e inténtalo de nuevo.");
      return;
    }
    ventana.document.open();
    ventana.document.write(html);
    ventana.document.close();
    // Esperar a que el contenido (y el SVG) se renderice antes de abrir el diálogo de impresión.
    ventana.onload = () => {
      ventana.focus();
      ventana.print();
    };
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 1040, margin: "0 auto" }}>
      <p style={{ margin: "0 0 0.5rem" }}>
        <Link href="/" style={{ color: "var(--color-acento)", textDecoration: "none" }}>
          ← Menú
        </Link>
      </p>
      <h1>Despiece por perfil (1D)</h1>
      <p style={{ color: "var(--color-texto-tenue)", marginTop: 0 }}>
        Carga el largo de la barra, la sierra y las piezas necesarias para obtener el mapa de corte en 2D.
      </p>

      {error !== null && (
        <div
          role="alert"
          style={{
            margin: "1rem 0",
            padding: "0.75rem 1rem",
            border: "1px solid var(--color-error-borde)",
            borderRadius: 6,
            background: "var(--color-error-fondo)",
            color: "var(--color-error-texto)",
          }}
        >
          {error}
        </div>
      )}

      <section aria-label="Parámetros de la barra" style={{ display: "flex", gap: "1rem", maxWidth: 420 }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="largo" style={{ display: "block", fontSize: "0.85rem", fontWeight: 600 }}>
            Largo de barra (cm)
          </label>
          <input
            id="largo"
            type="number"
            min="1"
            step="0.1"
            value={largoBarra}
            onChange={(e) => setLargoBarra(e.target.value)}
            style={estiloInput}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label htmlFor="sierra" style={{ display: "block", fontSize: "0.85rem", fontWeight: 600 }}>
            Sierra / kerf (cm)
          </label>
          <input
            id="sierra"
            type="number"
            min="0"
            step="0.1"
            value={sierra}
            onChange={(e) => setSierra(e.target.value)}
            style={estiloInput}
          />
        </div>
      </section>

      <section aria-label="Piezas necesarias" style={{ marginTop: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem" }}>Piezas necesarias</h2>
        <table style={{ width: "100%", maxWidth: 560, borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", fontSize: "0.8rem", color: "var(--color-texto-tenue)", padding: "0.25rem" }}>Etiqueta</th>
              <th style={{ textAlign: "left", fontSize: "0.8rem", color: "var(--color-texto-tenue)", padding: "0.25rem" }}>
                Longitud (cm)
              </th>
              <th style={{ textAlign: "left", fontSize: "0.8rem", color: "var(--color-texto-tenue)", padding: "0.25rem" }}>Cant.</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filas.map((fila, i) => (
              <tr key={i}>
                <td style={{ padding: "0.25rem", width: "44%" }}>
                  <input
                    type="text"
                    aria-label={`Etiqueta de la pieza ${i + 1}`}
                    placeholder="Marco"
                    value={fila.etiqueta}
                    onChange={(e) => cambiarFila(i, "etiqueta", e.target.value)}
                    style={estiloInput}
                  />
                </td>
                <td style={{ padding: "0.25rem", width: "28%" }}>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    aria-label={`Longitud de la pieza ${i + 1}`}
                    value={fila.longitud}
                    onChange={(e) => cambiarFila(i, "longitud", e.target.value)}
                    style={estiloInput}
                  />
                </td>
                <td style={{ padding: "0.25rem", width: "18%" }}>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    aria-label={`Cantidad de la pieza ${i + 1}`}
                    value={fila.cantidad}
                    onChange={(e) => cambiarFila(i, "cantidad", e.target.value)}
                    style={estiloInput}
                  />
                </td>
                <td style={{ padding: "0.25rem" }}>
                  <button
                    type="button"
                    aria-label={`Eliminar la pieza ${i + 1}`}
                    onClick={() => eliminarFila(i)}
                    style={{
                      padding: "0.3rem 0.6rem",
                      border: "1px solid var(--color-error-borde)",
                      borderRadius: 5,
                      background: "var(--color-superficie)",
                      color: "var(--color-error-texto)",
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
          <button
            type="button"
            onClick={agregarFila}
            style={{
              padding: "0.5rem 1rem",
              border: "1px solid var(--color-borde)",
              borderRadius: 6,
              background: "var(--color-superficie-alt)",
              color: "var(--color-texto)",
              cursor: "pointer",
            }}
          >
            + Agregar pieza
          </button>
          <button
            type="button"
            onClick={calcular}
            style={{
              padding: "0.5rem 1.2rem",
              border: "none",
              borderRadius: 6,
              background: "var(--color-acento-fuerte)",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Calcular corte
          </button>
        </div>
      </section>

      <section aria-label="Mapa de corte 2D" style={{ marginTop: "2rem" }}>
        <h2 style={{ fontSize: "1.1rem" }}>Mapa de corte 2D</h2>
        {resultado === null ? (
          <p style={{ color: "var(--color-texto-sutil)" }}>Agrega piezas y pulsa «Calcular corte» para ver el mapa.</p>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "1.5rem",
                background: "var(--color-superficie)",
                border: "1px solid var(--color-borde)",
                borderRadius: 6,
                padding: "0.75rem 1rem",
                marginBottom: "1rem",
                fontSize: "0.9rem",
              }}
            >
              <span>
                Barras: <strong>{resultado.tiras.length}</strong>
              </span>
              <span>
                Piezas: <strong>{resultado.totalPiezas}</strong>
              </span>
              <span>
                Desperdicio: <strong>{cm(resultado.desperdicioCm)} cm</strong>
              </span>
              <span>
                Aprovechamiento: <strong>{cm(resultado.aprovechamientoPct)}%</strong>
              </span>
              <button
                type="button"
                onClick={exportarPdf}
                style={{
                  marginLeft: "auto",
                  padding: "0.4rem 1rem",
                  border: "1px solid var(--color-acento)",
                  borderRadius: 6,
                  background: "transparent",
                  color: "var(--color-acento)",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Exportar PDF
              </button>
            </div>
            <MapaCorteBarras
              tiras={resultado.tiras}
              largoBarraCm={resultado.largoBarraCm}
              sierraCm={resultado.sierraCm}
            />
          </>
        )}
      </section>
    </main>
  );
}
