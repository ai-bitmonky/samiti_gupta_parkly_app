"use client";
/* PARKLY mobile · Profile.tsx — 15 PROFILE (prototype mobile.html Screens.profile): local user card (no login —
   "Sign in" only flips guest/named mode on this device; the name, email and phone are editable here), vehicles
   (VehicleSheet, make default, remove), pay-with preference, saved places, notification switches, display
   (larger text, reduce motion), help FAQ, terms / privacy sheets, sign out, and hidden developer options after
   5 taps on the version line (test clock, jump to next event, fail next payment, refresh, reset). */
import { useState } from "react";
import { useApp, useNow } from "@/lib/store";
import { D, dayLabel, destination, durationLabel, durationShort, timeLabel } from "@/lib/engine";
import type { DemoState, NotifyPrefs, Prefs, Vehicle } from "@/lib/data";
import Icon from "@/components/shared/Icon";
import Plate from "@/components/shared/Plate";
import { Sheet } from "@/components/shared/Overlay";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/Confirm";
import { Bell, Screen, Topbar, useNav } from "./kit";
import { VehicleSheet, useSheet } from "./sheets";
import { useScreenTitle } from "./b-shared";

const FAQ: [string, string][] = [
  ["How is my space held?", "When you pay, one space is set aside for your exact hours. Other drivers can't book it."],
  ["What if I'm late?", "Your space stays held until your exit time. Arrive any time inside your window."],
  ["What if I stay longer?", "You get 15 minutes of grace. After that, each started hour costs 1.5× the hourly rate. Extend in the app to avoid it."],
  ["How do refunds work?", "Each place has a policy: Flexible, Moderate or Strict. The app shows your exact refund before you cancel."],
];
const dev = { taps: 0, open: false }; // survives leaving the tab (prototype devTaps / devOpen)

function Sw({ label, sub, on, onChange }: { label: string; sub?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="grow-row no-press">
      <span className="lbl">{label}{sub ? <small>{sub}</small> : null}</span>
      <span className="switch"><input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} /><span className="switch-track" /></span>
    </label>
  );
}

/* ── sheets ── */
function UserSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, actions } = useApp();
  const toast = useToast();
  const [name, setName] = useState(state.user.name);
  const [email, setEmail] = useState(state.user.email);
  const [phone, setPhone] = useState(state.user.phone);
  const [err, setErr] = useState("");
  const save = () => {
    if (!name.trim()) { setErr("Add your name so the attendant knows who booked."); return; }
    actions.setUser({ name: name.trim(), email: email.trim(), phone: phone.trim() });
    onClose(); toast("Profile updated", "ok");
  };
  return (
    <Sheet open={open} onClose={onClose} title="Edit profile" kind="sheet"
      footer={<button type="button" className="btn btn-primary btn-lg btn-block" onClick={save}>Save changes</button>}>
      <div className="group-label">Details</div>
      <div className="group mb-16">
        <label className="grow-row no-press"><span className="lbl">Name</span><input className="row-input" value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} placeholder="Your name" maxLength={40} autoComplete="name" /></label>
        <label className="grow-row no-press"><span className="lbl">Email</span><input className="row-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Optional" autoComplete="email" /></label>
        <label className="grow-row no-press"><span className="lbl">Phone</span><input className="row-input mono" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" autoComplete="tel" /></label>
      </div>
      {err ? <div className="notice notice-danger mb-12"><Icon name="circle-x" size={16} /><span>{err}</span></div> : null}
      <p className="tiny muted">Saved on this device only. No account or sign-in is needed.</p>
    </Sheet>
  );
}

