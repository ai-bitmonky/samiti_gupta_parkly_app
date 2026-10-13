"use client";
/* 0. LANDING (prototype Views.landing): marketing nav, hero with live SvgMap + tilted pass, search card,
   guarantee badges, how it works, departure-board stats, insights + HMWs, facilities carousel, CTA band, footer. */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp, useNow } from "@/lib/store";
import { availability, dayLabel, defaultVehicle, facilityOrThrow, hoursLabel, rateFor, reducedMotion, searchCenter, timeLabel, durationShort } from "@/lib/engine";
import type { Booking } from "@/lib/data";
import Icon from "@/components/shared/Icon";
import Logo from "@/components/shared/Logo";
import SvgMap from "@/components/shared/SvgMap";
import Pass from "@/components/shared/Pass";
import Stars from "@/components/shared/Stars";
import OccupancyBar from "@/components/shared/OccupancyBar";
import FacilityIllustration from "@/components/shared/FacilityIllustration";
import DesktopShell, { useTitle } from "./DesktopShell";
import { Rup, WhereBox, durMin, measureAll, useOpenWhen, vtype, win } from "./common";

const visGate = (
  <svg viewBox="0 0 300 120" aria-hidden="true"><rect width="300" height="120" fill="#141B17" /><path d="M0 96h300" stroke="#2B3A31" strokeWidth="18" /><path d="M0 96h300" stroke="#F5F4EF" strokeOpacity=".2" strokeDasharray="10 12" /><rect x="40" y="40" width="12" height="48" fill="#3A4741" /><rect x="46" y="44" width="110" height="7" rx="3.5" fill="#FF5A5F" /><rect x="70" y="16" width="56" height="20" rx="6" fill="#1A2420" stroke="#FF5A5F" strokeOpacity=".6" /><text x="98" y="30" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="11" fontWeight="700" fill="#FF5A5F">₹ ??</text><rect x="180" y="28" width="96" height="58" rx="10" fill="#1A2420" stroke="#C6F432" strokeOpacity=".5" /><text x="228" y="50" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="#F5F4EF" fillOpacity=".55">PAID</text><text x="228" y="72" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="18" fontWeight="700" fill="#C6F432">₹136</text></svg>
);
const visBill = (
  <svg viewBox="0 0 300 120" aria-hidden="true"><rect width="300" height="120" fill="#141B17" />{[0, 1, 2, 3].map((i) => <rect key={i} x={34 + i * 44} y={92 - (i + 1) * 18} width="30" height={(i + 1) * 18} rx="5" fill="#FF5A5F" fillOpacity={0.25 + i * 0.18} />)}<text x="34" y="18" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="#F5F4EF" fillOpacity=".5">DAY 1 → 4, PAY AT EXIT</text><path d="M210 92h70" stroke="#2B3A31" /><rect x="214" y="44" width="62" height="48" rx="6" fill="#C6F432" fillOpacity=".18" stroke="#C6F432" /><text x="245" y="64" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="#C6F432">CAPPED</text><text x="245" y="82" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="13" fontWeight="700" fill="#C6F432">₹/day</text><text x="34" y="110" fontFamily="JetBrains Mono, monospace" fontSize="8" fill="#F5F4EF" fillOpacity=".4">D1   D2   D3   D4</text></svg>
);
const visConflict = (
  <svg viewBox="0 0 300 120" aria-hidden="true"><rect width="300" height="120" fill="#141B17" />{[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={24 + i * 44} y="18" width="1.6" height="84" fill="#F5F4EF" opacity=".25" />)}<rect x="114" y="22" width="38" height="76" rx="4" fill="#C6F432" fillOpacity=".14" stroke="#C6F432" strokeWidth="1.5" /><text x="133" y="64" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="11" fontWeight="700" fill="#C6F432">B14</text><rect x="32" y="30" width="26" height="54" rx="8" fill="#6F827B" /><rect x="208" y="30" width="26" height="54" rx="8" fill="#3D5A80" /><rect x="72" y="40" width="26" height="54" rx="8" fill="#D9D6CC" transform="rotate(-14 85 67)" /><text x="104" y="16" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="#FF5A5F">MINE!</text><text x="168" y="112" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="#F5F4EF" fillOpacity=".5">NAMED BAY = NO ARGUMENT</text></svg>
);

