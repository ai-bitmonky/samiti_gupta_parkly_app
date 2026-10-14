"use client";
/* PARKLY mobile · booking-sheets.tsx — the booking bottom sheets (prototype mobile.html extendSheet, cancelSheet,
   exitSheet, modifySheet, booking acts pass / pay): extend with dial + live quote, cancel with refund preview and a
   live deadline countdown, exit with the overstay fee, modify with wheel + live price diff, pass, payment summary.
   useBookingSheets(id) → { pass, cal, pay, extend, cancel, modify, exit, again } for the Booking and Arrive screens. */
import { useMemo, useState } from "react";
import { useApp, useNow } from "@/lib/store";
import {
  D, MIN, TIMES, addDays, at, cancelDeadline, countdown, dateKey, dateLabel, facilityOrThrow, getBooking, money, now as engNow,
  paidSoFar, startOfDay, time12, timeKey, timeLabel, windowLabel,
} from "@/lib/engine";
import Icon from "@/components/shared/Icon";
import Dial from "@/components/shared/Dial";
import Bill from "@/components/shared/Bill";
import { Sheet } from "@/components/shared/Overlay";
import { useToast } from "@/components/shared/ToastProvider";
import { methodLabel } from "@/components/desktop/common";
import { Wheel, useNav, wait } from "./kit";
import type { WheelCol } from "./kit";
import { CalendarSheet, useSheet } from "./sheets";
import { PassView } from "./pass";
import { ms } from "./b-shared";

interface P { open: boolean; onClose: () => void; id: string }
const tl = (t: number | string) => timeLabel(t);

/* ── your pass ── */
export function PassSheet({ open, onClose, id }: P) {
  const { state } = useApp();
  const b = getBooking(state, id);
  return (
    <Sheet open={open} onClose={onClose} title="Your pass" kind="sheet">
      {b ? <div className="pass-slot"><PassView booking={b} print /></div> : null}
    </Sheet>
  );
}

/* ── payment summary ── */
export function PaySheet({ open, onClose, id }: P) {
  const { state } = useApp();
  const b = getBooking(state, id);
  if (!b) return null;
  return (
    <Sheet open={open} onClose={onClose} title="Payment summary" kind="sheet">
      <Bill quote={b.price} totalLabel="Booking total" />
      {b.payment.adjustments.length ? (
        <>
          <div className="group-label mt-24">Changes</div>
          <dl className="kv card card-pad">{b.payment.adjustments.map((a, i) => (
            <div key={i}><dt>{a.reason}</dt><dd className={`mono${a.amount < 0 ? " t-ok" : ""}`}>{a.amount < 0 ? "− " : "+ "}{money(Math.abs(a.amount))}</dd></div>
          ))}</dl>
        </>
      ) : null}
      <dl className="kv mt-16">
        <div><dt>Paid in total</dt><dd className="mono strong">{money(paidSoFar(b))}</dd></div>
        <div><dt>Paid with</dt><dd>{methodLabel(b.payment.method)}</dd></div>
        <div><dt>Transaction</dt><dd className="mono tiny selectable">{b.payment.txnId}</dd></div>
      </dl>
    </Sheet>
  );
}

/* ── extend: dial +30 min … +3 h, quick chips, live quote ── */
export function ExtendSheet({ open, onClose, id }: P) {
  const { state, actions } = useApp();
  const toast = useToast();
  const [min, setMin] = useState(60);
  const [busy, setBusy] = useState(false);
  const b = getBooking(state, id);
  if (!b) return null;
  const end = ms(b.end);
  const q = actions.quoteExtension(id, min);
  const go = async () => {
    setBusy(true);
    await wait(700);
    const r = actions.extendBooking(id, min);
    onClose();
    if (r.ok) toast(`Extended. Charged ${money(r.value.extra)}.`, "ok"); else toast(r.error, "danger");
  };
  return (
    <Sheet open={open} onClose={onClose} title="Extend parking" kind="sheet"
      footer={<button type="button" className={`btn btn-primary btn-lg btn-block${busy ? " is-loading" : ""}`} disabled={!q.ok} onClick={go}>{q.ok ? `Pay ${money(q.extra)} and extend` : "Can't extend by this much"}</button>}>
      <p className="small muted mb-12">Now ends at <b className="mono ink-2">{tl(end)}</b>. Drag the dial to add time.</p>
      <div style={{ width: 220, maxWidth: "100%", margin: "0 auto" }}>
        <Dial value={min} onChange={setMin} minMin={30} maxMin={180} stepMin={30} label="Add" prefix="+" sub={(v) => <>New exit <b>{tl(end + v * MIN)}</b></>} />
      </div>
      <div className="ext-chips mt-16">
        {[30, 60, 120, 180].map((m) => <button type="button" key={m} className={`chip${m === min ? " is-on" : ""}`} onClick={() => setMin(m)}>+{m < 60 ? m + "m" : m / 60 + "h"}</button>)}
      </div>
      <div className="mt-16">
        {q.ok
          ? <div className="card card-pad"><dl className="kv">
            <div><dt>New exit time</dt><dd className="mono">{tl(q.newEnd)}</dd></div>
            <div><dt>Spaces free then</dt><dd className="mono t-ok">{q.free}</dd></div>
            <div><dt>Extra to pay</dt><dd className="mono lime strong">{money(q.extra)}</dd></div>
          </dl></div>
          : <div className="notice notice-danger"><Icon name="circle-x" size={16} /><span>{q.issues[0]}</span></div>}
      </div>
    </Sheet>
  );
}

