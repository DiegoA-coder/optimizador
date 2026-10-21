// components/FormularioParametros.tsx
// Formulario para editar los parámetros de aluminio (largo de tira, sierra) y de vidrio
// (panel, material/ajuste de ancho, materiales/ajuste de alto, rotación), con validación en
// vivo que replica los mensajes exactos de los compact constructors Java (crearParametros y
// crearParametrosVidrio). También expone importar/exportar la configuración completa en formato
// `.env`: delega el parseo/serializado real (`parsearEnv`/`serializarEnv`) a page.tsx a través de
// los callbacks `onImportarEnv`/`onExportarEnv`, según el contrato `ConfiguracionProps` del
// diseño (tarea 12.2 del plan).
//
// El componente no muta nada en sitio: ante cada cambio válido emite, vía `onCambio`, una
// `ConfiguracionCorte` nueva que conserva `reglasPorPerfil` (que edita `EditorReglas`). Si un
// campo es inválido, muestra el mensaje y no propaga ese cambio parcial al estado global.

"use client";

import { useId, useRef, useState } from "react";
import {
  ConfiguracionCorte,
  ReglaCorte,
} from "@/lib/dominio/modelos";
import {
  Parametros,
  crearParametros,
  porDefecto,
} from "@/lib/dominio/parametros";
import {
  ParametrosVidrio,
  crearParametrosVidrio,
  porDefectoVidrio,
} from "@/lib/dominio/parametrosVidrio";

interface ConfiguracionProps {
  parametros: Parametros;
  parametrosVidrio: ParametrosVidrio;
  reglasPorPerfil: Record<string, ReglaCorte[]>;
  onCambio: (config: ConfiguracionCorte) => void;
  onImportarEnv: (archivo: File) => void; // usa parsearEnv
  onExportarEnv: () => void; // usa serializarEnv
}

/** Mensajes de validación exactos, portados de los constructores Java del dominio. */
const MENSAJES = {
  largoTira: "El largo de la tira debe ser mayor a 0",
  sierra: "La sierra (kerf) no puede ser negativa",
  panel: "Las dimensiones del panel de vidrio deben ser mayores a 0",
  materialAncho: "El material base del ancho no puede estar vacío",
  materialesAltoVacio: "Debe haber al menos un material de alto para el vidrio",
  materialesAltoElemento: "Los materiales de alto del vidrio no pueden estar vacíos",
  numero: "Debe ser un número válido",
} as const;

/** Errores de validación por campo; una clave presente significa campo inválido. */
type Errores = Partial<{
  largoTiraCm: string;
  sierraCm: string;
  panelAnchoCm: string;
  panelAltoCm: string;
  materialAncho: string;
  anchoAjusteCm: string;
  materialesAlto: string;
  altoAjusteCm: string;
}>;

