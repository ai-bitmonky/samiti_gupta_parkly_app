"use client";
/* 1+2. EXPLORE + MAP (prototype exploreView): top bar with search + time window + filters/save search;
   split view — results rail (cards in Explore, compact rows in Map) + full-height map; hover card ↔ pin highlight,
   preview card over the map, compare tray, skeletons on a new search, price count-up on first paint. Filters modal. */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { D, activeFilters, availTone, facilityOrThrow, hoursLabel, kmLabel, money, reducedMotion, searchCenter, searchFacilities, toneClass, durationShort, windowLabel, defaultVehicle } from "@/lib/engine";
import type { Filters, SortKey } from "@/lib/data";
import type { Result } from "@/lib/engine";
import Icon from "@/components/shared/Icon";
import SvgMap from "@/components/shared/SvgMap";
import type { SvgMapHandle } from "@/components/shared/SvgMap";
import Stars from "@/components/shared/Stars";
import OccupancyBar from "@/components/shared/OccupancyBar";
import FacilityIllustration from "@/components/shared/FacilityIllustration";
import { amenityIcons } from "@/lib/engine";
import { Modal } from "@/components/shared/Overlay";
import { useToast } from "@/components/shared/ToastProvider";
import DesktopShell, { useModal, useTitle } from "./DesktopShell";
import { CountRup, EmptyState, Rup, Topbar, WhenButton, WhereBox, durMin, plural, totalFor, win } from "./common";

// survives navigation between Explore / Map / detail (like the prototype's `ex` object)
const ex = { selectedId: null as string | null, railOpen: true, firstPaint: true };

function ResultCard({ r, i, sel, hot, count, onSelect, onHover }: { r: Result; i: number; sel: boolean; hot: boolean; count: boolean; onSelect: (id: string) => void; onHover: (id: string | null) => void }) {
  const { state, actions } = useApp();
  const toast = useToast();
  const router = useRouter();
  const f = r.f, s = win(state).s, vt = defaultVehicle(state).type, full = r.free <= 0;
  const saved = state.savedIds.includes(f.id), cmp = state.compareIds.includes(f.id);
  return (
    <article className={`card rc card-hover${sel ? " is-active" : ""}${hot ? " is-hot" : ""}${full ? " is-full" : ""}${i < 4 ? " rv" : ""}`} style={{ ["--d" as string]: i }}
      data-id={f.id} tabIndex={0} aria-label={f.name}
      onMouseEnter={() => onHover(f.id)} onMouseLeave={() => onHover(null)}
      onClick={(e) => { if ((e.target as HTMLElement).closest("button,label,a,input")) return; onSelect(f.id); }}
      onDoubleClick={() => router.push("/parking/" + f.id)}
      onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) router.push("/parking/" + f.id); }}>
      <div className="rc-top">
        <div className="thumb rc-thumb"><FacilityIllustration facility={f} /></div>
        <div style={{ minWidth: 0 }}>
          <div className="rc-name" title={f.name}>{f.name}</div><div className="rc-meta">{f.area}</div>
          <div className="row gap-8 mt-8 small ink-2"><Stars rating={f.rating} count={f.reviewCount} /><span className="dot-sep" /><span className="mono nowrap">{kmLabel(r.km)} · {r.walk} min</span></div>
        </div>
        <div className="rc-price"><CountRup to={r.total} animate={count && i < 6} /><span className="price-unit">{money(r.rate)}/h</span></div>
      </div>
      <div className="rc-mid"><OccupancyBar free={r.free} capacity={f.capacity} />
        <div className="amen-row">{amenityIcons(f).slice(0, 5).map((a) => <span key={a.label} className="amen-chip" title={a.label}><Icon name={a.icon} size={14} /></span>)}</div></div>
      <div className="rc-strip">{[3, 6, 12].map((h) => <div key={h}><span>{h} h</span><b>{money(totalFor(f, s, h, vt))}</b></div>)}</div>
      <div className="rc-foot">
        <span className={`rc-reason${full ? " is-full" : ""}`}><Icon name={full ? "circle-x" : "sparkles"} size={14} /><span>{r.reason}</span></span>
        <label className="check" onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" checked={cmp} onChange={() => { const x = actions.toggleCompare(f.id); if (!x.ok) toast(x.error, "warn"); }} /><span className="check-box" />Compare
        </label>
        <button type="button" className={`heart${saved ? " is-on" : ""}`} aria-label={saved ? "Remove from saved" : "Save"} aria-pressed={saved}
          onClick={(e) => { e.stopPropagation(); actions.toggleSaved(f.id); toast(!saved ? "Saved. Find it under Saved." : "Removed from saved", "ok"); }}>
          <Icon name="heart" size={17} />
        </button>
      </div>
    </article>
  );
}

