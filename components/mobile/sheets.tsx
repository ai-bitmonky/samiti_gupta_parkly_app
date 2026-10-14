"use client";
/* PARKLY mobile · sheets.tsx — the shared bottom sheets (prototype mobile.html "SHARED SHEETS").
   All are built on components/shared/Overlay <Sheet> (grabber + drag down to dismiss on body.m).

   Host:   const openSheet = useSheet();
           const close = openSheet(({ open, close }) => <TimeSheet open={open} onClose={close} onApply={…} />);
           (mounted by MobileShell; every sheet gets fresh state each time it opens)
   Sheets (all take open + onClose):
     <TimeSheet title? start? end? mode? onApply?({start,end,mode})/>   wheel (day + time) + quick lengths + dial;
                                                                        default onApply = actions.setSearch
     <DestSheet/>                    destination search (Near me, saved places, recent, popular)
     <FilterSheet/>                  price slider, distance, type, security, rating, switches, live "Show N results"
     <SortSheet/>                    sort action sheet
     <VehicleSheet vehicle? onSaved?(v)/>   add / edit a vehicle (Indian plate validation, live preview)
     <CalendarSheet booking/>        Google Calendar / .ics / copy details
   Declarative use (<TimeSheet open={x} …/>) also works: state resets each time `open` turns true. */
import { Fragment, createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useApp } from "@/lib/store";
import {
  D, MIN, TIMES, addDays, at, calendarLinks, ceilHalfHour, dateKey, dateLabel, destination, downloadFile, durationLabel,
  facility, normPlate, now as engNow, searchFacilities, startOfDay, time12, timeKey, validPlate, windowLabel,
} from "@/lib/engine";
import type { Booking, BookingMode, Filters, Vehicle, VehicleType } from "@/lib/data";
import Icon from "@/components/shared/Icon";
import Dial from "@/components/shared/Dial";
import Plate from "@/components/shared/Plate";
import { Sheet } from "@/components/shared/Overlay";
import { useToast } from "@/components/shared/ToastProvider";
import { Seg, W, Wheel } from "./kit";
import type { WheelCol } from "./kit";

/* ───────────── host ───────────── */
export type SheetRender = (p: { open: boolean; close: () => void }) => ReactNode;
type OpenSheet = (r: SheetRender) => () => void;
const SheetCtx = createContext<OpenSheet | null>(null);
export function useSheet(): OpenSheet {
  const c = useContext(SheetCtx);
  return c || (() => () => {});
}
export function SheetHost({ children }: { children?: ReactNode }) {
  const [items, setItems] = useState<{ id: number; render: SheetRender; open: boolean }[]>([]);
  const seq = useRef(0);
  const close = useCallback((id: number) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, open: false } : x)));
    window.setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 300);
  }, []);
  const open = useCallback<OpenSheet>((render) => {
    const id = ++seq.current;
    setItems((xs) => [...xs, { id, render, open: true }]);
    return () => close(id);
  }, [close]);
  return (
    <SheetCtx.Provider value={open}>
      {children}
      {items.map((it) => <Fragment key={it.id}>{it.render({ open: it.open, close: () => close(it.id) })}</Fragment>)}
    </SheetCtx.Provider>
  );
}

/** Remount the sheet's contents each time it opens (fresh local state for declarative use). */
function useOpenKey(open: boolean) {
  const st = useRef({ open, n: 0 });
  if (open && !st.current.open) st.current.n++;
  st.current.open = open;
  return st.current.n;
}
interface Base { open: boolean; onClose: () => void }

/* ───────────── time window ───────────── */
function dayItems(n = 14) {
  const d0 = startOfDay(engNow());
  return Array.from({ length: n }, (_, i) => { const d = addDays(d0, i); return { v: dateKey(d), label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : dateLabel(d) }; });
}
const timeItems = (dk: string) => TIMES.map((t) => ({ v: t, label: time12(t), past: at(dk, t).getTime() < engNow() - MIN }));

