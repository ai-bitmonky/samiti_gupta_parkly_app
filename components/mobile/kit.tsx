"use client";
/* PARKLY mobile · kit.tsx — the native-app building blocks every mobile screen is made of
   (ported from prototype mobile.html "small view helpers", "top bar", "segmented control", "wheel picker",
   "pull to refresh", "result card", "explore header pieces", "compare tray").

   ── API (phase-2 screens code against this) ────────────────────────────────────────────────────────────
   Screen frame
     <Screen tab? fixed? ptr? tray? onRefresh? className? name?>…</Screen>   → main.screen[data-name]
       tab      shows the tab bar (+ .has-tabbar bottom padding)      fixed   .is-fixed (no scroll, e.g. Map)
       ptr      pull-to-refresh; onRefresh() (may return a Promise) — default: actions.refreshAvailability(),
                900 ms, toast "Live availability refreshed". While it runs useScreen().refreshing is true:
                render <Skel/> in place of the list (prototype [data-skel]).
       tray     shows the floating compare tray when something is picked
       Children are the screen's direct children: <Topbar/>, <div className="page">…, <div className="actionbar">…
       Prices with data-count (see <Price/>) count up on the first paint of the screen.
     useScreen() → { el: RefObject<HTMLElement> (the scroller), refreshing: boolean, top: boolean }
   Navigation (implemented by MobileShell)
     const nav = useNav();  nav.go(path, query?)  nav.back()  nav.reset(baseKeys, target, dir?)  nav.replaceTop(path, query?)
     Any element with data-go="/path" or data-back is also wired (delegated, like the prototype).
     useScreenRoute() (from ./route) → { name, params, query, path, key } — frozen per stack layer.
   Top bar
     <Topbar title sub? large? eyebrow? eyeLime? lead? overlay? back?={true} backLabel? actions? />
       large → collapsing large title (.lt); overlay → glass back button over a hero (collapses after 170 px).
       Back label defaults to the TITLE of the screen below in the stack. back={false} hides it.
     <Bell/> — bell icon button with unread count → /notifications
   Controls
     <Seg value options={[{value,label}]} onChange block? className? ariaLabel?/>   segmented control, sliding thumb
     <Wheel cols={[{items:[{v,label,past?}], value, wide?, label?}]} onChange={(values, colIndex) => …}/>
     <Price n className?/>    "₹136" (.mp) — counts up on first paint, rolls when n changes
     <Empty ico title text action?/>    <Skel n?/> (result-card skeletons)
   Explore pieces
     <RCard r={result} sel? cmp?={true}/>   result card (save / compare / book, heart pop)
     <SearchBar/>  <WhenPill/>  <FilterRow/>  <CompareTray/>   (open DestSheet / TimeSheet / FilterSheet / SortSheet)
   Helpers (pure)
     vt(st) default vehicle type · W(st) → {s, e, mode} · measureOne(st, f) · tl(ms) "4:30 pm" · plain(ms) "4:30"
     opensLabel(ms) "at 4:45 pm" / "tomorrow, 4:45 pm" · durH(s, e) "2 h 30 min" · amen(f, max) amenity chips
     countUp(rootEl) · RM() reduced motion · wait(ms) (shortened under reduced motion) · closeTopSheet() */
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import {
  D, HOUR, activeFilters, amenityIcons, availTone, dailyFor, dateKey, dayLabel, durationLabel, durationShort, kmLabel,
  measure, now as engNow, reducedMotion, searchCenter, timeLabel, unreadCount,
} from "@/lib/engine";
import type { Result } from "@/lib/engine";
import type { AppState, Facility } from "@/lib/data";
import Icon from "@/components/shared/Icon";
import Badge from "@/components/shared/Badge";
import Stars from "@/components/shared/Stars";
import OccupancyBar from "@/components/shared/OccupancyBar";
import FacilityIllustration from "@/components/shared/FacilityIllustration";
import { useToast } from "@/components/shared/ToastProvider";
import { EmptyState, vtype, win } from "@/components/desktop/common";
import { LayerCtx, NavCtx, buildKey, useScreenRoute } from "./route";
import type { Nav, QueryInit } from "./route";
import { DestSheet, FilterSheet, SortSheet, TimeSheet, useSheet } from "./sheets";