function MiniRow({ r, sel, hot, onSelect, onHover }: { r: Result; sel: boolean; hot: boolean; onSelect: (id: string) => void; onHover: (id: string | null) => void }) {
  const router = useRouter();
  const f = r.f;
  return (
    <div className={`mr${sel ? " is-active" : ""}${hot ? " is-hot" : ""}`} data-id={f.id} tabIndex={0} role="button" aria-label={f.name}
      onMouseEnter={() => onHover(f.id)} onMouseLeave={() => onHover(null)} onClick={() => onSelect(f.id)}
      onDoubleClick={() => router.push("/parking/" + f.id)} onKeyDown={(e) => { if (e.key === "Enter") router.push("/parking/" + f.id); }}>
      <div className="thumb"><FacilityIllustration facility={f} /></div>
      <div style={{ minWidth: 0 }}><div className="strong ellipsis">{f.name}</div>
        <div className="tiny muted">{kmLabel(r.km)} · <span className={`t-${toneClass(availTone(r.free, f.capacity))}`}>{r.free > 0 ? r.free + " free" : "Full"}</span></div></div>
      <span className="num"><Rup n={r.total} /></span>
    </div>
  );
}

function PreviewCard({ r, onClose }: { r: Result; onClose: () => void }) {
  const { state } = useApp();
  const router = useRouter();
  const f = r.f, full = r.free <= 0;
  return (
    <div className="card map-preview" key={f.id}>
      <div className="row-top gap-12"><div className="thumb" style={{ width: 96, height: 76 }}><FacilityIllustration facility={f} /></div>
        <div className="grow"><div className="row-between"><b className="h3 ellipsis">{f.name}</b><button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close preview"><Icon name="x" size={16} /></button></div>
          <div className="small muted">{f.area} · {r.walk} min walk · {hoursLabel(f)}</div><div className="mt-8"><Stars rating={f.rating} count={f.reviewCount} /></div></div></div>
      <div className="rc-mid mt-12"><OccupancyBar free={r.free} capacity={f.capacity} /><div className="right"><span className="num" style={{ fontSize: 26 }}><Rup n={r.total} /></span><div className="price-unit">for {durationShort(durMin(state))}</div></div></div>
      <div className="row gap-8 mt-12">
        <Link className="btn btn-secondary btn-md grow" href={`/parking/${f.id}`}>Details</Link>
        <button type="button" className="btn btn-primary btn-md grow is-mag" disabled={full} onClick={() => router.push("/reserve/" + f.id)}>{full ? "Full for your time" : "Reserve"}</button>
      </div>
    </div>
  );
}

function Tray() {
  const { state, actions } = useApp();
  const ids = state.compareIds;
  if (!ids.length) return null;
  return (
    <div className="tray map-tray"><Icon name="columns" size={18} className="lime" />
      <div className="tray-items">{ids.map((id) => <span key={id} className="tray-item"><span>{facilityOrThrow(id).name}</span><button type="button" onClick={() => actions.toggleCompare(id)} aria-label="Remove"><Icon name="x" size={13} /></button></span>)}</div>
      {ids.length < 2 ? <span className="btn btn-primary btn-sm" aria-disabled="true" style={{ opacity: 0.5 }} title="Tick one more place">Compare {ids.length}/3</span>
        : <Link className="btn btn-primary btn-sm" href="/compare">Compare {ids.length}/3</Link>}
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => actions.clearCompare()}>Clear</button>
    </div>
  );
}

