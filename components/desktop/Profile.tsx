"use client";
/* 11. PROFILE (prototype Views.profile), 2-col: user card (editable local profile; no login — "Sign in / Sign out"
   only switches guest/named mode on this device), vehicles, payment, saved places | notifications, display,
   developer options (tap the version 5×: test clock, jump to next event, fail next payment, refresh, reset), FAQ, terms. */
import { useRef, useState } from "react";
import { useApp, useNow } from "@/lib/store";
import { D, dayLabel, durationShort, timeLabel } from "@/lib/engine";
import type { NotifyPrefs, Prefs, User } from "@/lib/data";
import Icon from "@/components/shared/Icon";
import Badge from "@/components/shared/Badge";
import Plate from "@/components/shared/Plate";
import { Modal } from "@/components/shared/Overlay";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/Confirm";
import DesktopShell, { useModal, useTitle } from "./DesktopShell";
import { Topbar, VehicleModal } from "./common";
import { resetDraft } from "./Reserve";

const FAQ: [string, string][] = [
  ["Is my space really guaranteed?", "Yes. When you book, a bay is held for your exact time. If the lot can't give you a space, you get a full refund and ₹100 credit."],
  ["What if I arrive late?", "Your bay is held for your whole booking. You can enter any time between your entry and exit time."],
  ["What if I stay longer?", "Extend from the booking page before your time ends. If you overstay, there are 15 free minutes, then each started hour costs 1.5× the rate."],
  ["How do refunds work?", "It depends on the lot's policy: Flexible, Moderate or Strict. The exact refund is shown before you confirm a cancellation. The ₹18 convenience fee is not refunded."],
  ["Can I change my car or time?", "Yes, for upcoming bookings. You'll see the price difference before you save."],
];
const DOCS = {
  terms: ["PARKLY is a design prototype. No real bookings or payments are made.", "Prices include the convenience fee and 18% GST. The convenience fee is not refunded.", "Overstay: 15 minutes' grace, then every started hour at 1.5× the hourly rate.", "Refunds follow each lot's cancellation policy, shown before you pay."],
  privacy: ["This prototype stores your demo data only in this browser (localStorage).", "Nothing is sent to a server. Clearing site data or Reset removes it.", "Location is simulated: Near me always uses Mandi House."],
};
const prof = { taps: 0, dev: false };

function Switch({ label, sub, on, onChange }: { label: string; sub?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="switch switch-row" style={{ padding: "6px 0" }}>
      <span><span className="strong">{label}</span>{sub && <><br /><span className="tiny muted">{sub}</span></>}</span>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} /><span className="switch-track" />
    </label>
  );
}

function UserModal({ open, close }: { open: boolean; close: () => void }) {
  const { state, actions } = useApp();
  const toast = useToast();
  const [u, setU] = useState<Pick<User, "name" | "email" | "phone">>({ name: state.user.name, email: state.user.email, phone: state.user.phone });
  const save = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!u.name.trim()) { toast("Add your name so the attendant knows who booked.", "warn"); return; }
    actions.setUser({ name: u.name.trim(), email: u.email.trim(), phone: u.phone.trim() });
    close(); toast("Profile updated", "ok");
  };
  return (
    <Modal open={open} onClose={close} title="Edit profile" size="sm"
      footer={<><button type="button" className="btn btn-ghost btn-md" data-close>Cancel</button><button type="button" className="btn btn-primary btn-md" onClick={() => save()}>Save</button></>}>
      <form className="stack-16" onSubmit={save} autoComplete="off">
        <div className="field"><label className="field-label" htmlFor="pu-n">Name</label><input className="input" id="pu-n" value={u.name} onChange={(e) => setU({ ...u, name: e.target.value })} /></div>
        <div className="field"><label className="field-label" htmlFor="pu-e">Email</label><input className="input" id="pu-e" type="email" value={u.email} onChange={(e) => setU({ ...u, email: e.target.value })} /></div>
        <div className="field"><label className="field-label" htmlFor="pu-p">Phone</label><input className="input" id="pu-p" value={u.phone} onChange={(e) => setU({ ...u, phone: e.target.value })} /></div>
        <p className="tiny muted">Saved on this device only. No account or sign-in is needed.</p>
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}

