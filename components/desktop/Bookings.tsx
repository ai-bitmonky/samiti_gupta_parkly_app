"use client";
/* 7. BOOKINGS master-detail + ARRIVE (prototype Views.bookings): tabs with counts, booking cards on the left;
   right = booking detail (hero with countdown ring / starts-in / overstay fee, cancel-deadline countdown, actions grid,
   details, activity) or the Arrive view. /bookings auto-opens the first booking of the tab (active first).
   Modals: pass, extend (dial +30…+180), modify (live diff), cancel (refund + deadline countdown), exit confirm,
   add to calendar, payment summary. Countdowns tick every second (only the digits change). */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useApp, useNow } from "@/lib/store";
import {
  D, HOUR, MIN, TIMES, at, availability, bookingStatus, cancelDeadline, countdown, dateKey, dayLabel, durationLabel, durationShort,
  facilityOrThrow, isOverstay, mapsUrl, measure, money, paidSoFar, startOfDay, time12, timeKey, timeLabel, windowLabel,
} from "@/lib/engine";
import type { Booking, BookingStatus } from "@/lib/data";
import Icon from "@/components/shared/Icon";
import Badge, { StatusBadge } from "@/components/shared/Badge";
import Bill from "@/components/shared/Bill";
import Plate from "@/components/shared/Plate";
import Ring from "@/components/shared/Ring";
import Dial from "@/components/shared/Dial";
import SvgMap from "@/components/shared/SvgMap";
import FacilityIllustration from "@/components/shared/FacilityIllustration";
import { Modal } from "@/components/shared/Overlay";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/Confirm";
import DesktopShell, { useModal, useTitle } from "./DesktopShell";
import { CalendarModal, EmptyState, PassModal, Rup, Topbar, i18day, methodLabel, nearestDest, nextDays, plural } from "./common";
import { resetDraft } from "./Reserve";

type Tab = "upcoming" | "active" | "completed" | "cancelled";
const TABS: [Tab, string][] = [["upcoming", "Upcoming"], ["active", "Active"], ["completed", "Completed"], ["cancelled", "Cancelled"]];
const tabOf = (b: Booking, t: number): Tab => { const x: BookingStatus = bookingStatus(b, t); return x === "pending" ? "upcoming" : x; };
const bk = { tab: null as Tab | null };
const ms = (x: string) => +new Date(x);

/* ── modals ── */
function ExtendModal({ open, close, id }: { open: boolean; close: () => void; id: string }) {
  const { state, actions } = useApp();
  const toast = useToast();
  const [min, setMin] = useState(60);
  const b = state.bookings.find((x) => x.id === id);
  if (!b) return null;
  const q = actions.quoteExtension(b.id, min);
  const ok = () => { const r = actions.extendBooking(b.id, min); if (!r.ok) { toast(r.error, "danger"); return; } close(); toast(`Extended. ${money(r.value.extra)} charged.`, "ok"); };
  return (
    <Modal open={open} onClose={close} title="Extend your time" size="lg"
      footer={<><button type="button" className="btn btn-ghost btn-md" data-close>Not now</button><button type="button" className="btn btn-primary btn-md" disabled={!q.ok} onClick={ok}>{q.ok ? `Pay ${money(q.extra)} and extend` : "Can't extend by this much"}</button></>}>
      <div className="when-grid" style={{ gridTemplateColumns: "260px minmax(0,1fr)" }}>
        <div><Dial value={min} onChange={setMin} minMin={30} maxMin={180} stepMin={30} prefix="+" label="Add time" sub={(v) => <>New exit <b>{timeLabel(ms(b.end) + v * MIN)}</b></>} /></div>
        <div className="stack-16">
          <div className="kv-grid">
            <div><div className="k">Now ends</div><div className="v mono">{timeLabel(b.end)}</div></div>
            <div><div className="k">New exit</div><div className="v mono lime">{timeLabel(q.newEnd)}</div></div>
            <div><div className="k">Space after your time</div><div className="v">{q.free > 0 ? <span className="t-ok">{q.free} free</span> : <span className="t-danger">None</span>}</div></div>
            <div><div className="k">Extra to pay</div><div className="v num" style={{ fontSize: 24 }}>{money(q.extra)}</div></div>
          </div>
          {q.issues.length ? q.issues.map((i) => <div key={i} className="notice notice-danger"><Icon name="triangle-alert" size={16} /><span>{i}</span></div>)
            : <div className="notice notice-ok"><Icon name="circle-check" size={16} /><span>Your bay is free until {timeLabel(q.newEnd)}. Charged to {methodLabel(b.payment.method)}.</span></div>}
          <div className="chip-row">{[30, 60, 120, 180].map((x) => <button type="button" key={x} className={`chip chip-sm${x === min ? " is-on" : ""}`} onClick={() => setMin(x)}>+{durationShort(x)}</button>)}</div>
        </div>
      </div>
    </Modal>
  );
}

