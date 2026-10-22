"use client";

// components/BotonOptimizar.tsx
// Botón que dispara la optimización. La lógica real (invocar `ejecutarPipeline` y propagar
// resultado o error al estado global) vive en el handler de `app/page.tsx`; este componente solo
// se encarga de la presentación: muestra una etiqueta y, al pulsarse, llama al `onOptimizar`
// recibido por props. Soporta un estado `disabled` para bloquear la acción (p. ej. cuando no hay
// ventanas válidas) y una etiqueta personalizable.

interface BotonOptimizarProps {
  /** Handler que ejecuta el pipeline de dominio (definido en `page.tsx`). */
  onOptimizar: () => void;
  /** Deshabilita el botón para impedir disparar la optimización. Por defecto `false`. */
  disabled?: boolean;
  /** Etiqueta del botón. Por defecto "Optimizar". */
  etiqueta?: string;
}

/**
 * Botón de optimización. Al pulsarse delega en `onOptimizar`, que a su vez invoca
 * `ejecutarPipeline` en `page.tsx` y propaga el resultado o el error al estado global.
 */
export default function BotonOptimizar({
  onOptimizar,
  disabled = false,
  etiqueta = "Optimizar",
}: BotonOptimizarProps) {
  return (
    <button
      type="button"
      onClick={onOptimizar}
      disabled={disabled}
      aria-disabled={disabled}
      style={{
        padding: "0.6rem 1.2rem",
        fontSize: "1rem",
        fontWeight: 600,
        color: "#fff",
        background: disabled ? "#4a525e" : "var(--color-acento-fuerte)",
        border: "none",
        borderRadius: 6,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {etiqueta}
    </button>
  );
}