/* ───────────── small helpers ───────────── */
export const RM = () => reducedMotion();
export const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, RM() ? Math.min(ms, 30) : ms));
export const vt = vtype;
export const W = (st: AppState) => ({ ...win(st), mode: st.search.mode });
export const measureOne = (st: AppState, f: Facility) => measure(f, st.search, st.bookings, st.demo.seed, vt(st));
export const tl = (t: number | string) => timeLabel(t);
export const plain = (t: number | string) => timeLabel(t).replace(/ ?[ap]m$/, "");
export const durH = (s: number, e: number) => durationLabel((e - s) / HOUR);
export const opensLabel = (t: number) =>
  (dateKey(t) === dateKey(engNow()) ? "at " : dayLabel(t).replace("Tomorrow", "tomorrow") + ", ") + timeLabel(t);
/** amenity icon chips (no wrapper — put them in a .amen-row) */
export const amen = (f: Facility, max = 5) =>
  amenityIcons(f).slice(0, max).map((a) => <span key={a.label} className="amen-chip" title={a.label} aria-label={a.label}><Icon name={a.icon} size={14} /></span>);

/** Clicks are swallowed until this time (a mouse pull-to-refresh must not also tap what it started on). */
export const swallow = { until: 0 };

/** Closes the top-most open sheet/dialog (backdrop tap). Returns true if one was open — back() then stops there. */
export function closeTopSheet(): boolean {
  if (typeof document === "undefined") return false;
  const all = Array.from(document.querySelectorAll<HTMLElement>(".overlay:not(.is-closing)"));
  const o = all[all.length - 1];
  if (!o) return false;
  o.querySelector<HTMLElement>(".overlay-backdrop")?.click();
  return true;
}

/** Price count-up on first paint (700 ms ease-out, first 6, 70 ms stagger) for [data-count] elements. */
export function countUp(root: HTMLElement | null | undefined) {
  if (!root || RM()) return;
  root.querySelectorAll<HTMLElement>("[data-count]").forEach((el, i) => {
    if (i > 5) return;
    const to = +(el.dataset.count || 0);
    if (!to) return;
    const t0 = performance.now() + i * 70;
    const step = (t: number) => {
      if (!el.isConnected) return;
      const k = Math.max(0, Math.min(1, (t - t0) / 700)), v = Math.round(to * (1 - Math.pow(1 - k, 3)));
      el.textContent = v.toLocaleString("en-IN");
      if (k < 1) requestAnimationFrame(step);
    };
    el.textContent = "0";
    requestAnimationFrame(step);
  });
}

/* ───────────── navigation ───────────── */
/** Stack navigation (see route.tsx Nav). Outside the mobile shell it degrades to plain router calls. */
export function useNav(): Nav {
  const ctx = useContext(NavCtx);
  const router = useRouter();
  return useMemo<Nav>(() => ctx || {
    go: (p: string, q?: QueryInit) => router.push(buildKey(p, q), { scroll: false }),
    back: () => { if (!closeTopSheet()) router.back(); },
    reset: (_b: string[], t: string) => router.replace(t, { scroll: false }),
    replaceTop: (p: string, q?: QueryInit) => router.replace(buildKey(p, q), { scroll: false }),
    stack: () => [],
  }, [ctx, router]);
}

/* ───────────── Screen frame ───────────── */
interface ScreenCtxValue { el: RefObject<HTMLElement | null>; refreshing: boolean; top: boolean }
const ScreenCtx = createContext<ScreenCtxValue>({ el: { current: null }, refreshing: false, top: true });
export const useScreen = () => useContext(ScreenCtx);

export interface ScreenProps {
  children?: ReactNode;
  /** data-name; defaults to the route name */
  name?: string;
  tab?: boolean;
  fixed?: boolean;
  ptr?: boolean;
  tray?: boolean;
  onRefresh?: () => void | Promise<void>;
  className?: string;
}

