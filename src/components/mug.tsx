import { useEffect, useId, useRef, useState } from "react";

type MugProps = {
  level: number;
  percent?: number;
  sub?: string;
  over?: boolean;
  compact?: boolean;
  onClick?: () => void;
  label?: string;
};

export function Mug({ level, percent = 0, sub = "", over = false, compact, onClick, label }: MugProps) {
  const clamped = Math.max(0, Math.min(1.35, level));
  const visualCap = Math.min(1, clamped);
  const [shown, setShown] = useState(visualCap);
  const shownRef = useRef(visualCap);
  const [pour, setPour] = useState(false);
  const clipId = "mug" + useId().replace(/:/g, "");

  useEffect(() => {
    if (compact) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = shownRef.current;
    if (reduce || Math.abs(visualCap - from) < 0.004) {
      shownRef.current = visualCap;
      setShown(visualCap);
      return;
    }
    let stop = 0;
    if (visualCap > from + 0.01) {
      setPour(true);
      stop = window.setTimeout(() => setPour(false), 900);
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 900);
      const e = 1 - (1 - p) ** 3;
      const n = from + (visualCap - from) * e;
      shownRef.current = n;
      setShown(n);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      if (stop) window.clearTimeout(stop);
    };
  }, [visualCap, compact]);

  const fill = compact ? visualCap : shown;
  const innerTop = 66;
  const innerBot = 150;
  const surface = innerBot - (innerBot - innerTop) * Math.min(1, fill);
  const fillH = innerBot - surface;
  const foam = fill > 0.45 && !over;
  const steam = fill > 0.02;

  const art = (
    <svg viewBox="0 0 180 200" className={compact ? "h-12 w-12" : "h-44 w-40"} aria-hidden="true">
      <ellipse cx="84" cy="172" rx="54" ry="8" className="fill-none stroke-fg/70" strokeWidth="2.2" />
      <path
        d="M48 64 H120 L112 154 Q84 166 56 154 Z"
        className="fill-none stroke-fg"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M120 88 H130 Q156 88 156 114 Q156 140 130 140 H118"
        className="fill-none stroke-fg"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <clipPath id={clipId}>
        <path d="M51 67 H117 L110 151 Q84 162 58 151 Z" />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        {fill > 0.012 && (
          <rect x="48" y={surface} width="76" height={fillH + 4} className={over ? "fill-urgent" : "fill-coffee"} />
        )}
        {fill > 0.04 && (
          <ellipse cx="84" cy={surface + 1} rx={30} ry="4.5" className={over ? "fill-foam" : "fill-crema"} />
        )}
        {pour && <rect x="80" y="18" width="4" height={Math.max(10, surface - 16)} className="fill-crema" />}
      </g>
      {steam && !compact && (
        <g className={over ? "text-urgent" : "text-fg/60"}>
          <path d="M70 50 C70 38 80 38 80 26" className="steam fill-none stroke-current" strokeWidth="2" />
          <path d="M90 46 C90 34 100 34 100 20" className="steam steam-late fill-none stroke-current" strokeWidth="2" />
          <path d="M108 52 C108 42 116 42 116 30" className="steam steam-later fill-none stroke-current" strokeWidth="2" />
        </g>
      )}
      {steam && compact && (
        <path d="M76 52 C76 42 92 42 92 30" className="fill-none stroke-fg/50" strokeWidth="2" />
      )}
      {over && (
        <g className="fill-urgent">
          <circle cx="60" cy="160" r="2" />
          <circle cx="74" cy="166" r="1.5" />
          <circle cx="102" cy="163" r="1.8" />
        </g>
      )}
    </svg>
  );

  if (compact) return art;

  const face = (
    <>
      {art}
      <span
        className={
          "pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-8 " +
          (foam || over ? "text-foam" : "text-fg")
        }
      >
        <span className="text-4xl font-medium leading-none tracking-tight">{percent}%</span>
        <span className="mt-1 text-xs opacity-90">{sub}</span>
      </span>
    </>
  );

  if (!onClick) return <div className="relative">{face}</div>;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="relative rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {face}
    </button>
  );
}
