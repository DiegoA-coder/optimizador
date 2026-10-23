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
import { generarHtml } from "@/lib/io/reporteHtml";

interface BotonesExportarProps {
  /** Resultado completo del pipeline a partir del cual se genera el reporte. */
  resultado: ResultadoCompleto;
  /**
   * Se invoca si el navegador bloquea la ventana emergente del PDF, para que la pantalla muestre
   * el aviso en su banner de error. Opcional.
   */
  onError?: (mensaje: string) => void;
}

/**
 * Botón de exportación a PDF. Genera el reporte HTML imprimible (A4) con el mismo resumen,
 * tablas y esquema de corte que muestra la pantalla, lo abre en una ventana nueva y dispara el
 * diálogo de impresión del navegador, donde el usuario elige "Guardar como PDF". Reproduce el
 * mismo flujo que la exportación a PDF de la pantalla de despiece 1D.
 */
export default function BotonesExportar({ resultado, onError }: BotonesExportarProps) {
  const exportarPdf = () => {
    const html = generarHtml(resultado);
    const ventana = window.open("", "_blank");
    if (ventana === null) {
      onError?.(
        "El navegador bloqueó la ventana para el PDF. Permite las ventanas emergentes e inténtalo de nuevo.",
      );
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
      <button type="button" onClick={exportarPdf} style={estiloBoton}>
        Exportar PDF
      </button>
    </div>
  );
}
