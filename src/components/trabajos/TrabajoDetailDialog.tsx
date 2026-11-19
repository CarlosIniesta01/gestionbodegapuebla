import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrabajadoresTab } from "./TrabajadoresTab";
import { ConsumosTab } from "./ConsumosTab";
import { ProgramacionTab } from "./ProgramacionTab";
import { ProductosOrden } from "./ProductosOrden";
import { useActiveBodega } from "@/hooks/use-active-bodega";

export function TrabajoDetailDialog({
  open, onOpenChange, trabajoId, trabajoTitulo, bodegaId: centroTrabajo,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trabajoId: string;
  trabajoTitulo: string;
  /** Centro guardado en el trabajo (no el centro activo). */
  bodegaId?: string | null;
}) {
  const { bodegaId: activo } = useActiveBodega();
  const bodegaId = centroTrabajo ?? activo;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{trabajoTitulo}</DialogTitle>
        </DialogHeader>
        {bodegaId && (
          <Tabs defaultValue="trabajadores">
            <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full h-auto">
              <TabsTrigger value="trabajadores">Trabajadores</TabsTrigger>
              <TabsTrigger value="programacion">Programación</TabsTrigger>
              <TabsTrigger value="consumos">Consumos</TabsTrigger>
              <TabsTrigger value="productos">Productos</TabsTrigger>
            </TabsList>
            <TabsContent value="trabajadores" className="mt-3">
              <TrabajadoresTab bodegaId={bodegaId} trabajoId={trabajoId} />
            </TabsContent>
            <TabsContent value="programacion" className="mt-3">
              <ProgramacionTab bodegaId={bodegaId} trabajoId={trabajoId} />
            </TabsContent>
            <TabsContent value="consumos" className="mt-3">
              <ConsumosTab bodegaId={bodegaId} trabajoId={trabajoId} />
            </TabsContent>
            <TabsContent value="productos" className="mt-3"><ProductosOrden trabajoId={trabajoId} /></TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
