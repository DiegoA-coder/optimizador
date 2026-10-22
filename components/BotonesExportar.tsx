"use client";

// components/BotonesExportar.tsx
// Botones de exportación de reportes. A partir del `ResultadoCompleto` del pipeline genera y
// descarga los tres formatos del proyecto Java original:
//   - `resultado.json` mediante `generarJson` (application/json)
//   - `resultado.html` imprimible en A4 mediante `generarHtml` (text/html; "Imprimir -> Guardar
//     como PDF" en el navegador)
//   - `resultado.txt` mediante `generarTexto` (text/plain)
// La descarga se realiza en el cliente creando un Blob, una URL de objeto y un ancla temporal.
//
// _Requirements: 9.1, 9.2, 9.3_

import type { ResultadoCompleto } from "@/lib/dominio/modelos";
import { generarJson } from "@/lib/io/reporteJson";
import { generarTexto } from "@/lib/io/reporteTexto";
import { generarHtml } from "@/lib/io/reporteHtml";

interface BotonesExportarProps {
  /** Resultado completo del pipeline a partir del cual se generan los reportes. */
  resultado: ResultadoCompleto;
}

/**
 * Dispara en el navegador la descarga de un archivo con el `contenido`, nombre `nombreArchivo`
 * y tipo MIME `tipoMime`. Crea un Blob, una URL de objeto y un ancla temporal; tras el clic
 * revoca la URL para liberar memoria.
 */
function descargarArchivo(contenido: string, nombreArchivo: string, tipoMime: string): void {
  const blob = new Blob([contenido], { type: tipoMime });
  const url = URL.createObjectURL(blob);
  const ancla = document.createElement("a");
  ancla.href = url;
  ancla.download = nombreArchivo;
  document.body.appendChild(ancla);
  ancla.click();
  document.body.removeChild(ancla);
  URL.revokeObjectURL(url);
}

/**
 * Botones de exportación. Cada botón genera el reporte correspondiente a partir de `resultado`
 * y lanza su descarga en el cliente.
 */
export default function BotonesExportar({ resultado }: BotonesExportarProps) {
  const exportarJson = () => {
    descargarArchivo(generarJson(resultado), "resultado.json", "application/json");
  };

  const exportarHtml = () => {
    descargarArchivo(generarHtml(resultado), "resultado.html", "text/html");
  };

  const exportarTexto = () => {
    descargarArchivo(generarTexto(resultado), "resultado.txt", "text/plain");
  };

  const estiloBoton: React.CSSProperties = {
    padding: "0.6rem 1.2rem",
    fontSize: "1rem",
    fontWeight: 600,
    color: "var(--color-acento)",
    background: "transparent",
    border: "1px solid var(--color-acento)",
    borderRadius: 6,
    cursor: "pointer",
  };

  return (
    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
      <button type="button" onClick={exportarJson} style={estiloBoton}>
        Exportar JSON
      </button>
      <button type="button" onClick={exportarHtml} style={estiloBoton}>
        Exportar HTML
      </button>
      <button type="button" onClick={exportarTexto} style={estiloBoton}>
        Exportar texto
      </button>
    </div>
  );
}
