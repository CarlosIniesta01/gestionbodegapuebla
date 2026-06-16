# Evolución a ERP integral — Vinea Control

Vamos a transformar Vinea Control en el ERP único de la bodega manteniendo intactos los módulos actuales (Inicio, Trabajos, Pendientes, Actividad, Mensajes, Recetas, Bodega, Admin). Todo lo nuevo se añade encima sin tocar lo que ya funciona.

Por el tamaño (≈12 sub‑proyectos, ~30 tablas nuevas, varios módulos UI), propongo construirlo en **5 fases entregables**, cada una usable por sí sola. Confírmame la fase 1 y arranco; las siguientes las vamos validando una a una.

---

## Modelo de datos (base común para todo)

Nuevas tablas en la BD (Lovable Cloud) con RLS por `bodega_id` y GRANTs:

- `productos_comerciales` — catálogo (código, nombre, campaña, tipo, color, grado_referencia).
- `movimientos` — fuente única de verdad. Tipos: `entrada | salida | trasiego | mezcla | embotellado | correccion | ajuste`. Campos: fecha, hora, user_id, deposito_origen_id, deposito_destino_id, producto_id, litros, grado, alcohol_absoluto (calc.), observaciones, contrato_id (opc.), trabajo_id (opc.). **Inmutable**: sin UPDATE/DELETE para usuarios; correcciones → nuevo movimiento `ajuste`.
- `movimiento_lineas` — para mezclas (varios orígenes/destinos en un movimiento).
- `existencias_view` — VIEW materializada que recalcula litros/grado por `(deposito, producto)` a partir de `movimientos`.
- `contratos_compra` y `contratos_venta` — cabecera + estado calculado.
- `contrato_ejecuciones` — vincula movimientos a contratos (litros aplicados).
- `snapshot_diario` — fecha, deposito_id, producto_id, litros, grado, alcohol_absoluto. Generado por cron nocturno.
- `auditoria` — log append‑only (user_id, accion, tabla, registro_id, payload, ts).

Los depósitos ya existen en `bodega_maps`; se enriquecen con campos calculados (no se rompe lo actual).

---

## Fase 1 — Fundamentos: Productos + Movimientos + Existencias

Sin esto nada más funciona. Entregables:

1. Migración con `productos_comerciales`, `movimientos`, `movimiento_lineas`, `existencias_view`, `auditoria` + RLS + GRANTs + trigger de auditoría.
2. UI **Productos comerciales** dentro de Administración (alta/edición/baja del catálogo).
3. Nueva pestaña en **Bodega → Movimientos**: tabla con filtros (fecha, tipo, depósito, producto) + diálogo "Nuevo movimiento" (entrada/salida/trasiego/mezcla/corrección).
4. Nueva pestaña **Bodega → Existencias**: tabla calculada por producto y por depósito, con alcohol absoluto.
5. Bloqueo de edición manual de litros en el diálogo de depósito: pasa a ser solo lectura; los cambios solo vía movimiento.

## Fase 2 — Mapa interactivo enriquecido + Detalle de depósito

1. Sobre el `BodegaCanvas` actual, añadir overlay con: producto, litros, grado, alcohol absoluto, % ocupación.
2. Colores por ocupación: verde 0‑75, amarillo 75‑90, rojo 90‑100, azul vacío (configurable en Colores).
3. Panel lateral al pulsar depósito: histórico de movimientos, contratos relacionados, incidencias.
4. Revisión responsive (tablet/móvil) sin romper el diseño actual.

## Fase 3 — Contratos de compra y venta

1. Migración `contratos_compra`, `contratos_venta`, `contrato_ejecuciones` + RLS.
2. Dos nuevas secciones bajo **Bodega** (o nuevo módulo "Comercial" si prefieres):
   - Contratos de compra (listado, alta, detalle con litros retirados/pendientes).
   - Contratos de venta (idem con litros servidos/pendientes).
3. Al crear un movimiento de entrada/salida, opción de imputarlo a un contrato → actualiza pendientes automáticamente.
4. Estados calculados: pendiente / parcial / completado / cancelado.

## Fase 4 — Posición comercial + Dashboard gerencia

1. Pantalla **Posición Comercial**: Producto | Existencia | Compra pendiente | Venta pendiente | Disponible | Alcohol absoluto.
2. **Dashboard Gerencia** en Inicio (o nueva ruta `/gerencia`): KPIs en tiempo real con Realtime, alertas (contratos por vencer, depósitos llenos, saldo negativo, diferencias).

## Fase 5 — Snapshot diario + Importación inicial + Pulido móvil

1. Job nocturno (pg_cron + ruta `/api/public/hooks/snapshot-diario`) que escribe `snapshot_diario`.
2. Visor histórico "Situación a fecha X".
3. **Asistente de importación** (Admin): subida de Excel/CSV para depósitos, existencias iniciales (genera movimiento "entrada inicial"), contratos compra y venta. Validación con Zod + preview antes de confirmar.
4. Repaso móvil: accesos rápidos (registrar movimiento, trasiego, mezcla, consultar) en ≤3 toques.
5. Preparación IA: vistas `v_*` y endpoints de lectura agregada listos para consumir desde modelos predictivos sin tocar la BD principal.

---

## Detalles técnicos clave

- **Server functions** (`createServerFn` + `requireSupabaseAuth`) para todas las escrituras; nada de mutar existencias desde el cliente.
- **Inmutabilidad**: policies que permiten INSERT pero no UPDATE/DELETE en `movimientos` (correcciones → nuevo registro tipo `ajuste`).
- **Realtime** en `movimientos` y `contratos_*` para que mapa, existencias y dashboard se actualicen solos.
- **Auditoría**: trigger `AFTER INSERT/UPDATE/DELETE` que escribe en `auditoria` con `auth.uid()`.
- **Validación** con Zod en cada server fn (litros ≥ 0, grado 0‑20, depósitos pertenecen a la bodega, capacidad suficiente).
- **Cero cambios** a: Trabajos, Pendientes, Actividad, Mensajes, Recetas, Admin (excepto añadir sub‑pestaña Productos), Inicio (excepto añadir tarjeta opcional al Dashboard en fase 4).

---

## Qué necesito de ti para empezar

1. ¿Arrancamos por la **Fase 1** (Productos + Movimientos + Existencias)? Es el cimiento; sin esto el resto no encaja.
2. Los **contratos** y la **posición comercial**, ¿los prefieres dentro del módulo **Bodega** como pestañas o creamos un nuevo módulo **"Comercial"** en el menú principal?
3. ¿Tienes el Excel actual (estructura de columnas) para diseñar el importador de la Fase 5 conforme a tus datos reales? Si me lo subes cuando lleguemos ahí, lo adapto exacto.

Confírmame esto y empiezo por la Fase 1 con la migración + UI mínima usable.
