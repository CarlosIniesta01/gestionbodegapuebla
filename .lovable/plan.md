# Rediseño Embotellado y catálogo de Productos

Es un cambio amplio que toca BD, server functions, formularios y administración. Lo divido en fases claras.

## 1. Base de datos (migración)

Nuevas tablas y enums:

- `productos` (catálogo por bodega)
  - `nombre`, `tipo` enum (`enologico`, `limpieza`, `otro`)
  - `lote` text **NOT NULL** + check `length(trim(lote)) > 0`
  - `proveedor`, `fecha_caducidad`, `activo` bool, `observaciones`
  - RLS: lectura miembros activos, escritura admin de bodega
- `elaboraciones` (cabecera de "elaboración propia")
  - `nombre`, `fecha`, `lote_embotellado`, `observaciones`, `bodega_id`, `trabajo_id` (FK lógica)
- `elaboracion_depositos` (depósitos origen + litros usados)
- `elaboracion_productos` (productos + lote + cantidad + unidad)
- `trabajo_asignados` (varios empleados por trabajo) — extiende lo que hoy es `trabajos.asignado_a`

Validaciones (triggers):
- producto sin lote → rechazado
- elaboración: si tiene productos, todos deben tener `lote` no vacío

Realtime habilitado para `productos`, `elaboraciones`.

## 2. Server functions

- `productos.functions.ts`: list (filtrado activos), create, update, deactivate
- `embotellado.functions.ts`:
  - `crearEmbotelladoDirecto({ bodegaId, deposito, litros, formato, botellas, lote, observaciones, scheduledAt, asignados[] })`
  - `crearElaboracionPropia({ bodegaId, nombre, fecha, lote, observaciones, scheduledAt, asignados[], depositos[{id,litros}], productos[{id,lote,cantidad,unidad,obs}] })`
  - Ambas validan lote obligatorio en productos, crean `trabajo` tipo `embotellado`, restan litros del/los depósitos, registran `trabajo_eventos`, recalculan llenado
- `bodega.functions.ts` extendido: `ajustarLitrosDeposito(depId, deltaLitros, motivo)`

## 3. UI — Flujo Trabajos

Cambio clave en `TrabajoFormDialog`:
- Quitar campos "tipo" y "título" cuando se entra desde la pantalla visual (ya viene `defaultTipo`)
- El título se genera automáticamente (ej. "Embotellado D-12 · Lote LB-2025-001")
- Cada tipo abre **su propio componente** de formulario en vez de un genérico

Para Embotellado (`EmbotelladoDialog`):
1. Pantalla inicial: dos tarjetas grandes
   - "Embotellar desde depósito"
   - "Elaboración propia"
2. Form A (directo): zona → depósito → litros → formato (select 0,75/1,5/3/otro) → botellas → lote → notas
3. Form B (elaboración): nombre, fecha, lote, lista dinámica de depósitos (+ litros por cada uno), lista dinámica de productos (selector del catálogo, lote prellenado del producto pero editable, cantidad, unidad)
4. Bloque común al final: **Programar** (Popover + `<Calendar>` shadcn + hora opcional) y **Asignar empleado** (multi-select de miembros activos de la bodega con avatar+rol)

Otros tipos (trasiego, vendimia, etc.) también se simplifican: sin "tipo"/"título" repetidos. Se hace en este mismo cambio para mantener consistencia.

## 4. UI — Administración

Nueva pestaña **Productos** en `/admin`:
- Tabla con buscador y filtro por tipo/activo
- Botón "Nuevo producto" → dialog con validación (lote obligatorio, mensaje claro)
- Acciones: editar, activar/desactivar

## 5. Integración con mapa / depósitos / actividad

Al guardar embotellado (cualquier modo):
- Resta litros vía `ajustarLitrosDeposito` (recalcula % llenado en el modelo de bodega)
- Inserta evento en `trabajo_eventos` con detalle completo (depósitos + productos + lotes)
- Aparece automáticamente en `/actividad` (ya escucha esa tabla)
- El depósito en el mapa refleja el nuevo nivel (ya reactivo)

## 6. Permisos

Reutilizo `has_permission` existente:
- `productos.manage` → crear/editar productos
- `embotellado.create` → registrar embotellado
- Admin de bodega tiene todo (via `is_bodega_admin`)
Se siembran en `role_permissions` del rol admin durante la migración.

## Detalles técnicos

- Calendario: `<Popover>` + `<Calendar mode="single" className="p-3 pointer-events-auto" />` + input hora separado
- Multi-select empleados: `<Command>` con checkboxes; lee de `memberships` + `profiles` filtrado por `bodega_id`
- Estructura archivos nuevos:
  - `src/components/embotellado/EmbotelladoDialog.tsx`
  - `src/components/embotellado/EmbotelladoDirecto.tsx`
  - `src/components/embotellado/ElaboracionPropia.tsx`
  - `src/components/embotellado/ProgramarYAsignar.tsx` (compartido)
  - `src/components/admin/ProductosTab.tsx`
  - `src/lib/api/productos.functions.ts`
  - `src/lib/api/embotellado.functions.ts`

## Fuera de alcance (lo aviso)

- No toco recetas (módulo aparte ya pendiente)
- "Botellas" se calcula automáticamente desde litros+formato cuando ambos están, pero sigue editable
- Compatibilidad: los trabajos de embotellado existentes siguen funcionando (los nuevos campos viven en tablas separadas)

¿Confirmas para implementar?
