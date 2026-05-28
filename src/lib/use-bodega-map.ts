import { useCallback, useSyncExternalStore } from "react";
import {
  DEPOSITOS_INICIALES,
  ZONAS_INICIALES,
  type Deposito,
  type DepositoEstado,
  type Zona,
} from "./bodega-data";

const STORAGE_KEY = "vinea:map:v1";

interface MapState {
  zonas: Zona[];
  depositos: Deposito[];
}

// ---------- Shared module-level store ----------
// Hydrate SYNCHRONOUSLY at module load so any setState that may run before a
// useEffect would have fired never overwrites saved data with defaults.
function loadInitial(): MapState {
  if (typeof window === "undefined") {
    return { zonas: ZONAS_INICIALES, depositos: DEPOSITOS_INICIALES };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MapState;
      if (Array.isArray(parsed?.zonas) && Array.isArray(parsed?.depositos)) {
        return parsed;
      }
    }
  } catch {
    /* ignore */
  }
  return { zonas: ZONAS_INICIALES, depositos: DEPOSITOS_INICIALES };
}

let state: MapState = loadInitial();
let hydrated = typeof window !== "undefined";
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function persist() {
  // Guard: never write to storage until we've loaded from it.
  if (typeof window === "undefined" || !hydrated) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota errors */
  }
}

function setState(updater: (s: MapState) => MapState) {
  state = updater(state);
  persist();
  emit();
}

// Cross-tab sync (only in browser)
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      const parsed = JSON.parse(e.newValue) as MapState;
      if (Array.isArray(parsed?.zonas) && Array.isArray(parsed?.depositos)) {
        state = parsed;
        emit();
      }
    } catch {
      /* ignore */
    }
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return state;
}

const SSR_SNAPSHOT: MapState = { zonas: ZONAS_INICIALES, depositos: DEPOSITOS_INICIALES };
function getServerSnapshot(): MapState {
  return SSR_SNAPSHOT;
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------- Hook ----------
export function useBodegaMap() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const moveDeposito = useCallback((id: string, x: number, y: number) => {
    setState((s) => ({
      ...s,
      depositos: s.depositos.map((d) => (d.id === id ? { ...d, pos_x: x, pos_y: y } : d)),
    }));
  }, []);

  const updateDeposito = useCallback((id: string, patch: Partial<Deposito>) => {
    setState((s) => ({
      ...s,
      depositos: s.depositos.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    }));
  }, []);

  const deleteDeposito = useCallback((id: string) => {
    setState((s) => ({ ...s, depositos: s.depositos.filter((d) => d.id !== id) }));
  }, []);

  const addDeposito = useCallback((zona_id: string, codigo: string, capacidad: number) => {
    const id = uid("d");
    const zona = state.zonas.find((z) => z.id === zona_id);
    const pos = zona
      ? { x: zona.pos_x + zona.ancho / 2, y: zona.pos_y + zona.alto / 2 }
      : { x: 200, y: 200 };
    const nuevo: Deposito = {
      id,
      zona_id,
      codigo,
      capacidad,
      litros: 0,
      estado: "vacio",
      pos_x: pos.x,
      pos_y: pos.y,
      radio: 24,
    };
    setState((s) => ({ ...s, depositos: [...s.depositos, nuevo] }));
    return id;
  }, []);

  const moveZona = useCallback((id: string, x: number, y: number) => {
    setState((s) => {
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
  }, []);

  const updateZona = useCallback((id: string, patch: Partial<Zona>) => {
    setState((s) => ({
      ...s,
      zonas: s.zonas.map((z) => (z.id === id ? { ...z, ...patch } : z)),
    }));
  }, []);

  const deleteZona = useCallback((id: string) => {
    setState((s) => ({
      zonas: s.zonas.filter((z) => z.id !== id),
      depositos: s.depositos.filter((d) => d.zona_id !== id),
    }));
  }, []);

  const addZona = useCallback((nombre: string, corto: string, color: string) => {
    const id = uid("z");
    const nueva: Zona = {
      id, nombre, corto, color,
      pos_x: 60, pos_y: 60, ancho: 320, alto: 200,
    };
    setState((s) => ({ ...s, zonas: [...s.zonas, nueva] }));
    return id;
  }, []);

  const setEstado = useCallback((id: string, estado: DepositoEstado) => {
    updateDeposito(id, { estado });
  }, [updateDeposito]);

  const resetMap = useCallback(() => {
    setState(() => ({ zonas: ZONAS_INICIALES, depositos: DEPOSITOS_INICIALES }));
  }, []);

  return {
    zonas: snap.zonas,
    depositos: snap.depositos,
    hydrated: isHydrated,
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
