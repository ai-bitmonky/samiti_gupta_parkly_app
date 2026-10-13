/* Amenity icon chips for a facility (EV, accessible, two-wheelers, covered, CCTV, guarded, overnight).
   <AmenityIcons facility={f} max={5} />  → <div class="amen-row"><span class="amen-chip">…</span>…</div>
   variant="chips" renders labelled .chip.chip-sm instead (detail pages). */
import type { Facility } from "@/lib/data";
import { amenityIcons } from "@/lib/engine";
import Icon from "./Icon";

export default function AmenityIcons({ facility, max = 7, variant = "icons", className = "" }: { facility: Facility; max?: number; variant?: "icons" | "chips"; className?: string }) {
  const list = amenityIcons(facility).slice(0, max);
  if (variant === "chips")
    return <div className={`chip-row ${className}`.trim()}>{list.map((a) => <span key={a.label} className="chip chip-sm"><Icon name={a.icon} size={13} />{a.label}</span>)}</div>;
  return (
    <div className={`amen-row ${className}`.trim()}>
      {list.map((a) => <span key={a.label} className="amen-chip" title={a.label} aria-label={a.label}><Icon name={a.icon} size={14} /></span>)}
    </div>
  );
}
