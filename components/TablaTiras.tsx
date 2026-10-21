"use client";

// components/TablaTiras.tsx
// Tabla de solo lectura del plan de corte de aluminio: tiras agrupadas por perfil → material,
// mostrando por cada tira sus cortes, el total usado y el sobrante, más los totales por perfil
// y el resumen global (total de tiras y desperdicio total).
//
// Porta la sección "PLAN DE CORTE DE ALUMINIO" del `ReporteTexto` Java a una vista React.
// Toda la lógica de agregación (perfiles, materiales, numeración, desperdicio) vive en el dominio
// (`@/lib/dominio/planCorte`), por lo que este componente solo lee y presenta.

import {
  PlanCorte,
  tirasDePerfil,
  desperdicioDePerfil,
  tirasNumeradas,
} from "@/lib/dominio/planCorte";
import { Tira, usadoCm, restanteCm } from "@/lib/dominio/tira";
import { cm } from "@/lib/dominio/parametros";

export interface TablaTirasProps {
  /** Plan de corte de aluminio ya calculado por el pipeline. */
  plan: PlanCorte;
}

const estiloTabla: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  marginBottom: "1rem",
};

const estiloTh: React.CSSProperties = {
  textAlign: "left",
  padding: "0.4rem 0.6rem",
  borderBottom: "2px solid #999",
  fontSize: "0.85rem",
};

const estiloTd: React.CSSProperties = {
  padding: "0.35rem 0.6rem",
  borderBottom: "1px solid #ddd",
  verticalAlign: "top",
  fontSize: "0.85rem",
};

const estiloNum: React.CSSProperties = { ...estiloTd, textAlign: "right", whiteSpace: "nowrap" };

/** Describe los cortes de una tira como "longitud cm (ventana) + longitud cm (ventana)". */
function describirCortes(tira: Tira): string {
  return tira.piezas.map((pz) => `${cm(pz.longitudCm)} cm (${pz.etiquetaVentana})`).join(" + ");
}

export default function TablaTiras({ plan }: TablaTirasProps) {
  if (plan.perfiles.length === 0) {
    return <p style={{ fontSize: "0.9rem", color: "#666" }}>No hay tiras de aluminio para mostrar.</p>;
  }

  return (
    <section aria-label="Plan de corte de aluminio">
      <h3 style={{ marginBottom: "0.25rem" }}>Plan de corte de aluminio</h3>
      <p style={{ margin: "0 0 1rem", fontSize: "0.85rem", color: "#555" }}>
        Tira: {cm(plan.parametros.largoTiraCm)} cm · Sierra (kerf): {cm(plan.parametros.sierraCm)} cm
      </p>

      {plan.perfiles.map((perfil) => {
        const numeradas = tirasNumeradas(plan, perfil);
        return (
          <div key={perfil} style={{ marginBottom: "1.5rem" }}>
            <h4 style={{ marginBottom: "0.5rem" }}>
              Perfil {perfil} — {tirasDePerfil(plan, perfil)} tira(s) · desperdicio:{" "}
              {cm(desperdicioDePerfil(plan, perfil))} cm
            </h4>
            <table style={estiloTabla}>
              <thead>
                <tr>
                  <th style={estiloTh}>Material</th>
                  <th style={estiloTh}>Tira</th>
                  <th style={estiloTh}>Cortes</th>
                  <th style={{ ...estiloTh, textAlign: "right" }}>Usado (cm)</th>
                  <th style={{ ...estiloTh, textAlign: "right" }}>Sobrante (cm)</th>
                </tr>
              </thead>
              <tbody>
                {numeradas.map(({ numero, material, tira }) => (
                  <tr key={`${perfil}-${numero}`}>
                    <td style={estiloTd}>{material.toUpperCase()}</td>
                    <td style={estiloNum}>{numero}</td>
                    <td style={estiloTd}>{describirCortes(tira)}</td>
                    <td style={estiloNum}>{cm(usadoCm(tira))}</td>
                    <td style={estiloNum}>{cm(restanteCm(tira))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      <p style={{ fontWeight: 600, fontSize: "0.9rem" }}>
        Total de tiras: {plan.totalTiras} · Desperdicio total: {cm(plan.desperdicioTotal)} cm
      </p>
    </section>
  );
}
