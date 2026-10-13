/* PARKLY · lib/actions.ts
   Every A.* action from the prototype (engine.js §8) as a PURE transform:
     action(state, ...args) → [nextState, result]
   lib/store.tsx wraps these so screens call `actions.createBooking({...})` and get the same
   return values as the prototype ({ok, value} | {ok:false, error}, numbers, labels…).
   Time is always read through engine.now() (test-clock aware). */
import {
  D, HOUR, MIN, now, money, facility, facilityOrThrow, validateBooking, quote, genRef, genBay, uid, dayLabel, timeLabel,
  bookingStatus, refundPreview, paidSoFar, availability, overstayFee, normPlate, PLATE_RE, defaultVehicle, getBooking,
  searchFacilities, buildSeedState, defaultWindow,
} from "./engine";
import type {
  AppState, Booking, BookingMode, CustomPlace, DemoState, Filters, NotificationInput, NotifyPrefs, Prefs, Quote, Search, User, Vehicle,
} from "./data";
import type { Issue, RefundPreview } from "./engine";

export type Ok<T = undefined> = { ok: true; value: T };
export type Fail = { ok: false; error: string; issues?: Issue[] };
export type Result<T = undefined> = Ok<T> | Fail;
const ok = <T,>(value?: T): Ok<T> => ({ ok: true, value: value as T });
const fail = (error: string): Fail => ({ ok: false, error });
const nowIso = () => new Date(now()).toISOString();
type Step<R = void> = [AppState, R];

/** Add a notification to a state object (pure). Newest first, max 60. */
export const withNote = (st: AppState, n: NotificationInput): AppState => ({
  ...st,
  notifications: [{ ...n, id: uid(), at: nowIso(), read: false }, ...st.notifications].slice(0, 60),
});
const payLabel = (method: string) => (D.paymentMethods.find((m) => m.id === method) || { label: method }).label;

/* ── inputs ── */
export interface CreateBookingInput {
  facilityId: string; vehicleId: string; start: number | string; end: number | string; mode?: BookingMode;
  requirements?: string[]; notes?: string; promo?: string; method?: string;
}
export interface ModifyInput { start?: number | string; end?: number | string; mode?: BookingMode; vehicleId?: string; requirements?: string[] }
export interface ModifyPreview { price: Quote; diff: number; vehicle: Vehicle; start: number; end: number; mode: BookingMode; reqs: string[]; issues: Issue[] }
export interface ExtensionQuote { ok: boolean; issues: string[]; newEnd: number; price: Quote; extra: number; free: number }
export interface SearchPatch extends Partial<Omit<Search, "start" | "end">> { start?: number | string; end?: number | string }