function ProfileView() {
  useTitle("Profile · PARKLY");
  const { state: s, actions } = useApp();
  const toast = useToast();
  const confirm = useConfirm();
  const openModal = useModal();
  const t = useNow(1000);
  const devRef = useRef<HTMLElement>(null);
  const [dev, setDev] = useState(prof.dev);
  const off = s.demo.clockOffsetMin, nx = s.prefs.notify;
  const showDev = dev || !!off || s.demo.nextPaymentFails;
  const nf = (k: keyof NotifyPrefs) => (v: boolean) => actions.setNotify({ [k]: v });
  const pf = (k: keyof Prefs) => (v: boolean) => actions.setPrefs({ [k]: v });

  const tapVer = () => {
    if (++prof.taps >= 5 && !prof.dev) {
      prof.dev = true; setDev(true); toast("Developer options unlocked", "ok");
      window.setTimeout(() => devRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    }
  };
  const rmVehicle = async (id: string) => {
    const v = s.vehicles.find((x) => x.id === id);
    if (!v) return;
    if (await confirm({ title: `Remove ${v.name}?`, body: `${v.plate} will be removed from your profile.`, confirm: "Remove", tone: "danger", cancel: "Keep" })) {
      const r = actions.removeVehicle(v.id); toast(r.ok ? "Vehicle removed" : r.error, r.ok ? "ok" : "warn");
    }
  };
  const reset = async () => {
    if (await confirm({ title: "Reset all data?", body: "Bookings, vehicles and settings go back to the demo start. This can't be undone.", confirm: "Reset", tone: "danger" })) { actions.resetDemo(); resetDraft(); toast("Demo data reset", "ok"); }
  };
  const signInOut = async () => {
    if (s.user.guest) { actions.setUser({ guest: false }); toast(`Signed in as ${s.user.name} on this device`, "ok"); return; }
    if (await confirm({ title: "Sign out?", body: "Your demo bookings stay on this device. You can keep using everything as a guest.", confirm: "Sign out" })) { actions.setUser({ guest: true }); toast("You're browsing as a guest. Everything still works.", "info"); }
  };
  const doc = (k: "terms" | "privacy") => openModal(({ open, close }) => (
    <Modal open={open} onClose={close} title={k === "terms" ? "Terms of use" : "Privacy"}><div className="stack-12 ink-2 small">{DOCS[k].map((x) => <p key={x}>{x}</p>)}</div></Modal>
  ));

  return (
    <>
      <Topbar title="Profile" />
      <div className="page"><div className="two-col" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
        <div className="stack-24">
          <section className="card prof-user"><span className="avatar">{s.user.name[0]}</span>
            <div className="grow"><div className="h2">{s.user.name}</div><div className="small muted"><span className="nowrap">{s.user.email}</span> · <span className="nowrap">{s.user.phone}</span></div><div className="tiny muted mt-4">{s.user.guest ? "Guest on this device" : "Named profile on this device"}</div></div>
            <Badge tone="lime">{`${s.bookings.length} bookings`}</Badge>
            <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Edit profile" onClick={() => openModal(({ open, close }) => <UserModal open={open} close={close} />)}><Icon name="pencil" size={15} /></button>
          </section>
          <section className="card sec-card"><div className="card-head"><h2 className="card-title">Vehicles</h2>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => openModal(({ open, close }) => <VehicleModal open={open} close={close} />)}><Icon name="plus" size={15} />Add</button></div>
            <div className="list">{s.vehicles.map((v) => (
              <div key={v.id} className="list-row" style={{ paddingInline: 0 }}>
                <span className="ico-wrap"><Icon name={v.type === "motorcycle" ? "bike" : v.type === "ev" ? "zap" : "car"} size={18} /></span>
                <div className="grow"><b>{v.name}</b> {v.id === s.defaultVehicleId && <Badge tone="lime">Default</Badge>}
                  <div className="row gap-8 mt-4" style={{ flexWrap: "wrap" }}><Plate plate={v.plate} size="sm" /><span className="tiny muted">{D.vehicleLabels[v.type]}</span></div></div>
                {v.id !== s.defaultVehicleId && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { actions.setDefaultVehicle(v.id); toast("Default vehicle changed. Prices now use this car.", "ok"); }}>Make default</button>}
                <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Edit ${v.name}`} onClick={() => openModal(({ open, close }) => <VehicleModal open={open} close={close} vehicle={v} />)}><Icon name="pencil" size={15} /></button>
                <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Remove ${v.name}`} onClick={() => rmVehicle(v.id)}><Icon name="trash" size={15} /></button>
              </div>
            ))}</div></section>
          <section className="card sec-card"><h2 className="card-title mb-12">Payment</h2>
            <div className="seg seg-block">{D.paymentMethods.map((m) => <button type="button" key={m.id} className={s.prefs.payment === m.id ? "is-on" : ""} onClick={() => actions.setPrefs({ payment: m.id })}>{m.label}</button>)}</div>
            <p className="small muted mt-12">{(D.paymentMethods.find((m) => m.id === s.prefs.payment) || { detail: "" }).detail} is used by default at checkout.</p></section>
          <section className="card sec-card"><h2 className="card-title mb-12">Saved places</h2>
            {s.savedPlaces.map((p) => (
              <div key={p.id} className="field mb-12"><label className="lbl" htmlFor={`sp-${p.id}`}><Icon name={p.label === "Home" ? "house" : "briefcase"} size={14} /> {p.label}</label>
                <select className="select" id={`sp-${p.id}`} value={p.destId} onChange={(e) => { actions.setSavedPlace(p.id, e.target.value); toast("Saved place updated", "ok"); }}>{D.destinations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
            ))}</section>
        </div>
        <div className="stack-24">
          <section className="card sec-card"><h2 className="card-title mb-8">Notifications</h2>
            <Switch label="Booking reminders" sub="1 hour before entry and 15 minutes before exit" on={nx.reminders} onChange={nf("reminders")} />
            <Switch label="Booking updates" sub="Confirmations, changes and refunds" on={nx.updates} onChange={nf("updates")} />
            <Switch label="Price alerts" sub="From your saved searches" on={nx.priceAlerts} onChange={nf("priceAlerts")} />
            <Switch label="Space alerts" sub="When saved spots free up" on={nx.availability} onChange={nf("availability")} /></section>
          <section className="card sec-card"><h2 className="card-title mb-8">Display</h2>
            <Switch label="Larger text" sub="Easier to read" on={s.prefs.largeText} onChange={pf("largeText")} />
            <Switch label="Reduce motion" sub="Turns off moving effects" on={s.prefs.reduceMotion} onChange={pf("reduceMotion")} /></section>
          {showDev && (
            <section className="card sec-card dev" ref={devRef}>
              <div className="card-head"><h2 className="card-title"><Icon name="sliders-horizontal" size={17} /> Developer options</h2><Badge tone="warn">Demo only</Badge></div>
              <div className="row-between mb-16"><div><div className="lbl">Test clock</div><div className="dev-clock mt-4">{dayLabel(t)}, {timeLabel(t)}</div>
                <div className={`tiny mono mt-4 ${off ? "t-warn" : "muted"}`}>{off ? `${off > 0 ? "+" : "−"}${durationShort(Math.abs(off))} from real time` : "Real time"}</div></div></div>
              <div className="chip-row mb-16">
                {[[30, "+30 min"], [60, "+1 hour"], [180, "+3 hours"]].map(([m, l]) => <button type="button" key={m} className="chip chip-sm" onClick={() => { actions.advanceClock(+m); toast(`Clock moved ${durationShort(+m)} ahead`, "info"); }}>{l}</button>)}
                <button type="button" className="chip chip-sm" onClick={() => { const r = actions.jumpToNextEvent(); toast(r || "No upcoming or active booking to jump to", r ? "info" : "warn"); }}>Jump to 10 min before next event</button>
                <button type="button" className="chip chip-sm" onClick={() => { actions.setClockOffset(0); toast("Back to real time", "info"); }}>Back to real time</button>
              </div>
              <Switch label="Fail the next payment" sub="Checkout will show the payment-failed screen once" on={s.demo.nextPaymentFails}
                onChange={(v) => { actions.setDemo({ nextPaymentFails: v }); toast(v ? "The next payment will fail" : "Payments work normally", "info"); }} />
              <div className="row gap-8 mt-12">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => { actions.refreshAvailability(); toast("Availability refreshed", "ok"); }}><Icon name="refresh-cw" size={15} />Refresh availability</button>
                <button type="button" className="btn btn-danger btn-sm" onClick={reset}><Icon name="rotate-ccw" size={15} />Reset all data</button>
              </div>
            </section>
          )}
          <section className="card sec-card"><h2 className="card-title mb-4">Help</h2>
            {FAQ.map(([q, a]) => <details key={q} className="faq"><summary>{q}<Icon name="chevron-down" size={16} /></summary><p>{a}</p></details>)}</section>
          <section className="card sec-card row-between">
            <div className="row gap-16 small"><button type="button" className="link" onClick={() => doc("terms")}>Terms of use</button><button type="button" className="link" onClick={() => doc("privacy")}>Privacy</button></div>
            <span className="mono tiny muted ver" onClick={tapVer} title="Tap 5 times for developer options">PARKLY v1.0 (desktop)</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={signInOut}><Icon name={s.user.guest ? "user" : "log-out"} size={15} />{s.user.guest ? "Sign in" : "Sign out"}</button>
          </section>
        </div>
      </div></div>
    </>
  );
}
export default function Profile() { return <DesktopShell><ProfileView /></DesktopShell>; }
