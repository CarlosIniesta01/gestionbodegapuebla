import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { listAuditoria, listPerfilesAuditoria } from "@/lib/api/auditoria.functions";
import { CAMPOS_AUDITORIA, getCampoValue, formatCampo } from "@/lib/auditoria-fields";

interface Props { bodegaId: string }

export function AuditoriaTab({ bodegaId }: Props) {
  const fnList = useServerFn(listAuditoria);
  const fnPerfiles = useServerFn(listPerfilesAuditoria);

  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [tabla, setTabla] = useState("");
  const [accion, setAccion] = useState("");

  const perfilesQ = useQuery({
    queryKey: ["perfiles-auditoria", bodegaId],
    queryFn: () => fnPerfiles({ data: { bodegaId } }),
  });
  const perfiles = (perfilesQ.data ?? []) as any[];
  const defaultPerfil = perfiles.find((p) => p.es_predeterminado) ?? perfiles[0];
  const [perfilId, setPerfilId] = useState<string>("");
  const activePerfil = perfiles.find((p) => p.id === perfilId) ?? defaultPerfil;
  const camposVisibles: string[] = activePerfil?.campos_visibles?.length
    ? activePerfil.campos_visibles
    : CAMPOS_AUDITORIA.map((c) => c.key);

  const filtros = useMemo(() => ({
    bodegaId,
    desde: desde || undefined,
    hasta: hasta || undefined,
    tabla: tabla || undefined,
    accion: accion || undefined,
    limit: 1000,
  }), [bodegaId, desde, hasta, tabla, accion]);

  const q = useQuery({
    queryKey: ["auditoria", filtros],
    queryFn: () => fnList({ data: filtros }),
  });
  const rows = (q.data ?? []) as any[];

  const colsMeta = CAMPOS_AUDITORIA.filter((c) => camposVisibles.includes(c.key));

  async function exportPDF() {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(13);
    doc.text(`Auditoría · ${activePerfil?.nombre ?? "Perfil"}`, 14, 14);
    doc.setFontSize(9);
    doc.text(`Generado ${new Date().toLocaleString()}`, 14, 20);
    autoTable(doc, {
      startY: 26,
      head: [colsMeta.map((c) => c.label)],
      body: rows.map((r) => colsMeta.map((c) => formatCampo(getCampoValue(r, c.key)))),
      styles: { fontSize: 7, cellPadding: 1.5, overflow: "linebreak" },
      headStyles: { fillColor: [40, 40, 60] },
    });
    doc.save(`auditoria-${Date.now()}.pdf`);
  }

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const data = rows.map((r) => {
      const o: Record<string, any> = {};
      for (const c of colsMeta) o[c.label] = formatCampo(getCampoValue(r, c.key));
      return o;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Auditoría");
    XLSX.writeFile(wb, `auditoria-${Date.now()}.xlsx`);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Perfil">
          <select value={activePerfil?.id ?? ""} onChange={(e) => setPerfilId(e.target.value)}
            className="bg-background border border-input rounded-lg px-2 py-1.5 text-sm">
            {!perfiles.length && <option value="">— sin perfiles —</option>}
            {perfiles.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}{p.es_predeterminado ? " ★" : ""}</option>
            ))}
          </select>
        </Field>
        <Field label="Desde">
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
            className="bg-background border border-input rounded-lg px-2 py-1.5 text-sm" />
        </Field>
        <Field label="Hasta">
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
            className="bg-background border border-input rounded-lg px-2 py-1.5 text-sm" />
        </Field>
        <Field label="Tabla">
          <input value={tabla} onChange={(e) => setTabla(e.target.value)} placeholder="movimientos"
            className="bg-background border border-input rounded-lg px-2 py-1.5 text-sm w-40" />
        </Field>
        <Field label="Acción">
          <select value={accion} onChange={(e) => setAccion(e.target.value)}
            className="bg-background border border-input rounded-lg px-2 py-1.5 text-sm">
            <option value="">Todas</option>
            <option value="INSERT">INSERT</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
          </select>
        </Field>
        <div className="ml-auto flex gap-2">
          <button onClick={exportPDF} disabled={!rows.length}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-secondary disabled:opacity-50">
            <FileDown className="size-3.5" /> PDF
          </button>
          <button onClick={exportExcel} disabled={!rows.length}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-secondary disabled:opacity-50">
            <FileSpreadsheet className="size-3.5" /> Excel
          </button>
        </div>
      </div>

      <div className="text-[11px] text-muted-foreground">
        {rows.length} registros · perfil "{activePerfil?.nombre ?? "—"}" muestra {colsMeta.length} de {CAMPOS_AUDITORIA.length} campos. La base de datos conserva siempre todos los datos.
      </div>

      <div className="rounded-xl border border-border overflow-auto max-h-[60vh]">
        <table className="w-full text-xs">
          <thead className="bg-secondary/50 text-[10px] uppercase tracking-[0.16em] text-muted-foreground sticky top-0">
            <tr>
              {colsMeta.map((c) => <th key={c.key} className="text-left p-2 whitespace-nowrap">{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border align-top">
                {colsMeta.map((c) => (
                  <td key={c.key} className="p-2 max-w-[280px] truncate" title={formatCampo(getCampoValue(r, c.key))}>
                    {formatCampo(getCampoValue(r, c.key))}
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={colsMeta.length || 1} className="p-6 text-center text-muted-foreground">Sin registros con los filtros actuales.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  );
}
