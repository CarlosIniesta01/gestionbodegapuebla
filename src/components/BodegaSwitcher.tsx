// BodegaSwitcher — client-only, defensivo para evitar errores SSR
// Estrategia anti-SSR:
//  - Componente principal hace gate `mounted` (useEffect + useState) y devuelve
//    un placeholder estable hasta el primer render del cliente. Esto evita que
//    iconos / dialogs / context values se evalúen durante el render del servidor.
//  - Iconos importados estáticamente desde "lucide-react"; nunca por nombre dinámico.
//    Cualquier icono potencialmente undefined cae al fallback fijo `FallbackIcon`.
//  - CrearCentroDialog se carga via dynamic import dentro de useEffect cuando
//    se solicita; si falla, el switcher sigue funcionando.
import { useEffect, useRef, useState, type ComponentType } from "react";
import {
  ChevronDown as RawChevronDown,
  Check as RawCheck,
  Plus as RawPlus,
  Globe as RawGlobe,
  Building2 as RawBuilding2,
} from "lucide-react";
import { useActiveBodega } from "@/hooks/use-active-bodega";

type IconProps = { className?: string; size?: number };
const FallbackIcon = ({ className }: IconProps) => (
  <span className={className} aria-hidden="true" style={{ display: "inline-block", width: 14, height: 14 }} />
);
const safe = (Icon: unknown): ComponentType<IconProps> =>
  (typeof Icon === "function" || typeof Icon === "object") && Icon ? (Icon as ComponentType<IconProps>) : FallbackIcon;

const ChevronDown = safe(RawChevronDown);
const Check = safe(RawCheck);
const Plus = safe(RawPlus);
const Globe = safe(RawGlobe);
const Building2 = safe(RawBuilding2);

type Props = { compact?: boolean };

export function BodegaSwitcher(props: Props = {}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    // Placeholder estable para evitar mismatch SSR/CSR.
    return <div aria-hidden className="h-9 w-[180px] rounded-md bg-muted/40" />;
  }
  return <BodegaSwitcherClient {...props} />;
}

function BodegaSwitcherClient({ compact = false }: Props) {
  const {
    bodegas,
    bodegaId,
    bodega,
    setActiveBodegaId,
    viewMode,
    setViewMode,
    isGlobal,
    isLoading,
    isAdminAnywhere,
  } = useActiveBodega();

  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const label = (() => {
    if (isLoading) return "Cargando centros…";
    if (isGlobal) return "Visión Global";
    if (bodega?.nombre) return bodega.nombre;
    if (!bodegas || bodegas.length === 0) return "Sin centros";
    return "Selecciona centro";
  })();

  return (
    <div ref={ref} className="relative" style={{ minWidth: compact ? 160 : 200 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full h-9 px-3 inline-flex items-center justify-between gap-2 rounded-md border bg-card text-[13px] hover:bg-accent"
        style={{ borderColor: "var(--border)" }}
      >
        <span className="inline-flex items-center gap-2 min-w-0">
          {isGlobal ? <Globe className="shrink-0" size={14} /> : <Building2 className="shrink-0" size={14} />}
          <span className="truncate">{label}</span>
        </span>
        <ChevronDown size={14} className="opacity-60 shrink-0" />
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 w-[260px] rounded-md border bg-popover text-popover-foreground shadow-lg"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="px-3 py-2 border-b text-[11px] uppercase tracking-wide text-muted-foreground" style={{ borderColor: "var(--border)" }}>
            Centros
          </div>
          <div className="max-h-64 overflow-auto py-1">
            {isLoading && (
              <div className="px-3 py-2 text-[12px] text-muted-foreground">Cargando…</div>
            )}
            {!isLoading && (!bodegas || bodegas.length === 0) && (
              <div className="px-3 py-2 text-[12px] text-muted-foreground">No tienes centros asignados.</div>
            )}
            {!isLoading && bodegas?.map((b) => {
              const active = !isGlobal && b.bodega_id === bodegaId;
              return (
                <button
                  key={b.bodega_id}
                  type="button"
                  onClick={() => {
                    if (viewMode !== "centro") setViewMode("centro");
                    setActiveBodegaId(b.bodega_id);
                    setOpen(false);
                  }}
                  className="w-full px-3 py-2 inline-flex items-center justify-between gap-2 text-[13px] hover:bg-accent text-left"
                >
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <Building2 size={14} className="opacity-70 shrink-0" />
                    <span className="truncate">{b.bodega?.nombre ?? "Centro"}</span>
                  </span>
                  {active && <Check size={14} className="text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
          <div className="border-t py-1" style={{ borderColor: "var(--border)" }}>
            <button
              type="button"
              onClick={() => {
                setViewMode(isGlobal ? "centro" : "global");
                setOpen(false);
              }}
              className="w-full px-3 py-2 inline-flex items-center justify-between gap-2 text-[13px] hover:bg-accent text-left"
            >
              <span className="inline-flex items-center gap-2">
                <Globe size={14} className="opacity-70" />
                Visión Global
              </span>
              {isGlobal && <Check size={14} className="text-primary" />}
            </button>
            {isAdminAnywhere && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setCreateOpen(true);
                }}
                className="w-full px-3 py-2 inline-flex items-center gap-2 text-[13px] hover:bg-accent text-left"
              >
                <Plus size={14} className="opacity-70" />
                Crear nuevo centro
              </button>
            )}
          </div>
        </div>
      )}

      {createOpen && <LazyCrearCentroDialog open={createOpen} onOpenChange={setCreateOpen} />}
    </div>
  );
}

// Carga diferida del diálogo para que un fallo en su módulo no rompa el switcher.
function LazyCrearCentroDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [Comp, setComp] = useState<ComponentType<{ open: boolean; onOpenChange: (v: boolean) => void }> | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancel = false;
    import("@/components/CrearCentroDialog")
      .then((m) => {
        if (cancel) return;
        const C = m.CrearCentroDialog;
        if (typeof C === "function") setComp(() => C);
        else setFailed(true);
      })
      .catch(() => !cancel && setFailed(true));
    return () => {
      cancel = true;
    };
  }, []);
  if (failed) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/30" onClick={() => onOpenChange(false)}>
        <div className="rounded-lg bg-popover border shadow-xl px-5 py-4 text-[13px]" style={{ borderColor: "var(--border)" }}>
          No se pudo cargar el formulario de creación de centro.
        </div>
      </div>
    );
  }
  if (!Comp) return null;
  return <Comp open={open} onOpenChange={onOpenChange} />;
}
