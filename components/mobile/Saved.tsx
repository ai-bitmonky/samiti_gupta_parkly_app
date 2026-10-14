"use client";
/* PARKLY mobile · Saved.tsx — 12 SAVED (Parking | Searches seg with sliding thumb; saved places as result cards with
   heart / compare / book; saved searches with alert switches, run, delete, "Check alerts now") and 13 COMPARE
   (2–3 places side by side, sticky key column, best value per row). Prototype mobile.html Screens.saved / compare. */
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { D, activeFilters, dailyFor, destination, durationLabel, facility, hoursLabel, kmLabel, money, windowLabel } from "@/lib/engine";
import type { Facility } from "@/lib/data";
import type { Result } from "@/lib/engine";
import Icon from "@/components/shared/Icon";
import FacilityIllustration from "@/components/shared/FacilityIllustration";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/Confirm";
import { Bell, Empty, RCard, Screen, Seg, Topbar, W, measureOne, useNav, vt, wait } from "./kit";
import { useScreenRoute } from "./route";
import { useScreenTitle } from "./b-shared";

/* ───────────── 12 · SAVED ───────────── */
type STab = "parking" | "searches";
const sv = { tab: "parking" as STab }; // remembered across visits (prototype savedTab)

function SavedSearches() {
  const { state, actions } = useApp();
  const nav = useNav();
  const toast = useToast();
  const confirm = useConfirm();
  const [checking, setChecking] = useState(false);
  if (!state.savedSearches.length) {
    return <Empty ico="bookmark-plus" title="No saved searches" text="Save a search on Explore and we'll alert you when prices or spaces change."
      action={<button type="button" className="btn btn-primary btn-md" data-go="/explore">Go to Explore</button>} />;
  }
  const check = async () => {
    setChecking(true);
    await wait(800);
    const n = actions.checkAlerts();
    setChecking(false);
    toast(n ? `${n} new alert${n > 1 ? "s" : ""}. See Alerts.` : "No changes since the last check", n ? "ok" : "info", n ? { label: "Open", onClick: () => nav.go("/notifications") } : undefined);
  };
  return (
    <div className="stack-12">
      {state.savedSearches.map((s) => {
        const d = s.custom || destination(s.destId);
        return (
          <div className="card card-pad" key={s.id}>
            <div className="row-top gap-12">
              <span className="pay-ico"><Icon name="search" size={18} /></span>
              <div className="grow">
                <b className="small">{s.label}</b>
                <div className="tiny muted mt-4">{d ? d.name : ""} · {durationLabel(s.durationH)} · {activeFilters(s.filters).map((a) => a.label).join(", ") || "No filters"}</div>
                {s.lastPrice ? <div className="tiny mono ink-2 mt-4">Last check: from ₹{s.lastPrice}/h · {s.lastSpaces} spaces</div> : null}
              </div>
              <label className="switch" aria-label={`Alerts for ${s.label}`}>
                <input type="checkbox" checked={s.alerts} onChange={(e) => { const on = e.target.checked; actions.toggleSearchAlert(s.id); toast(on ? "Alerts on for this search" : "Alerts off", "info"); }} />
                <span className="switch-track" />
              </label>
            </div>
            <div className="row gap-8 mt-12">
              <button type="button" className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => { actions.runSavedSearch(s.id); nav.go("/explore"); }}><Icon name="search" size={15} />Run search</button>
              <button type="button" className="btn btn-secondary btn-sm btn-icon" aria-label="Delete search" onClick={async () => {
                if (await confirm({ title: "Delete this search?", body: "You'll stop getting alerts for it.", confirm: "Delete", tone: "danger", cancel: "Keep" })) { actions.removeSearch(s.id); toast("Search deleted", "info"); }
              }}><Icon name="trash" size={16} /></button>
            </div>
          </div>
        );
      })}
      <button type="button" className={`btn btn-outline btn-md btn-block${checking ? " is-loading" : ""}`} onClick={check}><Icon name="bell" size={17} />Check alerts now</button>
    </div>
  );
}

function SavedPlaces({ spots }: { spots: Facility[] }) {
  const { state } = useApp();
  if (!spots.length) {
    return <Empty ico="heart" title="Nothing saved yet" text="Tap the heart on any parking place to keep it here."
      action={<button type="button" className="btn btn-primary btn-md" data-go="/explore">Explore parking</button>} />;
  }
  return <div className="rlist m-stagger">{spots.map((f) => <RCard key={f.id} r={measureOne(state, f)} />)}</div>;
}

