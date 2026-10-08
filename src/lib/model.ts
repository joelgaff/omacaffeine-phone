// One-compartment caffeine model, ported from OmaCaffeine (MIT).
// Every drink decays on its own half-life. Absorption is treated as instant.

export type Activity = "Sitting" | "Standing" | "Moving around";

export type Preset = {
  kind: string;
  name: string;
  mg: number;
  serving: string;
};

export type DrinkEntry = {
  id: string;
  t: string;
  kind: string;
  name: string;
  mg: number;
  icon?: string;
};

export type Log = {
  version: 1;
  drinks: DrinkEntry[];
  lastKind: string;
};

export type CustomDrink = {
  kind: string;
  name: string;
  mg: number;
  icon: string;
};

export type DrinksConfig = {
  version: 1;
  custom: CustomDrink[];
  overrides: Record<string, number>;
};

export type DrinkSpec = {
  kind: string;
  name: string;
  icon: string;
  serving: string;
  mg: number;
  defaultMg: number;
  overridden: boolean;
  custom: boolean;
};

export const PRESETS: Preset[] = [
  { kind: "espresso", name: "Espresso", mg: 63, serving: "1 shot · 30 ml" },
  { kind: "doppio", name: "Doppio", mg: 126, serving: "2 shots · 60 ml" },
  { kind: "americano", name: "Americano", mg: 77, serving: "1 shot + hot water" },
  { kind: "cappuccino", name: "Cappuccino", mg: 63, serving: "1 shot + foamed milk" },
  { kind: "latte", name: "Latte", mg: 126, serving: "2 shots + steamed milk" },
  { kind: "flat-white", name: "Flat White", mg: 130, serving: "2 ristretto + milk" },
  { kind: "coffee", name: "Filter", mg: 95, serving: "Filter coffee · 250 ml" },
  { kind: "cold-brew", name: "Cold Brew", mg: 200, serving: "1 glass · 350 ml" },
  { kind: "decaf", name: "Decaf", mg: 3, serving: "Decaf coffee · 250 ml" },
  { kind: "black-tea", name: "Black Tea", mg: 47, serving: "1 cup · 250 ml" },
  { kind: "green-tea", name: "Green Tea", mg: 30, serving: "1 cup · 250 ml" },
  { kind: "matcha", name: "Matcha", mg: 70, serving: "2 g · 1 bowl" },
  { kind: "cola", name: "Cola", mg: 32, serving: "1 can · 330 ml" },
  { kind: "red-bull", name: "Red Bull", mg: 80, serving: "1 can · 250 ml" },
  { kind: "monster", name: "Monster", mg: 160, serving: "1 can · 500 ml" },
  { kind: "nitro", name: "Nitro", mg: 215, serving: "Nitro cold brew · 350 ml" },
];

export const ACTIVITIES: Activity[] = ["Sitting", "Standing", "Moving around"];

const HALF_LIFE_HOURS: Record<Activity, number> = {
  Sitting: 5,
  Standing: 4.75,
  "Moving around": 4.5,
};

const MG_PER_KG_DAY = 5.7;
const MG_PER_KG_DOSE = 3;
export const DAILY_CAP = 400;
export const DEFAULT_BEDTIME_LIMIT = 100;
export const MAX_MG = 1000;
export const MAX_NAME = 40;

export const HEADINGS = [
  "Choose your weapon, code warrior",
  "Pick your fuel, kernel hacker",
  "What powers the next commit?",
  "Select a dependency for this sprint",
  "Refuel the compiler",
  "Which beverage compiles your genius?",
  "Inject caffeine into main()",
  "Load balancer for your brain",
  "Pick a potion, wizard of the shell",
  "Fuel up, 10x developer",
  "What's brewing in your pipeline?",
  "Choose your build agent",
  "Select a runtime for greatness",
  "Deploy a beverage to production (you)",
  "Your next token generator",
  "Hydrate the neural net",
];