export function Screen({ children, name, tab, fixed, ptr, tray, onRefresh, className = "" }: ScreenProps) {
  const layer = useContext(LayerCtx);
  const route = useScreenRoute();
  const { actions } = useApp();
  const toast = useToast();
  const ref = useRef<HTMLElement>(null);
  const ptrRef = useRef<HTMLDivElement>(null);
  const [pull, setPull] = useState({ pulling: false, releasing: false, refreshing: false });
  const lid = layer?.id ?? 0, setEl = layer?.setEl, setChrome = layer?.setChrome, first = layer ? layer.first : true;

  useLayoutEffect(() => {
    if (!setEl) return;
    setEl(lid, ref.current);
    return () => setEl(lid, null);
  }, [lid, setEl]);
  useLayoutEffect(() => { setChrome?.(lid, { tab: !!tab, tray: !!tray }); }, [lid, setChrome, tab, tray]);
  // count-up on the first paint (not for an under-layer revealed by an edge swipe)
  const firstRef = useRef(first);
  useEffect(() => { if (firstRef.current) countUp(ref.current); }, []);

  // pull to refresh (touch + mouse), ported from wirePull
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  refreshRef.current = async () => {
    if (onRefresh) { await onRefresh(); return; }
    actions.refreshAvailability();
    await wait(900);
    toast("Live availability refreshed", "ok");
  };
  useEffect(() => {
    const el = ref.current, p = ptrRef.current;
    if (!ptr || !el || !p) return;
    let y0: number | null = null, amount = 0, busy = false, mouse = false, alive = true;
    const flags = { pulling: false, releasing: false, refreshing: false };
    const cls = (k: keyof typeof flags, v: boolean) => { if (flags[k] !== v) { flags[k] = v; if (alive) setPull({ ...flags }); } };
    const set = (v: number) => {
      amount = v;
      el.style.setProperty("--pull", v + "px");
      p.style.opacity = String(Math.min(1, v / 60));
      p.style.transform = `translateY(${Math.min(v, 80) - 40}px) rotate(${v * 3}deg) scale(${0.6 + Math.min(0.4, v / 150)})`;
    };
    const start = (y: number) => { if (busy || el.scrollTop > 0) return; y0 = y; };
    const move = (y: number, ev?: Event) => {
      if (y0 === null) return;
      const dy = y - y0;
      if (dy <= 0) { if (amount) set(0); cls("pulling", false); return; }
      if (dy > 6) { cls("pulling", true); if (ev && ev.cancelable) ev.preventDefault(); set(Math.min(130, dy * 0.55)); }
    };
    const end = async () => {
      if (y0 === null) return;
      y0 = null;
      cls("pulling", false); cls("releasing", true);
      if (amount > 62) {
        if (mouse) swallow.until = Date.now() + 250;
        busy = true; cls("refreshing", true); set(56); p.style.transform = "translateY(16px)";
        try { await refreshRef.current(); } catch (e) { console.error(e); }
        if (!alive) return;
        cls("refreshing", false); busy = false;
      }
      set(0); p.style.opacity = "0";
      window.setTimeout(() => cls("releasing", false), 320);
    };
    const ts = (e: TouchEvent) => { mouse = false; start(e.touches[0].clientY); };
    const tm = (e: TouchEvent) => move(e.touches[0].clientY, e);
    const md = (e: MouseEvent) => { if (e.button === 0 && !(e.target as HTMLElement).closest("input,textarea,.map,.wcol")) { mouse = true; start(e.clientY); } };
    const mm = (e: MouseEvent) => { if (mouse && y0 !== null) { move(e.clientY, e); if (amount > 8) swallow.until = Date.now() + 250; } };
    const mu = () => { if (mouse) end(); };
    el.addEventListener("touchstart", ts, { passive: true });
    el.addEventListener("touchmove", tm, { passive: false });
    el.addEventListener("touchend", end); el.addEventListener("touchcancel", end);
    el.addEventListener("mousedown", md);
    window.addEventListener("mousemove", mm); window.addEventListener("mouseup", mu);
    return () => {
      alive = false;
      el.removeEventListener("touchstart", ts); el.removeEventListener("touchmove", tm);
      el.removeEventListener("touchend", end); el.removeEventListener("touchcancel", end);
      el.removeEventListener("mousedown", md);
      window.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", mu);
    };
  }, [ptr]);

  const cls = ["screen", tab ? "has-tabbar" : "", fixed ? "is-fixed" : "", layer?.cls || "",
    pull.pulling ? "is-pulling" : "", pull.releasing ? "is-releasing" : "", pull.refreshing ? "is-refreshing" : "", className]
    .filter(Boolean).join(" ");
  const top = layer ? layer.top : true;
  const ctx = useMemo<ScreenCtxValue>(() => ({ el: ref, refreshing: pull.refreshing, top }), [pull.refreshing, top]);
  return (
    <main ref={ref} className={cls} data-name={name || route.name} data-scroll-root="" inert={!top} aria-hidden={top ? undefined : true}
      style={layer?.hidden ? { visibility: "hidden" } : undefined}>
      {ptr && <div className="ptr" ref={ptrRef} aria-hidden="true"><Icon name="refresh-cw" size={18} /></div>}
      <ScreenCtx.Provider value={ctx}>{children}</ScreenCtx.Provider>
    </main>
  );
}

