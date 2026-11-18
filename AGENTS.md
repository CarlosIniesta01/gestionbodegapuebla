
- Operations catalog: global families/operations live in familias_operativas/operaciones_catalogo (bodega_id NULL = global, set = centre-owned); per-centre enablement in centro_operaciones where a missing row means enabled. Why: one master catalogue, independent centre config, no duplicates.
- Catalogue capability flags (requiere_*/admite_*) are descriptive only; tipo_formulario decides which existing form opens (carga/descarga always reuse OrdenLogisticaDialog). Why: Bloque A must not touch stock, consumos or movimientos.

- Global catalogue rows (bodega_id NULL) are created/edited/toggled only with permission operaciones.catalogo.global (admin/enólogo), enforced in RLS, server functions and UI; centre roles only toggle centro_operaciones. Why: a centre must never alter the master catalogue for other centres.
- Every trabajo launched from a catalogue operation (including embotellado's own dialog) stores operacion_catalogo_id. Why: uniform classification across families.
- New-work centre is chosen in SelectorOperacionDialog and passed as bodegaId to every form (independent of the global active centre); createTrabajo/embotellado validate access, operation enabled and deposits of that centre server-side. Why: send work orders to any centre without switching context.
