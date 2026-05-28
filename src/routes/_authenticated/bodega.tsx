import { createFileRoute } from "@tanstack/react-router";
import { BodegaCanvas } from "@/components/BodegaCanvas";
import { BodegaListEditor } from "@/components/BodegaListEditor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  return (
    <div className="p-3 md:p-4 max-w-[1600px] mx-auto">
      <Tabs defaultValue="mapa" className="space-y-4">
        <TabsList>
          <TabsTrigger value="mapa">Mapa</TabsTrigger>
          <TabsTrigger value="lista">Lista / Edición</TabsTrigger>
        </TabsList>
        <TabsContent value="mapa">
          <BodegaCanvas />
        </TabsContent>
        <TabsContent value="lista">
          <BodegaListEditor />
        </TabsContent>
      </Tabs>
    </div>
  );
}