/* Filters modal with a live result count */
const SWITCHES: [keyof Filters, string, string][] = [["onlyAvailable", "Has space for my time", "Hide places that are full"], ["ev", "EV charging", "Chargers you can reserve"], ["accessible", "Accessible bays", "Wide bays near the lift"], ["motorcycle", "Two-wheeler bays", ""], ["overnight", "Overnight parking", "Stay past midnight"], ["instant", "Instant booking", "Confirmed straight away"]];
export function FiltersModal({ open, close }: { open: boolean; close: () => void }) {
  const { state, actions } = useApp();
  const [n, setN] = useState<Filters>(() => JSON.parse(JSON.stringify(state.search.filters)));
  const count = useMemo(() => searchFacilities(state, { search: { ...state.search, filters: n } }).results.length, [state, n]);
  const set = (p: Partial<Filters>) => setN((x) => ({ ...x, ...p }));
  const chips = <K extends "maxDistance" | "minRating" | "types" | "security">(key: K, opts: [string | number, string][], multi: boolean) => (
    <div className="chip-row">{opts.map(([v, l]) => {
      const cur = n[key] as unknown;
      const on = multi ? (cur as (string | number)[]).includes(v) : cur === v;
      return <button type="button" key={String(v)} className={`chip chip-sm${on ? " is-on" : ""}`} onClick={() => {
        if (multi) { const arr = cur as (string | number)[]; set({ [key]: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] } as Partial<Filters>); }
        else set({ [key]: v } as Partial<Filters>);
      }}>{l}</button>;
    })}</div>
  );
  const price = n.maxPrice || 200;
  return (
    <Modal open={open} onClose={close} title="Filters" size="lg"
      footer={<><button type="button" className="btn btn-ghost btn-md" onClick={() => setN(JSON.parse(JSON.stringify(D.filterDefaults)))}>Reset all</button><span className="grow" />
        <button type="button" className="btn btn-primary btn-md" disabled={!count} onClick={() => { actions.setFilters(n); close(); }}>{count ? `Show ${plural(count, "result")}` : "No results. Loosen a filter"}</button></>}>
      <div className="grid-2" style={{ gap: 28 }}>
        <div className="stack-24">
          <div><div className="row-between mb-8"><span className="lbl">Highest price per hour</span><b className="mono">{n.maxPrice ? "₹" + n.maxPrice : "Any"}</b></div>
            <input type="range" className="range" min={20} max={200} step={10} value={price} aria-label="Highest price per hour" style={{ ["--p" as string]: `${(price - 20) / 1.8}%` }}
              onChange={(e) => { const v = +e.target.value; set({ maxPrice: v >= 200 ? 0 : v }); }} /></div>
          <div><div className="lbl mb-8">Distance from destination</div>{chips("maxDistance", [[1, "1 km"], [2, "2 km"], [5, "5 km"], [10, "10 km"], [0, "Any"]], false)}</div>
          <div><div className="lbl mb-8">Type of parking</div>{chips("types", Object.entries(D.typeLabels), true)}</div>
          <div><div className="lbl mb-8">Security</div>{chips("security", Object.entries(D.securityLabels), true)}</div>
          <div><div className="lbl mb-8">Rating</div>{chips("minRating", [[0, "Any"], [4, "4★ and up"], [4.5, "4.5★ and up"]], false)}</div>
        </div>
        <div className="stack-4">{SWITCHES.map(([k, l, sub]) => (
          <label key={k} className="switch switch-row" style={{ padding: "6px 0" }}>
            <span><span className="strong">{l}</span>{sub && <><br /><span className="tiny muted">{sub}</span></>}</span>
            <input type="checkbox" checked={!!n[k]} onChange={(e) => set({ [k]: e.target.checked } as Partial<Filters>)} /><span className="switch-track" />
          </label>
        ))}</div>
      </div>
    </Modal>
  );
}

