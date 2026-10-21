"use client";

// app/ventanas/page.tsx
// Pantalla "Optimizador de ventanas" (aluminio + vidrio). Orquestador de la UI (Client Component).
// Mantiene el estado global de esta pantalla (ventanas, parámetros de aluminio y vidrio, reglas de
// despiece por perfil, resultado y error) y conecta los formularios con el pipeline de dominio.
//
// Al pulsar "Optimizar" invoca `ejecutarPipeline` dentro de un try/catch: si el dominio lanza un
// `Error` de validación (perfil sin reglas, medidas inválidas, piezas que no caben, etc.), se
// captura y se muestra en un banner (role="alert") sin romper la app; en caso de éxito se guarda
// el resultado y se renderizan `PanelResultados` y `BotonesExportar`.
//
// La importación/exportación de ventanas (`.json`) y de la configuración (`.env`) también se
// envuelve en try/catch: cualquier error de parseo de la capa IO (`parsearVentanas`/`parsearEnv`)
// se refleja en el mismo banner sin interrumpir la app (Requirements 10.6, 10.7).

import Link from "next/link";
import { useMemo, useState } from "react";

import FormularioVentanas from "@/components/FormularioVentanas";
import FormularioParametros from "@/components/FormularioParametros";
import EditorReglas from "@/components/EditorReglas";
import BotonOptimizar from "@/components/BotonOptimizar";
import PanelResultados from "@/components/PanelResultados";
import BotonesExportar from "@/components/BotonesExportar";

import {
  ConfiguracionCorte,
  ReglaCorte,
  ResultadoCompleto,
  Ventana,
  crearVentana,
} from "@/lib/dominio/modelos";
import { Parametros, porDefecto } from "@/lib/dominio/parametros";
import { ParametrosVidrio, porDefectoVidrio } from "@/lib/dominio/parametrosVidrio";
import { ejecutarPipeline } from "@/lib/dominio/pipeline";
import { parsearVentanas, serializarVentanas } from "@/lib/io/cargadorVentanas";
import { parsearEnv, serializarEnv } from "@/lib/io/cargadorReglas";

/**
 * Estado global de la pantalla. Equivale al `interface EstadoApp` del documento de diseño.
 */
interface EstadoApp {
  ventanas: Ventana[];
  parametros: Parametros;
  parametrosVidrio: ParametrosVidrio;
  reglasPorPerfil: Record<string, ReglaCorte[]>;
  resultado: ResultadoCompleto | null;
  error: string | null;
}

// Reglas de despiece por defecto: se derivan del mismo formato `.env` que consume el proyecto Java,
// de modo que la app arranca con un juego de reglas válido (perfiles 2PULG y 3PULG) sin pedir nada
// al usuario. Al editar las reglas (tarea posterior) este estado se reemplaza por completo.
const ENV_POR_DEFECTO = [
  "LARGO_TIRA_CM=605",
  "SIERRA_CM=0.4",
  "VIDRIO_PANEL_ANCHO_CM=180",
  "VIDRIO_PANEL_ALTO_CM=260",
  "VIDRIO_MATERIAL_ANCHO=Zoclo",
  "VIDRIO_ANCHO_AJUSTE_CM=1.8",
  "VIDRIO_MATERIALES_ALTO=Cerco Fijo,Cerco Corredizo",
  "VIDRIO_ALTO_AJUSTE_CM=-9.3",
  "VIDRIO_PERMITIR_ROTACION=true",
  "REGLA_2PULG_1=Riel|1|INFERIOR|0|1",
  "REGLA_2PULG_2=Chambrana|2|LATERAL|2.8|1",
  "REGLA_2PULG_3=Chambrana|1|INFERIOR|0|1",
  "REGLA_2PULG_4=Zoclo|2|INFERIOR|16.2|2",
  "REGLA_2PULG_5=Cabezal|2|INFERIOR|16.2|2",
  "REGLA_2PULG_6=Cerco Fijo|1|LATERAL|4|1",
  "REGLA_2PULG_7=Cerco Corredizo|1|LATERAL|3|1",
  "REGLA_2PULG_8=Cerco traslape Fijo|1|LATERAL|4|1",
  "REGLA_2PULG_9=Cerco traslape Corredizo|1|LATERAL|3|1",
].join("\n");

/** Construye el estado inicial con los valores por defecto del dominio y una ventana de ejemplo. */
function estadoInicial(): EstadoApp {
  return {
    ventanas: [crearVentana("V1", "2PULG", 100, 120, 1)],
    parametros: porDefecto(),
    parametrosVidrio: porDefectoVidrio(),
    reglasPorPerfil: parsearEnv(ENV_POR_DEFECTO).reglasPorPerfil,
    resultado: null,
    error: null,
  };
}

/**
 * Dispara en el navegador la descarga de un archivo con el `contenido`, nombre `nombreArchivo` y
 * tipo MIME `tipoMime`. Crea un Blob, una URL de objeto y un ancla temporal; tras el clic revoca
 * la URL para liberar memoria.
 */
function descargarArchivo(contenido: string, nombreArchivo: string, tipoMime: string): void {
  const blob = new Blob([contenido], { type: tipoMime });
  const url = URL.createObjectURL(blob);
  const ancla = document.createElement("a");
  ancla.href = url;
  ancla.download = nombreArchivo;
  document.body.appendChild(ancla);
  ancla.click();
  document.body.removeChild(ancla);
  URL.revokeObjectURL(url);
}