function VehicleActions({ open, onClose, v, onEdit }: { open: boolean; onClose: () => void; v: Vehicle; onEdit: () => void }) {
  const { state, actions } = useApp();
  const toast = useToast();
  return (
    <Sheet open={open} onClose={onClose} title={v.name} kind="sheet">
      <div className="center mb-16"><Plate plate={v.plate} size="lg" /></div>
      <div className="act-list">
        {v.id !== state.defaultVehicleId ? (
          <button type="button" className="list-row" onClick={() => { onClose(); actions.setDefaultVehicle(v.id); toast(`${v.name} is now your default`, "ok"); }}>
            <span className="ico-wrap"><Icon name="star" size={18} /></span><span className="grow">Make default</span></button>
        ) : null}
        <button type="button" className="list-row" onClick={() => { onClose(); window.setTimeout(onEdit, 240); }}><span className="ico-wrap"><Icon name="pencil" size={18} /></span><span className="grow">Edit</span></button>
        <button type="button" className="list-row t-danger" onClick={() => { onClose(); const r = actions.removeVehicle(v.id); toast(r.ok ? "Vehicle removed" : r.error, r.ok ? "info" : "warn"); }}>
          <span className="ico-wrap"><Icon name="trash" size={18} /></span><span className="grow">Remove</span></button>
      </div>
    </Sheet>
  );
}

function PaySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, actions } = useApp();
  return (
    <Sheet open={open} onClose={onClose} title="Pay with" kind="sheet">
      <div className="act-list">{D.paymentMethods.map((m) => (
        <button type="button" key={m.id} className="list-row" onClick={() => { actions.setPrefs({ payment: m.id }); onClose(); }}>
          <span className="grow">{m.label}<div className="tiny muted mono">{m.detail}</div></span>
          {m.id === state.prefs.payment ? <Icon name="check" size={20} className="check-mark" /> : null}
        </button>
      ))}</div>
    </Sheet>
  );
}

function PlaceSheet({ open, onClose, id }: { open: boolean; onClose: () => void; id: string }) {
  const { state, actions } = useApp();
  const p = state.savedPlaces.find((x) => x.id === id);
  if (!p) return null;
  return (
    <Sheet open={open} onClose={onClose} title={`Set ${p.label}`} kind="sheet">
      <div className="act-list">{D.destinations.map((d) => (
        <button type="button" key={d.id} className="list-row" onClick={() => { actions.setSavedPlace(p.id, d.id); onClose(); }}>
          <span className="grow">{d.name}<div className="tiny muted">{d.area}</div></span>
          {d.id === p.destId ? <Icon name="check" size={20} className="check-mark" /> : null}
        </button>
      ))}</div>
    </Sheet>
  );
}

function DocSheet({ open, onClose, doc }: { open: boolean; onClose: () => void; doc: "terms" | "privacy" }) {
  return (
    <Sheet open={open} onClose={onClose} title={doc === "terms" ? "Terms of use" : "Privacy"} kind="sheet">
      {doc === "terms"
        ? <div className="stack-12 small ink-2">
          <p>PARKLY lets you reserve a parking space for set hours. You pay the price shown before you confirm.</p>
          <p>Please arrive inside your booked window and leave by your exit time. Staying longer adds an overstay charge after 15 minutes.</p>
          <p>Refunds follow the policy shown on each place. The ₹15 convenience fee is not refunded.</p>
          <p className="muted">This is a design prototype. No real bookings or payments are made.</p>
        </div>
        : <div className="stack-12 small ink-2">
          <p>We store your name, phone, email, vehicles and bookings to run your reservations.</p>
          <p>Your location is used only when you tap “Near me”, and is not kept.</p>
          <p>We never sell your data. You can delete your account at any time from Profile.</p>
          <p className="muted">In this prototype, everything stays in your browser.</p>
        </div>}
    </Sheet>
  );
}

