"use client";
/* /_dev — developer check page (folder %5Fdev = URL "/_dev"; a plain "_dev" folder would be private in the App Router).
   Renders every shared component with real data and runs the 15 engine assertions of the prototype smoke test.
   Removed by the audit agent before the public push. */
import { useEffect, useRef, useState } from "react";
import { useApp, useNow } from "@/lib/store";
import { useDevice } from "@/lib/device";
import {
  HOUR, at, dateKey, addDays, now as engNow, facilityOrThrow, quote, availability, bookingStatus, refundPreview, validateBooking,
  searchFacilities, searchCenter, measure, money, timeLabel, hourlyAvailability, startOfDay, availTone, D, getBooking, countdown,
} from "@/lib/engine";
import type { Facility } from "@/lib/data";
import { qrMatrix } from "@/lib/qr";
import Logo from "@/components/shared/Logo";
import Icon, { ICONS } from "@/components/shared/Icon";
import Plate from "@/components/shared/Plate";
import Stars from "@/components/shared/Stars";
import OccupancyBar from "@/components/shared/OccupancyBar";
import Ring from "@/components/shared/Ring";
import AmenityIcons from "@/components/shared/AmenityIcons";
import Bill from "@/components/shared/Bill";
import Badge, { StatusBadge } from "@/components/shared/Badge";
import Skeleton, { SkeletonCard } from "@/components/shared/Skeleton";
import RollNumber, { CountUp } from "@/components/shared/RollNumber";
import FacilityIllustration, { SCENES } from "@/components/shared/FacilityIllustration";
import SvgMap from "@/components/shared/SvgMap";
import Dial from "@/components/shared/Dial";
import Pass from "@/components/shared/Pass";
import QRCode from "@/components/shared/QRCode";
import { Sheet, Modal } from "@/components/shared/Overlay";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/Confirm";

interface Check { name: string; ok: boolean; detail: string }

