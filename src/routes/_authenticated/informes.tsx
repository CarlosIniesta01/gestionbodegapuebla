import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { FileText, Printer, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { useActiveBodega } from "@/hooks/use-active-bodega";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { listLotes } from "@/lib/api/lotes.functions";
import { getTrazabilidadLote } from "@/lib/api/trazabilidad.functions";

import { BUILTIN_PROFILES, getBuiltinProfile, type InformeConfig } from "@/lib/informes/profiles";
import { loadCustomProfiles, saveCustomProfile, deleteCustomProfile, type CustomProfile } from "@/lib/informes/storage";
import { BlockConfigurator, ProfilePicker } from "@/components/informes/BlockConfigurator";
import { InformeRenderer } from "@/components/informes/InformeRenderer";
import { AnaliticasManager } from "@/components/informes/AnaliticasManager";


export const Route = createFileRoute("/_authenticated/informes")({
  head: () => ({
    meta: [
      { title: "Informes de trazabilidad · Vinea Control" },
      { name: "description", content: "Motor profesional de informes: bloques configurables y perfiles reutilizables." },
    ],
  }),
  component: InformesPage,
});

const TIPO_LABEL: Record<string, string> = {
  interno: "INFORME INTERNO",
  cliente: "INFORME PARA CLIENTE",
  auditoria: "INFORME DE AUDITORÍA",
  iso22000: "INFORME ISO 22000",
  ifs: "INFORME IFS",
  brcgs: "INFORME BRCGS",
  appcc: "INFORME APPCC",
  direccion: "INFORME DE DIRECCIÓN",
  comercial: "INFORME COMERCIAL",
  personalizado: "INFORME PERSONALIZADO",
};

function InformesPage() {
  const { bodegaId, bodega, bodegas, setActiveBodegaId } = useActiveBodega();
  const [loteId, setLoteId] = React.useState<string | undefined>();
  const [activeProfileId, setActiveProfileId] = React.useState<string>("interno");
  const [config, setConfig] = React.useState<InformeConfig>(() => BUILTIN_PROFILES[0].config);
  const [customProfiles, setCustomProfiles] = React.useState<CustomProfile[]>([]);

  React.useEffect(() => { setCustomProfiles(loadCustomProfiles()); }, []);

  // Rol del usuario en el centro activo (para restricciones)
  const membership = React.useMemo(
    () => (bodegas ?? []).find((b: any) => (b.bodega_id ?? b.id) === bodegaId),
    [bodegas, bodegaId]
  );
  const roleKey: string | undefined = (membership as any)?.role_key;

  // Auto-selecciona centro
  React.useEffect(() => {
    if (bodegaId || !bodegas || bodegas.length === 0) return;
    const first = (bodegas as any[])[0];
    const firstId = first?.bodega_id ?? first?.id;
    if (firstId) setActiveBodegaId(firstId);
  }, [bodegaId, bodegas, setActiveBodegaId]);

  const listLotesFn = useServerFn(listLotes);
  const lotesQ = useQuery({
    queryKey: ["informes-lotes", bodegaId],
    queryFn: () => listLotesFn({ data: { bodegaId: bodegaId! } }),
    enabled: !!bodegaId,
  });
  const lotes = lotesQ.data ?? [];

  const getTrazaFn = useServerFn(getTrazabilidadLote);
  const trazaQ = useQuery({
    queryKey: ["informe-traza", bodegaId, loteId],
    queryFn: () => getTrazaFn({ data: { bodegaId: bodegaId!, loteId: loteId! } }),
    enabled: !!bodegaId && !!loteId,
  });

  const pickProfile = (id: string) => {
    setActiveProfileId(id);
    const builtin = getBuiltinProfile(id);
    if (builtin) { setConfig({ ...builtin.config }); return; }
    const custom = customProfiles.find((p) => p.id === id);
    if (custom) setConfig({ ...custom.config });
  };

  const onSaveProfile = (label: string) => {
    const created = saveCustomProfile(label, config);
    setCustomProfiles(loadCustomProfiles());
    setActiveProfileId(created.id);
    toast.success(`Perfil "${created.label}" guardado.`);
  };
  const onDeleteProfile = (id: string) => {
    setCustomProfiles(deleteCustomProfile(id));
    if (activeProfileId === id) pickProfile("personalizado");
    toast.info("Perfil eliminado.");
  };

  const resetProfile = () => {
    const builtin = getBuiltinProfile(activeProfileId);
    if (builtin) { setConfig({ ...builtin.config }); toast.info("Configuración restablecida."); }
  };

  const tipoLabel = TIPO_LABEL[activeProfileId] ?? "INFORME PERSONALIZADO";
  const fecha = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

  const allProfiles = [
    ...BUILTIN_PROFILES.map((p) => ({ id: p.id, label: p.label, description: p.description })),
    ...customProfiles.map((p) => ({ id: p.id, label: p.label, description: "Perfil personalizado" })),
  ];

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="print:hidden space-y-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-semibold tracking-tight">Motor de informes</h1>
            <p className="text-sm text-muted-foreground">
              Construye informes de trazabilidad seleccionando exactamente los bloques que necesitas.
            </p>
          </div>
        </div>

        {/* Paso 1-3: contexto */}
        <div className="rounded-xl border border-border bg-card p-4 md:p-5 shadow-sm space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">1 · Centro</Label>
              <Select value={bodegaId ?? ""} onValueChange={(v) => setActiveBodegaId(v)}>
                <SelectTrigger><SelectValue placeholder="Selecciona centro…" /></SelectTrigger>
                <SelectContent>
                  {(bodegas ?? []).map((b: any) => {
                    const id = b.bodega_id ?? b.id;
                    const nombre = b.bodega?.nombre ?? b.nombre ?? "Centro";
                    return <SelectItem key={id} value={id}>{nombre}</SelectItem>;
                  })}
                  {(!bodegas || bodegas.length === 0) && (
                    <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                      No tienes centros asignados.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">2 · Lote</Label>
              <Select value={loteId ?? ""} onValueChange={setLoteId} disabled={!bodegaId || lotesQ.isLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={lotesQ.isLoading ? "Cargando lotes…" : "Selecciona lote…"} />
                </SelectTrigger>
                <SelectContent>
                  {lotes.map((l: any) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.numero_lote} — {l.productos?.nombre ?? "Producto"}
                    </SelectItem>
                  ))}
                  {lotes.length === 0 && !lotesQ.isLoading && (
                    <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                      No hay lotes disponibles para este centro.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Acciones</Label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={resetProfile} className="gap-1.5">
                  <RotateCcw className="size-3.5" /> Restablecer
                </Button>
                <Button size="sm" onClick={() => window.print()} disabled={!loteId} className="gap-1.5">
                  <Printer className="size-3.5" /> Imprimir
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">3 · Perfil</Label>
            <ProfilePicker profiles={allProfiles} activeId={activeProfileId} onPick={pickProfile} />
          </div>
        </div>
      </div>

      {/* Paso 4-5: constructor + preview */}
      {loteId ? (
        <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6">
          <aside className="print:hidden space-y-4">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <BlockConfigurator
                config={config}
                setConfig={setConfig}
                customProfiles={customProfiles}
                onSaveProfile={onSaveProfile}
                onDeleteProfile={onDeleteProfile}
                onLoadProfile={pickProfile}
              />
            </div>
            {bodegaId && loteId && (
              <AnaliticasManager
                bodegaId={bodegaId}
                loteId={loteId}
                productoId={(trazaQ.data as any)?.lote?.producto_id ?? null}
              />
            )}
          </aside>
          <div className="min-w-0">

            {trazaQ.isLoading ? (
              <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
                Cargando trazabilidad del lote…
              </div>
            ) : trazaQ.error ? (
              <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
                Error cargando la trazabilidad: {(trazaQ.error as Error).message}
              </div>
            ) : (
              <InformeRenderer
                config={config}
                ctx={{ data: trazaQ.data, tipoLabel, fecha, roleKey }}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="print:hidden rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center">
          <FileText className="size-10 mx-auto mb-3 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">
            Selecciona un centro y un lote para construir el informe.
          </p>
        </div>
      )}
    </div>
  );
}