/* ── cancel: refund preview (fixed when opened) + live deadline countdown ── */
export function CancelSheet({ open, onClose, id }: P) {
  const { state, actions } = useApp();
  const toast = useToast();
  const t = useNow(1000);
  const [snap] = useState(() => {
    const b = getBooking(state, id);
    if (!b) return null;
    const f = facilityOrThrow(b.facilityId);
    return { pv: actions.refundPreview(id), dl: cancelDeadline(b, f, engNow()), pol: D.policies[f.policy] };
  });
  if (!snap) return null;
  const { pv, dl, pol } = snap;
  const yes = () => {
    const r = actions.cancelBooking(id);
    onClose();
    if (r.ok) toast(r.value.refund ? `Cancelled. ${money(r.value.refund)} is on its way back.` : "Cancelled. No refund under the policy.", "ok");
    else toast(r.error, "danger");
  };
  return (
    <Sheet open={open} onClose={onClose} title="Cancel this booking?" kind="sheet"
      footer={<><button type="button" className="btn btn-secondary btn-lg" data-close>Keep it</button><button type="button" className="btn btn-danger btn-lg" onClick={yes}>Cancel booking</button></>}>
      <div className="card card-pad center">
        <div className="eyebrow">You get back</div>
        <div className="mt-8"><span className="mp"><span className="rs">₹</span><span className="mp-n">{Math.round(pv.amount).toLocaleString("en-IN")}</span></span></div>
        <div className="tiny muted mt-8">of {money(pv.paid)} paid · {pv.percent}% refund</div>
      </div>
      {dl ? <div className="notice notice-warn mt-12"><Icon name="alarm-clock" size={16} /><span>Refund drops to {dl.percentAfter}% in <b className="mono">{countdown(dl.at - t)}</b> (at {tl(dl.at)}).</span></div> : null}
      <p className="small ink-2 mt-12">{pv.note}</p>
      <div className="group-label mt-16">{pol.title} policy</div>
      <ul className="pol">{pol.rules.map((x) => <li key={x}><Icon name="check" size={15} />{x}</li>)}</ul>
    </Sheet>
  );
}

/* ── exit: overstay fee (fixed when opened) ── */
export function ExitSheet({ open, onClose, id }: P) {
  const { actions } = useApp();
  const toast = useToast();
  const [ex] = useState(() => actions.exitPreview(id));
  const yes = () => { actions.markExited(id, ex.fee); onClose(); toast("Exit recorded. Drive safe!", "ok"); };
  return (
    <Sheet open={open} onClose={onClose} title="Leaving now?" kind="sheet"
      footer={<><button type="button" className="btn btn-secondary btn-lg" data-close>Not yet</button><button type="button" className="btn btn-primary btn-lg" onClick={yes}>{ex.fee ? `Pay ${money(ex.fee)} and exit` : "Confirm exit"}</button></>}>
      <p className="ink-2">{"Tap confirm once your car is out of the gate. We'll close the booking."}</p>
      {ex.fee
        ? <div className="notice notice-danger mt-12"><Icon name="triangle-alert" size={16} /><span>You stayed {countdown(ex.overMs)} past your exit time. An overstay charge of <b>{money(ex.fee)}</b> will be added.</span></div>
        : <div className="notice notice-ok mt-12"><Icon name="circle-check" size={16} /><span>{"No extra charges. You're inside your time."}</span></div>}
    </Sheet>
  );
}

