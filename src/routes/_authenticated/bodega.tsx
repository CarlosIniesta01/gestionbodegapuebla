import { createFileRoute } from "@tanstack/react-router";
import { BodegaCanvas } from "@/components/BodegaCanvas";
import { BodegaListEditor } from "@/components/BodegaListEditor";
import { BodegaHistorial } from "@/components/BodegaHistorial";
import { ColorSettings } from "@/components/ColorSettings";
import { MovimientosTab } from "@/components/MovimientosTab";
import { ExistenciasTab } from "@/components/ExistenciasTab";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useActiveBodega } from "@/hooks/use-active-bodega";
import { CentroHeader } from "@/components/CentroHeader";

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
  const { bodegas, isLoading, bodegaId } = useActiveBodega();

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
    <div className="p-3 md:p-4 max-w-[1600px] mx-auto space-y-4">
      <CentroHeader showResumen={false} />

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
          <BodegaCanvas key={bodegaId} bodegaId={bodegaId} />
        </TabsContent>
        <TabsContent value="lista">
          <BodegaListEditor key={bodegaId} bodegaId={bodegaId} />
        </TabsContent>
        <TabsContent value="movimientos">
          {bodegaId && <MovimientosTab key={bodegaId} bodegaId={bodegaId} />}
        </TabsContent>
        <TabsContent value="existencias">
          {bodegaId && <ExistenciasTab key={bodegaId} bodegaId={bodegaId} />}
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
