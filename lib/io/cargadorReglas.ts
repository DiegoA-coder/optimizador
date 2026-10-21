// lib/io/cargadorReglas.ts
// Lee y escribe el archivo `.env`: parámetros generales de aluminio (LARGO_TIRA_CM, SIERRA_CM),
// parámetros de vidrio (VIDRIO_*) y reglas de despiece por perfil con el formato
//   REGLA_<PERFIL>_<n>=material|cantidad|base|descuentoCm|divisor
// Porta `io.CargadorReglas` del proyecto Java para garantizar interoperabilidad del formato.
//
// `parsearEnv(texto)` reproduce el parseo de `CargadorReglas.parsear(List<String>)`:
//   - divide el texto en líneas y las recorre 1-indexadas (igual que Java usa `i + 1`),
//   - ignora líneas vacías y comentarios (`#`),
//   - lanza `Error` con el número de línea cuando falta `=`, cuando una regla no tiene
//     exactamente 5 campos o cuando un número (parámetro o campo de regla) es inválido.
// `serializarEnv(config)` genera un `.env` con las mismas claves y el mismo formato de regla
// que consume el Java, de modo que `parsearEnv(serializarEnv(config))` reconstruye la config.

import {
  ConfiguracionCorte,
  Medida,
  ReglaCorte,
  crearReglaCorte,
} from "../dominio/modelos";
import {
  LARGO_TIRA_POR_DEFECTO,
  Parametros,
  SIERRA_POR_DEFECTO,
  crearParametros,
} from "../dominio/parametros";
import {
  ALTO_AJUSTE_POR_DEFECTO,
  ANCHO_AJUSTE_POR_DEFECTO,
  MATERIALES_ALTO_POR_DEFECTO,
  MATERIAL_ANCHO_POR_DEFECTO,
  PANEL_ALTO_POR_DEFECTO,
  PANEL_ANCHO_POR_DEFECTO,
  PERMITIR_ROTACION_POR_DEFECTO,
  ParametrosVidrio,
  crearParametrosVidrio,
} from "../dominio/parametrosVidrio";

// --- Parseo -----------------------------------------------------------------

/**
 * Parsea el contenido de un archivo `.env` a una `ConfiguracionCorte`.
 * Reproduce `CargadorReglas.parsear`: parámetros de aluminio y vidrio con sus valores
 * por defecto (sobrescritos si aparecen) y reglas de despiece por perfil.
 *
 * Lanza `Error` (con los mensajes del Java, incluyendo el número de línea 1-indexado) cuando:
 *   - una línea no vacía/no comentario no contiene `=`,
 *   - una regla no tiene exactamente 5 campos separados por `|`,
 *   - un número (parámetro o campo de regla) no es válido,
 *   - no se define ninguna regla.
 */
export function parsearEnv(texto: string): ConfiguracionCorte {
  // `split(/\r\n|\r|\n/)` para tolerar finales de línea CRLF/CR/LF igual que Files.readAllLines.
  const lineas = texto.split(/\r\n|\r|\n/);

  let largoTira = LARGO_TIRA_POR_DEFECTO;
  let sierra = SIERRA_POR_DEFECTO;
  const reglasPorPerfil: Record<string, ReglaCorte[]> = {};

  // Parámetros de vidrio con sus valores por defecto; se sobrescriben si aparecen en el .env.
  let vidrioAncho = PANEL_ANCHO_POR_DEFECTO;
  let vidrioAlto = PANEL_ALTO_POR_DEFECTO;
  let vidrioMatAncho = MATERIAL_ANCHO_POR_DEFECTO;
  let vidrioAjusteAncho = ANCHO_AJUSTE_POR_DEFECTO;
  let vidrioMatsAlto: readonly string[] = MATERIALES_ALTO_POR_DEFECTO;
  let vidrioAjusteAlto = ALTO_AJUSTE_POR_DEFECTO;
  let vidrioRotacion = PERMITIR_ROTACION_POR_DEFECTO;

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i].trim();
    if (linea.length === 0 || linea.startsWith("#")) continue;

    const igual = linea.indexOf("=");
    if (igual < 0) {
      throw new Error(`.env línea ${i + 1}: se esperaba 'CLAVE=valor'`);
    }
    const clave = linea.substring(0, igual).trim();
    const valor = linea.substring(igual + 1).trim();
    const numeroLinea = i + 1;

    switch (clave) {
      case "LARGO_TIRA_CM":
        largoTira = decimalPositivo(clave, valor, numeroLinea);
        break;
      case "SIERRA_CM":
        sierra = decimalPositivo(clave, valor, numeroLinea);
        break;
      case "VIDRIO_PANEL_ANCHO_CM":
        vidrioAncho = decimalPositivo(clave, valor, numeroLinea);
        break;
      case "VIDRIO_PANEL_ALTO_CM":
        vidrioAlto = decimalPositivo(clave, valor, numeroLinea);
        break;
      case "VIDRIO_MATERIAL_ANCHO":
        vidrioMatAncho = exigirTexto(valor, clave, numeroLinea);
        break;
      case "VIDRIO_ANCHO_AJUSTE_CM":
        vidrioAjusteAncho = decimal(valor, clave, numeroLinea);
        break;
      case "VIDRIO_MATERIALES_ALTO":
        vidrioMatsAlto = listaTexto(valor, clave, numeroLinea);
        break;
      case "VIDRIO_MATERIAL_ALTO": // compatibilidad con el nombre antiguo
        vidrioMatsAlto = listaTexto(valor, clave, numeroLinea);
        break;
      case "VIDRIO_ALTO_AJUSTE_CM":
        vidrioAjusteAlto = decimal(valor, clave, numeroLinea);
        break;
      case "VIDRIO_PERMITIR_ROTACION":
        vidrioRotacion = parsearBooleano(valor);
        break;
      case "VIDRIO_PIEZAS_POR_VENTANA":
        // obsoleto: ahora el número de piezas = materiales de alto
        break;
      default:
        if (clave.startsWith("REGLA_")) {
          const perfil = perfilDeClave(clave, numeroLinea);
          (reglasPorPerfil[perfil] ??= []).push(parsearRegla(valor, numeroLinea));
        }
        // Otras claves se ignoran, permitiendo config extra en el .env.
        break;
    }
  }

  if (Object.keys(reglasPorPerfil).length === 0) {
    throw new Error("El archivo .env no define ninguna regla (REGLA_<PERFIL>_<n>=...)");
  }

  const parametros: Parametros = crearParametros(largoTira, sierra);
  const parametrosVidrio: ParametrosVidrio = crearParametrosVidrio(
    vidrioAncho,
    vidrioAlto,
    vidrioMatAncho,
    vidrioAjusteAncho,
    vidrioMatsAlto,
    vidrioAjusteAlto,
    vidrioRotacion,
  );
  return { parametros, parametrosVidrio, reglasPorPerfil };
}

