"use client";
/* PARKLY mobile · Bookings.tsx — 9 BOOKINGS (tabs upcoming / active / completed / cancelled, bcard, pull to refresh),
   10 BOOKING DETAIL (heroState with live countdown ring / starts-in / overstay fee, details, actions, activity) and
   11 ARRIVING (entry countdown, mini map, checklist, entry steps, check in). Ported from prototype mobile.html
   Screens.bookings / booking / arrive; sheets live in ./booking-sheets. */
import { useMemo, useState } from "react";
import { useApp, useNow } from "@/lib/store";
import {
  D, MIN, availability, bookingStatus, countdown, dayLabel, distKm, facilityOrThrow, getBooking, isOverstay, mapsUrl, measure,
  money, paidSoFar, timeLabel, windowLabel,
} from "@/lib/engine";
import type { Booking, BookingStatus } from "@/lib/data";
import Icon from "@/components/shared/Icon";
import Badge, { StatusBadge } from "@/components/shared/Badge";
import Plate from "@/components/shared/Plate";
import Ring from "@/components/shared/Ring";
import SvgMap from "@/components/shared/SvgMap";
import FacilityIllustration from "@/components/shared/FacilityIllustration";
import { useToast } from "@/components/shared/ToastProvider";
import { Bell, Empty, Screen, Skel, Topbar, opensLabel, useNav, useScreen } from "./kit";
import { useScreenRoute } from "./route";
import { ListRow, NotFound, ms, useScreenTitle } from "./b-shared";
import { useBookingSheets } from "./booking-sheets";

const tl = (t: number | string) => timeLabel(t);

/* ───────────── 9 · BOOKINGS ───────────── */
type Tab = "upcoming" | "active" | "completed" | "cancelled";
const BTABS: [Tab, string][] = [["upcoming", "Upcoming"], ["active", "Active"], ["completed", "Completed"], ["cancelled", "Cancelled"]];
const groupOf = (b: Booking, t: number): Tab => { const s: BookingStatus = bookingStatus(b, t); return s === "pending" ? "upcoming" : s; };
const bk = { tab: null as Tab | null }; // remembered across visits (prototype bookTab)

function BCard({ b, t }: { b: Booking; t: number }) {
  const f = facilityOrThrow(b.facilityId), st = bookingStatus(b, t), over = isOverstay(b, t);
  return (
    <a className={`bcard tap${st === "active" ? " is-live" : ""}${over ? " is-over" : ""}`} href={`/bookings/${b.id}`} data-go={`/bookings/${b.id}`} draggable={false}>
      <div className="bcard-top">
        <div className="thumb"><FacilityIllustration facility={f} /></div>
        <div className="grow">
          <div className="row-between"><b className="small ellipsis">{f.name}</b><StatusBadge booking={b} now={t} /></div>
          <div className="tiny muted mono mt-4">{windowLabel(b.start, b.end)}</div>
          <div className="tiny ink-2 mt-4">{b.bay}</div>
        </div>
      </div>
      <div className="bcard-bot"><span className="mono tiny muted">{b.ref}</span><Plate plate={b.vehicle.plate} size="sm" /><b className="mono small">{money(paidSoFar(b))}</b></div>
    </a>
  );
}

function BookingList({ tab, list, t }: { tab: Tab; list: Booking[]; t: number }) {
  const { refreshing } = useScreen();
  return (
    <div className="stack-12 m-stagger" data-skel="3">
      {refreshing ? <Skel n={3} />
        : list.length ? <>
          {list.map((b) => <BCard key={b.id} b={b} t={t} />)}
          <p className="tiny muted center mt-16"><Icon name="refresh-cw" size={12} /> Pull down to refresh live status</p>
        </>
          : <Empty ico="calendar-days" title={`No ${tab} bookings`} text={tab === "upcoming" ? "Find a spot and reserve it before you leave home." : "They will show up here."}
            action={tab === "upcoming" ? <button type="button" className="btn btn-primary btn-md" data-go="/explore">Find parking</button> : undefined} />}
    </div>
  );
}

