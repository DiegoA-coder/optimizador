// middleware.ts
// Rate limiting en el edge para frenar tráfico automatizado abusivo (opción 2 "anti-bots").
// Se ejecuta antes de servir cada ruta que coincide con `config.matcher`. Lleva una cuenta de
// peticiones por IP en una ventana de tiempo fija y responde 429 (Too Many Requests) cuando se
// excede el límite, añadiendo las cabeceras estándar `Retry-After` y `X-RateLimit-*`.
//
// LIMITACIÓN IMPORTANTE: el contador vive EN MEMORIA del proceso, por lo que el límite es
// por-instancia. En un despliegue serverless/edge con varias instancias (p. ej. Vercel) cada una
// tiene su propio contador, así que el límite efectivo se multiplica por el número de instancias.
// Para un límite global y robusto usa un store compartido (Upstash Redis, Vercel KV, Cloudflare
// Durable Objects): la función `estaLimitado` es el único punto que habría que cambiar.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Número máximo de peticiones permitidas por IP dentro de la ventana. */
const LIMITE_PETICIONES = 60;
/** Duración de la ventana de conteo, en milisegundos (aquí: 1 minuto). */
const VENTANA_MS = 60_000;
/** Cada cuánto se purgan las entradas vencidas del mapa, para que no crezca sin control. */
const INTERVALO_LIMPIEZA_MS = 5 * 60_000;

/** Estado de conteo de una IP: cuántas peticiones lleva y cuándo expira su ventana. */
interface Contador {
  conteo: number;
  expiraEn: number; // epoch ms en que se reinicia la ventana
}

// Mapa IP -> contador. Persiste entre invocaciones mientras la instancia siga viva.
const contadores = new Map<string, Contador>();
let ultimaLimpieza = Date.now();

/** Elimina del mapa las ventanas ya vencidas para acotar el uso de memoria. */
function limpiarVencidos(ahora: number): void {
  if (ahora - ultimaLimpieza < INTERVALO_LIMPIEZA_MS) return;
  for (const [ip, c] of contadores) {
    if (c.expiraEn <= ahora) contadores.delete(ip);
  }
  ultimaLimpieza = ahora;
}

/** Resultado de evaluar el límite para una IP en un instante dado. */
interface Resultado {
  limitado: boolean;
  restantes: number;
  reinicioEn: number; // epoch ms del reinicio de la ventana
}

/**
 * Registra una petición de `ip` y decide si está limitada. Reinicia la ventana cuando expira.
 * Este es el único punto a reemplazar por un store distribuido para un límite global.
 */
function estaLimitado(ip: string, ahora: number): Resultado {
  const actual = contadores.get(ip);

  if (actual === undefined || actual.expiraEn <= ahora) {
    // Nueva ventana para esta IP.
    const nuevo: Contador = { conteo: 1, expiraEn: ahora + VENTANA_MS };
    contadores.set(ip, nuevo);
    return { limitado: false, restantes: LIMITE_PETICIONES - 1, reinicioEn: nuevo.expiraEn };
  }

  actual.conteo += 1;
  const restantes = Math.max(LIMITE_PETICIONES - actual.conteo, 0);
  return {
    limitado: actual.conteo > LIMITE_PETICIONES,
    restantes,
    reinicioEn: actual.expiraEn,
  };
}

/** Obtiene la IP del cliente a partir de las cabeceras de proxy habituales. */
function obtenerIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    // `x-forwarded-for` puede traer "cliente, proxy1, proxy2"; la primera es la del cliente.
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip")?.trim() || "desconocida";
}

export function middleware(req: NextRequest): NextResponse {
  const ahora = Date.now();
  limpiarVencidos(ahora);

  const ip = obtenerIp(req);
  const { limitado, restantes, reinicioEn } = estaLimitado(ip, ahora);

  const cabeceras: Record<string, string> = {
    "X-RateLimit-Limit": String(LIMITE_PETICIONES),
    "X-RateLimit-Remaining": String(restantes),
    "X-RateLimit-Reset": String(Math.ceil(reinicioEn / 1000)), // epoch en segundos
  };

  if (limitado) {
    const retryAfterSeg = Math.max(Math.ceil((reinicioEn - ahora) / 1000), 1);
    return new NextResponse("Demasiadas peticiones. Inténtalo de nuevo más tarde.", {
      status: 429,
      headers: {
        ...cabeceras,
        "Retry-After": String(retryAfterSeg),
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  const res = NextResponse.next();
  for (const [clave, valor] of Object.entries(cabeceras)) {
    res.headers.set(clave, valor);
  }
  return res;
}

/**
 * Rutas donde se aplica el rate limiting. Se excluyen los assets estáticos de Next
 * (`_next/static`, `_next/image`) y el favicon, que no tiene sentido limitar.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
