"use client";

// components/FilaVentana.tsx
// Fila editable de una sola ventana dentro de la tabla del `FormularioVentanas`.
// Renderiza un <input> por cada campo de la ventana (`etiqueta`, `perfil`, `inferiorCm`,
// `lateralCm`, `cantidad`) y un botón para eliminar la fila. La validación en vivo se calcula
// aquí a nivel de campo y se muestra como mensajes debajo de cada input; el componente padre
// (`FormularioVentanas`) mantiene la lista de ventanas y recibe los cambios mediante `onCambio`.
//
// Nota de diseño: el tipo `Ventana` del dominio sólo admite estados válidos a través de
// `crearVentana`, pero durante la edición el usuario puede dejar un campo en un estado inválido
// (medida en 0, cantidad decimal, etiqueta vacía). Por eso esta fila trabaja directamente sobre
// el objeto `Ventana` (cuyos campos numéricos son `number`) y marca la invalidez visualmente,
// sin impedir la edición. La validación "dura" (lanzar `Error`) ocurre más adelante, al ejecutar
// el pipeline.

import type { Ventana } from "@/lib/dominio/modelos";

/** Campos numéricos de una ventana que la fila puede editar. */
type CampoNumerico = "inferiorCm" | "lateralCm" | "cantidad";
/** Campos de texto de una ventana que la fila puede editar. */
type CampoTexto = "etiqueta" | "perfil";

export interface FilaVentanaProps {
  /** La ventana que esta fila representa. */
  ventana: Ventana;
  /** Índice de la fila (para accesibilidad y claves de ayuda). */
  indice: number;
  /** Se invoca con la ventana actualizada cuando el usuario edita cualquier campo. */
  onCambio: (ventana: Ventana) => void;
  /** Se invoca cuando el usuario pulsa el botón de eliminar esta fila. */
  onEliminar: () => void;
}

/** Mensaje de validación para un campo de texto (etiqueta/perfil) o `null` si es válido. */
function errorTexto(valor: string): string | null {
  return valor.trim().length === 0 ? "No puede estar vacío" : null;
}

/** Mensaje de validación para una medida (inferiorCm/lateralCm) o `null` si es válida. */
function errorMedida(valor: number): string | null {
  if (!Number.isFinite(valor) || valor <= 0) {
    return "Debe ser mayor a 0";
  }
  return null;
}

/** Mensaje de validación para la cantidad (entero > 0) o `null` si es válida. */
function errorCantidad(valor: number): string | null {
  if (!Number.isFinite(valor) || valor <= 0) {
    return "Debe ser mayor a 0";
  }
  if (valor !== Math.round(valor)) {
    return "Debe ser un entero";
  }
  return null;
}

const estiloCelda: React.CSSProperties = {
  padding: "0.25rem 0.5rem",
  verticalAlign: "top",
};

const estiloMensaje: React.CSSProperties = {
  display: "block",
  marginTop: 2,
  fontSize: "0.75rem",
  color: "#b00020",
};

/** Estilo base de los inputs; el borde se tiñe de rojo cuando el campo es inválido. */
function estiloInput(invalido: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "0.25rem 0.4rem",
    border: `1px solid ${invalido ? "#d33" : "#bbb"}`,
    borderRadius: 4,
    background: invalido ? "#fdecea" : "#fff",
  };
}

export default function FilaVentana({ ventana, indice, onCambio, onEliminar }: FilaVentanaProps) {
  function cambiarTexto(campo: CampoTexto, valor: string) {
    onCambio({ ...ventana, [campo]: valor });
  }

  function cambiarNumero(campo: CampoNumerico, texto: string) {
    // Un campo vacío se interpreta como `NaN` para que la validación lo marque como inválido
    // sin romper el input controlado.
    const valor = texto.trim() === "" ? Number.NaN : Number(texto);
    onCambio({ ...ventana, [campo]: valor });
  }

  const erEtiqueta = errorTexto(ventana.etiqueta);
  const erPerfil = errorTexto(ventana.perfil);
  const erInferior = errorMedida(ventana.inferiorCm);
  const erLateral = errorMedida(ventana.lateralCm);
  const erCantidad = errorCantidad(ventana.cantidad);

  // Un input numérico vacío (NaN) debe mostrarse como cadena vacía, no como "NaN".
  const textoNumero = (valor: number): string => (Number.isFinite(valor) ? String(valor) : "");

  return (
    <tr>
      <td style={estiloCelda}>
        <input
          type="text"
          aria-label={`Etiqueta de la ventana ${indice + 1}`}
          value={ventana.etiqueta}
          onChange={(e) => cambiarTexto("etiqueta", e.target.value)}
          style={estiloInput(erEtiqueta !== null)}
        />
        {erEtiqueta !== null && <span style={estiloMensaje}>{erEtiqueta}</span>}
      </td>

      <td style={estiloCelda}>
        <input
          type="text"
          aria-label={`Perfil de la ventana ${indice + 1}`}
          value={ventana.perfil}
          onChange={(e) => cambiarTexto("perfil", e.target.value)}
          style={estiloInput(erPerfil !== null)}
        />
        {erPerfil !== null && <span style={estiloMensaje}>{erPerfil}</span>}
      </td>

      <td style={estiloCelda}>
        <input
          type="number"
          step="any"
          min="0"
          aria-label={`Medida inferior (cm) de la ventana ${indice + 1}`}
          value={textoNumero(ventana.inferiorCm)}
          onChange={(e) => cambiarNumero("inferiorCm", e.target.value)}
          style={estiloInput(erInferior !== null)}
        />
        {erInferior !== null && <span style={estiloMensaje}>{erInferior}</span>}
      </td>

      <td style={estiloCelda}>
        <input
          type="number"
          step="any"
          min="0"
          aria-label={`Medida lateral (cm) de la ventana ${indice + 1}`}
          value={textoNumero(ventana.lateralCm)}
          onChange={(e) => cambiarNumero("lateralCm", e.target.value)}
          style={estiloInput(erLateral !== null)}
        />
        {erLateral !== null && <span style={estiloMensaje}>{erLateral}</span>}
      </td>

      <td style={estiloCelda}>
        <input
          type="number"
          step="1"
          min="1"
          aria-label={`Cantidad de la ventana ${indice + 1}`}
          value={textoNumero(ventana.cantidad)}
          onChange={(e) => cambiarNumero("cantidad", e.target.value)}
          style={estiloInput(erCantidad !== null)}
        />
        {erCantidad !== null && <span style={estiloMensaje}>{erCantidad}</span>}
      </td>

      <td style={estiloCelda}>
        <button
          type="button"
          aria-label={`Eliminar la ventana ${indice + 1}`}
          onClick={onEliminar}
          style={{
            padding: "0.25rem 0.6rem",
            border: "1px solid #d33",
            borderRadius: 4,
            background: "#fff",
            color: "#b00020",
            cursor: "pointer",
          }}
        >
          Eliminar
        </button>
      </td>
    </tr>
  );
}
