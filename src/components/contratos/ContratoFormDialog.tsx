import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tipo: "compra" | "venta";
  editing: any | null;
  partes: any[]; // proveedores o clientes
  productos: any[];
  onSave: (d: any) => void;
}

const cls = "w-full bg-background border border-input rounded-lg px-3 py-2 text-sm";

export function ContratoFormDialog({ open, onOpenChange, tipo, editing, partes, productos, onSave }: Props) {
  const [numero, setNumero] = useState("");
  const [parteId, setParteId] = useState("");
  const [productoId, setProductoId] = useState("");
  const [campana, setCampana] = useState("");
  const [litros, setLitros] = useState("");
  const [precio, setPrecio] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [limite, setLimite] = useState("");
  const [obs, setObs] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setNumero(editing.numero_contrato ?? "");
      setParteId((tipo === "compra" ? editing.proveedor_id : editing.cliente_id) ?? "");
      setProductoId(editing.producto_id ?? "");
      setCampana(editing.campana ?? "");
      setLitros(String(editing.litros_contratados ?? ""));
      setPrecio(editing.precio != null ? String(editing.precio) : "");
      setFecha(editing.fecha_contrato);
      setLimite(editing.fecha_limite ?? "");
      setObs(editing.observaciones ?? "");
    } else {
      setNumero(""); setParteId(""); setProductoId(""); setCampana("");
      setLitros(""); setPrecio(""); setFecha(new Date().toISOString().slice(0, 10));
      setLimite(""); setObs("");
    }
  }, [open, editing?.id, tipo]);

  const canSave = numero.trim().length > 0 && Number(litros) > 0;
  const parteLabel = tipo === "compra" ? "Proveedor" : "Cliente";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {editing ? "Editar" : "Nuevo"} contrato de {tipo}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nº contrato *">
              <input value={numero} onChange={(e) => setNumero(e.target.value)} className={cls} />
            </Field>
            <Field label="Campaña">
              <input value={campana} onChange={(e) => setCampana(e.target.value)} className={cls} placeholder="2025/26" />
            </Field>
          </div>
          <Field label={parteLabel}>
            <select value={parteId} onChange={(e) => setParteId(e.target.value)} className={cls}>
              <option value="">—</option>
              {partes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </Field>
          <Field label="Producto">
            <select value={productoId} onChange={(e) => setProductoId(e.target.value)} className={cls}>
              <option value="">—</option>
              {productos.filter((p: any) => p.activo).map((p: any) => (
                <option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Litros contratados *">
              <input type="number" inputMode="decimal" value={litros} onChange={(e) => setLitros(e.target.value)} className={cls} />
            </Field>
            <Field label="Precio (€/L)">
              <input type="number" inputMode="decimal" step="0.0001" value={precio} onChange={(e) => setPrecio(e.target.value)} className={cls} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha contrato *">
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={cls} />
            </Field>
            <Field label="Fecha límite">
              <input type="date" value={limite} onChange={(e) => setLimite(e.target.value)} className={cls} />
            </Field>
          </div>
          <Field label="Observaciones">
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className={cls} />
          </Field>
        </div>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-secondary">Cancelar</button>
          <button
            disabled={!canSave}
            onClick={() => {
              const payload: any = {
                numero_contrato: numero.trim(),
                producto_id: productoId || null,
                campana: campana.trim() || null,
                litros_contratados: Number(litros),
                precio: precio ? Number(precio) : null,
                fecha_contrato: fecha,
                fecha_limite: limite || null,
                observaciones: obs.trim() || null,
              };
              if (tipo === "compra") payload.proveedor_id = parteId || null;
              else payload.cliente_id = parteId || null;
              onSave(payload);
            }}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {editing ? "Guardar" : "Crear"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5">{label}</div>
      {children}
    </div>
  );
}
