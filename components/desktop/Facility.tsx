"use client";
/* 3. FACILITY DETAIL (prototype Views.parking): 2-col — hero illustration + 3 scene thumbs, badges, title, heatmap
   (click an hour to start there), 3h/6h/12h/day price strip, facts, EV, security & policy, entry steps, rules,
   mini map with route, reviews; sticky price card (total count-up, window, occupancy, breakdown, Reserve/Save/Directions). */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import {
  D, HOUR, availTone, availability, ceilHalfHour, dailyFor, dayLabel, distKm, facility as getFacility, hourlyAvailability, hoursLabel,
  kmLabel, mapsUrl, measure, money, now as engNow, rateFor, searchCenter, startOfDay, timeLabel, toneClass, walkMin,
} from "@/lib/engine";
import type { Facility as Fac } from "@/lib/data";
import Icon from "@/components/shared/Icon";
import Badge from "@/components/shared/Badge";
import Bill from "@/components/shared/Bill";
import Stars from "@/components/shared/Stars";
import OccupancyBar from "@/components/shared/OccupancyBar";
import SvgMap from "@/components/shared/SvgMap";
import FacilityIllustration, { SCENES, defaultScene } from "@/components/shared/FacilityIllustration";
import type { Scene } from "@/components/shared/FacilityIllustration";
import { useToast } from "@/components/shared/ToastProvider";
import DesktopShell, { useTitle } from "./DesktopShell";
import { CountRup, EmptyState, Topbar, dayTotal, totalFor, useOpenWhen, vtype, win, windowQuote } from "./common";

function PriceCard({ f }: { f: Fac }) {
  const { state, actions } = useApp();
  const router = useRouter();
  const toast = useToast();
  const openWhen = useOpenWhen();
  const w = win(state), a = availability(f, w.s, w.e, state.bookings, state.demo.seed), q = windowQuote(state, f), tone = availTone(a.free, f.capacity);
  const vt = vtype(state), saved = state.savedIds.includes(f.id), full = a.free <= 0;
  const dfor = dailyFor(f, vt);
  return (
    <div className="card pcard stack-16">
      <div className="row-between"><span className="lbl">Total for your time</span>
        <Badge tone={toneClass(tone)} icon={full ? "circle-x" : "circle-check"}>{full ? "Full" : tone === "low" ? `Only ${a.free} left` : "Space available"}</Badge></div>
      <div><CountRup to={q.total} className="num big" />
        <div className="small muted mt-8">{money(rateFor(f, vt))}/h{f.dailyRate && dfor ? ` · ${money(dfor)}/day cap` : ""} · tax included</div></div>
      <div className="win-box">
        <button className="sf" type="button" onClick={() => openWhen()}><span className="lbl">Enter after</span><span className="v">{dayLabel(w.s)}, {timeLabel(w.s)}</span></button>
        <button className="sf" type="button" onClick={() => openWhen()}><span className="lbl">Exit before</span><span className="v">{timeLabel(w.e)}</span></button>
      </div>
      <OccupancyBar free={a.free} capacity={f.capacity} />
      {full && a.fullSlot && <div className="notice notice-danger"><Icon name="triangle-alert" size={16} /><span>Fully booked from {timeLabel(a.fullSlot)}. Try an earlier or shorter time.</span></div>}
      <details className="faq"><summary>See price breakdown <Icon name="chevron-down" size={16} /></summary><Bill quote={q} /></details>
      <button type="button" className="btn btn-primary btn-lg btn-block is-mag" disabled={full} onClick={() => router.push("/reserve/" + f.id)}>{full ? "Full for your time" : "Reserve a spot"}</button>
      <div className="row gap-8">
        <button type="button" className="btn btn-secondary btn-md grow" onClick={() => { actions.toggleSaved(f.id); toast(!saved ? "Saved" : "Removed from saved", "ok"); }}>
          <Icon name={saved ? "bookmark-check" : "heart"} size={17} />{saved ? "Saved" : "Save"}</button>
        <a className="btn btn-secondary btn-md grow" href={mapsUrl(f)} target="_blank" rel="noopener noreferrer"><Icon name="navigation" size={17} />Directions</a>
      </div>
      <p className="tiny muted center">{f.instant ? "Instant booking: your bay is confirmed when you pay." : "The owner confirms within a minute. Full refund if they decline."}</p>
    </div>
  );
}