function CancelModal({ open, close, id }: { open: boolean; close: () => void; id: string }) {
  const { state, actions } = useApp();
  const toast = useToast();
  const t = useNow(1000);
  const b = state.bookings.find((x) => x.id === id);
  const [r] = useState(() => (b ? actions.refundPreview(b.id) : null));
  if (!b || !r) return null;
  const f = facilityOrThrow(b.facilityId), dl = cancelDeadline(b, f, t), pol = D.policies[f.policy];
  const ok = () => { const x = actions.cancelBooking(b.id); close(); if (!x.ok) toast(x.error, "danger"); else toast(x.value.refund ? `Cancelled. ${money(x.value.refund)} is on its way back.` : "Cancelled. No refund under the policy.", "ok"); };
  return (
    <Modal open={open} onClose={close} title="Cancel this booking?" size="sm"
      footer={<><button type="button" className="btn btn-secondary btn-md" data-close>Keep booking</button><button type="button" className="btn btn-danger btn-md" onClick={ok}>Cancel and refund {money(r.amount)}</button></>}>
      <div className="stack-16">
        <div className="center"><span className="lbl">You get back</span><div className="num" style={{ fontSize: 52, lineHeight: 1.1, marginTop: 6 }}><Rup n={r.amount} /></div><div className="small muted">of {money(r.paid)} paid · {r.percent}% refund</div></div>
        <div className={`notice notice-${r.percent === 100 ? "ok" : r.percent ? "warn" : "danger"}`}><Icon name="info" size={16} /><span>{r.note}</span></div>
        {dl && <div className="card card-raised p-16 row-between"><span className="small">Refund drops to {dl.percentAfter}% in</span><b className="mono" style={{ fontSize: 20 }}>{countdown(dl.at - t)}</b></div>}
        <div><div className="lbl mb-8">{pol.title} policy</div><ul className="small ink-2 stack-4" style={{ paddingLeft: 18 }}>{pol.rules.map((x) => <li key={x}>{x}</li>)}</ul></div>
        <p className="small muted">Your bay at {f.name} will be released for other drivers. {"This can't be undone."}</p>
      </div>
    </Modal>
  );
}

