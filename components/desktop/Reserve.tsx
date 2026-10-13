"use client";
/* 4. RESERVE (prototype Views.reserve): 2-col — steps (1 When: day strip + Enter after + dial / days stepper,
   2 Vehicle radio cards + add vehicle, 3 Requests + note) / sticky summary (availability, live issues, rolling bill, Continue).
   5. CHECKOUT (prototype Views.checkout): 2-col — review + promo + payment / sticky bill + Pay → processing (1.4 s)
   → confirmation, or the payment-failed modal when the next payment is set to fail (retry / change method). */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/lib/store";
import {
  D, HOUR, MIN, TIMES, applyPromo, at, ceilHalfHour, dateKey, dayLabel, defaultVehicle, durationLabel, durationShort, facility as getFacility,
  hoursLabel, money, now as engNow, pickVehicle, quote, rateFor, startOfDay, time12, timeKey, timeLabel, validateBooking,
} from "@/lib/engine";
import type { BookingMode, Facility, PaymentMethodId } from "@/lib/data";
import Icon from "@/components/shared/Icon";
import Badge from "@/components/shared/Badge";
import Bill from "@/components/shared/Bill";
import Plate from "@/components/shared/Plate";
import Dial from "@/components/shared/Dial";
import OccupancyBar from "@/components/shared/OccupancyBar";
import FacilityIllustration from "@/components/shared/FacilityIllustration";
import { Modal } from "@/components/shared/Overlay";
import { useToast } from "@/components/shared/ToastProvider";
import DesktopShell, { useModal, useTitle } from "./DesktopShell";
import { EmptyState, Topbar, VehicleModal, clamp, i18day, nextDays, plural, win } from "./common";

export interface Draft { fid: string; start: number; dur: number; days: number; mode: BookingMode; vehicleId: string; reqs: string[]; notes: string }
let draft: Draft | null = null; // kept across Reserve ↔ Checkout ↔ Edit, like the prototype
export const resetDraft = () => { draft = null; };
export const draftEnd = (d: Draft) => (d.mode === "daily" ? d.start + d.days * 24 * HOUR : d.start + d.dur * MIN);
/** Query string for /checkout (same keys as the mobile prototype: s, e, m, v, req, note). */
export const draftQuery = (d: Draft) => new URLSearchParams({ s: String(d.start), e: String(draftEnd(d)), m: d.mode, v: d.vehicleId, req: d.reqs.join("|"), note: d.notes }).toString();
export function draftFromQuery(fid: string, q: URLSearchParams, fallbackVehicle: string): Draft | null {
  const s = q.get("s") || q.get("start"), e = q.get("e") || q.get("end");
  if (!s || !e) return null;
  const start = +s, end = +e;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const req = q.get("req");
  return { fid, start, dur: Math.round((end - start) / MIN), days: Math.max(1, Math.round((end - start) / (24 * HOUR))), mode: ((q.get("m") || q.get("mode")) as BookingMode) || "hourly",
    vehicleId: q.get("v") || fallbackVehicle, reqs: req ? req.split("|") : [], notes: q.get("note") || "" };
}