export function Bookings() {
  useScreenTitle("Bookings · PARKLY");
  const { state, now: t } = useApp();
  const { query } = useScreenRoute();
  const all = state.bookings;
  const counts = Object.fromEntries(BTABS.map(([k]) => [k, all.filter((b) => groupOf(b, t) === k).length])) as Record<Tab, number>;
  const q = query.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(() => {
    const x = (q && BTABS.some(([k]) => k === q) ? q : null) || bk.tab || (counts.active ? "active" : "upcoming");
    bk.tab = x;
    return x;
  });
  const pick = (k: Tab) => { bk.tab = k; setTab(k); };
  const list = all.filter((b) => groupOf(b, t) === tab)
    .sort((a, b) => (tab === "upcoming" || tab === "active" ? 1 : -1) * (ms(a.start) - ms(b.start)));
  return (
    <Screen tab ptr>
      <Topbar title="Bookings" large back={false} actions={<Bell />} />
      <div className="tabs chip-scroll" role="tablist">
        {BTABS.map(([k, l]) => (
          <button type="button" key={k} className={k === tab ? "is-on" : ""} role="tab" aria-selected={k === tab} onClick={() => pick(k)}>{l}<span className="count">{counts[k]}</span></button>
        ))}
      </div>
      <div className="page" style={{ paddingTop: 16 }}><BookingList key={tab} tab={tab} list={list} t={t} /></div>
    </Screen>
  );
}

/* ───────────── 10 · BOOKING DETAIL ───────────── */
function Hero({ b, t }: { b: Booking; t: number }) {
  const { actions } = useApp();
  const act = useBookingSheets(b.id);
  const f = facilityOrThrow(b.facilityId), st = bookingStatus(b, t), s = ms(b.start), e = ms(b.end);
  if (isOverstay(b, t)) {
    const ex = actions.exitPreview(b.id);
    return (
      <div className="hero-st is-danger">
        <div className="row-between"><span className="eyebrow" style={{ color: "var(--danger)" }}>Overstay</span><span className="live-dot" style={{ background: "var(--danger)" }} /></div>
        <div className="cd-big t-danger mt-12">+{countdown(ex.overMs)}</div>
        <p className="small ink-2 mt-8">You were due out at {tl(e)}. Overstay costs 1.5× the hourly rate after a 15-min grace.</p>
        <div className="row-between mt-16"><span className="small muted">Fee so far</span><b className="mono t-danger">{money(ex.fee)}</b></div>
        <div className="act-pair"><button type="button" className="btn btn-primary btn-md" onClick={act.extend}>Extend now</button><button type="button" className="btn btn-danger btn-md" onClick={act.exit}>{"I've exited"}</button></div>
      </div>
    );
  }
  if (st === "active") {
    const left = e - t, frac = left / (e - s), warn = left < 15 * MIN, used = Math.round((1 - frac) * 100);
    return (
      <div className={`hero-st${warn ? " is-warn" : ""}`}>
        <div className="ring-wrap">
          <Ring frac={frac} size={132} stroke={10} tone={warn ? "warn" : "lime"}><div className="eyebrow">Time left</div><div className="ring-time">{countdown(left)}</div></Ring>
          <div className="grow">
            <span className={`eyebrow${warn ? "" : " is-lime"}`} style={warn ? { color: "var(--warn)" } : undefined}>{b.arrivedAt ? "Parked" : "Active now"}</span>
            <div className="h2 mt-4">{b.bay}</div>
            <div className="small muted mt-4">Exit by <b className="mono ink-2">{tl(e)}</b></div>
            <div className="occ mt-12"><div className="occ-track"><div className="occ-fill" style={{ width: `${used}%`, background: "var(--lime)" }} /></div><div className="occ-label">{used}% used</div></div>
          </div>
        </div>
        {warn ? <div className="notice notice-warn mt-16"><Icon name="triangle-alert" size={16} /><span>Ends soon. Extend now to avoid overstay charges.</span></div> : null}
        <div className="act-pair">{b.arrivedAt
          ? <><button type="button" className="btn btn-primary btn-md" onClick={act.extend}><Icon name="plus" size={17} />Extend</button><button type="button" className="btn btn-secondary btn-md" onClick={act.exit}>{"I've exited"}</button></>
          : <><button type="button" className="btn btn-primary btn-md" data-go={`/bookings/${b.id}/arrive`}>{"I'm arriving"}</button><button type="button" className="btn btn-secondary btn-md" onClick={act.pass}>View pass</button></>}</div>
      </div>
    );
  }
  if (st === "pending") {
    return (
      <div className="hero-st is-warn"><span className="eyebrow" style={{ color: "var(--warn)" }}>Operator confirming</span>
        <div className="h2 mt-8">Waiting for {f.name}</div>
        <p className="small ink-2 mt-8">Private spaces are confirmed by hand, usually within a minute. If they say no, you get a full refund.</p>
        <div className="row gap-8 mt-12"><span className="spinner" style={{ width: 20, height: 20, borderWidth: 3 }} /><span className="small muted">Checking…</span></div>
      </div>
    );
  }
  if (st === "upcoming") {
    return (
      <div className="hero-st"><span className="eyebrow is-lime">Starts in</span>
        <div className="cd-big mt-8">{countdown(s - t)}</div>
        <p className="small ink-2 mt-8">{dayLabel(s)} at {tl(s)} · {b.bay}</p>
        <div className="act-pair"><button type="button" className="btn btn-primary btn-md" data-go={`/bookings/${b.id}/arrive`}>{"I'm arriving"}</button><button type="button" className="btn btn-secondary btn-md" onClick={act.pass}>View pass</button></div>
      </div>
    );
  }
  if (st === "cancelled") {
    return (
      <div className="hero-st is-muted"><span className="eyebrow" style={{ color: "var(--danger)" }}>Cancelled</span>
        <div className="h2 mt-8">{b.refund && b.refund.amount ? `${money(b.refund.amount)} refunded` : "No refund"}</div>
        <p className="small muted mt-8">{(b.refund && b.refund.note) || "The space was released."}</p>
        <button type="button" className="btn btn-primary btn-md btn-block mt-16" onClick={act.again}>Book again</button>
      </div>
    );
  }
  return (
    <div className="hero-st is-muted"><span className="eyebrow">Completed</span>
      <div className="h2 mt-8">Thanks for parking with us</div>
      <p className="small muted mt-8">{b.exitedAt ? `Exited ${dayLabel(ms(b.exitedAt))} at ${tl(ms(b.exitedAt))}.` : "This booking has ended."}</p>
      <button type="button" className="btn btn-primary btn-md btn-block mt-16" onClick={act.again}>Book again</button>
    </div>
  );
}