const DURS = [30, 60, 90, 120, 150, 180, 240, 300, 360, 480, 600, 720];
function ModifyModal({ open, close, id }: { open: boolean; close: () => void; id: string }) {
  const { state, actions } = useApp();
  const toast = useToast();
  const b0 = state.bookings.find((x) => x.id === id);
  const s0 = b0 ? ms(b0.start) : 0;
  const [day, setDay] = useState(startOfDay(s0));
  const [tk, setTk] = useState(timeKey(s0));
  const [dur, setDur] = useState(b0 ? Math.round((ms(b0.end) - s0) / MIN) : 120);
  const [vid, setVid] = useState(b0 ? b0.vehicleId : "");
  const days = useMemo(() => nextDays(), []);
  if (!b0) return null;
  const st1 = at(dateKey(day), tk).getTime(), opts = { start: st1, end: st1 + dur * MIN, vehicleId: vid, mode: "hourly" as const };
  const r = actions.previewModify(b0.id, opts);
  const diff = r.ok ? r.value.diff : 0;
  const durs = [...new Set([...DURS, dur])].sort((x, y) => x - y);
  const save = () => { const x = actions.modifyBooking(b0.id, opts); if (!x.ok) { toast(x.error, "danger"); return; } close(); toast("Booking updated", "ok"); };
  return (
    <Modal open={open} onClose={close} title="Change time or car"
      footer={<><button type="button" className="btn btn-ghost btn-md" data-close>Keep as is</button><button type="button" className="btn btn-primary btn-md" disabled={!r.ok} onClick={save}>{!r.ok ? "Save changes" : diff > 0 ? `Pay ${money(diff)} and save` : diff < 0 ? `Save and refund ${money(-diff)}` : "Save changes"}</button></>}>
      <div className="stack-16">
        <div><div className="lbl mb-8">Day</div><div className="datestrip">{days.map((d) => <button type="button" key={d} className={d === day ? "is-on" : ""} onClick={() => setDay(d)}><small>{i18day(d)}</small><b>{new Date(d).getDate()}</b></button>)}</div></div>
        <div className="grid-2">
          <div className="field"><label className="lbl" htmlFor="md-tk">Enter after</label><select className="select" id="md-tk" value={tk} onChange={(e) => setTk(e.target.value)}>{TIMES.map((t) => <option key={t} value={t}>{time12(t)}</option>)}</select></div>
          <div className="field"><label className="lbl" htmlFor="md-dur">How long</label><select className="select" id="md-dur" value={dur} onChange={(e) => setDur(+e.target.value)}>{durs.map((x) => <option key={x} value={x}>{durationLabel(x / 60)}</option>)}</select></div>
        </div>
        <div className="field"><label className="lbl" htmlFor="md-v">Vehicle</label><select className="select" id="md-v" value={vid} onChange={(e) => setVid(e.target.value)}>{state.vehicles.map((v) => <option key={v.id} value={v.id}>{v.name} · {v.plate}</option>)}</select></div>
        {r.ok ? <div className="card card-raised p-16 row-between"><span>{diff > 0 ? "You pay extra" : diff < 0 ? "You get back" : "No change in price"}</span><b className={`num${diff < 0 ? " t-ok" : ""}`} style={{ fontSize: 24 }}>{diff ? money(Math.abs(diff)) : "₹0"}</b></div>
          : <div className="notice notice-danger"><Icon name="triangle-alert" size={16} /><span>{r.error}</span></div>}
      </div>
    </Modal>
  );
}

function PaymentModal({ open, close, id }: { open: boolean; close: () => void; id: string }) {
  const { state } = useApp();
  const b = state.bookings.find((x) => x.id === id);
  if (!b) return null;
  return (
    <Modal open={open} onClose={close} title="Payment summary" size="sm">
      <div className="stack-16">
        <Bill quote={b.price} totalLabel="Booking total" />
        {b.payment.adjustments.length > 0 && <div><div className="lbl mb-8">Changes since booking</div><dl className="kv">{b.payment.adjustments.map((a, i) => <div key={i}><dt>{a.reason}</dt><dd className={`mono${a.amount < 0 ? " t-ok" : ""}`}>{a.amount < 0 ? "− " + money(-a.amount) : money(a.amount)}</dd></div>)}</dl></div>}
        <div className="card card-raised p-16 row-between"><span>Paid in total</span><b className="num" style={{ fontSize: 22 }}>{money(paidSoFar(b))}</b></div>
        <p className="tiny muted mono">{methodLabel(b.payment.method)} · Txn {b.payment.txnId}</p>
      </div>
    </Modal>
  );
}

/* ── actions shared by hero, actions grid and arrive ── */
function useBookingActions(b: Booking) {
  const { actions } = useApp();
  const openModal = useModal();
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();
  const f = facilityOrThrow(b.facilityId);
  return {
    pass: () => openModal(({ open, close }) => <PassModal open={open} close={close} id={b.id} />),
    extend: () => openModal(({ open, close }) => <ExtendModal open={open} close={close} id={b.id} />),
    cancel: () => openModal(({ open, close }) => <CancelModal open={open} close={close} id={b.id} />),
    modify: () => openModal(({ open, close }) => <ModifyModal open={open} close={close} id={b.id} />),
    calendar: () => openModal(({ open, close }) => <CalendarModal open={open} close={close} booking={b} facility={f} />),
    payment: () => openModal(({ open, close }) => <PaymentModal open={open} close={close} id={b.id} />),
    again: () => { resetDraft(); router.push("/parking/" + f.id); },
    checkin: () => { actions.markArrived(b.id); toast("Checked in. The barrier lifts for you.", "ok"); },
    exit: async () => {
      const x = actions.exitPreview(b.id);
      const yes = await confirm({ title: "Have you left the facility?", tone: x.fee ? "danger" : "primary", confirm: x.fee ? `Confirm exit · pay ${money(x.fee)}` : "Yes, I've exited", cancel: "Not yet",
        body: x.fee ? <p>You stayed <b className="mono">{countdown(x.overMs)}</b> past your exit time. An overstay charge of <b className="mono">{money(x.fee)}</b> will be taken from {methodLabel(b.payment.method)}.</p>
          : <p>{"We'll close this booking and release your bay. Thanks for parking with PARKLY."}</p> });
      if (yes) { actions.markExited(b.id, x.fee); toast(x.fee ? `Exit recorded. ${money(x.fee)} overstay charged.` : "Exit recorded. Drive safe.", "ok"); }
    },
  };
}

