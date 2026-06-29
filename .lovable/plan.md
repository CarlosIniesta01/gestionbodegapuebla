
# Fase 8 — Optimización Operativa Inteligente

Mejora de flujo, UX y automatización sobre el núcleo ya estable. **Sin cambios en BBDD** salvo dos vistas de lectura. Sin tocar cálculos de movimientos, existencias, contratos ni auditoría.

## Alcance por bloques

### 1. Asistente de Movimientos (MovimientosTab + diálogo nuevo)
- Al elegir **producto + depósito**, autocompletar:
  - grado habitual desde último movimiento activo del producto
  - estado visual y color recomendado según tipo (entrada→Vino/Fermentación, salida→Vacío si queda 0L)
  - contrato compatible sugerido (mismo producto, pendiente, mismo centro)
  - depósito destino sugerido en trasiegos (mismo producto o vacío con capacidad suficiente)
- Avisos en línea (no bloqueantes salvo capacidad):
  - "Depósito al 95%" / "Excede capacidad: X L disponibles" (bloqueante)
  - "Producto distinto al contenido actual: ENOCIANINA vs TINTO" (warning)
  - "Cantidad supera pendiente del contrato" (bloqueante, ya existe vía trigger SQL)
- Campos opcionales en el form: `estado_visual_destino`, `color_destino`. Al guardar, `sincronizarDepositos` ya recalcula; añadir override visual si el usuario lo fijó manualmente.

### 2. Panel inteligente de depósito (DepositoPanel)
Ampliar el panel actual con nuevas secciones que leen de queries existentes:
- Trabajos abiertos (filtro `trabajos` por `deposito_id`, estado != finalizado)
- Trabajadores asignados a esos trabajos
- Contratos relacionados (vía producto contenido + contratos pendientes del centro)
- Consumos enológicos recientes asociados
- Incidencias abiertas (eventos de trabajo con tipo incidencia)
- **Próxima acción recomendada** (regla local):
  - 0L → "Disponible para nueva entrada"
  - ≥95% → "Evitar nuevas entradas"
  - trabajo abierto → "Finalizar trabajo pendiente"
  - sin movimientos 90 días → "Sin actividad reciente, revisar"
  - producto con contrato venta pendiente → "Producto vinculado a contrato de venta"

### 3. Buscador global (GlobalSearch en AppShell topbar)
- Componente `GlobalSearch.tsx` con cmdk (`@/components/ui/command`), atajo `Ctrl/Cmd+K`.
- Server fn `searchGlobal({ q, bodegaId, scope })` que consulta en paralelo:
  - `depositos` (vía `bodega_maps` JSON), `productos_comerciales`, `productos`, `producto_lotes`, `contratos_compra`, `contratos_venta`, `clientes`, `proveedores`, `trabajos`, `movimientos` (por código), `bodegas`.
  - Limita a 5 por categoría, total 30. ILIKE por nombre/código/numero.
  - Respeta `bodegaId` del centro activo (filtra por columna `bodega_id`); en visión global no filtra.
- Resultados navegan a la ruta correcta (ej. depósito → `/bodega` con queryparam que abre panel; contrato → `/contratos?id=...`; lote → `/almacen?lote=...`).

### 4. Alertas inteligentes
- Server fn `getAlertas({ bodegaId | global })` que computa 13 reglas leyendo vistas existentes (`existencias_actuales`, `v_posicion_comercial`, `v_contratos_*_pendientes`, `producto_lotes`, `trabajos`, `bodega_maps`).
- Componente `AlertasPanel.tsx` reutilizable. Insertado en:
  - Dashboard (sección "Alertas operativas")
  - CentroHeader (badge con contador clicable)
  - DepositoPanel (alertas del propio depósito)
  - Almacén Enológico (caducidades / stock)
  - Posición Comercial (disponible negativo)
- Cada alerta tiene severidad (info/warn/danger), enlace de acción y filtro por centro.

