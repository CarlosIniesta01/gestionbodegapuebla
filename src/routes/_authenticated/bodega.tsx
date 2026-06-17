import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BodegaCanvas } from "@/components/BodegaCanvas";
import { BodegaListEditor } from "@/components/BodegaListEditor";
import { BodegaHistorial } from "@/components/BodegaHistorial";
import { ColorSettings } from "@/components/ColorSettings";
import { MovimientosTab } from "@/components/MovimientosTab";
import { ExistenciasTab } from "@/components/ExistenciasTab";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useActiveBodega } from "@/hooks/use-active-bodega";

export const Route = createFileRoute("/_authenticated/bodega")({
  head: () => ({
    meta: [
      { title: "Mapa de bodega · Vinea Control" },
      { name: "description", content: "Mapa operativo en tiempo real de la bodega." },
    ],
  }),
  component: Bodega,
});

function Bodega() {
  const { bodegas, isLoading } = useActiveBodega();
  const [activeBodegaId, setActiveBodegaId] = useState<string | undefined>();

  useEffect(() => {
    if (!activeBodegaId && bodegas.length) {
      setActiveBodegaId(bodegas[0].bodega_id);
    }
  }, [bodegas, activeBodegaId]);

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Cargando…</div>;
  }
  if (!bodegas.length) {
    return (
      <div className="p-6 text-muted-foreground">
        No tienes ninguna bodega. Crea una desde <span className="font-medium text-foreground">Admin</span>.
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 max-w-[1600px] mx-auto">
      {bodegas.length > 1 && (
        <Tabs
          value={activeBodegaId}
          onValueChange={setActiveBodegaId}
          className="mb-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Bodega</span>
          </div>
          <TabsList className="flex flex-wrap h-auto">
            {bodegas.map((b) => (
              <TabsTrigger key={b.bodega_id} value={b.bodega_id}>
                {b.bodega.nombre}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      <Tabs defaultValue="mapa" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="mapa">Mapa</TabsTrigger>
          <TabsTrigger value="lista">Lista / Edición</TabsTrigger>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
          <TabsTrigger value="existencias">Existencias</TabsTrigger>
          
          <TabsTrigger value="historial">Historial</TabsTrigger>
          <TabsTrigger value="colores">Colores</TabsTrigger>
        </TabsList>
        <TabsContent value="mapa">
          <BodegaCanvas key={activeBodegaId} bodegaId={activeBodegaId} />
        </TabsContent>
        <TabsContent value="lista">
          <BodegaListEditor key={activeBodegaId} bodegaId={activeBodegaId} />
        </TabsContent>
        <TabsContent value="movimientos">
          {activeBodegaId && <MovimientosTab key={activeBodegaId} bodegaId={activeBodegaId} />}
        </TabsContent>
        <TabsContent value="existencias">
          {activeBodegaId && <ExistenciasTab key={activeBodegaId} bodegaId={activeBodegaId} />}
        </TabsContent>
        <TabsContent value="historial">
          <BodegaHistorial />
        </TabsContent>
        <TabsContent value="colores">
          <ColorSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
