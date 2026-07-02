import * as React from "react";
import { Check, Save, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BLOCKS, CATEGORIES, type BlockCategory } from "@/lib/informes/blocks";
import type { InformeConfig } from "@/lib/informes/profiles";
import type { CustomProfile } from "@/lib/informes/storage";

export function BlockConfigurator({
  config, setConfig, customProfiles, onSaveProfile, onDeleteProfile, onLoadProfile,
}: {
  config: InformeConfig;
  setConfig: (next: InformeConfig) => void;
  customProfiles: CustomProfile[];
  onSaveProfile: (label: string) => void;
  onDeleteProfile: (id: string) => void;
  onLoadProfile: (id: string) => void;
}) {
  const [newName, setNewName] = React.useState("");

  const toggle = (id: string, v: boolean) => setConfig({ ...config, [id]: v });

  const toggleCategory = (cat: BlockCategory, v: boolean) => {
    const next = { ...config };
    for (const b of BLOCKS.filter((b) => b.category === cat)) next[b.id] = v;
    setConfig(next);
  };

  const activeCount = Object.values(config).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Constructor de informe</div>
          <div className="text-xs text-muted-foreground">
            {activeCount} bloques activos · la vista previa se actualiza al instante.
          </div>
        </div>
      </div>

      {/* Perfiles guardados */}
      {customProfiles.length > 0 && (
        <div className="rounded-md border border-border p-3 space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Mis perfiles guardados</div>
          <div className="flex flex-wrap gap-2">
            {customProfiles.map((p) => (
              <div key={p.id} className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1">
                <button className="text-xs" onClick={() => onLoadProfile(p.id)} title="Cargar">
                  {p.label}
                </button>
                <button
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => onDeleteProfile(p.id)}
                  title="Eliminar"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">Guardar configuración actual como…</Label>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ej: Cliente Alemania"
          />
        </div>
        <Button
          size="sm"
          onClick={() => { if (newName.trim()) { onSaveProfile(newName.trim()); setNewName(""); } }}
          disabled={!newName.trim()}
          className="gap-1"
        >
          <Save className="size-3.5" /> Guardar
        </Button>
      </div>

      <ScrollArea className="h-[520px] pr-3">
        <div className="space-y-4">
          {CATEGORIES.map((cat) => {
            const blocks = BLOCKS.filter((b) => b.category === cat.key);
            const allOn = blocks.every((b) => config[b.id]);
            return (
              <div key={cat.key} className="rounded-lg border border-border">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {cat.label}
                  </div>
                  <button
                    className="text-[11px] text-primary hover:underline"
                    onClick={() => toggleCategory(cat.key, !allOn)}
                  >
                    {allOn ? "Desactivar todo" : "Activar todo"}
                  </button>
                </div>
                <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {blocks.map((b) => (
                    <label
                      key={b.id}
                      className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50 cursor-pointer text-sm"
                    >
                      <Checkbox
                        checked={!!config[b.id]}
                        onCheckedChange={(v) => toggle(b.id, !!v)}
                      />
                      <span className="flex-1">{b.label}</span>
                      {b.requiresRole && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0">Rol</Badge>
                      )}
                      {b.sensible && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0">Sensible</Badge>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

export function ProfilePicker({
  profiles, activeId, onPick,
}: {
  profiles: { id: string; label: string; description?: string }[];
  activeId?: string;
  onPick: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
      {profiles.map((p) => {
        const active = p.id === activeId;
        return (
          <button
            key={p.id}
            onClick={() => onPick(p.id)}
            className={`text-left rounded-lg border p-3 transition ${
              active ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{p.label}</span>
              {active && <Check className="size-4 text-primary" />}
            </div>
            {p.description && (
              <div className="text-[11px] text-muted-foreground mt-1 leading-snug">{p.description}</div>
            )}
          </button>
        );
      })}
    </div>
  );
}
