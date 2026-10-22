"use client";

// app/ventanas/page.tsx
// Pantalla "Optimizador de ventanas" (aluminio + vidrio). Orquestador de la UI (Client Component).
//
// La pantalla trabaja con DOS perfiles mutuamente excluyentes: "2 pulgadas" (2PULG) y
// "3 pulgadas" (3PULG). Cada perfil es una pestaña independiente con su propia lista de ventanas,
// su propio resultado y su propio error: un despiece nunca mezcla 2 y 3 pulgadas. El perfil de
// cada ventana lo fija la pestaña activa, por eso la tabla de ventanas ya no tiene columna de
// perfil.
//
// Lo que SÍ es compartido (genérico) entre ambas pestañas: los parámetros de aluminio y de vidrio,
// y las reglas de despiece por perfil. Todo eso vive en el panel de configuración desplegable.
// El algoritmo de despiece de aluminio y de vidrio es el mismo para los dos perfiles; lo único que
// cambia son las reglas/descuentos de cada perfil.
//
// Al pulsar "Optimizar" se invoca `ejecutarPipeline` para la pestaña activa dentro de un try/catch:
// si el dominio lanza un `Error` de validación se captura y se muestra en un banner (role="alert")
// sin romper la app; en caso de éxito se guarda el resultado de esa pestaña. La importación/
// exportación de ventanas (`.json`) y de la configuración (`.env`) también se envuelve en try/catch.

import Link from "next/link";
import { useMemo, useState } from "react";

import FormularioVentanas from "@/components/FormularioVentanas";
import FormularioParametros from "@/components/FormularioParametros";
import EditorReglas from "@/components/EditorReglas";
import PanelConfiguracion from "@/components/PanelConfiguracion";
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

/** Perfiles soportados por la pantalla (mutuamente excluyentes). */
const PERFILES = ["2PULG", "3PULG"] as const;
type Perfil = (typeof PERFILES)[number];

/** Etiqueta legible de cada pestaña de perfil. */
const ETIQUETA_PERFIL: Record<Perfil, string> = {
  "2PULG": "2 pulgadas",
  "3PULG": "3 pulgadas",
};

/** Estado de una pestaña de perfil: sus ventanas, su último resultado y su último error. */
interface EstadoPerfil {
  ventanas: Ventana[];
  resultado: ResultadoCompleto | null;
  error: string | null;
}

/**
 * Estado completo de la pantalla:
 *  - `perfilActivo`: pestaña visible (2PULG o 3PULG).
 *  - `porPerfil`: estado independiente de cada perfil (ventanas/resultado/error).
 *  - configuración compartida: `parametros`, `parametrosVidrio`, `reglasPorPerfil`.
 */
interface EstadoApp {
  perfilActivo: Perfil;
  porPerfil: Record<Perfil, EstadoPerfil>;
  parametros: Parametros;
  parametrosVidrio: ParametrosVidrio;
  reglasPorPerfil: Record<string, ReglaCorte[]>;
}

// Reglas de despiece por defecto: se derivan del mismo formato `.env` que consume el proyecto Java,
// de modo que la app arranca con un juego de reglas válido (perfiles 2PULG y 3PULG) sin pedir nada
// al usuario.
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
  // Perfil 3PULG: por ahora usa los mismos descuentos que 2PULG.
  // TODO: ajustar los descuentos reales de 3 pulgadas cuando estén disponibles.
  "REGLA_3PULG_1=Riel|1|INFERIOR|0|1",
  "REGLA_3PULG_2=Chambrana|2|LATERAL|2.8|1",
  "REGLA_3PULG_3=Chambrana|1|INFERIOR|0|1",
  "REGLA_3PULG_4=Zoclo|2|INFERIOR|16.2|2",
  "REGLA_3PULG_5=Cabezal|2|INFERIOR|16.2|2",
  "REGLA_3PULG_6=Cerco Fijo|1|LATERAL|4|1",
  "REGLA_3PULG_7=Cerco Corredizo|1|LATERAL|3|1",
  "REGLA_3PULG_8=Cerco traslape Fijo|1|LATERAL|4|1",
  "REGLA_3PULG_9=Cerco traslape Corredizo|1|LATERAL|3|1",
].join("\n");

