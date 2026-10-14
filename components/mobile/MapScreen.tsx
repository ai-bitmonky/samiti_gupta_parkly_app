"use client";
/* 3 · MAP (prototype Screens.map): full-bleed schematic map (drag / pinch / +− / recentre, "Search this area"),
   floating glass search (destination sheet) + time button, filter / sort chips + "List", and a bottom preview card
   when a pin is tapped (walking route to the destination, price, amenities, occupancy, Details / Reserve).
   Tapping empty map closes the preview. Fixed screen with the tab bar. */
import { useState } from "react";
import { useApp } from "@/lib/store";
import { D, activeFilters, dayLabel, facility, kmLabel, searchCenter, searchFacilities } from "@/lib/engine";
import Icon from "@/components/shared/Icon";
import Stars from "@/components/shared/Stars";
import SvgMap from "@/components/shared/SvgMap";
import OccupancyBar from "@/components/shared/OccupancyBar";
import FacilityIllustration from "@/components/shared/FacilityIllustration";
import { useToast } from "@/components/shared/ToastProvider";
import { Price, Screen, W, amen, measureOne, tl } from "./kit";
import { DestSheet, FilterSheet, SortSheet, TimeSheet, useSheet } from "./sheets";
import { useScreenTitle } from "./title";

/** prototype filterRowHTML() + the "List" chip, inside the map's glass header */
function MapFilterRow() {
  const { state, actions } = useApp();
  const openSheet = useSheet();
  const af = activeFilters(state.search.filters);
  return (
    <div className="filter-row" style={{ margin: "10px 0 0", padding: 0 }}>
      <button type="button" className={`chip${af.length ? " is-on" : ""}`} onClick={() => openSheet(({ open, close }) => <FilterSheet open={open} onClose={close} />)}>
        <Icon name="sliders-horizontal" size={15} />Filters{af.length ? <span className="n">{af.length}</span> : null}
      </button>
      <button type="button" className="chip" onClick={() => openSheet(({ open, close }) => <SortSheet open={open} onClose={close} />)}>
        <Icon name="list" size={15} />{D.sortLabels[state.search.sort]}<Icon name="chevron-down" size={14} />
      </button>
      {af.map((a) => (
        <button type="button" key={a.key} className="chip chip-sm" style={{ height: 36 }} onClick={() => actions.setFilters(a.clear(state.search.filters))}>
          {a.label}<Icon name="x" size={13} className="chip-x" />
        </button>
      ))}
      <button type="button" className="chip" data-go="/explore"><Icon name="list" size={15} />List</button>
    </div>
  );
}

function Preview({ id }: { id: string | null }) {
  const { state } = useApp();
  const f0 = id ? facility(id) : undefined;
  if (!id || !f0) return <div className="map-preview" hidden />;
  const r = searchFacilities(state).results.find((x) => x.f.id === id) || measureOne(state, f0), f = r.f;
  return (
    <div className="map-preview">
      <div className="mp-card anim-rise" key={id}>
        <div className="row gap-12">
          <div className="thumb" style={{ width: 84, height: 72 }}><FacilityIllustration facility={f} /></div>
          <div className="grow"><b className="h3 ellipsis" style={{ display: "block" }}>{f.name}</b>
            <div className="rcard-meta"><span className="mono">{kmLabel(r.km)}</span>·<span>{r.walk} min walk</span>·<Stars rating={f.rating} /></div>
            <div className="row-between mt-8"><Price n={r.total} className="mp-sm" /><span className="amen-row">{amen(f, 3)}</span></div></div>
        </div>
        <div className="mt-12"><OccupancyBar free={r.free} capacity={f.capacity} className="occ-row" /></div>
        <div className="row gap-8 mt-12">
          <button type="button" className="btn btn-secondary btn-md" style={{ flex: 1 }} data-go={`/parking/${f.id}`}>Details</button>
          <button type="button" className="btn btn-primary btn-md" style={{ flex: 1.4 }} data-go={`/reserve/${f.id}`} disabled={r.free <= 0}>{r.free <= 0 ? "Full for your time" : "Reserve"}</button>
        </div>
      </div>
    </div>
  );
}

export default function MapScreen() {
  useScreenTitle("Map · PARKLY");
  const { state, actions } = useApp();
  const toast = useToast();
  const openSheet = useSheet();
  const [sel, setSel] = useState<string | null>(null);
  const w = W(state), c = searchCenter(state.search), items = searchFacilities(state).results;
  const selF = sel ? facility(sel) : undefined;
  return (
    <Screen tab fixed className={sel ? "has-preview" : ""}>
      <div className="mapfull" onClick={(e) => { if (!(e.target as HTMLElement).closest(".pin,.map-ctrl,.map-search-area") && sel) setSel(null); }}>
        <SvgMap style={{ position: "absolute", inset: 0 }} items={items} dest={c} radiusKm={state.search.filters.maxDistance || 3}
          selectedId={sel} routeTo={selF || null} onSelect={(id) => setSel(id)}
          onSearchArea={(p) => { actions.setCustomDestination({ name: "This area", lat: p.lat, lng: p.lng }); toast("Searching this area", "info"); }} />
      </div>
      <div className="map-top">
        <div className="map-glass">
          <button type="button" className="map-q tap" onClick={() => openSheet(({ open, close }) => <DestSheet open={open} onClose={close} />)}>
            <Icon name="search" size={18} /><span className="grow ellipsis"><b>{c.name}</b><small>{dayLabel(w.s)} · {tl(w.s)} – {tl(w.e)}</small></span>
          </button>
          <button type="button" className="map-when tap" aria-label="Change time" onClick={() => openSheet(({ open, close }) => <TimeSheet open={open} onClose={close} />)}><Icon name="clock" size={18} /></button>
        </div>
        <MapFilterRow />
      </div>
      <Preview id={sel} />
    </Screen>
  );
}
