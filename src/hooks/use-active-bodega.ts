import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyBodegas } from "@/lib/api/admin.functions";
import { supabase } from "@/integrations/supabase/client";

export function useActiveBodega() {
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
  const bodegas = q.data ?? [];
  const active = bodegas[0] ?? null;
  return {
    bodegaId: active?.bodega_id as string | undefined,
    bodega: active?.bodega as { id: string; nombre: string; ubicacion?: string } | undefined,
    bodegas,
    isLoading: q.isLoading,
  };
}
