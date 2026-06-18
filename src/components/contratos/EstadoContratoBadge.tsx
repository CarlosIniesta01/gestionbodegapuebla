interface Props { estado: string; fechaLimite?: string | null }

const COLORS: Record<string, string> = {
  pendiente:  "bg-slate-500/15 text-slate-600 border-slate-500/30",
  parcial:    "bg-amber-500/15 text-amber-600 border-amber-500/30",
  completado: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  cancelado:  "bg-rose-500/15 text-rose-600 border-rose-500/30",
};

export function EstadoContratoBadge({ estado, fechaLimite }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const vencido = fechaLimite && fechaLimite < today && (estado === "pendiente" || estado === "parcial");
  const porVencer = fechaLimite && fechaLimite >= today && fechaLimite <= in30 && (estado === "pendiente" || estado === "parcial");

  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-block text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${COLORS[estado] ?? COLORS.pendiente}`}>
        {estado}
      </span>
      {vencido && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border bg-rose-500/15 text-rose-600 border-rose-500/30">vencido</span>}
      {porVencer && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border bg-amber-500/15 text-amber-600 border-amber-500/30">vence pronto</span>}
    </div>
  );
}