export const BACKDATE_HEADINGS = [
  "Retroactive commit · pick the drink you forgot",
  "Rebase your morning · which cup was it?",
  "Time travel enabled · choose the cup",
  "Backfilling the log · what did you drink?",
  "Cherry-pick a drink into the past",
];

export const WEEK_HEADINGS = [
  "Seven days of uptime",
  "Weekly sprint retrospective",
  "The week in milligrams",
  "Your caffeine changelog",
  "Last seven builds",
];

export const QUOTES = [
  "Good code is written on caffeine.",
  "caffeine × tokens = production",
  "while (!asleep) { coffee++; }",
  "make focus: no rule to make target. Try coffee.",
  "Half-life: about five hours. Uptime: as long as the pot lasts.",
  "Caffeine: the original hot-reload.",
  "There is no cloud, just someone else's espresso machine.",
  "Compiling thoughts… brewing dependencies.",
  "Kernel panic averted. Refill scheduled.",
  "Coffee is a language in itself. So is Rust. Both compile slowly.",
  "One does not simply ship before the second cup.",
  "Idle CPU. Idle developer. Both need a cup.",
  "Stack overflow? Try a cup underflow first.",
  "Creativity is caffeine looking for a keyboard.",
  "Deep work in progress · do not decaf.",
  "Latency is just coffee that hasn't kicked in yet.",
  "The best time to brew was five hours ago. The second best time is now.",
  "Rate limit reached: 400 mg/day. Retry tomorrow.",
  "Zero-shot? No. Two-shot. Doppio.",
  "Pair programming: you, the model, and a pot of filter.",
  "Half-life is just exponential backoff for humans.",
  "Green tea for the review. Espresso for the merge.",
  "Your bedtime is a deadline. The half-life is the sprint.",
  "Tokens per second scale with milligrams per cup. Citation needed.",
];

export const MG_BUCKETS = [
  { label: "0–50 mg", from: 0, to: 50 },
  { label: "50–100 mg", from: 50, to: 100 },
  { label: "100–150 mg", from: 100, to: 150 },
  { label: "150–200 mg", from: 150, to: 200 },
  { label: "200+ mg", from: 200, to: Infinity },
];

export function preset(kind: string): Preset {
  return PRESETS.find((p) => p.kind === kind) ?? PRESETS[0];
}

export function isPreset(kind: string): boolean {
  return PRESETS.some((p) => p.kind === kind);
}

export function emptyDrinksConfig(): DrinksConfig {
  return { version: 1, custom: [], overrides: {} };
}

export function emptyLog(): Log {
  return { version: 1, drinks: [], lastKind: "espresso" };
}

export function halfLifeHours(activity: string): number {
  if (activity === "Standing" || activity === "Moving around" || activity === "Sitting") {
    return HALF_LIFE_HOURS[activity];
  }
  return HALF_LIFE_HOURS.Sitting;
}

export function recommendedDailyLimit(kg: number): number {
  if (!Number.isFinite(kg) || kg <= 0) return DAILY_CAP;
  return Math.min(DAILY_CAP, Math.round(MG_PER_KG_DAY * kg));
}

export function singleDoseLimit(kg: number): number {
  if (!Number.isFinite(kg) || kg <= 0) return 200;
  return Math.min(200, Math.round(MG_PER_KG_DOSE * kg));
}

export function pad2(n: number): string {
  return (n < 10 ? "0" : "") + n;
}

export function cleanName(value: string, fallback: string): string {
  const name = String(value || "")
    .replace(/[\r\n\t]+/g, " ")
    .trim();
  return (name || fallback).slice(0, MAX_NAME);
}

export function cleanMg(value: number): number | null {
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.min(MAX_MG, Math.round(value));
}