/* ── modify: new entry (wheel), duration, vehicle, live diff ── */
function dayItems(n = 14) {
  const d0 = startOfDay(engNow());
  return Array.from({ length: n }, (_, i) => { const d = addDays(d0, i); return { v: dateKey(d), label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : dateLabel(d) }; });
}
const timeItems = () => TIMES.map((t) => ({ v: t, label: time12(t) }));
export function ModifySheet({ open, onClose, id }: P) {
  const { state, actions } = useApp();
  const toast = useToast();
  const [init] = useState(() => { const b = getBooking(state, id); const s = b ? ms(b.start) : engNow(); return { s, dur: b ? Math.round((ms(b.end) - s) / MIN) : 120, vid: b ? b.vehicleId : "" }; });
  const [start, setStart] = useState(init.s);
  const [dur, setDur] = useState(init.dur);
  const [vid, setVid] = useState(init.vid);
  const days = useMemo(() => dayItems(), []);
  const times = useMemo(() => timeItems(), []);
  const [w0] = useState(() => ({ dk: dateKey(init.s), tk: timeKey(init.s) }));
  const cols = useMemo<WheelCol[]>(() => [{ items: days, value: w0.dk, wide: true }, { items: times, value: w0.tk, wide: true }], [days, times, w0]);
  if (!getBooking(state, id)) return null;
  const end = start + dur * MIN;
  const p = actions.previewModify(id, { start, end, vehicleId: vid });
  const d = p.ok ? p.value.diff : 0;
  const save = () => { const r = actions.modifyBooking(id, { start, end, vehicleId: vid }); onClose(); if (r.ok) toast("Booking updated", "ok"); else toast(r.error, "danger"); };
  return (
    <Sheet open={open} onClose={onClose} title="Change booking" kind="sheet"
      footer={<button type="button" className="btn btn-primary btn-lg btn-block" disabled={!p.ok} onClick={save}>
        {!p.ok ? "Fix the issue above" : d > 0 ? `Pay ${money(d)} and save` : d < 0 ? `Save and get ${money(-d)} back` : "Save changes"}</button>}>
      <div className="group-label">New entry</div>
      <Wheel cols={cols} onChange={([d2, t2]) => setStart(at(d2, t2).getTime())} />
      <div className="group-label mt-16">Duration</div>
      <div className="chip-scroll">{[60, 120, 180, 240, 360, 480].map((m) => <button type="button" key={m} className={`chip${m === dur ? " is-on" : ""}`} onClick={() => setDur(m)}>{m / 60} h</button>)}</div>
      <div className="group-label mt-16">Vehicle</div>
      <div className="chip-scroll">{state.vehicles.map((v) => <button type="button" key={v.id} className={`chip${v.id === vid ? " is-on" : ""}`} onClick={() => setVid(v.id)}>{v.name}</button>)}</div>
      <div className="mt-16">
        {p.ok
          ? <div className="card card-pad"><dl className="kv">
            <div><dt>New time</dt><dd className="mono">{windowLabel(start, end)}</dd></div>
            <div><dt>New total</dt><dd className="mono">{money(p.value.price.total)}</dd></div>
            <div><dt>{d > 0 ? "Pay more" : d < 0 ? "Refund" : "Difference"}</dt><dd className={`diff${d > 0 ? " lime" : d < 0 ? " t-ok" : ""}`}>{d ? money(Math.abs(d)) : "₹0"}</dd></div>
          </dl></div>
          : <div className="notice notice-danger"><Icon name="circle-x" size={16} /><span>{p.error}</span></div>}
      </div>
    </Sheet>
  );
}

/** Opens the booking sheets for booking `id` (prototype Screens.booking.acts). */
export function useBookingSheets(id: string) {
  const { state } = useApp();
  const openSheet = useSheet();
  const nav = useNav();
  return useMemo(() => {
    const b = () => getBooking(state, id);
    return {
      pass: () => openSheet(({ open, close }) => <PassSheet open={open} onClose={close} id={id} />),
      pay: () => openSheet(({ open, close }) => <PaySheet open={open} onClose={close} id={id} />),
      extend: () => openSheet(({ open, close }) => <ExtendSheet open={open} onClose={close} id={id} />),
      cancel: () => openSheet(({ open, close }) => <CancelSheet open={open} onClose={close} id={id} />),
      modify: () => openSheet(({ open, close }) => <ModifySheet open={open} onClose={close} id={id} />),
      exit: () => openSheet(({ open, close }) => <ExitSheet open={open} onClose={close} id={id} />),
      cal: () => { const x = b(); if (x) openSheet(({ open, close }) => <CalendarSheet open={open} onClose={close} booking={x} />); },
      again: () => { const x = b(); if (x) nav.go("/parking/" + x.facilityId); },
    };
  }, [state, id, openSheet, nav]);
}