/* ───────────── top bar + large title ───────────── */
export interface TopbarProps {
  title?: string;
  sub?: ReactNode;
  large?: boolean;
  eyebrow?: ReactNode;
  eyeLime?: boolean;
  lead?: ReactNode;
  overlay?: boolean;
  back?: boolean;
  backLabel?: string;
  actions?: ReactNode;
}
export function Topbar({ title = "", sub, large, eyebrow, eyeLime, lead, overlay, back = true, backLabel, actions }: TopbarProps) {
  const layer = useContext(LayerCtx);
  const nav = useNav();
  const { el } = useScreen();
  const lt = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const sc = el.current;
    if (!sc) return;
    const limit = overlay ? 170 : large && lt.current ? Math.max(24, lt.current.offsetHeight - 18) : 4;
    const on = () => setCollapsed(sc.scrollTop > limit);
    sc.addEventListener("scroll", on, { passive: true });
    on();
    return () => sc.removeEventListener("scroll", on);
  }, [el, overlay, large]);
  const label = backLabel || layer?.backLabel || "Explore";
  const cls = ["topbar", large ? "is-large" : "", overlay ? "is-overlay" : "", collapsed ? "is-collapsed" : ""].filter(Boolean).join(" ");
  return (
    <>
      <header className={cls}>
        {back && (overlay
          ? <button type="button" className="glass-btn" onClick={() => nav.back()} aria-label="Back"><Icon name="chevron-left" size={22} /></button>
          : <button type="button" className="nav-back" onClick={() => nav.back()} aria-label={`Back to ${label}`}><Icon name="chevron-left" size={26} /><span>{label}</span></button>)}
        <div className="topbar-title"><span>{title}</span>{sub ? <small>{sub}</small> : null}</div>
        <div className="tb-actions">{actions}</div>
      </header>
      {large && (
        <div className="lt" ref={lt}>
          {eyebrow ? <div className={`eyebrow${eyeLime ? " is-lime" : ""}`}>{eyebrow}</div> : null}
          <h1>{title}</h1>
          {lead ? <p>{lead}</p> : null}
        </div>
      )}
    </>
  );
}

/** Bell with unread count → Alerts */
export function Bell() {
  const { state } = useApp();
  const nav = useNav();
  const n = unreadCount(state);
  return (
    <button type="button" className="icon-btn" onClick={() => nav.go("/notifications")} aria-label={`Alerts, ${n} unread`}>
      <Icon name="bell" size={21} />{n ? <span className="dot-count">{n}</span> : null}
    </button>
  );
}

/* ───────────── segmented control with sliding thumb ───────────── */
export interface SegOption<T extends string> { value: T; label: ReactNode }
export function Seg<T extends string>({ value, options, onChange, block, className = "", ariaLabel }: {
  value: T; options: SegOption<T>[]; onChange: (v: T) => void; block?: boolean; className?: string; ariaLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const th = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);
  const paint = useCallback((instant: boolean) => {
    const seg = ref.current, t = th.current;
    if (!seg || !t) return;
    const on = seg.querySelector<HTMLElement>(":scope > button.is-on");
    if (!on) { t.style.width = "0px"; return; }
    if (instant) t.style.transition = "none";
    t.style.width = on.offsetWidth + "px";
    t.style.transform = `translateX(${on.offsetLeft}px)`;
    if (instant) { void t.offsetWidth; t.style.transition = ""; }
  }, []);
  useLayoutEffect(() => {
    if (!placed.current) { placed.current = true; paint(true); return; }
    const raf = requestAnimationFrame(() => paint(false));
    return () => cancelAnimationFrame(raf);
  }, [value, options.length, paint]);
  useEffect(() => {
    const seg = ref.current;
    if (!seg || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => paint(true));
    ro.observe(seg);
    return () => ro.disconnect();
  }, [paint]);
  return (
    <div ref={ref} className={`seg${block ? " seg-block" : ""} ${className}`.trim()} role="tablist" aria-label={ariaLabel}>
      <span className="seg-thumb" aria-hidden="true" ref={th} />
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={o.value === value} className={o.value === value ? "is-on" : ""} onClick={() => { if (o.value !== value) onChange(o.value); }}>{o.label}</button>
      ))}
    </div>
  );
}