/* ── developer options (test clock ticks every second) ── */
function DevOptions({ onReset }: { onReset: () => void }) {
  const { state, actions } = useApp();
  const toast = useToast();
  const t = useNow(1000);
  const off = state.demo.clockOffsetMin;
  const clock = (m: number) => { actions.advanceClock(m); toast(`Clock moved forward ${durationLabel(m / 60)}`, "info"); };
  const setD = (k: keyof DemoState, v: boolean) => { actions.setDemo({ [k]: v }); toast(v ? "The next payment will fail" : "Payments work normally", "info"); };
  return (
    <div className="sec dev" style={{ marginTop: 28 }}>
      <div className="group-label lime">Developer options</div>
      <div className="card card-pad">
        <div className="row-between"><span className="small">Test clock</span><b className={`mono small${off ? " lime" : ""}`}>{dayLabel(t)} {timeLabel(t)}{off ? ` (+${durationShort(off)})` : ""}</b></div>
        <div className="dev-grid mt-12">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => clock(30)}>+30 min</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => clock(60)}>+1 h</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => clock(180)}>+3 h</button>
        </div>
        <div className="stack-8 mt-8">
          <button type="button" className="btn btn-secondary btn-sm btn-block" onClick={() => { const l = actions.jumpToNextEvent(); toast(l || "No upcoming or active booking", l ? "info" : "warn"); }}>Jump to 10 min before next event</button>
          <button type="button" className="btn btn-outline btn-sm btn-block" disabled={!off} onClick={() => { actions.setClockOffset(0); toast("Back to real time", "info"); }}>Back to real time</button>
        </div>
      </div>
      <div className="group mt-12">
        <Sw label="Fail the next payment" sub="Test the payment error screen" on={state.demo.nextPaymentFails} onChange={(v) => setD("nextPaymentFails", v)} />
        <button type="button" className="grow-row" onClick={() => { actions.refreshAvailability(); toast("Availability refreshed", "ok"); }}><span className="ri"><Icon name="refresh-cw" size={16} /></span><span className="lbl">Refresh availability</span></button>
        <button type="button" className="grow-row" onClick={onReset}><span className="ri"><Icon name="rotate-ccw" size={16} /></span><span className="lbl t-danger">Reset all data</span></button>
      </div>
    </div>
  );
}

