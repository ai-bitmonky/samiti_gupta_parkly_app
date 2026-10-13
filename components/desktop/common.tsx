"use client";
/* Shared desktop pieces (prototype desktop.html "small helpers" + "shared pieces"):
   money helpers, count-up, the Where combobox, the When modal + button, the top bar, empty state,
   vehicle / calendar / pass modals, and a few engine shortcuts that read the live state. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import {
  D, HOUR, MIN, TIMES, addDays, at, ceilHalfHour, calendarLinks, dateKey, dayLabel, defaultVehicle, destination, distKm,
  downloadFile, durationShort, now as engNow, quote, reducedMotion, searchCenter, searchFacilities, measure, startOfDay,
  time12, timeKey, timeLabel, unreadCount, validPlate, windowLabel,
} from "@/lib/engine";
import type { AppState, Booking, Facility, Vehicle, VehicleType } from "@/lib/data";
import type { Result } from "@/lib/engine";
import Icon from "@/components/shared/Icon";
import Dial from "@/components/shared/Dial";
import Pass from "@/components/shared/Pass";
import { Modal } from "@/components/shared/Overlay";
import { useToast } from "@/components/shared/ToastProvider";
import { useModal } from "./DesktopShell";

/* ── small helpers ── */
export const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const ms = (t: string | number) => +new Date(t);
export const win = (st: AppState) => ({ s: ms(st.search.start), e: ms(st.search.end) });
export const durMin = (st: AppState) => { const w = win(st); return Math.round((w.e - w.s) / MIN); };
export const vtype = (st: AppState): VehicleType => defaultVehicle(st).type;
export const totalFor = (f: Facility, s: number, hours: number, vt: VehicleType) => quote({ facility: f, start: s, end: s + hours * HOUR, mode: "hourly", vehicleType: vt }).total;
export const dayTotal = (f: Facility, s: number, vt: VehicleType) =>
  f.dailyRate ? quote({ facility: f, start: s, end: s + 24 * HOUR, mode: "daily", vehicleType: vt }).total : totalFor(f, s, 24, vt);
export function windowQuote(st: AppState, f: Facility, vt = vtype(st)) {
  const w = win(st), mode = st.search.mode === "daily" && f.dailyRate ? "daily" : "hourly";
  return quote({ facility: f, start: w.s, end: w.e, mode, vehicleType: vt });
}
export function measureAll(st: AppState): Result[] {
  const r = searchFacilities(st).results;
  return D.facilities.map((f) => r.find((x) => x.f.id === f.id) || measure(f, st.search, st.bookings, st.demo.seed, vtype(st)));
}
export const nearestDest = (f: Facility) => {
  const d = [...D.destinations].sort((a, b) => distKm(a, f) - distKm(b, f))[0];
  return { lat: d.lat, lng: d.lng, name: d.name, area: d.area };
};
export const methodLabel = (id: string) => (D.paymentMethods.find((m) => m.id === id) || { label: id }).label;
export function i18day(d: number) {
  const t = startOfDay(engNow());
  return d === t ? "Today" : d === addDays(t, 1) ? "Tmrw" : new Date(d).toLocaleDateString("en-IN", { weekday: "short" });
}
export const nextDays = (n = 10) => Array.from({ length: n }, (_, i) => addDays(startOfDay(engNow()), i));

/** "₹136" with a small rupee sign (.cur) */
export function Rup({ n }: { n: number }) {
  return <><span className="cur">₹</span>{Math.round(n).toLocaleString("en-IN")}</>;
}
/** Price count-up on first paint (700 ms, from 55 %); plain value with reduced motion or animate=false. */
export function CountRup({ to, className = "num", style, animate = true, ms: dur = 700 }: { to: number; className?: string; style?: React.CSSProperties; animate?: boolean; ms?: number }) {
  const [v, setV] = useState(to);
  useEffect(() => {
    if (!animate || reducedMotion()) { setV(to); return; }
    const t0 = performance.now(), from = Math.round(to * 0.55);
    let raf = 0;
    const step = (t: number) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); setV(from + (to - from) * e); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, animate, dur]);
  return <span className={className} style={style}><Rup n={v} /></span>;
}

export function EmptyState({ ico, title, children, action }: { ico: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-ico"><Icon name={ico} size={28} /></div>
      <h3>{title}</h3>
      <p className="small" style={{ maxWidth: 380 }}>{children}</p>
      {action}
    </div>
  );
}

