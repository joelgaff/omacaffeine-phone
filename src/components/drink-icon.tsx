import { ICON_PATHS, type IconKind } from "@/lib/icon-paths";

export function DrinkIcon({ kind, className }: { kind: string; className?: string }) {
  const paths = ICON_PATHS[(kind as IconKind) in ICON_PATHS ? (kind as IconKind) : "mug"];
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
