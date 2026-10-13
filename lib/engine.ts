/* PARKLY · lib/engine.ts
   Pure functions ported 1:1 from the prototype's engine.js (sections 1–7):
   1 time · 2 money & pricing · 3 geo · 4 availability · 5 validation & status · 6 search & ranking · 7 seed state.
   No React and no store here. Functions that read app state take it as an explicit argument (`st`).
   The demo/test clock lives here (module level) so every function reads time through now(). */
import D from "./data";
import type {
  AppState, AvailTone, Booking, BookingMode, BookingStatus, CustomPlace, Destination, Facility, Filters, LatLng,
  PolicyId, Quote, BillLine, Search, Tone, Vehicle, VehicleType, SeedWhen, Refund, PaymentMethodId,
} from "./data";

export { D };
export const HOUR = 3600000;
export const MIN = 60000;
export const SLOT = 30 * MIN; // availability is checked in 30-minute slots
export const STORE_KEY = "parkly.app.v1";
export const STATE_VERSION = 1;
const pad2 = (n: number) => String(n).padStart(2, "0");
type TimeLike = number | string | Date;
const ms = (t: TimeLike) => new Date(t).getTime();

/* ───────────────────────── 1. TIME ───────────────────────── */
// Demo clock: the whole app reads time through now(), so the test clock can move it.
let clockOffsetMin = 0;
export const now = () => Date.now() + clockOffsetMin * MIN;
export const setClockOffsetRaw = (min: number) => { clockOffsetMin = min || 0; };
export const getClockOffset = () => clockOffsetMin;

export const dateKey = (t: TimeLike) => { const d = new Date(t); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }; // 2026-10-13
export const timeKey = (t: TimeLike) => { const d = new Date(t); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }; // 14:30
/** local Date from "YYYY-MM-DD" + "HH:MM" */
export function at(dk: string, tk: string): Date {
  const [y, m, d] = dk.split("-").map(Number);
  const [h, mi] = tk.split(":").map(Number);
  return new Date(y, m - 1, d, h, mi, 0, 0);
}
export const ceilHalfHour = (t: number) => Math.ceil(t / SLOT) * SLOT;
export const startOfDay = (t: TimeLike) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const addDays = (t: TimeLike, n: number) => { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); };
export const TIMES = Array.from({ length: 48 }, (_, i) => `${pad2(Math.floor(i / 2))}:${i % 2 ? "30" : "00"}`); // 00:00 … 23:30
/** "14:30" → "2:30 pm" */
export function time12(tk: string) {
  const [h, m] = tk.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${pad2(m)} ${h >= 12 ? "pm" : "am"}`;
}
export const timeLabel = (t: TimeLike) => time12(timeKey(t)); // any date → "2:30 pm"
export const dateLabel = (t: TimeLike, o: { weekday?: boolean; year?: boolean } = { weekday: true }) =>
  new Date(t).toLocaleDateString("en-IN", { weekday: o.weekday ? "short" : undefined, day: "numeric", month: "short", year: o.year ? "numeric" : undefined });
/** Today / Tomorrow / Yesterday / Tue, 14 Oct */
export function dayLabel(t: TimeLike) {
  const diff = Math.round((startOfDay(ms(t)) - startOfDay(now())) / (24 * HOUR));
  return diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : diff === -1 ? "Yesterday" : dateLabel(t);
}
/** "Today, 2:00 pm – 4:00 pm" or "Today 9:00 pm → Tomorrow 1:00 am" */
export function windowLabel(a: TimeLike, b: TimeLike) {
  return startOfDay(ms(a)) === startOfDay(ms(b))
    ? `${dayLabel(a)}, ${timeLabel(a)} – ${timeLabel(b)}`
    : `${dayLabel(a)} ${timeLabel(a)} → ${dayLabel(b)} ${timeLabel(b)}`;
}
/** 2.5 → "2 h 30 min" */
export function durationLabel(hours: number) {
  const t = Math.round(hours * 60), d = Math.floor(t / 1440), h = Math.floor((t % 1440) / 60), m = t % 60, out: string[] = [];
  if (d) out.push(`${d} day${d > 1 ? "s" : ""}`);
  if (h) out.push(`${h} h`);
  if (m) out.push(`${m} min`);
  return out.join(" ") || "0 min";
}
/** 150 → "2 h 30 m" (dial centre) */
export function durationShort(min: number) {
  const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60, out: string[] = [];
  if (d) out.push(`${d} d`);
  if (h) out.push(`${h} h`);
  if (m || !out.length) out.push(`${m} m`);
  return out.join(" ");
}
/** ms left → "1h 05m" / "4:09" / "2d 3h 10m" */
export function countdown(left: number) {
  if (left <= 0) return "0:00";
  const t = Math.floor(left / 1000), d = Math.floor(t / 86400), h = Math.floor((t % 86400) / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return d ? `${d}d ${h}h ${m}m` : h ? `${h}h ${pad2(m)}m` : `${m}:${pad2(s)}`;
}
export function ago(iso: TimeLike) {
  const m = Math.round((now() - ms(iso)) / MIN);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}
/** Default search window: next half hour + 30 min, 2 h long; at night jump to 10:00. */
export function defaultWindow(t: number) {
  let s = ceilHalfHour(t + 30 * MIN);
  const hr = new Date(s).getHours();
  if (hr >= 20 || hr < 8) {
    const day = hr >= 20 ? addDays(startOfDay(t), 1) : startOfDay(t);
    s = at(dateKey(day), "10:00").getTime();
  }
  return { start: new Date(s).toISOString(), end: new Date(s + 2 * HOUR).toISOString() };
}

/* ───────────────────── 2. MONEY & PRICING ───────────────────── */
const P = D.pricing;
export const money = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
export const facility = (id: string): Facility | undefined => D.facilities.find((f) => f.id === id);
/** Facility lookup that throws on a bad id — use where the id is known to be valid. */
export const facilityOrThrow = (id: string): Facility => { const f = facility(id); if (!f) throw new Error(`Unknown facility ${id}`); return f; };
export const destination = (id: string): Destination | undefined => D.destinations.find((d) => d.id === id);
export const rateFor = (f: Facility, vType: VehicleType) => Math.round(f.rate * D.vehicleMultipliers[vType]); // ₹ per hour
export const dailyFor = (f: Facility, vType: VehicleType) => (f.dailyRate ? Math.round(f.dailyRate * D.vehicleMultipliers[vType]) : undefined);
export const numLabel = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export interface PromoResult { ok: boolean; amount: number; message: string }
/** Promo rules → {ok, amount, message}. parking = parking charge before fees; startMs decides weekend. */
export function applyPromo(code: string | undefined, parking: number, startMs: number): PromoResult {
  const c = (code || "").trim().toUpperCase();
  if (!c) return { ok: false, amount: 0, message: "Enter a promo code." };
  if (c === "PARK10") {
    const a = Math.min(100, Math.round(parking * 0.1));
    return { ok: true, amount: a, message: `PARK10 applied: ${money(a)} off parking.` };
  }
  if (c === "FIRSTPARK")
    return parking < 150
      ? { ok: false, amount: 0, message: `FIRSTPARK needs a parking charge of ₹150 or more. Yours is ${money(parking)}.` }
      : { ok: true, amount: 50, message: "FIRSTPARK applied: ₹50 off." };
  if (c === "WEEKEND20") {
    const day = new Date(startMs).getDay();
    if (day !== 0 && day !== 6) return { ok: false, amount: 0, message: "WEEKEND20 only works for bookings that start on a Saturday or Sunday." };
    const a = Math.min(150, Math.round(parking * 0.2));
    return { ok: true, amount: a, message: `WEEKEND20 applied: ${money(a)} off.` };
  }
  return { ok: false, amount: 0, message: `“${c}” isn't a valid code. Try PARK10.` };
}

