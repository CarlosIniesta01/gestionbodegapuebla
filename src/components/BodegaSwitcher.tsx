import { useState } from "react";
import { Check, ChevronDown, Globe2, Plus } from "lucide-react";
import { useActiveBodega } from "@/hooks/use-active-bodega";
import { centroIdentity, GLOBAL_IDENTITY } from "@/lib/centro-identity";
import { CrearCentroDialog } from "@/components/CrearCentroDialog";

export function BodegaSwitcher({ compact = false }: { compact?: boolean }) {
  const { bodegas, bodegaId, bodega, setActiveBodegaId, viewMode, setViewMode, isGlobal, isAdminAnywhere } = useActiveBodega();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // Si todavía no hay bodegas, permitir al menos crear una si el usuario está autenticado
  const showCreate = isAdminAnywhere || bodegas.length === 0;

  const ident = isGlobal ? GLOBAL_IDENTITY : centroIdentity(bodega);
  const Icon = ident.Icon;
  const label = isGlobal ? "Visión global" : (bodega?.nombre ?? (bodegas.length ? "Centro" : "Sin centros"));

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-md border bg-card hover:bg-accent transition-colors text-foreground ${compact ? "h-8 px-2 text-[12px]" : "h-9 px-2.5 text-[13px]"}`}
        style={{ borderColor: "var(--border)" }}
      >
        <span
          className="inline-flex items-center justify-center rounded-md size-6 shrink-0"
          style={{ background: ident.soft, color: ident.text }}
        >
          <Icon className="size-3.5" />
        </span>
        <span className="font-medium truncate max-w-[180px]">{label}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 mt-1 w-[260px] rounded-md border bg-popover text-popover-foreground shadow-lg z-50 overflow-hidden"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="px-3 pt-2.5 pb-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Centros
            </div>
            <ul className="max-h-[320px] overflow-y-auto py-0.5">
              {bodegas.map((m) => {
                const i = centroIdentity(m.bodega);
                const I = i.Icon;
                const active = !isGlobal && m.bodega_id === bodegaId;
                return (
                  <li key={m.bodega_id}>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveBodegaId(m.bodega_id);
                        setViewMode("centro");
                        setOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-accent text-left"
                    >
                      <span
                        className="inline-flex items-center justify-center rounded-md size-7 shrink-0"
                        style={{ background: i.soft, color: i.text }}
                      >
                        <I className="size-3.5" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block truncate font-medium">{m.bodega.nombre}</span>
                        {m.bodega.ubicacion && (
                          <span className="block truncate text-[11px] text-muted-foreground">{m.bodega.ubicacion}</span>
                        )}
                      </span>
                      {active && <Check className="size-4 text-primary shrink-0" />}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="border-t" style={{ borderColor: "var(--border)" }}>
              <button
                type="button"
                onClick={() => {
                  setViewMode("global");
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-accent text-left"
              >
                <span
                  className="inline-flex items-center justify-center rounded-md size-7 shrink-0"
                  style={{ background: GLOBAL_IDENTITY.soft, color: GLOBAL_IDENTITY.text }}
                >
                  <Globe2 className="size-3.5" />
                </span>
                <span className="flex-1 font-medium">Visión global</span>
                {isGlobal && <Check className="size-4 text-primary shrink-0" />}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Acento de color del centro activo (barra superior fina) */}
      {!compact && (
        <span
          aria-hidden
          className="pointer-events-none fixed top-0 left-0 right-0 h-[3px] z-30"
          style={{ background: ident.color }}
        />
      )}
    </div>
  );
}
