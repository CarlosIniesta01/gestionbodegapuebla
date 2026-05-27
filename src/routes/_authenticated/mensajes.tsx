import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";

export const Route = createFileRoute("/_authenticated/mensajes")({
  head: () => ({ meta: [{ title: "Mensajes · Vinea Control" }] }),
  component: () => (
    <div className="p-6 md:p-10 max-w-3xl mx-auto">
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Mensajes</div>
      <h1 className="text-2xl md:text-3xl font-display font-semibold tracking-tight mb-3">Chat interno</h1>
      <p className="text-muted-foreground">Chats por tarea, depósito y grupos de bodega.</p>
      <div className="scada-panel mt-6 p-10 text-center text-muted-foreground">
        <MessageSquare className="size-10 mx-auto mb-3 opacity-50" />
        Próximamente
      </div>
    </div>
  ),
});