/** Parsea un decimal de un input de texto; `null` si está vacío o no es finito. */
function parsearDecimal(texto: string): number | null {
  const t = texto.trim();
  if (t.length === 0) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export default function FormularioParametros(props: ConfiguracionProps) {
  const {
    parametros,
    parametrosVidrio,
    reglasPorPerfil,
    onCambio,
    onImportarEnv,
    onExportarEnv,
  } = props;

  const idBase = useId();
  const inputArchivo = useRef<HTMLInputElement>(null);

  // Texto crudo editable por campo, para permitir estados intermedios (p. ej. "" o "-") sin
  // forzar un número al vuelo. Se inicializa con el valor actual de los parámetros.
  const [largoTiraTexto, setLargoTiraTexto] = useState(String(parametros.largoTiraCm));
  const [sierraTexto, setSierraTexto] = useState(String(parametros.sierraCm));
  const [panelAnchoTexto, setPanelAnchoTexto] = useState(String(parametrosVidrio.panelAnchoCm));
  const [panelAltoTexto, setPanelAltoTexto] = useState(String(parametrosVidrio.panelAltoCm));
  const [materialAnchoTexto, setMaterialAnchoTexto] = useState(parametrosVidrio.materialAncho);
  const [anchoAjusteTexto, setAnchoAjusteTexto] = useState(String(parametrosVidrio.anchoAjusteCm));
  // Materiales de alto editados como texto separado por comas (igual que el .env).
  const [materialesAltoTexto, setMaterialesAltoTexto] = useState(
    parametrosVidrio.materialesAlto.join(", "),
  );
  const [altoAjusteTexto, setAltoAjusteTexto] = useState(String(parametrosVidrio.altoAjusteCm));

  const [errores, setErrores] = useState<Errores>({});

  /**
   * Reconstruye y valida la configuración completa a partir del texto crudo de todos los
   * campos. Recoge todos los errores en `Errores`; si no hay ninguno, emite `onCambio` con la
   * nueva `ConfiguracionCorte` (conservando `reglasPorPerfil`).
   */
  function recalcular(parcial: {
    largoTira?: string;
    sierra?: string;
    panelAncho?: string;
    panelAlto?: string;
    materialAncho?: string;
    anchoAjuste?: string;
    materialesAlto?: string;
    altoAjuste?: string;
    permitirRotacion?: boolean;
  }) {
    const vLargoTira = parcial.largoTira ?? largoTiraTexto;
    const vSierra = parcial.sierra ?? sierraTexto;
    const vPanelAncho = parcial.panelAncho ?? panelAnchoTexto;
    const vPanelAlto = parcial.panelAlto ?? panelAltoTexto;
    const vMaterialAncho = parcial.materialAncho ?? materialAnchoTexto;
    const vAnchoAjuste = parcial.anchoAjuste ?? anchoAjusteTexto;
    const vMaterialesAlto = parcial.materialesAlto ?? materialesAltoTexto;
    const vAltoAjuste = parcial.altoAjuste ?? altoAjusteTexto;
    const vPermitirRotacion = parcial.permitirRotacion ?? parametrosVidrio.permitirRotacion;

    const errs: Errores = {};

    // --- Aluminio -----------------------------------------------------------
    const largoTiraCm = parsearDecimal(vLargoTira);
    if (largoTiraCm === null) errs.largoTiraCm = MENSAJES.numero;
    else if (largoTiraCm <= 0) errs.largoTiraCm = MENSAJES.largoTira;

    const sierraCm = parsearDecimal(vSierra);
    if (sierraCm === null) errs.sierraCm = MENSAJES.numero;
    else if (sierraCm < 0) errs.sierraCm = MENSAJES.sierra;

    // --- Vidrio: panel ------------------------------------------------------
    const panelAnchoCm = parsearDecimal(vPanelAncho);
    if (panelAnchoCm === null) errs.panelAnchoCm = MENSAJES.numero;
    else if (panelAnchoCm <= 0) errs.panelAnchoCm = MENSAJES.panel;

    const panelAltoCm = parsearDecimal(vPanelAlto);
    if (panelAltoCm === null) errs.panelAltoCm = MENSAJES.numero;
    else if (panelAltoCm <= 0) errs.panelAltoCm = MENSAJES.panel;

    // --- Vidrio: material y ajuste de ancho --------------------------------
    if (vMaterialAncho.trim().length === 0) errs.materialAncho = MENSAJES.materialAncho;

    const anchoAjusteCm = parsearDecimal(vAnchoAjuste);
    if (anchoAjusteCm === null) errs.anchoAjusteCm = MENSAJES.numero;

    // --- Vidrio: materiales y ajuste de alto -------------------------------
    const materialesAlto = vMaterialesAlto
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length !== 0);
    if (materialesAlto.length === 0) errs.materialesAlto = MENSAJES.materialesAltoVacio;

    const altoAjusteCm = parsearDecimal(vAltoAjuste);
    if (altoAjusteCm === null) errs.altoAjusteCm = MENSAJES.numero;

    setErrores(errs);
    if (Object.keys(errs).length > 0) return;

    // Todos los valores son válidos aquí; los constructores vuelven a validar como red de
    // seguridad y, de lanzar, se refleja el mensaje exacto del dominio en el banner.
    try {
      const nuevosParametros = crearParametros(largoTiraCm!, sierraCm!);
      const nuevosVidrio = crearParametrosVidrio(
        panelAnchoCm!,
        panelAltoCm!,
        vMaterialAncho,
        anchoAjusteCm!,
        materialesAlto,
        altoAjusteCm!,
        vPermitirRotacion,
      );
      const config: ConfiguracionCorte = {
        parametros: nuevosParametros,
        parametrosVidrio: nuevosVidrio,
        reglasPorPerfil,
      };
      onCambio(config);
    } catch (e) {
      // Alinea el error del dominio con el campo correspondiente por su mensaje.
      const mensaje = e instanceof Error ? e.message : String(e);
      if (mensaje === MENSAJES.largoTira) setErrores({ largoTiraCm: mensaje });
      else if (mensaje === MENSAJES.sierra) setErrores({ sierraCm: mensaje });
      else if (mensaje === MENSAJES.panel) setErrores({ panelAnchoCm: mensaje });
      else if (mensaje === MENSAJES.materialAncho) setErrores({ materialAncho: mensaje });
      else setErrores({ materialesAlto: mensaje });
    }
  }

  /** Restaura todos los campos a los valores por defecto del dominio. */
  function restaurarPorDefecto() {
    const p = porDefecto();
    const v = porDefectoVidrio();
    setLargoTiraTexto(String(p.largoTiraCm));
    setSierraTexto(String(p.sierraCm));
    setPanelAnchoTexto(String(v.panelAnchoCm));
    setPanelAltoTexto(String(v.panelAltoCm));
    setMaterialAnchoTexto(v.materialAncho);
    setAnchoAjusteTexto(String(v.anchoAjusteCm));
    setMaterialesAltoTexto(v.materialesAlto.join(", "));
    setAltoAjusteTexto(String(v.altoAjusteCm));
    setErrores({});
    onCambio({ parametros: p, parametrosVidrio: v, reglasPorPerfil });
  }

  function alSeleccionarArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (archivo) onImportarEnv(archivo);
    // Permite reimportar el mismo archivo seleccionándolo de nuevo.
    e.target.value = "";
  }

  const i = (sufijo: string) => `${idBase}-${sufijo}`;

  return (
    <section aria-labelledby={i("titulo")}>
      <h2 id={i("titulo")}>Parámetros</h2>

      <fieldset>
        <legend>Aluminio</legend>

        <div>
          <label htmlFor={i("largoTira")}>Largo de la tira (cm)</label>
          <input
            id={i("largoTira")}
            type="number"
            inputMode="decimal"
            step="0.1"
            value={largoTiraTexto}
            aria-invalid={errores.largoTiraCm != null}
            aria-describedby={errores.largoTiraCm ? i("largoTira-err") : undefined}
            onChange={(e) => {
              setLargoTiraTexto(e.target.value);
              recalcular({ largoTira: e.target.value });
            }}
          />
          {errores.largoTiraCm && (
            <p id={i("largoTira-err")} role="alert">
              {errores.largoTiraCm}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={i("sierra")}>Sierra / kerf (cm)</label>
          <input
            id={i("sierra")}
            type="number"
            inputMode="decimal"
            step="0.1"
            value={sierraTexto}
            aria-invalid={errores.sierraCm != null}
            aria-describedby={errores.sierraCm ? i("sierra-err") : undefined}
            onChange={(e) => {
              setSierraTexto(e.target.value);
              recalcular({ sierra: e.target.value });
            }}
          />
          {errores.sierraCm && (
            <p id={i("sierra-err")} role="alert">
              {errores.sierraCm}
            </p>
          )}
        </div>
      </fieldset>

      <fieldset>
        <legend>Vidrio</legend>

        <div>
          <label htmlFor={i("panelAncho")}>Ancho del panel (cm)</label>
          <input
            id={i("panelAncho")}
            type="number"
            inputMode="decimal"
            step="0.1"
            value={panelAnchoTexto}
            aria-invalid={errores.panelAnchoCm != null}
            aria-describedby={errores.panelAnchoCm ? i("panelAncho-err") : undefined}
            onChange={(e) => {
              setPanelAnchoTexto(e.target.value);
              recalcular({ panelAncho: e.target.value });
            }}
          />
          {errores.panelAnchoCm && (
            <p id={i("panelAncho-err")} role="alert">
              {errores.panelAnchoCm}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={i("panelAlto")}>Alto del panel (cm)</label>
          <input
            id={i("panelAlto")}
            type="number"
            inputMode="decimal"
            step="0.1"
            value={panelAltoTexto}
            aria-invalid={errores.panelAltoCm != null}
            aria-describedby={errores.panelAltoCm ? i("panelAlto-err") : undefined}
            onChange={(e) => {
              setPanelAltoTexto(e.target.value);
              recalcular({ panelAlto: e.target.value });
            }}
          />
          {errores.panelAltoCm && (
            <p id={i("panelAlto-err")} role="alert">
              {errores.panelAltoCm}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={i("materialAncho")}>Material base del ancho</label>
          <input
            id={i("materialAncho")}
            type="text"
            value={materialAnchoTexto}
            aria-invalid={errores.materialAncho != null}
            aria-describedby={errores.materialAncho ? i("materialAncho-err") : undefined}
            onChange={(e) => {
              setMaterialAnchoTexto(e.target.value);
              recalcular({ materialAncho: e.target.value });
            }}
          />
          {errores.materialAncho && (
            <p id={i("materialAncho-err")} role="alert">
              {errores.materialAncho}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={i("anchoAjuste")}>Ajuste de ancho (cm)</label>
          <input
            id={i("anchoAjuste")}
            type="number"
            inputMode="decimal"
            step="0.1"
            value={anchoAjusteTexto}
            aria-invalid={errores.anchoAjusteCm != null}
            aria-describedby={errores.anchoAjusteCm ? i("anchoAjuste-err") : undefined}
            onChange={(e) => {
              setAnchoAjusteTexto(e.target.value);
              recalcular({ anchoAjuste: e.target.value });
            }}
          />
          {errores.anchoAjusteCm && (
            <p id={i("anchoAjuste-err")} role="alert">
              {errores.anchoAjusteCm}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={i("materialesAlto")}>Materiales de alto (separados por coma)</label>
          <input
            id={i("materialesAlto")}
            type="text"
            value={materialesAltoTexto}
            aria-invalid={errores.materialesAlto != null}
            aria-describedby={errores.materialesAlto ? i("materialesAlto-err") : undefined}
            onChange={(e) => {
              setMaterialesAltoTexto(e.target.value);
              recalcular({ materialesAlto: e.target.value });
            }}
          />
          {errores.materialesAlto && (
            <p id={i("materialesAlto-err")} role="alert">
              {errores.materialesAlto}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={i("altoAjuste")}>Ajuste de alto (cm)</label>
          <input
            id={i("altoAjuste")}
            type="number"
            inputMode="decimal"
            step="0.1"
            value={altoAjusteTexto}
            aria-invalid={errores.altoAjusteCm != null}
            aria-describedby={errores.altoAjusteCm ? i("altoAjuste-err") : undefined}
            onChange={(e) => {
              setAltoAjusteTexto(e.target.value);
              recalcular({ altoAjuste: e.target.value });
            }}
          />
          {errores.altoAjusteCm && (
            <p id={i("altoAjuste-err")} role="alert">
              {errores.altoAjusteCm}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={i("rotacion")}>
            <input
              id={i("rotacion")}
              type="checkbox"
              checked={parametrosVidrio.permitirRotacion}
              onChange={(e) => recalcular({ permitirRotacion: e.target.checked })}
            />
            Permitir rotación de piezas 90°
          </label>
        </div>
      </fieldset>

      <div>
        <button type="button" onClick={() => inputArchivo.current?.click()}>
          Importar .env
        </button>
        <input
          ref={inputArchivo}
          type="file"
          accept=".env,text/plain"
          hidden
          onChange={alSeleccionarArchivo}
        />
        <button type="button" onClick={onExportarEnv}>
          Exportar .env
        </button>
        <button type="button" onClick={restaurarPorDefecto}>
          Restaurar valores por defecto
        </button>
      </div>
    </section>
  );
}
