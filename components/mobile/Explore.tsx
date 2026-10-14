"use client";
/* 2 · EXPLORE (prototype Screens.explore): large "Explore" title with a lime greeting, destination search bar + when
   pill, quick-intent chips, compact map strip (tap → Map), "Recommended near …" with filter/sort chips and the result
   cards (skeleton for 420 ms whenever the search, availability, bookings or vehicles change, then a fade-in with the
   staggered rise and price count-up), "Save this search", recently viewed mini cards and your places.
   Pull to refresh (new availability seed + toast), compare tray, tab bar. */
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import {
  HOUR, MIN, at, ceilHalfHour, dateKey, dayLabel, destination as D_dest, facility, money, now as engNow, searchCenter, searchFacilities,
} from "@/lib/engine";
import type { AppState, Facility } from "@/lib/data";
import Icon from "@/components/shared/Icon";
import SvgMap from "@/components/shared/SvgMap";
import FacilityIllustration from "@/components/shared/FacilityIllustration";
import { useToast } from "@/components/shared/ToastProvider";
import {
  Bell, Empty, FilterRow, RCard, RM, Screen, SearchBar, Skel, Topbar, W, WhenPill, countUp, measureOne, tl, useNav, useScreen,
} from "./kit";
import { useScreenTitle } from "./title";

type Intent = "quick" | "day" | "air" | "ev";
const INTENTS: [Intent, string, string][] = [["quick", "timer", "Quick 1 hour"], ["day", "sun", "All day"], ["air", "plane", "Airport long-stay"], ["ev", "zap", "EV charging"]];
const INTENT_TOAST: Record<Intent, string> = { quick: "Showing 1-hour parking from now", day: "Showing all-day parking", air: "Airport long-stay, 3 days", ev: "Showing places with EV chargers" };

/** The state the results were last painted from: lags the live state by 420 ms (skeleton meanwhile), like the
    prototype's onState → skel(3) → setTimeout(resultsHTML). */
function useSettledResults(state: AppState) {
  const [shown, setShown] = useState(state);
  const [busy, setBusy] = useState(false);
  const [gen, setGen] = useState(0);
  const live = useRef(state);
  live.current = state;
  const first = useRef(true);
  const { search, bookings, vehicles, defaultVehicleId } = state, seed = state.demo.seed;
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setBusy(true);
    const t = window.setTimeout(() => { setShown(live.current); setBusy(false); setGen((g) => g + 1); }, RM() ? 0 : 420);
    return () => window.clearTimeout(t);
  }, [search, seed, bookings, vehicles, defaultVehicleId]);
  return { shown, busy, gen };
}

function Results({ st, busy, gen }: { st: AppState; busy: boolean; gen: number }) {
  const { actions } = useApp();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { if (gen) countUp(box.current); }, [gen]);
  if (busy) return <div ref={box}><Skel n={3} /></div>;
  const { results } = searchFacilities(st);
  const body = !results.length
    ? <Empty ico="search-x" title="No parking matches" text="Try a wider distance or fewer filters." action={<button type="button" className="btn btn-secondary btn-md" onClick={() => actions.resetFilters()}>Clear filters</button>} />
    : (
      <>
        <div className="rlist m-stagger">{results.slice(0, 8).map((r) => <RCard key={r.f.id} r={r} />)}</div>
        {results.length > 8 ? <button type="button" className="btn btn-secondary btn-md btn-block mt-12" data-go="/map">See all {results.length} on the map</button> : null}
      </>
    );
  return <div ref={box}>{gen ? <div className="fade-swap" key={gen}>{body}</div> : body}</div>;
}

function Mini({ f }: { f: Facility }) {
  const { state } = useApp();
  const r = measureOne(state, f);
  return (
    <a className="mini tap" data-go={`/parking/${f.id}`}>
      <div className="illus-frame"><FacilityIllustration facility={f} scene="entrance" /></div>
      <div className="mini-b"><b className="small ellipsis" style={{ display: "block" }}>{f.name}</b>
        <div className="row-between mt-4"><span className="mono small">{money(r.total)}</span><span className={`tiny ${r.free > 0 ? "t-ok" : "t-danger"}`}>{r.free > 0 ? r.free + " free" : "Full"}</span></div></div>
    </a>
  );
}

