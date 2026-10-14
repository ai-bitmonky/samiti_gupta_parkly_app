"use client";
/* 5 · FACILITY DETAIL (route "parking", prototype Screens.parking): illustration hero under a glass overlay top bar
   (collapses after 170 px), scene thumbnails, badges, name, address, rating · distance · walk, quick actions
   (Save / Directions / Compare / Call), your time + occupancy, tappable hourly availability heat map, 3 h / 6 h / 12 h /
   1 day price strip, facts, EV card, security & amenities, rules, cancellation policy, reviews, location mini map and
   a sticky action bar with the total for your time. Prices come from the same engine quote as the result card. */
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import {
  D, HOUR, MIN, amenityIcons, availTone, dailyFor, dateLabel, dayLabel, facility as getFacility, hourlyAvailability, hoursLabel,
  kmLabel, mapsUrl, money, now as engNow, quote, searchCenter, startOfDay, time12, windowLabel,
} from "@/lib/engine";
import type { Facility as Fac } from "@/lib/data";
import Icon from "@/components/shared/Icon";
import Badge from "@/components/shared/Badge";
import Stars from "@/components/shared/Stars";
import SvgMap from "@/components/shared/SvgMap";
import OccupancyBar from "@/components/shared/OccupancyBar";
import FacilityIllustration, { SCENES, defaultScene } from "@/components/shared/FacilityIllustration";
import type { Scene } from "@/components/shared/FacilityIllustration";
import { useToast } from "@/components/shared/ToastProvider";
import { Empty, Price, Screen, Topbar, W, durH, measureOne, tl, vt } from "./kit";
import { TimeSheet, useSheet } from "./sheets";
import { useScreenRoute } from "./route";
import { useScreenTitle } from "./title";

const STRIP: [number, string][] = [[3, "3 h"], [6, "6 h"], [12, "12 h"], [24, "1 day"]];

function Heat({ f, dayStart, selMs }: { f: Fac; dayStart: number; selMs: number }) {
  const { state, actions } = useApp();
  const toast = useToast();
  const cells = hourlyAvailability(f, dayStart, state.bookings, state.demo.seed), selH = new Date(selMs).getHours(), nowMs = engNow();
  const pick = (s: number) => {
    const w = W(state);
    if (s < engNow() - MIN) { toast("That hour has passed. Pick a later one.", "warn"); return; }
    actions.setSearch({ start: s, end: s + (w.e - w.s) });
    toast(`Entry set to ${tl(s)}`, "ok");
  };
  return (
    <div className="heat">
      {cells.map((c) => {
        const t = dayStart + c.hour * HOUR, past = t + HOUR <= nowMs, hh = String(c.hour).padStart(2, "0");
        const cls = ["heat-cell", c.free < 0 ? "h-closed" : "h-" + availTone(c.free, f.capacity), c.hour === selH ? "is-sel" : "", past ? "is-past" : ""].filter(Boolean).join(" ");
        return (
          <button type="button" key={c.hour} className={cls} onClick={() => pick(t)} aria-label={`${time12(hh + ":00")}: ${c.free < 0 ? "closed" : c.free + " free"}`}>
            {hh}<span className="n">{c.free < 0 ? "–" : c.free}</span>
          </button>
        );
      })}
    </div>
  );
}

