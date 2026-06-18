import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Eye, Pencil, Ban } from "lucide-react";
import { ContratoFormDialog } from "./ContratoFormDialog";
import { HistorialContratoDialog } from "./HistorialContratoDialog";
import { EstadoContratoBadge } from "./EstadoContratoBadge";
import {
  listContratosCompra, listContratosVenta,
  upsertContratoCompra, upsertContratoVenta,
  cancelarContratoCompra, cancelarContratoVenta,
  listClientes, listProveedores,
} from "@/lib/api/contratos.functions";
import { listProductosComerciales } from "@/lib/api/productos-comerciales.functions";

interface Props { bodegaId: string; tipo: "compra" | "venta" }

export function ContratosTab({ bodegaId, tipo }: Props) {
  const qc = useQueryClient();
  const isCompra = tipo === "compra";
  const listFn = useServerFn(isCompra ? listContratosCompra : listContratosVenta);
  const upsertFn = useServerFn(isCompra ? upsertContratoCompra : upsertContratoVenta);
  const cancelFn = useServerFn(isCompra ? cancelarContratoCompra : cancelarContratoVenta);
  const partesFn = useServerFn(isCompra ? listProveedores : listClientes);
  const prodsFn = useServerFn(listProductosComerciales);

  const key = isCompra ? "contratos-compra" : "contratos-venta";
  const partesKey = isCompra ? "proveedores" : "clientes";

  const q = useQuery({ queryKey: [key, bodegaId], queryFn: () => listFn({ data: { bodegaId } }) });
  const partesQ = useQuery({ queryKey: [partesKey, bodegaId], queryFn: () => partesFn({ data: { bodegaId } }) });
  const prodsQ = useQuery({ queryKey: ["productos-comerciales", bodegaId], queryFn: () => prodsFn({ data: { bodegaId } }) });

  const rows = (q.data ?? []) as any[];
  const partes = (partesQ.data ?? []) as any[];
  const productos = (prodsQ.data ?? []) as any[];

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [historial, setHistorial] = useState<any | null>(null);

  const upsertM = useMutation({
    mutationFn: (p: { id?: string; data: any }) => upsertFn({ data: { bodegaId, id: p.id, data: p.data } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [key, bodegaId] }); setOpen(false); toast.success("Guardado"); },
    onError: (e: any) => toast.error(e.message),
  });
  const cancelM = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { bodegaId, id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [key, bodegaId] }); toast.success("Cancelado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const parteCol = isCompra ? "proveedores" : "clientes";
  const litrosCol = isCompra ? "litros_retirados" : "litros_servidos";
  const litrosColLabel = isCompra ? "Retirados" : "Servidos";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-display">Contratos de {tipo}</h3>
        <button onClick={() => { setEditing(null); setOpen(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="size-3.5" /> Nuevo contrato
        </button>
      </div>

      <div className="rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <tr>
              <th className="text-left p-2">Nº</th>
              <th className="text-left p-2">{isCompra ? "Proveedor" : "Cliente"}</th>
              <th className="text-left p-2">Producto</th>
              <th className="text-left p-2">Camp.</th>
              <th className="text-right p-2">Contrat.</th>
              <th className="text-right p-2">{litrosColLabel}</th>
              <th className="text-right p-2">Pendientes</th>
              <th className="text-right p-2">Precio</th>
              <th className="text-left p-2">Fecha</th>
              <th className="text-left p-2">Límite</th>
              <th className="text-left p-2">Estado</th>
              <th className="text-right p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && <tr><td colSpan={12} className="p-4 text-center text-xs text-muted-foreground">Cargando…</td></tr>}
            {!q.isLoading && rows.length === 0 && (
              <tr><td colSpan={12} className="p-4 text-center text-xs text-muted-foreground">Sin contratos</td></tr>
            )}
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="p-2 font-mono text-xs">{c.numero_contrato}</td>
                <td className="p-2">{c[parteCol]?.nombre ?? "—"}</td>
                <td className="p-2 text-xs">{c.productos_comerciales?.nombre ?? "—"}</td>
                <td className="p-2 text-xs">{c.campana ?? "—"}</td>
                <td className="p-2 text-right tabular-nums">{Number(c.litros_contratados).toLocaleString("es-ES")}</td>
                <td className="p-2 text-right tabular-nums">{Number(c[litrosCol]).toLocaleString("es-ES")}</td>
                <td className="p-2 text-right tabular-nums font-medium">{Number(c.litros_pendientes).toLocaleString("es-ES")}</td>
                <td className="p-2 text-right tabular-nums text-xs">{c.precio != null ? `${Number(c.precio).toFixed(4)} €` : "—"}</td>
                <td className="p-2 text-xs whitespace-nowrap">{c.fecha_contrato}</td>
                <td className="p-2 text-xs whitespace-nowrap">{c.fecha_limite ?? "—"}</td>
                <td className="p-2"><EstadoContratoBadge estado={c.estado} fechaLimite={c.fecha_limite} /></td>
                <td className="p-2 text-right whitespace-nowrap">
                  <button title="Historial" onClick={() => setHistorial(c)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"><Eye className="size-3.5" /></button>
                  <button title="Editar" onClick={() => { setEditing(c); setOpen(true); }} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"><Pencil className="size-3.5" /></button>
                  {c.estado !== "cancelado" && c.estado !== "completado" && (
                    <button title="Cancelar" onClick={() => { if (confirm(`¿Cancelar contrato ${c.numero_contrato}?`)) cancelM.mutate(c.id); }}
                      className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-rose-500"><Ban className="size-3.5" /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ContratoFormDialog
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}
        tipo={tipo}
        editing={editing}
        partes={partes}
        productos={productos}
        onSave={(d) => upsertM.mutate({ id: editing?.id, data: d })}
      />

      <HistorialContratoDialog
        open={!!historial}
        onOpenChange={(v) => { if (!v) setHistorial(null); }}
        bodegaId={bodegaId}
        contrato={historial}
        tipo={tipo}
      />
    </div>
  );
}
