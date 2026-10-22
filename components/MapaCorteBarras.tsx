"use client";

// components/MapaCorteBarras.tsx
// Dibuja el mapa de corte 1D (despiece por perfil) a escala en SVG: una fila por barra, con sus
// cortes colocados de izquierda a derecha y el sobrante marcado al final. Es el equivalente, para
// barras lineales horizontales, del `EsquemaCorteVidrio` (que dibuja paneles 2D de vidrio).
//
// Reutiliza el dominio existente: cada barra es una `Tira` (`@/lib/dominio/tira`), de la que se
// leen sus piezas, lo usado (`usadoCm`) y el sobrante (`restanteCm`). La posición inicial de cada
// corte se acumula sumando longitud + sierra, igual que el modelo de capacidad de la tira, de modo
// que el dibujo coincide con el consumo real de la barra.

import { cm } from "@/lib/dominio/parametros";
import { Tira, usadoCm } from "@/lib/dominio/tira";

export interface MapaCorteBarrasProps {
  /** Barras ya optimizadas (todas del mismo largo/sierra). */
  tiras: Tira[];
  /** Largo nominal de la barra en cm (para dibujar el fondo y el sobrante a escala). */
  largoBarraCm: number;
  /** Sierra (kerf) en cm: separa visualmente un corte del siguiente. */
  sierraCm: number;
}

/** Ancho máximo (px) del dibujo de una barra; el alto es fijo. */
const ANCHO_PX = 820;
const ALTO_BARRA_PX = 54;

// Paleta alineada con el esquema de vidrio para mantener coherencia visual en la app.
const COLOR_BARRA_FILL = "#ece3cc";
const COLOR_BARRA_STROKE = "#b9ad8a";
const COLOR_SOBRA_FILL = "#f6cccc";
const COLOR_SOBRA_STROKE = "#d89a9a";
const COLOR_PIEZA_STROKE = "#2f6ca3";
const COLOR_ETQ = "#0f2f44";
const COLOR_MED = "#1a1a1a";

/** Tono de relleno de cada corte, rotando por una paleta suave según su posición en la barra. */
function colorPieza(indice: number): string {
  const colores = ["#cfe3f7", "#d6f0d6", "#f7e6c8", "#e6d6f0", "#f7d6e0", "#d6f0ee", "#e8ecc8"];
  return colores[indice % colores.length];
}

export default function MapaCorteBarras({ tiras, largoBarraCm, sierraCm }: MapaCorteBarrasProps) {
  if (tiras.length === 0) {
    return <p style={{ fontSize: "0.9rem", color: "var(--color-texto-tenue)" }}>No hay barras para mostrar.</p>;
  }

  const escala = ANCHO_PX / largoBarraCm; // px por cm

  return (
    <section
      aria-label="Mapa de corte por barra"
      style={{ display: "flex", flexDirection: "column", gap: "0.9rem", margin: "1rem 0" }}
    >
      {tiras.map((tira, i) => (
        <figure key={i} style={{ margin: 0 }}>
          <figcaption style={{ fontSize: "0.85rem", marginBottom: 4, color: "var(--color-texto-tenue)" }}>
            Barra {i + 1} — usado {cm(usadoCm(tira))} cm · sobrante {cm(tira.restanteCm)} cm
          </figcaption>
          <BarraSvg tira={tira} largoBarraCm={largoBarraCm} sierraCm={sierraCm} escala={escala} indice={i + 1} />
        </figure>
      ))}
    </section>
  );
}

interface BarraSvgProps {
  tira: Tira;
  largoBarraCm: number;
  sierraCm: number;
  escala: number;
  indice: number;
}

/** Dibuja una barra y sus cortes a escala, con el sobrante resaltado al final. */
function BarraSvg({ tira, largoBarraCm, sierraCm, escala, indice }: BarraSvgProps) {
  const anchoPx = largoBarraCm * escala;
  const usado = usadoCm(tira);

  // Posición inicial (cm) de cada corte: se acumula longitud + sierra, igual que el consumo real.
  let inicioCm = 0;

  return (
    <svg
      width={ANCHO_PX}
      height={ALTO_BARRA_PX}
      viewBox={`0 0 ${anchoPx.toFixed(1)} ${ALTO_BARRA_PX}`}
      preserveAspectRatio="xMinYMid meet"
      role="img"
      aria-label={`Barra ${indice} de ${cm(largoBarraCm)} cm con ${tira.piezas.length} corte(s)`}
      style={{ width: "100%", border: "1px solid #ccc", background: "#fafafa", borderRadius: 4, display: "block" }}
    >
      {/* Fondo de la barra */}
      <rect
        x={0}
        y={0}
        width={anchoPx.toFixed(1)}
        height={ALTO_BARRA_PX}
        fill={COLOR_BARRA_FILL}
        stroke={COLOR_BARRA_STROKE}
        strokeWidth={1}
      />

      {tira.piezas.map((pieza, idx) => {
        const x = inicioCm * escala;
        const w = pieza.longitudCm * escala;
        const cx = x + w / 2;
        inicioCm += pieza.longitudCm + sierraCm;
        return (
          <g key={idx}>
            <rect
              x={x.toFixed(1)}
              y={4}
              width={Math.max(w, 1).toFixed(1)}
              height={ALTO_BARRA_PX - 8}
              fill={colorPieza(idx)}
              stroke={COLOR_PIEZA_STROKE}
              strokeWidth={1}
            >
              <title>
                {pieza.etiquetaVentana || "Pieza"} — {cm(pieza.longitudCm)} cm
              </title>
            </rect>
            {w > 34 && (
              <>
                <text
                  x={cx.toFixed(1)}
                  y={ALTO_BARRA_PX / 2 - 2}
                  fill={COLOR_ETQ}
                  fontSize={11}
                  fontWeight={700}
                  textAnchor="middle"
                >
                  {pieza.etiquetaVentana || "Pieza"}
                </text>
                <text x={cx.toFixed(1)} y={ALTO_BARRA_PX / 2 + 12} fill={COLOR_MED} fontSize={10} textAnchor="middle">
                  {cm(pieza.longitudCm)} cm
                </text>
              </>
            )}
          </g>
        );
      })}

      {/* Sobrante al final de la barra */}
      {largoBarraCm - usado > 0.05 && (
        <SobranteSvg xInicioPx={usado * escala} anchoPx={(largoBarraCm - usado) * escala} sobranteCm={tira.restanteCm} />
      )}
    </svg>
  );
}

interface SobranteSvgProps {
  xInicioPx: number;
  anchoPx: number;
  sobranteCm: number;
}

/** Rectángulo rojizo que representa el sobrante (recorte) al final de la barra. */
function SobranteSvg({ xInicioPx, anchoPx, sobranteCm }: SobranteSvgProps) {
  return (
    <g>
      <rect
        x={xInicioPx.toFixed(1)}
        y={4}
        width={anchoPx.toFixed(1)}
        height={ALTO_BARRA_PX - 8}
        fill={COLOR_SOBRA_FILL}
        stroke={COLOR_SOBRA_STROKE}
        strokeWidth={1}
      >
        <title>Sobrante {cm(sobranteCm)} cm</title>
      </rect>
      {anchoPx > 34 && (
        <text
          x={(xInicioPx + anchoPx / 2).toFixed(1)}
          y={ALTO_BARRA_PX / 2 + 4}
          fill="#8a2b2b"
          fontSize={10}
          textAnchor="middle"
        >
          sobra {cm(sobranteCm)} cm
        </text>
      )}
    </g>
  );
}
