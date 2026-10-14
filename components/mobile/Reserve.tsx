"use client";
/* 6 · RESERVE (prototype Screens.reserve): large "Reserve" title with the facility as eyebrow.
   1 Date & time — By the hour / By the day (only where a daily rate exists), 14-day date strip, "Enter after" wheel,
     duration dial (30 min – 24 h) or days dial (1 – 7), live issues under it.
   2 Vehicle — radio cards (types the place does not take are disabled with "Not allowed"), Add a vehicle sheet.
   3 Anything you need? — requirement chips (EV charging +₹49 where chargers exist), note for the attendant (160).
   Summary card (thumb, window, occupancy, bill) and a sticky action bar whose price rolls on every change.
   The draft is kept per facility (survives going to checkout and back, an edge swipe, or re-renders) and dropped
   after a booking. Continue → /checkout/:id?s&e&m&v&req&note (same keys as the desktop Reserve). */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import {
  D, MIN, TIMES, addDays, at, ceilHalfHour, dateKey, durationLabel, facility as getFacility, now as engNow, pickVehicle, quote,
  startOfDay, time12, timeKey, validateBooking, windowLabel,
} from "@/lib/engine";
import type { AppState, BookingMode, Facility } from "@/lib/data";
import Icon from "@/components/shared/Icon";
import Badge from "@/components/shared/Badge";
import Dial from "@/components/shared/Dial";
import Plate from "@/components/shared/Plate";
import OccupancyBar from "@/components/shared/OccupancyBar";
import FacilityIllustration from "@/components/shared/FacilityIllustration";
import { useToast } from "@/components/shared/ToastProvider";
import { Empty, Price, Screen, Seg, Topbar, W, Wheel, useNav } from "./kit";
import type { WheelCol } from "./kit";
import { VehicleSheet, useSheet } from "./sheets";
import { useScreenRoute } from "./route";
import { useScreenTitle } from "./title";
import { MBill } from "./bill";

export interface ReserveDraft { start: number; dur: number; mode: BookingMode; vehicleId: string; reqs: string[]; note: string; picked?: boolean }
/** per facility, survives re-renders and the trip to checkout and back (prototype reserveDraft) */
const reserveDraft: Record<string, ReserveDraft> = {};
export const clearReserveDraft = (fid: string) => { delete reserveDraft[fid]; };

function draftFor(f: Facility, st: AppState): ReserveDraft {
  const w = W(st);
  const d = (reserveDraft[f.id] = reserveDraft[f.id] || {
    start: w.s, dur: Math.round((w.e - w.s) / MIN), mode: w.mode === "daily" && f.dailyRate ? "daily" : "hourly",
    vehicleId: (st.vehicles.find((v) => v.id === st.defaultVehicleId) || st.vehicles[0]).id, reqs: [], note: "",
  });
  if (d.mode === "daily") d.dur = Math.max(1440, Math.round(d.dur / 1440) * 1440);
  return { ...d };
}

function dayItems(n = 14) {
  const d0 = startOfDay(engNow());
  return Array.from({ length: n }, (_, i) => dateKey(addDays(d0, i)));
}
const timeItems = (dk: string) => TIMES.map((t) => ({ v: t, label: time12(t), past: at(dk, t).getTime() < engNow() - MIN }));

