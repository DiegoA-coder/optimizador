# Optimizador de Corte (aluminio + vidrio)

Aplicación web para optimizar el corte de **perfiles de aluminio (1D)** y **paneles de vidrio (2D)** a partir de las medidas de las ventanas a fabricar. 

Todo el cálculo ocurre en el **cliente**: no hay backend ni base de datos. Los datos se capturan en la interfaz, se procesan con la lógica de dominio y los reportes se generan y descargan en el navegador.

---

## Características

- **Despiece de aluminio (1D):** expande cada ventana en sus piezas según las reglas de su perfil y las acomoda en tiras con la heurística *Best Fit Decreasing*.
- **Corte de vidrio (2D):** deriva las piezas de vidrio de cada ventana y las empaqueta en paneles con una heurística de guillotina (*Best Area Fit*) con rotación opcional.
- **Dos perfiles mutuamente excluyentes:** la pantalla de ventanas trabaja con pestañas independientes de **2 pulgadas** y **3 pulgadas**; un despiece nunca mezcla ambos. El perfil lo fija la pestaña activa.
- **Mapa visual de corte con colores:** tanto para las Perfils de aluminio como para los paneles de vidrio, a escala y con etiquetas por pieza.
- **Configuración centralizada** en un panel desplegable: parámetros de aluminio/vidrio y editor de reglas de despiece por perfil.
- **Importar / exportar:** ventanas en `.json` y configuración en formato `.env`.
- **Exportar a PDF:** reporte imprimible en A4 (vía el diálogo de impresión del navegador → "Guardar como PDF").
- **Tema oscuro** en toda la aplicación.
- **Medidas anti-bots:** `robots.txt` con bloqueo de bots de scraping/IA y *rate limiting* en el edge.

---

## Pantallas

| Ruta         | Descripción |
|--------------|-------------|
| `/`          | Menú principal con acceso a las herramientas. |
| `/ventanas`  | Optimizador completo de ventanas (aluminio + vidrio) con pestañas 2PULG / 3PULG, configuración y reportes. |
| `/despiece`  | Despiece por perfil 1D: se cargan el largo de la Perfil, la sierra y las piezas, y se obtiene el mapa de corte 2D. |

---

## Requisitos

- **Node.js 18.18+** (recomendado 20 LTS o superior).
- **npm** (el proyecto usa `package-lock.json`).

## Puesta en marcha

```bash
# Instalar dependencias
npm install

# Entorno de desarrollo (http://localhost:3000)
npm run dev

# Build de producción
npm run build

# Servir el build de producción
npm run start

# Ejecutar la suite de pruebas una sola vez
npm run test
```

> Nota: `npm run dev` y `npm run start` son procesos de larga duración; ejecútalos en tu propia terminal.

---

## Estructura del proyecto

```
app/                    # Rutas (App Router de Next.js)
  layout.tsx            # Layout raíz + metadatos (incluye reglas robots)
  page.tsx              # Menú principal
  ventanas/page.tsx     # Pantalla de optimización de ventanas (orquestador de estado)
  despiece/page.tsx     # Pantalla de despiece 1D
  robots.ts             # Genera /robots.txt
  globals.css           # Tema oscuro y estilos globales

components/             # Componentes de presentación (React)
  FormularioVentanas / FilaVentana        # Captura de ventanas
  FormularioParametros / EditorReglas     # Configuración (parámetros + reglas por perfil)
  PanelConfiguracion                      # Contenedor desplegable de la configuración
  PanelResultados                         # Compone las vistas de resultado
  TablaTiras / MapaCorteAluminio          # Plan de aluminio (tabla + mapa con colores)
  TablaCortesPorVentana                   # Despiece agrupado por ventana
  TablaPanelesVidrio / EsquemaCorteVidrio # Plan de vidrio (tabla + esquema 2D)
  MapaCortePerfils                         # Dibujo SVG de Perfils (compartido 1D / ventanas)
  BotonOptimizar / BotonesExportar        # Acciones

lib/
  dominio/              # Lógica de dominio pura (sin React), portada del Java
    modelos.ts          # Tipos y validaciones (Ventana, ReglaCorte, Pieza, Panel, ...)
    parametros.ts / parametrosVidrio.ts   # Parámetros y valores por defecto
    despiezador.ts      # Expansión de ventanas en piezas de aluminio
    optimizador.ts      # Acomodo 1D (Best Fit Decreasing) + PlanCorte
    calculadorVidrio.ts # Derivación de piezas de vidrio por ventana
    optimizadorVidrio.ts# Acomodo 2D (Best Area Fit) + PlanVidrio
    pipeline.ts         # Orquestación: despiece → optimización → vidrio
  io/                   # Entrada/salida y reportes
    cargadorReglas.ts   # Parseo/serialización de la configuración .env
    cargadorVentanas.ts # Parseo/serialización de ventanas .json
    reporteHtml.ts      # Reporte HTML imprimible (ventanas)
    reporteDespiece.ts  # Reporte HTML imprimible (despiece 1D)
    reporteJson.ts / reporteTexto.ts      # Reportes en JSON y texto

test/                   # Pruebas con Vitest (dominio, io, propiedades)
middleware.ts           # Rate limiting en el edge
```

