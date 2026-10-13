"use client";
/* 8. SAVED (parking cards + saved searches with alerts), 9. COMPARE (full table, best value ticks),
   10. NOTIFICATIONS (mark read / delete / clear all) — prototype Views.saved / compare / notifications. */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/lib/store";
import {
  D, activeFilters, ago, availability, dailyFor, destination, durationLabel, durationShort, facility as getFacility, hoursLabel, kmLabel, measure, money, unreadCount, windowLabel, defaultVehicle,
} from "@/lib/engine";
import Icon from "@/components/shared/Icon";
import Stars from "@/components/shared/Stars";
import OccupancyBar from "@/components/shared/OccupancyBar";
import FacilityIllustration from "@/components/shared/FacilityIllustration";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/Confirm";
import DesktopShell, { useTitle } from "./DesktopShell";
import { EmptyState, Rup, Topbar, durMin, plural, vtype, win, windowQuote } from "./common";
import { resetDraft } from "./Reserve";
import type { Facility } from "@/lib/data";

/* ── SAVED ── */
function SavedView() {
  useTitle("Saved · PARKLY");
  const { state, actions } = useApp();
  const router = useRouter();
  const toast = useToast();
  const tab = useSearchParams().get("tab") === "searches" ? "searches" : "parking";
  const w = win(state);
  const spots = state.savedIds.map(getFacility).filter(Boolean) as Facility[];
  const body = tab === "parking"
    ? (spots.length ? (
      <div className="grid-3">{spots.map((f, i) => {
        const a = availability(f, w.s, w.e, state.bookings, state.demo.seed).free, q = windowQuote(state, f);
        return (
          <article key={f.id} className={`card fc card-hover${i < 4 ? " rv" : ""}`} style={{ ["--d" as string]: i }}>
            <Link className="illus-frame" href={`/parking/${f.id}`}><FacilityIllustration facility={f} /></Link>
            <div className="fc-body">
              <div className="row-between"><Link className="fc-name" href={`/parking/${f.id}`} style={{ color: "var(--ink)" }}>{f.name}</Link>
                <button type="button" className="heart is-on" aria-label="Remove from saved" onClick={() => { actions.toggleSaved(f.id); toast("Removed from saved", "info", { label: "Undo", onClick: () => actions.toggleSaved(f.id) }); }}><Icon name="heart" size={17} /></button></div>
              <div className="small muted">{f.area} · {hoursLabel(f)}</div>
              <OccupancyBar free={a} capacity={f.capacity} />
              <div className="row-between"><span><span className="num" style={{ fontSize: 24 }}><Rup n={q.total} /></span><span className="price-unit"> for {durationShort(durMin(state))}</span></span>
                <button type="button" className="btn btn-primary btn-sm" disabled={a <= 0} onClick={() => { resetDraft(); router.push("/reserve/" + f.id); }}>{a > 0 ? "Quick book" : "Full"}</button></div>
            </div>
          </article>
        );
      })}</div>
    ) : <EmptyState ico="heart" title="No saved spots yet" action={<Link className="btn btn-primary btn-md" href="/explore">Find parking</Link>}>Tap the heart on any parking place to keep it here for next time.</EmptyState>)
    : (state.savedSearches.length ? state.savedSearches.map((x) => {
      const d = x.custom || destination(x.destId);
      const fl = activeFilters({ ...D.filterDefaults, ...x.filters });
      return (
        <div key={x.id} className="card ss">
          <div className="row gap-16"><div className="icon-tile is-lime"><Icon name="search" size={18} /></div>
            <div><b>{x.label}</b><div className="small muted">{d ? d.name : ""} · {durationLabel(x.durationH)}{fl.length ? " · " + fl.map((y) => y.label).join(", ") : ""}</div>
              {x.lastPrice ? <div className="tiny mono ink-2 mt-4">Last check: from {money(x.lastPrice)}/h · {x.lastSpaces} spaces</div> : null}</div></div>
          <div className="row gap-8">
            <label className="switch" title="Alerts"><input type="checkbox" checked={x.alerts} onChange={() => actions.toggleSearchAlert(x.id)} aria-label="Alerts" /><span className="switch-track" /><span className="small"><Icon name={x.alerts ? "bell" : "bell-off"} size={15} /></span></label>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { actions.runSavedSearch(x.id); router.push("/explore"); }}>Run search</button>
            <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Delete" onClick={() => { actions.removeSearch(x.id); toast("Search deleted", "info"); }}><Icon name="trash" size={16} /></button>
          </div>
        </div>
      );
    }) : <EmptyState ico="bookmark-plus" title="No saved searches" action={<Link className="btn btn-primary btn-md" href="/explore">Go to Explore</Link>}>{"Save a search from Explore and we'll alert you when prices or spaces change."}</EmptyState>);
  const check = () => { const n = actions.checkAlerts(); toast(n ? `${plural(n, "new alert")}. See Notifications.` : "No changes since the last check.", n ? "ok" : "info", n ? { label: "Open", onClick: () => router.push("/notifications") } : undefined); };
  return (
    <>
      <Topbar title="Saved" />
      <div className="page">
        <div className="page-head"><div><h1 className="h1d">Saved</h1><p>Your favourite places and the searches you run often.</p></div>
          <div className="row gap-8">
            {tab === "searches" && state.savedSearches.length > 0 && <button type="button" className="btn btn-secondary btn-md" onClick={check}><Icon name="refresh-cw" size={16} />Check alerts now</button>}
            <div className="seg"><Link href="/saved" className={tab === "parking" ? "is-on" : ""}>Parking <span className="count">{spots.length}</span></Link><Link href="/saved?tab=searches" className={tab === "searches" ? "is-on" : ""}>Searches <span className="count">{state.savedSearches.length}</span></Link></div>
          </div></div>
        {body}
      </div>
    </>
  );
}
export function Saved() { return <DesktopShell><SavedView /></DesktopShell>; }

