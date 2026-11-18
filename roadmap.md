# Vinea Control — Roadmap

## Bloque A — FINALIZADO (aprobado por Carlos Iniesta, 18/11/2026)
Base definitiva (no modificar sin autorización): 18 familias y 197 operaciones; selección de centro antes de crear cualquier trabajo; accesos rápidos multicentro; configuración independiente por centro; centro visible en órdenes y Visión Global; permisos del catálogo maestro; vínculo trabajo–operación; separación programación / ejecución física; guardar órdenes pendientes no modifica existencias; bloqueo temporal de F06-08 (traslado entre centros).

## Bloque B — PENDIENTE (no iniciar sin instrucciones)
- [ ] Formulario de traslado entre centros (centro/depósito de origen y destino, producto/lote, litros previstos/reales, responsables, expedición/recepción).
- [x] B1 Asignación y gestión de operarios por centro (implementado; pendiente prueba con datos reales autorizada).
- [ ] B1: asignación al crear embotellado (hoy se asigna después desde la tarjeta).
- [ ] Corregir aviso del Calendario en Visión Global (texto distinto servidor/cliente).
- [ ] Validación con usuarios con acceso limitado a algunos centros.
- [ ] Comprobar visualización de órdenes por operario y centro (requiere sesión de un operario).


## B1 — pruebas (18/11/2026)
- [x] Embotellado (directo y elaboración) usa la sección común «Asignar trabajo» + fecha y prioridad.
- [x] Prueba controlada en Finca la Blanca (trabajo cancelado, motivo PRUEBA SISTEMA — BLOQUE B1).
- [ ] Aceptar/rechazar con sesión real de operario (falta sesión de operario).
- [ ] Comprobación visual de Distribución/Mis trabajos con la prueba (navegador automático no respondió).
- [ ] Cierre de B1: espera aprobación expresa.
