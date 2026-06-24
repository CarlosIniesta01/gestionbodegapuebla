import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyBodegas } from "@/lib/api/admin.functions";
import { supabase } from "@/integrations/supabase/client";

export type BodegaInfo = { id: string; nombre: string; ubicacion?: string };
export type Membership = {
  bodega_id: string;
  role_key: string;
  role_nombre: string;
  bodega: BodegaInfo;
};
export type ViewMode = "centro" | "global";

type Ctx = {
  bodegas: Membership[];
  bodegaId?: string;
  bodega?: BodegaInfo;
  setActiveBodegaId: (id: string) => void;
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  isGlobal: boolean;
  isLoading: boolean;
};

const ActiveBodegaContext = createContext<Ctx | null>(null);
const LS_BODEGA = "vinea.activeBodegaId";
const LS_VIEW = "vinea.viewMode";

export function ActiveBodegaProvider({ children }: { children: ReactNode }) {
  const fn = useServerFn(listMyBodegas);
  const q = useQuery({
    queryKey: ["my-bodegas"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw error ?? new Error("Sesión no válida");
      return fn();
    },
    staleTime: 60_000,
    retry: false,
  });
  const bodegas = (q.data ?? []) as Membership[];

  const [activeId, setActiveId] = useState<string | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    return localStorage.getItem(LS_BODEGA) ?? undefined;
  });
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "centro";
    return (localStorage.getItem(LS_VIEW) as ViewMode) || "centro";
  });

  // Reconciliar con membresías
  useEffect(() => {
    if (!bodegas.length) return;
    if (!activeId || !bodegas.find((b) => b.bodega_id === activeId)) {
      const id = bodegas[0].bodega_id;
      setActiveId(id);
      try { localStorage.setItem(LS_BODEGA, id); } catch {}
    }
  }, [bodegas, activeId]);

  const setActiveBodegaId = (id: string) => {
    setActiveId(id);
    try { localStorage.setItem(LS_BODEGA, id); } catch {}
  };
  const setViewMode = (m: ViewMode) => {
    setViewModeState(m);
    try { localStorage.setItem(LS_VIEW, m); } catch {}
  };

  const active = bodegas.find((b) => b.bodega_id === activeId) ?? bodegas[0];

  const value = useMemo<Ctx>(() => ({
    bodegas,
    bodegaId: active?.bodega_id,
    bodega: active?.bodega,
    setActiveBodegaId,
    viewMode,
    setViewMode,
    isGlobal: viewMode === "global",
    isLoading: q.isLoading,
  }), [bodegas, active, viewMode, q.isLoading]);

  return (
    <ActiveBodegaContext.Provider value={value}>
      {children}
    </ActiveBodegaContext.Provider>
  );
}

export function useActiveBodegaContext(): Ctx {
  const ctx = useContext(ActiveBodegaContext);
  if (!ctx) {
    // Fallback inocuo cuando se usa fuera del provider (ej. login)
    return {
      bodegas: [], bodegaId: undefined, bodega: undefined,
      setActiveBodegaId: () => {}, viewMode: "centro", setViewMode: () => {},
      isGlobal: false, isLoading: false,
    };
  }
  return ctx;
}