/* ── queries (no state change) ── */
/** Price + checks for extending booking id by `min` minutes. */
export function quoteExtension(st: AppState, id: string, min: number): ExtensionQuote {
  const b = getBooking(st, id) as Booking, f = facilityOrThrow(b.facilityId);
  const endMs = new Date(b.end).getTime(), newEnd = endMs + min * MIN, issues: string[] = [];
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
/** Live diff for a modification without saving it. */
export function previewModify(st: AppState, id: string, o: ModifyInput): Result<ModifyPreview> {
  const b = getBooking(st, id);
  if (!b) return fail("Booking not found.");
  const f = facilityOrThrow(b.facilityId);
  const v = st.vehicles.find((x) => x.id === (o.vehicleId || b.vehicleId));
  if (!v) return fail("Choose a vehicle.");
  const start = +new Date(o.start ?? b.start), end = +new Date(o.end ?? b.end), mode = o.mode || b.mode, reqs = o.requirements || b.requirements;
  const check = validateBooking({ facility: f, start, end, mode, vehicle: v, bookings: st.bookings, seed: st.demo.seed, nowMs: now(), excludeId: id });
  if (check.issues.length) return { ok: false, error: check.issues[0].message, issues: check.issues };
  const price = quote({ facility: f, start, end, mode, vehicleType: v.type, evCharging: reqs.includes("EV charging"), promo: b.price.promo });
  return ok({ price, diff: price.total - paidSoFar(b), vehicle: v, start, end, mode, reqs, issues: [] });
}
/** {amount, percent, note, paid} for cancelling now. */
export function refundPreviewFor(st: AppState, id: string): RefundPreview {
  const b = getBooking(st, id) as Booking;
  return refundPreview(b, facilityOrThrow(b.facilityId), now(), bookingStatus(b) === "pending");
}
/** {overMs, fee} for the "I've exited" confirm */
export function exitPreview(st: AppState, id: string) {
  const b = getBooking(st, id) as Booking, over = Math.max(0, now() - new Date(b.end).getTime());
  return { overMs: over, fee: b.arrivedAt ? overstayFee(facilityOrThrow(b.facilityId), b.vehicle.type, over) : 0 };
}

/* ── state transforms ── */
export const A = {
  completeOnboarding: (s: AppState, guest = false): Step => [{ ...s, onboarded: true, user: { ...s.user, guest } }, undefined],
  signOut: (s: AppState): Step => [{ ...s, onboarded: false }, undefined],
  setUser: (s: AppState, u: Partial<User>): Step => [{ ...s, user: { ...s.user, ...u } }, undefined],
  setPrefs: (s: AppState, p: Partial<Prefs>): Step => [{ ...s, prefs: { ...s.prefs, ...p } }, undefined],
  setNotify: (s: AppState, p: Partial<NotifyPrefs>): Step => [{ ...s, prefs: { ...s.prefs, notify: { ...s.prefs.notify, ...p } } }, undefined],
  /** setSearch({start, end, mode, sort, destId…}) — start/end as ISO or ms */
  setSearch: (s: AppState, p: SearchPatch): Step => {
    const q = { ...p } as Partial<Search>;
    if (p.start !== undefined) q.start = new Date(p.start).toISOString();
    if (p.end !== undefined) q.end = new Date(p.end).toISOString();
    return [{ ...s, search: { ...s.search, ...q } }, undefined];
  },
  setFilters: (s: AppState, filters: Filters): Step => [{ ...s, search: { ...s.search, filters } }, undefined],
  resetFilters: (s: AppState): Step => [{ ...s, search: { ...s.search, filters: { ...D.filterDefaults } } }, undefined],
  setDestination: (s: AppState, destId: string): Step => [{ ...s, search: { ...s.search, destId, custom: undefined },
    recentDest: [destId, ...s.recentDest.filter((d) => d !== destId)].slice(0, 6) }, undefined],
  /** {name, lat, lng} */
  setCustomDestination: (s: AppState, c: CustomPlace): Step => [{ ...s, search: { ...s.search, custom: c } }, undefined],
  /** simulated location */
  nearMe: (s: AppState): Step => A.setCustomDestination(s, { name: "Mandi House", lat: 28.6258, lng: 77.2341 }),
  viewed: (s: AppState, fid: string): Step => [s.recentlyViewed[0] === fid ? s : { ...s, recentlyViewed: [fid, ...s.recentlyViewed.filter((x) => x !== fid)].slice(0, 8) }, undefined],
  setSavedPlace: (s: AppState, id: string, destId: string): Step => [{ ...s, savedPlaces: s.savedPlaces.map((p) => (p.id === id ? { ...p, destId } : p)) }, undefined],
  toggleSaved: (s: AppState, fid: string): Step => [{ ...s, savedIds: s.savedIds.includes(fid) ? s.savedIds.filter((x) => x !== fid) : [fid, ...s.savedIds] }, undefined],
  /** max 3 */
  toggleCompare: (s: AppState, fid: string): Step<Result> => {
    if (!s.compareIds.includes(fid) && s.compareIds.length >= 3) return [s, fail("You can compare up to 3 facilities. Remove one first.")];
    return [{ ...s, compareIds: s.compareIds.includes(fid) ? s.compareIds.filter((y) => y !== fid) : [...s.compareIds, fid] }, ok()];
  },
  clearCompare: (s: AppState): Step => [{ ...s, compareIds: [] }, undefined],
  /** upsertVehicle({id?, name, plate, type, color}) → {ok, value: vehicle} | {ok:false, error} */
  upsertVehicle: (s: AppState, v: Omit<Vehicle, "id"> & { id?: string }): Step<Result<Vehicle>> => {
    const plate = normPlate(v.plate);
    if (!String(v.name || "").trim()) return [s, fail("Give the vehicle a name, like “Dad’s Innova”.")];
    if (!PLATE_RE.test(plate)) return [s, fail("Use an Indian registration format, e.g. DL 8C AF 4521.")];
    const veh: Vehicle = { ...v, plate, id: v.id || "v-" + uid().slice(0, 6) };
    return [{ ...s, vehicles: s.vehicles.some((x) => x.id === veh.id) ? s.vehicles.map((x) => (x.id === veh.id ? veh : x)) : [...s.vehicles, veh] }, ok(veh)];
  },
  removeVehicle: (s: AppState, vid: string): Step<Result> => {
    if (s.vehicles.length <= 1) return [s, fail("Keep at least one vehicle on your profile.")];
    if (s.bookings.some((b) => b.vehicleId === vid && ["upcoming", "active", "pending"].includes(bookingStatus(b))))
      return [s, fail("This vehicle has an upcoming or active booking. Cancel or finish it first.")];
    const vs = s.vehicles.filter((v) => v.id !== vid);
    return [{ ...s, vehicles: vs, defaultVehicleId: s.defaultVehicleId === vid ? vs[0].id : s.defaultVehicleId }, ok()];
  },
  setDefaultVehicle: (s: AppState, vid: string): Step => [{ ...s, defaultVehicleId: vid }, undefined],

  /** → {ok:true, value: booking} | {ok:false, error} */
  createBooking: (s: AppState, o: CreateBookingInput): Step<Result<Booking>> => {
    const f = facility(o.facilityId), v = s.vehicles.find((x) => x.id === o.vehicleId);
    if (!f || !v) return [s, fail("That facility or vehicle no longer exists.")];
    const start = +new Date(o.start), end = +new Date(o.end), mode = o.mode || "hourly", reqs = o.requirements || [];
    const check = validateBooking({ facility: f, start, end, mode, vehicle: v, bookings: s.bookings, seed: s.demo.seed, nowMs: now() });
    if (check.issues.length) return [s, fail(check.issues[0].message)];
    const price = quote({ facility: f, start, end, mode, vehicleType: v.type, evCharging: reqs.includes("EV charging"), promo: o.promo });
    const t = nowIso(), ref = genRef(), method = o.method || s.prefs.payment || "upi";
    const b: Booking = {
      id: uid(), ref, facilityId: f.id, vehicleId: v.id, vehicle: { name: v.name, plate: v.plate, type: v.type },
      start: new Date(start).toISOString(), end: new Date(end).toISOString(), mode, notes: o.notes || "", requirements: reqs,
      createdAt: t, confirmedAt: f.instant ? t : new Date(now() + 45000).toISOString(), price,
      payment: { method, txnId: "SIM" + ref.replace(/\W/g, "") + Math.floor(Math.random() * 900 + 100), amount: price.total, paidAt: t, adjustments: [] },
      bay: genBay(f), history: [{ at: t, action: "Booked", detail: `Paid ${money(price.total)} via ${payLabel(method)}` }],
    };
    const next = withNote({ ...s, bookings: [b, ...s.bookings] }, {
      kind: "confirmed", title: f.instant ? "Booking confirmed" : "Booking received", bookingId: b.id,
      body: f.instant ? `${f.name}, ${dayLabel(b.start)} ${timeLabel(b.start)}. Your pass is ready.` : `${f.name} will confirm shortly within a minute.`,
    });
    return [next, ok(b)];
  },
  /** → {ok, value:{diff}} (diff>0 pay more, <0 refund) */
  modifyBooking: (s: AppState, id: string, o: ModifyInput): Step<Result<{ diff: number }>> => {
    const b = getBooking(s, id);
    if (!b) return [s, fail("Booking not found.")];
    const st = bookingStatus(b);
    if (st !== "upcoming" && st !== "pending") return [s, fail("Only upcoming bookings can be modified. Use Extend for an active booking.")];
    const r = previewModify(s, id, o);
    if (!r.ok) return [s, r];
    const { price, diff, vehicle: v, start, end, mode, reqs } = r.value, f = facilityOrThrow(b.facilityId), t = nowIso();
    const nb: Booking = {
      ...b, start: new Date(start).toISOString(), end: new Date(end).toISOString(), mode, vehicleId: v.id,
      vehicle: { name: v.name, plate: v.plate, type: v.type }, requirements: reqs, price,
      payment: diff ? { ...b.payment, adjustments: [...b.payment.adjustments, { at: t, amount: diff, reason: diff > 0 ? "Modification charge" : "Modification refund" }] } : b.payment,
      history: [...b.history, { at: t, action: "Modified", detail: `${dayLabel(start)} ${timeLabel(start)}–${timeLabel(end)} · ${v.plate}${diff ? ` · ${diff > 0 ? "charged" : "refunded"} ${money(Math.abs(diff))}` : ""}` }],
    };
    const next = withNote({ ...s, bookings: s.bookings.map((y) => (y.id === id ? nb : y)) }, {
      kind: "modified", title: "Booking updated", bookingId: id,
      body: `${f.name} is now ${dayLabel(start)} ${timeLabel(start)}–${timeLabel(end)}.${diff ? ` ${diff > 0 ? "Extra charge" : "Refund"} ${money(Math.abs(diff))}.` : ""}`,
    });
    return [next, ok({ diff })];
  },
  /** extendBooking(id, minutes) → {ok, value:{extra}} */
  extendBooking: (s: AppState, id: string, min: number): Step<Result<{ extra: number }>> => {
    const q = quoteExtension(s, id, min);
    if (!q.ok) return [s, fail(q.issues[0])];
    const t = nowIso(), f = facilityOrThrow((getBooking(s, id) as Booking).facilityId);
    const next = withNote({ ...s, bookings: s.bookings.map((b) => (b.id !== id ? b : {
      ...b, end: new Date(q.newEnd).toISOString(), mode: "hourly" as const, price: q.price,
      payment: { ...b.payment, adjustments: [...b.payment.adjustments, { at: t, amount: q.extra, reason: `Extension +${min} min` }] },
      history: [...b.history, { at: t, action: `Extended by ${min} min`, detail: `New exit ${timeLabel(q.newEnd)} · charged ${money(q.extra)}` }],
    })) }, { kind: "extended", title: "Booking extended", bookingId: id, body: `${f.name} now ends at ${timeLabel(q.newEnd)}. Charged ${money(q.extra)}.` });
    return [next, ok({ extra: q.extra })];
  },
  /** → {ok, value:{refund}} */
  cancelBooking: (s: AppState, id: string): Step<Result<{ refund: number }>> => {
    const b = getBooking(s, id);
    if (!b) return [s, fail("Booking not found.")];
    const st = bookingStatus(b);
    if (st !== "upcoming" && st !== "pending") return [s, fail("Only upcoming bookings can be cancelled.")];
    const f = facilityOrThrow(b.facilityId), r = refundPreview(b, f, now(), st === "pending"), t = nowIso();
    const next = withNote({ ...s, bookings: s.bookings.map((y) => (y.id !== id ? y : {
      ...y, cancelledAt: t, refund: { amount: r.amount, percent: r.percent, note: r.note },
      history: [...y.history, { at: t, action: "Cancelled", detail: `Refund ${money(r.amount)}` }],
    })) }, { kind: "cancelled", title: "Booking cancelled", bookingId: id,
      body: `${f.name}. ${r.amount ? `${money(r.amount)} refunded to ${String(b.payment.method).toUpperCase()}.` : "No refund under the cancellation policy."} The space has been released.` });
    return [next, ok({ refund: r.amount })];
  },
  markArrived: (s: AppState, id: string): Step => {
    const t = nowIso();
    return [{ ...s, bookings: s.bookings.map((b) => (b.id !== id ? b : { ...b, arrivedAt: t, history: [...b.history, { at: t, action: "Checked in at entry" }] })) }, undefined];
  },
  /** markExited(id, overstayFeeRupees?) — pass exitPreview(id).fee */
  markExited: (s: AppState, id: string, fee = 0): Step => {
    const t = nowIso();
    return [{ ...s, bookings: s.bookings.map((b) => (b.id !== id ? b : {
      ...b, exitedAt: t,
      payment: fee ? { ...b.payment, adjustments: [...b.payment.adjustments, { at: t, amount: fee, reason: "Overstay charge" }] } : b.payment,
      history: [...b.history, { at: t, action: "Exited facility", detail: fee ? `Overstay charge ${money(fee)}` : undefined }],
    })) }, undefined];
  },
  // Notifications
  notify: (s: AppState, n: NotificationInput): Step => [withNote(s, n), undefined],
  markRead: (s: AppState, nid: string): Step => [{ ...s, notifications: s.notifications.map((n) => (n.id === nid ? { ...n, read: true } : n)) }, undefined],
  markAllRead: (s: AppState): Step => [{ ...s, notifications: s.notifications.map((n) => ({ ...n, read: true })) }, undefined],
  removeNotification: (s: AppState, nid: string): Step => [{ ...s, notifications: s.notifications.filter((n) => n.id !== nid) }, undefined],
  clearNotifications: (s: AppState): Step => [{ ...s, notifications: [] }, undefined],
  // Saved searches
  saveSearch: (s: AppState, label: string, alerts = true): Step => [{ ...s, savedSearches: [{
    id: uid(), label, destId: s.search.destId, custom: s.search.custom, filters: s.search.filters,
    durationH: (new Date(s.search.end).getTime() - new Date(s.search.start).getTime()) / HOUR, alerts, createdAt: nowIso(),
  }, ...s.savedSearches] }, undefined],
  toggleSearchAlert: (s: AppState, sid: string): Step => [{ ...s, savedSearches: s.savedSearches.map((x) => (x.id === sid ? { ...x, alerts: !x.alerts } : x)) }, undefined],
  removeSearch: (s: AppState, sid: string): Step => [{ ...s, savedSearches: s.savedSearches.filter((x) => x.id !== sid) }, undefined],
  /** load a saved search into the current search */
  runSavedSearch: (s: AppState, sid: string): Step => {
    const ss = s.savedSearches.find((x) => x.id === sid);
    if (!ss) return [s, undefined];
    const start = new Date(s.search.start).getTime();
    return [{ ...s, search: { ...s.search, destId: ss.destId, custom: ss.custom, filters: { ...D.filterDefaults, ...ss.filters }, end: new Date(start + ss.durationH * HOUR).toISOString() } }, undefined];
  },
  /** → number of new alert notifications */
  checkAlerts: (s: AppState): Step<number> => {
    let count = 0;
    let d: AppState = { ...s, demo: { ...s.demo, seed: s.demo.seed + 1 } };
    const savedSearches = s.savedSearches.map((ss) => {
      if (!ss.alerts) return ss;
      const search: Search = { ...s.search, destId: ss.destId, custom: ss.custom, filters: { ...D.filterDefaults, ...ss.filters },
        end: new Date(new Date(s.search.start).getTime() + ss.durationH * HOUR).toISOString() };
      const { results } = searchFacilities(s, { search, bookings: s.bookings, seed: d.demo.seed, vehicleType: defaultVehicle(s).type });
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
    return [{ ...d, savedSearches }, count];
  },
  refreshAvailability: (s: AppState): Step => {
    const d = { ...s, demo: { ...s.demo, seed: s.demo.seed + 1 } };
    if (!s.prefs.notify.availability) return [d, undefined];
    const f = facilityOrThrow(s.savedIds[0] || "cp-palika");
    return [withNote(d, { kind: "availability", facilityId: f.id, title: `Availability updated: ${f.name}`, body: "Live counts refreshed. Check your saved spots for changes." }), undefined];
  },
  setDemo: (s: AppState, p: Partial<DemoState>): Step => [{ ...s, demo: { ...s.demo, ...p } }, undefined],
};

/** 15-second tick: "Starts soon" (within 1 h of entry) and "ends in 15 minutes" notifications. Returns s itself when nothing changed. */
export function runTick(s: AppState): AppState {
  const t = now();
  let d = s;
  for (const b of s.bookings) {
    const st = bookingStatus(b, t), f = facility(b.facilityId);
    if (!f) continue;
    const has = (kind: string, txt?: string) => d.notifications.some((n) => n.kind === kind && n.bookingId === b.id && (!txt || n.body.includes(txt)));
    if (s.prefs.notify.reminders && st === "upcoming" && new Date(b.start).getTime() - t < HOUR && !has("reminder", timeLabel(b.start)))
      d = withNote(d, { kind: "reminder", title: `Starts soon: ${f.name}`, body: `Entry at ${timeLabel(b.start)} · ${b.bay}. Tap “I'm arriving” when you're close.`, bookingId: b.id });
    const endMs = new Date(b.end).getTime();
    if (st === "active" && endMs - t < 15 * MIN && endMs > t && !has("ending", timeLabel(b.end)))
      d = withNote(d, { kind: "ending", title: "Your booking ends in 15 minutes", body: `${f.name} until ${timeLabel(b.end)}. Extend now to avoid overstay charges.`, bookingId: b.id });
  }
  return d;
}

/** Load persisted state (or a fresh seed). Browser only. Also restores the test-clock offset via the callback. */
export function loadState(storeKey: string, version: number, restoreClock: (min: number) => void): AppState {
  const fresh = buildSeedState(Date.now());
  try {
    const raw = localStorage.getItem(storeKey);
    if (!raw) return fresh;
    const s = JSON.parse(raw) as AppState;
    if (s.version !== version) return fresh;
    const st: AppState = { ...fresh, ...s, prefs: { ...fresh.prefs, ...s.prefs }, demo: { ...fresh.demo, ...s.demo } };
    restoreClock(st.demo.clockOffsetMin);
    if (new Date(st.search.start).getTime() < now() - 5 * MIN) st.search = { ...st.search, ...defaultWindow(now()) }; // stale window
    return st;
  } catch { return fresh; }
}