export interface QuoteInput {
  facility: Facility; start: TimeLike; end: TimeLike; mode?: BookingMode; vehicleType?: VehicleType;
  evCharging?: boolean; promo?: string; includeFees?: boolean;
}
/** Price breakdown. Hourly billing rounds up to 30 min, minimum 1 h; daily cap applies. */
export function quote(q: QuoteInput): Quote {
  const f = q.facility, start = ms(q.start), end = ms(q.end), mode = q.mode || "hourly", vt = q.vehicleType || "hatchback";
  const hours = Math.max(0, (end - start) / HOUR);
  const step = P.billingStepMin / 60;
  const billed = Math.max(1, Math.ceil(hours / step - 1e-9) * step);
  const rate = rateFor(f, vt), daily = dailyFor(f, vt);
  const lines: BillLine[] = [];
  let base = 0, additional = 0, subtotal = 0, capped = false;
  if (mode === "daily" && daily) {
    const days = Math.max(1, Math.ceil(hours / 24 - 1e-9));
    base = daily; additional = (days - 1) * daily; subtotal = base + additional;
    lines.push({ label: "First day", amount: base, hint: `${money(daily)} / day` });
    if (additional) lines.push({ label: `Additional ${days - 1} day${days > 2 ? "s" : ""}`, amount: additional });
  } else {
    base = rate; additional = rate * (billed - 1);
    const raw = base + additional;
    subtotal = raw;
    if (daily) { // never charge more than the daily rate per 24 h
      const fullDays = Math.floor(billed / 24), rest = billed - fullDays * 24;
      const cappedTotal = fullDays * daily + Math.min(rest * rate, daily);
      if (cappedTotal < raw) { subtotal = cappedTotal; capped = true; }
    }
    lines.push({ label: "First hour", amount: base, hint: `${money(rate)} / hour` });
    if (billed > 1) lines.push({ label: `Additional ${numLabel(billed - 1)} h`, amount: additional, hint: `${money(rate)} × ${numLabel(billed - 1)}` });
    if (capped) lines.push({ label: "Daily cap applied", amount: subtotal - raw, hint: `Max ${money(daily as number)} per 24 h` });
  }
  const vehicleAdj = subtotal - Math.round(subtotal / D.vehicleMultipliers[vt]);
  const ev = q.evCharging && f.ev ? P.evReserve : 0;
  if (ev) lines.push({ label: "EV charger reservation", amount: ev, hint: "Energy billed at the charger" });
  const fee = q.includeFees !== false ? P.convenienceFee : 0;
  if (fee) lines.push({ label: "Convenience fee", amount: fee, hint: "Non-refundable" });
  let discount = 0;
  let promo: string | undefined;
  if (q.promo) {
    const r = applyPromo(q.promo, subtotal, start);
    if (r.ok) { discount = r.amount; promo = q.promo.trim().toUpperCase(); lines.push({ label: `Promo ${promo}`, amount: -discount }); }
  }
  const net = Math.max(0, subtotal + ev + fee - discount);
  const tax = Math.round(net * P.gst);
  lines.push({ label: "GST (18%)", amount: tax });
  return { hours, billedHours: billed, mode, base, additional, dailyCapApplied: capped, vehicleAdj, evCharging: ev,
    subtotal, convenience: fee, discount, promo, tax, total: net + tax, lines };
}