export function allDrinks(config: DrinksConfig): DrinkSpec[] {
  const list: DrinkSpec[] = PRESETS.map((p) => {
    const overridden = Object.prototype.hasOwnProperty.call(config.overrides, p.kind);
    return {
      kind: p.kind,
      name: p.name,
      icon: p.kind,
      serving: p.serving,
      mg: overridden ? config.overrides[p.kind] : p.mg,
      defaultMg: p.mg,
      overridden,
      custom: false,
    };
  });
  for (const d of config.custom) {
    list.push({
      kind: d.kind,
      name: d.name,
      icon: d.icon,
      serving: "Your own drink",
      mg: d.mg,
      defaultMg: d.mg,
      overridden: false,
      custom: true,
    });
  }
  return list;
}

export function drink(kind: string, config: DrinksConfig): DrinkSpec {
  const list = allDrinks(config);
  return list.find((d) => d.kind === kind) ?? list[0];
}

export function iconFor(entry: DrinkEntry | null, config: DrinksConfig): string {
  if (!entry) return "mug";
  if (entry.icon) return entry.icon;
  if (isPreset(entry.kind)) return entry.kind;
  const d = drink(entry.kind, config);
  return d.kind === entry.kind ? d.icon : "mug";
}

function parseBedtime(text: string): { hours: number; minutes: number } | null {
  const match = /^(\d{1,2})(?:[:.](\d{2}))?\s*([aApP][mM]?)?\.?$/.exec(String(text || "").trim());
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = match[2] ? parseInt(match[2], 10) : 0;
  const suffix = match[3] ? match[3].toLowerCase().charAt(0) : "";
  if (suffix && (h < 1 || h > 12)) return null;
  if (suffix === "p" && h < 12) h += 12;
  if (suffix === "a" && h === 12) h = 0;
  if (h > 23 || m > 59) return null;
  return { hours: h, minutes: m };
}

export function normalizedBedtime(text: string): string {
  const parsed = parseBedtime(text) ?? { hours: 23, minutes: 0 };
  return pad2(parsed.hours) + ":" + pad2(parsed.minutes);
}

export function bedtimeAsDate(text: string, now: Date): Date {
  const parsed = parseBedtime(text) ?? { hours: 23, minutes: 0 };
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), parsed.hours, parsed.minutes, 0, 0);
}

export function addDays(date: Date, n: number): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + n,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function nextBedtime(now: Date, bedtimeText: string): Date {
  let candidate = bedtimeAsDate(bedtimeText, now);
  if (candidate.getTime() <= now.getTime()) candidate = addDays(candidate, 1);
  return candidate;
}

export function startOfDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

export function formatClock(date: Date, hour12: boolean): string {
  const h = date.getHours();
  const m = pad2(date.getMinutes());
  if (!hour12) return pad2(h) + ":" + m;
  const suffix = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return hr + ":" + m + " " + suffix;
}

export function formatTimeFrom(date: Date | null, now: Date, hour12: boolean): string {
  if (!date) return "—";
  const time = formatClock(date, hour12);
  if (sameDay(date, now)) return time;
  if (sameDay(date, addDays(now, 1))) return time + " tomorrow";
  return time + " in " + Math.round((date.getTime() - now.getTime()) / 3600000) + " h";
}

export function kgToLb(kg: number): number {
  return Math.round(Number(kg) * 2.20462);
}

export function lbToKg(lb: number): number {
  return Math.round(Number(lb) / 2.20462);
}

