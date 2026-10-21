"use client";

// components/EditorReglas.tsx
// Editor de reglas de despiece por perfil. Permite agregar, editar y eliminar
// reglas (material, cantidad, base, descuentoCm, divisor) para cada perfil, con
// validación en vivo equivalente al compact constructor de `ReglaCorte` del dominio.
// Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7

import { useMemo } from "react";
import type { Medida, ReglaCorte } from "@/lib/dominio/modelos";

/** Opciones válidas para el campo `base` de una regla. */
const BASES: readonly Medida[] = ["INFERIOR", "LATERAL"];

export interface EditorReglasProps {
  /** Reglas de despiece agrupadas por perfil. */
  reglasPorPerfil: Record<string, ReglaCorte[]>;
  /** Se invoca con el mapa completo de reglas tras cada cambio. */
  onCambio: (reglasPorPerfil: Record<string, ReglaCorte[]>) => void;
}

/** Regla por defecto que se agrega al pulsar "Agregar regla". */
function reglaPorDefecto(): ReglaCorte {
  return { material: "", cantidad: 1, base: "INFERIOR", descuentoCm: 0, divisor: 1 };
}

/**
 * Valida una regla con las mismas invariantes que `crearReglaCorte`.
 * Devuelve la lista de mensajes de error (vacía si la regla es válida).
 */
export function validarRegla(regla: ReglaCorte): string[] {
  const errores: string[] = [];
  if (regla.material == null || regla.material.trim().length === 0) {
    errores.push("El material no puede estar vacío.");
  }
  if (regla.base !== "INFERIOR" && regla.base !== "LATERAL") {
    errores.push("La base debe ser INFERIOR o LATERAL.");
  }
  if (!(regla.cantidad > 0)) {
    errores.push("La cantidad debe ser mayor a 0.");
  }
  if (!(regla.divisor > 0)) {
    errores.push("El divisor debe ser mayor a 0.");
  }
  if (!(regla.descuentoCm >= 0)) {
    errores.push("El descuento (cm) debe ser mayor o igual a 0.");
  }
  return errores;
}

/** Lee un valor numérico de un input, tolerando el campo vacío (-> NaN). */
function aNumero(valor: string): number {
  if (valor.trim().length === 0) {
    return NaN;
  }
  return Number(valor);
}

export default function EditorReglas({ reglasPorPerfil, onCambio }: EditorReglasProps) {
  const perfiles = useMemo(() => Object.keys(reglasPorPerfil), [reglasPorPerfil]);

  /** Reemplaza las reglas de un perfil y notifica el cambio. */
  function setReglasPerfil(perfil: string, reglas: ReglaCorte[]): void {
    onCambio({ ...reglasPorPerfil, [perfil]: reglas });
  }

  /** Aplica un cambio parcial a la regla `indice` del perfil indicado. */
  function editarRegla(perfil: string, indice: number, cambios: Partial<ReglaCorte>): void {
    const reglas = reglasPorPerfil[perfil] ?? [];
    const nuevas = reglas.map((regla, i) => (i === indice ? { ...regla, ...cambios } : regla));
    setReglasPerfil(perfil, nuevas);
  }

  function agregarRegla(perfil: string): void {
    const reglas = reglasPorPerfil[perfil] ?? [];
    setReglasPerfil(perfil, [...reglas, reglaPorDefecto()]);
  }

  function eliminarRegla(perfil: string, indice: number): void {
    const reglas = reglasPorPerfil[perfil] ?? [];
    setReglasPerfil(
      perfil,
      reglas.filter((_, i) => i !== indice),
    );
  }

  return (
    <section className="editor-reglas">
      <h2>Reglas de despiece por perfil</h2>

      {perfiles.length === 0 && (
        <p className="editor-reglas__vacio">No hay perfiles con reglas definidas.</p>
      )}

      {perfiles.map((perfil) => {
        const reglas = reglasPorPerfil[perfil] ?? [];
        return (
          <fieldset key={perfil} className="editor-reglas__perfil">
            <legend>Perfil: {perfil}</legend>

            {reglas.length === 0 ? (
              <p className="editor-reglas__vacio">Este perfil no tiene reglas.</p>
            ) : (
              <table className="editor-reglas__tabla">
                <thead>
                  <tr>
                    <th scope="col">Material</th>
                    <th scope="col">Cantidad</th>
                    <th scope="col">Base</th>
                    <th scope="col">Descuento (cm)</th>
                    <th scope="col">Divisor</th>
                    <th scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {reglas.map((regla, indice) => {
                    const errores = validarRegla(regla);
                    const invalida = errores.length > 0;
                    const idErrores = `errores-${perfil}-${indice}`;
                    return (
                      <tr
                        key={indice}
                        className={invalida ? "editor-reglas__fila--invalida" : undefined}
                      >
                        <td>
                          <input
                            type="text"
                            aria-label={`Material de la regla ${indice + 1} del perfil ${perfil}`}
                            aria-invalid={invalida || undefined}
                            aria-describedby={invalida ? idErrores : undefined}
                            value={regla.material}
                            onChange={(e) =>
                              editarRegla(perfil, indice, { material: e.target.value })
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            aria-label={`Cantidad de la regla ${indice + 1} del perfil ${perfil}`}
                            value={Number.isNaN(regla.cantidad) ? "" : regla.cantidad}
                            onChange={(e) =>
                              editarRegla(perfil, indice, { cantidad: aNumero(e.target.value) })
                            }
                          />
                        </td>
                        <td>
                          <select
                            aria-label={`Base de la regla ${indice + 1} del perfil ${perfil}`}
                            value={regla.base}
                            onChange={(e) =>
                              editarRegla(perfil, indice, { base: e.target.value as Medida })
                            }
                          >
                            {BASES.map((base) => (
                              <option key={base} value={base}>
                                {base}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            step="any"
                            aria-label={`Descuento en cm de la regla ${indice + 1} del perfil ${perfil}`}
                            value={Number.isNaN(regla.descuentoCm) ? "" : regla.descuentoCm}
                            onChange={(e) =>
                              editarRegla(perfil, indice, { descuentoCm: aNumero(e.target.value) })
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            aria-label={`Divisor de la regla ${indice + 1} del perfil ${perfil}`}
                            value={Number.isNaN(regla.divisor) ? "" : regla.divisor}
                            onChange={(e) =>
                              editarRegla(perfil, indice, { divisor: aNumero(e.target.value) })
                            }
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => eliminarRegla(perfil, indice)}
                            aria-label={`Eliminar la regla ${indice + 1} del perfil ${perfil}`}
                          >
                            Eliminar
                          </button>
                          {invalida && (
                            <ul id={idErrores} className="editor-reglas__errores" role="alert">
                              {errores.map((error, i) => (
                                <li key={i}>{error}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            <button
              type="button"
              onClick={() => agregarRegla(perfil)}
              aria-label={`Agregar regla al perfil ${perfil}`}
            >
              Agregar regla
            </button>
          </fieldset>
        );
      })}
    </section>
  );
}
