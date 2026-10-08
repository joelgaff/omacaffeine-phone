import { useSyncExternalStore } from "react";
import {
  type Activity,
  type CustomDrink,
  type DrinkEntry,
  type DrinksConfig,
  type Log,
  cleanMg,
  cleanName,
  drink,
  emptyDrinksConfig,
  emptyLog,
  isPreset,
  preset,
} from "@/lib/model";
import { ICON_KINDS } from "@/lib/icon-paths";

export type Settings = {
  bodyWeightKg: number;
  activity: Activity;
  bedtime: string;
  dailyLimitMg: number;
  bedtimeLimitMg: number;
  imperial: boolean;
  hour12: boolean;
};

export type AppState = {
  log: Log;
  drinks: DrinksConfig;
  settings: Settings;
  tokens: Record<string, number>;
  seed: number;
  /** Session-only. Not written to storage. */
  undoId: string | null;
  page: "main" | "week" | "settings" | "drink";
  cupBody: boolean;
  pickTime: number | null;
  flash: string;
  editing: { kind: string; custom: boolean; isNew: boolean } | null;
  ready: boolean;
};

const KEY = "omacaffeine.v1";

const baseSettings = (): Settings => ({
  bodyWeightKg: 80,
  activity: "Sitting",
  bedtime: "23:00",
  dailyLimitMg: 400,
  bedtimeLimitMg: 100,
  imperial: false,
  hour12: false,
});

function fresh(): AppState {
  return {
    log: emptyLog(),
    drinks: emptyDrinksConfig(),
    settings: baseSettings(),
    tokens: {},
    seed: 14,
    undoId: null,
    page: "main",
    cupBody: false,
    pickTime: null,
    flash: "",
    editing: null,
    ready: false,
  };
}

let state: AppState = fresh();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

type Saved = {
  log: Log;
  drinks: DrinksConfig;
  settings: Settings;
  tokens: Record<string, number>;
  seed: number;
};

function localeDefaults(settings: Settings): Settings {
  if (typeof navigator === "undefined") return settings;
  const lang = navigator.language || "";
  const imperial = /^en-(US|LR|MM)/.test(lang);
  let hour12 = false;
  try {
    hour12 = Boolean(new Intl.DateTimeFormat(lang, { hour: "numeric" }).resolvedOptions().hour12);
  } catch {
    hour12 = imperial;
  }
  return { ...settings, imperial, hour12 };
}

function sanitize(raw: unknown): Saved | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<Saved>;
  const log = emptyLog();
  if (data.log && Array.isArray(data.log.drinks)) {
    for (const d of data.log.drinks) {
      if (!d || typeof d !== "object") continue;
      const mg = cleanMg(Number(d.mg));
      const t = d.t ? new Date(d.t) : null;
      if (mg === null || !t || Number.isNaN(t.getTime())) continue;
      const kind = String(d.kind || "coffee");
      const entry: DrinkEntry = {
        id: String(d.id || t.toISOString()),
        t: t.toISOString(),
        kind,
        name: cleanName(String(d.name || ""), isPreset(kind) ? preset(kind).name : "Drink"),
        mg,
      };
      if (d.icon && (ICON_KINDS as readonly string[]).includes(String(d.icon))) entry.icon = String(d.icon);
      log.drinks.push(entry);
    }
    if (data.log.lastKind) log.lastKind = String(data.log.lastKind);
  }
  const drinks = emptyDrinksConfig();
  if (data.drinks && Array.isArray(data.drinks.custom)) {
    const seen: Record<string, boolean> = {};
    for (const c of data.drinks.custom) {
      if (!c?.kind) continue;
      const kind = String(c.kind);
      const mg = cleanMg(Number(c.mg));
      if (mg === null || isPreset(kind) || seen[kind]) continue;
      seen[kind] = true;
      drinks.custom.push({
        kind,
        name: cleanName(String(c.name || ""), "My drink"),
        mg,
        icon: (ICON_KINDS as readonly string[]).includes(String(c.icon)) ? String(c.icon) : "mug",
      });
    }
    const overrides = data.drinks.overrides;
    if (overrides && typeof overrides === "object") {
      for (const k of Object.keys(overrides)) {
        const over = cleanMg(Number(overrides[k]));
        if (isPreset(k) && over !== null && over !== preset(k).mg) drinks.overrides[k] = over;
      }
    }
  }
  const settings = { ...baseSettings(), ...(data.settings ?? {}) };
  settings.bodyWeightKg = Math.max(1, Math.round(Number(settings.bodyWeightKg) || 80));
  if (!["Sitting", "Standing", "Moving around"].includes(settings.activity)) settings.activity = "Sitting";
  settings.bedtime = /^\d{2}:\d{2}$/.test(settings.bedtime) ? settings.bedtime : "23:00";
  settings.dailyLimitMg = Math.max(1, Math.round(Number(settings.dailyLimitMg) || 400));
  settings.bedtimeLimitMg = Math.max(0, Math.round(Number(settings.bedtimeLimitMg) || 0));
  settings.imperial = Boolean(settings.imperial);
  settings.hour12 = Boolean(settings.hour12);
  const tokens: Record<string, number> = {};
  if (data.tokens && typeof data.tokens === "object") {
    for (const [k, v] of Object.entries(data.tokens)) {
      const n = Number(v);
      if (n > 0) tokens[k] = Math.round(n);
    }
  }
  return { log, drinks, settings, tokens, seed: Number(data.seed) || 14 };
}