export function formatTokens(n: number): string {
  const v = Math.max(0, Number(n) || 0);
  if (v >= 1e6) return (v / 1e6).toFixed(v >= 1e7 ? 0 : 1) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(v >= 1e4 ? 0 : 1) + "k";
  return String(Math.round(v));
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function dayLabel(date: Date): string {
  return WEEKDAYS[date.getDay()];
}

export function drinkTime(entry: { t?: string } | null): Date | null {
  const t = entry?.t ? new Date(entry.t) : null;
  return t && !Number.isNaN(t.getTime()) ? t : null;
}

export function todaysDrinks(drinks: DrinkEntry[], at: Date): DrinkEntry[] {
  const start = startOfDay(at).getTime();
  const end = addDays(startOfDay(at), 1).getTime();
  return drinks
    .filter((d) => {
      const t = drinkTime(d);
      return t && t.getTime() >= start && t.getTime() < end;
    })
    .sort((a, b) => (drinkTime(a)?.getTime() ?? 0) - (drinkTime(b)?.getTime() ?? 0));
}

export function totalMg(list: DrinkEntry[]): number {
  return Math.round(list.reduce((sum, d) => sum + (Number(d.mg) || 0), 0));
}

export function inBody(drinks: DrinkEntry[], at: Date, halfLifeHrs: number): number {
  const hl = Math.max(0.5, Number(halfLifeHrs) || 5);
  let total = 0;
  for (const d of drinks) {
    const t = drinkTime(d);
    if (!t) continue;
    const hours = (at.getTime() - t.getTime()) / 3600000;
    if (hours < 0 || hours > 72) continue;
    total += (Number(d.mg) || 0) * Math.pow(0.5, hours / hl);
  }
  return total;
}

export function timeUntilBelow(
  drinks: DrinkEntry[],
  from: Date,
  halfLifeHrs: number,
  limit: number,
): Date | null {
  const step = 5 * 60000;
  let t = from.getTime();
  for (let i = 0; i < 24 * 12 * 2; i++) {
    const at = new Date(t);
    if (inBody(drinks, at, halfLifeHrs) <= limit) return at;
    t += step;
  }
  return null;
}

export type Cutoff = {
  status: "clear" | "until" | "passed" | "over";
  time: Date | null;
  bedtime: Date;
  atBedtime: number;
};

export function cutoff(
  drinks: DrinkEntry[],
  now: Date,
  bedtimeText: string,
  halfLifeHrs: number,
  limitAtBed: number,
  doseMg: number,
): Cutoff {
  const bed = nextBedtime(now, bedtimeText);
  const hl = Math.max(0.5, Number(halfLifeHrs) || 5);
  const current = inBody(drinks, bed, hl);
  const dose = Math.max(0, Number(doseMg) || 0);
  const headroom = limitAtBed - current;
  if (current > limitAtBed) {
    return {
      status: "over",
      time: timeUntilBelow(drinks, bed, hl, limitAtBed),
      bedtime: bed,
      atBedtime: current,
    };
  }
  if (dose <= headroom) return { status: "clear", time: bed, bedtime: bed, atBedtime: current };
  if (headroom <= 0) return { status: "passed", time: bed, bedtime: bed, atBedtime: current };
  const hoursBefore = (hl * Math.log(dose / headroom)) / Math.LN2;
  const latest = new Date(bed.getTime() - hoursBefore * 3600000);
  if (latest.getTime() <= now.getTime()) {
    return { status: "passed", time: latest, bedtime: bed, atBedtime: current };
  }
  return { status: "until", time: latest, bedtime: bed, atBedtime: current };
}

export type DayTotal = {
  date: Date;
  mg: number;
  count: number;
  label: string;
  isToday: boolean;
};

export function dayTotals(drinks: DrinkEntry[], now: Date, days: number): DayTotal[] {
  const todayStart = startOfDay(now);
  const list: DayTotal[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const start = addDays(todayStart, -i);
    const end = addDays(start, 1);
    let mg = 0;
    let count = 0;
    for (const d of drinks) {
      const t = drinkTime(d);
      if (!t || t < start || t >= end) continue;
      mg += Number(d.mg) || 0;
      count++;
    }
    list.push({
      date: start,
      mg: Math.round(mg),
      count,
      label: i === 0 ? "Today" : dayLabel(start),
      isToday: i === 0,
    });
  }
  return list;
}

export function hourKey(date: Date): string {
  return (
    date.getFullYear() +
    "-" +
    pad2(date.getMonth() + 1) +
    "-" +
    pad2(date.getDate()) +
    "T" +
    pad2(date.getHours())
  );
}

function hourKeysOfDay(dayStart: Date): string[] {
  const keys: string[] = [];
  const seen: Record<string, boolean> = {};
  for (let h = 0; h < 24; h++) {
    const key = hourKey(new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), h));
    if (!seen[key]) {
      seen[key] = true;
      keys.push(key);
    }
  }
  return keys;
}