export function Profile() {
  useScreenTitle("Profile · PARKLY");
  const { state: st, actions } = useApp();
  const nav = useNav();
  const toast = useToast();
  const confirm = useConfirm();
  const openSheet = useSheet();
  const [d, setDev] = useState({ ...dev });
  const u = st.user, nt = st.prefs.notify;
  const setN = (k: keyof NotifyPrefs) => (v: boolean) => actions.setNotify({ [k]: v });
  const setP = (k: keyof Prefs) => (v: boolean) => actions.setPrefs({ [k]: v });
  const sync = () => setDev({ ...dev });

  const vehicleSheet = (v?: Vehicle) => openSheet(({ open, close }) => <VehicleSheet open={open} onClose={close} vehicle={v} />);
  const veh = (v: Vehicle) => openSheet(({ open, close }) => <VehicleActions open={open} onClose={close} v={v} onEdit={() => vehicleSheet(st.vehicles.find((x) => x.id === v.id) || v)} />);
  const ver = () => {
    if (dev.open) return;
    dev.taps++;
    if (dev.taps >= 5) { dev.open = true; toast("Developer options are on", "ok"); }
    sync();
  };
  const reset = async () => {
    if (!(await confirm({ title: "Reset all data?", body: "Bookings, saved places and settings go back to the demo start.", confirm: "Reset", tone: "danger" }))) return;
    dev.open = false; dev.taps = 0; sync();
    actions.resetDemo();
    toast("Demo data reset", "ok");
    nav.reset([], "/explore", "tab");
  };
  const signout = async () => {
    if (!(await confirm({ title: "Sign out?", body: "You'll see the welcome screen again. Your demo data stays on this device.", confirm: "Sign out", tone: "danger" }))) return;
    actions.signOut();
    nav.reset([], "/welcome", "pop");
  };
  const initials = u.name.split(" ").filter(Boolean).map((x) => x[0]).join("");
  return (
    <Screen tab>
      <Topbar title="Profile" large back={false} actions={<Bell />} />
      <div className="page">
        <div className="card card-pad row gap-12">
          <div className="avatar">{u.guest ? "G" : initials}</div>
          <div className="grow">
            <b className="h3">{u.guest ? "Guest" : u.name}</b>
            <div className="tiny muted">{u.guest ? "Sign in to sync bookings" : u.email}</div>
            <div className="tiny muted mono">{u.guest ? "" : u.phone}</div>
          </div>
          {u.guest
            ? <button type="button" className="btn btn-primary btn-sm" onClick={() => { actions.setUser({ guest: false }); toast(`Signed in as ${u.name}`, "ok"); }}>Sign in</button>
            : <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Edit profile" onClick={() => openSheet(({ open, close }) => <UserSheet open={open} onClose={close} />)}><Icon name="pencil" size={18} /></button>}
        </div>

        <div className="sec" style={{ marginTop: 28 }}><div className="group-label">Vehicles</div><div className="group">
          {st.vehicles.map((v) => (
            <button type="button" key={v.id} className="grow-row" onClick={() => veh(v)}>
              <span className={`ri${v.id === st.defaultVehicleId ? " lime" : ""}`}><Icon name={v.type === "motorcycle" ? "bike" : v.type === "ev" ? "zap" : "car"} size={16} /></span>
              <span className="lbl">{v.name}<small>{D.vehicleLabels[v.type]}{v.id === st.defaultVehicleId ? " · Default" : ""}</small></span>
              <Plate plate={v.plate} size="sm" />
            </button>
          ))}
          <button type="button" className="grow-row" onClick={() => vehicleSheet()}><span className="ri"><Icon name="plus" size={16} /></span><span className="lbl lime">Add a vehicle</span></button>
        </div></div>

        <div className="sec" style={{ marginTop: 28 }}><div className="group-label">Payment &amp; places</div><div className="group">
          <button type="button" className="grow-row" onClick={() => openSheet(({ open, close }) => <PaySheet open={open} onClose={close} />)}>
            <span className="ri"><Icon name="wallet" size={16} /></span><span className="lbl">Pay with</span>
            <span className="val">{(D.paymentMethods.find((m) => m.id === st.prefs.payment) || D.paymentMethods[0]).label}</span><Icon name="chevron-right" size={18} className="chev" />
          </button>
          {st.savedPlaces.map((p) => (
            <button type="button" key={p.id} className="grow-row" onClick={() => openSheet(({ open, close }) => <PlaceSheet open={open} onClose={close} id={p.id} />)}>
              <span className="ri"><Icon name={p.label === "Home" ? "house" : "briefcase"} size={16} /></span><span className="lbl">{p.label}</span>
              <span className="val">{destination(p.destId)?.name || ""}</span><Icon name="chevron-right" size={18} className="chev" />
            </button>
          ))}
        </div></div>

        <div className="sec" style={{ marginTop: 28 }}><div className="group-label">Notifications</div><div className="group">
          <Sw label="Booking reminders" sub="1 hour before entry and 15 min before exit" on={nt.reminders} onChange={setN("reminders")} />
          <Sw label="Booking updates" sub="Confirmations, changes, refunds" on={nt.updates} onChange={setN("updates")} />
          <Sw label="Price alerts" sub="For your saved searches" on={nt.priceAlerts} onChange={setN("priceAlerts")} />
          <Sw label="Availability changes" sub="For your saved places" on={nt.availability} onChange={setN("availability")} />
        </div></div>

        <div className="sec" style={{ marginTop: 28 }}><div className="group-label">Display</div><div className="group">
          <Sw label="Larger text" on={st.prefs.largeText} onChange={setP("largeText")} />
          <Sw label="Reduce motion" sub="Turns off slides and count-ups" on={st.prefs.reduceMotion} onChange={setP("reduceMotion")} />
        </div></div>

        {d.open ? <DevOptions onReset={reset} /> : null}

        <div className="sec" style={{ marginTop: 28 }}><div className="group-label">Help</div><div className="group">
          {FAQ.map(([q, a]) => (
            <details className="faq" key={q}><summary className="grow-row"><span className="lbl">{q}</span><Icon name="chevron-down" size={18} className="chev" /></summary><p className="small ink-2">{a}</p></details>
          ))}
          <button type="button" className="grow-row" onClick={() => openSheet(({ open, close }) => <DocSheet open={open} onClose={close} doc="terms" />)}><span className="lbl">Terms of use</span><Icon name="chevron-right" size={18} className="chev" /></button>
          <button type="button" className="grow-row" onClick={() => openSheet(({ open, close }) => <DocSheet open={open} onClose={close} doc="privacy" />)}><span className="lbl">Privacy</span><Icon name="chevron-right" size={18} className="chev" /></button>
        </div></div>

        <button type="button" className="btn btn-danger btn-lg btn-block mt-24" onClick={signout}><Icon name="log-out" size={18} />Sign out</button>
        <button type="button" className="ver tap" onClick={ver}>PARKLY for Delhi NCR · version 1.0 (prototype){d.open ? "" : d.taps ? ` · ${5 - d.taps} more taps` : ""}</button>
      </div>
    </Screen>
  );
}
