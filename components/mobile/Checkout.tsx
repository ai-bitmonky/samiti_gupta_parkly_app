"use client";
/* 7 · CHECKOUT (prototype Screens.checkout): large "Checkout" title ("Review and pay"), review card (facility, when,
   duration, vehicle + plate, requests, note, cancellation; Edit goes back), promo code (Enter or Apply, quick-pick
   chips, live message, bill total rolls), pay-with radio cards, bill, simulated-payment note, sticky Pay button.
   Pay → full-screen "Paying ₹…" spinner (1.4 s) → booking → Confirmation (stack reset to Bookings). When the demo flag
   nextPaymentFails is set the first attempt fails: the flag is cleared and a sheet offers Try again / Change method.
   The draft comes from the query (s, e, m, v, req, note) written by Reserve. */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "@/lib/store";
import { D, applyPromo, facility as getFacility, money, quote, windowLabel } from "@/lib/engine";
import type { AppState, BookingMode, Facility, PaymentMethodId, Vehicle } from "@/lib/data";
import Icon from "@/components/shared/Icon";
import Plate from "@/components/shared/Plate";
import FacilityIllustration from "@/components/shared/FacilityIllustration";
import { Sheet } from "@/components/shared/Overlay";
import { useToast } from "@/components/shared/ToastProvider";
import { Empty, Screen, Topbar, W, durH, useNav, wait } from "./kit";
import { useSheet } from "./sheets";
import { useScreenRoute } from "./route";
import { useScreenTitle } from "./title";
import { MBill } from "./bill";
import { clearReserveDraft } from "./Reserve";

/** survives leaving checkout and coming back (prototype checkoutDraft) */
const checkoutDraft: { promo: string; method: PaymentMethodId | null } = { promo: "", method: null };

interface CDraft { f: Facility; start: number; end: number; mode: BookingMode; v: Vehicle; reqs: string[]; note: string }
function draftFromQuery(f: Facility, q: URLSearchParams, st: AppState): CDraft {
  const w = W(st);
  const start = +(q.get("s") || 0) || w.s, end = +(q.get("e") || 0) || w.e, mode = (q.get("m") as BookingMode) || "hourly";
  const v = st.vehicles.find((x) => x.id === q.get("v")) || st.vehicles.find((x) => x.id === st.defaultVehicleId) || st.vehicles[0];
  const reqs = (q.get("req") || "").split("|").filter(Boolean);
  return { f, start, end, mode, v, reqs, note: q.get("note") || "" };
}

const PAY_ICON: Record<string, string> = { upi: "smartphone", card: "credit-card", wallet: "wallet" };

function Row({ ic, k, children }: { ic: string; k: string; children: React.ReactNode }) {
  return <div className="review-row"><Icon name={ic} size={18} /><div className="grow"><div className="k">{k}</div><div className="v">{children}</div></div></div>;
}

function Processing({ total, name }: { total: number; name: string }) {
  const host = typeof document !== "undefined" ? document.querySelector(".device") || document.body : null;
  if (!host) return null;
  return createPortal(
    <div className="processing" role="alertdialog" aria-label="Processing payment"><div className="spinner" /><b className="h3">Paying {money(total)}</b><p className="small">Holding your space at {name}…</p></div>,
    host,
  );
}

function PayFailed({ open, onClose, onRetry, onChange }: { open: boolean; onClose: () => void; onRetry: () => void; onChange: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Payment didn't go through" kind="sheet"
      footer={<>
        <button type="button" className="btn btn-secondary btn-lg" onClick={() => { onClose(); onChange(); }}>Change method</button>
        <button type="button" className="btn btn-primary btn-lg" onClick={() => { onClose(); window.setTimeout(onRetry, 250); }}>Try again</button>
      </>}>
      <div className="center stack-12">
        <div className="empty-ico" style={{ margin: "8px auto", color: "var(--danger)" }}><Icon name="circle-x" size={30} /></div>
        <p className="ink-2">Your bank declined the payment. Nothing was charged and no space was booked.</p>
        <p className="small muted">Try again, or pick another way to pay.</p>
      </div>
    </Sheet>
  );
}