export interface TimeSheetProps extends Base {
  title?: string;
  start?: number;
  end?: number;
  mode?: BookingMode;
  onApply?: (w: { start: number; end: number; mode: BookingMode }) => void;
}
export function TimeSheet(p: TimeSheetProps) {
  const k = useOpenKey(p.open);
  return <TimeSheetInner key={k} {...p} />;
}
function TimeSheetInner({ open, onClose, title, start, end, mode: mode0, onApply }: TimeSheetProps) {
  const { state, actions } = useApp();
  const [init] = useState(() => {
    const w = W(state), s = start ?? w.s, e = end ?? w.e, m = mode0 || w.mode;
    let dur = Math.max(30, Math.round((e - s) / MIN));
    if (m === "daily") dur = Math.max(1440, Math.round(dur / 1440) * 1440);
    return { dk: dateKey(s), tk: timeKey(ceilHalfHour(s)), mode: m, dur };
  });
  const [dk, setDk] = useState(init.dk);
  const [tk, setTk] = useState(init.tk);
  const [mode, setMode] = useState<BookingMode>(init.mode);
  const [dur, setDur] = useState(init.dur);
  const days = useMemo(() => dayItems(), []);
  const times = useMemo(() => timeItems(dk), [dk]);
  const cols = useMemo<WheelCol[]>(() => [{ items: days, value: dk, wide: true, label: "Day" }, { items: times, value: tk, wide: true, label: "Time" }], [days, times, dk, tk]);
  const startMs = at(dk, tk).getTime();
  const past = startMs < engNow() - MIN;
  const quick = mode === "hourly" ? [60, 120, 180, 240, 360, 480] : [1440, 2880, 4320, 7200];
  const apply = () => {
    onClose();
    const w = { start: startMs, end: startMs + dur * MIN, mode };
    if (onApply) onApply(w); else actions.setSearch(w);
  };
  return (
    <Sheet open={open} onClose={onClose} title={title || "When are you parking?"} kind="sheet"
      footer={<button type="button" className="btn btn-primary btn-lg btn-block" onClick={apply} disabled={past}>{past ? "Pick a later time" : `Show parking for ${durationLabel(dur / 60)}`}</button>}>
      <Seg block className="mb-16" value={mode} ariaLabel="Booking mode"
        options={[{ value: "hourly", label: "By the hour" }, { value: "daily", label: "By the day" }]}
        onChange={(m) => { setMode(m); setDur(m === "daily" ? 1440 : 120); }} />
      <div className="group-label">Enter after</div>
      <Wheel cols={cols} onChange={(v) => { setDk(v[0]); setTk(v[1]); }} />
      <div className="group-label mt-24">How long</div>
      <div className="chip-scroll mb-12">
        {quick.map((m) => (
          <button type="button" key={m} className={`chip${m === dur ? " is-on" : ""}`} onClick={() => setDur(m)}>
            {mode === "hourly" ? m / 60 + " h" : m / 1440 + (m === 1440 ? " day" : " days")}
          </button>
        ))}
      </div>
      {mode === "hourly"
        ? <Dial key="h" size="sm" value={dur} onChange={setDur} minMin={30} maxMin={1440} stepMin={30} startMs={startMs} />
        : <Dial key="d" size="sm" value={dur} onChange={setDur} minMin={1440} maxMin={10080} stepMin={1440} label="Days" startMs={startMs} />}
      <div className="mt-12">
        {past && <div className="notice notice-warn"><Icon name="triangle-alert" size={16} /><span>That time has already passed. Pick a later entry time.</span></div>}
      </div>
    </Sheet>
  );
}

