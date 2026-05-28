# Recetas — Sistema completo

Voy a construir un módulo de Recetas como biblioteca de plantillas reutilizables, conectado al catálogo de Productos (Admin) y al mapa de bodega. Trabajo en fases para no romper nada.

## Fase 1 — Base de datos

Nuevas tablas (con GRANT + RLS scopeadas por `current_user_bodegas()`):

- **`familias_recetas`** — `id, bodega_id, nombre, color, created_at`. Permite crear familias on-the-fly (Flotación, Clarificación, Tinto, Blanco, etc.). Se siembran las por defecto al crear bodega.
- **`recetas`** — `id, bodega_id, nombre, familia_id, tipo, descripcion, observaciones, activa, favorita, version, parent_id (para versionado), uso_count, ultimo_uso_at, created_by, created_at, updated_at`.
- **`receta_depositos`** — `id, receta_id, zona_id, deposito_codigo, litros, variedad, observaciones, orden`.
- **`receta_productos`** — `id, receta_id, producto_id (FK a productos), dosis, unidad, lote, observaciones, orden`. **`lote` NOT NULL** (CHECK length > 0).
- **`receta_pasos`** *(opcional ligero)* — `id, receta_id, orden, texto`. Para instrucciones.

Permisos nuevos (insert en `permissions`): `recetas.read`, `recetas.write`, `recetas.delete`, `recetas.use`, `productos.write`.

Trigger: al insertar en `receta_productos`, validar `producto.lote IS NOT NULL` y `receta_productos.lote` no vacío → error `"Debes indicar el lote del producto para continuar."`.

## Fase 2 — Server functions

`src/lib/api/recetas.functions.ts`:
- `listFamilias`, `upsertFamilia`, `deleteFamilia`
- `listRecetas({ bodegaId, filtros })` — con joins agregados (familia, nº productos, nº depósitos, favorita, etc.)
- `getReceta(id)` — detalle completo con depósitos, productos, pasos, versiones
- `upsertReceta` — crea o edita (transacción: receta + depósitos + productos + pasos). Valida lotes.
- `duplicarReceta(id, { comoNuevaVersion })` — clona; si `comoNuevaVersion` enlaza `parent_id` e incrementa `version`.
- `toggleFavorita`, `toggleActiva`, `deleteReceta`
- `marcarUso(recetaId)` — incrementa `uso_count` y `ultimo_uso_at`. Se llama al usar en trabajo/elaboración.

Validación zod estricta. Mensaje de lote obligatorio explícito.

## Fase 3 — UI Recetas (`/recetas`)

Reemplazo el placeholder de `src/routes/_authenticated/recetas.tsx` con un módulo completo, mobile-first:

**Listado (vista por defecto):**
- Header con buscador grande, botón "Nueva receta", chips de filtros (familia, tipo, favoritas, activas).
- Filtros laterales/collapsibles: producto utilizado, lote, depósito.
- Grid responsivo de tarjetas (`RecetaCard`):
  - Nombre, badge familia con color, tipo, ⭐ favorita
  - Chips de hasta 3 productos principales + "+N"
  - Chips de depósitos asociados
  - Footer: "Usada N veces · hace X días · por Autor"
  - Acciones rápidas: Usar, Editar, Duplicar, ⋯ (menú)

**Detalle (Dialog grande o ruta `/recetas/$id`):**
- Tabs: General, Depósitos, Productos, Pasos, Versiones
- Bloque cabecera con datos generales + botones: Usar receta, Editar, Duplicar, Nueva versión, Desactivar
- Historial de versiones colapsable.

**Editor (Dialog full-screen en móvil):**
- Sección 1: datos generales (nombre, familia con combobox creable, tipo, descripción, observaciones, activa, favorita)
- Sección 2: Depósitos — lista editable. Cada fila: select zona → select depósito (filtrado), input litros con formato es-ES (puntos miles), variedad, observaciones. Botón "+ Añadir depósito".
- Sección 3: Productos — selector desde catálogo (combobox con búsqueda). Por fila: producto, dosis, unidad (g/kg/ml/L/sobres/otro), lote (precargado del producto, editable, **obligatorio**), observaciones. Si el producto del catálogo no tiene lote → bloquea con el mensaje exigido.
- Sección 4: Pasos/instrucciones (opcional, lista ordenable).
- Footer: Guardar / Guardar como nueva versión / Cancelar.

## Fase 4 — Admin · Productos

Añado tab **"Productos"** dentro de `src/routes/_authenticated/admin.tsx` (ya existen `listProductos` / `upsertProducto` / `toggleProductoActivo` / `deleteProducto` — los reutilizo):
- Tabla con nombre, tipo (chip), lote, proveedor, caducidad, estado.
- Dialog crear/editar con validación de lote obligatorio.
- Filtro por tipo y por activos.

## Fase 5 — Reutilización en trabajos

En `TrabajoFormDialog` añado un selector "Usar receta…" (solo si el tipo encaja: trasiego, vendimia, producto, limpieza, embotellado). Al elegir:
- Precarga depósito origen/destino del primer depósito de la receta.
- Precarga campos `datos` (producto, dosis, lote, litros, variedad) desde la receta.
- Llama `marcarUso(recetaId)` al crear el trabajo.
- Usuario puede modificar todo antes de guardar. Al guardar ofrece (toast con acción): "¿Guardar cambios como nueva versión de la receta?".

En `EmbotelladoDialog` y flujo de Elaboraciones: mismo selector "Usar receta".

## Fase 6 — Permisos (RLS)

- `recetas read`: miembros de la bodega.
- `recetas write`: `has_permission(bodega, 'recetas.write')` o admin.
- `recetas delete`: admin o autor.
- `productos write`: `has_permission(bodega, 'productos.write')` o admin (ya cubierto por políticas existentes; añado permiso granular).

## Notas técnicas

- Reutilizo `productos` existente (no duplico).
- Reutilizo `useBodegaMap` para zonas/depósitos en el editor.
- Toda escritura en transacción mediante una sola server fn que hace insert/update + delete+reinsert de hijos (patrón simple, suficiente).
- Versionado: `parent_id` apunta a la receta raíz; `version` autoincremental dentro del árbol.
- UI con tarjetas, chips de colores por familia, iconos Lucide. Sin ERP-feel.

## Orden de ejecución

1. Migración SQL (Fase 1) → pido aprobación.
2. Server functions (Fase 2).
3. Pantalla Recetas + editor (Fase 3).
4. Tab Productos en Admin (Fase 4).
5. Integración en TrabajoFormDialog/Embotellado (Fase 5).

¿Apruebas el plan? Cuando confirmes empiezo por la migración.