/* ───────── RESERVE ───────── */
function ReserveForm({ f }: { f: Facility }) {
  const { state, actions } = useApp();
  const router = useRouter();
  const openModal = useModal();
  const q = useSearchParams();
  const [d, setD] = useState<Draft>(() => {
    if (!draft || draft.fid !== f.id || q.get("fresh")) {
      const w = win(state), mode: BookingMode = state.search.mode === "daily" && f.dailyRate ? "daily" : "hourly";
      draft = draftFromQuery(f.id, q, defaultVehicle(state).id) || {
        fid: f.id, start: w.s, dur: clamp(Math.round((w.e - w.s) / MIN), 30, 1440), days: Math.max(1, Math.ceil((w.e - w.s) / (24 * HOUR))), mode,
        vehicleId: pickVehicle(state, f, w.s, w.e, mode).id, reqs: [], notes: "",
      };
    }
    return draft;
  });
  const upd = (p: Partial<Draft>) => setD((x) => { const n = { ...x, ...p }; draft = n; return n; });
  const days = useMemo(() => nextDays(), []);
  // start times for the chosen day (today: from the next half hour; non-24h lots: opening hours only)
  const day = startOfDay(d.start), today = day === startOfDay(engNow());
  let ts = TIMES.filter((t) => !today || at(dateKey(day), t).getTime() >= ceilHalfHour(engNow()));
  if (!f.is24h) ts = ts.filter((t) => t >= f.open && t < f.close);
  if (!ts.length) ts = [timeKey(d.start)];
  const tk = ts.includes(timeKey(d.start)) ? timeKey(d.start) : ts[0];
  useEffect(() => { if (tk !== timeKey(d.start)) upd({ start: at(dateKey(day), tk).getTime() }); }, [tk]); // eslint-disable-line react-hooks/exhaustive-deps

  const v = state.vehicles.find((x) => x.id === d.vehicleId) || defaultVehicle(state), end = draftEnd(d);
  const chk = validateBooking({ facility: f, start: d.start, end, mode: d.mode, vehicle: v, bookings: state.bookings, seed: state.demo.seed });
  const qt = quote({ facility: f, start: d.start, end, mode: d.mode, vehicleType: v.type, evCharging: d.reqs.includes("EV charging") });
  const blocked = chk.issues.length > 0;
  const toggleReq = (x: string) => upd({ reqs: d.reqs.includes(x) ? d.reqs.filter((y) => y !== x) : [...d.reqs, x] });
  const go = () => { actions.setSearch({ start: d.start, end, mode: d.mode }); router.push(`/checkout/${f.id}?${draftQuery(d)}`); };

  return (
    <div className="page"><div className="two-col">
      <div>
        <section className="card stepcard rv">
          <div className="stephead"><span className="n">1</span><h2>When</h2><span className="grow" />
            {f.dailyRate ? <div className="seg"><button type="button" className={d.mode === "hourly" ? "is-on" : ""} onClick={() => upd({ mode: "hourly" })}>By the hour</button><button type="button" className={d.mode === "daily" ? "is-on" : ""} onClick={() => upd({ mode: "daily" })}>By the day</button></div> : null}</div>
          <div className="when-grid">
            <div className="stack-16">
              <div><div className="lbl mb-8">Day</div>
                <div className="datestrip">{days.map((x) => <button type="button" key={x} className={x === day ? "is-on" : ""} onClick={() => upd({ start: at(dateKey(x), timeKey(d.start)).getTime() })}><small>{i18day(x)}</small><b>{new Date(x).getDate()}</b></button>)}</div></div>
              <div className="field"><label className="lbl" htmlFor="r-tk">Enter after</label>
                <select className="select" id="r-tk" value={tk} onChange={(e) => upd({ start: at(dateKey(d.start), e.target.value).getTime() })}>{ts.map((t) => <option key={t} value={t}>{time12(t)}</option>)}</select></div>
              {d.mode === "daily" && (
                <div><div className="lbl mb-8">Number of days</div>
                  <div className="stepper"><button type="button" aria-label="One day less" onClick={() => upd({ days: clamp(d.days - 1, 1, 7) })}><Icon name="minus" size={16} /></button><output>{d.days}</output><button type="button" aria-label="One day more" onClick={() => upd({ days: clamp(d.days + 1, 1, 7) })}><Icon name="plus" size={16} /></button></div></div>
              )}
              <div className="notice notice-info"><Icon name="clock" size={16} /><span>Enter after <b className="mono">{dayLabel(d.start)} {timeLabel(d.start)}</b> · exit before <b className="mono">{dayLabel(end) !== dayLabel(d.start) ? dayLabel(end) + " " : ""}{timeLabel(end)}</b> · {d.mode === "daily" ? plural(d.days, "day") : durationShort(d.dur)}</span></div>
            </div>
            <div style={d.mode === "daily" ? { opacity: 0.35, pointerEvents: "none" } : undefined}>
              <Dial value={clamp(d.dur, 30, 1440)} onChange={(x) => upd({ dur: x })} minMin={30} maxMin={1440} stepMin={30} startMs={d.start} />
              <p className="tiny muted center mt-8">{d.mode === "daily" ? "Daily booking: pick the number of days" : "Drag to set how long you'll stay"}</p>
            </div>
          </div>
        </section>
        <section className="card stepcard rv" style={{ ["--d" as string]: 1 }}>
          <div className="stephead"><span className="n">2</span><h2>Vehicle</h2><span className="grow" />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => openModal(({ open, close }) => <VehicleModal open={open} close={close} onSaved={(nv) => upd({ vehicleId: nv.id })} />)}><Icon name="plus" size={16} />Add vehicle</button></div>
          <div className="vgrid">{state.vehicles.map((x) => {
            const ok = f.vehicleTypes.includes(x.type);
            return (
              <label key={x.id} className={`opt${ok ? "" : " is-disabled"}`}>
                <input type="radio" name="veh" value={x.id} checked={x.id === d.vehicleId} disabled={!ok} onChange={() => upd({ vehicleId: x.id })} /><span className="opt-mark" />
                <span className="grow"><b>{x.name}</b><span className="row gap-8 mt-4"><Plate plate={x.plate} size="sm" /><span className="tiny muted">{D.vehicleLabels[x.type]}</span></span>
                  {!ok && <span className="mt-8" style={{ display: "block" }}><Badge tone="danger">{x.type === "suv" && f.heightLimit ? `Not allowed · ${f.heightLimit} m limit` : "Not allowed here"}</Badge></span>}</span>
                <span className="mono small">{money(rateFor(f, x.type))}/h</span>
              </label>
            );
          })}</div>
        </section>
        <section className="card stepcard rv" style={{ ["--d" as string]: 2 }}>
          <div className="stephead"><span className="n">3</span><h2>Anything you need?</h2><span className="tiny muted">Optional</span></div>
          <div className="chip-row">{D.requirements.filter((x) => x !== "EV charging" || f.ev).map((x) => (
            <button type="button" key={x} className={`chip${d.reqs.includes(x) ? " is-on" : ""}`} onClick={() => toggleReq(x)}>{x === "EV charging" ? <><Icon name="zap" size={15} />EV charging +{money(D.pricing.evReserve)}</> : x}</button>
          ))}</div>
          <div className="field mt-16"><label className="field-label" htmlFor="r-note">Note for the attendant</label>
            <textarea className="textarea" id="r-note" maxLength={160} placeholder="e.g. I'll arrive a little late, please hold the bay" value={d.notes} onChange={(e) => upd({ notes: e.target.value })} />
            <span className="field-hint right">{d.notes.length}/160</span></div>
        </section>
      </div>
      <div className="sticky-col"><div className="card sumcard stack-16">
        <div className="sum-fac" style={{ marginBottom: 0 }}><div className="thumb"><FacilityIllustration facility={f} /></div><div style={{ minWidth: 0 }}><b className="ellipsis" style={{ display: "block" }}>{f.name}</b><span className="small muted">{f.area} · {hoursLabel(f)}</span></div></div>
        <OccupancyBar free={chk.free} capacity={f.capacity} />
        {blocked && <div className="issues">{chk.issues.map((i) => <div key={i.message} className={`notice notice-${i.field === "availability" ? "danger" : "warn"}`}><Icon name="triangle-alert" size={16} /><span>{i.message}</span></div>)}</div>}
        <Bill quote={qt} totalLabel="Total to pay" />
        <button type="button" className="btn btn-primary btn-lg btn-block is-mag" disabled={blocked} onClick={go}>{blocked ? "Fix the issue above to continue" : <>Continue · {money(qt.total)} <Icon name="arrow-right" size={18} /></>}</button>
        <p className="tiny muted center">{"You won't be charged yet. You'll review everything first."}</p>
      </div></div>
    </div></div>
  );
}

