import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createBodega } from "@/lib/api/admin.functions";
import { useActiveBodega } from "@/hooks/use-active-bodega";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CrearCentroDialog({ open, onOpenChange }: Props) {
  const fn = useServerFn(createBodega);
  const { refetchBodegas, setActiveBodegaId } = useActiveBodega();
  const [nombre, setNombre] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: async () => {
      const ubicFinal = [ubicacion.trim(), descripcion.trim()].filter(Boolean).join(" — ");
      return fn({
        data: {
          nombre: nombre.trim(),
          ubicacion: ubicFinal || undefined,
        },
      });
    },
    onSuccess: async (res) => {
      await refetchBodegas();
      if (res?.id) setActiveBodegaId(res.id);
      setNombre("");
      setUbicacion("");
      setDescripcion("");
      setError(null);
      onOpenChange(false);
    },
    onError: (e: any) => setError(e?.message ?? "No se pudo crear el centro"),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/30">
      <div
        className="w-full max-w-md rounded-lg bg-popover text-popover-foreground border shadow-xl"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-[15px] font-semibold">Crear nuevo centro</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Nuevo centro independiente con su propio mapa, naves, depósitos y operativa.
          </p>
        </div>
        <form
          className="px-5 py-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!nombre.trim()) {
              setError("El nombre es obligatorio");
              return;
            }
            mut.mutate();
          }}
        >
          <div className="space-y-1">
            <label className="text-[12px] font-medium text-foreground">Nombre del centro</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Bodega Sur"
              className="w-full h-9 px-3 rounded-md border bg-card text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/40"
              style={{ borderColor: "var(--border)" }}
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label className="text-[12px] font-medium text-foreground">Ubicación</label>
            <input
              type="text"
              value={ubicacion}
              onChange={(e) => setUbicacion(e.target.value)}
              placeholder="Calle, municipio, provincia"
              className="w-full h-9 px-3 rounded-md border bg-card text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/40"
              style={{ borderColor: "var(--border)" }}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[12px] font-medium text-foreground">Descripción (opcional)</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              placeholder="Notas internas sobre el centro"
              className="w-full px-3 py-2 rounded-md border bg-card text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/40"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          {error && (
            <div className="text-[12px] text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-9 px-3 rounded-md text-[13px] border bg-card hover:bg-accent"
              style={{ borderColor: "var(--border)" }}
              disabled={mut.isPending}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mut.isPending || !nombre.trim()}
              className="h-9 px-4 rounded-md text-[13px] bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50"
            >
              {mut.isPending ? "Creando…" : "Crear centro"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