function ExploreView({ mode }: { mode: "explore" | "map" }) {
  useTitle(mode === "map" ? "Map · PARKLY" : "Explore · PARKLY");
  const { state, actions } = useApp();
  const toast = useToast();
  const router = useRouter();
  const openModal = useModal();
  const mapRef = useRef<SvgMapHandle>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const results = useMemo(() => searchFacilities(state).results, [state]);
  const [selRaw, setSel] = useState<string | null>(ex.selectedId);
  const sel = selRaw && results.some((r) => r.f.id === selRaw) ? selRaw : null;
  useEffect(() => { ex.selectedId = sel; }, [sel]);
  const [pinHot, setPinHot] = useState<string | null>(null);
  const [railOpen, setRailOpen] = useState(ex.railOpen);
  const [count] = useState(() => { const c = ex.firstPaint; ex.firstPaint = false; return c; });
  const center = searchCenter(state.search);
  const fCount = activeFilters(state.search.filters).length;
  const chips = activeFilters(state.search.filters);

  // skeleton for 380 ms whenever the destination or the time window changes
  const skKey = `${state.search.destId}|${state.search.custom ? state.search.custom.lat + "," + state.search.custom.lng : ""}|${state.search.start}|${state.search.end}`;
  const lastKey = useRef(skKey);
  const [skeleton, setSkeleton] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);
  useEffect(() => {
    if (lastKey.current === skKey) return;
    lastKey.current = skKey;
    if (reducedMotion()) return;
    setSkeleton(true);
    const t = window.setTimeout(() => { setSkeleton(false); setFadeIn(true); }, 380);
    return () => window.clearTimeout(t);
  }, [skKey]);

  const select = (id: string, from: "list" | "pin") => {
    setSel(id);
    actions.viewed(id);
    if (from === "pin") railRef.current?.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
  };
  const hover = (id: string | null) => mapRef.current?.highlight(id);
  const selR = sel ? results.find((r) => r.f.id === sel) : undefined;
  const w = win(state);

  const left = (
    <div className="row gap-8" style={{ minWidth: 0 }}>
      <WhereBox />
      <WhenButton />
      <button type="button" className="btn btn-secondary btn-md" onClick={() => openModal(({ open, close }) => <FiltersModal open={open} close={close} />)}>
        <Icon name="sliders-horizontal" size={17} />Filters{fCount ? <> <span className="pill-count" style={{ background: "var(--lime)", color: "var(--on-lime)" }}>{fCount}</span></> : null}
      </button>
    </div>
  );
  const saveSearch = () => {
    actions.saveSearch(`${center.name} · ${durationShort(durMin(state))}`, true);
    toast("Search saved. We'll alert you when prices or spaces change.", "ok", { label: "View", onClick: () => router.push("/saved?tab=searches") });
  };

  return (
    <>
      <Topbar left={left} noSearch right={<button type="button" className="btn btn-ghost btn-md" onClick={saveSearch} title="Get alerts when prices or spaces change"><Icon name="bookmark-plus" size={17} /><span className="hide-narrow">Save search</span></button>} />
      <div className={`split${mode === "map" ? " is-mapmode" : ""}${mode === "map" && !railOpen ? " rail-closed" : ""}`}>
        <div className="split-rail" ref={railRef}>
          <div className="rail-head">
            <div className="row-between">
              <div style={{ minWidth: 0 }}><div className="rail-count ellipsis">{plural(results.length, "place")} near {center.name}</div>
                <div className="small muted ellipsis">{windowLabel(w.s, w.e)} · {defaultVehicle(state).name}</div></div>
              <select className="select input-sm" style={{ width: "auto" }} aria-label="Sort" value={state.search.sort} onChange={(e) => actions.setSearch({ sort: e.target.value as SortKey })}>
                {Object.entries(D.sortLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            {chips.length > 0 && (
              <div className="chip-row mt-12">{chips.map((x) => <button type="button" key={x.key} className="chip chip-sm" onClick={() => actions.setFilters(x.clear(state.search.filters))}>{x.label} <Icon name="x" size={13} className="chip-x" /></button>)}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => actions.resetFilters()}>Clear all</button></div>
            )}
          </div>
          {skeleton ? Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton sk-card" />)
            : !results.length ? <EmptyState ico="search-x" title="No parking matches" action={<button type="button" className="btn btn-primary btn-md" onClick={() => actions.resetFilters()}>Clear filters</button>}>Try a wider distance, remove a filter, or pick a different time.</EmptyState>
            : <div className={fadeIn ? "fade-in" : ""} key={skKey}>{results.map((r, i) => mode === "map"
              ? <MiniRow key={r.f.id} r={r} sel={sel === r.f.id} hot={pinHot === r.f.id} onSelect={(id) => select(id, "list")} onHover={hover} />
              : <ResultCard key={r.f.id} r={r} i={i} sel={sel === r.f.id} hot={pinHot === r.f.id} count={count} onSelect={(id) => select(id, "list")} onHover={hover} />)}</div>}
        </div>
        <div className="split-map">
          <SvgMap ref={mapRef} className="js-keymap" style={{ position: "absolute", inset: 0 }} items={results} dest={center} radiusKm={state.search.filters.maxDistance || 0}
            selectedId={sel} routeTo={selR ? selR.f : null}
            onSelect={(id) => select(id, "pin")} onPinHover={setPinHot}
            onSearchArea={(c) => { actions.setCustomDestination({ name: "Map area", lat: c.lat, lng: c.lng }); toast("Showing parking around this map area", "info"); }} />
          {mode === "map" && (
            <button type="button" className="btn btn-secondary btn-sm rail-toggle" onClick={() => { ex.railOpen = !railOpen; setRailOpen(!railOpen); }}>
              <Icon name={railOpen ? "chevron-left" : "list"} size={16} />{railOpen ? "Hide list" : "Show list"}
            </button>
          )}
          <Tray />
          {selR && <PreviewCard r={selR} onClose={() => setSel(null)} />}
        </div>
      </div>
    </>
  );
}

export function Explore() { return <DesktopShell><ExploreView mode="explore" /></DesktopShell>; }
export function MapView() { return <DesktopShell><ExploreView mode="map" /></DesktopShell>; }
