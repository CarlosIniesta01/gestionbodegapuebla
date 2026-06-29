import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Search } from "lucide-react";
import { useActiveBodega } from "@/hooks/use-active-bodega";
import { searchGlobal, type SearchHit } from "@/lib/api/search.functions";

const KIND_LABEL: Record<SearchHit["kind"], string> = {
  deposito: "Depósitos",
  producto_comercial: "Productos comerciales",
  producto_enologico: "Productos enológicos",
  lote: "Lotes",
  contrato_compra: "Contratos de compra",
  contrato_venta: "Contratos de venta",
  cliente: "Clientes",
  proveedor: "Proveedores",
  trabajo: "Trabajos",
  centro: "Centros",
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const { bodegaId, isGlobal } = useActiveBodega();
  const navigate = useNavigate();
  const fn = useServerFn(searchGlobal);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const debounced = useDebounced(q, 200);

  const qr = useQuery({
    queryKey: ["global-search", debounced, bodegaId, isGlobal],
    queryFn: () =>
      fn({
        data: {
          q: debounced,
          bodegaId: bodegaId ?? null,
          global: isGlobal,
        },
      }),
    enabled: open && debounced.trim().length >= 2,
    staleTime: 10_000,
  });

  const groups = useMemo(() => {
    const hits = (qr.data ?? []) as SearchHit[];
    const m = new Map<SearchHit["kind"], SearchHit[]>();
    for (const h of hits) {
      if (!m.has(h.kind)) m.set(h.kind, []);
      m.get(h.kind)!.push(h);
    }
    return Array.from(m.entries());
  }, [qr.data]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 h-8 px-3 rounded-md border border-border bg-card text-xs text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
        aria-label="Buscar (Ctrl/Cmd + K)"
      >
        <Search className="size-3.5" />
        Buscar…
        <kbd className="ml-2 hidden lg:inline text-[10px] px-1.5 py-0.5 rounded bg-muted border border-border">
          ⌘K
        </kbd>
      </button>
      <button
        onClick={() => setOpen(true)}
        className="md:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground"
        aria-label="Buscar"
      >
        <Search className="size-[18px]" />
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Buscar depósitos, productos, lotes, contratos, clientes…"
          value={q}
          onValueChange={setQ}
        />
        <CommandList>
          {q.trim().length < 2 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Escribe al menos 2 caracteres
            </div>
          ) : qr.isLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Buscando…</div>
          ) : groups.length === 0 ? (
            <CommandEmpty>Sin resultados</CommandEmpty>
          ) : (
            groups.map(([kind, items]) => (
              <CommandGroup key={kind} heading={KIND_LABEL[kind]}>
                {items.map((h) => (
                  <CommandItem
                    key={`${kind}-${h.id}`}
                    value={`${kind}-${h.id}-${h.label}-${h.sub ?? ""}`}
                    onSelect={() => {
                      setOpen(false);
                      navigate({ to: h.href as any });
                    }}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{h.label}</span>
                      {h.sub && (
                        <span className="text-[11px] text-muted-foreground">{h.sub}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}
