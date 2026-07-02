import type { InformeConfig, Profile } from "./profiles";

const LS_KEY = "vinea.informes.customProfiles.v1";

export type CustomProfile = Profile & { builtin?: false; createdAt: string };

export function loadCustomProfiles(): CustomProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export function saveCustomProfile(label: string, config: InformeConfig): CustomProfile {
  const list = loadCustomProfiles();
  const profile: CustomProfile = {
    id: `custom-${Date.now()}`,
    label: label.trim() || `Perfil ${list.length + 1}`,
    config,
    createdAt: new Date().toISOString(),
  };
  const next = [profile, ...list];
  window.localStorage.setItem(LS_KEY, JSON.stringify(next));
  return profile;
}

export function deleteCustomProfile(id: string): CustomProfile[] {
  const next = loadCustomProfiles().filter((p) => p.id !== id);
  window.localStorage.setItem(LS_KEY, JSON.stringify(next));
  return next;
}
