import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  BUILTIN_ESTADOS,
  ESTADO_META,
  getDepositoColor as baseGetDepositoColor,
  type DepositoEstado,
} from "./bodega-data";

const STORAGE_KEY = "vinea:colors:v2";

interface CustomEstado {
  key: string;
  label: string;
  color: string;
}

interface ColorSettings {
  estados: Record<string, string>;       // color overrides (builtin + custom keys)
  labels: Record<string, string>;        // label overrides (builtin) / labels for custom
  customEstados: CustomEstado[];         // user-added estados
  hiddenBuiltins: string[];              // builtins hidden from menus
  variedades: Record<string, string>;    // contenido -> color
}

const EMPTY: ColorSettings = {
  estados: {},
  labels: {},
  customEstados: [],
  hiddenBuiltins: [],
  variedades: {},
};

function loadInitial(): ColorSettings {
  if (typeof window === "undefined") return EMPTY;
  try {
    // migrate from v1 if present
    const v2 = localStorage.getItem(STORAGE_KEY);
    if (v2) {
      const p = JSON.parse(v2);
      return {
        estados: p?.estados ?? {},
        labels: p?.labels ?? {},
        customEstados: Array.isArray(p?.customEstados) ? p.customEstados : [],
        hiddenBuiltins: Array.isArray(p?.hiddenBuiltins) ? p.hiddenBuiltins : [],
        variedades: p?.variedades ?? {},
      };
    }
    const v1 = localStorage.getItem("vinea:colors:v1");
    if (v1) {
      const p = JSON.parse(v1);
      return { ...EMPTY, estados: p?.estados ?? {}, variedades: p?.variedades ?? {} };
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
      const p = JSON.parse(e.newValue);
      state = {
        estados: p?.estados ?? {},
        labels: p?.labels ?? {},
        customEstados: Array.isArray(p?.customEstados) ? p.customEstados : [],
        hiddenBuiltins: Array.isArray(p?.hiddenBuiltins) ? p.hiddenBuiltins : [],
        variedades: p?.variedades ?? {},
      };
      emit();
    } catch { /* ignore */ }
  });
}

function subscribe(cb: () => void) { listeners.add(cb); return () => listeners.delete(cb); }
function getSnapshot() { return state; }
function getServerSnapshot() { return EMPTY; }

function normKey(s: string) { return s.trim().toLowerCase(); }
function slugify(s: string) {
  return s.trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
    .slice(0, 32) || `e_${Math.random().toString(36).slice(2, 6)}`;
}

const FALLBACK_COLOR = "oklch(0.55 0.015 250)";

export function useColorSettings() {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const customMap = useMemo(() => {
    const m = new Map<string, CustomEstado>();
    for (const c of settings.customEstados) m.set(c.key, c);
    return m;
  }, [settings.customEstados]);

  const getEstadoMeta = useCallback((estado: DepositoEstado) => {
    const labelOverride = settings.labels[estado];
    const colorOverride = settings.estados[estado];
    const custom = customMap.get(estado);
    if (custom) {
      return {
        label: labelOverride ?? custom.label,
        color: colorOverride ?? custom.color,
      };
    }
    const base = ESTADO_META[estado];
    return {
      label: labelOverride ?? base?.label ?? estado,
      color: colorOverride ?? base?.color ?? FALLBACK_COLOR,
    };
  }, [settings, customMap]);

  const getEstadoColor = useCallback((estado: DepositoEstado) => {
    return getEstadoMeta(estado).color;
  }, [getEstadoMeta]);

  const getAllEstados = useCallback(() => {
    const hidden = new Set(settings.hiddenBuiltins);
    const list: Array<{ key: string; label: string; color: string; builtin: boolean }> = [];
    for (const k of BUILTIN_ESTADOS) {
      if (hidden.has(k)) continue;
      const m = getEstadoMeta(k);
      list.push({ key: k, label: m.label, color: m.color, builtin: true });
    }
    for (const c of settings.customEstados) {
      const m = getEstadoMeta(c.key);
      list.push({ key: c.key, label: m.label, color: m.color, builtin: false });
    }
    return list;
  }, [settings, getEstadoMeta]);

  const getDepositoColor = useCallback((deposito: { estado: DepositoEstado; contenido?: string | null }) => {
    if (deposito.contenido) {
      const override = settings.variedades[normKey(deposito.contenido)];
      if (override) return override;
    }
    // For built-in "neutral" states or no content, use estado color
    if (!deposito.contenido
      || deposito.estado === "vacio"
      || deposito.estado === "limpieza"
      || deposito.estado === "incidencia"
      || customMap.has(deposito.estado)
      || settings.estados[deposito.estado]) {
      return getEstadoColor(deposito.estado);
    }
    return baseGetDepositoColor(deposito);
  }, [settings, customMap, getEstadoColor]);

  const setEstadoColor = useCallback((estado: DepositoEstado, color: string | null) => {
    setState((s) => {
      const next = { ...s.estados };
      if (color) next[estado] = color; else delete next[estado];
      return { ...s, estados: next };
    });
  }, []);

  const setEstadoLabel = useCallback((estado: DepositoEstado, label: string | null) => {
    setState((s) => {
      // custom: persist on custom entry too
      const customs = s.customEstados.map((c) =>
        c.key === estado && label ? { ...c, label } : c,
      );
      const next = { ...s.labels };
      if (label && label.trim()) next[estado] = label.trim(); else delete next[estado];
      return { ...s, labels: next, customEstados: customs };
    });
  }, []);

  const addCustomEstado = useCallback((label: string, color: string) => {
    const trimmed = label.trim();
    if (!trimmed) return null;
    const base = slugify(trimmed);
    let key = base;
    let i = 2;
    const taken = new Set<string>([
      ...BUILTIN_ESTADOS,
      ...state.customEstados.map((c) => c.key),
    ]);
    while (taken.has(key)) key = `${base}_${i++}`;
    setState((s) => ({
      ...s,
      customEstados: [...s.customEstados, { key, label: trimmed, color }],
    }));
    return key;
  }, []);

  const removeEstado = useCallback((estado: DepositoEstado) => {
    setState((s) => {
      const isBuiltin = (BUILTIN_ESTADOS as readonly string[]).includes(estado);
      if (isBuiltin) {
        if (s.hiddenBuiltins.includes(estado)) return s;
        return { ...s, hiddenBuiltins: [...s.hiddenBuiltins, estado] };
      }
      return {
        ...s,
        customEstados: s.customEstados.filter((c) => c.key !== estado),
        estados: Object.fromEntries(Object.entries(s.estados).filter(([k]) => k !== estado)),
        labels: Object.fromEntries(Object.entries(s.labels).filter(([k]) => k !== estado)),
      };
    });
  }, []);

  const restoreBuiltin = useCallback((estado: string) => {
    setState((s) => ({ ...s, hiddenBuiltins: s.hiddenBuiltins.filter((k) => k !== estado) }));
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
    getAllEstados,
    getEstadoColor,
    getEstadoMeta,
    getDepositoColor,
    setEstadoColor,
    setEstadoLabel,
    addCustomEstado,
    removeEstado,
    restoreBuiltin,
    setVariedadColor,
    resetColors,
  };
}

export function variedadKey(contenido: string) { return normKey(contenido); }
