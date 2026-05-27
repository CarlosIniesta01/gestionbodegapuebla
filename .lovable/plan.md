
# Plan: Mapa de Bodega editable y multi-bodega

El objetivo es transformar el mapa actual en un verdadero centro de control: zonas claramente diferenciadas, depósitos visuales con estado vivo, panel de detalle al pulsar, y un **modo edición** con drag & drop que persiste por bodega en base de datos.

Antes de tocar código, este es el planteamiento completo.

---

## 1. Estructura visual del mapa

La pantalla `/bodega` se convierte en el "Mapa operativo". Layout:

```text
┌─────────────────────────────────────────────────────────────┐
│  Bodega Central        [Vista]  [Editar] [+ Zona] [Guardar] │  ← Toolbar
├─────────────────────────────────────────────────────────────┤
│  ┌──────── ZONA EXTERIOR ───────┐  ┌─── NAVE INTERIOR N ──┐ │
│  │ ● DP-01  ● DP-02  ● DP-03 …  │  │ ● N-1  ● N-2  ● N-3  │ │
│  │ ● DP-13  ● DP-14  ● DP-15 …  │  │ ● N-7  ● N-8  ● N-9  │ │
│  └──────────────────────────────┘  └──────────────────────┘ │
│  ┌── AUTOVACIANTES ──┐  ┌─ DECANTER ─┐  ┌── ZONA D ──────┐ │
│  │ ● AUTO-01 …       │  │ ● L-01 …   │  │ ● D-1 ● D-2 …  │ │
│  └───────────────────┘  └────────────┘  └────────────────┘ │
│                                                             │
│  Leyenda: ● vacío ● mosto ● fermentación ● vino …  3 LIVE   │
└─────────────────────────────────────────────────────────────┘
```

Características visuales:

- **Canvas SVG** a pantalla casi completa, con grid de fondo (estilo SCADA).
- Cada **zona** = contenedor redondeado con su color propio en el borde y un tinte translúcido de fondo, título en caps + contador de depósitos.
- Cada **depósito** = nodo circular con nivel de líquido visible, label monoespaciada, anillo pulsante si está activo (fermentación/trasiego), glow del color de estado.
- **Líneas animadas** (dasharray flow) entre origen y destino de trasiegos activos, por encima de los nodos.
- **Toolbar superior** con switch Vista/Editar, botones contextuales según modo, y badge "LIVE" con contador de procesos.
- **Panel lateral** (Sheet derecho en desktop, Drawer inferior en móvil) al pulsar un depósito.
- **Zoom + pan** en móvil: pellizco para zoom, arrastre con un dedo para pan. En desktop, scroll horizontal/vertical natural.

## 2. Modelo de datos editable

Dos tablas nuevas en Lovable Cloud (Supabase):

### `bodega_zonas`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `bodega_id` | uuid | FK a `bodegas` (multi-tenant) |
| `nombre` | text | "Zona Exterior" |
| `corto` | text | prefijo: "DP", "AUTO", "N"… |
| `color` | text | hex o token, ej. `#c9a84c` |
| `pos_x` | int | coord. canvas |
| `pos_y` | int | coord. canvas |
| `ancho` | int | tamaño del contenedor |
| `alto` | int | |
| `orden` | int | render order |

### `bodega_depositos`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `bodega_id` | uuid | FK |
| `zona_id` | uuid | FK → `bodega_zonas` |
| `codigo` | text | "DP-01" (único por bodega) |
| `capacidad` | int | litros |
| `litros_actuales` | int | |
| `contenido` | text | "Airén 2024" |
| `estado` | enum | `vacio` `mosto` `fermentacion` `vino` `limpieza` `trasiego` `incidencia` |
| `pos_x` | int | coord. **absoluta** en canvas |
| `pos_y` | int | coord. absoluta |
| `radio` | int | tamaño visual (default 22) |
| `ultimo_movimiento_at` | timestamptz | |

### `procesos_activos` (ya implícito en el modelo previo, lo formalizamos)
| Campo | Tipo |
|---|---|
| `id`, `bodega_id`, `tipo`, `deposito_origen_id`, `deposito_destino_id`, `operario_id`, `iniciado_at`, `finalizado_at`, `litros` |

**Por qué coords absolutas en depósitos** (no relativas a zona): permite arrastrar libremente, y las zonas se redimensionan automáticamente alrededor del bounding box de sus depósitos. Más simple que mantener offsets dobles.

## 3. Cómo se guardan zonas y posiciones