/** Equivale a `Boolean.parseBoolean`: verdadero solo si el texto es "true" (sin distinguir mayúsculas). */
function parsearBooleano(valor: string): boolean {
  return valor.trim().toLowerCase() === "true";
}

/** Porta `exigirTexto`: el valor no puede estar en blanco. */
function exigirTexto(valor: string, clave: string, numeroLinea: number): string {
  if (valor.trim().length === 0) {
    throw new Error(`.env línea ${numeroLinea}: '${clave}' no puede estar vacío`);
  }
  return valor;
}

/** Porta `listaTexto`: materiales separados por comas, al menos uno no vacío. */
function listaTexto(valor: string, clave: string, numeroLinea: number): string[] {
  const items = valor
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length !== 0);
  if (items.length === 0) {
    throw new Error(`.env línea ${numeroLinea}: '${clave}' debe tener al menos un material`);
  }
  return items;
}

/** Porta `perfilDeClave`: REGLA_<PERFIL>_<n> -> extrae el perfil entre "REGLA_" y el último "_". */
function perfilDeClave(clave: string, numeroLinea: number): string {
  const resto = clave.substring("REGLA_".length);
  const ultimoGuion = resto.lastIndexOf("_");
  if (ultimoGuion <= 0) {
    throw new Error(`.env línea ${numeroLinea}: clave de regla inválida '${clave}'`);
  }
  return resto.substring(0, ultimoGuion);
}

/** Porta `parsearRegla`: "material|cantidad|base|descuentoCm|divisor". */
function parsearRegla(valor: string, numeroLinea: number): ReglaCorte {
  // Igual que Java `valor.split("\\|")`: elimina los campos vacíos finales,
  // de modo que un número incorrecto de campos sin relleno dispara el error de 5 campos.
  const partes = dividirBarras(valor);
  if (partes.length !== 5) {
    throw new Error(
      `.env línea ${numeroLinea}: la regla debe tener 5 campos separados por '|' (material|cantidad|base|descuentoCm|divisor)`,
    );
  }
  const material = partes[0].trim();
  if (material.length === 0) {
    throw new Error(`.env línea ${numeroLinea}: el material no puede estar vacío`);
  }
  const cantidad = entero(partes[1], "cantidad", numeroLinea);
  const base = parsearBase(partes[2], numeroLinea);
  const descuentoCm = decimal(partes[3], "descuentoCm", numeroLinea);
  const divisor = entero(partes[4], "divisor", numeroLinea);
  return crearReglaCorte(material, cantidad, base, descuentoCm, divisor);
}

/**
 * Divide por `|` replicando el comportamiento de `String.split("\\|")` de Java,
 * que descarta los campos vacíos al final de la cadena pero conserva los intermedios.
 */
function dividirBarras(valor: string): string[] {
  const partes = valor.split("|");
  while (partes.length > 0 && partes[partes.length - 1] === "") {
    partes.pop();
  }
  return partes;
}