function ReserveBody({ f }: { f: Facility }) {
  const { state, actions } = useApp();
  const nav = useNav();
  const toast = useToast();
  const openSheet = useSheet();
  const [d, setD] = useState<ReserveDraft>(() => draftFor(f, state));
  const upd = useCallback((p: Partial<ReserveDraft>) => setD((x) => { const n = { ...x, ...p }; reserveDraft[f.id] = n; return n; }), [f.id]);
  const [painted, setPainted] = useState(false); // the action-bar price rolls in from 0 on the first paint (prototype price(0) → setPrice)
  const start = d.start, end = d.start + d.dur * MIN, dk = dateKey(d.start);
  const days = useMemo(() => dayItems(14), []);
  const tk = timeKey(ceilHalfHour(d.start - 1));
  const cols = useMemo<WheelCol[]>(() => [{ items: timeItems(dk), value: tk, wide: true, label: "Entry time" }], [dk, tk]);

  // first visit: pick a vehicle that is allowed here and free for this time
  useEffect(() => {
    setPainted(true);
    const cur0 = reserveDraft[f.id];
    if (!cur0 || cur0.picked) return;
    cur0.picked = true;
    const cur = state.vehicles.find((x) => x.id === cur0.vehicleId), okV = pickVehicle(state, f, cur0.start, cur0.start + cur0.dur * MIN, cur0.mode);
    if (okV && cur && okV.id !== cur.id) { upd({ vehicleId: okV.id, picked: true }); toast(`Your ${cur.name} is already booked then, so we picked the ${okV.name}`, "info"); }
    else upd({ picked: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const v = state.vehicles.find((x) => x.id === d.vehicleId);
  const chk = validateBooking({ facility: f, start, end, mode: d.mode, vehicle: v, bookings: state.bookings, seed: state.demo.seed });
  const q = quote({ facility: f, start, end, mode: d.mode, vehicleType: v ? v.type : "hatchback", evCharging: d.reqs.includes("EV charging") });
  const blocked = chk.issues.length > 0 || !v;

  const onWheel = useCallback((vals: string[]) => { setD((x) => { const n = { ...x, start: at(dateKey(x.start), vals[0]).getTime() }; reserveDraft[f.id] = n; return n; }); }, [f.id]);
  const go = () => {
    actions.setSearch({ start: d.start, end, mode: d.mode });
    nav.go("/checkout/" + f.id, { s: d.start, e: end, m: d.mode, v: d.vehicleId, req: d.reqs.join("|"), note: d.note });
  };
  const toggleReq = (r: string) => upd({ reqs: d.reqs.includes(r) ? d.reqs.filter((x) => x !== r) : [...d.reqs, r] });

  return (
    <>
      <Topbar title="Reserve" sub={f.name} large eyebrow={f.name} />
      <div className="page">
        <div className="step"><span className="step-n">1</span><h2>Date &amp; time</h2></div>
        {f.dailyRate ? (
          <Seg block className="mb-12" value={d.mode} ariaLabel="Booking mode"
            options={[{ value: "hourly", label: "By the hour" }, { value: "daily", label: "By the day" }]}
            onChange={(m) => upd({ mode: m, dur: m === "daily" ? 1440 : 120 })} />
        ) : null}
        <div className="datestrip mb-12">
          {days.map((x, i) => {
            const ms = at(x, "12:00").getTime();
            return (
              <button type="button" key={x} className={x === dk ? "is-on" : ""} onClick={() => upd({ start: at(x, timeKey(d.start)).getTime() })}>
                <small>{i === 0 ? "Today" : new Date(ms).toLocaleDateString("en-IN", { weekday: "short" })}</small><b>{new Date(ms).getDate()}</b>
              </button>
            );
          })}
        </div>
        <div className="group-label">Enter after</div>
        <Wheel key={dk} cols={cols} onChange={onWheel} />
        <div className="group-label mt-24">{d.mode === "daily" ? "Number of days" : "How long — drag the dial"}</div>
        <div style={{ width: 236, maxWidth: "100%", margin: "0 auto" }}>
          {d.mode === "hourly"
            ? <Dial key="h" value={Math.min(d.dur, 1440)} onChange={(x) => upd({ dur: x })} minMin={30} maxMin={1440} stepMin={30} startMs={start} />
            : <Dial key="d" value={d.dur} onChange={(x) => upd({ dur: x })} minMin={1440} maxMin={10080} stepMin={1440} label="Days" startMs={start} />}
        </div>
        <div className="stack-8 mt-12">
          {chk.issues.map((i) => (
            <div key={i.field + i.message} className={`notice notice-${i.field === "availability" ? "danger" : "warn"}`}><Icon name="triangle-alert" size={16} /><span>{i.message}</span></div>
          ))}
        </div>
        <hr className="lane-sep" />
        <div className="step mt-24"><span className="step-n">2</span><h2>Vehicle</h2></div>
        <div className="stack-8">
          {state.vehicles.map((x) => {
            const okT = f.vehicleTypes.includes(x.type);
            return (
              <label key={x.id} className={`opt${okT ? "" : " is-disabled"}`}>
                <input type="radio" name="veh" value={x.id} checked={x.id === d.vehicleId} disabled={!okT} onChange={() => upd({ vehicleId: x.id })} /><span className="opt-mark" />
                <span className="grow"><b className="small" style={{ display: "block" }}>{x.name}</b><span className="tiny muted">{D.vehicleLabels[x.type]}{x.color ? " · " + x.color : ""}</span></span>
                {okT ? <Plate plate={x.plate} size="sm" /> : <Badge tone="danger">Not allowed</Badge>}
              </label>
            );
          })}
        </div>
        <button type="button" className="btn btn-ghost btn-md mt-8" onClick={() => openSheet(({ open, close }) => <VehicleSheet open={open} onClose={close} onSaved={(nv) => upd({ vehicleId: nv.id })} />)}>
          <Icon name="plus" size={17} />Add a vehicle
        </button>
        <hr className="lane-sep" />
        <div className="step mt-24"><span className="step-n">3</span><h2>Anything you need?</h2></div>
        <div className="chip-row">
          {D.requirements.filter((r) => r !== "EV charging" || f.ev).map((r) => (
            <button type="button" key={r} className={`chip${d.reqs.includes(r) ? " is-on" : ""}`} onClick={() => toggleReq(r)}>
              {r === "EV charging" ? <><Icon name="zap" size={14} />EV charging +₹49</> : r}
            </button>
          ))}
        </div>
        <div className="field mt-16">
          <label className="field-label" htmlFor="rnote">Note for the attendant</label>
          <textarea id="rnote" className="textarea" maxLength={160} placeholder="E.g. I'll arrive with a wheelchair user" value={d.note} onChange={(e) => upd({ note: e.target.value })} />
          <div className="field-hint right"><span>{d.note.length}</span>/160</div>
        </div>
        <div className="sec"><div className="sec-head"><h2>Summary</h2></div>
          <div className="card card-pad">
            <div className="row gap-12 mb-12"><div className="thumb" style={{ width: 56, height: 48 }}><FacilityIllustration facility={f} /></div>
              <div className="grow"><b className="small">{f.name}</b><div className="tiny muted mono">{windowLabel(start, end)}</div></div></div>
            <OccupancyBar free={chk.free} capacity={f.capacity} className="occ-row" />
            <div className="mt-12"><MBill quote={q} /></div>
          </div>
        </div>
      </div>
      <div className="actionbar">
        <div className="grow"><div className="tiny muted">{durationLabel(d.dur / 60) + (v ? " · " + v.plate : "")}</div><Price n={painted ? q.total : 0} className="mp-sm" /></div>
        <button type="button" className="btn btn-primary btn-lg" disabled={blocked} onClick={go}>{chk.issues.length ? "Fix the issue above" : "Continue"}</button>
      </div>
    </>
  );
}

export default function Reserve() {
  const { params } = useScreenRoute();
  const f = getFacility(params.id);
  useScreenTitle("Reserve · PARKLY");
  if (!f) return (
    <Screen>
      <Topbar title="Not found" />
      <Empty ico="search-x" title="Parking not found" text="It may have been removed." />
    </Screen>
  );
  return <Screen><ReserveBody f={f} key={f.id} /></Screen>;
}