const INS = [
  { tag: "I2", t: "The price is decided at the gate", p: "Without a fixed price there is nothing to hold the attendant to. Drivers pay what they are told.", fix: "You see the full price, with tax, before you pay. The same number is on your pass.", vis: visGate },
  { tag: "I3", t: "Long stays end in bill shock", p: "On multi-day stays the total only shows up at the exit. You can't compare it with a cab.", fix: "Daily caps are applied for you and the total is shown up front, even for 4 days.", vis: visBill },
  { tag: "I4", t: "Not knowing leads to fights", p: "Police get about 250 parking-dispute calls a day. Most start with “this spot is mine”.", fix: "A named bay and a QR pass settle it. Scan, the barrier lifts, done.", vis: visConflict },
];
const HMW: [string, string, string][] = [
  ["show space for the hours a driver needs, not just “now”?", "Free spaces for your exact time", "clock"],
  ["fix the full price before the driver commits?", "Itemised price before you pay", "tag"],
  ["replace the gate argument with proof of a reserved space?", "QR pass with your bay", "qr-code"],
  ["let drivers change plans without penalties or surprises?", "Extend or cancel, refund shown", "rotate-ccw"],
];
const BOARD: [string, string, string, string, string, string][] = [
  ["Vehicles registered in Delhi", "As of 2021", "1.22", "cr", "TOO MANY", "warn"],
  ["Cars that fit in the city's ~560 parking sites", "Designated spaces", "~30,000", "", "TOO FEW", "danger"],
  ["Time lost per trip looking for a spot", "Industry estimate", "10–15", "min", "WASTED", "warn"],
  ["Parking-dispute calls to police each day", "Delhi Police", "~250", "", "AVOIDABLE", "danger"],
];
const STEPS: [string, string, string][] = [
  ["search", "Search", "Type where you are going and when. We show every lot with free spaces for that exact time."],
  ["columns", "Compare", "Price for your whole stay, walking time, rating and free spaces. Side by side, up to three lots."],
  ["calendar-check", "Book", "Pick your car and pay by UPI or card. The price you see is the price you pay."],
  ["qr-code", "Scan and park", "Show the QR pass at the barrier. It lifts, and your bay number is on the pass."],
];
const FEATURED = ["cp-palika", "khan", "saket", "igi-t3", "aerocity-ev", "cyberhub", "hkv", "jorbagh"];

/** Odometer flap digits: each digit is a 0–9 strip that rolls to its value when `rolled`. */
function Odometer({ text, rolled, offset }: { text: string; rolled: boolean; offset: number }) {
  let n = offset;
  return (
    <>
      {[...text].map((c, i) => {
        if (/\d/.test(c)) {
          const k = n++;
          return (
            <span key={i} className="flap"><span className="flap-odo">
              <span className="flap-strip" style={{ transitionDelay: `${k * 70}ms`, transform: rolled ? `translateY(-${+c * 32}px)` : undefined }}>
                {"0123456789".split("").map((d) => <i key={d}>{d}</i>)}
              </span>
            </span></span>
          );
        }
        return c === " " ? <span key={i} style={{ width: 8 }} /> : <span key={i} className="flap is-sym">{c}</span>;
      })}
    </>
  );
}