function Detail({ b }: { b: Booking }) {
  const t = useNow(1000);
  const act = useBookingSheets(b.id);
  const f = facilityOrThrow(b.facilityId), st = bookingStatus(b, t), live = st === "upcoming" || st === "pending" || st === "active", up = st === "upcoming" || st === "pending";
  return (
    <>
      <Topbar title={f.name} sub={b.ref} large eyebrow={<span className="mono">{b.ref}</span>} actions={<><StatusBadge booking={b} now={t} />{"  "}</>} />
      <div className="page">
        <div><Hero b={b} t={t} /></div>
        <div className="card card-pad mt-16">
          <div className="row gap-12 mb-12"><div className="thumb" style={{ width: 60, height: 50 }}><FacilityIllustration facility={f} /></div><div className="grow"><b>{f.name}</b><div className="tiny muted">{f.address}</div></div></div>
          <dl className="kv">
            <div><dt>When</dt><dd className="mono">{windowLabel(b.start, b.end)}</dd></div>
            <div><dt>Space</dt><dd className="mono">{b.bay}</dd></div>
            <div><dt>Vehicle</dt><dd><Plate plate={b.vehicle.plate} size="sm" /></dd></div>
            {b.requirements.length ? <div><dt>Requests</dt><dd>{b.requirements.join(", ")}</dd></div> : null}
            <div><dt>Paid</dt><dd className="mono">{money(paidSoFar(b))}</dd></div>
          </dl>
        </div>
        <div className="sec" style={{ marginTop: 28 }}><div className="act-list">
          {st !== "cancelled" ? <ListRow ic="qr-code" label="View pass" sub="Show at the barrier" onClick={act.pass} /> : null}
          <a className="list-row" href={mapsUrl(f)} target="_blank" rel="noopener noreferrer"><span className="ico-wrap"><Icon name="navigation" size={18} /></span><span className="grow">Directions</span><Icon name="arrow-up-right" size={16} className="chev" /></a>
          {up ? <ListRow ic="pencil" label="Change time or vehicle" sub="See the price difference first" onClick={act.modify} /> : null}
          {st === "active" ? <ListRow ic="plus" label="Extend parking" sub="Add 30 min to 3 h" onClick={act.extend} /> : null}
          {live ? <ListRow ic="calendar-plus" label="Add to calendar" onClick={act.cal} /> : null}
          <a className="list-row" href={`tel:${f.phone.replace(/\s/g, "")}`}><span className="ico-wrap"><Icon name="phone" size={18} /></span><span className="grow">Call the facility<div className="tiny muted mono">{f.phone}</div></span><Icon name="chevron-right" size={18} className="chev" /></a>
          <ListRow ic="receipt" label="Payment summary" onClick={act.pay} />
          <ListRow ic="rotate-ccw" label="Book again" onClick={act.again} />
          {up ? <ListRow ic="circle-x" label="Cancel booking" className="t-danger" onClick={act.cancel} /> : null}
        </div></div>
        <div className="sec" style={{ marginTop: 28 }}><div className="sec-head"><h2>Activity</h2></div>
          <ul className="timeline">{[...b.history].reverse().map((x, i) => (
            <li key={i}><div className="small strong">{x.action}</div>{x.detail ? <div className="tiny muted">{x.detail}</div> : null}<div className="t-time">{dayLabel(ms(x.at))} · {tl(ms(x.at))}</div></li>
          ))}</ul>
        </div>
      </div>
    </>
  );
}