function Hero({ b, t }: { b: Booking; t: number }) {
  const { actions } = useApp();
  const act = useBookingActions(b);
  const status = bookingStatus(b, t), s = ms(b.start), e = ms(b.end), over = isOverstay(b, t);
  if (over) {
    const x = actions.exitPreview(b.id);
    return (
      <section className="card bk-hero is-danger">
        <div className="icon-tile" style={{ width: 96, height: 96, borderRadius: 28, background: "var(--danger-dim)", color: "var(--danger)", borderColor: "rgba(255,90,95,.4)" }}><Icon name="triangle-alert" size={40} /></div>
        <div className="stack-8"><span className="lbl t-danger">Overstay · past your exit time</span><div className="bk-big t-danger">{countdown(t - e)}</div>
          <p className="ink-2">You were due out at {timeLabel(e)}. {"After 15 minutes' grace, every started hour costs 1.5× the rate."}</p>
          <div className="row gap-12"><span className="badge badge-danger">Fee so far <b className="mono" style={{ marginLeft: 6 }}>{money(x.fee)}</b></span>
            <button type="button" className="btn btn-danger btn-md" onClick={act.exit}>{"I've exited"}</button>
            <button type="button" className="btn btn-secondary btn-md" disabled title="You can't extend once your time is over">Extend</button></div></div>
      </section>
    );
  }
  if (status === "active") {
    const left = e - t, warn = left < 15 * MIN;
    return (
      <section className={`card bk-hero${warn ? " is-warn" : ""}`}>
        <Ring frac={left / (e - s)} size={220} stroke={14} tone={warn ? "warn" : "lime"}><div className="eyebrow">Time left</div><div className="ring-time num">{countdown(left)}</div><div className="tiny muted mono mt-4">until {timeLabel(e)}</div></Ring>
        <div className="stack-12"><span className="lbl">{b.arrivedAt ? `Parked since ${timeLabel(b.arrivedAt)}` : "Your time has started"}</span><div className="h1d">{b.bay}</div>
          {warn ? <div className="notice notice-warn"><Icon name="alarm-clock" size={16} /><span>Ends in under 15 minutes. Extend now to avoid overstay charges.</span></div>
            : <p className="ink-2">Exit by <b className="mono">{timeLabel(e)}</b>. Need longer? Extend from here, no need to visit the counter.</p>}
          <div className="row gap-8">{b.arrivedAt
            ? <><button type="button" className="btn btn-primary btn-md is-mag" onClick={act.extend}><Icon name="timer" size={17} />Extend time</button><button type="button" className="btn btn-secondary btn-md" onClick={act.exit}>{"I've exited"}</button></>
            : <><Link className="btn btn-primary btn-md is-mag" href={`/bookings/${b.id}/arrive`}><Icon name="navigation" size={17} />{"I'm arriving"}</Link><button type="button" className="btn btn-secondary btn-md" onClick={act.pass}>Show pass</button></>}</div></div>
      </section>
    );
  }
  if (status === "upcoming" || status === "pending") {
    const pend = status === "pending";
    return (
      <section className="card bk-hero">
        <Ring frac={Math.max(0.04, 1 - (s - t) / (24 * HOUR))} size={200} stroke={12} tone={pend ? "warn" : "lime"}><div className="eyebrow">{pend ? "Waiting" : "Starts in"}</div><div className="ring-time num" style={{ fontSize: 28 }}>{pend ? "…" : countdown(s - t)}</div></Ring>
        <div className="stack-12"><span className="lbl">{pend ? "Owner is confirming" : `${dayLabel(s)} · ${timeLabel(s)}`}</span><div className="h1d">{pend ? "Booking received" : b.bay}</div>
          <p className="ink-2">{pend ? "Usually within a minute. If they decline, you get a full refund straight away." : `Your bay is held from ${timeLabel(s)} to ${timeLabel(e)}. You can check in from 15 minutes before.`}</p>
          <div className="row gap-8"><Link className="btn btn-primary btn-md is-mag" href={`/bookings/${b.id}/arrive`}><Icon name="navigation" size={17} />{"I'm arriving"}</Link><button type="button" className="btn btn-secondary btn-md" onClick={act.pass}><Icon name="qr-code" size={17} />Show pass</button></div></div>
      </section>
    );
  }
  const cx = status === "cancelled";
  return (
    <section className="card bk-hero">
      <div className="icon-tile" style={{ width: 96, height: 96, borderRadius: 28 }}><Icon name={cx ? "circle-x" : "circle-check"} size={40} /></div>
      <div className="stack-8"><span className="lbl">{cx ? "Cancelled" : "Completed"}</span>
        <div className="h1d">{cx ? (b.refund && b.refund.amount ? `${money(b.refund.amount)} refunded` : "No refund") : `Parked ${durationLabel((ms(b.exitedAt || b.end) - ms(b.arrivedAt || b.start)) / HOUR)}`}</div>
        <p className="ink-2">{cx ? (b.refund && b.refund.note) || "" : `Exited ${b.exitedAt ? dayLabel(b.exitedAt) + " at " + timeLabel(b.exitedAt) : "on time"}. Thanks for parking with PARKLY.`}</p>
        <div className="row gap-8"><button type="button" className="btn btn-primary btn-md" onClick={act.again}><Icon name="rotate-ccw" size={17} />Book again</button></div></div>
    </section>
  );
}

