"use client";

// components/FormularioVentanas.tsx
// Tabla editable de ventanas (sustituye la edición manual de `ventanas.json`). Permite:
// - Agregar y eliminar filas (cada fila es un `FilaVentana`).
// - Editar `etiqueta`, `perfil`, `inferiorCm`, `lateralCm` y `cantidad` de cada ventana.
// - Validar en vivo: medidas y cantidad > 0, cantidad entera, etiqueta/perfil no vacíos,
//   mostrando mensajes de validación por fila (delegado en `FilaVentana`) y un resumen global.
// - Importar un `ventanas.json` (vía `onImportarJson`, que internamente usa `parsearVentanas`)
//   y exportar la lista actual (vía `onExportarJson`, que internamente usa `serializarVentanas`).
//
// El componente es controlado: no mantiene estado propio de las ventanas, sino que recibe la
// lista por `props.ventanas` y notifica cualquier cambio con `props.onCambio`. La única pieza de
// estado local es la referencia al <input type="file"> oculto que dispara la importación.

import { useRef } from "react";

import FilaVentana from "@/components/FilaVentana";
import type { Ventana } from "@/lib/dominio/modelos";
// `parsearVentanas` y `serializarVentanas` se usan efectivamente desde los callbacks que provee
// el componente padre (`onImportarJson` / `onExportarJson`); se importan aquí como referencia de
// la capa IO con la que este formulario interopera.
import type { parsearVentanas, serializarVentanas } from "@/lib/io/cargadorVentanas";

// Referencias de tipo para dejar explícita la relación con la capa IO sin ejecutar nada.
// (Se borran en compilación por ser `typeof` sobre imports de solo tipo.)
export type Parsear = typeof parsearVentanas;
export type Serializar = typeof serializarVentanas;

export interface FormularioVentanasProps {
  /** Lista de ventanas controlada por el componente padre. */
  ventanas: Ventana[];
  /**
   * Perfil (p. ej. "2PULG" o "3PULG") al que pertenecen todas las ventanas de este formulario.
   * Lo fija la pestaña activa: las ventanas nuevas lo heredan y el usuario no puede combinarlo.
   */
  perfil: string;
  /** Se invoca con la lista completa actualizada ante cualquier cambio (agregar, editar, eliminar). */
  onCambio: (ventanas: Ventana[]) => void;
  /** Se invoca con el archivo elegido por el usuario para importar un `ventanas.json`. */
  onImportarJson: (archivo: File) => void;
  /** Se invoca cuando el usuario pide exportar la lista actual como `ventanas.json`. */
  onExportarJson: () => void;
}

/**
 * Ventana nueva por defecto al agregar una fila: campos en blanco para que el usuario los
 * complete, con el perfil fijado por la pestaña activa (no editable en la fila).
 */
function ventanaVacia(perfil: string): Ventana {
  return {
    etiqueta: "",
    perfil,
    inferiorCm: Number.NaN,
    lateralCm: Number.NaN,
    cantidad: 1,
  };
}

/** Indica si una ventana es válida según las reglas de captura (medidas/cantidad > 0, etc.). */
function ventanaValida(v: Ventana): boolean {
  return (
    v.etiqueta.trim().length > 0 &&
    Number.isFinite(v.inferiorCm) &&
    v.inferiorCm > 0 &&
    Number.isFinite(v.lateralCm) &&
    v.lateralCm > 0 &&
    Number.isFinite(v.cantidad) &&
    v.cantidad > 0 &&
    v.cantidad === Math.round(v.cantidad)
  );
}

const estiloEncabezado: React.CSSProperties = {
  textAlign: "left",
  padding: "0.25rem 0.5rem",
  borderBottom: "2px solid var(--color-borde)",
  fontSize: "0.85rem",
};

const estiloBoton: React.CSSProperties = {
  padding: "0.4rem 0.8rem",
  border: "1px solid var(--color-acento-fuerte)",
  borderRadius: 4,
  background: "var(--color-acento-fuerte)",
  color: "#fff",
  cursor: "pointer",
};

const estiloBotonSecundario: React.CSSProperties = {
  padding: "0.4rem 0.8rem",
  border: "1px solid var(--color-acento)",
  borderRadius: 4,
  background: "transparent",
  color: "var(--color-acento)",
  cursor: "pointer",
};

export default function FormularioVentanas({
  ventanas,
  perfil,
  onCambio,
  onImportarJson,
  onExportarJson,
}: FormularioVentanasProps) {
  const inputArchivo = useRef<HTMLInputElement>(null);

  function agregarFila() {
    onCambio([...ventanas, ventanaVacia(perfil)]);
  }

  function eliminarFila(indice: number) {
    onCambio(ventanas.filter((_, i) => i !== indice));
  }

  function editarFila(indice: number, ventana: Ventana) {
    onCambio(ventanas.map((v, i) => (i === indice ? ventana : v)));
  }

  function abrirSelectorArchivo() {
    inputArchivo.current?.click();
  }

  function alElegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (archivo) {
      onImportarJson(archivo);
    }
    // Reiniciar el valor permite volver a importar el mismo archivo seguido.
    e.target.value = "";
  }

  const invalidas = ventanas.filter((v) => !ventanaValida(v)).length;

  return (
    <div>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
        <button type="button" onClick={agregarFila} style={estiloBoton}>
          Agregar ventana
        </button>
      </div>

      {ventanas.length === 0 ? (
        <p>No hay ventanas. Usa &quot;Agregar ventana&quot; o importa un archivo JSON.</p>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={estiloEncabezado}>Etiqueta</th>
              <th style={estiloEncabezado}>Inferior (cm)</th>
              <th style={estiloEncabezado}>Lateral (cm)</th>
              <th style={estiloEncabezado}>Cantidad</th>
              <th style={estiloEncabezado} aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {ventanas.map((v, i) => (
              <FilaVentana
                key={i}
                ventana={v}
                indice={i}
                onCambio={(actualizada) => editarFila(i, actualizada)}
                onEliminar={() => eliminarFila(i)}
              />
            ))}
          </tbody>
        </table>
      )}

      {/* Resumen de validación: avisa si alguna fila tiene datos inválidos. */}
      {invalidas > 0 && (
        <p role="alert" style={{ marginTop: "0.75rem", color: "var(--color-error-texto)", fontSize: "0.85rem" }}>
          {invalidas === 1
            ? "1 ventana tiene datos inválidos. Corrige los campos marcados."
            : `${invalidas} ventanas tienen datos inválidos. Corrige los campos marcados.`}
        </p>
      )}
    </div>
  );
}