/* ── COMPARE ── */
function CompareView() {
  useTitle("Compare · PARKLY");
  const { state, actions } = useApp();
  const router = useRouter();
  const ids = state.compareIds, w = win(state), vt = vtype(state);
  if (ids.length < 2) {
    const one = ids[0] && getFacility(ids[0]);
    return (
      <>
        <Topbar title="Compare" />
        <div className="page"><div className="page-head"><div><h1 className="h1d">Compare</h1><p>See up to three places side by side.</p></div></div>
          <div className="card"><EmptyState ico="columns" title={ids.length ? "Add one more place" : "Nothing to compare yet"} action={<Link className="btn btn-primary btn-md" href="/explore">Go to Explore</Link>}>
            Tick <b>Compare</b> on two or three results in Explore. {one ? <>You have <b>{one.name}</b> so far.</> : null}</EmptyState></div></div>
      </>
    );
  }
  const cols = ids.map(getFacility).filter(Boolean).map((f) => { const ff = f as Facility; return { f: ff, m: measure(ff, state.search, state.bookings, state.demo.seed, vt), pol: D.policies[ff.policy], q: windowQuote(state, ff) }; });
  type C = (typeof cols)[number];
  const rows: [string, ((c: C) => number) | null, "min" | "max" | null, (c: C) => React.ReactNode][] = [
    ["Total for your time", (c) => c.q.total, "min", (c) => <span className="num" style={{ fontSize: 24 }}><Rup n={c.q.total} /></span>],
    ["Per hour", (c) => c.m.rate, "min", (c) => <span className="mono">{money(c.m.rate)}</span>],
    ["Per day", (c) => dailyFor(c.f, vt) || 1e9, "min", (c) => <span className="mono">{c.f.dailyRate ? money(dailyFor(c.f, vt) || 0) : "Hourly only"}</span>],
    ["Distance", (c) => c.m.km, "min", (c) => <span className="mono">{kmLabel(c.m.km)} · {c.m.walk} min walk</span>],
    ["Free spaces", (c) => c.m.free, "max", (c) => <OccupancyBar free={c.m.free} capacity={c.f.capacity} />],
    ["Rating", (c) => c.f.rating, "max", (c) => <Stars rating={c.f.rating} count={c.f.reviewCount} />],
    ["Type", null, null, (c) => D.typeLabels[c.f.type] || c.f.type],
    ["Hours", null, null, (c) => hoursLabel(c.f)],
    ["Security", (c) => c.f.security.length, "max", (c) => c.f.security.map((x) => D.securityLabels[x]).join(", ")],
    ["EV charging", (c) => (c.f.ev ? c.f.ev.count : 0), "max", (c) => (c.f.ev ? `${c.f.ev.count} × ${c.f.ev.kw} kW` : <span className="muted">No</span>)],
    ["Height limit", null, null, (c) => (c.f.heightLimit ? `${c.f.heightLimit} m` : "No limit")],
    ["Cancellation", (c) => ({ flexible: 3, moderate: 2, strict: 1 }[c.f.policy]), "max", (c) => <>{c.pol.title}<div className="tiny muted">{c.pol.rules[0]}</div></>],
  ];
  const tick = <span className="tick"><Icon name="check" size={13} /></span>;
  return (
    <>
      <Topbar title="Compare" />
      <div className="page">
        <div className="page-head"><div><h1 className="h1d">Compare {cols.length} places</h1><p>{windowLabel(w.s, w.e)} · {defaultVehicle(state).name}. Lime cells are the best value in each row.</p></div>
          <button type="button" className="btn btn-ghost btn-md" onClick={() => actions.clearCompare()}><Icon name="trash" size={16} />Clear all</button></div>
        <div className="card" style={{ overflow: "hidden" }}><table className="cmp">
          <thead><tr><th />{cols.map((c) => <th key={c.f.id}><div className="illus-frame"><FacilityIllustration facility={c.f} /></div><Link className="h3" href={`/parking/${c.f.id}`} style={{ color: "var(--ink)" }}>{c.f.name}</Link><div className="small muted">{c.f.area}</div></th>)}</tr></thead>
          <tbody>
            {rows.map(([label, val, dir, cell]) => {
              let best: number | null = null;
              if (val) { const vs = cols.map(val); const b = dir === "min" ? Math.min(...vs) : Math.max(...vs); if (vs.filter((x) => x === b).length < vs.length) best = b; }
              return <tr key={label}><th scope="row">{label}</th>{cols.map((c) => { const isB = best !== null && val && val(c) === best; return <td key={c.f.id} className={isB ? "is-best" : ""}>{cell(c)}{isB ? tick : null}</td>; })}</tr>;
            })}
            <tr><th />{cols.map((c) => <td key={c.f.id}><div className="row gap-8">
              <button type="button" className="btn btn-primary btn-md grow" disabled={c.m.free <= 0} onClick={() => { resetDraft(); router.push("/reserve/" + c.f.id); }}>{c.m.free > 0 ? "Reserve" : "Full"}</button>
              <button type="button" className="btn btn-ghost btn-icon btn-md" aria-label="Remove" onClick={() => actions.toggleCompare(c.f.id)}><Icon name="x" size={17} /></button></div></td>)}</tr>
          </tbody>
        </table></div>
      </div>
    </>
  );
}
export function Compare() { return <DesktopShell><CompareView /></DesktopShell>; }

