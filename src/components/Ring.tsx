/** Progress ring. Overshoot is shown as a full ring in the danger colour plus the text label. */
export function Ring({ value, target, size = 164, stroke = 12, colorVar = "--kcal", children }: { value: number; target: number; size?: number; stroke?: number; colorVar?: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const frac = target > 0 ? Math.min(1, value / target) : 0;
  const over = target > 0 && value > target;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? "var(--danger)" : `var(${colorVar})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - frac)}
          style={{ transition: "stroke-dashoffset 600ms cubic-bezier(.2,.8,.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

export function ProgressBar({ value, target, colorClass, label, unit = "g" }: { value: number; target: number; colorClass: string; label: string; unit?: string }) {
  const frac = target > 0 ? Math.min(1, value / target) : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-medium text-ink">{label}</span>
        <span className="tabular text-ink-2">
          {Math.round(value)} / {Math.round(target)} {unit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-surface-2">
        <div className={`h-2 rounded-full ${colorClass}`} style={{ width: `${frac * 100}%`, transition: "width 600ms cubic-bezier(.2,.8,.2,1)" }} />
      </div>
    </div>
  );
}