export function BookingDetail() {
  const { params } = useScreenRoute();
  const { state } = useApp();
  const b = getBooking(state, params.id);
  useScreenTitle(b ? `${facilityOrThrow(b.facilityId).name} · ${b.ref} · PARKLY` : "Booking · PARKLY");
  return <Screen>{b ? <Detail b={b} /> : <NotFound title="Booking" text="It may have been removed." />}</Screen>;
}

/* ───────────── 11 · ARRIVING ───────────── */
const arriveChecks: Record<string, Record<number, boolean>> = {};

function ArriveBody({ b }: { b: Booking }) {
  const { state, actions } = useApp();
  const nav = useNav();
  const toast = useToast();
  const act = useBookingSheets(b.id);
  const n = useNow(1000);
  const f = facilityOrThrow(b.facilityId), s = ms(b.start);
  const canIn = n >= s - 15 * MIN && !b.arrivedAt && bookingStatus(b, n) !== "cancelled";
  const av = availability(f, Math.max(n, s), ms(b.end), state.bookings, state.demo.seed);
  const [ck, setCk] = useState<Record<number, boolean>>(() => (arriveChecks[b.id] = arriveChecks[b.id] || {}));
  const items = ["Pass ready on my phone", `Driving ${b.vehicle.plate}`, `Heading to ${f.levels[0]} entrance`, "Phone brightness up for scanning"];
  const near = useMemo(() => D.destinations.slice().sort((a, c) => distKm(a, f) - distKm(c, f))[0], [f]);
  const item = useMemo(() => measure(f, state.search, state.bookings, state.demo.seed, b.vehicle.type, near), [f, state.search, state.bookings, state.demo.seed, b.vehicle.type, near]);
  const items1 = useMemo(() => [item], [item]);
  const checkin = () => {
    actions.markArrived(b.id);
    toast("Checked in. The barrier is lifting.", "ok");
    nav.reset(["/bookings"], "/bookings/" + b.id, "pop");
    window.setTimeout(act.pass, 380);
  };
  return (
    <>
      <Topbar title="Arriving" large eyebrow={f.name} />
      <div className="page">
        <div className="hero-st">
          <div className="row-between"><span className="eyebrow is-lime">{n < s ? "Entry in" : "Entry window open"}</span><Badge tone="ok" icon="lock">Bay held</Badge></div>
          <div className="cd-big mt-8">{n < s ? countdown(s - n) : "Now"}</div>
          <p className="small ink-2 mt-8">Your bay <b className="mono">{b.bay}</b> is held. {av.free} other spaces are free right now.</p>
        </div>
        <div className="map-strip mt-16" style={{ height: 200 }}>
          <SvgMap items={items1} dest={near} selectedId={f.id} routeTo={f} radiusKm={1} compact onOpen={() => window.open(mapsUrl(f), "_blank")} />
        </div>
        <div className="row gap-8 mt-12">
          <a className="btn btn-secondary btn-md" style={{ flex: 1 }} href={mapsUrl(f, "driving")} target="_blank" rel="noopener noreferrer"><Icon name="navigation" size={17} />Drive there</a>
          <button type="button" className="btn btn-secondary btn-md" style={{ flex: 1 }} onClick={act.pass}><Icon name="qr-code" size={17} />Show pass</button>
        </div>
        <div className="sec" style={{ marginTop: 28 }}><div className="sec-head"><h2>Before you reach the gate</h2></div>
          <div className="group">{items.map((x, i) => (
            <label key={i} className="grow-row no-press">
              <span className="check"><input type="checkbox" checked={!!ck[i]} onChange={(e) => { const v = e.target.checked; arriveChecks[b.id] = { ...arriveChecks[b.id], [i]: v }; setCk(arriveChecks[b.id]); }} /><span className="check-box" /></span>
              <span className="lbl">{x}</span>
            </label>
          ))}</div>
        </div>
        <div className="sec" style={{ marginTop: 28 }}><div className="sec-head"><h2>At the entrance</h2></div>
          <ol className="steps">{f.entry.map((x) => <li key={x}>{x}</li>)}</ol>
        </div>
      </div>
      <div className="actionbar">
        <button type="button" className="btn btn-primary btn-lg btn-block" disabled={!canIn} onClick={checkin}>
          {b.arrivedAt ? "Checked in" : canIn ? "I've entered — check in" : `Check-in opens ${opensLabel(s - 15 * MIN)}`}
        </button>
      </div>
    </>
  );
}

export function Arrive() {
  useScreenTitle("Arriving · PARKLY");
  const { params } = useScreenRoute();
  const { state } = useApp();
  const b = getBooking(state, params.id);
  return <Screen>{b ? <ArriveBody b={b} /> : <NotFound title="Arriving" text="" />}</Screen>;
}