function Detail({ b, t }: { b: Booking; t: number }) {
  const act = useBookingActions(b);
  const f = facilityOrThrow(b.facilityId), status = bookingStatus(b, t), canChange = status === "upcoming" || status === "pending";
  const dl = canChange ? cancelDeadline(b, f, t) : null;
  type A = { ic: string; l: string; on?: () => void; href?: string; ext?: boolean; danger?: boolean };
  const acts: A[] = [
    { ic: "qr-code", l: "View pass", on: act.pass }, { ic: "navigation", l: "Directions", href: mapsUrl(f), ext: true },
    ...(canChange ? [{ ic: "pencil", l: "Change time or car", on: act.modify }] : []),
    ...(status === "active" && b.arrivedAt && !isOverstay(b, t) ? [{ ic: "timer", l: "Extend", on: act.extend }] : []),
    { ic: "calendar-plus", l: "Add to calendar", on: act.calendar }, { ic: "phone", l: "Call the lot", href: `tel:${f.phone}` }, { ic: "receipt", l: "Payment summary", on: act.payment },
    { ic: "rotate-ccw", l: "Book again", on: act.again }, ...(canChange ? [{ ic: "circle-x", l: "Cancel booking", on: act.cancel, danger: true }] : []),
  ];
  return (
    <div className="stack-24">
      <div className="row-between"><div><div className="crumbs"><StatusBadge booking={b} now={t} /><span className="mono">{b.ref}</span></div><h1 className="h1d mt-8">{f.name}</h1><p className="ink-2">{f.address}</p></div>
        <div className="thumb" style={{ width: 150, height: 100 }}><FacilityIllustration facility={f} /></div></div>
      <Hero b={b} t={t} />
      {dl && <div className="notice notice-info"><Icon name="alarm-clock" size={16} /><span>Cancel within <b className="mono">{countdown(dl.at - t)}</b> for a {dl.percentNow}% refund. After that it drops to {dl.percentAfter}%.</span></div>}
      <div className="bk-actions">{acts.map((a) => a.href
        ? <a key={a.l} className="act card-hover" href={a.href} {...(a.ext ? { target: "_blank", rel: "noopener noreferrer" } : {})}><Icon name={a.ic} size={20} />{a.l}</a>
        : <button type="button" key={a.l} className={`act card-hover${a.danger ? " is-danger" : ""}`} onClick={a.on}><Icon name={a.ic} size={20} />{a.l}</button>)}</div>
      <div className="grid-2">
        <section className="card sec-card"><h2 className="card-title mb-12">Details</h2><dl className="kv">
          <div><dt>Entry</dt><dd className="mono">{dayLabel(b.start)}, {timeLabel(b.start)}</dd></div><div><dt>Exit</dt><dd className="mono">{dayLabel(b.end)}, {timeLabel(b.end)}</dd></div>
          <div><dt>Bay</dt><dd className="mono">{b.bay}</dd></div><div><dt>Vehicle</dt><dd><Plate plate={b.vehicle.plate} size="sm" /></dd></div>
          <div><dt>Requests</dt><dd>{b.requirements.length ? b.requirements.join(", ") : "None"}</dd></div><div><dt>Paid</dt><dd className="mono">{money(paidSoFar(b))} · {methodLabel(b.payment.method)}</dd></div>
          <div><dt>Cancellation</dt><dd>{D.policies[f.policy].title}</dd></div></dl></section>
        <section className="card sec-card"><h2 className="card-title mb-16">Activity</h2><ul className="timeline">{[...b.history].reverse().map((x, i) => (
          <li key={i}><div className="strong small">{x.action}</div>{x.detail && <div className="tiny ink-2">{x.detail}</div>}<div className="t-time">{dayLabel(x.at)}, {timeLabel(x.at)}</div></li>))}</ul></section>
      </div>
    </div>
  );
}