function persist() {
  if (!state.ready || typeof localStorage === "undefined") return;
  const saved: Saved = {
    log: state.log,
    drinks: state.drinks,
    settings: state.settings,
    tokens: state.tokens,
    seed: state.seed,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    /* private mode */
  }
}

function update(patch: Partial<AppState>, write = true) {
  state = { ...state, ...patch };
  if (write) persist();
  emit();
}

export function hydrate() {
  if (state.ready || typeof window === "undefined") return;
  let saved: Saved | null = null;
  try {
    const text = localStorage.getItem(KEY);
    if (text) saved = sanitize(JSON.parse(text));
  } catch {
    saved = null;
  }
  if (saved) {
    state = { ...state, ...saved, ready: true };
  } else {
    state = { ...state, settings: localeDefaults(state.settings), ready: true };
  }
  emit();
}

function prune(log: Log, now: Date): Log {
  const keepFrom = now.getTime() - 8 * 24 * 3600 * 1000;
  const keepTo = now.getTime() + 3600 * 1000;
  return {
    ...log,
    drinks: log.drinks.filter((d) => {
      const t = new Date(d.t).getTime();
      return t >= keepFrom && t <= keepTo;
    }),
  };
}

export function logDrink(kind: string, at: Date) {
  const spec = drink(kind, state.drinks);
  const entry: DrinkEntry = {
    id: crypto.randomUUID(),
    t: at.toISOString(),
    kind: spec.kind,
    name: spec.name,
    mg: spec.mg,
    icon: spec.icon,
  };
  const log = prune(
    { ...state.log, drinks: [...state.log.drinks, entry], lastKind: spec.kind },
    new Date(),
  );
  update({
    log,
    undoId: entry.id,
    pickTime: null,
    flash: spec.name + " · " + spec.mg + " mg",
    page: state.page === "drink" ? "main" : state.page,
  });
}

export function undo() {
  const id = state.undoId ?? [...state.log.drinks].sort((a, b) => (a.t < b.t ? 1 : -1))[0]?.id;
  if (!id) return;
  update({
    log: { ...state.log, drinks: state.log.drinks.filter((d) => d.id !== id) },
    undoId: null,
    flash: "Undone",
  });
}

export function removeDrink(id: string) {
  update({
    log: { ...state.log, drinks: state.log.drinks.filter((d) => d.id !== id) },
    undoId: state.undoId === id ? null : state.undoId,
  });
}

export function setPage(page: AppState["page"]) {
  update({ page, pickTime: page === "main" ? state.pickTime : null }, false);
}

export function toggleCup() {
  update({ cupBody: !state.cupBody }, false);
}

export function setPickTime(pickTime: number | null) {
  update({ pickTime }, false);
}

export function clearFlash() {
  if (state.flash) update({ flash: "" }, false);
}

export function patchSettings(partial: Partial<Settings>) {
  update({ settings: { ...state.settings, ...partial } });
}

export function addTokens(hour: string, amount: number) {
  const next = Math.max(0, (state.tokens[hour] || 0) + amount);
  const tokens = { ...state.tokens };
  if (next <= 0) delete tokens[hour];
  else tokens[hour] = next;
  update({ tokens });
}

export function startEdit(kind: string, custom: boolean, isNew: boolean) {
  update({ editing: { kind, custom, isNew }, page: "drink" }, false);
}

export function cancelEdit() {
  update({ editing: null, page: "main" }, false);
}

export function saveDrink(draft: { name: string; mg: number; icon: string }) {
  const editing = state.editing;
  if (!editing) return;
  const mg = cleanMg(draft.mg);
  if (mg === null) return;
  const drinks: DrinksConfig = {
    version: 1,
    custom: state.drinks.custom.map((c) => ({ ...c })),
    overrides: { ...state.drinks.overrides },
  };
  if (editing.isNew || (editing.custom && !drinks.custom.some((c) => c.kind === editing.kind))) {
    const custom: CustomDrink = {
      kind: editing.isNew ? "custom-" + Date.now().toString(36) : editing.kind,
      name: cleanName(draft.name, "My drink"),
      mg,
      icon: (ICON_KINDS as readonly string[]).includes(draft.icon) ? draft.icon : "mug",
    };
    drinks.custom.push(custom);
  } else if (editing.custom) {
    drinks.custom = drinks.custom.map((c) =>
      c.kind === editing.kind
        ? {
            ...c,
            name: cleanName(draft.name, c.name),
            mg,
            icon: (ICON_KINDS as readonly string[]).includes(draft.icon) ? draft.icon : c.icon,
          }
        : c,
    );
  } else {
    const base = preset(editing.kind).mg;
    if (mg === base) delete drinks.overrides[editing.kind];
    else drinks.overrides[editing.kind] = mg;
  }
  update({ drinks, editing: null, page: "main" });
}

export function deleteEditing() {
  const editing = state.editing;
  if (!editing) return;
  if (editing.custom) {
    update({
      drinks: {
        ...state.drinks,
        custom: state.drinks.custom.filter((c) => c.kind !== editing.kind),
      },
      editing: null,
      page: "main",
    });
    return;
  }
  const overrides = { ...state.drinks.overrides };
  delete overrides[editing.kind];
  update({ drinks: { ...state.drinks, overrides }, editing: null, page: "main" });
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const serverState: AppState = fresh();

export function useApp(): AppState {
  return useSyncExternalStore(subscribe, () => state, () => serverState);
}
