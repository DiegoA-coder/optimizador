// lib/dominio/pipeline.ts
// Pipeline de optimización: encadena el despiece y la optimización de aluminio con el cálculo y
// la optimización de vidrio, y arma el `ResultadoCompleto`. Porta la orquestación que el proyecto
// Java hace en su capa de aplicación. TypeScript puro, sin React.
//
// No captura ni transforma errores: los `Error` de validación del dominio (perfil sin reglas,
// medidas inválidas, piezas que no caben, etc.) se propagan tal cual al llamador.

import { ConfiguracionCorte, ResultadoCompleto, Ventana } from "./modelos";
import { expandir } from "./despiezador";
import { planificar } from "./optimizador";
import { calcularVidrio } from "./calculadorVidrio";
import { optimizarVidrio } from "./optimizadorVidrio";

/**
 * Ejecuta el pipeline completo para un conjunto de ventanas y una configuración de corte.
 *
 * Pasos (en orden):
 *  1. `expandir`        → despiece plano de piezas de aluminio.
 *  2. `planificar`      → optimización 1D en tiras agrupadas por perfil y material (`PlanCorte`).
 *  3. `calcularVidrio`  → piezas de vidrio derivadas de cada ventana.
 *  4. `optimizarVidrio` → acomodo 2D de las piezas de vidrio en paneles (`PlanVidrio`).
 *
 * Devuelve `{ planCorte, piezas, planVidrio }`. Propaga cualquier `Error` de validación del
 * dominio sin envolverlo ni ocultarlo.
 */
export function ejecutarPipeline(
  ventanas: Ventana[],
  config: ConfiguracionCorte,
): ResultadoCompleto {
  const piezas = expandir(ventanas, config.reglasPorPerfil, config.parametros);
  const planCorte = planificar(piezas, config.parametros);

  const piezasVidrio = calcularVidrio(
    ventanas,
    config.reglasPorPerfil,
    config.parametros,
    config.parametrosVidrio,
  );
  const planVidrio = optimizarVidrio(piezasVidrio, config.parametrosVidrio);

  return { planCorte, piezas, planVidrio };
}
