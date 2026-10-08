import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChartColumn, ChevronLeft, Clock, Moon, Plus, Settings, Undo2, X } from "lucide-react";
import { DrinkIcon } from "@/components/drink-icon";
import { Mug } from "@/components/mug";
import { Timeline } from "@/components/timeline";
import { ICON_KINDS } from "@/lib/icon-paths";
import {
  BACKDATE_HEADINGS,
  HEADINGS,
  QUOTES,
  WEEK_HEADINGS,
  activeHours,
  allDrinks,
  bedtimeAsDate,
  cutoff,
  dayTotals,
  describeCorrelation,
  describeTrend,
  drink,
  formatClock,
  formatTimeFrom,
  formatTokens,
  halfLifeHours,
  hourKey,
  inBody,
  kgToLb,
  lbToKg,
  mean,
  nextBedtime,
  pearson,
  pick,
  recommendedDailyLimit,
  singleDoseLimit,
  slope,
  sweetSpot,
  timeUntilBelow,
  todaysDrinks,
  tokenBuckets,
  tokensForDay,
  totalMg,
  type DrinkSpec,
} from "@/lib/model";
import {
  addTokens,
  cancelEdit,
  clearFlash,
  deleteEditing,
  hydrate,
  logDrink,
  patchSettings,
  removeDrink,
  saveDrink,
  setPage,
  setPickTime,
  startEdit,
  toggleCup,
  undo,
  useApp,
} from "@/lib/store";

function roundedNow() {
  const d = new Date();
  d.setSeconds(0, 0);
  return d;
}

const COLS = 3;

