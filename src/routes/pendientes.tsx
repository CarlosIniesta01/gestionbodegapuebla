import { createFileRoute } from "@tanstack/react-router";
import { ListTodo } from "lucide-react";

export const Route = createFileRoute("/pendientes")({
  head: () => ({ meta: [{ title: "Pendientes · Vinea Control" }] }),
  component: () => <Placeholder title="Pendientes" desc="Tareas asignadas por el enólogo aparecerán aquí." />,
});

function Placeholder({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto">
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">{title}</div>
      <h1 className="text-2xl md:text-3xl font-display font-semibold tracking-tight mb-3">{title}</h1>
      <p className="text-muted-foreground">{desc}</p>
      <div className="scada-panel mt-6 p-10 text-center text-muted-foreground">
        <ListTodo className="size-10 mx-auto mb-3 opacity-50" />
        Pantalla en construcción · próximamente con datos en tiempo real
      </div>
    </div>
  );
}
