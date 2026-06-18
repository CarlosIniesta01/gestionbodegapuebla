import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrabajadoresTab } from "./TrabajadoresTab";
import { ConsumosTab } from "./ConsumosTab";
import { useActiveBodega } from "@/hooks/use-active-bodega";

export function TrabajoDetailDialog({
  open, onOpenChange, trabajoId, trabajoTitulo,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trabajoId: string;
  trabajoTitulo: string;
}) {
  const { bodegaId } = useActiveBodega();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{trabajoTitulo}</DialogTitle>
        </DialogHeader>
        {bodegaId && (
          <Tabs defaultValue="trabajadores">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="trabajadores">Trabajadores</TabsTrigger>
              <TabsTrigger value="consumos">Consumos</TabsTrigger>
            </TabsList>
            <TabsContent value="trabajadores" className="mt-3">
              <TrabajadoresTab bodegaId={bodegaId} trabajoId={trabajoId} />
            </TabsContent>
            <TabsContent value="consumos" className="mt-3">
              <ConsumosTab bodegaId={bodegaId} trabajoId={trabajoId} />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