function ReserveView() {
  useTitle("Reserve · PARKLY");
  const { id } = useParams<{ id: string }>();
  const f = getFacility(id);
  if (!f) return (<><Topbar back title="Not found" /><div className="page"><EmptyState ico="search-x" title="We can't find this parking" action={<Link className="btn btn-primary btn-md" href="/explore">Back to search</Link>}>Search again to pick a place.</EmptyState></div></>);
  return (<><Topbar back title="Reserve a spot" sub={f.name} noSearch /><ReserveForm f={f} key={f.id} /></>);
}
export function Reserve() { return <DesktopShell><ReserveView /></DesktopShell>; }

/* ───────── CHECKOUT ───────── */
const co = { promo: "", promoOk: false, promoMsg: null as null | { ok: boolean; message: string }, method: null as PaymentMethodId | null };

function PayFailedModal({ open, close, onRetry, onChange }: { open: boolean; close: () => void; onRetry: () => void; onChange: () => void }) {
  return (
    <Modal open={open} onClose={close} title="Payment didn't go through" size="sm"
      footer={<><button type="button" className="btn btn-secondary btn-md" onClick={() => { close(); onChange(); }}>Change method</button><button type="button" className="btn btn-primary btn-md" onClick={() => { close(); onRetry(); }}>Try again</button></>}>
      <div className="center"><div className="fail-ico"><Icon name="circle-x" size={32} /></div><p className="ink-2">Your bank declined the payment. No money was taken. Try again, or pay another way.</p></div>
    </Modal>
  );
}