function FacilityBody({ f }: { f: Fac }) {
  const { state: st, actions } = useApp();
  const toast = useToast();
  const openSheet = useSheet();
  const [scene, setScene] = useState<Scene>(() => defaultScene(f));
  useEffect(() => { actions.viewed(f.id); }, [f.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const m = measureOne(st, f), w = W(st), saved = st.savedIds.includes(f.id), cmp = st.compareIds.includes(f.id), vtp = vt(st);
  const pol = D.policies[f.policy], dayStart = startOfDay(w.s), center = searchCenter(st.search);
  const facts: [string, string][] = [["Hours", hoursLabel(f)], ["Capacity", `${f.capacity} spaces`], ["Height limit", f.heightLimit ? f.heightLimit + " m" : "No limit"],
    ["Overnight", f.overnight ? "Allowed" : "Not allowed"], ["Accessible", f.accessible ? "Yes, step-free" : "No"],
    ["Vehicles", f.vehicleTypes.map((t) => D.vehicleLabels[t].replace("Electric vehicle", "EV")).join(", ")]];
  const daily = dailyFor(f, vtp);
  const onSave = () => { actions.toggleSaved(f.id); toast(saved ? "Removed from Saved" : "Saved. Find it in the Saved tab.", saved ? "info" : "ok"); };
  const onCmp = () => { const r = actions.toggleCompare(f.id); if (!r.ok) toast(r.error, "warn"); };
  const when = () => openSheet(({ open, close }) => <TimeSheet open={open} onClose={close} />);

  return (
    <>
      <Topbar title={f.name} overlay actions={
        <button type="button" className={`glass-btn${saved ? " is-on heart-on" : ""}`} data-act="save" onClick={onSave} aria-label="Save" aria-pressed={saved}><Icon name="heart" size={19} /></button>
      } />
      <div className="dt-hero grain"><FacilityIllustration key={scene} facility={f} scene={scene} /></div>
      <div className="dt-thumbs">
        {SCENES.map((sc) => (
          <button type="button" key={sc} className={`dt-thumb tap${sc === scene ? " is-on" : ""}`} onClick={() => setScene(sc)} aria-label={`Show ${sc}`}><FacilityIllustration facility={f} scene={sc} /></button>
        ))}
      </div>
      <div className="page" style={{ paddingTop: 16 }}>
        <div className="chip-row">
          <Badge tone="neutral">{D.typeLabels[f.type]}</Badge>
          {f.instant ? <Badge tone="lime" icon="zap">Instant booking</Badge> : <Badge tone="warn" icon="clock">Operator confirms</Badge>}
          {f.ev ? <Badge tone="info" icon="zap">{f.ev.count} EV chargers</Badge> : null}
        </div>
        <h1 className="h1 mt-12">{f.name}</h1>
        <p className="small muted mt-4 selectable">{f.address}</p>
        <div className="rcard-meta mt-8"><Stars rating={f.rating} count={f.reviewCount} />·<span className="mono">{kmLabel(m.km)}</span>·<span><Icon name="footprints" size={12} /> {m.walk} min walk</span></div>
        <div className="dt-acts mt-16">
          <button type="button" className={`dt-act tap${saved ? " is-on" : ""}`} data-act="save" onClick={onSave} aria-pressed={saved}><Icon name="heart" size={20} /><span>{saved ? "Saved" : "Save"}</span></button>
          <a className="dt-act tap" href={mapsUrl(f)} target="_blank" rel="noopener noreferrer"><Icon name="navigation" size={20} /><span>Directions</span></a>
          <button type="button" className={`dt-act tap${cmp ? " is-on" : ""}`} data-act="cmp" onClick={onCmp} aria-pressed={cmp}><Icon name="columns" size={20} /><span>Compare</span></button>
          <a className="dt-act tap" href={`tel:${f.phone.replace(/\s/g, "")}`}><Icon name="phone" size={20} /><span>Call</span></a>
        </div>
        <div className="card card-pad mt-16">
          <div className="row-between"><div><div className="eyebrow">Your time</div><b className="mono small">{windowLabel(w.s, w.e)}</b></div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={when}>Change</button></div>
          <div className="mt-12"><OccupancyBar free={m.free} capacity={f.capacity} className="occ-row" /></div>
        </div>
        <div className="sec">
          <div className="sec-head"><h2>Availability by hour</h2><span className="small muted">{dayLabel(w.s)}</span></div>
          <Heat f={f} dayStart={dayStart} selMs={w.s} />
          <div className="legend mt-12">
            <span><i style={{ background: "rgba(61,220,151,.4)" }} />Free</span><span><i style={{ background: "rgba(255,176,32,.45)" }} />Few left</span>
            <span><i style={{ background: "rgba(255,90,95,.45)" }} />Full</span><span><i className="heat-cell h-closed" style={{ height: 12 }} />Closed</span>
          </div>
          <p className="tiny muted mt-8">Tap an hour to start your booking then.</p>
        </div>
        <div className="sec">
          <div className="sec-head"><h2>What it costs</h2><span className="small muted mono">₹{m.rate}/h{f.dailyRate ? ` · ₹${daily}/day` : ""}</span></div>
          <div className="ps">{STRIP.map(([hrs, l]) => {
            const q = quote({ facility: f, start: w.s, end: w.s + hrs * HOUR, mode: "hourly", vehicleType: vtp });
            return <div className="ps-cell" key={l}><div className="eyebrow">{l}</div><b className="mono">{money(q.total)}</b></div>;
          })}</div>
          <p className="tiny muted mt-8">Totals include the ₹15 fee and 18% GST, for your {D.vehicleLabels[vtp].toLowerCase()}.</p>
        </div>
        <div className="sec"><div className="sec-head"><h2>Good to know</h2></div>
          <div className="kv-grid card card-pad">{facts.map(([k, v]) => <div key={k}><div className="k">{k}</div><div className="v">{v}</div></div>)}</div></div>
        {f.ev ? (
          <div className="sec"><div className="card card-pad ev-card">
            <div className="row gap-12"><span className="wl-ico"><Icon name="zap" size={20} /></span>
              <div className="grow"><b>EV charging</b><div className="small muted">{f.ev.count} chargers · {f.ev.kw} kW · {f.ev.connector}</div></div><b className="mono">₹{f.ev.perKwh}/kWh</b></div>
            <p className="small ink-2 mt-12">Reserve a charger for ₹49 when you book. Energy is billed at the charger.</p>
          </div></div>
        ) : null}
        <div className="sec"><div className="sec-head"><h2>Security &amp; amenities</h2></div>
          <div className="chip-row">
            {f.security.map((s) => <span className="chip chip-sm" key={"s" + s}><Icon name="shield-check" size={13} />{D.securityLabels[s]}</span>)}
            {amenityIcons(f).filter((a) => !["CCTV", "Guarded"].includes(a.label)).map((a) => <span className="chip chip-sm" key={"i" + a.label}><Icon name={a.icon} size={13} />{a.label}</span>)}
            {f.amenities.map((a) => <span className="chip chip-sm" key={"a" + a}>{a}</span>)}
          </div></div>
        <div className="sec"><div className="sec-head"><h2>Rules</h2></div><ol className="steps">{f.rules.map((x) => <li key={x}>{x}</li>)}</ol></div>
        <div className="sec"><div className="sec-head"><h2>Cancellation</h2><Badge tone="neutral">{pol.title}</Badge></div>
          <div className="card card-pad"><ul className="pol">{pol.rules.map((x) => <li key={x}><Icon name="check" size={15} />{x}</li>)}</ul>
            <p className="tiny muted mt-8">The ₹18 convenience fee (incl. GST) is never refunded.</p></div></div>
        <div className="sec"><div className="sec-head"><h2>Reviews</h2><Stars rating={f.rating} count={f.reviewCount} /></div>
          <div className="mini-row">{f.reviews.map((rv) => (
            <div className="card card-pad rv" key={rv.name + rv.date}>
              <div className="row-between"><b className="small">{rv.name}</b><Stars rating={rv.rating} /></div>
              <p className="small ink-2 mt-8">{rv.text}</p><div className="tiny muted mt-8">{dateLabel(Date.parse(rv.date), {})}</div>
            </div>
          ))}</div></div>
        <div className="sec"><div className="sec-head"><h2>Location</h2><span className="small muted">{m.walk} min walk to {center.name}</span></div>
          <div className="map-strip" style={{ height: 180 }}><SvgMap compact items={[m]} dest={center} selectedId={f.id} routeTo={f} radiusKm={0.8}
            onOpen={() => window.open(mapsUrl(f), "_blank")} ariaLabel={`Location of ${f.name}. Opens directions.`} /></div></div>
      </div>
      <div className="actionbar">
        <div className="grow"><div className="tiny muted">{durH(w.s, w.e)} total</div><Price n={m.total} className="mp-sm" /></div>
        <button type="button" className="btn btn-primary btn-lg" data-go={`/reserve/${f.id}`} disabled={m.free <= 0}>{m.free <= 0 ? "Full for your time" : "Reserve a spot"}</button>
      </div>
    </>
  );
}

export default function Facility() {
  const { params } = useScreenRoute();
  const f = getFacility(params.id);
  useScreenTitle((f ? f.name : "Parking") + " · PARKLY");
  if (!f) return (
    <Screen>
      <Topbar title="Not found" />
      <Empty ico="search-x" title="Parking not found" text="It may have been removed." />
    </Screen>
  );
  return <Screen><FacilityBody f={f} key={f.id} /></Screen>;
}
