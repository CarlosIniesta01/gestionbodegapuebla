import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getHistorialContrato } from "@/lib/api/contratos.functions";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bodegaId: string;
  contrato: any | null;
  tipo: "compra" | "venta";
}

export function HistorialContratoDialog({ open, onOpenChange, bodegaId, contrato, tipo }: Props) {
  const fn = useServerFn(getHistorialContrato);
  const q = useQuery({
    queryKey: ["historial-contrato", contrato?.id, tipo],
    queryFn: () => fn({ data: { bodegaId, contratoId: contrato!.id, tipo } }),
    enabled: !!contrato?.id && open,
  });
  const rows = (q.data ?? []) as any[];
  const parte = tipo === "compra" ? contrato?.proveedores?.nombre : contrato?.clientes?.nombre;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-border max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            Historial · {contrato?.numero_contrato} {parte ? `· ${parte}` : ""}
          </DialogTitle>
        </DialogHeader>
        {contrato && (
          <div className="grid grid-cols-4 gap-3 text-xs mb-3 pb-3 border-b border-border">
            <Kpi label="Contratados" value={`${Number(contrato.litros_contratados).toLocaleString("es-ES")} L`} />
            <Kpi label={tipo === "compra" ? "Retirados" : "Servidos"} value={`${Number(tipo === "compra" ? contrato.litros_retirados : contrato.litros_servidos).toLocaleString("es-ES")} L`} />
            <Kpi label="Pendientes" value={`${Number(contrato.litros_pendientes).toLocaleString("es-ES")} L`} />
            <Kpi label="Estado" value={contrato.estado} />
          </div>
        )}
        <div className="rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <tr>
                <th className="text-left p-2">Fecha</th>
                <th className="text-left p-2">Tipo</th>
                <th className="text-left p-2">Estado</th>
                <th className="text-left p-2">Producto</th>
                <th className="text-left p-2">Origen → Destino</th>
                <th className="text-right p-2">Litros</th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading && <tr><td colSpan={6} className="p-4 text-center text-xs text-muted-foreground">Cargando…</td></tr>}
              {!q.isLoading && rows.length === 0 && (
                <tr><td colSpan={6} className="p-4 text-center text-xs text-muted-foreground">Sin movimientos asociados</td></tr>
              )}
              {rows.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="p-2 text-xs whitespace-nowrap">{m.fecha} {m.hora?.slice(0, 5)}</td>
                  <td className="p-2">{m.tipo}</td>
                  <td className="p-2 text-xs">{m.estado_movimiento}</td>
                  <td className="p-2">{m.productos_comerciales?.nombre ?? "—"}</td>
                  <td className="p-2 font-mono text-xs">{m.deposito_origen_id ?? "—"} → {m.deposito_destino_id ?? "—"}</td>
                  <td className="p-2 text-right tabular-nums">{Number(m.litros).toLocaleString("es-ES")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="font-display text-sm mt-0.5">{value}</div>
    </div>
  );
}