/* ───────────── destination search ───────────── */
export function DestSheet(p: Base) {
  const k = useOpenKey(p.open);
  return <DestSheetInner key={k} {...p} />;
}
function DestSheetInner({ open, onClose }: Base) {
  const { state: st, actions } = useApp();
  const toast = useToast();
  const [q, setQ] = useState("");
  const t = q.trim().toLowerCase();
  const pick = (id: string) => { actions.setDestination(id); onClose(); };
  const row = (d: (typeof D.destinations)[number], ic: string, extra = "", key = d.id) => (
    <button type="button" key={key} className="grow-row" role="option" aria-selected={false} onClick={() => pick(d.id)}>
      <span className="ri"><Icon name={ic} size={16} /></span>
      <span className="lbl">{extra || d.name}<small>{extra ? d.name : d.area + " · " + d.kind}</small></span>
    </button>
  );
  let list: ReactNode;
  if (t) {
    const hits = D.destinations.filter((d) => (d.name + " " + d.area + " " + d.kind).toLowerCase().includes(t));
    list = hits.length ? <div className="group">{hits.map((d) => row(d, "map-pin"))}</div>
      : <p className="small muted center p-16">No match for “{q}”. Try Khan Market or Saket.</p>;
  } else {
    const recent = st.recentDest.map((id) => destination(id)).filter(Boolean) as (typeof D.destinations)[number][];
    list = (
      <>
        <div className="group mb-16">
          <button type="button" className="grow-row" onClick={() => { actions.nearMe(); onClose(); toast("Using your location near Mandi House", "info"); }}>
            <span className="ri lime"><Icon name="locate-fixed" size={16} /></span><span className="lbl">Near me<small>Use my current location</small></span>
          </button>
          {st.savedPlaces.map((sp) => { const d = destination(sp.destId); return d ? row(d, sp.label === "Home" ? "house" : "briefcase", sp.label, "sp-" + sp.id) : null; })}
        </div>
        <div className="group-label">Recent</div>
        <div className="group mb-16">{recent.map((d) => row(d, "clock"))}</div>
        <div className="group-label">Popular in Delhi NCR</div>
        <div className="group">{D.destinations.filter((d) => !st.recentDest.includes(d.id)).map((d) => row(d, "map-pin"))}</div>
      </>
    );
  }
  return (
    <Sheet open={open} onClose={onClose} title="Where are you going?" kind="sheet">
      <div className="input-wrap mb-16">
        <Icon name="search" size={18} />
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a place, market or landmark" autoComplete="off"
          role="combobox" aria-expanded="true" aria-controls="dest-list" />
      </div>
      <div id="dest-list" role="listbox">{list}</div>
    </Sheet>
  );
}