---

## Dominio y algoritmos

El flujo completo está en `lib/dominio/pipeline.ts`:

1. **`expandir`** — despiece plano de piezas de aluminio según las reglas del perfil de cada ventana.
2. **`planificar` / `optimizar`** — acomodo 1D en tiras agrupadas por perfil y material (*Best Fit Decreasing*).
3. **`calcularVidrio`** — piezas de vidrio derivadas de cada ventana (una por material de alto).
4. **`optimizarVidrio`** — acomodo 2D de las piezas de vidrio en paneles (*Best Area Fit*, guillotina).

La capacidad de la tira modela la sierra (kerf): la capacidad efectiva es `largo + sierra` y cada corte consume `longitud + sierra`, de modo que el último corte no cuenta la sierra de más. El corte de vidrio no considera kerf.

Las reglas de despiece siguen el formato por línea del `.env`:

```
REGLA_<PERFIL>_<n>=material|cantidad|base|descuentoCm|divisor
```

donde `base` es `INFERIOR` o `LATERAL`. La longitud de cada pieza es `truncar((medidaBase - descuentoCm) / divisor)`.

> Nota: el perfil **3PULG** usa provisionalmente los mismos descuentos que **2PULG** hasta contar con los valores reales de 3 pulgadas (ajustables desde el editor de reglas).

---

## Configuración

| Variable                 | Descripción |
|--------------------------|-------------|
| `NEXT_PUBLIC_SITE_URL`   | URL pública del sitio. Si se define, `robots.txt` declara el sitemap en `${NEXT_PUBLIC_SITE_URL}/sitemap.xml`. Opcional. |

---

## Medidas anti-bots

- **`app/robots.ts`** genera `/robots.txt`: permite el rastreo general y bloquea una lista de bots de scraping / entrenamiento de IA (GPTBot, ClaudeBot, CCBot, PerplexityBot, Bytespider, Google-Extended, etc.). Se complementa con los metadatos `robots` en `app/layout.tsx`.
- **`middleware.ts`** aplica *rate limiting* en el edge: 60 peticiones por IP por minuto; al excederse responde `429 Too Many Requests` con `Retry-After`, y añade cabeceras `X-RateLimit-*`.

> **Limitación:** el contador del rate limiter vive en memoria del proceso, por lo que el límite es **por-instancia**. En despliegues serverless/edge con varias instancias, el límite efectivo se multiplica. Para un límite global usa un store compartido (Upstash Redis, Vercel KV o Cloudflare Durable Objects); el único punto a cambiar es la función `estaLimitado` del middleware.

---

## Pruebas

```bash
npm run test
```

Las pruebas (Vitest) cubren el dominio, la capa de IO y propiedades (`fast-check`), verificando la paridad de los algoritmos con el proyecto Java original.

---

## Stack

- [Next.js](https://nextjs.org/) 15 (App Router)
- [React](https://react.dev/) 19
- [TypeScript](https://www.typescriptlang.org/) 5
- [Vitest](https://vitest.dev/) + [fast-check](https://fast-check.dev/) para pruebas
