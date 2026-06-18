import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TrabajadoresTab } from "./TrabajadoresTab";
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
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Trabajadores</div>
        </DialogHeader>
        {bodegaId && <TrabajadoresTab bodegaId={bodegaId} trabajoId={trabajoId} />}
      </DialogContent>
    </Dialog>
  );
}