/* ───────────── filters (live “Show N results”) ───────────── */
export function FilterSheet(p: Base) {
  const k = useOpenKey(p.open);
  return <FilterSheetInner key={k} {...p} />;
}
type ChipVal = string | number;
function FilterSheetInner({ open, onClose }: Base) {
  const { state, actions } = useApp();
  const [f, setF] = useState<Filters>(() => JSON.parse(JSON.stringify(state.search.filters)));
  const n = useMemo(() => searchFacilities(state, { search: { ...state.search, filters: f } }).results.length, [state, f]);
  const fr = f as unknown as Record<string, ChipVal | ChipVal[] | boolean>;
  const chipset = (key: keyof Filters, opts: [ChipVal, string][], multi = false) => (
    <div className="chip-row">
      {opts.map(([v, l]) => {
        const cur = fr[key];
        const on = multi ? (cur as ChipVal[]).includes(v) : cur === v;
        return (
          <button type="button" key={String(v)} className={`chip${on ? " is-on" : ""}`} onClick={() => setF((x) => {
            const c = (x as unknown as Record<string, ChipVal | ChipVal[]>)[key];
            const next = multi ? ((c as ChipVal[]).includes(v) ? (c as ChipVal[]).filter((y) => y !== v) : [...(c as ChipVal[]), v]) : v;
            return { ...x, [key]: next } as Filters;
          })}>{l}</button>
        );
      })}
    </div>
  );
  const sw = (key: keyof Filters, label: string, sub: string) => (
    <label className="grow-row no-press">
      <span className="lbl">{label}<small>{sub}</small></span>
      <span className="switch"><input type="checkbox" checked={!!fr[key]} onChange={(e) => { const c = e.target.checked; setF((x) => ({ ...x, [key]: c })); }} /><span className="switch-track" /></span>
    </label>
  );
  const price = f.maxPrice || 200;
  return (
    <Sheet open={open} onClose={onClose} title="Filters" kind="sheet"
      footer={<>
        <button type="button" className="btn btn-secondary btn-lg" style={{ flex: "0 0 auto" }} onClick={() => { onClose(); actions.resetFilters(); }}>Reset</button>
        <button type="button" className="btn btn-primary btn-lg" disabled={!n} onClick={() => { onClose(); actions.setFilters(f); }}>{n ? `Show ${n} result${n > 1 ? "s" : ""}` : "No results, loosen filters"}</button>
      </>}>
      <div className="group-label">Max price per hour</div>
      <div className="card card-pad mb-24">
        <div className="row-between mb-8"><span className="small muted">{f.maxPrice ? "Up to" : "No limit set"}</span><b className="mono">{f.maxPrice ? `₹${f.maxPrice}/h` : "Any"}</b></div>
        <input type="range" className="range" min={0} max={200} step={10} value={price} aria-label="Maximum price per hour"
          style={{ ["--p" as string]: (price / 200) * 100 + "%" }}
          onChange={(e) => { const v = +e.target.value; setF((x) => ({ ...x, maxPrice: v >= 200 ? 0 : v })); }} />
      </div>
      <div className="group-label">Distance from destination</div>
      {chipset("maxDistance", [[1, "1 km"], [2, "2 km"], [3, "3 km"], [5, "5 km"], [10, "10 km"], [0, "Any"]])}
      <div className="group-label mt-24">Type of parking</div>
      {chipset("types", Object.entries(D.typeLabels), true)}
      <div className="group-label mt-24">Security</div>
      {chipset("security", Object.entries(D.securityLabels), true)}
      <div className="group-label mt-24">Rating</div>
      {chipset("minRating", [[0, "Any"], [3.5, "3.5★ +"], [4, "4★ +"], [4.5, "4.5★ +"]])}
      <div className="group mt-24">
        {sw("onlyAvailable", "Available for my time", "Hide places that are full")}
        {sw("ev", "EV charging", "Chargers you can reserve")}
        {sw("accessible", "Accessible bays", "Step-free, wider bays")}
        {sw("motorcycle", "Two-wheeler bays", "Bikes and scooters")}
        {sw("overnight", "Overnight parking", "Stay past midnight")}
        {sw("instant", "Instant booking", "Confirmed right away")}
      </div>
    </Sheet>
  );
}