export function Tracker() {
  const app = useApp();
  const [now, setNow] = useState(roundedNow);
  const [chartReady, setChartReady] = useState(false);

  useEffect(() => {
    hydrate();
    setChartReady(true);
    const id = window.setInterval(() => setNow(roundedNow()), 15000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!app.flash) return;
    const id = window.setTimeout(clearFlash, 2200);
    return () => window.clearTimeout(id);
  }, [app.flash]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (event.key === "Enter") {
        const at = app.pickTime ? new Date(app.pickTime) : new Date();
        logDrink(app.log.lastKind, at);
      } else if (event.key === "Escape") {
        if (app.pickTime) setPickTime(null);
        else if (app.page !== "main") setPage("main");
      } else if (event.key === "z" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [app.log.lastKind, app.page, app.pickTime]);

  const title =
    app.page === "week"
      ? pick(WEEK_HEADINGS, app.seed)
      : app.page === "settings"
        ? "Settings"
        : app.page === "drink"
          ? "Your drink"
          : "OmaCaffeine";

  return (
    <div className="safe-top mx-auto flex min-h-dvh w-full max-w-5xl flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur">
        {app.page !== "main" ? (
          <button
            type="button"
            aria-label="Back"
            className="grid size-11 place-items-center rounded-xl text-fg"
            onClick={() => (app.page === "drink" ? cancelEdit() : setPage("main"))}
          >
            <ChevronLeft className="size-5" />
          </button>
        ) : (
          <DrinkIcon kind="espresso" className="size-6 text-accent" />
        )}
        <h1 className="min-w-0 flex-1 truncate text-lg font-medium tracking-tight">{title}</h1>
        {app.flash && <span className="hidden text-sm text-accent sm:inline">{app.flash}</span>}
        <button type="button" aria-label="Undo last drink" className="icon-btn" onClick={undo}>
          <Undo2 className="size-5" />
        </button>
        <button
          type="button"
          aria-label="Week"
          className={"icon-btn " + (app.page === "week" ? "text-accent" : "")}
          onClick={() => setPage(app.page === "week" ? "main" : "week")}
        >
          <ChartColumn className="size-5" />
        </button>
        <button
          type="button"
          aria-label="Settings"
          className={"icon-btn " + (app.page === "settings" ? "text-accent" : "")}
          onClick={() => setPage(app.page === "settings" ? "main" : "settings")}
        >
          <Settings className="size-5" />
        </button>
      </header>

      {app.flash && <p className="px-4 pt-3 text-sm text-accent sm:hidden">{app.flash}</p>}

      {app.page === "settings" ? (
        <SettingsPanel />
      ) : app.page === "drink" ? (
        <DrinkEditor />
      ) : (
        <div className="lg:grid lg:grid-cols-2 lg:items-start">
          <div className={app.page === "week" ? "hidden lg:block" : ""}>
            <Today now={now} chartReady={chartReady} />
          </div>
          <div className={app.page === "main" ? "hidden lg:block lg:border-l lg:border-line" : "lg:border-l lg:border-line"}>
            <Week now={now} />
          </div>
        </div>
      )}
    </div>
  );
}

function Today({ now, chartReady }: { now: Date; chartReady: boolean }) {
  const app = useApp();
  const clock = chartReady ? new Date() : now;
  const hl = halfLifeHours(app.settings.activity);
  const today = todaysDrinks(app.log.drinks, clock);
  const todayMg = totalMg(today);
  const limit = app.settings.dailyLimitMg;
  const inYou = Math.round(inBody(app.log.drinks, clock, hl));
  const cupLevel = app.cupBody ? inYou / limit : todayMg / limit;
  const last = drink(app.log.lastKind, app.drinks);
  const cut = cutoff(app.log.drinks, clock, app.settings.bedtime, hl, app.settings.bedtimeLimitMg, last.mg);
  const clearAt = timeUntilBelow(app.log.drinks, clock, hl, 10);
  const bedDate = bedtimeAsDate(app.settings.bedtime, clock);
  const bedNext = nextBedtime(clock, app.settings.bedtime);
  const first = today[0];
  const specs = allDrinks(app.drinks);
  const pad = (COLS - (specs.length % COLS)) % COLS || 1;
  const heading = app.pickTime
    ? pick(BACKDATE_HEADINGS, app.seed) + " · " + formatClock(new Date(app.pickTime), app.settings.hour12)
    : pick(HEADINGS, app.seed);
  const ok = cut.status === "clear" || cut.status === "until";
  const status =
    cut.status === "clear"
      ? "Clear for bedtime · another " + last.name + " still fits"
      : cut.status === "until"
        ? "Cut-off " + formatTimeFrom(cut.time, clock, app.settings.hour12) + " for another " + last.name
        : cut.status === "passed"
          ? "Past cut-off for another " + last.name + " · decaf from here"
          : "Over the bedtime limit · under " +
            app.settings.bedtimeLimitMg +
            " mg " +
            (cut.time ? "by " + formatTimeFrom(cut.time, clock, app.settings.hour12) : "not within two days");

  const floor = new Date(clock.getFullYear(), clock.getMonth(), clock.getDate(), 5, 0, 0, 0);
  let start = first ? new Date(new Date(first.t).getTime() - 45 * 60000) : new Date(clock.getTime() - 2 * 3600000);
  if (first && start < floor) start = floor;
  let end = new Date(Math.max(bedNext.getTime() + 90 * 60000, clock.getTime() + 45 * 60000));
  if (end.getTime() - start.getTime() > 18 * 3600000) end = new Date(start.getTime() + 18 * 3600000);

  const logAt = (spec: DrinkSpec) => {
    logDrink(spec.kind, app.pickTime ? new Date(app.pickTime) : new Date());
  };

  return (
    <div className="safe-bottom flex flex-col gap-5 px-4 py-5">
      <div className="flex flex-col items-center gap-4">
        <Mug
          level={cupLevel}
          percent={Math.round(Math.max(0, cupLevel) * 100)}
          sub={app.cupBody ? inYou + " mg in you" : todayMg + " / " + limit + " mg"}
          over={cupLevel > 1}
          onClick={toggleCup}
          label={app.cupBody ? "Showing caffeine in your system. Tap for today's intake." : "Showing today's intake. Tap for caffeine in your system."}
        />
        <p className="text-center text-sm text-fg">
          {first
            ? "First caffeine today: " + formatClock(new Date(first.t), app.settings.hour12) + " · " + first.name
            : "Let's brew you some coffee — you deserve it!"}
        </p>
      </div>

      <dl className="space-y-2 text-sm">
        <Stat k="Today" v={todayMg + " of " + limit + " mg · " + Math.round((todayMg / limit) * 100) + "% · " + today.length + (today.length === 1 ? " drink" : " drinks")} />
        <Stat
          k="In your system"
          v={inYou + " mg" + (clearAt && inYou > 10 ? " · gone by ~" + formatTimeFrom(clearAt, clock, app.settings.hour12) : "")}
        />
        <Stat
          k={"Bedtime " + formatClock(bedDate, app.settings.hour12)}
          v={Math.round(cut.atBedtime) + " mg left · limit " + app.settings.bedtimeLimitMg + " mg"}
        />
      </dl>

      <p className={"flex items-start gap-2 text-sm " + (ok ? "text-accent" : "text-urgent")}>
        {ok ? <Clock className="mt-0.5 size-4 shrink-0" /> : <Moon className="mt-0.5 size-4 shrink-0" />}
        <span>{status}</span>
      </p>

      <section>
        <div className="mb-2 flex items-end justify-between gap-3">
          <h2 className="section-label">{heading}</h2>
          {app.pickTime && (
            <button type="button" className="text-xs text-accent" onClick={() => setPickTime(null)}>
              Cancel
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {specs.map((spec) => (
            <DrinkTile
              key={spec.kind}
              spec={spec}
              selected={spec.kind === last.kind}
              onLog={() => logAt(spec)}
              onEdit={() => startEdit(spec.kind, spec.custom, false)}
            />
          ))}
          {Array.from({ length: pad }, (_, i) => (
            <button
              key={"new-" + i}
              type="button"
              className="tile text-muted"
              onClick={() => startEdit("new", true, true)}
            >
              <Plus className="size-5" />
              <span className="text-xs">Create my own</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-dim">Hold a drink to change its milligrams. Tap to log it.</p>
      </section>

      <section>
        <h2 className="section-label mb-2">Timeline · intake, half-life and bedtime · tap to log back in time</h2>
        {chartReady ? (
          <Timeline
            drinks={app.log.drinks}
            now={clock}
            start={start}
            end={end}
            bed={bedNext}
            halfLife={hl}
            bedtimeLimit={app.settings.bedtimeLimitMg}
            hour12={app.settings.hour12}
            pickTime={app.pickTime}
            onPick={(time) => setPickTime(time.getTime())}
          />
        ) : (
          <div className="h-44" />
        )}
      </section>

      <section>
        <h2 className="section-label mb-2">Today's log</h2>
        {today.length === 0 ? (
          <p className="text-sm text-muted">Nothing poured yet.</p>
        ) : (
          <ul>
            {[...today].reverse().map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 border-b border-line py-2.5 text-sm">
                <span className="w-16 shrink-0 text-muted">{formatClock(new Date(entry.t), app.settings.hour12)}</span>
                <DrinkIcon kind={entry.icon || entry.kind} className="size-5 text-fg" />
                <span className="min-w-0 flex-1 truncate">
                  {entry.name} <span className="text-muted">{entry.mg} mg</span>
                </span>
                <button type="button" aria-label={"Remove " + entry.name} className="icon-btn" onClick={() => removeDrink(entry.id)}>
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="pt-2 text-center font-serif text-sm text-muted italic">{pick(QUOTES, app.seed)}</p>
    </div>
  );
}

function DrinkTile({
  spec,
  selected,
  onLog,
  onEdit,
}: {
  spec: DrinkSpec;
  selected: boolean;
  onLog: () => void;
  onEdit: () => void;
}) {
  const timer = useRef<number | null>(null);
  const held = useRef(false);
  const clear = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };
  return (
    <button
      type="button"
      className={"tile " + (selected ? "border-accent bg-accent-dim text-fg" : "text-fg")}
      onPointerDown={() => {
        held.current = false;
        clear();
        timer.current = window.setTimeout(() => {
          held.current = true;
          onEdit();
        }, 480);
      }}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      onContextMenu={(event) => {
        event.preventDefault();
        held.current = true;
        onEdit();
      }}
      onClick={() => {
        if (held.current) {
          held.current = false;
          return;
        }
        onLog();
      }}
    >
      <DrinkIcon kind={spec.icon} className={"size-6 " + (selected ? "text-accent" : "text-fg")} />
      <span className="text-xs leading-tight">{spec.name}</span>
      <span className="text-xs text-muted">{spec.mg} mg</span>
    </button>
  );
}

function Week({ now }: { now: Date }) {
  const app = useApp();
  const hl = halfLifeHours(app.settings.activity);
  const days = dayTotals(app.log.drinks, now, 7);
  const tokenDays = days.map((d) => tokensForDay(app.tokens, d.date));
  const avg = Math.round(mean(days.map((d) => d.mg)));
  const avgCups = mean(days.map((d) => d.count));
  const mgTotal = days.reduce((a, d) => a + d.mg, 0);
  const tokTotal = tokenDays.reduce((a, b) => a + b, 0);
  const peak = days.reduce((best, d) => (!best || d.mg > best.mg ? d : best), days[0]);
  const tokMax = Math.max(1, ...tokenDays);
  const pairs = activeHours(app.log.drinks, app.tokens, now, 7, hl);
  const buckets = tokenBuckets(pairs);
  const spot = sweetSpot(buckets);
  const r = pearson(
    pairs.map((p) => p.mg),
    pairs.map((p) => p.tokens),
  );
  const bucketMax = Math.max(1, ...buckets.map((b) => b.perHour));
  const hour = hourKey(now);

  return (
    <div className="safe-bottom flex flex-col gap-5 px-4 py-5">
      <p className="section-label">
        Last seven days · average {avg} mg/day
      </p>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => (
          <div key={d.label + i} className="flex flex-col items-center gap-1 text-center">
            <Mug compact level={d.mg / app.settings.dailyLimitMg} over={d.mg > app.settings.dailyLimitMg} />
            <span className={"text-xs " + (d.mg > app.settings.dailyLimitMg ? "text-urgent" : "text-fg")}>{d.mg} mg</span>
            <span className="text-xs text-muted">{d.label}</span>
            <span className="text-xs text-dim">{d.count} {d.count === 1 ? "cup" : "cups"}</span>
            <div className="flex h-16 w-full items-end justify-center">
              {tokenDays[i] > 0 && (
                <div
                  className="w-3/5 rounded-sm bg-accent"
                  style={{ height: Math.max(4, Math.round((tokenDays[i] / tokMax) * 64)) + "px" }}
                />
              )}
            </div>
            <span className="text-xs text-muted">{tokenDays[i] ? formatTokens(tokenDays[i]) : "—"}</span>
          </div>
        ))}
      </div>

      <dl className="space-y-2 text-sm">
        <Stat
          k="Caffeine"
          v={
            mgTotal +
            " mg this week · " +
            (avgCups).toFixed(1) +
            " cups/day · peak " +
            peak.label +
            " " +
            peak.mg +
            " mg"
          }
        />
        <Stat
          k="Tokens"
          v={
            tokTotal
              ? formatTokens(tokTotal) +
                " output tokens · " +
                formatTokens(tokTotal / 7) +
                "/day · " +
                (mgTotal ? formatTokens(tokTotal / mgTotal) : "0") +
                " per mg"
              : "None logged on this phone yet"
          }
        />
        <Stat
          k="Trend"
          v={
            "caffeine " +
            describeTrend(slope(days.map((d) => d.mg)), "mg") +
            " · tokens " +
            describeTrend(slope(tokenDays), "tok")
          }
        />
      </dl>

      <section>
        <h2 className="section-label mb-3">Caffeine × tokens · output per active hour, by mg in your system</h2>
        <ul className="space-y-2">
          {buckets.map((b) => {
            const hot = spot?.label === b.label;
            return (
              <li key={b.label} className="grid grid-cols-[5.5rem_1fr] items-center gap-2 text-sm">
                <span className={hot ? "text-accent" : "text-muted"}>{b.label}</span>
                <span className="flex items-center gap-2">
                  <span className="h-2 flex-1 overflow-hidden rounded-sm bg-card">
                    <span
                      className={"block h-full " + (hot ? "bg-accent" : "bg-accent/70")}
                      style={{ width: Math.round((b.perHour / bucketMax) * 100) + "%" }}
                    />
                  </span>
                  <span className="w-28 shrink-0 text-right text-xs text-muted">
                    {b.hours ? formatTokens(b.perHour) + " tok/h · " + b.hours + " h" : "—"}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        {spot && (
          <p className="mt-3 text-sm text-accent">
            Sweet spot: {spot.label} in your system · {formatTokens(spot.perHour)} tokens/hour
          </p>
        )}
        <p className="mt-1 text-xs text-muted">{describeCorrelation(r, pairs.length)}</p>
      </section>

      <section className="rounded-xl border border-line bg-card p-3">
        <p className="text-sm text-fg">Log coding output for this hour</p>
        <p className="mt-1 text-xs text-muted">
          The desktop plugin reads Claude Code and Codex on your computer. On your phone, tap when you have been in the editor. This hour: {formatTokens(app.tokens[hour] || 0)}.
        </p>
        <div className="mt-3 flex gap-2">
          {[10000, 50000, 200000].map((n) => (
            <button key={n} type="button" className="tile min-h-11 flex-1 py-2 text-sm" onClick={() => addTokens(hour, n)}>
              +{formatTokens(n)}
            </button>
          ))}
        </div>
        {(app.tokens[hour] || 0) > 0 && (
          <button type="button" className="mt-2 text-xs text-muted" onClick={() => addTokens(hour, -(app.tokens[hour] || 0))}>
            Clear this hour
          </button>
        )}
      </section>

      <p className="text-xs leading-relaxed text-dim">
        Correlation, not causation. Caffeine is the half-life model over your log. Tokens are what you record here. Both mostly measure time at the keyboard, so drink for the taste.
      </p>
      <p className="text-center font-serif text-sm text-muted italic">{pick(QUOTES, app.seed + 3)}</p>
    </div>
  );
}

function SettingsPanel() {
  const { settings } = useApp();
  const shownWeight = settings.imperial ? kgToLb(settings.bodyWeightKg) : settings.bodyWeightKg;
  const recommended = recommendedDailyLimit(settings.bodyWeightKg);
  const dose = singleDoseLimit(settings.bodyWeightKg);

  const setWeight = (raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return;
    patchSettings({ bodyWeightKg: settings.imperial ? lbToKg(n) : Math.round(n) });
  };

  return (
    <div className="safe-bottom flex flex-col gap-1 px-4 py-4">
      <Field label="Bedtime">
        <input
          type="time"
          className="field"
          value={settings.bedtime}
          onChange={(e) => patchSettings({ bedtime: e.target.value || "23:00" })}
        />
      </Field>
      <NumberField
        label="Caffeine allowed at bedtime"
        suffix="mg"
        value={settings.bedtimeLimitMg}
        min={0}
        max={400}
        onChange={(bedtimeLimitMg) => patchSettings({ bedtimeLimitMg })}
      />
      <NumberField
        label="Daily limit"
        suffix="mg"
        value={settings.dailyLimitMg}
        min={20}
        max={1000}
        onChange={(dailyLimitMg) => patchSettings({ dailyLimitMg })}
      />
      <p className="pb-3 text-xs text-dim">
        Suggested from {shownWeight} {settings.imperial ? "lb" : "kg"}: {recommended} mg/day, {dose} mg in one dose. The hard daily cap in the model is 400 mg.
      </p>
      <Field label={"Weight (" + (settings.imperial ? "lb" : "kg") + ")"}>
        <input
          className="field"
          inputMode="numeric"
          value={shownWeight}
          onChange={(e) => setWeight(e.target.value)}
        />
      </Field>
      <div className="flex gap-2 py-2">
        <Toggle on={settings.imperial} onClick={() => patchSettings({ imperial: !settings.imperial })}>
          {settings.imperial ? "Pounds" : "Kilograms"}
        </Toggle>
        <Toggle on={settings.hour12} onClick={() => patchSettings({ hour12: !settings.hour12 })}>
          {settings.hour12 ? "12-hour" : "24-hour"}
        </Toggle>
      </div>
      <p className="section-label pb-2 pt-4">Activity · half-life</p>
      <div className="grid grid-cols-3 gap-2">
        {(["Sitting", "Standing", "Moving around"] as const).map((activity) => (
          <button
            key={activity}
            type="button"
            className={"tile min-h-14 text-xs " + (settings.activity === activity ? "border-accent bg-accent-dim" : "")}
            onClick={() => patchSettings({ activity })}
          >
            {activity}
            <span className="text-muted">{halfLifeHours(activity)} h</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="mt-4 text-left text-sm text-accent"
        onClick={() => patchSettings({ dailyLimitMg: recommended })}
      >
        Use suggested daily limit ({recommended} mg)
      </button>
      <p className="mt-6 text-xs leading-relaxed text-dim">
        Half-life is about five hours at a desk, a little faster if you are up and moving. Limits follow EFSA guidance for healthy adults. This is a model, not medical advice. Everything stays on this phone.
      </p>
      <a className="mt-4 text-sm text-accent" href="?install=1&platform=ios">
        Add to your iPhone Home Screen
      </a>
    </div>
  );
}

function DrinkEditor() {
  const app = useApp();
  const editing = app.editing;
  const spec = editing && !editing.isNew ? drink(editing.kind, app.drinks) : null;
  const [name, setName] = useState(spec?.name ?? "");
  const [mg, setMg] = useState(spec ? String(spec.mg) : "80");
  const [icon, setIcon] = useState(spec?.icon ?? "mug");
  if (!editing) return null;
  const custom = editing.custom || editing.isNew;
  const parsed = Number(mg);
  const valid = Number.isFinite(parsed) && parsed >= 0 && parsed <= 1000;

  return (
    <form
      className="safe-bottom flex flex-col gap-4 px-4 py-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) return;
        saveDrink({ name, mg: parsed, icon });
      }}
    >
      {custom && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="section-label">Name</span>
          <input className="field w-full" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="Batch brew" />
        </label>
      )}
      {!custom && spec && <p className="text-lg">{spec.name}</p>}
      <label className="flex flex-col gap-1 text-sm">
        <span className="section-label">Caffeine</span>
        <span className="flex items-center gap-2">
          <input className="field w-28" inputMode="numeric" value={mg} onChange={(e) => setMg(e.target.value)} />
          <span className="text-muted">mg</span>
        </span>
      </label>
      {spec && !custom && (
        <p className="text-xs text-dim">
          Usual café serving is {spec.defaultMg} mg · {spec.serving}
        </p>
      )}
      {custom && (
        <div>
          <p className="section-label mb-2">Icon</p>
          <div className="grid grid-cols-6 gap-2">
            {ICON_KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                aria-label={kind}
                className={"grid h-11 place-items-center rounded-lg border " + (icon === kind ? "border-accent bg-accent-dim text-accent" : "border-line text-fg")}
                onClick={() => setIcon(kind)}
              >
                <DrinkIcon kind={kind} className="size-5" />
              </button>
            ))}
          </div>
        </div>
      )}
      <button type="submit" className="h-12 rounded-xl bg-accent text-base font-medium text-bg" disabled={!valid}>
        Save
      </button>
      <button type="button" className="h-11 text-sm text-muted" onClick={deleteEditing}>
        {custom && !editing.isNew ? "Delete drink" : spec?.overridden ? "Reset to " + spec.defaultMg + " mg" : "Cancel"}
      </button>
    </form>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="section-label shrink-0">{k}</dt>
      <dd className="text-right text-fg">{v}</dd>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3 border-b border-line py-3 text-sm">
      <span>{label}</span>
      {children}
    </label>
  );
}

function NumberField({
  label,
  suffix,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  suffix: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <Field label={label}>
      <span className="flex items-center gap-2">
        <input
          className="field w-24"
          inputMode="numeric"
          value={value}
          onChange={(e) => {
            if (e.target.value.trim() === "") return;
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(Math.min(max, Math.max(0, Math.round(n))));
          }}
          onBlur={(e) => {
            const n = Number(e.target.value);
            if (!Number.isFinite(n)) {
              onChange(min);
              return;
            }
            onChange(Math.min(max, Math.max(min, Math.round(n))));
          }}
        />
        <span className="text-muted">{suffix}</span>
      </span>
    </Field>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={"h-11 flex-1 rounded-xl border text-sm " + (on ? "border-accent bg-accent-dim text-fg" : "border-line text-muted")}
    >
      {children}
    </button>
  );
}