/* ── Where combobox: destinations, Near me, saved places, recents ── */
interface Opt { k: string; ico: string; name: string; sub: string }
export function WhereBox({ className = "", placeholder = "Where are you going?", onPick }: { className?: string; placeholder?: string; onPick?: () => void }) {
  const { state, actions } = useApp();
  const toast = useToast();
  const center = searchCenter(state.search);
  const [text, setText] = useState<string | null>(null); // null = not editing → show the centre name
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const inp = useRef<HTMLInputElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const q = (text ?? "").trim().toLowerCase(), typing = !!q && q !== center.name.toLowerCase();
  const groups = useMemo<[string, Opt[]][]>(() => {
    const dests = D.destinations.filter((d) => !typing || (d.name + " " + d.area).toLowerCase().includes(q));
    if (typing) return [["Places", dests.map((d) => ({ k: d.id, ico: "map-pin", name: d.name, sub: `${d.area} · ${d.kind || ""}` }))]];
    const g: [string, Opt[]][] = [["", [{ k: "near", ico: "locate-fixed", name: "Near me", sub: "Use my location" }]]];
    g.push(["Saved places", state.savedPlaces.map((p) => { const d = destination(p.destId); return { k: p.destId, ico: p.label === "Home" ? "house" : "briefcase", name: p.label, sub: d ? d.name : "" }; })]);
    const rec = state.recentDest.map(destination).filter(Boolean) as NonNullable<ReturnType<typeof destination>>[];
    if (rec.length) g.push(["Recent", rec.map((d) => ({ k: d.id, ico: "clock", name: d.name, sub: d.area }))]);
    g.push(["All places", dests.map((d) => ({ k: d.id, ico: "map-pin", name: d.name, sub: d.area }))]);
    return g;
  }, [typing, q, state.savedPlaces, state.recentDest]);
  const opts = groups.flatMap((g) => g[1]);
  const cur = clamp(idx, 0, Math.max(0, opts.length - 1));
  useEffect(() => { if (open) pop.current?.querySelector(".is-act")?.scrollIntoView({ block: "nearest" }); }, [cur, open]);

  const close = () => { setOpen(false); setText(null); };
  const pick = (i: number) => {
    const o = opts[i];
    if (!o) return;
    if (o.k === "near") { actions.nearMe(); toast("Using your location: Mandi House", "info"); } else actions.setDestination(o.k);
    close(); inp.current?.blur();
    onPick?.();
  };
  let n = 0;
  return (
    <div className={`where ${className}`.trim()}>
      <Icon name="map-pin" size={18} />
      <input
        ref={inp} className="input js-where" autoComplete="off" spellCheck={false} placeholder={placeholder} aria-label="Destination"
        role="combobox" aria-expanded={open} aria-controls="where-pop" aria-autocomplete="list"
        value={text ?? center.name}
        onFocus={(e) => { e.currentTarget.select(); setText(center.name); setIdx(0); setOpen(true); }}
        onChange={(e) => { setText(e.target.value); setIdx(0); setOpen(true); }}
        onBlur={() => window.setTimeout(close, 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setIdx(Math.min(opts.length - 1, cur + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setIdx(Math.max(0, cur - 1)); }
          else if (e.key === "Enter") { e.preventDefault(); pick(cur); }
          else if (e.key === "Escape") { e.stopPropagation(); close(); inp.current?.blur(); }
        }}
      />
      <kbd>/</kbd>
      {open && (
        <div className="where-pop" role="listbox" id="where-pop" ref={pop} onMouseDown={(e) => e.preventDefault()}>
          {opts.length ? groups.filter((g) => g[1].length).map(([t, list]) => (
            <div key={t || "top"}>
              {t && <div className="where-grp lbl">{t}</div>}
              {list.map((o) => {
                const i = n++;
                return (
                  <button key={t + o.k + o.name} type="button" role="option" aria-selected={i === cur} className={`where-opt${i === cur ? " is-act" : ""}`} onClick={() => pick(i)}>
                    <Icon name={o.ico} size={16} /><span>{o.name}<small>{o.sub}</small></span>
                  </button>
                );
              })}
            </div>
          )) : <div className="p-16 small muted">No place matches “{text}”. Try Connaught Place, Saket or Airport.</div>}
        </div>
      )}
    </div>
  );
}

/* ── When modal: day strip + Enter after + quick lengths + dial ── */
export function WhenModal({ open, close, onDone }: { open: boolean; close: () => void; onDone?: () => void }) {
  const { state, actions } = useApp();
  const [init] = useState(() => { const w = win(state); return { day: startOfDay(w.s), tk: timeKey(w.s), dur: clamp(Math.round((w.e - w.s) / MIN), 30, 1440) }; });
  const [day, setDay] = useState(init.day);
  const [tkRaw, setTk] = useState(init.tk);
  const [dur, setDur] = useState(init.dur);
  const days = useMemo(() => nextDays(), []);
  const times = TIMES.filter((t) => at(dateKey(day), t).getTime() >= ceilHalfHour(engNow()) || startOfDay(engNow()) !== day);
  const tk = times.includes(tkRaw) ? tkRaw : times[0] || "10:00";
  const s = at(dateKey(day), tk).getTime(), e = s + dur * MIN;
  const ok = () => { actions.setSearch({ start: s, end: e }); close(); onDone?.(); };
  return (
    <Modal open={open} onClose={close} title="When do you need parking?" size="lg"
      footer={<><button type="button" className="btn btn-ghost btn-md" data-close>Cancel</button><button type="button" className="btn btn-primary btn-md" onClick={ok}>Show parking for this time</button></>}>
      <div className="when-grid">
        <div className="stack-16">
          <div><div className="lbl mb-8">Day</div>
            <div className="datestrip">{days.map((d) => <button type="button" key={d} className={d === day ? "is-on" : ""} onClick={() => setDay(d)}><small>{i18day(d)}</small><b>{new Date(d).getDate()}</b></button>)}</div>
          </div>
          <div className="field"><label className="lbl" htmlFor="w-tk">Enter after</label>
            <select className="select" id="w-tk" value={tk} onChange={(ev) => setTk(ev.target.value)}>{times.map((t) => <option key={t} value={t}>{time12(t)}</option>)}</select>
          </div>
          <div><div className="lbl mb-8">How long</div>
            <div className="chip-row">{[1, 2, 3, 4, 6, 8, 12].map((x) => <button type="button" key={x} className={`chip chip-sm${x * 60 === dur ? " is-on" : ""}`} onClick={() => setDur(x * 60)}>{x} h</button>)}</div>
          </div>
          <div className="notice notice-info"><Icon name="clock" size={16} /><span>Enter after <b className="mono">{dayLabel(s)} {timeLabel(s)}</b> · exit before <b className="mono">{timeLabel(e)}</b>{dayLabel(e) !== dayLabel(s) ? " " + dayLabel(e) : ""}</span></div>
        </div>
        <div><Dial value={dur} onChange={setDur} minMin={30} maxMin={1440} stepMin={30} startMs={s} /><p className="tiny muted center mt-8">Drag the knob, or use the arrow keys</p></div>
      </div>
    </Modal>
  );
}
export function useOpenWhen() {
  const openModal = useModal();
  return useCallback((onDone?: () => void) => openModal(({ open, close }) => <WhenModal open={open} close={close} onDone={onDone} />), [openModal]);
}
export function WhenButton() {
  const { state } = useApp();
  const openWhen = useOpenWhen();
  const w = win(state);
  return (
    <button className="whenbtn" type="button" onClick={() => openWhen()}>
      <Icon name="calendar-clock" size={18} /><b>{windowLabel(w.s, w.e)}</b><span className="badge badge-lime">{durationShort(durMin(state))}</span>
    </button>
  );
}

/* ── top bar ── */
export function useBack(fallback = "/explore") {
  const router = useRouter();
  return useCallback(() => { if (typeof window !== "undefined" && window.history.length > 1) router.back(); else router.push(fallback); }, [router, fallback]);
}
export function Topbar({ back, title, sub, left, right, noSearch }: { back?: boolean; title?: ReactNode; sub?: ReactNode; left?: ReactNode; right?: ReactNode; noSearch?: boolean }) {
  const { state } = useApp();
  const router = useRouter();
  const pathname = usePathname() || "";
  const goBack = useBack();
  const unread = unreadCount(state);
  const onPick = () => { if (!pathname.startsWith("/explore") && !pathname.startsWith("/map")) router.push("/explore"); };
  return (
    <header className="dtop">
      {back && <button type="button" className="btn btn-ghost btn-icon btn-md" onClick={goBack} aria-label="Back"><Icon name="arrow-left" size={20} /></button>}
      {left || <div className="dtop-title">{title}{sub && <small>{sub}</small>}</div>}
      <span className="spacer" />
      {right}
      {!noSearch && <WhereBox className="where-sm" placeholder="Search parking" onPick={onPick} />}
      <Link className="icon-btn" href="/notifications" aria-label="Notifications"><Icon name="bell" size={20} />{unread ? <span className="dot-count">{unread}</span> : null}</Link>
    </header>
  );
}

/* ── vehicle add / edit ── */
export function VehicleModal({ open, close, vehicle, onSaved }: { open: boolean; close: () => void; vehicle?: Vehicle; onSaved?: (v: Vehicle) => void }) {
  const { actions } = useApp();
  const toast = useToast();
  const isNew = !vehicle;
  const v0 = vehicle || { name: "", plate: "", type: "hatchback" as VehicleType };
  const [name, setName] = useState(v0.name);
  const [plate, setPlate] = useState(v0.plate);
  const [type, setType] = useState<VehicleType>(v0.type);
  const [err, setErr] = useState("");
  const go = (e?: React.FormEvent) => {
    e?.preventDefault();
    const r = actions.upsertVehicle({ ...(vehicle || {}), name, plate, type });
    if (!r.ok) { setErr(r.error); return; }
    close(); toast(isNew ? `${r.value.name} added` : "Vehicle updated", "ok"); onSaved?.(r.value);
  };
  const plateBad = !!err && /format/.test(err);
  return (
    <Modal open={open} onClose={close} title={isNew ? "Add a vehicle" : "Edit vehicle"} size="sm"
      footer={<><button type="button" className="btn btn-ghost btn-md" data-close>Cancel</button><button type="button" className="btn btn-primary btn-md" onClick={() => go()}>{isNew ? "Add vehicle" : "Save"}</button></>}>
      <form className="stack-16" autoComplete="off" onSubmit={go}>
        <div className="field"><label className="field-label" htmlFor="vm-n">Name</label><input className="input" id="vm-n" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dad's Innova" /></div>
        <div className="field"><label className="field-label" htmlFor="vm-p">Number plate</label>
          <input className={`input input-mono${plateBad ? " is-invalid" : validPlate(plate) ? " is-valid" : ""}`} id="vm-p" value={plate} onChange={(e) => { setPlate(e.target.value); setErr(""); }} placeholder="DL 8C AF 4521" />
          <span className="field-hint">State code, district number, letters, then 4 digits.</span></div>
        <div className="field"><span className="field-label">Type</span>
          <div className="chip-row">{D.vehicleTypes.map((t) => <button type="button" key={t} className={`chip chip-sm${t === type ? " is-on" : ""}`} onClick={() => setType(t)}>{D.vehicleLabels[t]}</button>)}</div></div>
        {err && <div className="field-error"><Icon name="circle-x" size={14} />{err}</div>}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}

/* ── add to calendar ── */
export function CalendarModal({ open, close, booking: b, facility: f }: { open: boolean; close: () => void; booking: Booking; facility: Facility }) {
  const toast = useToast();
  const c = calendarLinks(b, f);
  const ics = () => { downloadFile(`parkly-${b.ref}.ics`, c.ics, "text/calendar"); toast("Calendar file downloaded", "ok"); close(); };
  const copy = () => {
    const t = `PARKLY ${b.ref}\n${f.name}, ${b.bay}\n${windowLabel(b.start, b.end)}\n${f.address}`;
    try { navigator.clipboard.writeText(t).then(() => toast("Copied", "ok"), () => toast("Couldn't copy. Select the text instead.", "warn")); } catch { toast("Couldn't copy", "warn"); }
    close();
  };
  return (
    <Modal open={open} onClose={close} title="Add to calendar" size="sm">
      <div className="stack-8">
        <a className="list-row card" href={c.google} target="_blank" rel="noopener noreferrer"><span className="ico-wrap"><Icon name="calendar-plus" size={18} /></span><span className="grow"><b>Google Calendar</b><br /><span className="tiny muted">Opens in a new tab</span></span><Icon name="arrow-up-right" size={16} className="chev" /></a>
        <button type="button" className="list-row card" onClick={ics}><span className="ico-wrap"><Icon name="download" size={18} /></span><span className="grow"><b>Apple / Outlook (.ics)</b><br /><span className="tiny muted">Download a calendar file</span></span></button>
        <button type="button" className="list-row card" onClick={copy}><span className="ico-wrap"><Icon name="copy" size={18} /></span><span className="grow"><b>Copy details</b><br /><span className="tiny muted">Paste into any app</span></span></button>
      </div>
    </Modal>
  );
}

/* ── boarding pass modal ── */
export function PassModal({ open, close, id }: { open: boolean; close: () => void; id: string }) {
  const { state, now } = useApp();
  const b = state.bookings.find((x) => x.id === id);
  return (
    <Modal open={open} onClose={close} title="Your pass" size="md">
      {b && <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 8px" }}><Pass booking={b} now={now} printing variant="desktop" /></div>}
    </Modal>
  );
}