/** Porta la lectura de `Medida.valueOf(...toUpperCase())`: la base debe ser INFERIOR o LATERAL. */
function parsearBase(crudo: string, numeroLinea: number): Medida {
  const texto = crudo.trim().toUpperCase();
  if (texto === "INFERIOR" || texto === "LATERAL") {
    return texto;
  }
  throw new Error(`.env línea ${numeroLinea}: la base debe ser INFERIOR o LATERAL`);
}

/** Porta `decimalPositivo`: decimal > 0. */
function decimalPositivo(clave: string, valor: string, numeroLinea: number): number {
  const n = decimal(valor, clave, numeroLinea);
  if (n <= 0) {
    throw new Error(`.env línea ${numeroLinea}: '${clave}' debe ser mayor a 0`);
  }
  return n;
}

/** Porta `entero`: entero válido (equivale a `Integer.parseInt`). */
function entero(crudo: string, campo: string, numeroLinea: number): number {
  const texto = crudo.trim();
  // `Integer.parseInt` acepta un signo opcional seguido de dígitos; nada de decimales ni espacios internos.
  if (/^[+-]?\d+$/.test(texto)) {
    return Number.parseInt(texto, 10);
  }
  throw new Error(`.env línea ${numeroLinea}: el campo '${campo}' debe ser un entero`);
}

/** Porta `decimal`: número válido (equivale a `Double.parseDouble`). */
function decimal(crudo: string, campo: string, numeroLinea: number): number {
  const texto = crudo.trim();
  if (texto.length !== 0) {
    const n = Number(texto);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  throw new Error(`.env línea ${numeroLinea}: el campo '${campo}' debe ser un número`);
}

// --- Serialización ----------------------------------------------------------

/**
 * Serializa una `ConfiguracionCorte` al formato `.env` que consume el proyecto Java:
 * parámetros de aluminio (LARGO_TIRA_CM, SIERRA_CM), parámetros de vidrio (VIDRIO_*) y
 * reglas de despiece por perfil (REGLA_<PERFIL>_<n>=material|cantidad|base|descuentoCm|divisor).
 *
 * `parsearEnv(serializarEnv(config))` reconstruye una configuración equivalente.
 */
export function serializarEnv(config: ConfiguracionCorte): string {
  const { parametros, parametrosVidrio, reglasPorPerfil } = config;
  const lineas: string[] = [];

  lineas.push("# Parámetros generales de la tira (en cm)");
  lineas.push(`LARGO_TIRA_CM=${numero(parametros.largoTiraCm)}`);
  lineas.push(`SIERRA_CM=${numero(parametros.sierraCm)}`);
  lineas.push("");

  lineas.push("# Vidrio (unidades en cm)");
  lineas.push(`VIDRIO_PANEL_ANCHO_CM=${numero(parametrosVidrio.panelAnchoCm)}`);
  lineas.push(`VIDRIO_PANEL_ALTO_CM=${numero(parametrosVidrio.panelAltoCm)}`);
  lineas.push(`VIDRIO_MATERIAL_ANCHO=${parametrosVidrio.materialAncho}`);
  lineas.push(`VIDRIO_ANCHO_AJUSTE_CM=${numero(parametrosVidrio.anchoAjusteCm)}`);
  lineas.push(`VIDRIO_MATERIALES_ALTO=${parametrosVidrio.materialesAlto.join(",")}`);
  lineas.push(`VIDRIO_ALTO_AJUSTE_CM=${numero(parametrosVidrio.altoAjusteCm)}`);
  lineas.push(`VIDRIO_PERMITIR_ROTACION=${parametrosVidrio.permitirRotacion}`);

  for (const perfil of Object.keys(reglasPorPerfil)) {
    const reglas = reglasPorPerfil[perfil];
    lineas.push("");
    lineas.push(`# Perfil ${perfil}`);
    reglas.forEach((regla, idx) => {
      // Numeración 1-indexada por perfil, igual que el .env del Java (REGLA_<PERFIL>_1, _2, ...).
      lineas.push(`REGLA_${perfil}_${idx + 1}=${serializarRegla(regla)}`);
    });
  }

  // Termina con un salto de línea final, como un archivo .env convencional.
  return lineas.join("\n") + "\n";
}

/** Serializa una regla al formato "material|cantidad|base|descuentoCm|divisor". */
function serializarRegla(regla: ReglaCorte): string {
  return [
    regla.material,
    String(regla.cantidad),
    regla.base,
    numero(regla.descuentoCm),
    String(regla.divisor),
  ].join("|");
}

/**
 * Formatea un número para el `.env`. Usa la representación más compacta posible
 * (sin ceros/decimales superfluos) que `Number()` vuelve a parsear al mismo valor,
 * evitando notación científica que `Double.parseDouble` también aceptaría pero que
 * ensucia el archivo.
 */
function numero(valor: number): string {
  return String(valor);
}