/** Refund % by policy and hours left before entry. */
export function policyPercent(policy: PolicyId, hoursLeft: number) {
  if (hoursLeft <= 0) return 0;
  if (policy === "flexible") return hoursLeft >= 1 ? 100 : 50;
  if (policy === "moderate") return hoursLeft >= 24 ? 100 : hoursLeft >= 2 ? 50 : 0;
  if (policy === "strict") return hoursLeft >= 24 ? 50 : 0;
  return 0;
}
// Hours before entry at which the refund drops to the next band (for the "deadline countdown").
const POLICY_STEPS: Record<PolicyId, number[]> = { flexible: [1, 0], moderate: [24, 2], strict: [24] };
/** → {at (ms), percentNow, percentAfter} or null */
export function cancelDeadline(booking: Booking, f: Facility, nowMs = now()) {
  const startMs = ms(booking.start);
  for (const h of POLICY_STEPS[f.policy] || []) {
    const t = startMs - h * HOUR;
    if (t > nowMs) return { at: t, percentNow: policyPercent(f.policy, (startMs - nowMs) / HOUR), percentAfter: policyPercent(f.policy, h - 0.001) };
  }
  return null;
}
export const paidSoFar = (b: Booking) => b.payment.amount + b.payment.adjustments.reduce((s, a) => s + a.amount, 0);

export interface RefundPreview { amount: number; percent: number; note: string; paid: number }
export function refundPreview(b: Booking, f: Facility, nowMs = now(), pending = false): RefundPreview {
  const paid = paidSoFar(b);
  const fee = Math.round(P.convenienceFee * (1 + P.gst)); // ₹18, never refunded
  const hoursLeft = (ms(b.start) - nowMs) / HOUR;
  const percent = pending ? 100 : policyPercent(f.policy, hoursLeft);
  const base = pending ? paid : Math.max(0, paid - fee);
  const amount = Math.round((base * percent) / 100);
  const name = D.policies[f.policy].title.toLowerCase();
  const note = pending ? "Not yet confirmed by the operator, so you get a full refund."
    : percent === 100 ? `Full refund under the ${name} policy. The ${money(fee)} convenience fee is non-refundable.`
    : percent === 0 ? `No refund: you're inside the ${name} policy's no-refund window.`
    : `${percent}% refund under the ${name} policy, after the ${money(fee)} non-refundable fee.`;
  return { amount, percent, note, paid };
}
/** Overstay: free for 15 min grace, then every started hour at 1.5× rate + GST. */
export function overstayFee(f: Facility, vType: VehicleType, overMs: number) {
  if (overMs <= 15 * MIN) return 0;
  return Math.round(Math.ceil(overMs / HOUR) * rateFor(f, vType) * P.overstayMultiplier * (1 + P.gst));
}

