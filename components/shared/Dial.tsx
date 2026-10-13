"use client";
/* Time dial (EasyPark-style). Drag the knob round a 270° arc (or arrows ±step, PageUp/Down ±4 steps, Home/End).
   Centre shows the duration ("2 h 30 m", odometer roll); below it "Exit 4:30 pm" when startMs is given, or sub(min).
   Snaps to stepMin with a 120ms knob spring; the tick under the knob flashes lime on each snap.
   Controlled:   <Dial value={min} onChange={setMin} startMs={start} />
   Uncontrolled: <Dial defaultValue={120} onChange={...} />
   Extend sheet: <Dial value={m} onChange={setM} minMin={30} maxMin={180} prefix="+" label="Add" sub={(v) => <>New exit <b>…</b></>} />
   size="sm" → 180px (.dial-sm). Width otherwise 240px (max 100%). */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { MIN, dayLabel, durationLabel, durationShort, timeLabel } from "@/lib/engine";
import RollNumber from "./RollNumber";

const R = 100, CX = 120, CY = 120, A0 = 135, SWEEP = 270; // degrees, 0 = 3 o'clock, clockwise
const pt = (deg: number, r = R): [number, number] => { const a = (deg * Math.PI) / 180; return [CX + r * Math.cos(a), CY + r * Math.sin(a)]; };
const arc = (from: number, to: number, r = R) => {
  const [x1, y1] = pt(from, r), [x2, y2] = pt(to, r);
  return `M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2.toFixed(2)},${y2.toFixed(2)}`;
};

export interface DialProps {
  value?: number;
  defaultValue?: number;
  onChange?: (min: number) => void;
  minMin?: number;
  maxMin?: number;
  stepMin?: number;
  startMs?: number;
  label?: string;
  prefix?: string;
  sub?: (min: number) => ReactNode;
  size?: "sm";
  className?: string;
}

export default function Dial({ value, defaultValue = 120, onChange, minMin = 30, maxMin = 1440, stepMin = 30, startMs, label = "Parking time", prefix = "", sub, size, className = "" }: DialProps) {
  const clamp = useCallback((v: number) => Math.max(minMin, Math.min(maxMin, Math.round((v - minMin) / stepMin) * stepMin + minMin)), [minMin, maxMin, stepMin]);
  const [inner, setInner] = useState(() => clamp(value ?? defaultValue));
  const cur = clamp(value ?? inner);
  const curRef = useRef(cur);
  curRef.current = cur;
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const [drag, setDrag] = useState(false);
  const [flash, setFlash] = useState<{ v: number; n: number } | null>(null);

  const toDeg = useCallback((v: number) => A0 + (SWEEP * (v - minMin)) / (maxMin - minMin || 1), [minMin, maxMin]);
  const steps = Math.round((maxMin - minMin) / stepMin);
  const ticks = useMemo(() => Array.from({ length: steps + 1 }, (_, i) => {
    const v = minMin + i * stepMin, major = v % 60 === 0 && (steps <= 12 || v % 240 === 0 || v === maxMin);
    const [x1, y1] = pt(toDeg(v), R - 16), [x2, y2] = pt(toDeg(v), R - (major ? 24 : 20));
    return { v, major, x1, y1, x2, y2 };
  }), [steps, minMin, stepMin, maxMin, toDeg]);

  const set = useCallback((v: number) => {
    const nv = clamp(v);
    if (nv === curRef.current) return;
    curRef.current = nv;
    setInner(nv);
    setFlash((f) => ({ v: nv, n: (f?.n || 0) + 1 }));
    onChange?.(nv);
  }, [clamp, onChange]);

  // keep the uncontrolled value in range if limits change
  useEffect(() => { setInner((x) => clamp(x)); }, [clamp]);

  function fromPointer(e: React.PointerEvent) {
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 240 - CX, y = ((e.clientY - r.top) / r.height) * 240 - CY;
    let deg = (Math.atan2(y, x) * 180) / Math.PI; if (deg < 0) deg += 360;
    let rel = deg - A0; if (rel < 0) rel += 360;
    if (rel > SWEEP) rel = rel > SWEEP + (360 - SWEEP) / 2 ? 0 : SWEEP; // the gap at the bottom snaps to the nearest end
    const prevRel = toDeg(curRef.current) - A0; // don't wrap from max to min (or back) in one drag
    if (dragging.current && Math.abs(rel - prevRel) > 180) rel = prevRel > 135 ? SWEEP : 0;
    set(minMin + (rel / SWEEP) * (maxMin - minMin));
  }
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => { dragging.current = true; setDrag(true); e.currentTarget.setPointerCapture(e.pointerId); fromPointer(e); };
  const onMove = (e: React.PointerEvent) => { if (dragging.current) fromPointer(e); };
  const onUp = () => { dragging.current = false; setDrag(false); };
  const onKey = (e: React.KeyboardEvent) => {
    const s = stepMin, map: Record<string, number> = { ArrowRight: s, ArrowUp: s, ArrowLeft: -s, ArrowDown: -s, PageUp: s * 4, PageDown: -s * 4 };
    if (e.key in map) { e.preventDefault(); set(curRef.current + map[e.key]); }
    else if (e.key === "Home") { e.preventDefault(); set(minMin); }
    else if (e.key === "End") { e.preventDefault(); set(maxMin); }
  };

  const d = toDeg(cur), [kx, ky] = pt(d);
  const fillD = cur > minMin ? arc(A0, d) : `M${pt(A0).join(",")} L${pt(A0 + 0.5).join(",")}`;
  const exitMs = startMs !== undefined ? startMs + cur * MIN : 0;
  const subNode = sub ? sub(cur) : startMs !== undefined
    ? <>Exit <b>{timeLabel(exitMs)}</b>{dayLabel(exitMs) !== dayLabel(startMs) ? ` · ${dayLabel(exitMs)}` : ""}</>
    : null;

  return (
    <div className={["dial", size === "sm" ? "dial-sm" : "", drag ? "is-drag" : "", className].filter(Boolean).join(" ")}>
      <svg ref={svgRef} viewBox="0 0 240 240" className="dial-svg" aria-hidden="true">
        <path className="dial-track" d={arc(A0, A0 + SWEEP)} />
        <g className="dial-ticks">
          {ticks.map((t) => (
            <line key={t.v + (flash && flash.v === t.v ? "-f" + flash.n : "")} x1={t.x1.toFixed(1)} y1={t.y1.toFixed(1)} x2={t.x2.toFixed(1)} y2={t.y2.toFixed(1)}
              className={`dial-tick${t.major ? " is-major" : ""}${flash && flash.v === t.v ? " is-flash" : ""}`} />
          ))}
        </g>
        <path className="dial-fill" d={fillD} />
        <g className="dial-knob" transform={`translate(${kx.toFixed(2)} ${ky.toFixed(2)})`}><circle r="15" className="dial-knob-halo" /><circle r="11" className="dial-knob-dot" /></g>
      </svg>
      <div className="dial-center">
        <div className="dial-label">{label}</div>
        <div className="dial-value"><RollNumber value={prefix + durationShort(cur)} /></div>
        <div className="dial-sub">{subNode}</div>
      </div>
      <div className="dial-hit" role="slider" tabIndex={0} aria-label={label} aria-valuemin={minMin} aria-valuemax={maxMin} aria-valuenow={cur}
        aria-valuetext={durationLabel(cur / 60)} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onKey} />
    </div>
  );
}
