import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, FileText, ShoppingCart, Users, Truck } from "lucide-react";
import { ContratosTab } from "@/components/contratos/ContratosTab";
import { PartesTab } from "@/components/contratos/PartesTab";
import { useActiveBodega } from "@/hooks/use-active-bodega";
import { getAlertasContratos } from "@/lib/api/contratos.functions";

export const Route = createFileRoute("/_authenticated/contratos")({
  head: () => ({ meta: [{ title: "Contratos · Vinea Control" }] }),
  component: ContratosPage,
});

type Tab = "compra" | "venta" | "clientes" | "proveedores";

function ContratosPage() {
  const { bodegaId } = useActiveBodega();
  const [tab, setTab] = useState<Tab>("compra");
  const alertsFn = useServerFn(getAlertasContratos);
  const alertsQ = useQuery({
    queryKey: ["alertas-contratos", bodegaId],
    queryFn: () => alertsFn({ data: { bodegaId: bodegaId! } }),
    enabled: !!bodegaId,
  });

  if (!bodegaId) {
    return <div className="p-8 text-sm text-muted-foreground">Sin bodega activa.</div>;
  }

  const alerts = alertsQ.data ?? { compras: [], ventas: [] };
  const todas = [...(alerts.compras ?? []), ...(alerts.ventas ?? [])];
  const vencidos = todas.filter((a: any) => a.vencido);
  const porVencer = todas.filter((a: any) => a.por_vencer);

  const TABS: { key: Tab; label: string; icon: any }[] = [
    { key: "compra", label: "Compras", icon: ShoppingCart },
    { key: "venta", label: "Ventas", icon: FileText },
    { key: "clientes", label: "Clientes", icon: Users },
    { key: "proveedores", label: "Proveedores", icon: Truck },
  ];

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-4">
      <div>
        <h1 className="font-display text-2xl tracking-tight">Contratos</h1>
        <p className="text-xs text-muted-foreground mt-1">Compras y ventas de vino — gestión integral.</p>
      </div>

      {(vencidos.length > 0 || porVencer.length > 0) && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-3">
          <AlertTriangle className="size-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-xs space-y-0.5">
            {vencidos.length > 0 && (
              <div><b className="text-rose-600">{vencidos.length}</b> contrato(s) vencido(s)</div>
            )}
            {porVencer.length > 0 && (
              <div><b className="text-amber-600">{porVencer.length}</b> contrato(s) próximos a vencer (30 días)</div>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs border-b-2 transition-colors ${
                active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              <Icon className="size-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "compra" && <ContratosTab bodegaId={bodegaId} tipo="compra" />}
      {tab === "venta" && <ContratosTab bodegaId={bodegaId} tipo="venta" />}
      {tab === "clientes" && <PartesTab bodegaId={bodegaId} tipo="cliente" />}
      {tab === "proveedores" && <PartesTab bodegaId={bodegaId} tipo="proveedor" />}
    </div>
  );
}