export function Saved() {
  useScreenTitle("Saved · PARKLY");
  const { state } = useApp();
  const { query } = useScreenRoute();
  const [tab, setTab] = useState<STab>(() => {
    const q = query.get("tab");
    if (q === "parking" || q === "searches") sv.tab = q;
    return sv.tab;
  });
  const [body, setBody] = useState<STab>(tab);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const pick = (k: STab) => {
    setTab(k); sv.tab = k;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setBody(k), 180); // let the thumb slide first (prototype)
  };
  const spots = state.savedIds.map(facility).filter(Boolean) as Facility[];
  return (
    <Screen tab tray>
      <Topbar title="Saved" large back={false} actions={<Bell />} />
      <div className="page">
        <Seg block className="mb-16" value={tab} onChange={pick} ariaLabel="Saved"
          options={[
            { value: "parking", label: <>Parking <span className="count">{spots.length}</span></> },
            { value: "searches", label: <>Searches <span className="count">{state.savedSearches.length}</span></> },
          ]} />
        <div>{body === "parking" ? <SavedPlaces spots={spots} /> : <SavedSearches />}</div>
      </div>
    </Screen>
  );
}

/* ───────────── 13 · COMPARE ───────────── */
type Row = [string, (r: Result) => string, boolean[]?];
export function Compare() {
  useScreenTitle("Compare · PARKLY");
  const { state, actions } = useApp();
  const toast = useToast();
  const rows = state.compareIds.map((id) => facility(id)).filter(Boolean).map((f) => measureOne(state, f as Facility));
  if (rows.length < 2) {
    return (
      <Screen>
        <Topbar title="Compare" large />
        <div className="page">
          <Empty ico="columns" title={rows.length ? "Add one more" : "Nothing to compare"} text="Tick “Compare” on 2 or 3 parking cards to see them side by side."
            action={<button type="button" className="btn btn-primary btn-md" data-go="/explore">Pick from Explore</button>} />
        </div>
      </Screen>
    );
  }
  const v = vt(state), w = W(state);
  const best = (fn: (r: Result) => number, low = true) => { const xs = rows.map(fn); const t = low ? Math.min(...xs) : Math.max(...xs); return xs.map((x) => x === t); };
  const R: Row[] = [
    ["Total for your time", (r) => money(r.total), best((r) => r.total)],
    ["Per hour", (r) => `₹${r.rate}`, best((r) => r.rate)],
    ["Per day", (r) => (r.f.dailyRate ? money(dailyFor(r.f, v) || 0) : "—"), best((r) => (r.f.dailyRate ? dailyFor(r.f, v) || 0 : 1e9))],
    ["Distance", (r) => `${kmLabel(r.km)} · ${r.walk} min`, best((r) => r.km)],
    ["Free spaces", (r) => (r.free > 0 ? `${r.free} of ${r.f.capacity}` : "Full"), best((r) => r.free, false)],
    ["Rating", (r) => `★ ${r.f.rating}`, best((r) => r.f.rating, false)],
    ["Type", (r) => D.typeLabels[r.f.type]],
    ["Hours", (r) => hoursLabel(r.f)],
    ["Security", (r) => r.f.security.map((s) => D.securityLabels[s]).join(", ")],
    ["EV charging", (r) => (r.f.ev ? `${r.f.ev.count} × ${r.f.ev.kw} kW` : "No")],
    ["Height limit", (r) => (r.f.heightLimit ? r.f.heightLimit + " m" : "None")],
    ["Cancellation", (r) => D.policies[r.f.policy].title],
  ];
  const remove = (id: string) => { const r = actions.toggleCompare(id); if (!r.ok) toast(r.error, "warn"); };
  return (
    <Screen>
      <Topbar title="Compare" large lead={`${rows.length} places · ${windowLabel(w.s, w.e)}`} />
      <div className="cmp-scroll" style={{ flex: "none" }}>
        <table className="cmp" style={{ ["--n" as string]: rows.length }}>
          <thead><tr><th className="cmp-k" />{rows.map((r) => (
            <th key={r.f.id}><div className="illus-frame"><FacilityIllustration facility={r.f} /></div><b className="small cmp-name">{r.f.name}</b><div className="tiny muted">{r.f.area}</div></th>
          ))}</tr></thead>
          <tbody>
            {R.map(([k, fn, b]) => (
              <tr key={k}><th className="cmp-k">{k}</th>{rows.map((r, i) => (
                <td key={r.f.id} className={b && b[i] ? "is-best" : undefined}>{b && b[i] ? <Icon name="circle-check" size={14} /> : null}{fn(r)}</td>
              ))}</tr>
            ))}
            <tr><th className="cmp-k" />{rows.map((r) => (
              <td key={r.f.id}>
                <button type="button" className="btn btn-primary btn-sm btn-block" data-go={`/reserve/${r.f.id}`} disabled={r.free <= 0}>Reserve</button>
                <button type="button" className="btn btn-ghost btn-sm btn-block mt-4" onClick={() => remove(r.f.id)}>Remove</button>
              </td>
            ))}</tr>
          </tbody>
        </table>
      </div>
      <p className="tiny muted center mt-12" style={{ padding: "0 16px 24px" }}><Icon name="circle-check" size={12} /> marks the best value in each row. Swipe sideways to see more.</p>
    </Screen>
  );
}
