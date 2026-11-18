
- Operations catalog: global families/operations live in familias_operativas/operaciones_catalogo (bodega_id NULL = global, set = centre-owned); per-centre enablement in centro_operaciones where a missing row means enabled. Why: one master catalogue, independent centre config, no duplicates.
- Catalogue capability flags (requiere_*/admite_*) are descriptive only; tipo_formulario decides which existing form opens (carga/descarga always reuse OrdenLogisticaDialog). Why: Bloque A must not touch stock, consumos or movimientos.