function useEngineChecks(): Check[] | null {
  const { state, actions } = useApp();
  const [out, setOut] = useState<Check[] | null>(null);
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const res: Check[] = [];
    const check = (name: string, cond: unknown, detail = "") => res.push({ name, ok: !!cond, detail });
    const snapshot = state; // restored after the checks
    try {
      // 1. quote: 2 h hatchback at cp-palika → 50 + 50 = 100, + 15 fee, + 18% GST = 136
      const cp = facilityOrThrow("cp-palika");
      const s0 = at(dateKey(addDays(engNow(), 2)), "10:00").getTime();
      const q = quote({ facility: cp, start: s0, end: s0 + 2 * HOUR, mode: "hourly", vehicleType: "hatchback" });
      check("quote 2h hatchback @ cp-palika = ₹136", q.subtotal === 100 && q.convenience === 15 && q.tax === 21 && q.total === 136,
        `subtotal ${q.subtotal}, fee ${q.convenience}, GST ${q.tax}, total ${q.total}`);
      // 2. daily cap: 30 h at cp-palika hourly → 1 day (400) + 6 h (300) = 700
      const qc = quote({ facility: cp, start: s0, end: s0 + 30 * HOUR, mode: "hourly", vehicleType: "hatchback" });
      check("daily cap applied for 30 h", qc.dailyCapApplied && qc.subtotal === 700, `subtotal ${qc.subtotal}`);
      // 3–4. availability: a 1-space facility with one booking is full → fullSlot set; free after it ends
      const tiny: Facility = { ...facilityOrThrow("defcol"), id: "smoke-tiny", capacity: 1, busyness: 0 };
      const fake = [{ id: "x", facilityId: "smoke-tiny", start: new Date(s0).toISOString(), end: new Date(s0 + HOUR).toISOString() }];
      const av = availability(tiny, s0, s0 + 2 * HOUR, fake, 1);
      check("availability: full slot detected", av.free === 0 && av.fullSlot === s0, `free ${av.free}, fullSlot ${av.fullSlot ? timeLabel(av.fullSlot) : "-"}`);
      const av2 = availability(tiny, s0 + HOUR, s0 + 2 * HOUR, fake, 1);
      check("availability: free after the booking ends", av2.free === 1 && av2.fullSlot === undefined, `free ${av2.free}`);
      // 5–6. createBooking happy path (tomorrow 11:00–13:00, Swift, cp-palika) + same-vehicle overlap rejected
      const t1 = at(dateKey(addDays(engNow(), 1)), "11:00").getTime();
      const r = actions.createBooking({ facilityId: "cp-palika", vehicleId: "v-swift", start: t1, end: t1 + 2 * HOUR, mode: "hourly", requirements: [], method: "upi" });
      check("createBooking happy path → ok", r.ok && r.value.price.total === 136 && bookingStatus(r.value) === "upcoming",
        r.ok ? `${r.value.ref} · ${r.value.bay} · ${money(r.value.price.total)}` : r.error);
      const r2 = actions.createBooking({ facilityId: "cp-palika", vehicleId: "v-swift", start: t1, end: t1 + 2 * HOUR, mode: "hourly", requirements: [] });
      check("createBooking rejects same vehicle overlap", !r2.ok && /overlaps/.test(r2.error), r2.ok ? "accepted" : r2.error);
      // 7–9. cancel under 'strict' (cyberhub): >24 h ahead → 50% after ₹18 fee; inside 24 h → 0
      const t3 = at(dateKey(addDays(engNow(), 3)), "12:00").getTime();
      const rb = actions.createBooking({ facilityId: "cyberhub", vehicleId: "v-creta", start: t3, end: t3 + 3 * HOUR, mode: "hourly", requirements: [] });
      const pv = rb.ok ? actions.refundPreview(rb.value.id) : null;
      const expect = rb.ok ? Math.round(((rb.value.price.total - 18) * 50) / 100) : -1;
      check("refund preview, strict > 24 h = 50% minus fee", rb.ok && pv && pv.percent === 50 && pv.amount === expect,
        rb.ok && pv ? `paid ${pv.paid}, refund ${pv.amount} (expected ${expect})` : !rb.ok ? rb.error : "");
      const late = rb.ok ? refundPreview(rb.value, facilityOrThrow("cyberhub"), t3 - 5 * HOUR) : null;
      check("refund preview, strict < 24 h = 0", late && late.percent === 0 && late.amount === 0, late ? late.note : "");
      const cx = rb.ok ? actions.cancelBooking(rb.value.id) : null;
      check("cancelBooking returns the previewed refund", cx && cx.ok && cx.value.refund === expect, cx ? (cx.ok ? `refund ${cx.value.refund}` : cx.error) : "");
      // 10–11. validateBooking: past start + SUV at Khan Market (height limit)
      const khan = facilityOrThrow("khan"), creta = snapshot.vehicles.find((v) => v.id === "v-creta");
      const past = at(dateKey(engNow()), "00:30").getTime();
      const vb = validateBooking({ facility: khan, start: past, end: past + 2 * HOUR, vehicle: creta, bookings: [], seed: 1 });
      check("validateBooking rejects past start", vb.issues.some((i) => i.field === "start" && /already passed/.test(i.message)), vb.issues.map((i) => i.message).join(" | "));
      check("validateBooking rejects SUV at khan", vb.issues.some((i) => i.field === "vehicle" && /SUVs can't park here \(height limit 1.9 m\)/.test(i.message)));
      // 12. extension quote on the active seed booking
      const ext = actions.quoteExtension("b-active", 60);
      check("quoteExtension on active booking", ext.ok && ext.extra > 0, ext.ok ? `+60 min → ${money(ext.extra)} extra, new exit ${timeLabel(ext.newEnd)}` : ext.issues.join(" | "));
      // 13. seed shape
      const sts = snapshot.bookings.map((b) => bookingStatus(b));
      check("seed has 6 bookings incl. active/upcoming/completed/cancelled", snapshot.bookings.length === 6 && sts.includes("active") && sts.includes("upcoming") && sts.includes("cancelled") && sts.includes("completed"), sts.join(", "));
      // 14. QR
      const m = qrMatrix("PARKLY|PK-7HQK-42|DL 8C AF 4521");
      check("QR matrix built (version 3, 29×29)", m.length === 29, `${m.length}×${m.length}`);
      // 15. search
      const sr = searchFacilities(snapshot);
      check("searchFacilities ranks results with reasons", sr.results.length > 0 && sr.results.every((x) => typeof x.reason === "string" && x.reason.length > 0),
        `${sr.results.length} of ${sr.total} · top: ${sr.results[0]?.f.name}`);
    } catch (e) {
      check("no exception", false, (e as Error).message);
    }
    actions.replaceState(snapshot);
    setOut(res);
    (window as unknown as { SMOKE: unknown }).SMOKE = { pass: res.filter((x) => x.ok).length, total: res.length, fails: res.filter((x) => !x.ok) };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return out;
}

export default function DevPage() {
  const { state, actions } = useApp();
  const device = useDevice();
  const toast = useToast();
  const confirm = useConfirm();
  const live = useNow(1000);
  const checks = useEngineChecks();
  const [sheet, setSheet] = useState(false);
  const [modal, setModal] = useState(false);
  const [dur, setDur] = useState(150);
  const [ext, setExt] = useState(60);
  const [sel, setSel] = useState<string>("cp-palika");
  const [rollN, setRollN] = useState(136);

  const f = facilityOrThrow("cp-palika");
  const b = getBooking(state, "b-active") || state.bookings[0];
  const drive = getBooking(state, "b-khan") || state.bookings[0];
  const search = { ...state.search, destId: "cp", custom: undefined };
  const results = searchFacilities(state, { search }).results;
  const items = D.facilities.map((fac) => results.find((r) => r.f.id === fac.id) || measure(fac, search, state.bookings, state.demo.seed, "hatchback"));
  const dest = searchCenter(search);
  const startMs = new Date(state.search.start).getTime();
  const billQ = quote({ facility: f, start: Date.parse(b.start), end: Date.parse(b.end), mode: "hourly", vehicleType: "hatchback", promo: "PARK10", evCharging: true });
  const left = Date.parse(b.end) - live, total = Date.parse(b.end) - Date.parse(b.start);
  const pass = checks ? checks.filter((c) => c.ok).length : 0;
  const selF = facilityOrThrow(sel);

  return (
    <main className="page dev stack-24" style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 16px 80px" }}>
      <style>{`
        .dev-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
        .dev-map { height: 380px; border-radius: 20px; border: 1px solid var(--line); }
        .dev-thumbs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .dev-res { font: 500 13px/1.6 var(--font-mono); }
        .dev-res .ok { color: var(--ok); } .dev-res .no { color: var(--danger); }
        .dev-icons { display: grid; grid-template-columns: repeat(auto-fill, minmax(40px, 1fr)); gap: 8px; color: var(--ink-2); }
        .dev-icons span { display: grid; place-items: center; height: 36px; border-radius: 10px; background: var(--surface-2); }
      `}</style>
      <header className="row-between row-wrap gap-12">
        <Logo size={32} />
        <span className="eyebrow is-lime">Dev check · {device} · {state.vehicles.length} vehicles · {state.bookings.length} bookings</span>
      </header>

      <section className="card card-pad" data-testid="engine-checks">
        <div className="card-head">
          <h2 className="card-title">Engine checks</h2>
          <span id="sum" className={`badge ${checks ? (pass === checks.length ? "badge-ok" : "badge-danger") : "badge-neutral"}`}>{checks ? `${pass} / ${checks.length} passed` : "running"}</span>
        </div>
        <div className="dev-res">
          {checks?.map((c) => (
            <div key={c.name} className={c.ok ? "ok" : "no"}>{c.ok ? "PASS" : "FAIL"} · {c.name}{c.detail && <span className="muted"> — {c.detail}</span>}</div>
          ))}
        </div>
      </section>

      <section>
        <div className="section-title"><h2>Components</h2><span className="small muted">all shared parts</span></div>
        <div className="dev-grid">
          <div className="card card-pad stack-12">
            <div className="eyebrow">Buttons · overlays</div>
            <div className="row row-wrap gap-8">
              <button className="btn btn-primary btn-md" onClick={() => setSheet(true)}>Open sheet</button>
              <button className="btn btn-secondary btn-md" onClick={() => setModal(true)}>Open modal</button>
              <button className="btn btn-outline btn-sm" onClick={() => toast("Saved to your list", "ok", { label: "Undo", onClick: () => toast("Undone") })}>Toast</button>
              <button className="btn btn-danger btn-sm" onClick={async () => toast((await confirm({ title: "Cancel booking?", body: <>You get <b>₹106</b> back.</>, confirm: "Cancel booking", tone: "danger", cancel: "Keep it" })) ? "Confirmed" : "Kept", "info")}>Confirm</button>
              <button className="btn btn-ghost btn-sm">Ghost</button>
              <button className="btn btn-primary btn-sm is-loading">Pay</button>
            </div>
            <button className="btn btn-primary btn-lg btn-block">Pay {money(136)} and reserve</button>
          </div>
          <div className="card card-pad stack-12">
            <div className="eyebrow">Chips · badges</div>
            <div className="chip-row"><button className="chip is-on"><Icon name="zap" size={15} />EV</button><button className="chip">Covered</button><button className="chip chip-sm">Within 2 km <Icon name="x" size={13} className="chip-x" /></button></div>
            <div className="chip-row"><Badge tone="ok">Available</Badge><Badge tone="warn">4 left</Badge><Badge tone="danger">Full</Badge><Badge tone="lime" icon="zap">Instant</Badge><Badge>Garage</Badge>{state.bookings.slice(0, 3).map((x) => <StatusBadge key={x.id} booking={x} now={live} />)}</div>
          </div>
          <div className="card card-pad stack-12">
            <div className="eyebrow">Plate · occupancy · stars · amenities</div>
            <div className="row row-wrap gap-8"><Plate plate="DL 8C AF 4521" /><Plate plate="DL 1C AK 9087" size="sm" /><Plate plate="HR 26 DK 8337" size="lg" /></div>
            <OccupancyBar free={38} capacity={120} /><OccupancyBar free={5} capacity={120} /><OccupancyBar free={0} capacity={60} />
            <Stars rating={4.6} count={1284} row />
            <AmenityIcons facility={f} max={5} />
          </div>
          <div className="card card-pad"><div className="eyebrow mb-12">Bill (PARK10 + EV)</div><Bill quote={billQ} totalLabel="Total to pay" /></div>
          <div className="card card-pad row gap-16">
            <Ring frac={Math.max(0, left / total)} size={132} tone={left < 15 * 60000 ? "warn" : "lime"}><div className="eyebrow">Time left</div><div className="ring-time">{countdown(left)}</div></Ring>
            <Ring frac={0.12} size={96} tone="warn"><div className="ring-time" style={{ fontSize: 18 }}>9:41</div></Ring>
          </div>
          <div className="card card-pad stack-12">
            <div className="eyebrow">Roll · count-up · skeleton</div>
            <div className="row gap-12"><span className="price-lg"><RollNumber value={money(rollN)} /></span><button className="btn btn-secondary btn-sm" onClick={() => setRollN((n) => n + 38)}>+ ₹38</button><span className="price"><CountUp to={1250} format={money} /></span></div>
            <Skeleton width="70%" /><Skeleton width="45%" />
            <SkeletonCard />
          </div>
          <div className="card card-pad stack-12">
            <div className="eyebrow">Heat · notices · lane</div>
            <div className="heat">
              {hourlyAvailability(f, startOfDay(engNow()), [], 1).slice(6, 18).map((c, i) => (
                <button key={c.hour} className={`heat-cell ${c.free < 0 ? "h-closed" : "h-" + availTone(c.free, f.capacity)} ${i === 4 ? "is-sel" : ""}`}>{String(c.hour).padStart(2, "0")}<span className="n">{c.free < 0 ? "–" : c.free}</span></button>
              ))}
            </div>
            <div className="notice notice-warn"><Icon name="triangle-alert" size={16} /><span>Ends in 12 min. Extend now to avoid overstay charges.</span></div>
            <hr className="lane" />
            <dl className="kv"><div><dt>Entry</dt><dd className="mono">{timeLabel(b.start)}</dd></div><div><dt>Bay</dt><dd className="mono">{b.bay}</dd></div></dl>
          </div>
          <div className="card card-pad stack-12">
            <div className="eyebrow">Icons ({Object.keys(ICONS).length}) · QR</div>
            <div className="dev-icons">{Object.keys(ICONS).map((n) => <span key={n} title={n}><Icon name={n} size={16} /></span>)}</div>
            <div className="row gap-12"><QRCode text="PARKLY|PK-7HQK-42|DL 8C AF 4521" size={96} /><span className="small muted">Real QR (scan it): PARKLY|PK-7HQK-42|DL 8C AF 4521</span></div>
          </div>
        </div>
      </section>

      <section>
        <div className="section-title"><h2>Map · Connaught Place</h2><span className="small muted">selected: {selF.name}</span></div>
        <SvgMap className="dev-map" items={items} dest={dest} radiusKm={2} selectedId={sel} routeTo={selF}
          onSelect={(id) => { setSel(id); toast(facilityOrThrow(id).name, "info"); }}
          onSearchArea={(c) => toast(`Search at ${c.lat.toFixed(3)}, ${c.lng.toFixed(3)}`, "info")} />
        <div className="dev-grid mt-16">
          <SvgMap className="dev-map" style={{ height: 160 }} items={items} dest={dest} radiusKm={3} compact onOpen={() => toast("Open map", "info")} />
          <SvgMap className="dev-map" style={{ height: 160 }} items={[measure(f, search, state.bookings, state.demo.seed, "hatchback")]} dest={dest} selectedId={f.id} routeTo={f} radiusKm={0.8} compact onOpen={() => toast("Directions", "info")} />
        </div>
      </section>

      <section className="dev-grid">
        <div className="card card-pad stack-12"><div className="card-head"><h2 className="card-title">Time dial</h2><span className="mono small">{dur} min</span></div><Dial value={dur} onChange={setDur} startMs={startMs} /></div>
        <div className="card card-pad stack-12"><div className="card-head"><h2 className="card-title">Extend dial</h2><span className="mono small">+{ext} min</span></div>
          <Dial size="sm" value={ext} onChange={setExt} minMin={30} maxMin={180} label="Add" prefix="+" sub={(v) => <>New exit <b>{timeLabel(Date.parse(b.end) + v * 60000)}</b></>} />
        </div>
      </section>

      <section className="dev-grid">
        <div className="stack-12"><div className="eyebrow">Pass · mobile (printing)</div><Pass booking={b} now={live} printing variant="mobile" /></div>
        <div className="stack-12"><div className="eyebrow">Pass · desktop</div><Pass booking={drive} now={live} variant="desktop" /></div>
      </section>

      <section>
        <div className="section-title"><h2>Facility scenes</h2></div>
        <div className="dev-thumbs">
          {SCENES.map((s) => <figure key={s} style={{ margin: 0 }}><div className="illus-frame"><FacilityIllustration facility={f} scene={s} /></div><figcaption className="tiny muted mt-4">{f.name} · {s}</figcaption></figure>)}
          {["jorbagh", "aerocity-ev", "khan"].map((id) => { const x = facilityOrThrow(id); return <figure key={id} style={{ margin: 0 }}><div className="illus-frame"><FacilityIllustration facility={x} /></div><figcaption className="tiny muted mt-4">{x.name} · default</figcaption></figure>; })}
        </div>
      </section>

      <section className="card card-pad stack-12">
        <div className="eyebrow">Test clock</div>
        <div className="row row-wrap gap-8">
          <button className="btn btn-secondary btn-sm" onClick={() => actions.advanceClock(30)}>+30 min</button>
          <button className="btn btn-secondary btn-sm" onClick={() => toast(actions.jumpToNextEvent() || "No upcoming event", "info")}>Jump to next event</button>
          <button className="btn btn-outline btn-sm" onClick={() => actions.setClockOffset(0)}>Real time</button>
          <span className="mono small muted">offset {state.demo.clockOffsetMin} min · now {timeLabel(live)}</span>
        </div>
      </section>

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Filters" footer={<button className="btn btn-primary btn-md" data-close>Show {results.length} results</button>}>
        <p className="small ink-2">Bottom sheet on mobile (drag the grabber down to dismiss), centred modal on desktop. Esc and the backdrop close it.</p>
        <div className="chip-row mt-12">{["Covered", "EV", "Accessible", "Overnight"].map((c) => <button key={c} className="chip">{c}</button>)}</div>
      </Sheet>
      <Modal open={modal} onClose={() => setModal(false)} title="Your pass" size="sm">
        <Pass booking={b} now={live} printing variant={device} />
      </Modal>
    </main>
  );
}