function CheckoutForm({ f, d }: { f: Facility; d: Draft }) {
  const { state, actions } = useApp();
  const router = useRouter();
  const toast = useToast();
  const openModal = useModal();
  const methodsRef = useRef<HTMLDivElement>(null);
  const [promo, setPromo] = useState(co.promo);
  const [msg, setMsg] = useState(co.promoMsg);
  const [method, setMethod] = useState<PaymentMethodId>(co.method || state.prefs.payment || "upi");
  const [busy, setBusy] = useState(false);
  const v = state.vehicles.find((x) => x.id === d.vehicleId) || defaultVehicle(state), end = draftEnd(d), pol = D.policies[f.policy];
  const promoCode = msg && msg.ok ? promo : undefined;
  const qq = quote({ facility: f, start: d.start, end, mode: d.mode, vehicleType: v.type, evCharging: d.reqs.includes("EV charging"), promo: promoCode });
  const apply = (code: string) => {
    const c = code.trim().toUpperCase();
    const base = quote({ facility: f, start: d.start, end, mode: d.mode, vehicleType: v.type }).subtotal;
    const r = applyPromo(c, base, d.start);
    setPromo(c); setMsg(r); co.promo = c; co.promoMsg = r;
  };
  useEffect(() => { if (co.promo) apply(co.promo); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (m: PaymentMethodId) => { setMethod(m); co.method = m; };
  const methods = D.paymentMethods.map((m) => ({ ...m, low: m.balance !== undefined && m.balance < qq.total }));
  const useMethod = methods.find((m) => m.id === method && !m.low) ? method : (methods.find((m) => !m.low)?.id || "upi");

  const pay = () => {
    setBusy(true);
    window.setTimeout(() => {
      setBusy(false);
      if (state.demo.nextPaymentFails) {
        actions.setDemo({ nextPaymentFails: false });
        openModal(({ open, close }) => <PayFailedModal open={open} close={close} onRetry={pay} onChange={() => methodsRef.current?.scrollIntoView({ block: "center", behavior: "smooth" })} />);
        return;
      }
      const r = actions.createBooking({ facilityId: f.id, vehicleId: d.vehicleId, start: d.start, end, mode: d.mode, requirements: d.reqs, notes: d.notes, promo: promoCode, method: useMethod });
      if (!r.ok) { toast(r.error, "danger"); return; }
      co.promo = ""; co.promoMsg = null; resetDraft();
      router.push("/confirmation/" + r.value.id);
    }, 1400);
  };

  return (
    <div className="page"><div className="two-col">
      <div>
        <section className="card stepcard rv">
          <div className="stephead"><span className="n"><Icon name="check" size={16} /></span><h2>Check your booking</h2><span className="grow" />
            <Link className="btn btn-ghost btn-sm" href={`/reserve/${f.id}?${draftQuery(d)}`} onClick={() => { draft = d; }}><Icon name="pencil" size={15} />Edit</Link></div>
          <div className="sum-fac"><div className="thumb"><FacilityIllustration facility={f} /></div><div><b>{f.name}</b><div className="small muted">{f.address}</div></div></div>
          <div className="kv-grid">
            <div><div className="k">Enter after</div><div className="v mono">{dayLabel(d.start)}, {timeLabel(d.start)}</div></div>
            <div><div className="k">Exit before</div><div className="v mono">{dayLabel(end)}, {timeLabel(end)}</div></div>
            <div><div className="k">How long</div><div className="v mono">{d.mode === "daily" ? plural(d.days, "day") : durationLabel(d.dur / 60)}</div></div>
            <div><div className="k">Vehicle</div><div className="v row gap-8"><Plate plate={v.plate} size="sm" /><span className="small">{v.name}</span></div></div>
            <div><div className="k">Requests</div><div className="v small">{d.reqs.length ? d.reqs.join(", ") : "None"}</div></div>
            <div><div className="k">Note</div><div className="v small">{d.notes || "None"}</div></div>
          </div>
          <div className="notice notice-info mt-16"><Icon name="rotate-ccw" size={16} /><span><b>{pol.title} cancellation.</b> {pol.rules.join(". ")}.</span></div>
        </section>
        <section className="card stepcard rv" style={{ ["--d" as string]: 1 }}>
          <div className="stephead"><span className="n"><Icon name="tag" size={15} /></span><h2>Promo code</h2></div>
          <div className="promo-row">
            <input className={`input${msg ? (msg.ok ? " is-valid" : " is-invalid") : ""}`} placeholder="e.g. PARK10" value={promo} aria-label="Promo code"
              onChange={(e) => setPromo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") apply(promo); }} />
            <button type="button" className="btn btn-secondary btn-md" onClick={() => apply(promo)}>Apply</button>
          </div>
          <div className="mt-8">{msg && <div className={`small row gap-6 ${msg.ok ? "t-ok" : "t-danger"}`}><Icon name={msg.ok ? "circle-check" : "circle-x"} size={14} />{msg.message}</div>}</div>
          <div className="chip-row mt-12">{Object.entries(D.promos).map(([k, p]) => <button type="button" key={k} className="chip chip-sm" title={p.describe} onClick={() => apply(k)}>{k} · {p.label}</button>)}</div>
        </section>
        <section className="card stepcard rv" style={{ ["--d" as string]: 2 }}>
          <div className="stephead"><span className="n"><Icon name="wallet" size={15} /></span><h2>Pay with</h2></div>
          <div className="stack-8" ref={methodsRef}>{methods.map((m) => (
            <label key={m.id} className={`opt${m.low ? " is-disabled" : ""}`}>
              <input type="radio" name="pm" value={m.id} checked={useMethod === m.id} disabled={m.low} onChange={() => pick(m.id)} /><span className="opt-mark" />
              <span className="icon-tile"><Icon name={m.id === "upi" ? "smartphone" : m.id === "card" ? "credit-card" : "wallet"} size={18} /></span>
              <span className="grow"><b>{m.label}</b><br /><span className="small muted mono">{m.detail}</span></span>
              {m.low ? <Badge tone="warn">Not enough balance</Badge> : m.id === state.prefs.payment ? <Badge>Default</Badge> : null}
            </label>
          ))}</div>
        </section>
      </div>
      <div className="sticky-col"><div className="card sumcard stack-16">
        <div className="row-between"><span className="lbl">Your bill</span><span className="small muted">{D.vehicleLabels[v.type]}</span></div>
        <Bill quote={qq} totalLabel="Total to pay" />
        <button type="button" className="btn btn-primary btn-lg btn-block paybtn is-mag" onClick={pay} disabled={busy}><Icon name="lock" size={18} />Pay {money(qq.total)} and reserve</button>
        <p className="tiny muted center row gap-6" style={{ justifyContent: "center" }}><Icon name="lock" size={13} />Secure payment · simulated in this prototype</p>
      </div></div>
      {busy && (
        <div className="processing" role="alertdialog" aria-label="Processing payment"><div className="spinner" /><div className="h2">Paying {money(qq.total)}</div>
          <p className="muted small">Confirming with {(D.paymentMethods.find((m) => m.id === useMethod) || { label: "UPI" }).label}. {"Don't close this page."}</p></div>
      )}
    </div></div>
  );
}

function CheckoutView() {
  useTitle("Checkout · PARKLY");
  const { id } = useParams<{ id: string }>();
  const q = useSearchParams();
  const { state } = useApp();
  const f = getFacility(id);
  const d = f ? draftFromQuery(f.id, q, defaultVehicle(state).id) : null;
  if (!f || !d) return (<><Topbar back title="Checkout" /><div className="page"><EmptyState ico="receipt" title="Nothing to pay for yet" action={<Link className="btn btn-primary btn-md" href="/explore">Find parking</Link>}>{"Pick a place and a time first. Then you'll see the full price here."}</EmptyState></div></>);
  return (<><Topbar back title="Review and pay" sub={f.name} noSearch /><CheckoutForm f={f} d={d} key={q.toString()} /></>);
}
export function Checkout() { return <DesktopShell><CheckoutView /></DesktopShell>; }
