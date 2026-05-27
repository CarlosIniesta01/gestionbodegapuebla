import { createFileRoute } from "@tanstack/react-router";
import { BodegaCanvas } from "@/components/BodegaCanvas";

export const Route = createFileRoute("/bodega")({
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
      <BodegaCanvas />
    </div>
  );
}