export function tokensForDay(hours: Record<string, number>, dayStart: Date): number {
  return hourKeysOfDay(dayStart).reduce((sum, key) => sum + (Number(hours[key]) || 0), 0);
}

export function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return NaN;
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx <= 0 || syy <= 0) return NaN;
  return sxy / Math.sqrt(sxx * syy);
}

export function slope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const mx = (n - 1) / 2;
  const my = mean(values);
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (i - mx) * (values[i] - my);
    sxx += (i - mx) * (i - mx);
  }
  return sxx > 0 ? sxy / sxx : 0;
}

export type ActiveHour = { t: number; mg: number; tokens: number };

export function activeHours(
  drinks: DrinkEntry[],
  hours: Record<string, number>,
  now: Date,
  days: number,
  halfLifeHrs: number,
): ActiveHour[] {
  const pairs: ActiveHour[] = [];
  const todayStart = startOfDay(now);
  const currentKey = hourKey(now);
  for (let i = days - 1; i >= 0; i--) {
    const day = addDays(todayStart, -i);
    for (let h = 0; h < 24; h++) {
      const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h);
      if (start.getTime() > now.getTime()) break;
      const key = hourKey(start);
      if (key === currentKey) break;
      const tokens = Number(hours[key]) || 0;
      if (tokens <= 0) continue;
      const mg = inBody(drinks, new Date(start.getTime() + 1800000), halfLifeHrs);
      pairs.push({ t: start.getTime(), mg, tokens });
    }
  }
  return pairs;
}

export type Bucket = { label: string; hours: number; perHour: number };

export function tokenBuckets(pairs: ActiveHour[]): Bucket[] {
  return MG_BUCKETS.map((spec) => {
    const values = pairs.filter((p) => p.mg >= spec.from && p.mg < spec.to).map((p) => p.tokens);
    return { label: spec.label, hours: values.length, perHour: mean(values) };
  });
}

export function sweetSpot(buckets: Bucket[]): Bucket | null {
  let best: Bucket | null = null;
  for (const b of buckets) {
    if (b.hours >= 2 && (!best || b.perHour > best.perHour)) best = b;
  }
  return best;
}

export function describeCorrelation(r: number, n: number): string {
  if (Number.isNaN(r) || n < 6) return "Not enough overlap yet · keep logging, keep prompting";
  const strength = Math.abs(r) < 0.2 ? "no real" : Math.abs(r) < 0.5 ? "a weak" : "a solid";
  let direction = r > 0 ? "more caffeine, more tokens" : "more caffeine, fewer tokens";
  if (Math.abs(r) < 0.2) direction = "the tokens don't care about the mg";
  return "r = " + r.toFixed(2) + " over " + n + " active hours · " + strength + " link · " + direction;
}

export function describeTrend(perDay: number, unit: string): string {
  if (Math.abs(perDay) < 1) return "flat";
  const arrow = perDay > 0 ? "↑ +" : "↓ −";
  const fmt =
    unit === "tok"
      ? formatTokens(Math.abs(perDay))
      : String(Math.round(Math.abs(perDay)));
  return arrow + fmt + " " + unit + "/day";
}

export function pick(list: string[], seed: number): string {
  return list[Math.abs(Math.floor(Number(seed) || 0)) % list.length];
}

export function snapTime(date: Date, now: Date, minutes: number): Date {
  const step = Math.max(1, minutes) * 60000;
  const t = Math.round(date.getTime() / step) * step;
  return new Date(Math.min(t, now.getTime()));
}
