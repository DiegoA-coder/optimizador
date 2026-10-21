// lib/dominio/optimizador.ts
// Optimización 1D del acomodo de piezas de aluminio en tiras, con la heurística
// Best Fit Decreasing, y planificación agrupando por perfil y material.
// Porta la clase `dominio.Optimizador` del proyecto Java. TypeScript puro, sin React.

import { Parametros } from "./parametros";
import { Pieza } from "./modelos";
import { Tira, crearTira, cabe, agregar } from "./tira";
import { PlanCorte, crearPlanCorte, PorPerfilMaterialTiras } from "./planCorte";

/**
 * Best Fit Decreasing: ordena las piezas de mayor a menor longitud (orden estable) y coloca
 * cada una en la tira con menor sobrante que todavía la acepte. Si ninguna tira la acepta, abre
 * una nueva. Es heurístico (el problema es NP-hard), pero con piezas de ventana queda muy cerca
 * del óptimo y es instantáneo. Porta `Optimizador.optimizar`.
 *
 * Precondición: todas las piezas comparten perfil y material (lo garantiza `planificar`).
 */
export function optimizar(piezas: Pieza[], parametros: Parametros): Tira[] {
  // Orden descendente ESTABLE por longitud: `Array.prototype.sort` es estable en los motores
  // modernos (V8/Node), por lo que mantiene el orden de aparición entre piezas de igual longitud.
  const ordenadas = [...piezas].sort((a, b) => b.longitudCm - a.longitudCm);

  const tiras: Tira[] = [];
  for (const pieza of ordenadas) {
    let mejorIndice = -1;
    // Invariante de lazo: `mejorIndice` apunta a la tira que YA acepta la pieza con menor
    // restanteCm entre las visitadas hasta ahora (-1 si ninguna la acepta aún).
    for (let i = 0; i < tiras.length; i++) {
      const tira = tiras[i];
      if (cabe(tira, pieza) && (mejorIndice === -1 || tira.restanteCm < tiras[mejorIndice].restanteCm)) {
        mejorIndice = i;
      }
    }
    if (mejorIndice === -1) {
      // Ninguna tira acepta la pieza: abrir una nueva.
      tiras.push(agregar(crearTira(parametros), pieza));
    } else {
      // Las tiras son inmutables: `agregar` devuelve una nueva, hay que reemplazar en el arreglo.
      tiras[mejorIndice] = agregar(tiras[mejorIndice], pieza);
    }
  }
  return tiras;
}

/**
 * Agrupa las piezas por perfil → material (conservando el orden de aparición) y optimiza cada
 * grupo por separado, de modo que una tira nunca mezcla perfiles ni materiales distintos.
 * Porta `Optimizador.planificar`.
 */
export function planificar(piezas: Pieza[], parametros: Parametros): PlanCorte {
  // Agrupar conservando el orden de aparición de perfiles y materiales (como LinkedHashMap).
  const porPerfilMaterial = new Map<string, Map<string, Pieza[]>>();
  for (const pieza of piezas) {
    let porMaterial = porPerfilMaterial.get(pieza.perfil);
    if (porMaterial === undefined) {
      porMaterial = new Map<string, Pieza[]>();
      porPerfilMaterial.set(pieza.perfil, porMaterial);
    }
    let grupo = porMaterial.get(pieza.material);
    if (grupo === undefined) {
      grupo = [];
      porMaterial.set(pieza.material, grupo);
    }
    grupo.push(pieza);
  }

  // Optimizar cada grupo, construyendo el mismo mapa pero con tiras en lugar de piezas.
  const plan: PorPerfilMaterialTiras = new Map<string, Map<string, Tira[]>>();
  for (const [perfil, porMaterial] of porPerfilMaterial) {
    const planMaterial = new Map<string, Tira[]>();
    for (const [material, grupo] of porMaterial) {
      planMaterial.set(material, optimizar(grupo, parametros));
    }
    plan.set(perfil, planMaterial);
  }

  return crearPlanCorte(parametros, plan);
}