/* ── NOTIFICATIONS ── */
const N_ICON: Record<string, string> = { confirmed: "calendar-check", availability: "sparkles", reminder: "alarm-clock", cancelled: "circle-x", price: "tag", extended: "timer", modified: "pencil", ending: "triangle-alert" };
function NotificationsView() {
  useTitle("Notifications · PARKLY");
  const { state, actions } = useApp();
  const router = useRouter();
  const confirm = useConfirm();
  const list = state.notifications, unread = unreadCount(state);
  const open = (id: string) => {
    const n = list.find((x) => x.id === id);
    if (!n) return;
    actions.markRead(n.id);
    if (n.bookingId && state.bookings.some((b) => b.id === n.bookingId)) router.push("/bookings/" + n.bookingId);
    else if (n.facilityId) router.push("/parking/" + n.facilityId);
  };
  const clear = async () => { if (await confirm({ title: "Clear all notifications?", body: "This removes every notification. Your bookings are not affected.", confirm: "Clear all", tone: "danger", cancel: "Keep them" })) actions.clearNotifications(); };
  return (
    <>
      <Topbar title="Notifications" />
      <div className="page" style={{ maxWidth: 900 }}>
        <div className="page-head"><div><h1 className="h1d">Notifications</h1><p>{unread ? `${unread} unread` : "You're all caught up"}</p></div>
          <div className="row gap-8">
            {unread > 0 && <button type="button" className="btn btn-secondary btn-md" onClick={() => actions.markAllRead()}><Icon name="check-check" size={16} />Mark all read</button>}
            {list.length > 0 && <button type="button" className="btn btn-ghost btn-md" onClick={clear}><Icon name="trash" size={16} />Clear all</button>}
          </div></div>
        <div className="card">{list.length ? list.map((n) => (
          <div key={n.id} className={`nt${n.read ? "" : " is-unread"}`} role="button" tabIndex={0}
            onClick={(e) => { if ((e.target as HTMLElement).closest("button")) return; open(n.id); }}
            onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) open(n.id); }}>
            <div className={`icon-tile${n.read ? "" : " is-lime"}`} style={n.kind === "ending" || n.kind === "cancelled" ? { color: "var(--warn)" } : undefined}><Icon name={N_ICON[n.kind] || "bell"} size={18} /></div>
            <div><div className="nt-title">{n.title}</div><div className="small ink-2">{n.body}</div><div className="tiny muted mono mt-4">{ago(n.at)}</div></div>
            <div className="nt-acts">
              {!n.read && <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Mark read" title="Mark read" onClick={() => actions.markRead(n.id)}><Icon name="check" size={16} /></button>}
              <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Delete" title="Delete" onClick={() => actions.removeNotification(n.id)}><Icon name="trash" size={16} /></button>
            </div>
          </div>
        )) : <EmptyState ico="bell-off" title="No notifications">Booking updates, reminders and price alerts will show up here.</EmptyState>}</div>
      </div>
    </>
  );
}
export function Notifications() { return <DesktopShell><NotificationsView /></DesktopShell>; }