- En **modo vista**: read-only, snapshot suscrito vía Supabase Realtime (canal por `bodega_id`).
- En **modo edición** (solo rol `admin`):
  - Drag → estado local optimista (sin spam a la BD).
  - Al soltar (`onDragEnd`) → `UPDATE bodega_depositos SET pos_x, pos_y WHERE id = …`.
  - Botón "Guardar cambios" solo necesario si hay edición masiva (renombrar, capacidades). Para mover, autosave al soltar.
  - Crear zona/depósito → modal pequeño (nombre, capacidad, zona). Aparece en el canvas en la posición del clic derecho o en (50,50).
  - Eliminar → confirm dialog.
- **Drag & drop**: `framer-motion` con `drag`, `dragMomentum={false}`, `onDragEnd` para persistir. Snap a grid de 8px opcional.

## 4. Cómo se adapta a otras bodegas

- Toda lectura/escritura filtra por `bodega_id`.
- RLS: `auth.uid()` debe pertenecer a la bodega (tabla `bodega_miembros` con rol).
- Selector de bodega en el header si el usuario tiene varias (multi-tenant real).
- El componente `BodegaMap` recibe `bodegaId` y carga zonas + depósitos vía TanStack Query → `createServerFn` con `requireSupabaseAuth`.
- **Seed inicial**: cuando se crea una bodega nueva, plantilla vacía. El admin la construye con el editor.

## 5. Pantalla y orden de implementación

### Fase A — Refactor visual sin backend (esta entrega)
1. Mover el mapa de `/` a `/bodega` como vista principal de esa pestaña. El dashboard `/` mantiene stats + ticker, pero el mapa grande vive en `/bodega`.
2. Crear `BodegaCanvas` (nuevo componente) con:
   - Toolbar (Vista/Editar, +Zona, +Depósito).
   - Contenedor SVG/HTML híbrido: las zonas y nodos son `<div>` posicionados absolute (mejor para drag & drop con framer-motion) y las líneas de flujo siguen siendo SVG por encima.
   - Estado local (`useState`) con zonas/depósitos. Inicializado desde el mock actual, transformado para llevar `pos_x`/`pos_y`/`ancho`/`alto`.
3. Componente `DepositoNode2` con `motion.div drag` solo si `edit` activo. Mantiene nivel de líquido (CSS gradient), label, anillo pulsante, glow.
4. Componente `ZonaContainer` arrastrable también en edición; el bounding box se recalcula si se mueven depósitos dentro.
5. Panel lateral existente reutilizado, con Drawer inferior en móvil (`Sheet side="bottom"` en `< md`).
6. Modal/sheet de edición de zona/depósito (nombre, capacidad, color de zona).
7. Pinch-zoom + pan en móvil con `framer-motion` (`useTransform` + gestos), botones +/- en desktop.

### Fase B — Activar Lovable Cloud (siguiente turno, tras tu OK)
1. Esquema SQL con las tres tablas + RLS + `bodega_miembros` + rol `admin`.
2. Server fns: `listMapa(bodegaId)`, `guardarPosicion(depositoId, x, y)`, `crearZona`, `crearDeposito`, `iniciarProceso`, `finalizarProceso`.
3. Suscripción Realtime para depósitos y procesos.
4. Migrar mock → fetch + mutaciones.

---

## Detalles técnicos clave

- **No SVG puro para los nodos**: cambio a HTML absolute positioned con framer-motion `drag`. SVG sigue para las líneas de flujo de trasiego (overlay `position:absolute; pointer-events:none`). Esto resuelve drag & drop táctil sin reescribir gestos.
- **Pan/zoom**: wrapper con `transform: translate() scale()` controlado por estado. En desktop: scroll del wheel + Ctrl para zoom. En móvil: pinch nativo + drag.
- **Tipos**: ampliar `Deposito` con `pos_x`, `pos_y`, `radio`, `zona_id` (uuid string), eliminar `col`/`row` de la rejilla rígida.
- **Persistencia local (Fase A)**: opcionalmente guardar layout en `localStorage` para que las pruebas del admin se mantengan entre recargas. Borra al activar Cloud.
- **Accesibilidad**: cada nodo es `<button>` con `aria-label` ("Depósito DP-12, fermentación, 28000 litros, 70%"). Modo edición tiene atajos: `Esc` sale, `Del` borra seleccionado.

## Lo que NO hace este plan

- No implementa todavía multi-bodega real ni auth (eso es Fase B con Cloud).
- No incluye edición de procesos desde el mapa (los procesos siguen creándose desde `/trabajos`).
- No incluye rotación de depósitos ni formas no circulares (para v2 si lo pides).

---

**Si apruebas el plan**, ejecuto la Fase A en una sola tanda: refactor a `BodegaCanvas` editable con drag & drop, pan/zoom, panel responsive, persistencia local. Luego activamos Lovable Cloud y migramos a base de datos.

¿Le doy?