export default function PaginaVentanas() {
  const [estado, setEstado] = useState<EstadoApp>(estadoInicial);

  // La configuración de corte que consume el pipeline se arma a partir de las tres piezas de
  // configuración del estado. Se memoiza para no recrearla en cada render.
  const config = useMemo<ConfiguracionCorte>(
    () => ({
      parametros: estado.parametros,
      parametrosVidrio: estado.parametrosVidrio,
      reglasPorPerfil: estado.reglasPorPerfil,
    }),
    [estado.parametros, estado.parametrosVidrio, estado.reglasPorPerfil],
  );

  /**
   * Ejecuta el pipeline completo con el estado actual. Captura cualquier `Error` de validación del
   * dominio y lo deja en `error` (banner) sin romper la app; en caso de éxito guarda el resultado y
   * limpia el error previo. (Requirements 10.1–10.5)
   */
  function optimizar() {
    try {
      const resultado = ejecutarPipeline(estado.ventanas, config);
      setEstado((previo) => ({ ...previo, resultado, error: null }));
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e);
      setEstado((previo) => ({ ...previo, resultado: null, error: mensaje }));
    }
  }

  // --- Edición de estado desde los formularios -------------------------------

  function cambiarVentanas(ventanas: Ventana[]) {
    setEstado((previo) => ({ ...previo, ventanas }));
  }

  /** Actualiza parámetros de aluminio y vidrio (las reglas se editan en `EditorReglas`). */
  function cambiarConfiguracion(nueva: ConfiguracionCorte) {
    setEstado((previo) => ({
      ...previo,
      parametros: nueva.parametros,
      parametrosVidrio: nueva.parametrosVidrio,
      reglasPorPerfil: nueva.reglasPorPerfil,
    }));
  }

  function cambiarReglas(reglasPorPerfil: Record<string, ReglaCorte[]>) {
    setEstado((previo) => ({ ...previo, reglasPorPerfil }));
  }

  // --- Importar / exportar ventanas (.json) ----------------------------------

  /**
   * Lee el archivo elegido, lo parsea con `parsearVentanas` y, si es válido, reemplaza las
   * ventanas del estado. Cualquier error de parseo (JSON mal formado, tipos incorrectos) se
   * muestra en el banner sin interrumpir la app. (Requirement 10.7)
   */
  async function importarVentanas(archivo: File) {
    try {
      const texto = await archivo.text();
      const ventanas = parsearVentanas(texto);
      setEstado((previo) => ({ ...previo, ventanas, error: null }));
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e);
      setEstado((previo) => ({ ...previo, error: mensaje }));
    }
  }

  /** Serializa las ventanas actuales a JSON y dispara su descarga como `ventanas.json`. */
  function exportarVentanas() {
    try {
      const json = serializarVentanas(estado.ventanas);
      descargarArchivo(json, "ventanas.json", "application/json");
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e);
      setEstado((previo) => ({ ...previo, error: mensaje }));
    }
  }

  // --- Importar / exportar configuración (.env) ------------------------------

  /**
   * Lee el archivo `.env` elegido, lo parsea con `parsearEnv` y, si es válido, reemplaza los
   * parámetros de aluminio, de vidrio y las reglas por perfil. Cualquier error de parseo (línea
   * sin `=`, regla con número de campos incorrecto, número inválido) se muestra en el banner sin
   * interrumpir la app. (Requirement 10.6)
   */
  async function importarEnv(archivo: File) {
    try {
      const texto = await archivo.text();
      const { parametros, parametrosVidrio, reglasPorPerfil } = parsearEnv(texto);
      setEstado((previo) => ({
        ...previo,
        parametros,
        parametrosVidrio,
        reglasPorPerfil,
        error: null,
      }));
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e);
      setEstado((previo) => ({ ...previo, error: mensaje }));
    }
  }

  /** Serializa la configuración actual a formato `.env` y dispara su descarga como `reglas.env`. */
  function exportarEnv() {
    try {
      const env = serializarEnv(config);
      descargarArchivo(env, "reglas.env", "text/plain");
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e);
      setEstado((previo) => ({ ...previo, error: mensaje }));
    }
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 960, margin: "0 auto" }}>
      <p style={{ margin: "0 0 0.5rem" }}>
        <Link href="/" style={{ color: "#1a73e8", textDecoration: "none" }}>
          ← Menú
        </Link>
      </p>
      <h1>Optimizador de ventanas</h1>

      {/* Banner de error: visible solo cuando una operación (pipeline o IO) falla. */}
      {estado.error !== null && (
        <div
          role="alert"
          style={{
            margin: "1rem 0",
            padding: "0.75rem 1rem",
            border: "1px solid #d33",
            borderRadius: 6,
            background: "#fdecea",
            color: "#611a15",
          }}
        >
          {estado.error}
        </div>
      )}

      <section aria-label="Ventanas">
        <h2>Ventanas</h2>
        <FormularioVentanas
          ventanas={estado.ventanas}
          onCambio={cambiarVentanas}
          onImportarJson={importarVentanas}
          onExportarJson={exportarVentanas}
        />
      </section>

      <section aria-label="Parámetros y reglas">
        <FormularioParametros
          parametros={estado.parametros}
          parametrosVidrio={estado.parametrosVidrio}
          reglasPorPerfil={estado.reglasPorPerfil}
          onCambio={cambiarConfiguracion}
          onImportarEnv={importarEnv}
          onExportarEnv={exportarEnv}
        />
        <EditorReglas reglasPorPerfil={estado.reglasPorPerfil} onCambio={cambiarReglas} />
      </section>

      <div style={{ margin: "1.5rem 0" }}>
        <BotonOptimizar onOptimizar={optimizar} />
      </div>

      <section aria-label="Resultados">
        <h2>Resultados</h2>
        {estado.resultado === null ? (
          <p>Aún no se ha ejecutado la optimización.</p>
        ) : (
          <>
            <BotonesExportar resultado={estado.resultado} />
            <PanelResultados resultado={estado.resultado} />
          </>
        )}
      </section>
    </main>
  );
}