### 5. Vista Procesos Operativos
- Nueva ruta `/_authenticated/procesos`.
- Agrupa registros existentes en buckets (recepción, trasiego, mezcla, corrección, limpieza, embotellado, expedición) derivados de `movimientos.tipo` + `trabajos.tipo`.
- Server fn `listProcesos({ bodegaId })` une movimientos activos recientes y trabajos abiertos en un timeline con columnas: estado, origen, destino, producto, trabajadores, fechas, incidencias.
- Sólo lectura + acciones rápidas (abrir trabajo / abrir movimiento).

### 6. Reducción de clics
- En **MapToolbar**: botón "+ Movimiento" abre el asistente con depósito pre-seleccionado si hay uno activo.
- En **DepositoPanel**: las acciones rápidas existentes (trasiego/limpieza/producto) pasan a abrir directamente el diálogo de movimiento con tipo y depósito precargados.
- En **ContratoFormDialog**: botón "Registrar movimiento" abre el asistente con contrato precargado.
- En **ProductosTab**: botón "Registrar consumo" precarga producto.

### 7. Accesos rápidos contextuales
- Helper `useQuickActions(context)` que devuelve lista de acciones según contexto (deposito/contrato/producto/centro). Render en `DepositoPanel`, `ContratosTab`, `ProductosTab`, `CentroHeader`.

### 8. Multicentro
- Todas las server fns nuevas reciben `bodegaId` opcional; si `viewMode==='global'`, no filtran.
- Las creaciones (movimiento desde asistente, trabajo desde quick action) heredan `bodegaId` del contexto activo.

### 9. Validación
- Build verde + smoke browser:
  - Crear movimiento entrada con asistente → mapa muestra producto y estado sin editar.
  - Abrir depósito → panel muestra recomendación.
  - `Cmd+K` → buscar "D-38", "Enocianina", "Lote", "Finca" devuelve resultados.
  - Dashboard muestra alertas; al cambiar centro, recalcula.
  - `/procesos` carga sin errores.

## Cambios técnicos resumidos

**Nuevos archivos:**
- `src/components/movimientos/MovimientoAsistenteDialog.tsx`
- `src/components/GlobalSearch.tsx`
- `src/components/AlertasPanel.tsx`
- `src/components/ProcesosTimeline.tsx`
- `src/lib/api/search.functions.ts`
- `src/lib/api/alertas.functions.ts`
- `src/lib/api/procesos.functions.ts`
- `src/lib/quick-actions.ts`
- `src/routes/_authenticated/procesos.tsx`

**Modificados:**
- `src/components/AppShell.tsx` (montar GlobalSearch + atajo)
- `src/components/MovimientosTab.tsx` (asistente + sugerencias)
- `src/components/DepositoPanel.tsx` (secciones extra + recomendación)
- `src/components/BodegaCanvas.tsx` (pasar contexto al panel)
- `src/components/CentroHeader.tsx` (badge alertas)
- `src/routes/_authenticated/index.tsx` (AlertasPanel)
- `src/routes/_authenticated/posicion-comercial.tsx` (AlertasPanel)
- `src/routes/_authenticated/almacen.tsx` (AlertasPanel)

**Base de datos:** sólo lectura. No se crean tablas. Opcional: una vista `v_alertas_operativas` si la lógica resulta pesada en TS — decisión durante implementación. Sin migraciones destructivas.

## Riesgos y mitigación
- Búsqueda sobre JSON de `bodega_maps`: filtrar en server con LIMIT y proyección mínima.
- Asistente no debe bloquear guardado por warnings (solo capacidad excedida y contrato sobre-asignado).
- Mantener `sincronizarDepositos` como única vía de actualización del mapa salvo override explícito del usuario.

## Entrega por iteraciones
Dado el volumen, propongo dividir la implementación en 3 PRs/turnos:
1. Buscador global + Alertas + ruta Procesos (mayor impacto inmediato)
2. Asistente de Movimientos + panel inteligente ampliado
3. Accesos rápidos contextuales + reducción de clics + pulido

¿Apruebas el plan o quieres que empiece directamente por una iteración concreta (por ejemplo, sólo buscador + alertas)?