/* ───────────────────────── 3. GEO ───────────────────────── */
/** haversine km */
export function distKm(a: LatLng, b: LatLng) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
export const walkMin = (km: number) => Math.max(1, Math.round(((km * 1.3) / 4.8) * 60)); // 1.3 detour factor, 4.8 km/h
export const kmLabel = (km: number) => (km < 1 ? `${Math.round((km * 1000) / 10) * 10} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`);
export const mapsUrl = (p: LatLng, mode = "driving") => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=${mode}`;

/* ───────────────────── 4. AVAILABILITY ───────────────────── */
/** Deterministic 0..1 hash (FNV-1a) so "live" numbers are stable for a given seed. */
export function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}
const WEEKEND_BUSY = ["lajpat", "saket", "khan", "hkv", "cyberhub", "karolbagh", "chandni"];
const WEEKEND_QUIET = ["nehru-place", "cp-metro"];
/** Spaces taken by other (simulated) drivers at a moment. */
export function simulatedOccupied(f: Facility, t: number, seed: number) {
  const d = new Date(t), hr = d.getHours();
  let load = D.busynessCurve[hr];
  if (f.id === "igi-t3" || f.id === "aerocity-ev") load = 0.55 + load * 0.3; // airports stay steady
  const weekend = d.getDay() === 0 || d.getDay() === 6;
  if (weekend && WEEKEND_BUSY.includes(f.id)) load = Math.min(1.08, load * 1.12);
  if (weekend && WEEKEND_QUIET.includes(f.id)) load *= 0.6;
  const noise = hash(`${f.id}|${dateKey(d)}|${hr}|${seed}`) - 0.5;
  return Math.max(0, Math.min(f.capacity, Math.round(f.capacity * (f.busyness * load + noise * 0.12))));
}
type BookingLike = Pick<Booking, "id" | "facilityId" | "start" | "end"> & Partial<Pick<Booking, "cancelledAt" | "exitedAt" | "vehicleId">>;
export const isLive = (b: Partial<Pick<Booking, "cancelledAt" | "exitedAt">>) => !b.cancelledAt && !b.exitedAt;
/** Our own bookings that hold a space in the 30-min slot starting at slotMs. */
export const overlapBookings = (bookings: BookingLike[], fid: string, slotMs: number, excludeId?: string) =>
  bookings.filter((b) => b.facilityId === fid && b.id !== excludeId && isLive(b) &&
    ms(b.start) < slotMs + SLOT && ms(b.end) > slotMs).length;

/** free = the fewest free spaces in any 30-min slot of the window; fullSlot = ms of the first full slot. */
export function availability(f: Facility, start: number, end: number, bookings: BookingLike[] = [], seed = 1, excludeId?: string): { free: number; fullSlot?: number } {
  if (end <= start) return { free: 0 };
  let min = Infinity;
  let fullSlot: number | undefined;
  for (let t = Math.floor(start / SLOT) * SLOT; t < end; t += SLOT) {
    const free = f.capacity - simulatedOccupied(f, t, seed) - overlapBookings(bookings, f.id, t, excludeId);
    if (free < min) min = free;
    if (free <= 0 && fullSlot === undefined) fullSlot = t;
  }
  return { free: Math.max(0, min), fullSlot };
}
export function isOpenAt(f: Facility, t: number) {
  if (f.is24h) return true;
  const dk = dateKey(t);
  return t >= at(dk, f.open).getTime() && t < at(dk, f.close).getTime();
}
export interface HourCell { hour: number; free: number; ratio: number }
/** 24 cells from dayStartMs: {hour, free (-1 = closed), ratio} */
export const hourlyAvailability = (f: Facility, dayStartMs: number, bookings: BookingLike[], seed: number): HourCell[] =>
  Array.from({ length: 24 }, (_, h) => {
    const t = dayStartMs + h * HOUR, open = isOpenAt(f, t) && isOpenAt(f, t + HOUR - 1);
    const a = availability(f, t, t + HOUR, bookings, seed);
    return { hour: h, free: open ? a.free : -1, ratio: open ? a.free / f.capacity : 0 };
  });
export const hoursLabel = (f: Facility) => (f.is24h ? "Open 24 hours" : `${time12(f.open)} – ${time12(f.close)}`);
/** 'none' = full, 'low' = few left (≤10% or ≤2), 'ok' */
export const availTone = (free: number, capacity: number): AvailTone => (free <= 0 ? "none" : free <= Math.max(2, capacity * 0.1) ? "low" : "ok");
export const toneClass = (tone: AvailTone): "danger" | "warn" | "ok" => ({ none: "danger", low: "warn", ok: "ok" } as const)[tone];

/* ───────────────── 5. VALIDATION & STATUS ───────────────── */
export interface Issue { field: "start" | "end" | "vehicle" | "availability"; message: string }
export interface ValidateInput {
  facility: Facility; start: TimeLike; end: TimeLike; mode?: BookingMode; vehicle?: Vehicle;
  bookings?: Booking[]; seed?: number; nowMs?: number; excludeId?: string; allowPastStart?: boolean;
}
export const vehicleLabel = (t: VehicleType) => D.vehicleLabels[t];
export function validateBooking(o: ValidateInput): { issues: Issue[]; free: number } {
  const f = o.facility, start = ms(o.start), end = ms(o.end), v = o.vehicle, issues: Issue[] = [];
  const nowMs = o.nowMs ?? now();
  if (!o.allowPastStart && start < nowMs - MIN) issues.push({ field: "start", message: "Entry time has already passed. Choose a later time." });
  if (end <= start) issues.push({ field: "end", message: "Exit time must be after the entry time." });
  else if (end - start < 30 * MIN) issues.push({ field: "end", message: "Minimum booking is 30 minutes." });
  if (f.is24h) {
    if (end - start > 7 * 24 * HOUR) issues.push({ field: "end", message: "Bookings can be at most 7 days long." });
  } else {
    const dk = dateKey(start), open = at(dk, f.open).getTime(), close = at(dk, f.close).getTime();
    if (start < open || start >= close)
      issues.push({ field: "start", message: `${f.name} is open ${time12(f.open)} – ${time12(f.close)}. Pick an entry time inside those hours.` });
    else if (end > close)
      issues.push({ field: "end", message: `Closes at ${time12(f.close)} and doesn't allow overnight parking. Choose an exit by ${time12(f.close)}.` });
  }
  if (v && !f.vehicleTypes.includes(v.type)) {
    const why = v.type === "suv" && f.heightLimit ? ` (height limit ${f.heightLimit} m)` : v.type === "motorcycle" ? " (no two-wheeler bays)" : "";
    issues.push({ field: "vehicle", message: `${D.vehicleLabels[v.type]}s can't park here${why}. Choose another vehicle or facility.` });
  }
  if (v) {
    const clash = (o.bookings || []).find((b) => b.id !== o.excludeId && b.vehicleId === v.id && isLive(b) &&
      ms(b.start) < end && ms(b.end) > start);
    if (clash) issues.push({ field: "vehicle", message: `${v.plate} already has a booking ${dayLabel(clash.start)} ${timeLabel(clash.start)}–${timeLabel(clash.end)} that overlaps this time.` });
  }
  let free = 0;
  if (end > start) {
    const a = availability(f, start, end, o.bookings || [], o.seed ?? 1, o.excludeId);
    free = a.free;
    if (a.free <= 0 && a.fullSlot !== undefined)
      issues.push({ field: "availability", message: `Fully booked from ${timeLabel(a.fullSlot)}. Try an earlier or shorter slot, or a nearby facility.` });
  }
  return { issues, free };
}
/** pending | upcoming | active | completed | cancelled */
export function bookingStatus(b: Booking, nowMs = now()): BookingStatus {
  if (b.cancelledAt) return "cancelled";
  if (b.exitedAt) return "completed";
  if (nowMs < ms(b.confirmedAt)) return "pending";
  const s = ms(b.start), e = ms(b.end);
  return nowMs < s ? "upcoming" : nowMs < e || (b.arrivedAt && nowMs < e + 4 * HOUR) ? "active" : "completed";
}
export const isOverstay = (b: Booking, nowMs = now()) => !!b.arrivedAt && !b.exitedAt && !b.cancelledAt && nowMs > ms(b.end);
export const statusTone = (s: BookingStatus): Tone => ({ pending: "warn", upcoming: "lime", active: "ok", completed: "neutral", cancelled: "danger" } as const)[s];
export function genRef() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return `PK-${s}-${Math.floor(10 + Math.random() * 89)}`;
}
export function genBay(f: Facility) {
  const lvl = f.levels[Math.floor(Math.random() * f.levels.length)];
  return f.capacity <= 2 ? lvl : `${lvl} · Bay ${String(1 + Math.floor(Math.random() * Math.min(80, f.capacity))).padStart(2, "0")}`;
}
/** 4-digit gate code for private driveways (stable per booking ref). */
export const gateCode = (b: Pick<Booking, "ref">) => String(1000 + Math.floor(hash(b.ref) * 9000));
export const uid = () => Math.random().toString(36).slice(2, 10);
export const PLATE_RE = /^[A-Z]{2}\s?\d{1,2}\s?[A-Z]{0,3}\s?[A-Z]{0,3}\s?\d{4}$/; // DL 8C AF 4521, MH 12 AB 1234, HR26DK8337
export const normPlate = (p: string | undefined | null) => String(p || "").toUpperCase().replace(/\s+/g, " ").trim();
export const validPlate = (p: string) => PLATE_RE.test(normPlate(p));
/** Calendar links for a booking → {google, ics} */
export function calendarLinks(b: Booking, f: Facility) {
  const z = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const title = `Parking: ${f.name}`, details = `PARKLY booking ${b.ref}\n${b.bay} · ${b.vehicle.plate}`;
  const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${z(b.start)}/${z(b.end)}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(f.address)}`;
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//PARKLY//Bookings//EN", "BEGIN:VEVENT", `UID:${b.id}@parkly.app`,
    `DTSTAMP:${z(new Date().toISOString())}`, `DTSTART:${z(b.start)}`, `DTEND:${z(b.end)}`, `SUMMARY:${title}`,
    `LOCATION:${f.address.replace(/,/g, "\\,")}`, `DESCRIPTION:${details.replace(/\n/g, "\\n")}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  return { google, ics };
}
/** Browser-only: download a text file. */
export function downloadFile(name: string, text: string, type = "text/plain") {
  try {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch { return false; }
}
/** Browser-only: true when the OS asks for reduced motion or the in-app "Reduce motion" pref is on. */
export const reducedMotion = () =>
  typeof window !== "undefined" &&
  ((typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches) || document.documentElement.getAttribute("data-motion") === "reduce");

/* ─────────────────── 6. SEARCH & RANKING ─────────────────── */
export interface SearchCenter extends LatLng { name: string; area: string }
/** Where the search is centred: a custom point (Near me / map area) or a destination. */
export function searchCenter(search: Pick<Search, "custom" | "destId">): SearchCenter {
  if (search.custom) return { ...search.custom, area: "Pinned location" };
  const d = destination(search.destId) || (destination("cp") as Destination);
  return { lat: d.lat, lng: d.lng, name: d.name, area: d.area };
}
export const matchesType = (f: Facility, t: string) => (t === "ev" ? !!f.ev : t === "covered" ? f.covered : t === "uncovered" ? !f.covered : f.type === t);

/** One facility measured against a search. */
export interface Result { f: Facility; km: number; walk: number; free: number; rate: number; total: number; score: number; reason: string }
/** Adds score (0..1) and a plain-words reason line to each result. Mutates and returns the list. */
export function rankResults(list: Result[], vType: VehicleType) {
  if (!list.length) return list;
  const rates = list.map((r) => r.rate), lo = Math.min(...rates), hi = Math.max(...rates);
  const far = Math.max(1, ...list.map((r) => r.km));
  for (const r of list) {
    const price = hi === lo ? 1 : 1 - (r.rate - lo) / (hi - lo);
    const parts = [
      { k: "dist", v: (1 - r.km / far) * 0.36 },
      { k: "price", v: price * 0.26 },
      { k: "rating", v: Math.max(0, (r.f.rating - 3.5) / 1.5) * 0.2 },
      { k: "avail", v: (r.free <= 0 ? -1 : Math.min(1, r.free / Math.max(3, r.f.capacity * 0.25))) * 0.18 },
      { k: "ev", v: (vType === "ev" && r.f.ev ? 1 : 0) * 0.12 },
    ] as const;
    r.score = parts.reduce((s, p) => s + p.v, 0);
    const words: Record<string, string> = {
      dist: r.walk <= 15 ? `${r.walk} min walk to your destination` : "Closest drive-in option",
      price: price > 0.7 ? "Among the cheapest nearby" : "Fair hourly rate",
      rating: `Rated ${r.f.rating} by ${r.f.reviewCount.toLocaleString("en-IN")} drivers`,
      avail: `${r.free} spaces free for your time`,
      ev: "Has chargers for your EV",
    };
    const top = parts.filter((p) => p.v > 0.05).sort((a, b) => b.v - a.v).slice(0, 2);
    r.reason = r.free <= 0 ? "Full for your selected time" : top.map((p) => words[p.k]).join(" · ");
  }
  return list;
}
export function sortCompare(sort: string) {
  return (a: Result, b: Result) => {
    switch (sort) {
      case "price": return a.rate - b.rate || a.km - b.km;
      case "distance": return a.km - b.km;
      case "rating": return b.f.rating - a.f.rating;
      case "spaces": return b.free - a.free;
      default: return (b.free > 0 ? 1 : 0) - (a.free > 0 ? 1 : 0) || b.score - a.score;
    }
  };
}
/** One facility measured against a search: {f, km, walk, free, rate, total} */
export function measure(f: Facility, search: Search, bookings: Booking[], seed: number, vType: VehicleType, center?: LatLng): Result {
  const c = center || searchCenter(search), km = distKm(c, f);
  const s = ms(search.start), e = ms(search.end);
  const mode: BookingMode = search.mode === "daily" && f.dailyRate ? "daily" : "hourly";
  return { f, km, walk: walkMin(km), free: availability(f, s, e, bookings, seed).free, rate: rateFor(f, vType),
    total: quote({ facility: f, start: s, end: e, mode, vehicleType: vType }).total, score: 0, reason: "" };
}
export interface SearchOpts { search?: Search; bookings?: Booking[]; seed?: number; vehicleType?: VehicleType; center?: LatLng }
/** searchFacilities(st, {search, bookings, seed, vehicleType, center}) → {results, total}. Options default to `st`. */
export function searchFacilities(st: AppState, o: SearchOpts = {}): { results: Result[]; total: number } {
  const search = o.search || st.search, n = search.filters;
  const bookings = o.bookings || st.bookings, seed = o.seed ?? st.demo.seed, vt = o.vehicleType || defaultVehicle(st).type;
  const center = o.center || searchCenter(search);
  const all = D.facilities.map((f) => measure(f, search, bookings, seed, vt, center));
  const kept = all.filter((r) => !n.maxDistance || r.km <= n.maxDistance).filter((r) => {
    const f = r.f;
    return !((n.maxPrice && r.rate > n.maxPrice) || (n.types.length && !n.types.some((t) => matchesType(f, t))) ||
      (n.security.length && !n.security.every((s) => f.security.includes(s))) || (n.accessible && !f.accessible) ||
      (n.ev && !f.ev) || (n.motorcycle && !f.motorcycle) || (n.overnight && !f.overnight) || (n.instant && !f.instant) ||
      (n.minRating && f.rating < n.minRating) || (n.onlyAvailable && r.free <= 0));
  });
  rankResults(kept, vt);
  return { results: [...kept].sort(sortCompare(search.sort)), total: all.length };
}
export interface ActiveFilter { key: string; label: string; clear: (x: Filters) => Filters }
/** Removable chips for active filters: [{key, label, clear(filters)→filters}] */
export function activeFilters(n: Filters): ActiveFilter[] {
  const out: ActiveFilter[] = [], d = D.filterDefaults;
  if (n.maxPrice) out.push({ key: "price", label: `Up to ₹${n.maxPrice}/h`, clear: (x) => ({ ...x, maxPrice: 0 }) });
  if (n.maxDistance !== d.maxDistance) out.push({ key: "dist", label: n.maxDistance ? `Within ${n.maxDistance} km` : "Any distance", clear: (x) => ({ ...x, maxDistance: d.maxDistance }) });
  n.types.forEach((t) => out.push({ key: "t" + t, label: D.typeLabels[t], clear: (x) => ({ ...x, types: x.types.filter((y) => y !== t) }) }));
  n.security.forEach((s) => out.push({ key: "s" + s, label: D.securityLabels[s], clear: (x) => ({ ...x, security: x.security.filter((y) => y !== s) }) }));
  if (n.accessible) out.push({ key: "acc", label: "Accessible", clear: (x) => ({ ...x, accessible: false }) });
  if (n.ev) out.push({ key: "ev", label: "EV charging", clear: (x) => ({ ...x, ev: false }) });
  if (n.motorcycle) out.push({ key: "moto", label: "Motorcycle bays", clear: (x) => ({ ...x, motorcycle: false }) });
  if (n.overnight) out.push({ key: "night", label: "Overnight", clear: (x) => ({ ...x, overnight: false }) });
  if (n.instant) out.push({ key: "inst", label: "Instant booking", clear: (x) => ({ ...x, instant: false }) });
  if (n.minRating) out.push({ key: "rate", label: `${n.minRating}★ and up`, clear: (x) => ({ ...x, minRating: 0 }) });
  if (n.onlyAvailable) out.push({ key: "avail", label: "Available for my time", clear: (x) => ({ ...x, onlyAvailable: false }) });
  return out;
}

/* ─────────────────── lookups on state ─────────────────── */
export const defaultVehicle = (st: AppState): Vehicle => st.vehicles.find((v) => v.id === st.defaultVehicleId) || st.vehicles[0];
/** The vehicle a new booking should start with: the default if it is allowed and free; else a free vehicle that
    costs the same here (so the price on the result card still holds); else the first free one; else the default. */
export function pickVehicle(st: AppState, f: Facility, start: TimeLike, end: TimeLike, mode: BookingMode = "hourly"): Vehicle {
  const def = defaultVehicle(st);
  const fits = (v: Vehicle) => !validateBooking({ facility: f, start, end, mode, vehicle: v, bookings: st.bookings, seed: st.demo.seed }).issues.some((i) => i.field === "vehicle");
  if (fits(def)) return def;
  const same = st.vehicles.filter((v) => v.id !== def.id && rateFor(f, v.type) === rateFor(f, def.type) && fits(v));
  return same[0] || st.vehicles.find(fits) || def;
}
export const getBooking = (st: AppState, id: string) => st.bookings.find((b) => b.id === id);
export const unreadCount = (st: AppState) => st.notifications.filter((n) => !n.read).length;

/* ───────────────────── 7. SEED STATE ───────────────────── */
interface BuildBookingInput {
  id: string; ref: string; fid: string; v: Vehicle; start: number; end: number; arrived?: number; exited?: number; cancelled?: number;
  refund?: Refund; method?: PaymentMethodId; mode?: BookingMode; ev?: boolean; promo?: string; bay: string; createdAgoH: number; nowMs: number;
}
/** Turn a compact seed booking into a full booking record. */
function buildBooking(o: BuildBookingInput): Booking {
  const f = facilityOrThrow(o.fid), v = o.v;
  const price = quote({ facility: f, start: o.start, end: o.end, mode: o.mode || "hourly", vehicleType: v.type, evCharging: o.ev, promo: o.promo });
  const created = new Date(Math.min(o.start, o.nowMs) - o.createdAgoH * HOUR).toISOString();
  const method = o.method || "upi";
  const history: Booking["history"] = [{ at: created, action: "Booked", detail: `Paid ${money(price.total)} via ${(D.paymentMethods.find((m) => m.id === method) || { label: method }).label}` }];
  if (o.arrived) history.push({ at: new Date(o.arrived).toISOString(), action: "Checked in at entry" });
  if (o.exited) history.push({ at: new Date(o.exited).toISOString(), action: "Exited facility" });
  if (o.cancelled) history.push({ at: new Date(o.cancelled).toISOString(), action: "Cancelled", detail: o.refund && o.refund.note });
  return {
    id: o.id, ref: o.ref, facilityId: o.fid, vehicleId: v.id, vehicle: { name: v.name, plate: v.plate, type: v.type },
    start: new Date(o.start).toISOString(), end: new Date(o.end).toISOString(), mode: o.mode || "hourly",
    notes: "", requirements: o.ev ? ["EV charging"] : [], createdAt: created, confirmedAt: created, price,
    payment: { method, txnId: "SIM" + o.ref.replace(/\W/g, ""), amount: price.total, paidAt: created, adjustments: [] },
    cancelledAt: o.cancelled ? new Date(o.cancelled).toISOString() : undefined, refund: o.refund,
    arrivedAt: o.arrived ? new Date(o.arrived).toISOString() : undefined,
    exitedAt: o.exited ? new Date(o.exited).toISOString() : undefined, bay: o.bay, history,
  };
}
/** Fresh demo state relative to nowMs: 6 bookings, saved lists, notifications, Riya Sharma. */
export function buildSeedState(nowMs = Date.now()): AppState {
  const sd = D.seed;
  const slot = ceilHalfHour(nowMs) - 30 * MIN;
  const when = (w: SeedWhen) => ("relMin" in w ? slot + w.relMin * MIN : at(dateKey(addDays(startOfDay(nowMs), w.day)), w.time).getTime());
  const opt = (w?: SeedWhen) => (w ? when(w) : undefined);
  const iso = (agoH: number) => new Date(nowMs - agoH * HOUR).toISOString();
  const bookings = sd.bookings.map((b) => buildBooking({
    id: b.id, ref: b.ref, fid: b.fid, v: D.vehicles[b.vehicle], start: when(b.start), end: when(b.end),
    arrived: opt(b.arrived), exited: opt(b.exited), cancelled: opt(b.cancelled),
    refund: b.refund, method: b.method, mode: b.mode, ev: b.ev, promo: b.promo, bay: b.bay, createdAgoH: b.createdAgoH, nowMs,
  }));
  return {
    version: STATE_VERSION, onboarded: false, user: { ...sd.user },
    vehicles: D.vehicles.map((v) => ({ ...v })), defaultVehicleId: D.vehicles[0].id, bookings,
    savedIds: [...sd.savedIds],
    savedSearches: sd.savedSearches.map((s) => ({ id: s.id, label: s.label, destId: s.destId, filters: { ...D.filterDefaults, ...s.filters },
      durationH: s.durationH, alerts: s.alerts, createdAt: iso(s.createdAgoH), lastPrice: s.lastPrice, lastSpaces: s.lastSpaces })),
    savedPlaces: sd.savedPlaces.map((p) => ({ ...p })),
    notifications: sd.notifications.map((n) => { const { agoH, ...rest } = n; return { ...rest, at: iso(agoH) }; }),
    recentDest: [...sd.recentDest], recentlyViewed: [],
    prefs: JSON.parse(JSON.stringify(sd.prefs)),
    search: { destId: "cp", ...defaultWindow(nowMs), mode: "hourly", filters: { ...D.filterDefaults }, sort: "recommended" },
    compareIds: [], demo: { clockOffsetMin: 0, seed: 1, nextPaymentFails: false },
  };
}

/* ───────────────────── UI-facing helpers (data only) ───────────────────── */
/** Amenity icon list for a facility → [{icon, label}] (icon = Icon name) */
export function amenityIcons(f: Facility): { icon: string; label: string }[] {
  const out: { icon: string; label: string }[] = [];
  if (f.ev) out.push({ icon: "zap", label: "EV charging" });
  if (f.accessible) out.push({ icon: "accessibility", label: "Accessible" });
  if (f.motorcycle) out.push({ icon: "bike", label: "Two-wheelers" });
  if (f.covered) out.push({ icon: "umbrella", label: "Covered" });
  if (f.security.includes("cctv")) out.push({ icon: "video", label: "CCTV" });
  if (f.security.includes("guarded")) out.push({ icon: "shield-check", label: "Guarded" });
  if (f.overnight) out.push({ icon: "moon", label: "Overnight" });
  return out;
}
export type { CustomPlace };

/** Formatters (same names as the prototype's PARKLY.fmt). */
export const fmt = { money, time12, timeLabel, dateLabel, dayLabel, windowLabel, durationLabel, durationShort, countdown, ago, kmLabel, dateKey, timeKey, numLabel };
