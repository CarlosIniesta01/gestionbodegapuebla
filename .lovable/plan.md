
# FASE 7 — Gestión Multicentro Operativa

Sin tocar movimientos, existencias, contratos, trabajos, auditoría, depósitos, naves ni mapas. Solo añadir la capa de **contexto de centro** sobre el ERP actual.

## 1. Núcleo: selector de centro activo

Hoy `useActiveBodega` coge siempre la **primera** bodega del listado. Eso es el cuello de botella: ningún módulo puede contextualizarse por centro.

- Crear `src/lib/active-bodega-context.tsx` con un `ActiveBodegaProvider` montado en `_authenticated/route.tsx`.
- Estado persistido en `localStorage` (`vinea.activeBodegaId`) más un flag `viewMode: "centro" | "global"`.
- Reescribir `useActiveBodega()` para leer del contexto en vez de devolver el primero. API retrocompatible (`bodegaId`, `bodega`, `bodegas`) + nuevos: `setActiveBodegaId`, `viewMode`, `setViewMode`, `isGlobal`.

Resultado: todos los módulos existentes (Dashboard, Trabajos, Mapa, Movimientos, Contratos, Posición Comercial, Almacén) pasan automáticamente a filtrar por el centro seleccionado sin tocar su código — ya leen `bodegaId` de ese hook.

## 2. Selector en la barra superior

- En `AppShell.tsx`, añadir un `BodegaSwitcher` (dropdown) visible en desktop y móvil, con:
  - lista de centros del usuario (`bodegas` de membresías)
  - color identificativo + icono por centro
  - opción **"Visión global"** al final
  - el centro activo se muestra con su color como acento de la cabecera (borde superior 2px)

- Colores asignados de forma estable por hash de `bodega.id` desde una paleta corporativa suave de 8 tonos definida en `src/lib/centro-identity.ts` (color, icono lucide, iniciales).

## 3. Herencia automática de centro

Los formularios actuales (movimientos, trabajos, incidencias, consumos, contratos) ya reciben `bodegaId` del hook. Verificar y, donde falte, fijar `defaultValues.bodega_id = activeBodegaId` y bloquear el campo (no editable) cuando hay centro activo. Sin cambios en validación servidor.

## 4. Cabecera de contexto + resumen del centro

Nuevo componente `CentroHeader` (mostrado en Dashboard, Bodega, Operativa) con:

- Nombre del centro + color
- Chips: capacidad total, litros actuales, ocupación %, depósitos ocupados/vacíos, trabajos abiertos, incidencias, movimientos del día, trasiegos activos, contratos pendientes, lotes próximos a caducar.

Datos vía nuevo server fn `getCentroResumen({ bodegaId })` en `src/lib/api/centros.functions.ts` — solo SELECTs sobre tablas existentes; nada se escribe.

## 5. Nueva ruta: Operativa del centro

`src/routes/_authenticated/operativa.tsx` + entrada en `AppShell` ("Operativa", icono `ClipboardList`).

Secciones (todo SELECT-only, filtrado por `activeBodegaId`):
- Trabajos pendientes / en curso / vencidos / finalizados hoy
- Movimientos del día
- Incidencias abiertas
- Depósitos en limpieza
- Trasiegos activos
- Depósitos con ocupación > 90 %
- Consumos pendientes
- Tareas bloqueadas

Layout en tarjetas tipo dashboard, mismo lenguaje visual que `/`.

## 6. Dashboard: selector Centro / Global

En `routes/_authenticated/index.tsx` añadir, junto a la cabecera, el toggle `[Centro actual] [Global]` ligado a `viewMode` del contexto.

- `centro`: query existente `getDashboard({ bodegaId })` sin cambios.
- `global`: nuevo `getDashboardGlobal()` que itera por las bodegas del usuario y suma KPIs / concatena alertas, agrupando por centro en las tablas.

## 7. Nueva ruta: Comparativa de centros

`src/routes/_authenticated/comparativa.tsx` + entrada en `AppShell` ("Comparativa", icono `GitCompare`).

Tabla con columnas: Centro · Capacidad · Litros · Ocupación % · Dep. ocupados · Dep. vacíos · Trabajos abiertos · Incidencias · Contratos pendientes · Disponible comercial. Orden por cualquier columna, color del centro en la primera celda.

Datos vía `getComparativaCentros()` (server fn) que reutiliza `getCentroResumen` por bodega.

## 8. Mapa de Bodega

Sin cambios estructurales. Solo:
- Cabecera del mapa usa `CentroHeader`.
- Borde superior con el color del centro activo.
- Título "Mapa — {centro}".

## 9. Visión global rápida

El toggle del paso 6 sirve también desde la cabecera (botón "Ver global" en `CentroHeader`) para alternar sin volver al Dashboard.

## Validación

- Cambiar de centro recalcula Dashboard, Trabajos, Movimientos, Existencias, Mapa, Posición Comercial.
- Crear un movimiento/trabajo desde un centro hereda ese `bodega_id`.
- Modo Global muestra consolidado y desglose por centro.
- Comparativa ordena correctamente.
- No se altera ninguna fila existente en BD.

## Detalles técnicos

- Sin migraciones SQL. Todas las tablas relevantes ya tienen `bodega_id`.
- Nuevos archivos:
  - `src/lib/active-bodega-context.tsx`
  - `src/lib/centro-identity.ts`
  - `src/lib/api/centros.functions.ts`
  - `src/components/BodegaSwitcher.tsx`
  - `src/components/CentroHeader.tsx`
  - `src/routes/_authenticated/operativa.tsx`
  - `src/routes/_authenticated/comparativa.tsx`
- Editados:
  - `src/hooks/use-active-bodega.ts` (lee del contexto)
  - `src/routes/_authenticated/route.tsx` (envuelve con provider)
  - `src/components/AppShell.tsx` (switcher + 2 entradas nav)
  - `src/routes/_authenticated/index.tsx` (toggle centro/global + CentroHeader)
  - `src/components/BodegaCanvas.tsx` (CentroHeader, color de centro)
  - `src/lib/api/dashboard.functions.ts` (añadir `getDashboardGlobal`)

Sin tocar lógica de movimientos, existencias, contratos, trabajos, auditoría ni el cálculo de KPIs ya existente: solo se agrega contexto y vistas nuevas que **leen** los mismos datos.
