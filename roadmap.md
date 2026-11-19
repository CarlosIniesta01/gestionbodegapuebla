# Vinea Control — Roadmap

## Bloque A — FINALIZADO (aprobado por Carlos Iniesta, 18/11/2026)
Base definitiva (no modificar sin autorización): 18 familias y 197 operaciones; selección de centro antes de crear cualquier trabajo; accesos rápidos multicentro; configuración independiente por centro; centro visible en órdenes y Visión Global; permisos del catálogo maestro; vínculo trabajo–operación; separación programación / ejecución física; guardar órdenes pendientes no modifica existencias; bloqueo temporal de F06-08 (traslado entre centros).

## Bloque B — EN CURSO; B2 autorizado el 19/11/2026 (no iniciar B3/B4)
- [ ] Formulario de traslado entre centros (centro/depósito de origen y destino, producto/lote, litros previstos/reales, responsables, expedición/recepción).
- [x] B1 Asignación y gestión de operarios por centro (FINALIZADO; cierre aprobado por Carlos Iniesta, 18/11/2026).
- [x] B1: asignación al crear embotellado directo y elaboración mediante la sección común.
- [ ] Corregir aviso del Calendario en Visión Global (texto distinto servidor/cliente).
- [ ] Validación con usuarios con acceso limitado a algunos centros.
- [ ] Comprobar visualización de órdenes por operario y centro (requiere sesión de un operario).


## B1 — FINALIZADO (aprobado por Carlos Iniesta, 18/11/2026)
Conservar las funcionalidades implementadas y no modificar los módulos validados. El cierre no equivale a la validación final del Bloque B. No comenzar B2 automáticamente; esperar instrucciones.

- [x] Embotellado (directo y elaboración) usa la sección común «Asignar trabajo» + fecha y prioridad.
- [x] Prueba controlada en Finca la Blanca (trabajo cancelado, motivo PRUEBA SISTEMA — BLOQUE B1).
- [x] Cierre de B1 aprobado expresamente.
- [x] Comprobación de limpieza: trabajo 23a2d475-edc5-45b6-94ec-f449b21a0df3 continúa cancelado; retiradas sus dos asignaciones con sesión del usuario y motivo de cierre; cero asignaciones activas. Historial conservado; no se han borrado registros.
- [x] Existencias intactas: 24 movimientos, 2.118.956 L; cero movimientos asociados al trabajo de prueba.

## Incidencias obligatorias antes de la validación final del Bloque B
Pendientes documentadas, no implementadas en este cierre; requieren autorización para reabrir las comprobaciones o modificar lo validado.
- [ ] Comprobar aceptación y rechazo desde una sesión real de Operario (pendiente sesión y autorización de prueba).
- [ ] Comprobar permisos de un Responsable con acceso limitado a determinados centros (pendiente cuenta adecuada y autorización de prueba).
- [ ] Revisar visualmente Distribución y Mis trabajos en ordenador y móvil (pendiente validación visual autorizada).
- [ ] Mejorar avisos de trabajos cancelados para diferenciarlos de órdenes activas (pendiente autorización de cambio; los avisos históricos no se eliminan).
- [ ] Garantizar en todas las vías de escritura que solo el operario pueda registrar su aceptación; cualquier intervención administrativa debe quedar diferenciada y auditada, sin suplantación (pendiente endurecimiento autorizado y pruebas; la función de respuesta propia ya limita al titular, pero el control de datos actual permite al gestor cambiar estados ajenos).

## B2 — FORMULARIOS INTELIGENTES (abierto; no cerrar sin aprobación)
- [x] Primera entrega: tres plantillas reutilizables (trasiego F06-01/02/03/07, clarificación F08-01–12, fermentación F05-01–12; 28 operaciones), versión y parámetros con unidades; seis unidades de dosis, varias líneas y cantidades previstas recalculadas en servidor.
- [x] Integración inicial: contexto oficial por centro, productos y lotes relacionados, controles de capacidad y permisos; AsignacionPicker B1 conservado; resumen previsto en Programación y Mis trabajos.
- [x] 58 pruebas pasan; navegador autenticado confirma selección F08-04 y 40.000 L × 50 g/hL = 20 kg en ordenador y móvil, sin guardar; sin errores de ejecución. Existencias permanecen en 24 movimientos y 2.118.956 L.
- [ ] Resto de B2, siguiente entrega: plantillas de mezcla, filtración, limpieza, mantenimiento, laboratorio, conservación, recepción, subproductos y generales; configuración editable por operación de campos obligatorios/opcionales/condicionales (primera entrega usa definiciones reutilizables versionadas, aún no editor de plantillas).
- [ ] Completar referencia inequívoca a lote de contenido del depósito (los datos actuales solo permiten mostrar lotes relacionados con analíticas, no afirmar un lote físico actual).
- [ ] Validación persistente de guardado y recuperación (requiere autorización para crear un trabajo de prueba).
- [ ] Validación con usuarios de acceso limitado (requiere sesión autorizada del perfil correspondiente).
Restricciones: conservar carga/descarga/embotellado; no modificar existencias, mapa, movimientos, consumos ni contratos; F06-08 bloqueada hasta B4; no ejecutar ni iniciar B3/B4.
