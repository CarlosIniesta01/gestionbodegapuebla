import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send, Hash, Boxes, Hammer } from "lucide-react";
import { toast } from "sonner";

import { listMensajes, sendMensaje } from "@/lib/api/mensajes.functions";
import { useActiveBodega } from "@/hooks/use-active-bodega";
import { useBodegaMap } from "@/lib/use-bodega-map";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/mensajes")({
  head: () => ({ meta: [{ title: "Mensajes · Vinea Control" }] }),
  component: Mensajes,
});

type Canal = "general" | "deposito" | "trabajo";

function Mensajes() {
  const { bodegaId, isLoading } = useActiveBodega();
  const { depositos } = useBodegaMap();
  const [canal, setCanal] = React.useState<Canal>("general");
  const [canalRef, setCanalRef] = React.useState<string>("");
  const [texto, setTexto] = React.useState("");
  const qc = useQueryClient();
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const fnList = useServerFn(listMensajes);
  const fnSend = useServerFn(sendMensaje);

  const effectiveRef = canal === "general" ? null : (canalRef || null);
  const queryKey = ["mensajes", bodegaId, canal, effectiveRef];

  const q = useQuery({
    queryKey,
    queryFn: () => fnList({ data: { bodegaId: bodegaId!, canal, canalRef: effectiveRef } }),
    enabled: !!bodegaId && (canal === "general" || !!effectiveRef),
  });

  React.useEffect(() => {
    if (!bodegaId) return;
    const ch = supabase.channel(`mensajes:${bodegaId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mensajes", filter: `bodega_id=eq.${bodegaId}` },
        () => qc.invalidateQueries({ queryKey: ["mensajes"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [bodegaId, qc]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [q.data?.length]);

  const send = useMutation({
    mutationFn: fnSend,
    onSuccess: () => { setTexto(""); qc.invalidateQueries({ queryKey: ["mensajes"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-6 text-muted-foreground">Cargando…</div>;
  if (!bodegaId) return <div className="p-6 text-muted-foreground">No tienes acceso a ninguna bodega.</div>;

  const canEnviar = canal === "general" || !!effectiveRef;
  const mensajes = q.data ?? [];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim() || !canEnviar) return;
    send.mutate({ data: { bodegaId: bodegaId!, canal, canalRef: effectiveRef, contenido: texto.trim() } });
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen max-w-3xl mx-auto p-3 md:p-4">
      <div className="mb-3">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Mensajes</div>
        <h1 className="text-2xl md:text-3xl font-display font-semibold tracking-tight">Chat interno</h1>
      </div>

      <Tabs value={canal} onValueChange={(v) => { setCanal(v as Canal); setCanalRef(""); }}>
        <TabsList>
          <TabsTrigger value="general"><Hash className="size-3.5 mr-1" />General</TabsTrigger>
          <TabsTrigger value="deposito"><Boxes className="size-3.5 mr-1" />Depósito</TabsTrigger>
          <TabsTrigger value="trabajo"><Hammer className="size-3.5 mr-1" />Trabajo</TabsTrigger>
        </TabsList>
      </Tabs>

      {canal === "deposito" && (
        <div className="mt-2">
          <Select value={canalRef} onValueChange={setCanalRef}>
            <SelectTrigger><SelectValue placeholder="Elige un depósito…" /></SelectTrigger>
            <SelectContent>
              {depositos.map((d) => <SelectItem key={d.id} value={d.codigo}>{d.codigo}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      {canal === "trabajo" && (
        <div className="mt-2">
          <Input value={canalRef} onChange={(e) => setCanalRef(e.target.value)} placeholder="ID del trabajo (cópialo desde la pestaña Trabajos)" />
        </div>
      )}

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto scada-panel p-3 my-3 space-y-2">
        {!canEnviar ? (
          <div className="text-center text-muted-foreground py-10">Elige un {canal} para ver los mensajes.</div>
        ) : mensajes.length === 0 ? (
          <div className="text-center text-muted-foreground py-10">Sin mensajes todavía. Escribe el primero.</div>
        ) : (
          mensajes.map((m: any) => (
            <div key={m.id} className="flex flex-col gap-0.5">
              <div className="text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">{m.autor?.nombre ?? "Usuario"}</span>
                {" · "}{new Date(m.created_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}
              </div>
              <div className="text-sm bg-muted/50 px-3 py-2 rounded-lg max-w-[85%]">{m.contenido}</div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={submit} className="flex items-center gap-2">
        <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={canEnviar ? "Escribe un mensaje…" : "Selecciona un canal"} maxLength={2000} disabled={!canEnviar} />
        <Button type="submit" disabled={!canEnviar || !texto.trim() || send.isPending}><Send className="size-4" /></Button>
      </form>
    </div>
  );
}