const CHECKS = (b: Booking, h: number | null) => ["Pass is open on this screen", `Plate matches ${b.vehicle.plate}`, "Height under " + (h ? h + " m" : "the limit"), "Valuables out of sight"];
function ArriveView({ b, t }: { b: Booking; t: number }) {
  const { state } = useApp();
  const act = useBookingActions(b);
  const f = facilityOrThrow(b.facilityId), s = ms(b.start), e = ms(b.end), canIn = t >= s - 15 * MIN && t < e, st0 = bookingStatus(b, t);
  const others = availability(f, Math.max(t, s), e, state.bookings, state.demo.seed).free;
  const near = useMemo(() => nearestDest(f), [f]);
  const item = useMemo(() => measure(f, state.search, state.bookings, state.demo.seed, b.vehicle.type, near), [f, state.search, state.bookings, state.demo.seed, b.vehicle.type, near]);
  const opensAt = s - 15 * MIN;
  return (
    <div className="stack-24">
      <div className="row gap-12"><Link className="btn btn-ghost btn-sm" href={`/bookings/${b.id}`}><Icon name="arrow-left" size={16} />Back to booking</Link></div>
      <div><span className="lbl">On your way</span><h1 className="h1d mt-8">{f.name}</h1></div>
      <div className="arr-grid">
        <section className="card sec-card stack-16">
          <div className="row-between"><span className="lbl">{t < s ? "Entry opens in" : "Your time ends in"}</span><Badge tone="lime" icon="lock">{`Bay ${b.bay} held`}</Badge></div>
          <div className="bk-big">{countdown(t < s ? s - t : e - t)}</div>
          <div className="small ink-2">{others} other spaces are free right now, but yours is held.</div>
          <SvgMap className="mini-map" style={{ height: 240 }} items={[item]} dest={near} selectedId={f.id} routeTo={f} radiusKm={1} />
          <div className="row gap-8"><a className="btn btn-secondary btn-md grow" href={mapsUrl(f)} target="_blank" rel="noopener noreferrer"><Icon name="navigation" size={16} />Drive there</a>
            <button type="button" className="btn btn-secondary btn-md grow" onClick={act.pass}><Icon name="qr-code" size={16} />Show pass</button></div>
        </section>
        <section className="card sec-card stack-16"><h2 className="card-title">Before you reach the gate</h2>
          <div className="checklist">{CHECKS(b, f.heightLimit).map((x) => <label key={x} className="check"><input type="checkbox" /><span className="check-box" />{x}</label>)}</div>
          <hr className="lane" style={{ margin: "4px 0" }} /><h2 className="card-title">At the entry</h2><ol className="steps-ol">{f.entry.map((x) => <li key={x}>{x}</li>)}</ol>
          {b.arrivedAt ? <div className="notice notice-ok"><Icon name="circle-check" size={16} /><span>Checked in at {timeLabel(b.arrivedAt)}. Enjoy your visit.</span></div>
            : <>
              <button type="button" className="btn btn-primary btn-lg btn-block is-mag" disabled={!canIn} onClick={act.checkin}><Icon name="door" size={18} />{"I've entered · check in"}</button>
              {!canIn && <p className="tiny muted center">{st0 === "completed" ? "This booking has ended." : `Check-in opens ${dateKey(opensAt) === dateKey(t) ? "at " : dayLabel(opensAt).replace("Tomorrow", "tomorrow") + ", "}${timeLabel(opensAt)}, 15 minutes before entry.`}</p>}
            </>}
        </section>
      </div>
    </div>
  );
}