function CheckoutBody({ d }: { d: CDraft }) {
  const { state, actions } = useApp();
  const nav = useNav();
  const toast = useToast();
  const openSheet = useSheet();
  const f = d.f, pol = D.policies[f.policy];
  const [code, setCode] = useState(checkoutDraft.promo);
  const [applied, setApplied] = useState(() => (checkoutDraft.promo && applyPromo(checkoutDraft.promo, 1e4, d.start).ok ? checkoutDraft.promo : ""));
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [method, setMethod] = useState<PaymentMethodId>(checkoutDraft.method || state.prefs.payment || "upi");
  const [busy, setBusy] = useState(false);
  const methodsRef = useRef<HTMLDivElement>(null);
  const payTotal = useRef(0);
  const live = useRef({ state, method, applied });
  live.current = { state, method, applied };
  const q = quote({ facility: f, start: d.start, end: d.end, mode: d.mode, vehicleType: d.v.type, evCharging: d.reqs.includes("EV charging"), promo: applied || undefined });

  const applyCode = (raw: string) => {
    const c = raw.trim();
    const base = quote({ facility: f, start: d.start, end: d.end, mode: d.mode, vehicleType: d.v.type });
    const res = applyPromo(c, base.subtotal, d.start);
    setMsg(c ? { ok: res.ok, message: res.message } : null);
    const a = res.ok ? c.toUpperCase() : "";
    setApplied(a); checkoutDraft.promo = a;
  };
  // a code applied earlier shows its message again (prototype: paint(); if (applied) applyCode(applied))
  useEffect(() => { if (applied) applyCode(applied); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pay = async () => {
    if (busy) return;
    const total = quote({ facility: f, start: d.start, end: d.end, mode: d.mode, vehicleType: d.v.type, evCharging: d.reqs.includes("EV charging"), promo: live.current.applied || undefined }).total;
    setBusy(true);
    payTotal.current = total;
    await wait(1400);
    setBusy(false);
    if (live.current.state.demo.nextPaymentFails) {
      actions.setDemo({ nextPaymentFails: false });
      openSheet(({ open, close }) => <PayFailed open={open} onClose={close} onRetry={() => payRef.current()}
        onChange={() => methodsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })} />);
      return;
    }
    const res = actions.createBooking({ facilityId: f.id, vehicleId: d.v.id, start: d.start, end: d.end, mode: d.mode, requirements: d.reqs, notes: d.note, promo: checkoutDraft.promo || undefined, method: live.current.method });
    if (!res.ok) { toast(res.error, "danger"); return; }
    checkoutDraft.promo = ""; clearReserveDraft(f.id);
    nav.reset(["/bookings"], "/confirmation/" + res.value.id, "push");
  };
  const payRef = useRef(pay);
  payRef.current = pay;

  return (
    <>
      <Topbar title="Checkout" large eyebrow="Review and pay" />
      <div className="page">
        <div className="card card-pad">
          <div className="row gap-12 mb-16"><div className="thumb" style={{ width: 72, height: 58 }}><FacilityIllustration facility={f} scene="entrance" /></div>
            <div className="grow"><b className="h3">{f.name}</b><div className="small muted">{f.area}</div></div>
            <button type="button" className="btn btn-ghost btn-sm" data-back="">Edit</button></div>
          <Row ic="calendar-clock" k="When"><span className="mono small">{windowLabel(d.start, d.end)}</span></Row>
          <Row ic="timer" k="Duration">{d.mode === "daily" ? Math.ceil((d.end - d.start) / 864e5) + " day(s), daily rate" : durH(d.start, d.end)}</Row>
          <Row ic="car" k="Vehicle">{d.v.name} &nbsp;<Plate plate={d.v.plate} size="sm" /></Row>
          {d.reqs.length ? <Row ic="sparkles" k="Requests">{d.reqs.join(", ")}</Row> : null}
          {d.note ? <Row ic="file-text" k="Note">{d.note}</Row> : null}
          <Row ic="shield-check" k="Cancellation">{pol.title}: {pol.rules[0].toLowerCase()}</Row>
        </div>
        <div className="sec" style={{ marginTop: 28 }}><div className="group-label">Promo code</div>
          <div className="promo">
            <input className="input" placeholder="Enter a code" value={code} maxLength={12} autoCapitalize="characters" aria-label="Promo code"
              onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") applyCode(code); }} />
            <button type="button" className="btn btn-secondary btn-md" onClick={() => applyCode(code)}>Apply</button>
          </div>
          <div className="mt-8">
            {msg ? <div className={`field-${msg.ok ? "hint t-ok" : "error"}`} style={{ display: "flex", gap: 6 }}><Icon name={msg.ok ? "circle-check" : "info"} size={14} /><span>{msg.message}</span></div> : null}
          </div>
          <div className="chip-row mt-8">{Object.keys(D.promos).map((c) => <button type="button" key={c} className="chip chip-sm" onClick={() => { setCode(c); applyCode(c); }}>{c}</button>)}</div>
        </div>
        <div className="sec" style={{ marginTop: 28 }}><div className="group-label">Pay with</div>
          <div className="stack-8" ref={methodsRef}>
            {D.paymentMethods.map((m) => (
              <label className="opt" key={m.id}>
                <input type="radio" name="pay" value={m.id} checked={m.id === method} onChange={() => { setMethod(m.id); checkoutDraft.method = m.id; }} />
                <span className="pay-ico"><Icon name={PAY_ICON[m.id]} size={19} /></span>
                <span className="grow"><b className="small" style={{ display: "block" }}>{m.label}</b><span className="tiny muted mono">{m.detail}</span></span>
                <span className="opt-mark" />
              </label>
            ))}
          </div>
        </div>
        <div className="sec" style={{ marginTop: 28 }}><div className="group-label">Bill</div>
          <div className="card card-pad"><MBill quote={q} totalLabel="You pay" roll /></div>
          <p className="tiny muted mt-8 center"><Icon name="lock" size={12} /> Payment is simulated in this prototype. No money moves.</p>
        </div>
      </div>
      <div className="actionbar"><button type="button" className="btn btn-primary btn-lg btn-block" onClick={pay}><Icon name="lock" size={17} />Pay {money(q.total)} and reserve</button></div>
      {busy ? <Processing total={payTotal.current} name={f.name} /> : null}
    </>
  );
}

export default function Checkout() {
  const { params, query } = useScreenRoute();
  const { state } = useApp();
  const f = getFacility(params.id);
  useScreenTitle("Checkout · PARKLY");
  const [d] = useState(() => (f ? draftFromQuery(f, query, state) : null));
  if (!f || !d) return (
    <Screen>
      <Topbar title="Checkout" />
      <Empty ico="search-x" title="Parking not found" text="It may have been removed." />
    </Screen>
  );
  return <Screen><CheckoutBody d={d} /></Screen>;
}
