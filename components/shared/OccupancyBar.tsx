/* Occupancy bar "38 of 120 free" (bar length = share free; ok/warn/danger tone from engine.availTone).
   <OccupancyBar free={38} capacity={120} className="occ-row" /> */
import { availTone, toneClass } from "@/lib/engine";

export default function OccupancyBar({ free, capacity, className = "" }: { free: number; capacity: number; className?: string }) {
  const tone = toneClass(availTone(free, capacity));
  const pct = capacity ? Math.max(0, Math.min(100, Math.round((free / capacity) * 100))) : 0;
  return (
    <div className={`occ occ-${tone} ${className}`.trim()} role="img" aria-label={`${free} of ${capacity} spaces free`}>
      <div className="occ-track"><div className="occ-fill" style={{ width: `${pct}%` }} /></div>
      <div className="occ-label">{free <= 0 ? "Full for your time" : <><b>{free}</b> of {capacity} free</>}</div>
    </div>
  );
}