const STRIP: [number, string][] = [[3, "3 hours"], [6, "6 hours"], [12, "12 hours"], [24, "Full day"]];
const FACT_VEH = (t: string) => D.vehicleLabels[t as keyof typeof D.vehicleLabels].replace("Electric vehicle", "EV");

function FacilityView() {
  const { id } = useParams<{ id: string }>();
  const f = getFacility(id);
  useTitle((f ? f.name : "Parking") + " · PARKLY");
  const { state, actions } = useApp();
  const [scene, setScene] = useState<Scene>(() => (f ? defaultScene(f) : "bays"));
  useEffect(() => { if (f) actions.viewed(f.id); }, [f?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!f) return (<><Topbar back title="Not found" /><div className="page"><EmptyState ico="search-x" title="We can't find this parking" action={<Link className="btn btn-primary btn-md" href="/explore">Back to search</Link>}>It may have been removed. Search again to see what is near you.</EmptyState></div></>);

  const c = searchCenter(state.search), km = distKm(c, f), w = win(state), vt = vtype(state);
  const day = startOfDay(w.s), cells = hourlyAvailability(f, day, state.bookings, state.demo.seed), selH = new Date(w.s).getHours();
  const strip = STRIP.map(([h, l]) => [l, h === 24 ? dayTotal(f, w.s, vt) : totalFor(f, w.s, h, vt), h] as const);
  const best = Math.min(...strip.map((x) => x[1] / x[2]));
  const pol = D.policies[f.policy];
  const setHour = (h: number) => { const s = day + h * HOUR, st0 = Math.max(s, ceilHalfHour(engNow())); actions.setSearch({ start: st0, end: st0 + (w.e - w.s) }); };
  const facts: [string, string, string][] = [["clock", "Hours", hoursLabel(f)], ["car", "Spaces", `${f.capacity} total`], ["ruler", "Height limit", f.heightLimit ? `${f.heightLimit} m` : "No limit"],
    ["moon", "Overnight", f.overnight ? "Allowed" : "Not allowed"], ["accessibility", "Accessible", f.accessible ? "Yes, near the lift" : "No"], ["layers", "Vehicles", f.vehicleTypes.map(FACT_VEH).join(", ")]];

  return (
    <>
      <Topbar back title={f.name} sub={`${f.area} · ${kmLabel(km)} from ${c.name}`} />
      <div className="page">
        <div className="crumbs mb-16"><Link href="/explore">Explore</Link><Icon name="chevron-right" size={14} /><span>{f.area}</span><Icon name="chevron-right" size={14} /><span className="ink-2">{f.name}</span></div>
        <div className="two-col">
          <div className="stack-24">
            <div className="det-hero rv">
              <div className="illus-frame"><FacilityIllustration facility={f} scene={scene} /></div>
              <div className="det-scenes">{SCENES.map((sc) => <button type="button" key={sc} className={sc === scene ? "is-on" : ""} onClick={() => setScene(sc)} aria-label={`Show ${sc} view`}><FacilityIllustration facility={f} scene={sc} /></button>)}</div>
            </div>
            <div className="rv" style={{ ["--d" as string]: 1 }}>
              <div className="row row-wrap gap-8 mb-12">
                <Badge>{D.typeLabels[f.type] || f.type}</Badge>
                {f.instant ? <Badge tone="lime" icon="zap">Instant booking</Badge> : <Badge tone="warn" icon="clock">Owner confirms</Badge>}
                {f.ev && <Badge tone="info" icon="zap">{f.ev.count} EV chargers</Badge>}
              </div>
              <h1 className="h1d">{f.name}</h1><p className="ink-2 mt-8">{f.address}</p>
              <div className="row gap-16 mt-12 small"><Stars rating={f.rating} count={f.reviewCount} row />
                <span className="row gap-6 ink-2"><Icon name="footprints" size={16} /><span className="mono">{kmLabel(km)} · {walkMin(km)} min walk</span></span>
                <a className="link row gap-6" href={`tel:${f.phone}`}><Icon name="phone" size={15} />{f.phone}</a></div>
            </div>
            <section className="card sec-card">
              <div className="card-head"><h2 className="card-title">Free spaces by hour · {dayLabel(day)}</h2><span className="small muted">Click an hour to start there</span></div>
              <div className="heat heat-24">{cells.map((x) => {
                const tone = x.free < 0 ? "closed" : availTone(x.free, f.capacity);
                const dis = x.free < 0 || day + x.hour * HOUR < ceilHalfHour(engNow()) - HOUR;
                return <button type="button" key={x.hour} className={`heat-cell h-${tone}${x.ratio > 0.5 ? " is-strong" : ""}${x.hour === selH ? " is-sel" : ""}`} disabled={dis}
                  title={`${x.hour}:00 · ${x.free < 0 ? "closed" : x.free + " free"}`} onClick={() => setHour(x.hour)}>{String(x.hour).padStart(2, "0")}<span className="n">{x.free < 0 ? "–" : x.free}</span></button>;
              })}</div>
              <div className="legend mt-12"><span><i style={{ background: "rgba(61,220,151,.4)" }} />Plenty free</span><span><i style={{ background: "rgba(255,176,32,.45)" }} />Few left</span><span><i style={{ background: "rgba(255,90,95,.45)" }} />Full</span><span><i style={{ background: "repeating-linear-gradient(45deg,#1A2420 0 3px,#121A15 3px 6px)" }} />Closed</span></div>
            </section>
            <section className="card sec-card">
              <div className="card-head"><h2 className="card-title">{"What you'd pay"}</h2><span className="small muted">From {timeLabel(w.s)} · {D.vehicleLabels[vt]} · tax included</span></div>
              <div className="pstrip">{strip.map(([l, v, h]) => {
                const isBest = v / h === best;
                return <div key={l} className={isBest ? "is-best" : ""}><span className="lbl">{l}</span><span className="num"><span className="cur">₹</span>{Math.round(v).toLocaleString("en-IN")}</span>
                  {isBest ? <span className="tiny lime">Best value per hour</span> : <span className="tiny muted">{money(v / h)}/h</span>}</div>;
              })}</div>
            </section>
            <section className="facts">{facts.map(([ic, k, v]) => <div key={k}><Icon name={ic} size={18} /><div><div className="k">{k}</div><div className="v">{v}</div></div></div>)}</section>
            {f.ev && (
              <section className="card sec-card card-forest"><div className="row gap-16"><div className="icon-tile is-lime"><Icon name="zap" size={20} /></div>
                <div className="grow"><b>EV charging on site</b><div className="small ink-2">{f.ev.count} chargers · {f.ev.kw} kW · {f.ev.connector} · {money(f.ev.perKwh)}/kWh paid at the charger. Reserve one for {money(D.pricing.evReserve)} when you book.</div></div></div></section>
            )}
            <div className="grid-2">
              <section className="card sec-card"><h2 className="card-title mb-12">Security &amp; amenities</h2>
                <div className="chip-row">{f.security.map((x) => <span key={x} className="chip chip-sm"><Icon name="shield-check" size={14} />{D.securityLabels[x]}</span>)}{f.amenities.map((x) => <span key={x} className="chip chip-sm">{x}</span>)}</div></section>
              <section className="card sec-card"><h2 className="card-title mb-12">Cancellation: {pol.title}</h2><ul className="steps-ol" style={{ gap: 8 }}>{pol.rules.map((r) => <li key={r} className="small">{r}</li>)}</ul></section>
            </div>
            <div className="grid-2">
              <section className="card sec-card"><h2 className="card-title mb-12">How to get in</h2><ol className="steps-ol">{f.entry.map((x) => <li key={x}>{x}</li>)}</ol></section>
              <section className="card sec-card"><h2 className="card-title mb-12">House rules</h2><ul className="stack-8 small ink-2" style={{ paddingLeft: 18 }}>{f.rules.map((x) => <li key={x}>{x}</li>)}</ul></section>
            </div>
            <section className="card sec-card"><div className="card-head"><h2 className="card-title">Where it is</h2><span className="small muted mono">{walkMin(km)} min walk to {c.name}</span></div>
              <SvgMap className="mini-map" items={[measure(f, state.search, state.bookings, state.demo.seed, vt)]} dest={c} selectedId={f.id} routeTo={f} radiusKm={Math.max(0.6, km * 0.9)} /></section>
            <section className="card sec-card"><div className="card-head"><h2 className="card-title">What drivers say</h2><Stars rating={f.rating} count={f.reviewCount} /></div>
              {f.reviews.map((r) => (
                <div key={r.name + r.date} className="rev"><div className="row-between"><b>{r.name}</b><span className="tiny muted mono">{new Date(r.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span></div>
                  <div className="mt-4"><Stars rating={r.rating} row /></div><p className="ink-2 mt-8 small">{r.text}</p></div>
              ))}</section>
          </div>
          <div className="sticky-col"><PriceCard f={f} /></div>
        </div>
      </div>
    </>
  );
}

export default function Facility() { return <DesktopShell><FacilityView /></DesktopShell>; }
