import { useEffect, useRef, useState } from "react";
import { formatClock, inBody, snapTime, type DrinkEntry } from "@/lib/model";

type Props = {
  drinks: DrinkEntry[];
  now: Date;
  start: Date;
  end: Date;
  bed: Date;
  halfLife: number;
  bedtimeLimit: number;
  hour12: boolean;
  pickTime: number | null;
  onPick: (time: Date) => void;
};

export function Timeline(props: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(280, el.clientWidth));
    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const height = 176;
  const plot = { l: 46, r: 10, t: 18, b: 28 };
  const pw = Math.max(40, width - plot.l - plot.r);
  const ph = height - plot.t - plot.b;
  const span = Math.max(1, props.end.getTime() - props.start.getTime());
  const cell = 7;
  const gap = 2;
  const cols = Math.max(10, Math.floor(pw / (cell + gap)));
  const rows = Math.max(6, Math.floor(ph / (cell + gap)));
  const samples = Array.from({ length: cols }, (_, i) => {
    const t = props.start.getTime() + ((i + 0.5) / cols) * span;
    return { t, mg: inBody(props.drinks, new Date(t), props.halfLife) };
  });
  const yMax = Math.max(props.bedtimeLimit, 50, ...samples.map((s) => s.mg)) * 1.15;
  const xAt = (time: number) => plot.l + ((time - props.start.getTime()) / span) * (cols * (cell + gap));
  const limitY = plot.t + (rows - (props.bedtimeLimit / yMax) * rows) * (cell + gap);

  const marks = [
    { time: props.now.getTime(), label: "now", dash: "2 3", cls: "stroke-fg" },
    { time: props.bed.getTime(), label: "bed " + formatClock(props.bed, props.hour12), dash: "1 3", cls: "stroke-muted" },
  ];
  if (props.pickTime) {
    marks.push({
      time: props.pickTime,
      label: formatClock(new Date(props.pickTime), props.hour12),
      dash: "0",
      cls: "stroke-accent",
    });
  }

  const ticks = [0, 0.5, 1].map((p) => props.start.getTime() + span * p);

  return (
    <div ref={wrapRef} className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-44 w-full touch-manipulation"
        role="img"
        aria-label="Caffeine timeline. Tap a past time to log a drink then."
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const x = ((event.clientX - rect.left) / rect.width) * width;
          const gridW = cols * (cell + gap);
          if (x < plot.l || x > plot.l + gridW) return;
          const t = props.start.getTime() + ((x - plot.l) / gridW) * span;
          if (t > props.now.getTime()) return;
          props.onPick(snapTime(new Date(t), props.now, 5));
        }}
      >
        {Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => (
            <rect
              key={"d" + r + "-" + c}
              x={plot.l + c * (cell + gap)}
              y={plot.t + r * (cell + gap)}
              width="1.4"
              height="1.4"
              className="fill-line"
            />
          )),
        )}
        {samples.map((sample, c) => {
          const cells = Math.round((sample.mg / yMax) * rows);
          const future = sample.t > props.now.getTime();
          return Array.from({ length: cells }, (_, i) => (
            <rect
              key={"b" + c + "-" + i}
              x={plot.l + c * (cell + gap)}
              y={plot.t + (rows - 1 - i) * (cell + gap)}
              width={cell - 1}
              height={cell - 1}
              className={future ? "fill-accent/40" : "fill-accent"}
            />
          ));
        })}
        <line
          x1={plot.l}
          x2={plot.l + cols * (cell + gap)}
          y1={limitY}
          y2={limitY}
          className="stroke-urgent"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
        {marks.map((mark) => {
          if (mark.time < props.start.getTime() || mark.time > props.end.getTime()) return null;
          const x = Math.min(plot.l + cols * (cell + gap), Math.max(plot.l, xAt(mark.time)));
          return (
            <g key={mark.label}>
              <line
                x1={x}
                x2={x}
                y1={plot.t}
                y2={plot.t + rows * (cell + gap)}
                className={mark.cls}
                strokeWidth="1"
                strokeDasharray={mark.dash}
              />
              <text x={x} y="12" textAnchor="middle" className="chart-label fill-muted">
                {mark.label}
              </text>
            </g>
          );
        })}
        <text x={plot.l - 6} y={plot.t + 8} textAnchor="end" className="chart-label fill-muted">
          {Math.round(yMax)} mg
        </text>
        <text x={plot.l - 6} y={plot.t + rows * (cell + gap)} textAnchor="end" className="chart-label fill-muted">
          0
        </text>
        {ticks.map((t, i) => (
          <text
            key={t}
            x={i === 0 ? plot.l : i === ticks.length - 1 ? plot.l + cols * (cell + gap) : xAt(t)}
            y={height - 8}
            textAnchor={i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle"}
            className="chart-label fill-muted"
          >
            {formatClock(new Date(t), props.hour12)}
          </text>
        ))}
      </svg>
    </div>
  );
}