/* ───────────── wheel picker (scroll-snap columns) ───────────── */
export interface WheelItem { v: string; label: string; past?: boolean }
export interface WheelCol { items: WheelItem[]; value: string; wide?: boolean; label?: string }
const ROW = 40;

function paint3d(col: HTMLElement) {
  const mid = col.scrollTop;
  col.querySelectorAll<HTMLElement>(".w-it").forEach((it, i) => {
    const a = Math.max(-3, Math.min(3, (i * ROW - mid) / ROW));
    it.style.transform = `rotateX(${-a * 20}deg) scale(${1 - Math.abs(a) * 0.06})`;
    it.style.opacity = String(1 - Math.min(0.75, Math.abs(a) * 0.28));
  });
}

function WheelColumn({ col, index, onSettle }: { col: WheelCol; index: number; onSettle: (ci: number, v: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const cur = useRef(col.value);
  const settle = useRef(onSettle);
  settle.current = onSettle;
  const items = col.items;
  const idxOf = useCallback((v: string) => Math.max(0, items.findIndex((it) => it.v === v)), [items]);
  // initial position + external value changes
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.dataset.ready && col.value === cur.current) { paint3d(el); return; }
    el.dataset.ready = "1";
    cur.current = col.value;
    el.scrollTop = idxOf(col.value) * ROW;
    paint3d(el);
  }, [col.value, idxOf]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let t = 0, raf = 0;
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; paint3d(el); });
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ROW))), v = items[i].v;
        if (v !== cur.current) {
          cur.current = v;
          try { navigator.vibrate?.(4); } catch { /* not supported */ }
          settle.current(index, v);
        }
      }, 110);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => { el.removeEventListener("scroll", onScroll); window.clearTimeout(t); cancelAnimationFrame(raf); };
  }, [items, index]);
  return (
    <div ref={ref} className={`wcol${col.wide ? " w-wide" : ""}`} role="listbox" tabIndex={0} aria-label={col.label || ""}
      onClick={(e) => { const it = (e.target as HTMLElement).closest<HTMLElement>(".w-it"); if (it) ref.current?.scrollTo({ top: +(it.dataset.i || 0) * ROW, behavior: RM() ? "auto" : "smooth" }); }}
      onKeyDown={(e) => { const d = ({ ArrowDown: 1, ArrowUp: -1 } as Record<string, number>)[e.key]; if (d) { e.preventDefault(); ref.current?.scrollTo({ top: ref.current.scrollTop + d * ROW, behavior: "auto" }); } }}>
      <div className="w-pad" />
      {items.map((it, i) => (
        <div key={it.v} className={`w-it${it.past ? " is-past" : ""}`} data-i={i} role="option" aria-selected={it.v === col.value}>{it.label}</div>
      ))}
      <div className="w-pad" />
    </div>
  );
}

/** Scroll-snap wheel picker. onChange(values, colIndex) fires once a column settles on a new row. */
export function Wheel({ cols, onChange, className = "" }: { cols: WheelCol[]; onChange?: (values: string[], col: number) => void; className?: string }) {
  // latest values: what the user settled on, overridden whenever the parent passes a new value
  const vals = useRef(cols.map((c) => c.value));
  const props = useRef(cols.map((c) => c.value));
  cols.forEach((c, i) => { if (props.current[i] !== c.value) { props.current[i] = c.value; vals.current[i] = c.value; } });
  const onSettle = useCallback((ci: number, v: string) => {
    const next = vals.current.slice();
    next[ci] = v;
    vals.current = next;
    onChange?.(next, ci);
  }, [onChange]);
  return <div className={`wheel ${className}`.trim()}>{cols.map((c, i) => <WheelColumn key={i} col={c} index={i} onSettle={onSettle} />)}</div>;
}

