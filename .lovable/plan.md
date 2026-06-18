## FASE 4 — Contratos de Compra y Venta

### Resumen del estado actual
- `movimientos` ya tiene `contrato_compra_id` y `contrato_venta_id` (preparados en Fase 2).
- No existen tablas de contratos, clientes ni proveedores → se crean nuevas.
- Se reutiliza `productos_comerciales`, `bodegas`, `memberships`, `auditoria` y patrón existente.

### 1. Base de datos (una sola migración)

Tablas nuevas en `public`:

- **clientes**: `id, bodega_id, nombre, cif_nif, direccion, telefono, email, observaciones, activo, created_at/by, updated_at`
- **proveedores**: idéntico a clientes
- **contratos_compra**:
  - `numero_contrato` (único por bodega), `proveedor_id`, `producto_id`, `campana`, `litros_contratados`, `litros_retirados` (computado por trigger desde movimientos), `litros_pendientes` (columna GENERATED = contratados − retirados), `precio`, `fecha_contrato`, `fecha_limite`, `observaciones`, `estado` enum (`pendiente|parcial|completado|cancelado`)
- **contratos_venta**: igual con `cliente_id` y `litros_servidos`

Triggers/funciones:
- `recalcular_contrato_compra(contrato_id)` / `_venta(...)`: suma litros activos de `movimientos` y actualiza `litros_retirados`/`litros_servidos` + recalcula `estado` (pendiente / parcial / completado, sin tocar `cancelado`).
- Trigger en `movimientos` AFTER INSERT/UPDATE/DELETE → invoca recálculo del contrato afectado (antes y después).
- Validación: no permitir asociar movimiento cuya cantidad supere `litros_pendientes` del contrato (no negativos).
- Auditoría: trigger genérico `audit_producto_generic` aplicado a contratos, clientes, proveedores.

Vistas para futura Posición Comercial:
- `v_contratos_compra_pendientes` (litros pendientes por producto)
- `v_contratos_venta_pendientes`
- `v_posicion_comercial` (existencias_actuales − ventas_pendientes + compras_pendientes, agrupado por bodega/producto)

RLS: políticas estándar (member de bodega lee; admin/responsable escribe).
GRANTs a `authenticated` y `service_role`.

### 2. Backend (server functions)

`src/lib/api/contratos.functions.ts`:
- CRUD: `listClientes`, `upsertCliente`, `listProveedores`, `upsertProveedor`
- `listContratosCompra/Venta` (con filtros estado/proveedor/cliente/producto/campaña)
- `upsertContratoCompra/Venta`, `cancelarContrato*`
- `getHistorialContrato` (contrato + movimientos asociados con depósito/producto/usuario/fecha)
- `getAlertasContratos` (próximos a vencer < 30 días, vencidos, parciales)

### 3. UI

Nueva entrada de menú **Contratos** en `AppShell` (icono `FileText`), ruta `/contratos`.

`src/routes/_authenticated/contratos.tsx` con tabs:
- **Compras** — tabla + dialog crear/editar
- **Ventas** — tabla + dialog
- **Clientes** — gestión simple
- **Proveedores** — gestión simple

Componentes:
- `src/components/contratos/ContratosCompraTab.tsx`
- `src/components/contratos/ContratosVentaTab.tsx`
- `src/components/contratos/ContratoFormDialog.tsx` (compra/venta)
- `src/components/contratos/HistorialContratoDialog.tsx`
- `src/components/contratos/ClientesTab.tsx`, `ProveedoresTab.tsx`
- `src/components/contratos/EstadoContratoBadge.tsx` (color por estado + alerta vencimiento)

Integración con movimientos:
- En `MovimientosTab` (form crear movimiento): selector "Contrato de compra" cuando tipo=entrada, "Contrato de venta" cuando tipo=salida — opcional, filtrado por producto.
- Al asociar, los triggers actualizan automáticamente litros y estado.

### 4. Validaciones
- Nº contrato único por bodega
- `litros_contratados > 0`
- `fecha_limite >= fecha_contrato` (validación trigger, no CHECK)
- Movimiento no puede exceder pendientes
- Cancelar contrato no permitido si tiene movimientos asociados activos (warning)

### 5. Lo que NO se toca
- No se reescriben módulos existentes.
- No se modifica esquema de `movimientos` (ya tiene FKs preparadas, solo se añaden constraints FK reales hacia las nuevas tablas).
- No se crea aún la pantalla de Posición Comercial (solo vistas SQL).
- No se crea dashboard de Dirección.

### Validación final
Tras aplicar: crear cliente/proveedor → crear contratos → registrar entrada/salida asociada → comprobar recálculo automático, historial, alertas y auditoría.
