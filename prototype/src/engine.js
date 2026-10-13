/* PARKLY prototype · engine.js
   Plain JS (ES2020), no dependencies. Needs window.PARKLY_DATA (data.js) loaded first.
   Sections: 1 time · 2 money & pricing · 3 geo · 4 availability · 5 validation & status
             6 search & ranking · 7 seed state · 8 store + actions · 9 UI helpers
             10 router · 11 overlay/toast · 12 SvgMap · 13 QR · 14 Dial · 15 Illus
   Everything is exported on window.PARKLY at the bottom. */
(function () {
  "use strict";
  const D = window.PARKLY_DATA;
  const HOUR = 3600000;
  const MIN = 60000;
  const SLOT = 30 * MIN; // availability is checked in 30-minute slots
  const pad2 = (n) => String(n).padStart(2, "0");

  /* ───────────────────────── 1. TIME ───────────────────────── */
  // Demo clock: the whole app reads time through now(), so the test clock can move it.
  let clockOffsetMin = 0;
  const now = () => Date.now() + clockOffsetMin * MIN;
  const setClockOffsetRaw = (min) => { clockOffsetMin = min || 0; };

  const dateKey = (d) => { d = new Date(d); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }; // 2026-10-13
  const timeKey = (d) => { d = new Date(d); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }; // 14:30
  function at(dk, tk) { // local Date from "YYYY-MM-DD" + "HH:MM"
    const [y, m, d] = dk.split("-").map(Number);
    const [h, mi] = tk.split(":").map(Number);
    return new Date(y, m - 1, d, h, mi, 0, 0);
  }
  const ceilHalfHour = (ms) => Math.ceil(ms / SLOT) * SLOT;
  const startOfDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const addDays = (ms, n) => { const d = new Date(ms); d.setDate(d.getDate() + n); return d.getTime(); };
  const TIMES = Array.from({ length: 48 }, (_, i) => `${pad2(Math.floor(i / 2))}:${i % 2 ? "30" : "00"}`); // 00:00 … 23:30
  function time12(tk) { // "14:30" → "2:30 pm"
    const [h, m] = tk.split(":").map(Number);
    return `${h % 12 === 0 ? 12 : h % 12}:${pad2(m)} ${h >= 12 ? "pm" : "am"}`;
  }
  const timeLabel = (ms) => time12(timeKey(ms)); // any date → "2:30 pm"
  const dateLabel = (ms, o = { weekday: true }) =>
    new Date(ms).toLocaleDateString("en-IN", { weekday: o.weekday ? "short" : undefined, day: "numeric", month: "short", year: o.year ? "numeric" : undefined });
  function dayLabel(ms) { // Today / Tomorrow / Yesterday / Tue, 14 Oct
    const diff = Math.round((startOfDay(new Date(ms).getTime()) - startOfDay(now())) / (24 * HOUR));
    return diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : diff === -1 ? "Yesterday" : dateLabel(ms);
  }
  function windowLabel(a, b) { // "Today, 2:00 pm – 4:00 pm" or "Today 9:00 pm → Tomorrow 1:00 am"
    return startOfDay(new Date(a).getTime()) === startOfDay(new Date(b).getTime())
      ? `${dayLabel(a)}, ${timeLabel(a)} – ${timeLabel(b)}`
      : `${dayLabel(a)} ${timeLabel(a)} → ${dayLabel(b)} ${timeLabel(b)}`;
  }
  function durationLabel(hours) { // 2.5 → "2 h 30 min"
    const t = Math.round(hours * 60), d = Math.floor(t / 1440), h = Math.floor((t % 1440) / 60), m = t % 60, out = [];
    if (d) out.push(`${d} day${d > 1 ? "s" : ""}`);
    if (h) out.push(`${h} h`);
    if (m) out.push(`${m} min`);
    return out.join(" ") || "0 min";
  }
  function durationShort(min) { // 150 → "2 h 30 m" (dial centre)
    const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60, out = [];
    if (d) out.push(`${d} d`);
    if (h) out.push(`${h} h`);
    if (m || !out.length) out.push(`${m} m`);
    return out.join(" ");
  }
  function countdown(ms) { // ms left → "1h 05m" / "4:09" / "2d 3h 10m"
    if (ms <= 0) return "0:00";
    const t = Math.floor(ms / 1000), d = Math.floor(t / 86400), h = Math.floor((t % 86400) / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return d ? `${d}d ${h}h ${m}m` : h ? `${h}h ${pad2(m)}m` : `${m}:${pad2(s)}`;
  }
  function ago(iso) {
    const m = Math.round((now() - new Date(iso).getTime()) / MIN);
    if (m < 1) return "just now";
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
  }
  // Default search window (bundle Hh): next half hour + 30 min, 2 h long; at night jump to 10:00.
  function defaultWindow(ms) {
    let t = ceilHalfHour(ms + 30 * MIN);
    const hr = new Date(t).getHours();
    if (hr >= 20 || hr < 8) {
      const day = hr >= 20 ? addDays(startOfDay(ms), 1) : startOfDay(ms);
      t = at(dateKey(day), "10:00").getTime();
    }
    return { start: new Date(t).toISOString(), end: new Date(t + 2 * HOUR).toISOString() };
  }

  /* ───────────────────── 2. MONEY & PRICING ───────────────────── */
  const P = D.pricing;
  const money = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
  const facility = (id) => D.facilities.find((f) => f.id === id);
  const destination = (id) => D.destinations.find((d) => d.id === id);
  const rateFor = (f, vType) => Math.round(f.rate * D.vehicleMultipliers[vType]); // ₹ per hour
  const dailyFor = (f, vType) => (f.dailyRate ? Math.round(f.dailyRate * D.vehicleMultipliers[vType]) : undefined);
  const numLabel = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

  // Promo rules → {ok, amount, message}. parking = parking charge before fees; startMs decides weekend.
  function applyPromo(code, parking, startMs) {
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

  /* quote({facility, start, end, mode:'hourly'|'daily', vehicleType, evCharging, promo, includeFees})
     → {hours, billedHours, mode, base, additional, dailyCapApplied, vehicleAdj, evCharging,
        subtotal, convenience, discount, promo, tax, total, lines:[{label, amount, hint}]}
     start/end are ms. Hourly billing rounds up to 30 min, minimum 1 h; daily cap applies. */
  function quote(q) {
    const f = q.facility, start = +q.start, end = +q.end, mode = q.mode || "hourly", vt = q.vehicleType || "hatchback";
    const hours = Math.max(0, (end - start) / HOUR);
    const step = P.billingStepMin / 60;
    const billed = Math.max(1, Math.ceil(hours / step - 1e-9) * step);
    const rate = rateFor(f, vt), daily = dailyFor(f, vt);
    const lines = [];
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
      if (capped) lines.push({ label: "Daily cap applied", amount: subtotal - raw, hint: `Max ${money(daily)} per 24 h` });
    }
    const vehicleAdj = subtotal - Math.round(subtotal / D.vehicleMultipliers[vt]);
    const ev = q.evCharging && f.ev ? P.evReserve : 0;
    if (ev) lines.push({ label: "EV charger reservation", amount: ev, hint: "Energy billed at the charger" });
    const fee = q.includeFees !== false ? P.convenienceFee : 0;
    if (fee) lines.push({ label: "Convenience fee", amount: fee, hint: "Non-refundable" });
    let discount = 0, promo;
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

  // Refund % by policy and hours left before entry.
  function policyPercent(policy, hoursLeft) {
    if (hoursLeft <= 0) return 0;
    if (policy === "flexible") return hoursLeft >= 1 ? 100 : 50;
    if (policy === "moderate") return hoursLeft >= 24 ? 100 : hoursLeft >= 2 ? 50 : 0;
    if (policy === "strict") return hoursLeft >= 24 ? 50 : 0;
    return 0;
  }
  // Hours before entry at which the refund drops to the next band (for the "deadline countdown").
  const POLICY_STEPS = { flexible: [1, 0], moderate: [24, 2], strict: [24] };
  function cancelDeadline(booking, f, nowMs = now()) { // → {at (ms), percentAfter} or null
    const startMs = new Date(booking.start).getTime();
    for (const h of POLICY_STEPS[f.policy] || []) {
      const t = startMs - h * HOUR;
      if (t > nowMs) return { at: t, percentNow: policyPercent(f.policy, (startMs - nowMs) / HOUR), percentAfter: policyPercent(f.policy, h - 0.001) };
    }
    return null;
  }
  const paidSoFar = (b) => b.payment.amount + b.payment.adjustments.reduce((s, a) => s + a.amount, 0);

  // refundPreview(booking, facility, nowMs, pending) → {amount, percent, note, paid}
  function refundPreview(b, f, nowMs = now(), pending = false) {
    const paid = paidSoFar(b);
    const fee = Math.round(P.convenienceFee * (1 + P.gst)); // ₹18, never refunded
    const hoursLeft = (new Date(b.start).getTime() - nowMs) / HOUR;
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
  // Overstay: free for 15 min grace, then every started hour at 1.5× rate + GST.
  function overstayFee(f, vType, overMs) {
    if (overMs <= 15 * MIN) return 0;
    return Math.round(Math.ceil(overMs / HOUR) * rateFor(f, vType) * P.overstayMultiplier * (1 + P.gst));
  }

  /* ───────────────────────── 3. GEO ───────────────────────── */
  function distKm(a, b) { // haversine
    const dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
  }
  const walkMin = (km) => Math.max(1, Math.round(((km * 1.3) / 4.8) * 60)); // 1.3 detour factor, 4.8 km/h
  const kmLabel = (km) => (km < 1 ? `${Math.round((km * 1000) / 10) * 10} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`);
  const mapsUrl = (p, mode = "driving") => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=${mode}`;

  /* ───────────────────── 4. AVAILABILITY ───────────────────── */
  // Deterministic 0..1 hash (FNV-1a) so "live" numbers are stable for a given seed.
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 10000) / 10000;
  }
  const WEEKEND_BUSY = ["lajpat", "saket", "khan", "hkv", "cyberhub", "karolbagh", "chandni"];
  const WEEKEND_QUIET = ["nehru-place", "cp-metro"];
  // Spaces taken by other (simulated) drivers at a moment.
  function simulatedOccupied(f, ms, seed) {
    const d = new Date(ms), hr = d.getHours();
    let load = D.busynessCurve[hr];
    if (f.id === "igi-t3" || f.id === "aerocity-ev") load = 0.55 + load * 0.3; // airports stay steady
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    if (weekend && WEEKEND_BUSY.includes(f.id)) load = Math.min(1.08, load * 1.12);
    if (weekend && WEEKEND_QUIET.includes(f.id)) load *= 0.6;
    const noise = hash(`${f.id}|${dateKey(d)}|${hr}|${seed}`) - 0.5;
    return Math.max(0, Math.min(f.capacity, Math.round(f.capacity * (f.busyness * load + noise * 0.12))));
  }
  const isLive = (b) => !b.cancelledAt && !b.exitedAt;
  // Our own bookings that hold a space in the 30-min slot starting at slotMs.
  const overlapBookings = (bookings, fid, slotMs, excludeId) =>
    bookings.filter((b) => b.facilityId === fid && b.id !== excludeId && isLive(b) &&
      new Date(b.start).getTime() < slotMs + SLOT && new Date(b.end).getTime() > slotMs).length;

  /* availability(f, startMs, endMs, bookings, seed, excludeId) → {free, fullSlot}
     free = the fewest free spaces in any 30-min slot of the window; fullSlot = ms of the first full slot. */
  function availability(f, start, end, bookings = [], seed = 1, excludeId) {
    if (end <= start) return { free: 0 };
    let min = Infinity, fullSlot;
    for (let t = Math.floor(start / SLOT) * SLOT; t < end; t += SLOT) {
      const free = f.capacity - simulatedOccupied(f, t, seed) - overlapBookings(bookings, f.id, t, excludeId);
      if (free < min) min = free;
      if (free <= 0 && fullSlot === undefined) fullSlot = t;
    }
    return { free: Math.max(0, min), fullSlot };
  }
  function isOpenAt(f, ms) {
    if (f.is24h) return true;
    const dk = dateKey(ms);
    return ms >= at(dk, f.open).getTime() && ms < at(dk, f.close).getTime();
  }
  // 24 cells from dayStartMs: {hour, free (-1 = closed), ratio}
  const hourlyAvailability = (f, dayStartMs, bookings, seed) =>
    Array.from({ length: 24 }, (_, h) => {
      const t = dayStartMs + h * HOUR, open = isOpenAt(f, t) && isOpenAt(f, t + HOUR - 1);
      const a = availability(f, t, t + HOUR, bookings, seed);
      return { hour: h, free: open ? a.free : -1, ratio: open ? a.free / f.capacity : 0 };
    });
  const hoursLabel = (f) => (f.is24h ? "Open 24 hours" : `${time12(f.open)} – ${time12(f.close)}`);
  // 'none' = full, 'low' = few left (≤10% or ≤2), 'ok'
  const availTone = (free, capacity) => (free <= 0 ? "none" : free <= Math.max(2, capacity * 0.1) ? "low" : "ok");
  const toneClass = (tone) => ({ none: "danger", low: "warn", ok: "ok" })[tone];

  /* ───────────────── 5. VALIDATION & STATUS ───────────────── */
  /* validateBooking({facility, start, end, mode, vehicle, bookings, seed, nowMs, excludeId, allowPastStart})
     → {issues:[{field:'start'|'end'|'vehicle'|'availability', message}], free} */
  function validateBooking(o) {
    const f = o.facility, start = +o.start, end = +o.end, v = o.vehicle, issues = [];
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
        new Date(b.start).getTime() < end && new Date(b.end).getTime() > start);
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
  // pending | upcoming | active | completed | cancelled
  function bookingStatus(b, nowMs = now()) {
    if (b.cancelledAt) return "cancelled";
    if (b.exitedAt) return "completed";
    if (nowMs < new Date(b.confirmedAt).getTime()) return "pending";
    const s = new Date(b.start).getTime(), e = new Date(b.end).getTime();
    return nowMs < s ? "upcoming" : nowMs < e || (b.arrivedAt && nowMs < e + 4 * HOUR) ? "active" : "completed";
  }
  const isOverstay = (b, nowMs = now()) => !!b.arrivedAt && !b.exitedAt && !b.cancelledAt && nowMs > new Date(b.end).getTime();
  const statusTone = (s) => ({ pending: "warn", upcoming: "lime", active: "ok", completed: "neutral", cancelled: "danger" })[s];
  function genRef() {
    const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < 4; i++) s += abc[Math.floor(Math.random() * abc.length)];
    return `PK-${s}-${Math.floor(10 + Math.random() * 89)}`;
  }
  function genBay(f) {
    const lvl = f.levels[Math.floor(Math.random() * f.levels.length)];
    return f.capacity <= 2 ? lvl : `${lvl} · Bay ${String(1 + Math.floor(Math.random() * Math.min(80, f.capacity))).padStart(2, "0")}`;
  }
  const uid = () => Math.random().toString(36).slice(2, 10);
  const PLATE_RE = /^[A-Z]{2}\s?\d{1,2}\s?[A-Z]{0,3}\s?[A-Z]{0,3}\s?\d{4}$/; // DL 8C AF 4521, MH 12 AB 1234, HR26DK8337
  const normPlate = (p) => String(p || "").toUpperCase().replace(/\s+/g, " ").trim();
  const validPlate = (p) => PLATE_RE.test(normPlate(p));
  // Calendar links for a booking → {google, ics}
  function calendarLinks(b, f) {
    const z = (iso) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const title = `Parking: ${f.name}`, details = `PARKLY booking ${b.ref}\n${b.bay} · ${b.vehicle.plate}`;
    const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${z(b.start)}/${z(b.end)}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(f.address)}`;
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//PARKLY//Bookings//EN", "BEGIN:VEVENT", `UID:${b.id}@parkly.app`,
      `DTSTAMP:${z(new Date().toISOString())}`, `DTSTART:${z(b.start)}`, `DTEND:${z(b.end)}`, `SUMMARY:${title}`,
      `LOCATION:${f.address.replace(/,/g, "\\,")}`, `DESCRIPTION:${details.replace(/\n/g, "\\n")}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    return { google, ics };
  }
  function downloadFile(name, text, type = "text/plain") {
    try {
      const url = URL.createObjectURL(new Blob([text], { type }));
      const a = document.createElement("a");
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    } catch { return false; }
  }

  /* ─────────────────── 6. SEARCH & RANKING ─────────────────── */
  // Where the search is centred: a custom point (Near me / map area) or a destination.
  function searchCenter(search) {
    if (search.custom) return { ...search.custom, area: "Pinned location" };
    const d = destination(search.destId) || destination("cp");
    return { lat: d.lat, lng: d.lng, name: d.name, area: d.area };
  }
  const matchesType = (f, t) => (t === "ev" ? !!f.ev : t === "covered" ? f.covered : t === "uncovered" ? !f.covered : f.type === t);
  // Adds score (0..1) and a plain-words reason line to each result (bundle mg).
  function rankResults(list, vType) {
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
      ];
      r.score = parts.reduce((s, p) => s + p.v, 0);
      const words = {
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
  function sortCompare(sort) {
    return (a, b) => {
      switch (sort) {
        case "price": return a.rate - b.rate || a.km - b.km;
        case "distance": return a.km - b.km;
        case "rating": return b.f.rating - a.f.rating;
        case "spaces": return b.free - a.free;
        default: return (b.free > 0 ? 1 : 0) - (a.free > 0 ? 1 : 0) || b.score - a.score;
      }
    };
  }
  // One facility measured against a search: {f, km, walk, free, rate, total}
  function measure(f, search, bookings, seed, vType, center) {
    const c = center || searchCenter(search), km = distKm(c, f);
    const s = new Date(search.start).getTime(), e = new Date(search.end).getTime();
    const daily = search.mode === "daily" && f.dailyRate ? "daily" : "hourly";
    return { f, km, walk: walkMin(km), free: availability(f, s, e, bookings, seed).free, rate: rateFor(f, vType),
      total: quote({ facility: f, start: s, end: e, mode: daily, vehicleType: vType }).total, score: 0, reason: "" };
  }
  /* searchFacilities({search, bookings, seed, vehicleType, center}) → {results, total}
     All args default to the current store state. */
  function searchFacilities(o = {}) {
    const st = S.state, search = o.search || st.search, n = search.filters;
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
  // Removable chips for active filters: [{key, label, clear(filters)→filters}]
  function activeFilters(n) {
    const out = [], d = D.filterDefaults;
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

  /* ───────────────────── 7. SEED STATE ───────────────────── */
  const STORE_KEY = "parkly.proto.v1";
  const STATE_VERSION = 1;
  // Turn a compact seed booking into a full booking record (bundle lr).
  function buildBooking(o) {
    const f = facility(o.fid), v = o.v;
    const price = quote({ facility: f, start: o.start, end: o.end, mode: o.mode || "hourly", vehicleType: v.type, evCharging: o.ev, promo: o.promo });
    const created = new Date(Math.min(o.start, o.nowMs) - o.createdAgoH * HOUR).toISOString();
    const method = o.method || "upi";
    const history = [{ at: created, action: "Booked", detail: `Paid ${money(price.total)} via ${(D.paymentMethods.find((m) => m.id === method) || { label: method }).label}` }];
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
  // Fresh demo state relative to nowMs (bundle Wh): 6 bookings, saved lists, notifications, Riya Sharma.
  function buildSeedState(nowMs = Date.now()) {
    const sd = D.seed;
    const slot = ceilHalfHour(nowMs) - 30 * MIN;
    const when = (w) => (w.relMin !== undefined ? slot + w.relMin * MIN : at(dateKey(addDays(startOfDay(nowMs), w.day)), w.time).getTime());
    const iso = (agoH) => new Date(nowMs - agoH * HOUR).toISOString();
    const bookings = sd.bookings.map((b) => buildBooking({
      id: b.id, ref: b.ref, fid: b.fid, v: D.vehicles[b.vehicle], start: when(b.start), end: when(b.end),
      arrived: b.arrived && when(b.arrived), exited: b.exited && when(b.exited), cancelled: b.cancelled && when(b.cancelled),
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

  /* ───────────────────── 8. STORE + ACTIONS ───────────────────── */
  function loadState() {
    const fresh = buildSeedState(Date.now());
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return fresh;
      const s = JSON.parse(raw);
      if (s.version !== STATE_VERSION) return fresh;
      const st = { ...fresh, ...s, prefs: { ...fresh.prefs, ...s.prefs }, demo: { ...fresh.demo, ...s.demo } };
      setClockOffsetRaw(st.demo.clockOffsetMin);
      if (new Date(st.search.start).getTime() < now() - 5 * MIN) st.search = { ...st.search, ...defaultWindow(now()) }; // stale window
      return st;
    } catch { return fresh; }
  }
  const listeners = new Set();
  const S = {
    state: null,
    // set(fn | partial): fn(state) → new state, or an object shallow-merged into state.
    set(next, reason = "set") {
      const prev = S.state;
      const val = typeof next === "function" ? next(prev) : { ...prev, ...next };
      if (!val || val === prev) return prev;
      S.state = val;
      try { localStorage.setItem(STORE_KEY, JSON.stringify(val)); } catch {}
      listeners.forEach((fn) => { try { fn(val, reason, prev); } catch (e) { console.error(e); } });
      return val;
    },
    // subscribe(fn(state, reason, prev)) → unsubscribe()
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
  S.state = loadState();
  setClockOffsetRaw(S.state.demo.clockOffsetMin);

  const defaultVehicle = (st = S.state) => st.vehicles.find((v) => v.id === st.defaultVehicleId) || st.vehicles[0];
  // pickVehicle(f, start, end, mode) → the vehicle a new booking should start with:
  // the default if it is allowed and free; else a free vehicle that costs the same here (so the price
  // on the result card still holds); else the first free one; else the default.
  function pickVehicle(f, start, end, mode = "hourly", st = S.state) {
    const def = defaultVehicle(st);
    const fits = (v) => !validateBooking({ facility: f, start, end, mode, vehicle: v, bookings: st.bookings, seed: st.demo.seed }).issues.some((i) => i.field === "vehicle");
    if (fits(def)) return def;
    const same = st.vehicles.filter((v) => v.id !== def.id && rateFor(f, v.type) === rateFor(f, def.type) && fits(v));
    return same[0] || st.vehicles.find(fits) || def;
  }
  const getBooking = (id, st = S.state) => st.bookings.find((b) => b.id === id);
  const unreadCount = (st = S.state) => st.notifications.filter((n) => !n.read).length;
  // Add a notification to a state object (pure).
  const withNote = (st, n) => ({ ...st, notifications: [{ ...n, id: uid(), at: new Date(now()).toISOString(), read: false }, ...st.notifications].slice(0, 60) });
  const ok = (value) => ({ ok: true, value });
  const fail = (error) => ({ ok: false, error });
  const nowIso = () => new Date(now()).toISOString();

  // Price + checks for extending booking id by `min` minutes (bundle c).
  function quoteExtension(id, min) {
    const st = S.state, b = getBooking(id, st), f = facility(b.facilityId);
    const endMs = new Date(b.end).getTime(), newEnd = endMs + min * MIN, issues = [];
    if (!f.is24h) {
      const close = new Date(b.start); const [h, m] = f.close.split(":").map(Number); close.setHours(h, m, 0, 0);
      if (newEnd > close.getTime()) issues.push(`Closes at ${timeLabel(close)}. Extensions can't go past closing time.`);
    }
    const a = availability(f, endMs, newEnd, st.bookings, st.demo.seed, id);
    if (a.free <= 0) issues.push(`No space from ${timeLabel(a.fullSlot ?? endMs)}. Try a shorter extension.`);
    const clash = st.bookings.find((x) => x.id !== id && x.vehicleId === b.vehicleId && !x.cancelledAt && !x.exitedAt &&
      new Date(x.start).getTime() < newEnd && new Date(x.end).getTime() > endMs);
    if (clash) issues.push(`${b.vehicle.plate} has another booking starting ${timeLabel(clash.start)}.`);
    const price = quote({ facility: f, start: new Date(b.start).getTime(), end: newEnd, mode: "hourly", vehicleType: b.vehicle.type,
      evCharging: b.requirements.includes("EV charging"), promo: b.price.promo });
    return { ok: issues.length === 0, issues, newEnd, price, extra: Math.max(0, price.total - b.price.total), free: a.free };
  }

  const A = {
    completeOnboarding: (guest = false) => S.set((s) => ({ ...s, onboarded: true, user: { ...s.user, guest } })),
    signOut: () => S.set((s) => ({ ...s, onboarded: false })),
    setUser: (u) => S.set((s) => ({ ...s, user: { ...s.user, ...u } })),
    setPrefs: (p) => S.set((s) => ({ ...s, prefs: { ...s.prefs, ...p } })),
    setNotify: (p) => S.set((s) => ({ ...s, prefs: { ...s.prefs, notify: { ...s.prefs.notify, ...p } } })),
    // setSearch({start, end, mode, sort, destId…}) — start/end as ISO or ms
    setSearch: (p) => S.set((s) => {
      const q = { ...p };
      if (q.start !== undefined) q.start = new Date(q.start).toISOString();
      if (q.end !== undefined) q.end = new Date(q.end).toISOString();
      return { ...s, search: { ...s.search, ...q } };
    }),
    setFilters: (filters) => S.set((s) => ({ ...s, search: { ...s.search, filters } })),
    resetFilters: () => S.set((s) => ({ ...s, search: { ...s.search, filters: { ...D.filterDefaults } } })),
    setDestination: (destId) => S.set((s) => ({ ...s, search: { ...s.search, destId, custom: undefined },
      recentDest: [destId, ...s.recentDest.filter((d) => d !== destId)].slice(0, 6) })),
    setCustomDestination: (c) => S.set((s) => ({ ...s, search: { ...s.search, custom: c } })), // {name, lat, lng}
    nearMe: () => A.setCustomDestination({ name: "Mandi House", lat: 28.6258, lng: 77.2341 }), // simulated location
    viewed: (fid) => S.set((s) => (s.recentlyViewed[0] === fid ? s : { ...s, recentlyViewed: [fid, ...s.recentlyViewed.filter((x) => x !== fid)].slice(0, 8) })),
    setSavedPlace: (id, destId) => S.set((s) => ({ ...s, savedPlaces: s.savedPlaces.map((p) => (p.id === id ? { ...p, destId } : p)) })),
    toggleSaved: (fid) => S.set((s) => ({ ...s, savedIds: s.savedIds.includes(fid) ? s.savedIds.filter((x) => x !== fid) : [fid, ...s.savedIds] })),
    toggleCompare: (fid) => {
      const s = S.state;
      if (!s.compareIds.includes(fid) && s.compareIds.length >= 3) return fail("You can compare up to 3 facilities. Remove one first.");
      S.set((x) => ({ ...x, compareIds: x.compareIds.includes(fid) ? x.compareIds.filter((y) => y !== fid) : [...x.compareIds, fid] }));
      return ok();
    },
    clearCompare: () => S.set((s) => ({ ...s, compareIds: [] })),
    // upsertVehicle({id?, name, plate, type, color}) → {ok, value: vehicle} | {ok:false, error}
    upsertVehicle: (v) => {
      const plate = normPlate(v.plate);
      if (!String(v.name || "").trim()) return fail("Give the vehicle a name, like “Dad’s Innova”.");
      if (!PLATE_RE.test(plate)) return fail("Use an Indian registration format, e.g. DL 8C AF 4521.");
      const veh = { ...v, plate, id: v.id || "v-" + uid().slice(0, 6) };
      S.set((s) => ({ ...s, vehicles: s.vehicles.some((x) => x.id === veh.id) ? s.vehicles.map((x) => (x.id === veh.id ? veh : x)) : [...s.vehicles, veh] }));
      return ok(veh);
    },
    removeVehicle: (vid) => {
      const s = S.state;
      if (s.vehicles.length <= 1) return fail("Keep at least one vehicle on your profile.");
      if (s.bookings.some((b) => b.vehicleId === vid && ["upcoming", "active", "pending"].includes(bookingStatus(b))))
        return fail("This vehicle has an upcoming or active booking. Cancel or finish it first.");
      S.set((x) => { const vs = x.vehicles.filter((v) => v.id !== vid); return { ...x, vehicles: vs, defaultVehicleId: x.defaultVehicleId === vid ? vs[0].id : x.defaultVehicleId }; });
      return ok();
    },
    setDefaultVehicle: (vid) => S.set((s) => ({ ...s, defaultVehicleId: vid })),

    /* createBooking({facilityId, vehicleId, start, end, mode, requirements[], notes, promo, method})
       → {ok:true, value: booking} | {ok:false, error} */
    createBooking: (o) => {
      const s = S.state, f = facility(o.facilityId), v = s.vehicles.find((x) => x.id === o.vehicleId);
      if (!f || !v) return fail("That facility or vehicle no longer exists.");
      const start = +new Date(o.start), end = +new Date(o.end), mode = o.mode || "hourly", reqs = o.requirements || [];
      const check = validateBooking({ facility: f, start, end, mode, vehicle: v, bookings: s.bookings, seed: s.demo.seed, nowMs: now() });
      if (check.issues.length) return fail(check.issues[0].message);
      const price = quote({ facility: f, start, end, mode, vehicleType: v.type, evCharging: reqs.includes("EV charging"), promo: o.promo });
      const t = nowIso(), ref = genRef(), method = o.method || s.prefs.payment || "upi";
      const b = {
        id: uid(), ref, facilityId: f.id, vehicleId: v.id, vehicle: { name: v.name, plate: v.plate, type: v.type },
        start: new Date(start).toISOString(), end: new Date(end).toISOString(), mode, notes: o.notes || "", requirements: reqs,
        createdAt: t, confirmedAt: f.instant ? t : new Date(now() + 45000).toISOString(), price,
        payment: { method, txnId: "SIM" + ref.replace(/\W/g, "") + Math.floor(Math.random() * 900 + 100), amount: price.total, paidAt: t, adjustments: [] },
        bay: genBay(f), history: [{ at: t, action: "Booked", detail: `Paid ${money(price.total)} via ${(D.paymentMethods.find((m) => m.id === method) || { label: method }).label}` }],
      };
      S.set((x) => withNote({ ...x, bookings: [b, ...x.bookings] }, {
        kind: "confirmed", title: f.instant ? "Booking confirmed" : "Booking received", bookingId: b.id,
        body: f.instant ? `${f.name}, ${dayLabel(b.start)} ${timeLabel(b.start)}. Your pass is ready.` : `${f.name} will confirm shortly within a minute.`,
      }), "booking");
      return ok(b);
    },
    // modifyBooking(id, {start, end, mode, vehicleId, requirements}) → {ok, value:{diff}} (diff>0 pay more, <0 refund)
    modifyBooking: (id, o) => {
      const s = S.state, b = getBooking(id, s);
      if (!b) return fail("Booking not found.");
      const st = bookingStatus(b);
      if (st !== "upcoming" && st !== "pending") return fail("Only upcoming bookings can be modified. Use Extend for an active booking.");
      const r = previewModify(id, o);
      if (!r.ok) return r;
      const { price, diff, vehicle: v, start, end, mode, reqs } = r.value, f = facility(b.facilityId), t = nowIso();
      const nb = {
        ...b, start: new Date(start).toISOString(), end: new Date(end).toISOString(), mode, vehicleId: v.id,
        vehicle: { name: v.name, plate: v.plate, type: v.type }, requirements: reqs, price,
        payment: diff ? { ...b.payment, adjustments: [...b.payment.adjustments, { at: t, amount: diff, reason: diff > 0 ? "Modification charge" : "Modification refund" }] } : b.payment,
        history: [...b.history, { at: t, action: "Modified", detail: `${dayLabel(start)} ${timeLabel(start)}–${timeLabel(end)} · ${v.plate}${diff ? ` · ${diff > 0 ? "charged" : "refunded"} ${money(Math.abs(diff))}` : ""}` }],
      };
      S.set((x) => withNote({ ...x, bookings: x.bookings.map((y) => (y.id === id ? nb : y)) }, {
        kind: "modified", title: "Booking updated", bookingId: id,
        body: `${f.name} is now ${dayLabel(start)} ${timeLabel(start)}–${timeLabel(end)}.${diff ? ` ${diff > 0 ? "Extra charge" : "Refund"} ${money(Math.abs(diff))}.` : ""}`,
      }), "booking");
      return ok({ diff });
    },
    quoteExtension,
    // extendBooking(id, minutes) → {ok, value:{extra}}
    extendBooking: (id, min) => {
      const q = quoteExtension(id, min);
      if (!q.ok) return fail(q.issues[0]);
      const t = nowIso(), f = facility(getBooking(id).facilityId);
      S.set((x) => withNote({ ...x, bookings: x.bookings.map((b) => (b.id !== id ? b : {
        ...b, end: new Date(q.newEnd).toISOString(), mode: "hourly", price: q.price,
        payment: { ...b.payment, adjustments: [...b.payment.adjustments, { at: t, amount: q.extra, reason: `Extension +${min} min` }] },
        history: [...b.history, { at: t, action: `Extended by ${min} min`, detail: `New exit ${timeLabel(q.newEnd)} · charged ${money(q.extra)}` }],
      })) }, { kind: "extended", title: "Booking extended", bookingId: id, body: `${f.name} now ends at ${timeLabel(q.newEnd)}. Charged ${money(q.extra)}.` }), "booking");
      return ok({ extra: q.extra });
    },
    // refundPreview(id) → {amount, percent, note, paid}
    refundPreview: (id) => { const b = getBooking(id); return refundPreview(b, facility(b.facilityId), now(), bookingStatus(b) === "pending"); },
    cancelBooking: (id) => {
      const b = getBooking(id);
      if (!b) return fail("Booking not found.");
      const st = bookingStatus(b);
      if (st !== "upcoming" && st !== "pending") return fail("Only upcoming bookings can be cancelled.");
      const f = facility(b.facilityId), r = refundPreview(b, f, now(), st === "pending"), t = nowIso();
      S.set((x) => withNote({ ...x, bookings: x.bookings.map((y) => (y.id !== id ? y : {
        ...y, cancelledAt: t, refund: { amount: r.amount, percent: r.percent, note: r.note },
        history: [...y.history, { at: t, action: "Cancelled", detail: `Refund ${money(r.amount)}` }],
      })) }, { kind: "cancelled", title: "Booking cancelled", bookingId: id,
        body: `${f.name}. ${r.amount ? `${money(r.amount)} refunded to ${b.payment.method.toUpperCase()}.` : "No refund under the cancellation policy."} The space has been released.` }), "booking");
      return ok({ refund: r.amount });
    },
    markArrived: (id) => S.set((x) => ({ ...x, bookings: x.bookings.map((b) => (b.id !== id ? b : { ...b, arrivedAt: nowIso(), history: [...b.history, { at: nowIso(), action: "Checked in at entry" }] })) }), "booking"),
    // markExited(id, overstayFeeRupees?) — pass exitPreview(id).fee
    markExited: (id, fee = 0) => S.set((x) => ({ ...x, bookings: x.bookings.map((b) => (b.id !== id ? b : {
      ...b, exitedAt: nowIso(),
      payment: fee ? { ...b.payment, adjustments: [...b.payment.adjustments, { at: nowIso(), amount: fee, reason: "Overstay charge" }] } : b.payment,
      history: [...b.history, { at: nowIso(), action: "Exited facility", detail: fee ? `Overstay charge ${money(fee)}` : undefined }],
    })) }), "booking"),
    // Notifications
    notify: (n) => S.set((s) => withNote(s, n), "notify"), // {kind, title, body, bookingId?, facilityId?}
    markRead: (nid) => S.set((s) => ({ ...s, notifications: s.notifications.map((n) => (n.id === nid ? { ...n, read: true } : n)) })),
    markAllRead: () => S.set((s) => ({ ...s, notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
    removeNotification: (nid) => S.set((s) => ({ ...s, notifications: s.notifications.filter((n) => n.id !== nid) })),
    clearNotifications: () => S.set((s) => ({ ...s, notifications: [] })),
    // Saved searches
    saveSearch: (label, alerts = true) => S.set((s) => ({ ...s, savedSearches: [{
      id: uid(), label, destId: s.search.destId, custom: s.search.custom, filters: s.search.filters,
      durationH: (new Date(s.search.end) - new Date(s.search.start)) / HOUR, alerts, createdAt: nowIso(),
    }, ...s.savedSearches] })),
    toggleSearchAlert: (sid) => S.set((s) => ({ ...s, savedSearches: s.savedSearches.map((x) => (x.id === sid ? { ...x, alerts: !x.alerts } : x)) })),
    removeSearch: (sid) => S.set((s) => ({ ...s, savedSearches: s.savedSearches.filter((x) => x.id !== sid) })),
    // runSavedSearch(sid): load a saved search into the current search
    runSavedSearch: (sid) => {
      const ss = S.state.savedSearches.find((x) => x.id === sid);
      if (!ss) return;
      const start = new Date(S.state.search.start).getTime();
      S.set((s) => ({ ...s, search: { ...s.search, destId: ss.destId, custom: ss.custom, filters: { ...D.filterDefaults, ...ss.filters }, end: new Date(start + ss.durationH * HOUR).toISOString() } }));
    },
    // checkAlerts() → number of new alert notifications
    checkAlerts: () => {
      let count = 0;
      S.set((s) => {
        let d = { ...s, demo: { ...s.demo, seed: s.demo.seed + 1 } };
        d.savedSearches = s.savedSearches.map((ss) => {
          if (!ss.alerts) return ss;
          const search = { ...s.search, destId: ss.destId, custom: ss.custom, filters: { ...D.filterDefaults, ...ss.filters },
            end: new Date(new Date(s.search.start).getTime() + ss.durationH * HOUR).toISOString() };
          const { results } = searchFacilities({ search, bookings: s.bookings, seed: d.demo.seed, vehicleType: defaultVehicle(s).type });
          const best = results.filter((r) => r.free > 0).sort((a, b) => a.rate - b.rate)[0];
          if (!best) return ss;
          const spaces = results.reduce((n, r) => n + r.free, 0);
          if (ss.lastPrice !== best.rate || ss.lastSpaces !== spaces) {
            count++;
            d = withNote(d, { kind: "price", facilityId: best.f.id, title: `Alert: ${ss.label}`,
              body: `Cheapest now ${money(best.rate)}/h at ${best.f.name}; ${spaces} spaces free across ${results.length} ${results.length === 1 ? "place" : "places"}.` });
          }
          return { ...ss, lastPrice: best.rate, lastSpaces: spaces };
        });
        return d;
      }, "alerts");
      return count;
    },
    refreshAvailability: () => S.set((s) => {
      const d = { ...s, demo: { ...s.demo, seed: s.demo.seed + 1 } };
      if (!s.prefs.notify.availability) return d;
      const f = facility(s.savedIds[0] || "cp-palika");
      return withNote(d, { kind: "availability", facilityId: f.id, title: `Availability updated: ${f.name}`, body: "Live counts refreshed. Check your saved spots for changes." });
    }, "seed"),
    // Demo / developer options
    setDemo: (p) => { S.set((s) => ({ ...s, demo: { ...s.demo, ...p } }), "demo"); if (p.clockOffsetMin !== undefined) { setClockOffsetRaw(p.clockOffsetMin); runTick(); } },
    setClockOffset: (min) => A.setDemo({ clockOffsetMin: Math.round(min) }),
    advanceClock: (min) => A.setClockOffset(S.state.demo.clockOffsetMin + min),
    // Jump to 10 min before the next entry (upcoming) or exit (active). Returns a label or null.
    jumpToNextEvent: () => {
      const b = S.state.bookings.find((x) => ["active", "upcoming"].includes(bookingStatus(x)));
      if (!b) return null;
      const up = bookingStatus(b) === "upcoming";
      const target = new Date(up ? b.start : b.end).getTime() - 10 * MIN;
      A.setClockOffset(S.state.demo.clockOffsetMin + Math.round((target - now()) / MIN));
      return `Jumped to 10 min before ${up ? "entry" : "exit"}`;
    },
    resetDemo: () => {
      setClockOffsetRaw(0);
      try { localStorage.removeItem(STORE_KEY); } catch {}
      S.set({ ...buildSeedState(Date.now()), onboarded: true }, "reset");
    },
  };
  // Live diff for a modification without saving it → {ok, value:{price, diff, vehicle, start, end, mode, reqs, issues}}
  function previewModify(id, o) {
    const s = S.state, b = getBooking(id, s), f = facility(b.facilityId);
    const v = s.vehicles.find((x) => x.id === (o.vehicleId || b.vehicleId));
    if (!v) return fail("Choose a vehicle.");
    const start = +new Date(o.start ?? b.start), end = +new Date(o.end ?? b.end), mode = o.mode || b.mode, reqs = o.requirements || b.requirements;
    const check = validateBooking({ facility: f, start, end, mode, vehicle: v, bookings: s.bookings, seed: s.demo.seed, nowMs: now(), excludeId: id });
    if (check.issues.length) return { ok: false, error: check.issues[0].message, issues: check.issues };
    const price = quote({ facility: f, start, end, mode, vehicleType: v.type, evCharging: reqs.includes("EV charging"), promo: b.price.promo });
    return ok({ price, diff: price.total - paidSoFar(b), vehicle: v, start, end, mode, reqs, issues: [] });
  }
  A.previewModify = previewModify;
  // exitPreview(id) → {overMs, fee} for the "I've exited" confirm
  A.exitPreview = (id) => {
    const b = getBooking(id), over = Math.max(0, now() - new Date(b.end).getTime());
    return { overMs: over, fee: b.arrivedAt ? overstayFee(facility(b.facilityId), b.vehicle.type, over) : 0 };
  };

  // 15-second tick: auto-create "starts soon" and "ends in 15 min" notifications.
  function runTick() {
    const s = S.state, t = now();
    let d = s;
    for (const b of s.bookings) {
      const st = bookingStatus(b, t), f = facility(b.facilityId);
      const has = (kind, txt) => d.notifications.some((n) => n.kind === kind && n.bookingId === b.id && (!txt || n.body.includes(txt)));
      if (s.prefs.notify.reminders && st === "upcoming" && new Date(b.start).getTime() - t < HOUR && !has("reminder", timeLabel(b.start)))
        d = withNote(d, { kind: "reminder", title: `Starts soon: ${f.name}`, body: `Entry at ${timeLabel(b.start)} · ${b.bay}. Tap “I'm arriving” when you're close.`, bookingId: b.id });
      const endMs = new Date(b.end).getTime();
      if (st === "active" && endMs - t < 15 * MIN && endMs > t && !has("ending", timeLabel(b.end)))
        d = withNote(d, { kind: "ending", title: "Your booking ends in 15 minutes", body: `${f.name} until ${timeLabel(b.end)}. Extend now to avoid overstay charges.`, bookingId: b.id });
    }
    if (d !== s) {
      S.set(d, "tick");
      const n = d.notifications[0];
      if (typeof document !== "undefined" && n) toast(n.title, n.kind === "ending" ? "warn" : "info");
    }
  }
  setInterval(runTick, 15000);

  /* ───────────────────── 9. UI HELPERS ───────────────────── */
  // Lucide icon paths (ported from the bundle's icon set + a few extras). icon(name, size?, cls?) → SVG string
  const ICONS = {"accessibility":"<circle cx=\"16\" cy=\"4\" r=\"1\"/><path d=\"m18 19 1-7-6 1\"/><path d=\"m5 8 3-3 5.5 3-2.36 3.5\"/><path d=\"M4.24 14.5a5 5 0 0 0 6.88 6\"/><path d=\"M13.76 17.5a5 5 0 0 0-6.88-6\"/>",
    "alarm-clock":"<circle cx=\"12\" cy=\"13\" r=\"8\"/><path d=\"M12 9v4l2 2\"/><path d=\"M5 3 2 6\"/><path d=\"m22 6-3-3\"/><path d=\"M6.38 18.7 4 21\"/><path d=\"M17.64 18.67 20 21\"/>",
    "arrow-left":"<path d=\"m12 19-7-7 7-7\"/><path d=\"M19 12H5\"/>",
    "arrow-right":"<path d=\"M5 12h14\"/><path d=\"m12 5 7 7-7 7\"/>",
    "arrow-up-right":"<path d=\"M7 7h10v10\"/><path d=\"M7 17 17 7\"/>",
    "bell-off":"<path d=\"M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5\"/><path d=\"M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .3-1.7\"/><path d=\"M10.3 21a1.94 1.94 0 0 0 3.4 0\"/><path d=\"m2 2 20 20\"/>",
    "bell":"<path d=\"M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9\"/><path d=\"M10.3 21a1.94 1.94 0 0 0 3.4 0\"/>",
    "bike":"<circle cx=\"18.5\" cy=\"17.5\" r=\"3.5\"/><circle cx=\"5.5\" cy=\"17.5\" r=\"3.5\"/><circle cx=\"15\" cy=\"5\" r=\"1\"/><path d=\"M12 17.5V14l-3-3 4-3 2 3h2\"/>",
    "bookmark-check":"<path d=\"m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z\"/><path d=\"m9 10 2 2 4-4\"/>",
    "bookmark-plus":"<path d=\"m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z\"/><line x1=\"12\" x2=\"12\" y1=\"7\" y2=\"13\"/><line x1=\"15\" x2=\"9\" y1=\"10\" y2=\"10\"/>",
    "calendar-check":"<path d=\"M8 2v4\"/><path d=\"M16 2v4\"/><rect width=\"18\" height=\"18\" x=\"3\" y=\"4\" rx=\"2\"/><path d=\"M3 10h18\"/><path d=\"m9 16 2 2 4-4\"/>",
    "calendar-clock":"<path d=\"M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5\"/><path d=\"M16 2v4\"/><path d=\"M8 2v4\"/><path d=\"M3 10h5\"/><path d=\"M17.5 17.5 16 16.3V14\"/><circle cx=\"16\" cy=\"16\" r=\"6\"/>",
    "calendar-days":"<path d=\"M8 2v4\"/><path d=\"M16 2v4\"/><rect width=\"18\" height=\"18\" x=\"3\" y=\"4\" rx=\"2\"/><path d=\"M3 10h18\"/><path d=\"M8 14h.01\"/><path d=\"M12 14h.01\"/><path d=\"M16 14h.01\"/><path d=\"M8 18h.01\"/><path d=\"M12 18h.01\"/><path d=\"M16 18h.01\"/>",
    "calendar-plus":"<path d=\"M8 2v4\"/><path d=\"M16 2v4\"/><path d=\"M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8\"/><path d=\"M3 10h18\"/><path d=\"M16 19h6\"/><path d=\"M19 16v6\"/>",
    "car":"<path d=\"M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2\"/><circle cx=\"7\" cy=\"17\" r=\"2\"/><path d=\"M9 17h6\"/><circle cx=\"17\" cy=\"17\" r=\"2\"/>",
    "check-check":"<path d=\"M18 6 7 17l-5-5\"/><path d=\"m22 10-7.5 7.5L13 16\"/>",
    "check":"<path d=\"M20 6 9 17l-5-5\"/>",
    "chevron-right":"<path d=\"m9 18 6-6-6-6\"/>",
    "circle-check":"<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"m9 12 2 2 4-4\"/>",
    "circle-help":"<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3\"/><path d=\"M12 17h.01\"/>",
    "circle-x":"<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"m15 9-6 6\"/><path d=\"m9 9 6 6\"/>",
    "clock":"<circle cx=\"12\" cy=\"12\" r=\"10\"/><polyline points=\"12 6 12 12 16 14\"/>",
    "compass":"<path d=\"m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z\"/><circle cx=\"12\" cy=\"12\" r=\"10\"/>",
    "copy":"<rect width=\"14\" height=\"14\" x=\"8\" y=\"8\" rx=\"2\" ry=\"2\"/><path d=\"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2\"/>",
    "credit-card":"<rect width=\"20\" height=\"14\" x=\"2\" y=\"5\" rx=\"2\"/><line x1=\"2\" x2=\"22\" y1=\"10\" y2=\"10\"/>",
    "crosshair":"<circle cx=\"12\" cy=\"12\" r=\"10\"/><line x1=\"22\" x2=\"18\" y1=\"12\" y2=\"12\"/><line x1=\"6\" x2=\"2\" y1=\"12\" y2=\"12\"/><line x1=\"12\" x2=\"12\" y1=\"6\" y2=\"2\"/><line x1=\"12\" x2=\"12\" y1=\"22\" y2=\"18\"/>",
    "fast-forward":"<polygon points=\"13 19 22 12 13 5 13 19\"/><polygon points=\"2 19 11 12 2 5 2 19\"/>",
    "file-text":"<path d=\"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z\"/><path d=\"M14 2v4a2 2 0 0 0 2 2h4\"/><path d=\"M10 9H8\"/><path d=\"M16 13H8\"/><path d=\"M16 17H8\"/>",
    "footprints":"<path d=\"M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z\"/><path d=\"M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z\"/><path d=\"M16 17h4\"/><path d=\"M4 13h4\"/>",
    "heart":"<path d=\"M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z\"/>",
    "info":"<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16v-4\"/><path d=\"M12 8h.01\"/>",
    "list":"<path d=\"M3 12h.01\"/><path d=\"M3 18h.01\"/><path d=\"M3 6h.01\"/><path d=\"M8 12h13\"/><path d=\"M8 18h13\"/><path d=\"M8 6h13\"/>",
    "loader-circle":"<path d=\"M21 12a9 9 0 1 1-6.219-8.56\"/>",
    "locate-fixed":"<line x1=\"2\" x2=\"5\" y1=\"12\" y2=\"12\"/><line x1=\"19\" x2=\"22\" y1=\"12\" y2=\"12\"/><line x1=\"12\" x2=\"12\" y1=\"2\" y2=\"5\"/><line x1=\"12\" x2=\"12\" y1=\"19\" y2=\"22\"/><circle cx=\"12\" cy=\"12\" r=\"7\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>",
    "lock":"<rect width=\"18\" height=\"11\" x=\"3\" y=\"11\" rx=\"2\" ry=\"2\"/><path d=\"M7 11V7a5 5 0 0 1 10 0v4\"/>",
    "log-out":"<path d=\"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4\"/><polyline points=\"16 17 21 12 16 7\"/><line x1=\"21\" x2=\"9\" y1=\"12\" y2=\"12\"/>",
    "map-pin":"<path d=\"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0\"/><circle cx=\"12\" cy=\"10\" r=\"3\"/>",
    "map":"<path d=\"M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z\"/><path d=\"M15 5.764v15\"/><path d=\"M9 3.236v15\"/>",
    "minus":"<path d=\"M5 12h14\"/>",
    "moon":"<path d=\"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z\"/>",
    "navigation":"<polygon points=\"3 11 22 2 13 21 11 13 3 11\"/>",
    "pencil":"<path d=\"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z\"/><path d=\"m15 5 4 4\"/>",
    "phone":"<path d=\"M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z\"/>",
    "plane":"<path d=\"M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z\"/>",
    "plus":"<path d=\"M5 12h14\"/><path d=\"M12 5v14\"/>",
    "qr-code":"<rect width=\"5\" height=\"5\" x=\"3\" y=\"3\" rx=\"1\"/><rect width=\"5\" height=\"5\" x=\"16\" y=\"3\" rx=\"1\"/><rect width=\"5\" height=\"5\" x=\"3\" y=\"16\" rx=\"1\"/><path d=\"M21 16h-3a2 2 0 0 0-2 2v3\"/><path d=\"M21 21v.01\"/><path d=\"M12 7v3a2 2 0 0 1-2 2H7\"/><path d=\"M3 12h.01\"/><path d=\"M12 3h.01\"/><path d=\"M12 16v.01\"/><path d=\"M16 12h1\"/><path d=\"M21 12v.01\"/><path d=\"M12 21v-1\"/>",
    "receipt":"<path d=\"M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z\"/><path d=\"M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8\"/><path d=\"M12 17.5v-11\"/>",
    "refresh-cw":"<path d=\"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8\"/><path d=\"M21 3v5h-5\"/><path d=\"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16\"/><path d=\"M8 16H3v5\"/>",
    "rotate-ccw":"<path d=\"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\"/><path d=\"M3 3v5h5\"/>",
    "ruler":"<path d=\"M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z\"/><path d=\"m14.5 12.5 2-2\"/><path d=\"m11.5 9.5 2-2\"/><path d=\"m8.5 6.5 2-2\"/><path d=\"m17.5 15.5 2-2\"/>",
    "scale":"<path d=\"m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z\"/><path d=\"m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z\"/><path d=\"M7 21h10\"/><path d=\"M12 3v18\"/><path d=\"M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2\"/>",
    "search-x":"<path d=\"m13.5 8.5-5 5\"/><path d=\"m8.5 8.5 5 5\"/><circle cx=\"11\" cy=\"11\" r=\"8\"/><path d=\"m21 21-4.3-4.3\"/>",
    "search":"<circle cx=\"11\" cy=\"11\" r=\"8\"/><path d=\"m21 21-4.3-4.3\"/>",
    "shield-check":"<path d=\"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z\"/><path d=\"m9 12 2 2 4-4\"/>",
    "sliders-horizontal":"<line x1=\"21\" x2=\"14\" y1=\"4\" y2=\"4\"/><line x1=\"10\" x2=\"3\" y1=\"4\" y2=\"4\"/><line x1=\"21\" x2=\"12\" y1=\"12\" y2=\"12\"/><line x1=\"8\" x2=\"3\" y1=\"12\" y2=\"12\"/><line x1=\"21\" x2=\"16\" y1=\"20\" y2=\"20\"/><line x1=\"12\" x2=\"3\" y1=\"20\" y2=\"20\"/><line x1=\"14\" x2=\"14\" y1=\"2\" y2=\"6\"/><line x1=\"8\" x2=\"8\" y1=\"10\" y2=\"14\"/><line x1=\"16\" x2=\"16\" y1=\"18\" y2=\"22\"/>",
    "smartphone":"<rect width=\"14\" height=\"20\" x=\"5\" y=\"2\" rx=\"2\" ry=\"2\"/><path d=\"M12 18h.01\"/>",
    "sparkles":"<path d=\"M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z\"/><path d=\"M20 3v4\"/><path d=\"M22 5h-4\"/><path d=\"M4 17v2\"/><path d=\"M5 18H3\"/>",
    "star":"<path d=\"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z\"/>",
    "sun":"<circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2\"/><path d=\"M12 20v2\"/><path d=\"m4.93 4.93 1.41 1.41\"/><path d=\"m17.66 17.66 1.41 1.41\"/><path d=\"M2 12h2\"/><path d=\"M20 12h2\"/><path d=\"m6.34 17.66-1.41 1.41\"/><path d=\"m19.07 4.93-1.41 1.41\"/>",
    "tag":"<path d=\"M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z\"/><circle cx=\"7.5\" cy=\"7.5\" r=\".5\" fill=\"currentColor\"/>",
    "timer":"<line x1=\"10\" x2=\"14\" y1=\"2\" y2=\"2\"/><line x1=\"12\" x2=\"15\" y1=\"14\" y2=\"11\"/><circle cx=\"12\" cy=\"14\" r=\"8\"/>",
    "triangle-alert":"<path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/>",
    "user":"<path d=\"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2\"/><circle cx=\"12\" cy=\"7\" r=\"4\"/>",
    "wallet":"<path d=\"M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1\"/><path d=\"M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4\"/>",
    "x":"<path d=\"M18 6 6 18\"/><path d=\"m6 6 12 12\"/>",
    "zap":"<path d=\"M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z\"/>",
    "house":"<path d=\"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8\"/><path d=\"M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"/>",
    "briefcase":"<path d=\"M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16\"/><rect width=\"20\" height=\"14\" x=\"2\" y=\"6\" rx=\"2\"/>",
    "umbrella":"<path d=\"M22 12a10.06 10.06 1 0 0-20 0Z\"/><path d=\"M12 12v8a2 2 0 0 0 4 0\"/><path d=\"M12 2v1\"/>",
    "video":"<path d=\"m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5\"/><rect x=\"2\" y=\"6\" width=\"14\" height=\"12\" rx=\"2\"/>",
    "chevron-left":"<path d=\"m15 18-6-6 6-6\"/>",
    "chevron-down":"<path d=\"m6 9 6 6 6-6\"/>",
    "chevron-up":"<path d=\"m18 15-6-6-6 6\"/>",
    "trash":"<path d=\"M3 6h18\"/><path d=\"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6\"/><path d=\"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2\"/>",
    "download":"<path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"/><polyline points=\"7 10 12 15 17 10\"/><line x1=\"12\" x2=\"12\" y1=\"15\" y2=\"3\"/>",
    "layers":"<path d=\"m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z\"/><path d=\"m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65\"/><path d=\"m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65\"/>",
    "columns":"<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"/><path d=\"M12 3v18\"/>",
    "menu":"<line x1=\"4\" x2=\"20\" y1=\"12\" y2=\"12\"/><line x1=\"4\" x2=\"20\" y1=\"6\" y2=\"6\"/><line x1=\"4\" x2=\"20\" y1=\"18\" y2=\"18\"/>",
    "more":"<circle cx=\"12\" cy=\"12\" r=\"1\"/><circle cx=\"19\" cy=\"12\" r=\"1\"/><circle cx=\"5\" cy=\"12\" r=\"1\"/>",
    "door":"<path d=\"M13 4h3a2 2 0 0 1 2 2v14\"/><path d=\"M2 20h3\"/><path d=\"M13 20h9\"/><path d=\"M10 12v.01\"/><path d=\"M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561Z\"/>"};

  function icon(name, size = 18, cls = "") {
    const body = ICONS[name] || ICONS["info"];
    return `<svg class="ico ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  }
  // Escape text for HTML templates.
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  // h(html) → first element built from an HTML string
  function h(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; }
  const reducedMotion = () => (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches) || !!(S.state.prefs && S.state.prefs.reduceMotion);

  // The P logo (forest rounded square, white P, lime dot). logo(size, withWord)
  function logo(size = 30, word = true) {
    const mark = `<svg width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="11" fill="#0F2A1F"/><rect x=".5" y=".5" width="39" height="39" rx="10.5" fill="none" stroke="rgba(198,244,50,.25)"/><path d="M13 30V10h8.5a6.5 6.5 0 0 1 0 13H13" fill="none" stroke="#F5F4EF" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="28.5" cy="29" r="3.6" fill="#C6F432"/></svg>`;
    return word ? `<span class="logo">${mark}<span class="logo-word">PARKLY</span></span>` : mark;
  }
  // Indian number plate chip. plate('DL 8C AF 4521', 'sm'|'lg'?)
  const plate = (p, size = "") => `<span class="plate${size ? " plate-" + size : ""}"><span class="plate-ind">IND</span><span class="plate-no">${esc(p)}</span></span>`;
  // Occupancy bar: "38 of 120 free"
  function occ(free, capacity, opts = {}) {
    const tone = toneClass(availTone(free, capacity));
    const pct = capacity ? Math.max(0, Math.min(100, Math.round((free / capacity) * 100))) : 0; // bar length = share free
    const label = free <= 0 ? "Full for your time" : `<b>${free}</b> of ${capacity} free`;
    return `<div class="occ occ-${tone} ${opts.cls || ""}" role="img" aria-label="${free} of ${capacity} spaces free"><div class="occ-track"><div class="occ-fill" style="width:${pct}%"></div></div><div class="occ-label">${label}</div></div>`;
  }
  // Star rating "★ 4.6 (1,284)"
  function stars(r, count, opts = {}) {
    const full = Math.round(r);
    const row = opts.row ? `<span class="stars-row">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= full ? "on" : ""}">★</i>`).join("")}</span>` : `<i class="on">★</i>`;
    return `<span class="stars">${row}<b>${r.toFixed(1)}</b>${count !== undefined ? `<span class="muted">(${Number(count).toLocaleString("en-IN")})</span>` : ""}</span>`;
  }
  const badge = (text, tone = "neutral", ico) => `<span class="badge badge-${tone}">${ico ? icon(ico, 13) : ""}${esc(text)}</span>`;
  const statusBadge = (b) => {
    const st = bookingStatus(b);
    return isOverstay(b) ? badge("Overstay", "danger", "triangle-alert") : badge(D.statusLabels[st], statusTone(st));
  };
  // Itemised bill from quote().lines
  function bill(q, opts = {}) {
    const rows = q.lines.map((l) => `<div class="bill-row${l.amount < 0 ? " is-neg" : ""}"><div><div class="bill-label">${esc(l.label)}</div>${l.hint ? `<div class="bill-hint">${esc(l.hint)}</div>` : ""}</div><div class="bill-amt">${l.amount < 0 ? "− " + money(-l.amount) : money(l.amount)}</div></div>`).join("");
    return `<div class="bill">${rows}<div class="bill-total"><span>${esc(opts.totalLabel || "Total")}</span><span class="bill-amt" data-roll>${money(q.total)}</span></div></div>`;
  }
  // Amenity icon list for a facility → [{icon, label}]
  function amenityIcons(f) {
    const out = [];
    if (f.ev) out.push({ icon: "zap", label: "EV charging" });
    if (f.accessible) out.push({ icon: "accessibility", label: "Accessible" });
    if (f.motorcycle) out.push({ icon: "bike", label: "Two-wheelers" });
    if (f.covered) out.push({ icon: "umbrella", label: "Covered" });
    if (f.security.includes("cctv")) out.push({ icon: "video", label: "CCTV" });
    if (f.security.includes("guarded")) out.push({ icon: "shield-check", label: "Guarded" });
    if (f.overnight) out.push({ icon: "moon", label: "Overnight" });
    return out;
  }

  /* rollNumber(el, newText): animated swap of a number/price (old rolls up, new rolls in). */
  function rollNumber(el, text) {
    if (!el) return;
    text = String(text);
    const old = el.dataset.val ?? el.textContent;
    if (old === text) return;
    el.dataset.val = text;
    if (reducedMotion()) { el.textContent = text; return; }
    el.classList.add("roll");
    el.innerHTML = `<span class="roll-old">${esc(old)}</span><span class="roll-new">${esc(text)}</span>`;
    clearTimeout(el._rollT);
    el._rollT = setTimeout(() => { el.classList.remove("roll"); el.textContent = text; }, 360);
  }

  /* ─────────────────── 11. TOAST + OVERLAY ─────────────────── */
  // toast(text, tone='info'|'ok'|'warn'|'danger', action?{label, onClick}, ms=3200)
  function toast(text, tone = "info", action, ms = 3200) {
    let host = document.querySelector(".toast-host");
    if (!host) { host = document.createElement("div"); host.className = "toast-host"; host.setAttribute("aria-live", "polite"); (document.querySelector(".device") || document.body).appendChild(host); }
    const ic = { ok: "circle-check", warn: "triangle-alert", danger: "circle-x", info: "info" }[tone] || "info";
    const t = h(`<div class="toast toast-${tone}" role="status">${icon(ic, 18)}<span class="toast-text">${esc(text)}</span>${action ? `<button class="toast-act">${esc(action.label)}</button>` : ""}</div>`);
    if (action) t.querySelector(".toast-act").onclick = () => { action.onClick(); close(); };
    host.appendChild(t);
    const close = () => { t.classList.add("is-out"); setTimeout(() => t.remove(), 240); };
    setTimeout(close, ms);
    return close;
  }

  /* Overlay: one API for mobile bottom sheets and desktop modals.
     openSheet({title, body (html|Node), footer (html|Node), kind:'sheet'|'modal'|'auto', size:'sm'|'md'|'lg', onClose, dismissable})
     → {el, body, footer, close()}. 'auto' = modal on body.d, sheet otherwise. Esc and backdrop close it. */
  const overlayStack = [];
  function openSheet(o = {}) {
    const kind = o.kind && o.kind !== "auto" ? o.kind : document.body.classList.contains("d") ? "modal" : "sheet";
    const host = document.querySelector(".device") || document.body;
    const wrap = h(`<div class="overlay overlay-${kind}" role="presentation"><div class="overlay-backdrop"></div>
      <div class="${kind} ${o.size ? kind + "-" + o.size : ""}" role="dialog" aria-modal="true" ${o.title ? `aria-label="${esc(o.title)}"` : ""} tabindex="-1">
        ${kind === "sheet" ? '<div class="sheet-grip" aria-hidden="true"></div>' : ""}
        ${o.title ? `<div class="${kind}-head"><h2 class="${kind}-title">${esc(o.title)}</h2><button class="btn btn-ghost btn-icon btn-sm" data-close aria-label="Close">${icon("x", 18)}</button></div>` : ""}
        <div class="${kind}-body"></div>
        <div class="${kind}-foot"></div>
      </div></div>`);
    const panel = wrap.querySelector("." + kind), body = wrap.querySelector(`.${kind}-body`), foot = wrap.querySelector(`.${kind}-foot`);
    const put = (slot, c) => { if (c == null) return; if (typeof c === "string") slot.innerHTML = c; else slot.appendChild(c); };
    put(body, o.body); put(foot, o.footer);
    if (!o.footer) foot.remove();
    const prevFocus = document.activeElement;
    let closed = false;
    const api = {
      el: panel, body, footer: foot,
      close() {
        if (closed) return; closed = true;
        wrap.classList.add("is-closing");
        const i = overlayStack.indexOf(api); if (i >= 0) overlayStack.splice(i, 1);
        setTimeout(() => wrap.remove(), reducedMotion() ? 0 : 220);
        if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch {}
        o.onClose && o.onClose();
      },
    };
    if (o.dismissable !== false) wrap.querySelector(".overlay-backdrop").onclick = api.close;
    wrap.querySelectorAll("[data-close]").forEach((b) => (b.onclick = api.close));
    host.appendChild(wrap);
    overlayStack.push(api);
    requestAnimationFrame(() => panel.focus({ preventScroll: true }));
    return api;
  }
  const closeTopSheet = () => { const t = overlayStack[overlayStack.length - 1]; if (t) { t.close(); return true; } return false; };
  // confirmDialog({title, body, confirm:'Cancel booking', tone:'danger', cancel:'Keep'}) → Promise<boolean>
  function confirmDialog(o) {
    return new Promise((res) => {
      let done = false;
      const s = openSheet({ title: o.title, size: "sm", body: `<div class="confirm-body">${o.body || ""}</div>`,
        footer: `<button class="btn btn-secondary btn-md" data-no>${esc(o.cancel || "Go back")}</button><button class="btn btn-${o.tone || "primary"} btn-md" data-yes>${esc(o.confirm || "Confirm")}</button>`,
        onClose: () => { if (!done) res(false); } });
      s.footer.querySelector("[data-no]").onclick = () => { done = true; res(false); s.close(); };
      s.footer.querySelector("[data-yes]").onclick = () => { done = true; res(true); s.close(); };
    });
  }
  if (typeof document !== "undefined") document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeTopSheet(); });

  /* ───────────────────────── 10. ROUTER ───────────────────────── */
  /* Hash router. Router.on(fn(route)) where route = {path, name, params, query, parts}.
     Names: welcome, landing, explore, map, parking, reserve, checkout, confirmation, bookings, booking, arrive,
            saved, compare, notifications, profile. Router.go('#/parking/khan') or Router.go('/parking/khan'). */
  const ROUTES = [
    ["^/?$", "landing"], ["^/welcome$", "welcome"], ["^/explore$", "explore"], ["^/map$", "map"],
    ["^/parking/([^/]+)$", "parking", ["id"]], ["^/reserve/([^/]+)$", "reserve", ["id"]], ["^/checkout/([^/]+)$", "checkout", ["id"]],
    ["^/confirmation/([^/]+)$", "confirmation", ["id"]], ["^/bookings$", "bookings"], ["^/bookings/([^/]+)/arrive$", "arrive", ["id"]],
    ["^/bookings/([^/]+)$", "booking", ["id"]], ["^/saved$", "saved"], ["^/compare$", "compare"], ["^/notifications$", "notifications"], ["^/profile$", "profile"],
  ].map(([re, name, keys]) => ({ re: new RegExp(re), name, keys: keys || [] }));
  const Router = {
    handlers: [], current: null,
    parse(hash = location.hash) {
      const raw = (hash || "").replace(/^#/, "") || "/";
      const [path, qs] = raw.split("?");
      const query = Object.fromEntries(new URLSearchParams(qs || ""));
      for (const r of ROUTES) {
        const m = path.match(r.re);
        if (m) return { path, name: r.name, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])), query, parts: path.split("/").filter(Boolean) };
      }
      return { path, name: "notfound", params: {}, query, parts: path.split("/").filter(Boolean) };
    },
    // go(path, query?) — path like '/parking/khan' or '#/parking/khan'; query object becomes ?a=b
    go(path, query) {
      let p = String(path).replace(/^#/, "");
      if (query) p += "?" + new URLSearchParams(query).toString();
      if ("#" + p === location.hash) Router.render(); else location.hash = p;
    },
    back(fallback = "/explore") { if (history.length > 1) history.back(); else Router.go(fallback); },
    replace(path) { history.replaceState(null, "", "#" + String(path).replace(/^#/, "")); Router.render(); },
    on(fn) { Router.handlers.push(fn); return () => (Router.handlers = Router.handlers.filter((x) => x !== fn)); },
    render() {
      const prev = Router.current;
      Router.current = Router.parse();
      while (overlayStack.length) overlayStack[overlayStack.length - 1].close();
      Router.handlers.forEach((fn) => fn(Router.current, prev));
      const sc = document.querySelector("[data-scroll-root]");
      if (!prev || prev.path !== Router.current.path) { (sc || window).scrollTo(0, 0); if (sc) sc.scrollTop = 0; }
    },
    start() { window.addEventListener("hashchange", Router.render); Router.render(); },
  };

  /* ───────────────────────── 12. SVG MAP ───────────────────────── */
  /* SvgMap.render(container, opts) → controller
     opts: items [{f, free, rate}] (e.g. searchFacilities().results), dest {lat,lng,name}, radiusKm,
           selectedId, routeTo {lat,lng} (draws dashed walk route to dest + "N min walk" tag),
           compact (static thumbnail: no pan/zoom, click → onOpen), onSelect(id), onSearchArea({lat,lng}),
           onOpen(), onPinHover(id|null), showControls (default !compact)
     controller: update(partialOpts), select(id), highlight(id), recenter(), getCenter(), destroy() */
  const MAPG = D.map, PJ = MAPG.projection, KM = PJ.scale; // KM = map units per km
  const project = (p) => ({ x: (p.lng - PJ.lng0) * PJ.kx * PJ.scale, y: (PJ.lat0 - p.lat) * PJ.ky * PJ.scale });
  const unproject = (x, y) => ({ lng: x / (PJ.kx * PJ.scale) + PJ.lng0, lat: PJ.lat0 - y / (PJ.ky * PJ.scale) });
  const pathOf = (pts, close) => pts.map((p, i) => { const q = project({ lat: p[0], lng: p[1] }); return `${i ? "L" : "M"}${q.x.toFixed(1)},${q.y.toFixed(1)}`; }).join("") + (close ? "Z" : "");
  const MAP_COL = { bg: "#0E1511", road: "#2B3A31", minor: "#1E2A23", water: "#13303A", park: "#17301F", runway: "#1E2A23", centre: "rgba(245,244,239,.10)" };
  let baseLayer = null; // geometry built once, cloned per map
  function mapBase() {
    if (baseLayer) return baseLayer;
    const far = project({ lat: 28.45, lng: 77.33 });
    baseLayer = [
      `<rect x="-2000" y="-2000" width="${far.x + 4000}" height="${far.y + 4000}" fill="${MAP_COL.bg}"/>`,
      ...MAPG.parks.map((p) => `<path d="${pathOf(p, true)}" fill="${MAP_COL.park}"/>`),
      `<path d="${pathOf(MAPG.river)}" fill="none" stroke="${MAP_COL.water}" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>`,
      ...MAPG.runways.map((p) => `<path d="${pathOf(p, true)}" fill="${MAP_COL.runway}"/>`),
      ...MAPG.minorRoads.map((p) => `<path d="${pathOf(p)}" fill="none" stroke="${MAP_COL.minor}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`),
      ...MAPG.roads.map((p) => `<path d="${pathOf(p)}" fill="none" stroke="${MAP_COL.road}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>`),
      ...MAPG.roads.map((p) => `<path d="${pathOf(p)}" fill="none" stroke="${MAP_COL.centre}" stroke-width="1.2" stroke-dasharray="10 14" stroke-linecap="round"/>`),
    ].join("");
    return baseLayer;
  }
  const SvgMap = {
    project, unproject,
    render(container, opts = {}) {
      const o = { items: [], radiusKm: 0, ...opts };
      if (!o.dest) o.dest = searchCenter(S.state.search);
      const el = typeof container === "string" ? document.querySelector(container) : container;
      el.classList.add("map");
      el.classList.toggle("map-compact", !!o.compact);
      el.innerHTML = `
        <svg class="map-svg" aria-hidden="true"><g class="map-world">${mapBase()}<g class="map-dyn"></g></g><g class="map-labels"></g></svg>
        <div class="map-layer"></div>
        ${o.compact ? `<div class="map-open">${icon("map", 13)} Open map</div>` : `
        <div class="map-ctrls"><button class="map-ctrl" data-z="in" aria-label="Zoom in">${icon("plus", 16)}</button><button class="map-ctrl" data-z="out" aria-label="Zoom out">${icon("minus", 16)}</button><button class="map-ctrl" data-z="home" aria-label="Back to destination" title="Back to destination">${icon("crosshair", 16)}</button></div>
        <button class="map-search-area" hidden>${icon("search", 14)} Search this area</button>`}
        <div class="map-scale"><div class="map-scale-bar"></div><div class="map-scale-txt"></div></div>`;
      el.tabIndex = o.compact ? -1 : 0;
      el.setAttribute("role", o.compact ? "button" : "application");
      el.setAttribute("aria-label", o.compact ? "Open the map" : "Map of parking near your destination. Use arrow keys to pan and plus or minus to zoom.");
      const svg = el.querySelector(".map-svg"), world = el.querySelector(".map-world"), dyn = el.querySelector(".map-dyn");
      const labels = el.querySelector(".map-labels"), layer = el.querySelector(".map-layer"), searchBtn = el.querySelector(".map-search-area");
      let v = { x: 0, y: 0, z: 1 }, W = 0, H = 0, moved = false, pinEls = new Map(), destEl = null, tagEl = null, raf = 0, first = true;

      const fitZoom = () => Math.max(0.25, Math.min(3, Math.min(W, H) / (2 * Math.max(0.8, o.radiusKm || 4) * KM * 1.12)));
      const centerOn = (p, z = v.z) => { const q = project(p); v = { z, x: W / 2 - q.x * z, y: H / 2 - q.y * z }; };
      const toScreen = (p) => { const q = project(p); return { x: q.x * v.z + v.x, y: q.y * v.z + v.y }; };
      const getCenter = () => unproject((W / 2 - v.x) / v.z, (H / 2 - v.y) / v.z);

      function buildDynamic() { // radius ring + route (in world units, so they scale with the map)
        const d = project(o.dest);
        let s = o.radiusKm ? `<circle class="map-radius" cx="${d.x}" cy="${d.y}" r="${o.radiusKm * KM}"/>` : "";
        if (o.routeTo) { const t = project(o.routeTo); s += `<path class="map-route" d="M${t.x},${t.y} L${t.x},${d.y} L${d.x},${d.y}"/>`; }
        dyn.innerHTML = s;
      }
      function buildPins() {
        layer.innerHTML = "";
        pinEls = new Map();
        destEl = h(`<div class="map-dest"><div class="map-dest-name">${esc(o.dest.name || "Destination")}</div><div class="map-dest-dot"></div><span class="map-dest-ring"></span></div>`);
        layer.appendChild(destEl);
        o.items.forEach((it, i) => {
          const tone = availTone(it.free, it.f.capacity);
          const b = h(`<button class="pin pin-${tone}" style="--i:${i}" ${o.compact ? 'tabindex="-1"' : ""}
            aria-label="${esc(it.f.name)}, ₹${it.rate} per hour, ${it.free > 0 ? it.free + " spaces free" : "full"}">
            <span class="pin-pill">${tone === "ok" ? '<i class="pin-dot"></i>' : ""}₹${it.rate}${it.f.ev ? '<span class="pin-ev">EV</span>' : ""}</span><span class="pin-tail"></span></button>`);
          b.dataset.id = it.f.id;
          b.addEventListener("click", (e) => { e.stopPropagation(); if (o.compact) { o.onOpen && o.onOpen(); return; } ctrl.select(it.f.id); o.onSelect && o.onSelect(it.f.id); });
          b.addEventListener("pointerenter", () => o.onPinHover && o.onPinHover(it.f.id));
          b.addEventListener("pointerleave", () => o.onPinHover && o.onPinHover(null));
          layer.appendChild(b);
          pinEls.set(it.f.id, { el: b, f: it.f });
        });
        if (o.routeTo) {
          const km = distKm(o.routeTo, o.dest);
          tagEl = h(`<div class="map-walk">${icon("footprints", 12)}${walkMin(km)} min walk</div>`);
          layer.appendChild(tagEl);
        } else tagEl = null;
        markSelected();
      }
      function markSelected() { pinEls.forEach((p, id) => { p.el.classList.toggle("is-sel", id === o.selectedId); p.el.setAttribute("aria-pressed", id === o.selectedId); }); }
      function draw() { // reposition everything for the current view
        raf = 0;
        world.setAttribute("transform", `translate(${v.x} ${v.y}) scale(${v.z})`);
        dyn.querySelectorAll(".map-radius,.map-route").forEach((n) => n.style.strokeWidth = (n.classList.contains("map-route") ? 3.2 : 1.4) / v.z + "px");
        const r = dyn.querySelector(".map-route"); if (r) r.style.strokeDasharray = `${2 / v.z} ${6 / v.z}`;
        const c = dyn.querySelector(".map-radius"); if (c) c.style.strokeDasharray = `${6 / v.z} ${5 / v.z}`;
        labels.innerHTML = o.compact ? "" : MAPG.labels.filter((l) => l.big || v.z >= 0.7).map((l) => {
          const p = toScreen({ lat: l.at[0], lng: l.at[1] });
          return `<text x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" class="map-label${l.big ? " is-big" : ""}">${esc(l.text)}</text>`;
        }).join("");
        const ds = toScreen(o.dest);
        if (destEl) { destEl.style.left = ds.x + "px"; destEl.style.top = ds.y + "px"; }
        const placed = o.compact ? [{ x: ds.x, y: ds.y + 10 }] : null; // compact: keep pins apart and off the destination dot
        pinEls.forEach((p, id) => {
          const s = toScreen(p.f);
          let off = s.x < -60 || s.y < -40 || s.x > W + 60 || s.y > H + 40;
          if (placed && !off && id !== o.selectedId) {
            off = placed.length > 4 || s.x < 30 || s.x > W - 30 || s.y < 30 || s.y > H - 4 || placed.some((q) => Math.abs(q.x - s.x) < 62 && Math.abs(q.y - s.y) < 32);
          }
          if (placed && !off) placed.push(s);
          p.el.style.left = s.x + "px"; p.el.style.top = s.y + "px";
          p.el.style.visibility = off ? "hidden" : "";
        });
        if (tagEl) { const t = toScreen(o.routeTo); tagEl.style.left = t.x + 8 + "px"; tagEl.style.top = ds.y + 6 + "px"; }
        // scale bar: pick a round distance about 80px long
        const target = 80 / (KM * v.z), km = [0.25, 0.5, 1, 2, 5, 10, 20].find((k) => k >= target * 0.6) || 20;
        el.querySelector(".map-scale-bar").style.width = km * KM * v.z + "px";
        el.querySelector(".map-scale-txt").textContent = km < 1 ? `${km * 1000} m` : `${km} km`;
        if (searchBtn) searchBtn.hidden = !(moved && o.onSearchArea && distKm(getCenter(), o.dest) > Math.max(0.6, (o.radiusKm || 3) * 0.3));
      }
      const schedule = () => { if (!raf) raf = requestAnimationFrame(draw); };
      const zoomBy = (k, cx = W / 2, cy = H / 2) => { const z = Math.max(0.25, Math.min(4, v.z * k)), f = z / v.z; v = { z, x: cx - (cx - v.x) * f, y: cy - (cy - v.y) * f }; moved = true; schedule(); };

      // pan / pinch / wheel / keys
      const ptrs = new Map(); let drag = null;
      if (!o.compact) {
        el.addEventListener("pointerdown", (e) => {
          if (e.target.closest("button")) return;
          el.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (ptrs.size === 1) drag = { x: e.clientX, y: e.clientY, vx: v.x, vy: v.y, moved: false };
          if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], r = el.getBoundingClientRect(); drag = { vx: v.x, vy: v.y, z: v.z, dist: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2 - r.left, cy: (a.y + b.y) / 2 - r.top, moved: true }; }
          el.classList.add("is-dragging");
        });
        el.addEventListener("pointermove", (e) => {
          if (!ptrs.has(e.pointerId) || !drag) return;
          ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (ptrs.size === 2 && drag.dist) {
            const [a, b] = [...ptrs.values()], z = Math.max(0.25, Math.min(4, drag.z * (Math.hypot(a.x - b.x, a.y - b.y) / drag.dist))), f = z / drag.z;
            v = { z, x: drag.cx - (drag.cx - drag.vx) * f, y: drag.cy - (drag.cy - drag.vy) * f }; moved = true; schedule(); return;
          }
          const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
          if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
          if (drag.moved) { v = { ...v, x: drag.vx + dx, y: drag.vy + dy }; moved = true; schedule(); }
        });
        const up = (e) => { ptrs.delete(e.pointerId); if (!ptrs.size) { drag = null; el.classList.remove("is-dragging"); } };
        el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
        el.addEventListener("wheel", (e) => { e.preventDefault(); const r = el.getBoundingClientRect(); zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
        el.addEventListener("keydown", (e) => {
          const step = 60, k = e.key;
          const act = { ArrowLeft: () => (v.x += step), ArrowRight: () => (v.x -= step), ArrowUp: () => (v.y += step), ArrowDown: () => (v.y -= step), "+": () => zoomBy(1.25), "=": () => zoomBy(1.25), "-": () => zoomBy(0.8) }[k];
          if (act && e.target === el) { e.preventDefault(); act(); moved = true; schedule(); }
        });
        el.querySelectorAll(".map-ctrl").forEach((b) => b.addEventListener("click", (e) => {
          e.stopPropagation(); const z = b.dataset.z;
          if (z === "in") zoomBy(1.3); else if (z === "out") zoomBy(1 / 1.3); else { centerOn(o.dest, fitZoom()); moved = false; schedule(); }
        }));
        if (searchBtn) searchBtn.addEventListener("click", (e) => { e.stopPropagation(); const c = getCenter(); moved = false; o.onSearchArea && o.onSearchArea(c); schedule(); });
      } else el.addEventListener("click", () => o.onOpen && o.onOpen());

      function measureBox() { W = el.clientWidth; H = el.clientHeight; svg.setAttribute("width", W); svg.setAttribute("height", H); }
      const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => {
        const was = W; measureBox();
        if (!was || first) { centerOn(o.dest, fitZoom()); first = false; }
        schedule();
      }) : null;
      measureBox(); centerOn(o.dest, fitZoom()); if (W) first = false;
      buildDynamic(); buildPins(); draw();
      if (ro) ro.observe(el);

      const ctrl = {
        el,
        // update({items, dest, radiusKm, selectedId, routeTo, ...}) — re-centres if dest/radius changed
        update(p = {}) {
          const recenter = (p.dest && (p.dest.lat !== o.dest.lat || p.dest.lng !== o.dest.lng)) || (p.radiusKm !== undefined && p.radiusKm !== o.radiusKm);
          Object.assign(o, p);
          if (recenter) { centerOn(o.dest, fitZoom()); moved = false; }
          buildDynamic(); buildPins(); schedule();
        },
        // select(id): mark pin, pan to it if it's near the edge
        select(id) {
          o.selectedId = id; markSelected();
          const p = pinEls.get(id);
          if (p) { const s = toScreen(p.f), m = 48; if (s.x < m || s.y < m || s.x > W - m || s.y > H - m * 2.5) { centerOn(p.f); moved = true; } p.el.classList.remove("is-pop"); void p.el.offsetWidth; p.el.classList.add("is-pop"); }
          schedule();
        },
        highlight(id) { pinEls.forEach((p, k) => p.el.classList.toggle("is-hot", k === id)); },
        recenter() { centerOn(o.dest, fitZoom()); moved = false; schedule(); },
        getCenter,
        destroy() { if (ro) ro.disconnect(); el.innerHTML = ""; },
      };
      return ctrl;
    },
  };

  /* ───────────────────────── 13. QR CODE ───────────────────────── */
  /* Compact QR encoder: byte mode, error correction M, versions 1–10 (up to 213 bytes),
     automatic mask choice. QR.svg(text, {margin=2, dark, light, size}) → SVG string.
     QR.matrix(text) → boolean[][] (true = dark). */
  const QR = (() => {
    // [ecPerBlock, blocksG1, dataG1, blocksG2, dataG2] for level M, v1..v10
    const EC_M = [null, [10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0], [24, 2, 43, 0, 0],
      [16, 4, 27, 0, 0], [18, 4, 31, 0, 0], [22, 2, 38, 2, 39], [22, 3, 36, 2, 37], [26, 4, 43, 1, 44]];
    const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
    const gmul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z; };
    function rsDivisor(deg) {
      const r = new Array(deg).fill(0); r[deg - 1] = 1; let root = 1;
      for (let i = 0; i < deg; i++) { for (let j = 0; j < deg; j++) { r[j] = gmul(r[j], root); if (j + 1 < deg) r[j] ^= r[j + 1]; } root = gmul(root, 2); }
      return r;
    }
    function rsRemainder(data, div) {
      const r = div.map(() => 0);
      for (const b of data) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => (r[i] ^= gmul(c, f))); }
      return r;
    }
    const utf8 = (s) => Array.from(new TextEncoder().encode(s));
    const bit = (x, i) => ((x >>> i) & 1) !== 0;

    function matrix(text) {
      const bytes = utf8(text);
      let ver = 1;
      for (; ver <= 10; ver++) {
        const e = EC_M[ver], cap = e[1] * e[2] + e[3] * e[4];
        if (4 + (ver < 10 ? 8 : 16) + bytes.length * 8 <= cap * 8) break;
      }
      if (ver > 10) throw new Error("QR: text too long");
      const [ecLen, b1, d1, b2, d2] = EC_M[ver], dataCap = b1 * d1 + b2 * d2, size = ver * 4 + 17;
      // 1) bit stream
      const bits = [];
      const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
      put(4, 4); put(bytes.length, ver < 10 ? 8 : 16); bytes.forEach((b) => put(b, 8));
      put(0, Math.min(4, dataCap * 8 - bits.length));
      while (bits.length % 8) bits.push(0);
      const data = [];
      for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));
      for (let p = 0; data.length < dataCap; p++) data.push(p % 2 ? 0x11 : 0xec);
      // 2) blocks + error correction, interleaved
      const blocks = [], div = rsDivisor(ecLen);
      let k = 0;
      for (let i = 0; i < b1 + b2; i++) { const n = i < b1 ? d1 : d2; const d = data.slice(k, k + n); k += n; blocks.push({ d, e: rsRemainder(d, div) }); }
      const cw = [];
      for (let i = 0; i < Math.max(d1, d2); i++) blocks.forEach((b) => i < b.d.length && cw.push(b.d[i]));
      for (let i = 0; i < ecLen; i++) blocks.forEach((b) => cw.push(b.e[i]));
      // 3) function patterns
      const M = Array.from({ length: size }, () => new Array(size).fill(false));
      const F = Array.from({ length: size }, () => new Array(size).fill(false));
      const setF = (x, y, dark) => { M[y][x] = dark; F[y][x] = true; };
      for (let i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
      const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy)); if (x >= 0 && y >= 0 && x < size && y < size) setF(x, y, d !== 2 && d !== 4); } };
      finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
      const al = ALIGN[ver], last = al.length - 1;
      al.forEach((ay, i) => al.forEach((ax, j) => {
        if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setF(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }));
      const drawFormat = (mask) => {
        const d = (0 << 3) | mask; // level M = 0b00
        let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
        const b = ((d << 10) | r) ^ 0x5412;
        for (let i = 0; i <= 5; i++) setF(8, i, bit(b, i));
        setF(8, 7, bit(b, 6)); setF(8, 8, bit(b, 7)); setF(7, 8, bit(b, 8));
        for (let i = 9; i < 15; i++) setF(14 - i, 8, bit(b, i));
        for (let i = 0; i < 8; i++) setF(size - 1 - i, 8, bit(b, i));
        for (let i = 8; i < 15; i++) setF(8, size - 15 + i, bit(b, i));
        setF(8, size - 8, true);
      };
      drawFormat(0);
      if (ver >= 7) {
        let r = ver; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
        const b = (ver << 12) | r;
        for (let i = 0; i < 18; i++) { const a = size - 11 + (i % 3), c = Math.floor(i / 3); setF(a, c, bit(b, i)); setF(c, a, bit(b, i)); }
      }
      // 4) data in zig-zag
      let i = 0;
      for (let right = size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5;
        for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
          const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
          if (!F[y][x] && i < cw.length * 8) { M[y][x] = bit(cw[i >>> 3], 7 - (i & 7)); i++; }
        }
      }
      // 5) choose the mask with the lowest penalty
      const MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
        (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
        (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0];
      const applyMask = (m) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!F[y][x] && MASKS[m](x, y)) M[y][x] = !M[y][x]; };
      const penalty = () => {
        let p = 0, dark = 0;
        const line = (get) => { for (let a = 0; a < size; a++) { let run = 1; for (let b = 1; b <= size; b++) { if (b < size && get(a, b) === get(a, b - 1)) run++; else { if (run >= 5) p += run - 2; run = 1; } } } };
        line((a, b) => M[a][b]); line((a, b) => M[b][a]);
        for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const c = M[y][x]; if (c === M[y][x + 1] && c === M[y + 1][x] && c === M[y + 1][x + 1]) p += 3; }
        const pat = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], rev = [...pat].reverse();
        const match = (get, a, b, pt) => pt.every((v, k) => get(a, b + k) === !!v);
        for (let a = 0; a < size; a++) for (let b = 0; b + 11 <= size; b++) {
          const r = (x, y) => M[x][y], c = (x, y) => M[y][x];
          if (match(r, a, b, pat) || match(r, a, b, rev)) p += 40;
          if (match(c, a, b, pat) || match(c, a, b, rev)) p += 40;
        }
        M.forEach((row) => row.forEach((v) => (dark += v ? 1 : 0)));
        p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
        return p;
      };
      let best = 0, bestP = Infinity;
      for (let m = 0; m < 8; m++) { applyMask(m); drawFormat(m); const pv = penalty(); if (pv < bestP) { bestP = pv; best = m; } applyMask(m); }
      applyMask(best); drawFormat(best);
      return M;
    }
    // svg(text, {margin=2 (modules), dark, light, size}) — scalable SVG, crisp edges
    function svg(text, o = {}) {
      const M = matrix(text), n = M.length, m = o.margin ?? 2, full = n + m * 2;
      let d = "";
      M.forEach((row, y) => row.forEach((v, x) => { if (v) d += `M${x + m},${y + m}h1v1h-1z`; }));
      const sz = o.size ? `width="${o.size}" height="${o.size}"` : "";
      return `<svg class="qr" ${sz} viewBox="0 0 ${full} ${full}" shape-rendering="crispEdges" role="img" aria-label="Booking QR code"><rect width="${full}" height="${full}" fill="${o.light || "#F5F4EF"}"/><path d="${d}" fill="${o.dark || "#0A0F0C"}"/></svg>`;
    }
    return { svg, matrix };
  })();

  /* ───────────────────────── 14. TIME DIAL ───────────────────────── */
  /* Dial.mount(el, {valueMin, minMin=30, maxMin=1440, stepMin=30, startMs, onChange(min), label, sub(min)→html, prefix})
     Drag the knob round a 270° arc (or use arrow keys ±step, Home/End). Centre shows the duration
     ("2 h 30 m"); below it "Exit 4:30 pm" when startMs is given, or sub(min) if passed.
     prefix:'+' shows "+1 h" (for Extend). Returns {get(), set(min, silent), update(opts), destroy()} */
  const Dial = {
    mount(el, opts = {}) {
      const o = { minMin: 30, maxMin: 1440, stepMin: 30, valueMin: 120, label: "Parking time", prefix: "", ...opts };
      const R = 100, CX = 120, CY = 120, A0 = 135, SWEEP = 270; // degrees, 0 = 3 o'clock, clockwise
      const pt = (deg, r = R) => { const a = (deg * Math.PI) / 180; return [CX + r * Math.cos(a), CY + r * Math.sin(a)]; };
      const arc = (from, to, r = R) => { const [x1, y1] = pt(from, r), [x2, y2] = pt(to, r); return `M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2.toFixed(2)},${y2.toFixed(2)}`; };
      const steps = () => Math.round((o.maxMin - o.minMin) / o.stepMin);
      const toDeg = (v) => A0 + (SWEEP * (v - o.minMin)) / (o.maxMin - o.minMin || 1);
      const ticks = () => Array.from({ length: steps() + 1 }, (_, i) => {
        const v = o.minMin + i * o.stepMin, major = v % 60 === 0 && (steps() <= 12 || v % 240 === 0 || v === o.maxMin);
        const [x1, y1] = pt(toDeg(v), R - 16), [x2, y2] = pt(toDeg(v), R - (major ? 24 : 20));
        return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="dial-tick${major ? " is-major" : ""}"/>`;
      }).join("");
      el.classList.add("dial");
      el.innerHTML = `<svg viewBox="0 0 240 240" class="dial-svg" aria-hidden="true">
          <path class="dial-track" d="${arc(A0, A0 + SWEEP)}"/>
          <g class="dial-ticks">${ticks()}</g>
          <path class="dial-fill" d=""/>
          <g class="dial-knob"><circle r="15" class="dial-knob-halo"/><circle r="11" class="dial-knob-dot"/></g>
        </svg>
        <div class="dial-center"><div class="dial-label">${esc(o.label)}</div><div class="dial-value"></div><div class="dial-sub"></div></div>
        <div class="dial-hit" role="slider" tabindex="0" aria-label="${esc(o.label)}"></div>`;
      const fill = el.querySelector(".dial-fill"), knob = el.querySelector(".dial-knob"), val = el.querySelector(".dial-value"), sub = el.querySelector(".dial-sub"), hit = el.querySelector(".dial-hit");
      const clamp = (v) => Math.max(o.minMin, Math.min(o.maxMin, Math.round((v - o.minMin) / o.stepMin) * o.stepMin + o.minMin));
      let value = clamp(o.valueMin);
      function paint() {
        const d = toDeg(value), [kx, ky] = pt(d);
        fill.setAttribute("d", value > o.minMin ? arc(A0, d) : `M${pt(A0).join(",")} L${pt(A0 + 0.5).join(",")}`);
        knob.setAttribute("transform", `translate(${kx.toFixed(2)} ${ky.toFixed(2)})`);
        rollNumber(val, o.prefix + durationShort(value));
        sub.innerHTML = o.sub ? o.sub(value) : o.startMs ? `Exit <b>${timeLabel(o.startMs + value * MIN)}</b>${dayLabel(o.startMs + value * MIN) !== dayLabel(o.startMs) ? ` · ${dayLabel(o.startMs + value * MIN)}` : ""}` : "";
        hit.setAttribute("aria-valuemin", o.minMin); hit.setAttribute("aria-valuemax", o.maxMin); hit.setAttribute("aria-valuenow", value);
        hit.setAttribute("aria-valuetext", durationLabel(value / 60));
      }
      function set(v, silent) { const nv = clamp(v); if (nv === value) return; value = nv; paint(); if (!silent && o.onChange) o.onChange(value); }
      // pointer → value (angle along the arc; the gap at the bottom snaps to the nearest end)
      function fromPointer(e) {
        const r = el.querySelector(".dial-svg").getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * 240 - CX, y = ((e.clientY - r.top) / r.height) * 240 - CY;
        let deg = (Math.atan2(y, x) * 180) / Math.PI; if (deg < 0) deg += 360;
        let rel = deg - A0; if (rel < 0) rel += 360;
        if (rel > SWEEP) rel = rel > SWEEP + (360 - SWEEP) / 2 ? 0 : SWEEP;
        // don't wrap from max to min (or back) in one drag
        const prevRel = toDeg(value) - A0;
        if (dragging && Math.abs(rel - prevRel) > 180) rel = prevRel > 135 ? SWEEP : 0;
        set(o.minMin + (rel / SWEEP) * (o.maxMin - o.minMin));
      }
      let dragging = false;
      hit.addEventListener("pointerdown", (e) => { dragging = true; hit.setPointerCapture(e.pointerId); el.classList.add("is-drag"); fromPointer(e); });
      hit.addEventListener("pointermove", (e) => dragging && fromPointer(e));
      const end = () => { dragging = false; el.classList.remove("is-drag"); };
      hit.addEventListener("pointerup", end); hit.addEventListener("pointercancel", end);
      hit.addEventListener("keydown", (e) => {
        const k = e.key, s = o.stepMin;
        const map = { ArrowRight: s, ArrowUp: s, ArrowLeft: -s, ArrowDown: -s, PageUp: s * 4, PageDown: -s * 4 };
        if (k in map) { e.preventDefault(); set(value + map[k]); } else if (k === "Home") { e.preventDefault(); set(o.minMin); } else if (k === "End") { e.preventDefault(); set(o.maxMin); }
      });
      paint();
      return {
        el, get: () => value, set,
        update(p) { Object.assign(o, p); if (p.minMin !== undefined || p.maxMin !== undefined || p.stepMin !== undefined) el.querySelector(".dial-ticks").innerHTML = ticks(); value = clamp(p.valueMin ?? value); paint(); },
        destroy() { el.innerHTML = ""; el.classList.remove("dial"); },
      };
    },
  };

  /* ───────────────────── 15. FACILITY ILLUSTRATIONS ───────────────────── */
  /* Illus.facility(f, scene?, cls?) → SVG string (viewBox 160×110, fills its box via slice).
     scene: 'entrance' | 'bays' | 'inside' (or 0/1/2). Default: garage → inside, driveway → entrance, else bays.
     Ported from the bundle's 3 scenes, recoloured for the dark theme; the facility hue tints each one. */
  const CAR_COLS = ["#D9D6CC", "#6F827B", "#33423B", "#B9483A", "#3D5A80", "#D9B26F", "#8E9893"];
  const carCol = (seed, i) => CAR_COLS[(seed * 7 + i * 3) % CAR_COLS.length];
  // top-down car
  const car = (x, y, w, hgt, col) => `<g><rect x="${x}" y="${y}" width="${w}" height="${hgt}" rx="${w * 0.28}" fill="${col}"/><rect x="${x + w * 0.14}" y="${y + hgt * 0.22}" width="${w * 0.72}" height="${hgt * 0.2}" rx="3" fill="#06090A" opacity=".55"/><rect x="${x + w * 0.14}" y="${y + hgt * 0.62}" width="${w * 0.72}" height="${hgt * 0.14}" rx="3" fill="#06090A" opacity=".45"/></g>`;
  const SCENES = { entrance: 0, bays: 1, inside: 2 };
  let illusN = 0;
  const Illus = {
    scenes: ["entrance", "bays", "inside"],
    defaultScene: (f) => (f.type === "garage" ? "inside" : f.type === "driveway" ? "entrance" : "bays"),
    facility(f, scene, cls = "") {
      const sc = scene === undefined || scene === null ? SCENES[Illus.defaultScene(f)] : typeof scene === "number" ? scene : SCENES[scene];
      const seed = f.id.length + f.capacity, hue = f.hue;
      const tint = `hsl(${hue} 45% 42%)`, tintDim = `hsl(${hue} 30% 18%)`, tintGlow = `hsl(${hue} 60% 60%)`;
      const gid = "ig" + ++illusN;
      let g = "";
      if (sc === 1) { // BAYS: top-down lot at night, our lit bay in lime
        g += `<rect width="160" height="110" fill="#141B17"/><rect width="160" height="110" fill="url(#${gid})"/>`;
        g += `<rect y="50" width="160" height="12" fill="#1B2420"/>`;
        for (let i = 0; i < 8; i++) g += `<rect x="${6 + i * 19}" y="4" width="1.6" height="40" fill="#F5F4EF" opacity=".28"/><rect x="${6 + i * 19}" y="66" width="1.6" height="40" fill="#F5F4EF" opacity=".28"/>`;
        for (let i = 0; i < 7; i++) if (i !== 3) g += car(10 + i * 19, 9, 12, 30, carCol(seed, i));
        for (let i = 0; i < 7; i++) if ((i + seed) % 3 !== 0) g += car(10 + i * 19, 71, 12, 30, carCol(seed, i + 4));
        g += `<rect x="65.5" y="8" width="16" height="33" rx="2" fill="#C6F432" opacity=".16" stroke="#C6F432" stroke-width="1.4"/>`;
        g += `<text x="73.5" y="29" text-anchor="middle" font-size="9" font-weight="700" fill="#C6F432" font-family="JetBrains Mono, monospace">P</text>`;
        if (f.type === "ev") for (let i = 0; i < 7; i++) g += `<rect x="${14 + i * 19}" y="1" width="4" height="5" rx="1" fill="#C6F432"/>`;
        if (f.covered) g += `<rect width="160" height="110" fill="${tint}" opacity=".10"/>`;
        g += `<path d="M8 56h18M40 56h18M72 56h18M104 56h18M136 56h18" stroke="#E9C84A" stroke-width="1.4" opacity=".75"/>`;
        g = `<defs><radialGradient id="${gid}" cx=".46" cy=".3" r=".8"><stop offset="0" stop-color="${tintGlow}" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>` + g;
      } else if (sc === 2) { // INSIDE: garage ramp perspective
        g += `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${tintDim}"/><stop offset="1" stop-color="#0E1411"/></linearGradient></defs>`;
        g += `<rect width="160" height="110" fill="url(#${gid})"/><polygon points="0,110 160,110 112,58 48,58" fill="#161E1A"/>`;
        g += `<rect x="48" y="30" width="64" height="28" fill="#0A0F0C"/><rect x="48" y="30" width="64" height="3" fill="${tint}"/>`;
        for (let side = 0; side < 2; side++) for (let i = 0; i < 3; i++)
          g += `<rect x="${side ? 160 - (14 + i * 22) - 8 : 14 + i * 22}" y="${8 + i * 12}" width="${8 - i * 2}" height="${102 - i * 34}" fill="#26312C"/>`;
        g += `<polygon points="56,110 66,58 70,58 64,110" fill="#F5F4EF" opacity=".22"/><polygon points="104,110 94,58 90,58 96,110" fill="#F5F4EF" opacity=".22"/>`;
        g += car(70, 70, 20, 30, carCol(seed, 2));
        g += `<rect x="62" y="40" width="36" height="10" rx="2" fill="#C6F432"/>`;
        g += `<text x="80" y="47.5" text-anchor="middle" font-size="6.5" font-weight="700" fill="#0F2A1F" font-family="JetBrains Mono, monospace">${esc(f.levels[1] || f.levels[0])} ▸</text>`;
        g += `<circle cx="80" cy="18" r="6" fill="#C6F432" opacity=".85"/><circle cx="80" cy="18" r="14" fill="#C6F432" opacity=".10"/>`;
      } else { // ENTRANCE: street view at dusk
        g += `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${tintDim}"/><stop offset="1" stop-color="#121A15"/></linearGradient></defs>`;
        g += `<rect width="160" height="110" fill="url(#${gid})"/><rect y="78" width="160" height="32" fill="#1B2420"/>`;
        g += `<path d="M0 94h160" stroke="#F5F4EF" stroke-width="1.2" stroke-dasharray="8 8" opacity=".25"/>`;
        if (f.type === "driveway") {
          g += `<rect x="22" y="32" width="70" height="46" fill="#26312C"/><polygon points="16,34 57,12 98,34" fill="${tint}"/>`;
          g += `<rect x="34" y="48" width="14" height="14" fill="#E9C84A" opacity=".75"/><rect x="62" y="52" width="16" height="26" fill="#3A2E25"/>`;
          g += `<rect x="100" y="56" width="52" height="22" fill="none" stroke="#5A6B63" stroke-width="2"/>`;
          for (let i = 0; i < 7; i++) g += `<rect x="${102 + i * 7.5}" y="56" width="1.6" height="22" fill="#5A6B63"/>`;
          g += car(112, 84, 26, 18, carCol(seed, 1));
        } else {
          g += `<rect x="18" y="20" width="124" height="58" fill="#202B26"/>`;
          for (let i = 0; i < 3; i++) g += `<rect x="18" y="${30 + i * 16}" width="124" height="3" fill="${tint}" opacity=".6"/>`;
          g += `<rect x="64" y="50" width="32" height="28" fill="#0A0F0C"/><rect x="64" y="50" width="32" height="28" fill="#C6F432" opacity=".06"/>`;
          g += `<rect x="96" y="70" width="40" height="3" rx="1.5" fill="#FF5A5F"/><rect x="94" y="64" width="6" height="14" fill="#3A4741"/>`;
        }
        g += `<rect x="8" y="10" width="20" height="20" rx="4" fill="#0F2A1F" stroke="rgba(198,244,50,.35)"/>`;
        g += `<text x="18" y="25" text-anchor="middle" font-size="14" font-weight="800" fill="#F5F4EF" font-family="Schibsted Grotesk, sans-serif">P</text>`;
        g += `<circle cx="24.5" cy="25.5" r="1.8" fill="#C6F432"/>`;
      }
      return `<svg class="illus ${cls}" viewBox="0 0 160 110" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Illustration of ${esc(f.name)}">${g}</svg>`;
    },
  };


  /* ring(frac 0..1, {size=160, stroke=10, tone:'lime'|'ok'|'warn'|'danger', html}) → countdown ring SVG + centre html */
  function ring(frac, o = {}) {
    const size = o.size || 160, sw = o.stroke || 10, r = (size - sw) / 2 - 2, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, frac));
    return `<div class="ring ring-${o.tone || "lime"}" style="width:${size}px;height:${size}px"><svg viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${sw}"/><circle class="ring-fill" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${sw}" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - f)).toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg><div class="ring-center">${o.html || ""}</div></div>`;
  }
  // Mirror display prefs onto <html> (larger text, reduce motion) whenever they change.
  function applyPrefs(st = S.state) {
    if (typeof document === "undefined") return;
    const r = document.documentElement;
    if (st.prefs.largeText) r.setAttribute("data-text", "large"); else r.removeAttribute("data-text");
    if (st.prefs.reduceMotion) r.setAttribute("data-motion", "reduce"); else r.removeAttribute("data-motion");
  }
  S.subscribe((st, why, prev) => { if (!prev || st.prefs !== prev.prefs) applyPrefs(st); });
  applyPrefs();

  /* ───────────────────────── EXPORT ───────────────────────── */
  const fmt = { money, time12, timeLabel, dateLabel, dayLabel, windowLabel, durationLabel, durationShort, countdown, ago, kmLabel, dateKey, timeKey, numLabel };
  window.PARKLY = {
    D, S, A, Router, SvgMap, QR, Dial, Illus, fmt,
    // constants
    HOUR, MIN, TIMES, STORE_KEY,
    // time
    now, at, dateKey, timeKey, ceilHalfHour, startOfDay, addDays, defaultWindow,
    // lookups
    facility, destination, defaultVehicle, getBooking, unreadCount, searchCenter,
    // pricing
    money, rateFor, dailyFor, applyPromo, quote, refundPreview, policyPercent, cancelDeadline, overstayFee, paidSoFar,
    // geo
    distKm, walkMin, mapsUrl,
    // availability
    hash, simulatedOccupied, overlapBookings, availability, hourlyAvailability, isOpenAt, hoursLabel, availTone, toneClass,
    // validation & status
    validateBooking, pickVehicle, bookingStatus, isOverstay, statusTone, genRef, genBay, validPlate, normPlate, calendarLinks, downloadFile,
    // search
    searchFacilities, measure, rankResults, sortCompare, activeFilters, matchesType,
    // seed
    buildSeedState,
    // UI helpers
    icon, esc, h, $, $$, logo, plate, occ, stars, badge, statusBadge, bill, amenityIcons, rollNumber, toast,
    openSheet, closeTopSheet, confirmDialog, reducedMotion, runTick, ring, applyPrefs,
  };
})();