/* ───────────── price, empty, skeleton ───────────── */
/** "₹136": counts up on the screen's first paint (data-count), rolls (340 ms) when `n` changes. */
export function Price({ n, className = "" }: { n: number; className?: string }) {
  const v = Math.round(n), text = v.toLocaleString("en-IN");
  const [st, setSt] = useState<{ cur: string; old: string | null; k: number }>({ cur: text, old: null, k: 0 });
  if (st.cur !== text) setSt({ cur: text, old: st.cur, k: st.k + 1 });
  const k = st.k;
  useEffect(() => {
    if (!k) return;
    const t = window.setTimeout(() => setSt((s) => (s.k === k ? { ...s, old: null } : s)), 360);
    return () => window.clearTimeout(t);
  }, [k]);
  const rolling = st.old !== null && st.cur === text && !RM();
  return (
    <span className={`mp ${className}`.trim()}>
      <span className="rs">₹</span>
      {rolling
        ? <span key={"r" + k} className="mp-n roll"><span className="roll-old">{st.old}</span><span className="roll-new">{text}</span></span>
        : <span key={"t" + k} className="mp-n" data-count={k ? undefined : v}>{text}</span>}
    </span>
  );
}

export function Empty({ ico, title, text, action }: { ico: string; title: string; text?: ReactNode; action?: ReactNode }) {
  return <EmptyState ico={ico} title={title} action={action}>{text}</EmptyState>;
}

/** Result-card skeletons (prototype skel(n)). */
export function Skel({ n = 3 }: { n?: number }) {
  const s = (style: CSSProperties) => <div className="skeleton" style={style} />;
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <div className="sk-card" key={i} aria-busy="true">
          {s({ height: 112, borderRadius: 0 })}
          <div className="p-16 stack-12">
            {s({ height: 16, width: "62%" })}{s({ height: 12, width: "40%" })}
            <div className="row-between">{s({ height: 28, width: "30%" })}{s({ height: 28, width: "24%" })}</div>
            {s({ height: 6 })}
          </div>
        </div>
      ))}
    </>
  );
}

/* ───────────── result card ───────────── */
export function RCard({ r, sel, cmp: showCmp = true }: { r: Result; sel?: boolean; cmp?: boolean }) {
  const { state, actions } = useApp();
  const nav = useNav();
  const toast = useToast();
  const f = r.f, saved = state.savedIds.includes(f.id), cmp = state.compareIds.includes(f.id), tone = availTone(r.free, f.capacity);
  const unit = state.search.mode === "daily" && f.dailyRate ? `₹${dailyFor(f, vt(state))}/day` : `₹${r.rate}/h`;
  // heart pop when it turns on while the card is on screen
  const [pop, setPop] = useState(false);
  const was = useRef(saved);
  useEffect(() => {
    if (was.current === saved) return;
    was.current = saved;
    if (!saved) { setPop(false); return; }
    setPop(true);
    const t = window.setTimeout(() => setPop(false), 400);
    return () => window.clearTimeout(t);
  }, [saved]);
  const open = () => nav.go("/parking/" + f.id);
  const onSave = () => { actions.toggleSaved(f.id); toast(saved ? "Removed from Saved" : "Saved. Find it in the Saved tab.", saved ? "info" : "ok"); };
  const onCmp = () => { const res = actions.toggleCompare(f.id); if (!res.ok) toast(res.error, "warn"); };
  return (
    <article className={`rcard tap${sel ? " is-sel" : ""}`} data-fid={f.id}>
      <div className="rcard-media" onClick={open}>
        <FacilityIllustration facility={f} />
        <div className="rcard-badges">
          {f.instant ? <Badge tone="lime" icon="zap">Instant</Badge> : <Badge tone="warn">Operator confirms</Badge>}
          {tone === "low" ? <Badge tone="warn">{r.free} left</Badge> : null}
        </div>
      </div>
      <button type="button" className={`heart${saved ? " is-on" : ""}${pop ? " is-pop" : ""}`} onClick={onSave} aria-pressed={saved} aria-label={`${saved ? "Remove from saved" : "Save"} ${f.name}`}>
        <Icon name="heart" size={19} />
      </button>
      <div className="rcard-body" onClick={open}>
        <div className="row-between" style={{ alignItems: "flex-end" }}>
          <div className="grow">
            <div className="rcard-name ellipsis">{f.name}</div>
            <div className="rcard-meta"><span>{f.area}</span>·<span className="mono">{kmLabel(r.km)}</span>·<span><Icon name="footprints" size={12} /> {r.walk} min</span>·<Stars rating={f.rating} /></div>
          </div>
        </div>
        <div className="row-between" style={{ alignItems: "flex-end" }}>
          <div><Price n={r.total} /><div className="price-sub">total · {unit}</div></div>
          <div className="amen-row" style={{ justifyContent: "flex-end", maxWidth: 150 }}>{amen(f, 4)}</div>
        </div>
        {r.reason ? <div className="reason"><Icon name="sparkles" size={14} /><span>{r.reason}</span></div> : null}
      </div>
      <div className="rcard-body" style={{ marginTop: 0, paddingTop: 0 }}>
        <div className="rcard-foot">
          <OccupancyBar free={r.free} capacity={f.capacity} />
          <button type="button" className="btn btn-primary btn-md" onClick={() => nav.go("/reserve/" + f.id)} disabled={r.free <= 0} style={{ minWidth: 76 }}>{r.free <= 0 ? "Full" : "Book"}</button>
        </div>
        {showCmp && (
          <button type="button" className={`cmp-toggle check${cmp ? " is-on" : ""}`} onClick={onCmp} aria-pressed={cmp} style={{ minHeight: 32 }}>
            <span className="check-box" />Compare
          </button>
        )}
      </div>
    </article>
  );
}

