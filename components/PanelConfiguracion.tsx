"use client";

// components/PanelConfiguracion.tsx
// Contenedor colapsable que centraliza TODA la configuración de la pantalla de ventanas:
// los parámetros de aluminio/vidrio (`FormularioParametros`) y las reglas de despiece por
// perfil (`EditorReglas`). Se renderiza con <details>/<summary> para no ocupar espacio cuando
// no se está editando: la configuración queda plegada por defecto y el usuario la despliega
// solo cuando la necesita.
//
// No mantiene estado del dominio: recibe la configuración y los callbacks por props y los pasa
// tal cual a los formularios hijos.

import type { ReactNode } from "react";

export interface PanelConfiguracionProps {
  /** Contenido de configuración (formularios de parámetros y editor de reglas). */
  children: ReactNode;
  /** Si el panel arranca abierto. Por defecto `false` (plegado). */
  abiertoPorDefecto?: boolean;
}

/**
 * Panel desplegable de configuración. Agrupa los formularios de configuración en un bloque
 * colapsable para mantener la pantalla despejada mientras no se editan los parámetros ni las
 * reglas.
 */
export default function PanelConfiguracion({
  children,
  abiertoPorDefecto = false,
}: PanelConfiguracionProps) {
  return (
    <details
      className="panel-configuracion"
      open={abiertoPorDefecto}
      style={{
        border: "1px solid var(--color-borde)",
        borderRadius: 8,
        background: "var(--color-superficie)",
        margin: "1rem 0",
        overflow: "hidden",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          listStyle: "none",
          userSelect: "none",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.75rem 1rem",
          fontWeight: 600,
          fontSize: "1rem",
          color: "var(--color-texto)",
          background: "var(--color-superficie-alt)",
        }}
      >
        <span aria-hidden="true" className="panel-configuracion__chevron">
          ▸
        </span>
        Configuración
        <span
          style={{
            marginLeft: "auto",
            fontWeight: 400,
            fontSize: "0.85rem",
            color: "var(--color-texto-tenue)",
          }}
        >
          Parámetros y reglas de despiece
        </span>
      </summary>

      <div style={{ padding: "1rem" }}>{children}</div>
    </details>
  );
}