function BookingCard({ b, on, t }: { b: Booking; on: boolean; t: number }) {
  const f = facilityOrThrow(b.facilityId);
  return (
    <Link className={`card bk card-hover${on ? " is-active" : ""}`} href={`/bookings/${b.id}`}>
      <div className="row-between"><StatusBadge booking={b} now={t} /><span className="mono tiny muted">{b.ref}</span></div>
      <div className="bk-name ellipsis">{f.name}</div><div className="small ink-2 mono">{windowLabel(b.start, b.end)}</div>
      <div className="row-between mt-12"><Plate plate={b.vehicle.plate} size="sm" /><span className="num" style={{ fontSize: 17 }}><Rup n={paidSoFar(b)} /></span></div>
    </Link>
  );
}

function BookingsView({ arrive = false }: { arrive?: boolean }) {
  useTitle("Bookings · PARKLY");
  const { state } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ id?: string }>();
  const q = useSearchParams();
  const t = useNow(1000);
  const all = state.bookings;
  const [autoId, setAutoId] = useState<string | null>(null);
  const routeId = params.id || null;
  const id = routeId || autoId;
  const sel = id ? all.find((b) => b.id === id) : undefined;

  const qTab = q.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(() => {
    if (qTab && TABS.some((x) => x[0] === qTab)) return qTab;
    if (sel && (routeId || !bk.tab)) return tabOf(sel, t);
    return bk.tab || (all.some((b) => tabOf(b, t) === "active") ? "active" : "upcoming");
  });
  useEffect(() => { bk.tab = tab; }, [tab]);
  useEffect(() => { if (qTab && qTab !== tab && TABS.some((x) => x[0] === qTab)) setTab(qTab); }, [qTab]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = all.filter((b) => tabOf(b, t) === tab).sort((a, b) => (tab === "completed" || tab === "cancelled" ? -1 : 1) * (ms(a.start) - ms(b.start)));

  // nothing picked: open the first booking of this tab instead of an empty panel (URL → /bookings/<id>, no remount)
  const first = list[0]?.id;
  useEffect(() => {
    if (routeId || !first) return;
    setAutoId(first);
    window.history.replaceState(null, "", "/bookings/" + first);
  }, [routeId, first, pathname]);
  const pickTab = (k: Tab) => {
    setTab(k);
    if (routeId) { bk.tab = k; router.push("/bookings?tab=" + k); }
    else setAutoId(null);
  };
  const shown = routeId ? sel : autoId && list.some((b) => b.id === autoId) ? sel : list[0];

  const main = !shown
    ? routeId ? <EmptyState ico="search-x" title="Booking not found" action={<Link className="btn btn-primary btn-md" href="/bookings">See all bookings</Link>}>It may have been removed after a reset.</EmptyState>
      : <EmptyState ico="calendar-days" title={`No ${tab} bookings`} action={<Link className="btn btn-primary btn-md" href="/explore">Find parking</Link>}>{tab === "upcoming" ? "Book a space before you leave and it shows up here." : "Nothing here yet."}</EmptyState>
    : arrive ? <ArriveView b={shown} t={t} /> : <Detail b={shown} t={t} />;
  return (
    <>
      <Topbar title="Bookings" sub={`${plural(all.length, "booking")} · times shown in IST`} />
      <div className="md">
        <aside className="md-rail">
          <div className="tabs mb-16" role="tablist">{TABS.map(([k, l]) => {
            const n = all.filter((b) => tabOf(b, t) === k).length;
            return <button type="button" role="tab" aria-selected={k === tab} key={k} className={k === tab ? "is-on" : ""} onClick={() => pickTab(k)}>{l}{n ? <> <span className="count">{n}</span></> : null}</button>;
          })}</div>
          <div className="stagger" key={tab}>{list.length ? list.map((b) => <BookingCard key={b.id} b={b} on={!!shown && b.id === shown.id} t={t} />) : <p className="small muted p-16">No {tab} bookings.</p>}</div>
        </aside>
        <div className="md-main">{main}</div>
      </div>
    </>
  );
}

export function Bookings() { return <DesktopShell><BookingsView /></DesktopShell>; }
export function BookingDetail() { return <DesktopShell><BookingsView /></DesktopShell>; }
export function Arrive() { return <DesktopShell><BookingsView arrive /></DesktopShell>; }