/* ───────────── explore header pieces ───────────── */
export function SearchBar() {
  const { state, actions } = useApp();
  const toast = useToast();
  const openSheet = useSheet();
  const c = searchCenter(state.search);
  return (
    <button type="button" className="searchbar tap" aria-label={`Change destination: ${c.name}`}
      onClick={() => openSheet(({ open, close }) => <DestSheet open={open} onClose={close} />)}>
      <Icon name="search" size={19} />
      <span className="grow"><small>Parking near</small><b>{c.name}</b></span>
      <span className="near" onClick={(e) => { e.stopPropagation(); actions.nearMe(); toast("Using your location near Mandi House", "info"); }}>
        <Icon name="locate-fixed" size={14} />Near me
      </span>
    </button>
  );
}

export function WhenPill() {
  const { state } = useApp();
  const openSheet = useSheet();
  const w = W(state);
  return (
    <button type="button" className="when tap" aria-label="Change time" onClick={() => openSheet(({ open, close }) => <TimeSheet open={open} onClose={close} />)}>
      <span className="when-cell"><div className="eyebrow">Enter after</div><b>{tl(w.s)}</b><small>{dayLabel(w.s)}</small></span>
      <span className="when-dur">{durationShort(Math.round((w.e - w.s) / 60000))}</span>
      <span className="when-cell right"><div className="eyebrow">Exit before</div><b>{tl(w.e)}</b><small>{dayLabel(w.e)}</small></span>
    </button>
  );
}

export function FilterRow() {
  const { state, actions } = useApp();
  const openSheet = useSheet();
  const af = activeFilters(state.search.filters);
  return (
    <div className="filter-row">
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
    </div>
  );
}

/* ───────────── compare tray (rendered by the shell in .floating) ───────────── */
export function CompareTray() {
  const { state, actions } = useApp();
  const nav = useNav();
  const ids = state.compareIds;
  return (
    <div className="tray">
      <div className="tray-stack">{ids.map((id) => { const f = D.facilities.find((x) => x.id === id); return f ? <span className="thumb" key={id}><FacilityIllustration facility={f} /></span> : null; })}</div>
      <div className="grow">
        <b className="small nowrap">{ids.length} place{ids.length > 1 ? "s" : ""} picked</b>
        <div className="tiny muted nowrap">{ids.length < 2 ? "Pick one more" : "Ready to compare"}</div>
      </div>
      <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => actions.clearCompare()} aria-label="Clear compare"><Icon name="x" size={18} /></button>
      <button type="button" className="btn btn-primary btn-sm" onClick={() => nav.go("/compare")} disabled={ids.length < 2}>Compare</button>
    </div>
  );
}
