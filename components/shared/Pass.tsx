/* Boarding pass (PARKLY PASS): bay huge, barrier icon (arm lifts after check-in), entry/exit, plate, ref or gate code,
   Drive → Enter → Park → Exit step rail, perforated tear line, real QR + scan line.
   <Pass booking={b} now={now} printing variant="mobile" | "desktop" compact />
     printing  play the print animation (pass slides up, perforation draws in, QR fades in, one lime scan sweep)
     variant   "mobile" = prototype mobile pass (.m-pass, chip step rail, red/white barrier)
               "desktop" = prototype desktop pass (line step rail, lime boom; level as the small label)
     compact   desktop only: hide the step rail */
import type { Booking, Facility } from "@/lib/data";
import { bookingStatus, dayLabel, facilityOrThrow, gateCode, isOverstay, timeLabel } from "@/lib/engine";
import { passPayload } from "@/lib/qr";
import { StatusBadge } from "./Badge";
import Plate from "./Plate";
import QRCode from "./QRCode";

export function Barrier({ up }: { up: boolean }) {
  return (
    <svg className={`barrier${up ? " is-up" : ""}`} width="64" height="40" viewBox="0 0 64 40" aria-hidden="true">
      <rect x="2" y="16" width="8" height="24" rx="2" fill="#3A4741" />
      <g className="barrier-arm"><rect x="6" y="17" width="56" height="5" rx="2.5" fill="#F5F4EF" /><rect x="18" y="17" width="8" height="5" fill="#FF5A5F" /><rect x="38" y="17" width="8" height="5" fill="#FF5A5F" /></g>
    </svg>
  );
}
export function Boom({ up }: { up: boolean }) {
  return (
    <svg className={`boom${up ? " is-up" : ""}`} viewBox="0 0 64 40" aria-hidden="true">
      <rect x="8" y="16" width="10" height="22" rx="2" fill="currentColor" opacity=".5" />
      <g className="arm"><rect x="10" y="17" width="52" height="6" rx="3" fill="currentColor" /><rect x="24" y="17" width="7" height="6" fill="#0A0F0C" opacity=".6" /><rect x="40" y="17" width="7" height="6" fill="#0A0F0C" opacity=".6" /></g>
      <circle cx="13" cy="20" r="3.5" fill="#C6F432" />
    </svg>
  );
}

const STEPS = ["Drive", "Enter", "Park", "Exit"];

export default function Pass({ booking: b, facility, now, printing = false, variant = "mobile", compact = false, className = "" }: {
  booking: Booking; facility?: Facility; now?: number; printing?: boolean; variant?: "mobile" | "desktop"; compact?: boolean; className?: string;
}) {
  const f = facility || facilityOrThrow(b.facilityId);
  const drive = f.type === "driveway";
  const parts = b.bay.split("·").map((x) => x.trim());
  const st = bookingStatus(b, now), over = isOverstay(b, now);
  const mobile = variant === "mobile";
  // mobile: big = bay number, small = "Bay"/"Space"; desktop: big = "Bay 14", small = level
  const bay = mobile ? (parts.length > 1 ? parts[1].replace(/^Bay\s*/, "") : parts[0]) : parts.length > 1 ? parts[1] : parts[0];
  const lvl = parts.length > 1 ? parts[0] : mobile ? f.levels[0] : f.area;
  const stepI = mobile
    ? (b.exitedAt ? 3 : b.arrivedAt ? 2 : st === "active" ? 1 : 0)
    : (st === "completed" || over ? 3 : b.arrivedAt ? 2 : st === "active" ? 1 : 0);
  const cls = ["pass", "has-perf", mobile ? "m-pass" : "", printing ? "is-printing" : "", className].filter(Boolean).join(" ");

  return (
    <article className={cls} aria-label={`Parking pass for ${f.name}`}>
      <div className="pass-top grain">
        <div className="pass-head"><span className="pass-brand">PARKLY PASS</span><StatusBadge booking={b} now={now} /></div>
        <div className="pass-bay-row">
          <div className={`pass-bay${mobile && bay.length > 4 ? " is-word" : ""}`}><small>{mobile ? (drive ? "Space" : "Bay") : lvl}</small>{bay}</div>
          {mobile ? <Barrier up={!!b.arrivedAt} /> : <Boom up={!!b.arrivedAt} />}
        </div>
        <div className="small ink-2 mt-8">{mobile ? <>{f.name}{lvl !== bay ? " · " + lvl : ""}</> : <>{f.name} · {f.area}</>}</div>
        <div className="pass-grid">
          <div className="pass-cell"><div className="eyebrow">Entry</div><div className="v">{timeLabel(b.start)}</div><div className="tiny muted">{dayLabel(b.start)}</div></div>
          <div className="pass-cell"><div className="eyebrow">{mobile ? "Exit by" : "Exit"}</div><div className="v">{timeLabel(b.end)}</div><div className="tiny muted">{dayLabel(b.end)}</div></div>
          <div className="pass-cell"><div className="eyebrow">Vehicle</div><div className="v"><Plate plate={b.vehicle.plate} size="sm" /></div></div>
          <div className="pass-cell"><div className="eyebrow">{drive ? "Gate code" : mobile ? "Ref" : "Reference"}</div><div className="v selectable">{drive ? gateCode(b) : b.ref}</div></div>
        </div>
        {mobile ? (
          <div className="pass-rail">{STEPS.map((s, i) => <span key={s} className={i === stepI ? "is-on" : i < stepI ? "is-done" : ""}>{s}</span>)}</div>
        ) : !compact && (
          <ol className="pass-steps">{STEPS.map((s, i) => <li key={s} className={i < stepI ? "is-done" : i === stepI ? "is-now" : ""}>{s}</li>)}</ol>
        )}
      </div>
      <div className="pass-tear"><svg className="perf" preserveAspectRatio="none" viewBox="0 0 100 2" aria-hidden="true"><line x1="0" y1="1" x2="100" y2="1" /></svg></div>
      <div className="pass-bottom pass-qr">
        <div className="qr-wrap"><QRCode text={passPayload(b.ref, b.vehicle.plate)} /><i className="scan" /></div>
        <div>
          <div className="h3">Scan at entry</div>
          {mobile ? (
            <>
              <div className="small muted mt-4">Hold the code under the reader at the boom barrier.{drive ? " Or type the gate code." : ""}</div>
              <div className="mono tiny muted mt-8 selectable">{b.ref}</div>
            </>
          ) : (
            <>
              <div className="small muted mt-4">{drive ? "Show this code to the owner, or type the gate code on the keypad." : "Hold the code under the reader at the boom barrier."}</div>
              {drive && <div className="pass-code">REF {b.ref}</div>}
            </>
          )}
        </div>
      </div>
    </article>
  );
}
