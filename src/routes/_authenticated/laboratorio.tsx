import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { FlaskConical, Truck, ClipboardList } from "lucide-react";
import { useActiveBodega } from "@/hooks/use-active-bodega";
import { CentroHeader } from "@/components/CentroHeader";
import { ProcesosDocumentalesTab } from "@/components/admin/ProcesosDocumentalesTab";
import { PlantillasAnaliticaTab } from "@/components/admin/PlantillasAnaliticaTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/laboratorio")({
  head: () => ({
    meta: [
      { title: "Laboratorio y calidad · Vinea Control" },
      { name: "description", content: "Procesos documentales y plantillas analíticas para logística, laboratorio y calidad." },
    ],
  }),
  component: LaboratorioPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">Error: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6">No encontrado.</div>,
});

function LaboratorioPage() {
  const { bodegaId, isGlobal } = useActiveBodega();
  const [tab, setTab] = useState<"procesos" | "plantillas">("procesos");

  if (!bodegaId) return <div className="p-6 text-muted-foreground">Cargando…</div>;

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-4">
      <CentroHeader />

      <div className="rounded-lg border bg-card p-4" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <FlaskConical className="size-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-lg font-semibold tracking-tight">Laboratorio y calidad</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configuración compartida por logística, laboratorio y calidad.
              Los cambios aquí se aplican a las órdenes de carga/descarga desde{" "}
              <Link to="/operativa" className="text-primary underline">Operativa</Link>,{" "}
              <Link to="/calendario" className="text-primary underline">Calendario</Link> y{" "}
              <Link to="/trabajos" className="text-primary underline">Trabajos</Link>.
            </p>
          </div>
        </div>
      </div>

      {isGlobal ? (
        <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground" style={{ borderColor: "var(--border)" }}>
          Selecciona un centro concreto para editar sus procesos y plantillas.
        </div>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="procesos" className="gap-1.5">
              <Truck className="size-3.5" /> Procesos documentales
            </TabsTrigger>
            <TabsTrigger value="plantillas" className="gap-1.5">
              <ClipboardList className="size-3.5" /> Plantillas analíticas
            </TabsTrigger>
          </TabsList>
          <TabsContent value="procesos" className="mt-3">
            <ProcesosDocumentalesTab bodegaId={bodegaId} />
          </TabsContent>
          <TabsContent value="plantillas" className="mt-3">
            <PlantillasAnaliticaTab bodegaId={bodegaId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