/* ───────────── sort ───────────── */
export function SortSheet({ open, onClose }: Base) {
  const { state, actions } = useApp();
  const cur = state.search.sort;
  return (
    <Sheet open={open} onClose={onClose} title="Sort results" kind="sheet">
      <div className="act-list">
        {(Object.entries(D.sortLabels) as [typeof cur, string][]).map(([k, l]) => (
          <button type="button" key={k} className="list-row" onClick={() => { onClose(); actions.setSearch({ sort: k }); }}>
            <span className="grow">{l}</span>{k === cur ? <Icon name="check" size={20} className="check-mark" /> : null}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/* ───────────── add / edit vehicle ───────────── */
export interface VehicleSheetProps extends Base { vehicle?: Vehicle; onSaved?: (v: Vehicle) => void }
export function VehicleSheet(p: VehicleSheetProps) {
  const k = useOpenKey(p.open);
  return <VehicleSheetInner key={k} {...p} />;
}
function VehicleSheetInner({ open, onClose, vehicle, onSaved }: VehicleSheetProps) {
  const { actions } = useApp();
  const toast = useToast();
  const isNew = !vehicle;
  const v0 = vehicle || { name: "", plate: "", type: "hatchback" as VehicleType, color: "" };
  const [name, setName] = useState(v0.name);
  const [plate, setPlate] = useState(v0.plate);
  const [color, setColor] = useState(v0.color || "");
  const [type, setType] = useState<VehicleType>(v0.type);
  const [err, setErr] = useState("");
  const plateHint = plate.length > 6 && !validPlate(plate);
  const save = () => {
    const r = actions.upsertVehicle({ ...(vehicle || {}), name: name.trim(), plate, color: color.trim(), type });
    if (!r.ok) { setErr(r.error); return; }
    onClose(); toast(isNew ? "Vehicle added" : "Vehicle saved", "ok"); onSaved?.(r.value);
  };
  return (
    <Sheet open={open} onClose={onClose} title={isNew ? "Add a vehicle" : "Edit vehicle"} kind="sheet"
      footer={<button type="button" className="btn btn-primary btn-lg btn-block" onClick={save}>{isNew ? "Add vehicle" : "Save changes"}</button>}>
      <div className="group-label">Details</div>
      <div className="group mb-16">
        <label className="grow-row no-press"><span className="lbl">Name</span><input className="row-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Dad's Innova" maxLength={30} /></label>
        <label className="grow-row no-press"><span className="lbl">Number plate</span>
          <input className="row-input mono" value={plate} onChange={(e) => { setPlate(e.target.value); setErr(""); }} placeholder="DL 8C AF 4521" maxLength={14} autoCapitalize="characters" style={{ textTransform: "uppercase" }} /></label>
        <label className="grow-row no-press"><span className="lbl">Colour</span><input className="row-input" value={color} onChange={(e) => setColor(e.target.value)} placeholder="Optional" /></label>
      </div>
      <div className="group-label">Type</div>
      <div className="chip-row mb-16">
        {D.vehicleTypes.map((t) => <button type="button" key={t} className={`chip${t === type ? " is-on" : ""}`} onClick={() => setType(t)}>{D.vehicleLabels[t]}</button>)}
      </div>
      <div className="row gap-12 mb-8"><span className="small muted">Preview</span><span><Plate plate={normPlate(plate) || "DL 00 XX 0000"} /></span></div>
      <div>
        {err ? <div className="notice notice-danger"><Icon name="circle-x" size={16} /><span>{err}</span></div>
          : plateHint ? <div className="field-error"><Icon name="info" size={14} />Use the Indian format, like DL 8C AF 4521.</div> : null}
      </div>
    </Sheet>
  );
}

/* ───────────── add to calendar ───────────── */
export function CalendarSheet({ open, onClose, booking: b }: Base & { booking: Booking }) {
  const toast = useToast();
  const f = facility(b.facilityId);
  if (!f) return null;
  const l = calendarLinks(b, f);
  const ics = () => { downloadFile(`parkly-${b.ref}.ics`, l.ics, "text/calendar"); onClose(); toast("Calendar file downloaded", "ok"); };
  const copy = () => {
    const txt = `PARKLY ${b.ref}\n${f.name}, ${b.bay}\n${windowLabel(b.start, b.end)}\n${b.vehicle.plate}`;
    try { navigator.clipboard.writeText(txt).then(() => toast("Copied", "ok"), () => toast("Copied", "ok")); } catch { toast("Copied", "ok"); }
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Add to calendar" kind="sheet">
      <div className="act-list">
        <a className="list-row" href={l.google} target="_blank" rel="noopener noreferrer"><span className="ico-wrap"><Icon name="calendar-plus" size={18} /></span><span className="grow">Google Calendar</span><Icon name="arrow-up-right" size={16} className="chev" /></a>
        <button type="button" className="list-row" onClick={ics}><span className="ico-wrap"><Icon name="download" size={18} /></span><span className="grow">Download .ics file<div className="tiny muted">Works with Apple and Outlook</div></span></button>
        <button type="button" className="list-row" onClick={copy}><span className="ico-wrap"><Icon name="copy" size={18} /></span><span className="grow">Copy booking details</span></button>
      </div>
    </Sheet>
  );
}
