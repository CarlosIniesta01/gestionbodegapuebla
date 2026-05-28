import { useCallback, useSyncExternalStore } from "react";
import { ESTADO_META, getDepositoColor as baseGetDepositoColor, type DepositoEstado } from "./bodega-data";

const STORAGE_KEY = "vinea:colors:v1";

interface ColorSettings {
  estados: Partial<Record<DepositoEstado, string>>;
  variedades: Record<string, string>; // key: contenido (case-insensitive lookup via normalize)
}

const EMPTY: ColorSettings = { estados: {}, variedades: {} };

function loadInitial(): ColorSettings {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        estados: parsed?.estados ?? {},
        variedades: parsed?.variedades ?? {},
      };
    }
  } catch { /* ignore */ }
  return EMPTY;
}

let state: ColorSettings = loadInitial();
const listeners = new Set<() => void>();

function emit() { for (const l of listeners) l(); }
function persist() {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}
function setState(updater: (s: ColorSettings) => ColorSettings) {
  state = updater(state);
  persist();
  emit();
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      const parsed = JSON.parse(e.newValue);
      state = { estados: parsed?.estados ?? {}, variedades: parsed?.variedades ?? {} };
      emit();
    } catch { /* ignore */ }
  });
}

function subscribe(cb: () => void) { listeners.add(cb); return () => listeners.delete(cb); }
function getSnapshot() { return state; }
function getServerSnapshot() { return EMPTY; }

function normKey(s: string) { return s.trim().toLowerCase(); }

export function useColorSettings() {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const getEstadoColor = useCallback((estado: DepositoEstado) => {
    return settings.estados[estado] ?? ESTADO_META[estado].color;
  }, [settings]);

  const getEstadoMeta = useCallback((estado: DepositoEstado) => {
    return { label: ESTADO_META[estado].label, color: getEstadoColor(estado) };
  }, [getEstadoColor]);

  const getDepositoColor = useCallback((deposito: { estado: DepositoEstado; contenido?: string | null }) => {
    // Variedad override has top priority when content matches
    if (deposito.contenido) {
      const override = settings.variedades[normKey(deposito.contenido)];
      if (override) return override;
    }
    // Estado override (vacío/limpieza/incidencia or any state with no content)
    if (!deposito.contenido || deposito.estado === "vacio" || deposito.estado === "limpieza" || deposito.estado === "incidencia") {
      return getEstadoColor(deposito.estado);
    }
    return baseGetDepositoColor(deposito);
  }, [settings, getEstadoColor]);

  const setEstadoColor = useCallback((estado: DepositoEstado, color: string | null) => {
    setState((s) => {
      const next = { ...s.estados };
      if (color) next[estado] = color; else delete next[estado];
      return { ...s, estados: next };
    });
  }, []);

  const setVariedadColor = useCallback((contenido: string, color: string | null) => {
    const k = normKey(contenido);
    setState((s) => {
      const next = { ...s.variedades };
      if (color) next[k] = color; else delete next[k];
      return { ...s, variedades: next };
    });
  }, []);

  const resetColors = useCallback(() => setState(() => EMPTY), []);

  return {
    settings,
    getEstadoColor,
    getEstadoMeta,
    getDepositoColor,
    setEstadoColor,
    setVariedadColor,
    resetColors,
  };
}

export function variedadKey(contenido: string) { return normKey(contenido); }
