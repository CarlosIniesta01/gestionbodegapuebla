import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getBodegaMap, saveBodegaMap } from "@/lib/api/bodega-map.functions";
import {
  DEPOSITOS_INICIALES,
  ZONAS_INICIALES,
  type Deposito,
  type DepositoEstado,
  type Zona,
} from "./bodega-data";

const STORAGE_PREFIX = "vinea:map:v1";
const LEGACY_KEY = "vinea:map:v1";

function storageKey(bodegaId?: string) {
  return bodegaId ? `${STORAGE_PREFIX}:${bodegaId}` : LEGACY_KEY;
}

interface MapState {
  zonas: Zona[];
  depositos: Deposito[];
}

// ---------- Per-bodega store registry ----------
interface Store {
  state: MapState;
  listeners: Set<() => void>;
  hydrated: boolean;
  key: string;
  remoteLoaded: boolean;
  lastSavedJson?: string;
}

const stores = new Map<string, Store>();

function loadFromStorage(key: string): MapState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MapState;
    if (Array.isArray(parsed?.zonas) && Array.isArray(parsed?.depositos)) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function getStore(bodegaId?: string): Store {
  const key = storageKey(bodegaId);
  let store = stores.get(key);
  if (store) return store;

  let initial: MapState | null = loadFromStorage(key);
  // Backward compat: if a per-bodega key has no data yet, fall back to the
  // legacy single-bodega key so users don't lose their first map.
  if (!initial && bodegaId) {
    initial = loadFromStorage(LEGACY_KEY);
  }
  store = {
    state: initial ?? { zonas: ZONAS_INICIALES, depositos: DEPOSITOS_INICIALES },
    listeners: new Set(),
    hydrated: typeof window !== "undefined",
    key,
    remoteLoaded: !bodegaId,
  };
  stores.set(key, store);
  return store;
}

function persist(store: Store) {
  if (typeof window === "undefined" || !store.hydrated) return;
  try {
    localStorage.setItem(store.key, JSON.stringify(store.state));
  } catch {
    /* ignore */
  }
}

function emit(store: Store) {
  for (const l of store.listeners) l();
}

function setState(store: Store, updater: (s: MapState) => MapState) {
  store.state = updater(store.state);
  persist(store);
  emit(store);
}

// Cross-tab sync
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (!e.key || !e.newValue) return;
    const store = stores.get(e.key);
    if (!store) return;
    try {
      const parsed = JSON.parse(e.newValue) as MapState;
      if (Array.isArray(parsed?.zonas) && Array.isArray(parsed?.depositos)) {
        store.state = parsed;
        emit(store);
      }
    } catch {
      /* ignore */
    }
  });
}

const SSR_SNAPSHOT: MapState = { zonas: ZONAS_INICIALES, depositos: DEPOSITOS_INICIALES };

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------- Hook ----------
export function useBodegaMap(bodegaId?: string) {
  const store = getStore(bodegaId);

  const snap = useSyncExternalStore(
    (cb) => {
      store.listeners.add(cb);
      return () => store.listeners.delete(cb);
    },
    () => store.state,
    () => SSR_SNAPSHOT,
  );

  const moveDeposito = useCallback((id: string, x: number, y: number) => {
    setState(store, (s) => ({
      ...s,
      depositos: s.depositos.map((d) => (d.id === id ? { ...d, pos_x: x, pos_y: y } : d)),
    }));
  }, [store]);

  const updateDeposito = useCallback((id: string, patch: Partial<Deposito>) => {
    setState(store, (s) => ({
      ...s,
      depositos: s.depositos.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    }));
  }, [store]);

  const deleteDeposito = useCallback((id: string) => {
    setState(store, (s) => ({ ...s, depositos: s.depositos.filter((d) => d.id !== id) }));
  }, [store]);

  const addDeposito = useCallback((zona_id: string, codigo: string, capacidad: number) => {
    const id = uid("d");
    const zona = store.state.zonas.find((z) => z.id === zona_id);
    const pos = zona
      ? { x: zona.pos_x + zona.ancho / 2, y: zona.pos_y + zona.alto / 2 }
      : { x: 200, y: 200 };
    const nuevo: Deposito = {
      id, zona_id, codigo, capacidad,
      litros: 0, estado: "vacio",
      pos_x: pos.x, pos_y: pos.y, radio: 24,
    };
    setState(store, (s) => ({ ...s, depositos: [...s.depositos, nuevo] }));
    return id;
  }, [store]);

  const moveZona = useCallback((id: string, x: number, y: number) => {
    setState(store, (s) => {
      const zona = s.zonas.find((z) => z.id === id);
      if (!zona) return s;
      const dx = x - zona.pos_x;
      const dy = y - zona.pos_y;
      return {
        zonas: s.zonas.map((z) => (z.id === id ? { ...z, pos_x: x, pos_y: y } : z)),
        depositos: s.depositos.map((d) =>
          d.zona_id === id ? { ...d, pos_x: d.pos_x + dx, pos_y: d.pos_y + dy } : d,
        ),
      };
    });
  }, [store]);

  const updateZona = useCallback((id: string, patch: Partial<Zona>) => {
    setState(store, (s) => ({
      ...s,
      zonas: s.zonas.map((z) => (z.id === id ? { ...z, ...patch } : z)),
    }));
  }, [store]);

  const deleteZona = useCallback((id: string) => {
    setState(store, (s) => ({
      zonas: s.zonas.filter((z) => z.id !== id),
      depositos: s.depositos.filter((d) => d.zona_id !== id),
    }));
  }, [store]);

  const addZona = useCallback((nombre: string, corto: string, color: string) => {
    const id = uid("z");
    const nueva: Zona = {
      id, nombre, corto, color,
      pos_x: 60, pos_y: 60, ancho: 320, alto: 200,
    };
    setState(store, (s) => ({ ...s, zonas: [...s.zonas, nueva] }));
    return id;
  }, [store]);

  const setEstado = useCallback((id: string, estado: DepositoEstado) => {
    updateDeposito(id, { estado });
  }, [updateDeposito]);

  const resetMap = useCallback(() => {
    setState(store, () => ({ zonas: ZONAS_INICIALES, depositos: DEPOSITOS_INICIALES }));
  }, [store]);

  return {
    zonas: snap.zonas,
    depositos: snap.depositos,
    hydrated: true,
    moveDeposito,
    updateDeposito,
    deleteDeposito,
    addDeposito,
    moveZona,
    updateZona,
    deleteZona,
    addZona,
    setEstado,
    resetMap,
  };
}