function LandingView() {
  useTitle("PARKLY · Your spot, reserved");
  const { state, actions } = useApp();
  const router = useRouter();
  const openWhen = useOpenWhen();
  const t = useNow(1000);
  const root = useRef<HTMLDivElement>(null);
  const car = useRef<HTMLDivElement>(null);
  const [rolled, setRolled] = useState(false);
  const w = win(state);
  const vt = vtype(state);
  const center = searchCenter(state.search);
  const items = useMemo(() => measureAll(state), [state]);
  const sample = useMemo(() => ({
    id: "sample", ref: "PK-7HQK-42", facilityId: "cp-palika", bay: "L2 · Bay 14", start: new Date(w.s).toISOString(), end: new Date(w.e).toISOString(),
    vehicle: { name: "", plate: defaultVehicle(state).plate, type: vt }, confirmedAt: new Date(0).toISOString(),
  }) as unknown as Booking, [w.s, w.e, state, vt]);
  const featured = FEATURED.map(facilityOrThrow);

  // scroll reveal (.sr → .is-in); the board's odometers roll when it scrolls into view
  useEffect(() => {
    const els = Array.from(root.current?.querySelectorAll<HTMLElement>(".sr") || []);
    if (reducedMotion() || typeof IntersectionObserver === "undefined") { els.forEach((e) => e.classList.add("is-in")); setRolled(true); return; }
    const io = new IntersectionObserver((ents) => ents.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add("is-in");
      if (en.target.id === "board") setRolled(true);
      io.unobserve(en.target);
    }), { threshold: 0.18 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
  // hero map: the wheel scrolls the page instead of zooming the map
  const mapCol = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = mapCol.current;
    if (!el) return;
    const stop = (e: WheelEvent) => e.stopPropagation();
    el.addEventListener("wheel", stop, { capture: true });
    return () => el.removeEventListener("wheel", stop, { capture: true });
  }, []);

  const start = () => { if (!state.onboarded) actions.completeOnboarding(false); router.push("/explore"); };
  const jump = (e: React.MouseEvent, id: string) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" }); };
  let digit = 0;

  return (
    <div className="ld" ref={root}>
      <nav className="ld-nav"><div className="ld-wrap">
        <Link href="/" aria-label="PARKLY home"><Logo size={32} /></Link>
        <a className="lnk" href="#how" onClick={(e) => jump(e, "how")}>How it works</a>
        <a className="lnk" href="#why" onClick={(e) => jump(e, "why")}>Why pre-book</a>
        <a className="lnk" href="#spots" onClick={(e) => jump(e, "spots")}>Popular spots</a>
        <span className="grow" />
        <Link className="btn btn-ghost btn-md" href="/bookings">My bookings</Link>
        <Link className="btn btn-secondary btn-md" href="/explore">Open the app <Icon name="arrow-right" size={16} /></Link>
      </div></nav>

      <section className="ld-hero grain">
        <div className="ld-wrap">
          <div className="ld-copy">
            <div className="eyebrow is-lime rv" style={{ ["--d" as string]: 0 }}>Parking in Delhi NCR</div>
            <h1 className="ld-h"><span className="rv" style={{ ["--d" as string]: 1 }}>Your spot,</span><span className="rv lime" style={{ ["--d" as string]: 2 }}>reserved.</span></h1>
            <p className="ld-sub rv" style={{ ["--d" as string]: 3 }}>Book a parking space near where you are going. See the full price before you pay. Scan your pass at the gate. No circling, no arguing.</p>
            <form className="ld-search rv" style={{ ["--d" as string]: 4 }} autoComplete="off" onSubmit={(e) => { e.preventDefault(); start(); }}>
              <div className="sf sf-where"><span className="lbl">Where</span><WhereBox /></div>
              <button type="button" className="sf" onClick={() => openWhen()}><span className="lbl">Enter after</span><span className="v"><Icon name="calendar-clock" size={16} className="lime" />{dayLabel(w.s)}, {timeLabel(w.s)}</span></button>
              <button type="button" className="sf" onClick={() => openWhen()}><span className="lbl">Exit before · {durationShort(durMin(state))}</span><span className="v"><Icon name="clock" size={16} className="lime" />{dayLabel(w.e) !== dayLabel(w.s) ? dayLabel(w.e) + ", " : ""}{timeLabel(w.e)}</span></button>
              <button type="submit" className="btn btn-primary btn-lg is-mag"><Icon name="search" size={19} /> Find parking</button>
            </form>
            <div className="ld-guar rv" style={{ ["--d" as string]: 5 }}>
              <span><Icon name="shield-check" size={16} />Space guaranteed</span><span><Icon name="tag" size={16} />Price fixed upfront</span>
              <span><Icon name="rotate-ccw" size={16} />Refund shown before you cancel</span><span><Icon name="qr-code" size={16} />Scan to enter</span>
            </div>
          </div>
          <div className="ld-mapcol" ref={mapCol}>
            <SvgMap className="ld-map" items={items} dest={center} radiusKm={1.6} selectedId="cp-palika" showControls={false}
              onSelect={(id) => router.push("/parking/" + id)} ariaLabel="Live parking prices near your destination" />
          </div>
        </div>
        <div className="ld-live"><span className="live-dot" />Live prices near {center.name}</div>
        <div className="ld-pass" aria-hidden="true"><div className="ld-pass-inner"><Pass booking={sample} facility={facilityOrThrow("cp-palika")} now={t} variant="desktop" compact /></div></div>
      </section>

      <section className="ld-sec" id="how"><div className="ld-wrap">
        <div className="ld-sec-head sr"><div><div className="eyebrow is-lime mb-12">How it works</div><h2 className="sec-h">Four steps. Two minutes.</h2></div><p>Do it from the sofa before you leave home. You arrive, scan, and park in your own bay.</p></div>
        <div className="steps">{STEPS.map(([ic, h, p], i) => (
          <div key={h} className="card step card-hover sr" style={{ transitionDelay: `${i * 80}ms` }}><div className="step-n">0{i + 1}</div><div className="step-ico"><Icon name={ic} size={26} /></div><h3>{h}</h3><p>{p}</p></div>
        ))}</div>
      </div></section>

      <section className="ld-sec"><div className="ld-wrap">
        <div className="ld-sec-head sr"><div><div className="eyebrow is-lime mb-12">The problem in numbers</div><h2 className="sec-h">Too many cars.<br />Too few known spaces.</h2></div><p>{"There is space in Delhi, but drivers can't see it. PARKLY shows it before you set off."}</p></div>
        <div className="board sr" id="board">
          <div className="board-head"><span>DELHI PARKING · STATUS BOARD</span><span className="clock">{timeLabel(t).toUpperCase()}</span></div>
          <div className="board-cols"><span>WHAT</span><span>NUMBER</span><span style={{ textAlign: "right" }}>STATUS</span></div>
          {BOARD.map(([what, src, val, unit, stt, tone]) => {
            const off = digit; digit += (val.match(/\d/g) || []).length;
            return (
              <div key={what} className="board-row">
                <div className="board-what">{what}<small>{src}</small></div>
                <div className="flaps"><Odometer text={val} rolled={rolled} offset={off} />{unit && <span className="flap is-unit">{unit}</span>}</div>
                <span className={`board-st st-${tone}`}>{stt}</span>
              </div>
            );
          })}
          <div className="board-foot">Figures from the PARKLY research: Delhi transport records (2021), EPCA, Delhi Police reports and industry estimates. Used to size the problem.</div>
        </div>
      </div></section>

      <section className="ld-sec" id="why"><div className="ld-wrap">
        <div className="ld-sec-head sr"><div><div className="eyebrow is-lime mb-12">Why drivers pre-book</div><h2 className="sec-h">{"It's not only space."}<br />{"It's trust."}</h2></div><p>What drivers told us goes wrong, and what PARKLY does about it.</p></div>
        <div className="grid-3">{INS.map((x, i) => (
          <article key={x.tag} className="card ins card-hover sr" style={{ transitionDelay: `${i * 80}ms` }}>
            <div className="ins-vis">{x.vis}</div><div className="ins-tag">{x.tag}</div><h3>{x.t}</h3><p>{x.p}</p>
            <div className="ins-fix"><Icon name="circle-check" size={18} /><span>{x.fix}</span></div>
          </article>
        ))}</div>
        <div className="grid-4 mt-24">{HMW.map(([q, a, ic], i) => (
          <div key={a} className="card hmw sr" style={{ transitionDelay: `${i * 70}ms` }}><div className="eyebrow">How might we</div><q>{q}</q><div className="ans"><Icon name={ic} size={16} />{a}</div></div>
        ))}</div>
      </div></section>

      <section className="ld-sec" id="spots"><div className="ld-wrap">
        <div className="ld-sec-head sr"><div><div className="eyebrow is-lime mb-12">Popular spots</div><h2 className="sec-h">Places drivers book most</h2></div>
          <div className="row gap-8">
            <button type="button" className="btn btn-outline btn-icon btn-md" aria-label="Previous" onClick={() => car.current?.scrollBy({ left: -320, behavior: "smooth" })}><Icon name="chevron-left" size={18} /></button>
            <button type="button" className="btn btn-outline btn-icon btn-md" aria-label="Next" onClick={() => car.current?.scrollBy({ left: 320, behavior: "smooth" })}><Icon name="chevron-right" size={18} /></button>
          </div></div>
        <div className="car-row" ref={car}>{featured.map((f) => {
          const a = availability(f, w.s, w.e, state.bookings, state.demo.seed).free;
          return (
            <Link key={f.id} className="card fc card-hover" href={`/parking/${f.id}`}>
              <div className="illus-frame"><FacilityIllustration facility={f} /></div>
              <div className="fc-body">
                <div className="row-between"><span className="fc-name">{f.name}</span><Stars rating={f.rating} /></div>
                <div className="small muted">{f.area} · {hoursLabel(f)}</div>
                <OccupancyBar free={a} capacity={f.capacity} />
                <div className="row-between"><span className="small ink-2">{f.instant ? "Instant booking" : "Owner confirms"}</span><span><span className="num" style={{ fontSize: 22 }}><Rup n={rateFor(f, vt)} /></span><span className="price-unit"> /h</span></span></div>
              </div>
            </Link>
          );
        })}</div>
      </div></section>

      <div className="ld-wrap"><section className="card card-forest cta-band grain sr">
        <div><h2 className="sec-h">Going out today?</h2><p className="ink-2 mt-12" style={{ maxWidth: 520 }}>Book now and your space is held until your entry time. Cancel early and get your money back. The refund is shown before you confirm.</p></div>
        <button type="button" className="btn btn-primary btn-lg is-mag" onClick={start}><Icon name="search" size={18} /> Find parking near me</button>
      </section></div>

      <footer className="ld-foot"><div className="ld-wrap"><hr className="hr-lane mb-24" />
        <div className="row-between">
          <div className="stack-8"><Logo size={28} /><p className="small muted" style={{ maxWidth: 340 }}>Pre-book parking in Delhi NCR. A design prototype: prices, spaces and payments are simulated.</p></div>
          <div className="row gap-24 small"><Link href="/explore">Find parking</Link><Link href="/bookings">My bookings</Link><Link href="/saved">Saved</Link><Link href="/profile">Help &amp; terms</Link></div>
          <span className="mono tiny muted">PARKLY desktop · v1.0</span>
        </div>
      </div></footer>
    </div>
  );
}

export default function Landing() {
  return <DesktopShell landing><LandingView /></DesktopShell>;
}