function ExploreBody() {
  const { state, actions } = useApp();
  const toast = useToast();
  const nav = useNav();
  const { el } = useScreen();
  const { shown, busy, gen } = useSettledResults(state);
  const st = state;
  const hr = new Date(engNow()).getHours(), first = st.user.guest ? "" : ", " + st.user.name.split(" ")[0];
  const greet = (hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening") + first;
  const shownRes = searchFacilities(shown).results, shownC = searchCenter(shown.search);
  const viewed = st.recentlyViewed.map(facility).filter(Boolean) as Facility[];

  const intent = (i: Intent) => {
    const s = ceilHalfHour(engNow() + 15 * MIN);
    if (i === "quick") actions.setSearch({ start: s, end: s + HOUR, mode: "hourly" });
    if (i === "day") {
      const d = at(dateKey(engNow() + (new Date(engNow()).getHours() >= 18 ? 24 * HOUR : 0)), "09:00").getTime(), t = Math.max(d, s);
      actions.setSearch({ start: t, end: t + 10 * HOUR, mode: "hourly" });
    }
    if (i === "air") { actions.setDestination("t3"); actions.setSearch({ start: s, end: s + 3 * 24 * HOUR, mode: "daily" }); }
    if (i === "ev") actions.setFilters({ ...st.search.filters, ev: true });
    toast(INTENT_TOAST[i], "info");
  };
  const place = (id: string) => { actions.setDestination(id); el.current?.scrollTo({ top: 0, behavior: RM() ? "auto" : "smooth" }); };
  const saveSearch = () => {
    const c = searchCenter(st.search), w = W(st);
    actions.saveSearch(`${c.name} · ${dayLabel(w.s)} ${tl(w.s)}`, true);
    toast("Search saved. We'll alert you when prices or spaces change.", "ok", { label: "View", onClick: () => nav.go("/saved", { tab: "searches" }) });
  };

  return (
    <>
      <Topbar title="Explore" large back={false} eyebrow={greet} eyeLime actions={<Bell />} />
      <div className="page">
        <div className="stack-12"><SearchBar /><WhenPill /></div>
        <div className="chip-scroll mt-12">
          {INTENTS.map(([k, ic, l]) => <button type="button" key={k} className="chip" onClick={() => intent(k)}><Icon name={ic} size={15} />{l}</button>)}
        </div>
        <div className="map-strip mt-16"><SvgMap compact items={shownRes} dest={shownC} radiusKm={shown.search.filters.maxDistance || 3} onOpen={() => nav.go("/map")} ariaLabel="Map of results. Opens the map." /></div>
        <hr className="lane-sep" />
        <div className="sec" style={{ marginTop: 24 }}>
          <div className="sec-head"><h2>Recommended near {shownC.name}</h2><span className="small muted mono">{shownRes.length}</span></div>
          <FilterRow />
          <Results st={shown} busy={busy} gen={gen} />
          <button type="button" className="btn btn-outline btn-md btn-block mt-16" onClick={saveSearch}><Icon name="bookmark-plus" size={17} />Save this search</button>
        </div>
        {viewed.length ? (
          <div className="sec"><div className="sec-head"><h2>Recently viewed</h2></div>
            <div className="mini-row">{viewed.map((f) => <Mini key={f.id} f={f} />)}</div></div>
        ) : null}
        <div className="sec"><div className="sec-head"><h2>Your places</h2></div>
          <div className="group">
            {st.savedPlaces.map((p) => {
              const d = D_dest(p.destId);
              return d ? (
                <button type="button" key={"sp-" + p.id} className="grow-row" onClick={() => place(d.id)}>
                  <span className="ri"><Icon name={p.label === "Home" ? "house" : "briefcase"} size={16} /></span>
                  <span className="lbl">{p.label}<small>{d.name}</small></span><Icon name="chevron-right" size={18} className="chev" />
                </button>
              ) : null;
            })}
            {st.recentDest.slice(0, 3).map(D_dest).filter(Boolean).map((d) => (
              <button type="button" key={"rd-" + d!.id} className="grow-row" onClick={() => place(d!.id)}>
                <span className="ri"><Icon name="clock" size={16} /></span>
                <span className="lbl">{d!.name}<small>{d!.area}</small></span><Icon name="chevron-right" size={18} className="chev" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
export default function Explore() {
  useScreenTitle("Explore · PARKLY");
  return <Screen tab tray ptr><ExploreBody /></Screen>;
}
