## FASE — Calendario Operativo de Bodega

Añadir un módulo de **Calendario** que centralice la planificación de cargas, descargas, trabajos, limpiezas, trasiegos, mezclas, embotellados, expediciones, mantenimientos, incidencias y revisiones, integrado con trabajos, contratos, depósitos y multicentro existentes.

### 1. Base de datos (migración única, sin tocar tablas actuales)

Nuevas tablas:

- `calendario_eventos`
  - `id`, `bodega_id` (FK), `tipo` (enum), `titulo`, `descripcion`
  - `zona_id` nullable, `deposito_origen` text, `deposito_destino` text
  - `producto_id` nullable, `contrato_compra_id` nullable, `contrato_venta_id` nullable
  - `trabajo_id` nullable (FK opcional a `trabajos`)
  - `cliente_id` nullable, `proveedor_id` nullable
  - `fecha_inicio` timestamptz, `fecha_fin` timestamptz
  - `estado` enum (programado, en_proceso, completado, cancelado, retrasado)
  - `prioridad` enum (baja, normal, alta, critica)
  - `datos` jsonb (campos extra: transportista, matrícula, conductor, teléfono, litros previstos, hora real, documentación)
  - `observaciones`, `created_by`, `created_at`, `updated_at`

- `calendario_evento_trabajadores` (M:N con `profiles`)
  - `id`, `evento_id`, `user_id`, `bodega_id`, `created_at`

Enums:
- `calendario_tipo`: carga, descarga, trabajo, limpieza, trasiego, mezcla, embotellado, expedicion, mantenimiento, incidencia, recordatorio, auditoria, analisis
- `calendario_estado`, `calendario_prioridad`

RLS:
- SELECT: miembros activos de la bodega; trabajadores no-admin solo ven eventos donde son asignados o creadores.
- INSERT/UPDATE/DELETE: admin, responsable, enólogo (vía `has_permission`).
- Triggers: `touch_updated_at`, `audit_generic` (reusa patrón existente).

GRANTs estándar para `authenticated` y `service_role`.

### 2. Server functions (`src/lib/api/calendario.functions.ts`)

- `listEventos({ bodegaId|null (global), from, to, tipos?, estados?, userId?, prioridad? })`
- `getEvento(id)` con asignados, contrato, trabajo
- `createEvento(payload)` + asigna trabajadores; valida conflictos (mismo depósito/trabajador solapados) y devuelve warnings
- `updateEvento(id, patch)`
- `deleteEvento(id)`
- `setEventoEstado(id, estado)`
- `linkTrabajo(eventoId, trabajoId)` y `createTrabajoDesdeEvento(eventoId)`
- `eventosHoy(bodegaId)` y `eventosCriticosProximos` para Dashboard
- `contratosComoEventos({ bodegaId, from, to })`: convierte `contratos_*.fecha_entrega/limite` próximos en pseudo-eventos read-only

Todas con `requireSupabaseAuth` + verificación de membership.

### 3. UI

Ruta `src/routes/_authenticated/calendario.tsx`:
- Header con BodegaSwitcher heredado, botón "Nuevo evento".
- Filtros (tipo, estado, trabajador, prioridad, depósito, contrato).
- Vistas: Día / Semana / Mes / Agenda (tabs). Implementación ligera con grid CSS (sin dependencias nuevas pesadas — usar `date-fns` ya disponible).
- Mobile-first: agenda como vista por defecto en móvil.
- Click evento → `EventoDetailDialog` con acciones (editar, cambiar estado, abrir/crear trabajo, ir a contrato).

Componentes nuevos:
- `CalendarioMonthView`, `CalendarioWeekView`, `CalendarioDayView`, `CalendarioAgendaView`
- `EventoFormDialog` (campos básicos + secciones condicionales por tipo: bloque "Camión" para carga/descarga)
- `EventoDetailDialog`
- `EventoCard` (chip de tipo con color suave)
- `CalendarioFilters`
- `lib/calendario-meta.ts` con tipos, colores e iconos (patrón `trabajo-meta.ts`)

Navegación:
- Añadir item "Calendario" en `AppShell` sidebar visible para admin/responsable/enólogo; trabajadores ven el ítem pero la página filtra a sus eventos.

Dashboard:
- Nuevo widget "Hoy en el calendario" en `routes/_authenticated/index.tsx` con: eventos de hoy, cargas hoy, retrasados, próximos críticos (3-5 ítems clicables).

Conflictos: detector en `createEvento`/`updateEvento` que devuelve `warnings[]`; el diálogo muestra confirmación antes de guardar si hay conflictos no bloqueantes.

### 4. Integración con trabajos y contratos

- Si un `trabajo` tiene `scheduled_at`, aparece como evento "fantasma" en el calendario (read-only, badge "Trabajo") vía merge en `listEventos`.
- Contratos: `fecha_entrega`/`fecha_limite` próximos (±30 días) aparecen como eventos read-only categoría "contrato".

Sin modificar tablas `trabajos`/`contratos_*`.

### 5. Auditoría

Trigger `audit_calendario_evento` que escribe en `auditoria` con acciones: CREADO, MODIFICADO, ESTADO_*, CANCELADO, COMPLETADO, FECHA_CAMBIADA, TRABAJADOR_CAMBIADO.

### 6. Validación final

Checklist de la fase ejecutado manualmente más `tsgo` typecheck.

### Detalles técnicos

- Reutiliza `useActiveBodega`, `requireSupabaseAuth`, patrones de `trabajos.functions.ts`.
- `bodegaId` en todas las `queryKey` para invalidación al cambiar centro.
- Colores en `src/styles.css` (tokens `--cal-*`) o derivados de `state-*` ya existentes — sin hex hardcoded.
- Sin dependencias nuevas pesadas; agenda/mes en grid CSS + `date-fns`.

¿Procedo con la migración + implementación completa, o prefieres dividir en dos PRs (BD+API primero, UI después)?
