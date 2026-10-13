/* Countdown ring (SVG arc). <Ring frac={0.62} size={132} stroke={10} tone="lime"|"ok"|"warn"|"danger">centre content</Ring> */
import type { ReactNode } from "react";

export default function Ring({ frac, size = 160, stroke = 10, tone = "lime", children }: { frac: number; size?: number; stroke?: number; tone?: "lime" | "ok" | "warn" | "danger"; children?: ReactNode }) {
  const r = (size - stroke) / 2 - 2, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, frac));
  return (
    <div className={`ring ring-${tone}`} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle className="ring-fill" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} strokeDasharray={c.toFixed(2)}
          strokeDashoffset={(c * (1 - f)).toFixed(2)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}