/** Construye el estado inicial: una ventana de ejemplo por perfil y la configuración por defecto. */
function estadoInicial(): EstadoApp {
  return {
    perfilActivo: "2PULG",
    porPerfil: {
      "2PULG": { ventanas: [crearVentana("V1", "2PULG", 100, 120, 1)], resultado: null, error: null },
      "3PULG": { ventanas: [crearVentana("V1", "3PULG", 100, 120, 1)], resultado: null, error: null },
    },
    parametros: porDefecto(),
    parametrosVidrio: porDefectoVidrio(),
    reglasPorPerfil: parsearEnv(ENV_POR_DEFECTO).reglasPorPerfil,
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

  const perfilActivo = estado.perfilActivo;
  const estadoActivo = estado.porPerfil[perfilActivo];

  // La configuración de corte que consume el pipeline se arma a partir de las tres piezas de
  // configuración compartidas. Se memoiza para no recrearla en cada render.
  const config = useMemo<ConfiguracionCorte>(
    () => ({
      parametros: estado.parametros,
      parametrosVidrio: estado.parametrosVidrio,
      reglasPorPerfil: estado.reglasPorPerfil,
    }),
    [estado.parametros, estado.parametrosVidrio, estado.reglasPorPerfil],
  );

  /** Aplica un cambio parcial al estado del perfil indicado. */
  function actualizarPerfil(perfil: Perfil, cambios: Partial<EstadoPerfil>) {
    setEstado((previo) => ({
      ...previo,
      porPerfil: {
        ...previo.porPerfil,
        [perfil]: { ...previo.porPerfil[perfil], ...cambios },
      },
    }));
  }

  /** Cambia la pestaña de perfil activa. */
  function seleccionarPerfil(perfil: Perfil) {
    setEstado((previo) => ({ ...previo, perfilActivo: perfil }));
  }

  /**
   * Ejecuta el pipeline para la pestaña activa. Usa las ventanas de ESE perfil y la configuración
   * compartida. Captura cualquier `Error` de validación del dominio y lo deja en el `error` de la
   * pestaña (banner), sin romper la app; en caso de éxito guarda su resultado y limpia el error.
   */
  function optimizar() {
    try {
      const resultado = ejecutarPipeline(estadoActivo.ventanas, config);
      actualizarPerfil(perfilActivo, { resultado, error: null });
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e);
      actualizarPerfil(perfilActivo, { resultado: null, error: mensaje });
    }
  }

  // --- Edición de estado desde los formularios -------------------------------

  function cambiarVentanas(ventanas: Ventana[]) {
    actualizarPerfil(perfilActivo, { ventanas });
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

  // --- Importar / exportar ventanas (.json) de la pestaña activa -------------

  /**
   * Lee el archivo elegido, lo parsea con `parsearVentanas` y, si es válido, reemplaza las
   * ventanas de la pestaña activa, reasignándoles el perfil de la pestaña (para que no se puedan
   * colar ventanas de otro perfil). Cualquier error de parseo se muestra en el banner.
   */
  async function importarVentanas(archivo: File) {
    try {
      const texto = await archivo.text();
      const ventanas = parsearVentanas(texto).map((v) => ({ ...v, perfil: perfilActivo }));
      actualizarPerfil(perfilActivo, { ventanas, error: null });
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e);
      actualizarPerfil(perfilActivo, { error: mensaje });
    }
  }

  /** Serializa las ventanas de la pestaña activa a JSON y dispara su descarga. */
  function exportarVentanas() {
    try {
      const json = serializarVentanas(estadoActivo.ventanas);
      descargarArchivo(json, `ventanas-${perfilActivo}.json`, "application/json");
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e);
      actualizarPerfil(perfilActivo, { error: mensaje });
    }
  }

  // --- Importar / exportar configuración (.env) compartida -------------------

  /**
   * Lee el archivo `.env` elegido, lo parsea con `parsearEnv` y, si es válido, reemplaza los
   * parámetros de aluminio, de vidrio y las reglas por perfil (configuración compartida).
   * Cualquier error de parseo se muestra en el banner de la pestaña activa.
   */
  async function importarEnv(archivo: File) {
    try {
      const texto = await archivo.text();
      const { parametros, parametrosVidrio, reglasPorPerfil } = parsearEnv(texto);
      setEstado((previo) => ({ ...previo, parametros, parametrosVidrio, reglasPorPerfil }));
      actualizarPerfil(perfilActivo, { error: null });
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e);
      actualizarPerfil(perfilActivo, { error: mensaje });
    }
  }

  /** Serializa la configuración compartida a formato `.env` y dispara su descarga. */
  function exportarEnv() {
    try {
      const env = serializarEnv(config);
      descargarArchivo(env, "reglas.env", "text/plain");
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e);
      actualizarPerfil(perfilActivo, { error: mensaje });
    }
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 960, margin: "0 auto" }}>
      <p style={{ margin: "0 0 0.5rem" }}>
        <Link href="/" style={{ color: "var(--color-acento)", textDecoration: "none" }}>
          ← Menú
        </Link>
      </p>
      <h1>Optimizador de ventanas</h1>

      {/* Pestañas de perfil: cada una es un despiece independiente (sin combinar 2 y 3 pulgadas). */}
      <div
        role="tablist"
        aria-label="Perfil de las ventanas"
        className="pestanas-perfil"
        style={{ display: "flex", gap: "0.25rem", marginTop: "1rem" }}
      >
        {PERFILES.map((perfil) => {
          const activa = perfil === perfilActivo;
          return (
            <button
              key={perfil}
              type="button"
              role="tab"
              aria-selected={activa}
              className={activa ? "pestana-perfil pestana-perfil--activa" : "pestana-perfil"}
              onClick={() => seleccionarPerfil(perfil)}
            >
              {ETIQUETA_PERFIL[perfil]}
            </button>
          );
        })}
      </div>

      {/* Contenido de la pestaña activa. `key` por perfil reinicia el estado interno de los hijos. */}
      <div role="tabpanel" className="panel-perfil" key={perfilActivo}>
        {/* Banner de error de la pestaña activa. */}
        {estadoActivo.error !== null && (
          <div
            role="alert"
            style={{
              margin: "1rem 0",
              padding: "0.75rem 1rem",
              border: "1px solid var(--color-error-borde)",
              borderRadius: 6,
              background: "var(--color-error-fondo)",
              color: "var(--color-error-texto)",
            }}
          >
            {estadoActivo.error}
          </div>
        )}

        <section aria-label="Ventanas">
          <h2>Ventanas — {ETIQUETA_PERFIL[perfilActivo]}</h2>
          <FormularioVentanas
            ventanas={estadoActivo.ventanas}
            perfil={perfilActivo}
            onCambio={cambiarVentanas}
            onImportarJson={importarVentanas}
            onExportarJson={exportarVentanas}
          />
        </section>

        <PanelConfiguracion>
          <FormularioParametros
            parametros={estado.parametros}
            parametrosVidrio={estado.parametrosVidrio}
            reglasPorPerfil={estado.reglasPorPerfil}
            onCambio={cambiarConfiguracion}
            onImportarEnv={importarEnv}
            onExportarEnv={exportarEnv}
          />
          <EditorReglas
            reglasPorPerfil={estado.reglasPorPerfil}
            onCambio={cambiarReglas}
            perfilFiltro={perfilActivo}
          />
        </PanelConfiguracion>

        <div style={{ margin: "1.5rem 0" }}>
          <BotonOptimizar onOptimizar={optimizar} etiqueta={`Optimizar ${ETIQUETA_PERFIL[perfilActivo]}`} />
        </div>

        <section aria-label="Resultados">
          <h2>Resultados</h2>
          {estadoActivo.resultado === null ? (
            <p>Aún no se ha ejecutado la optimización.</p>
          ) : (
            <>
              <BotonesExportar resultado={estadoActivo.resultado} />
              <PanelResultados resultado={estadoActivo.resultado} />
            </>
          )}
        </section>
      </div>
    </main>
  );
}
