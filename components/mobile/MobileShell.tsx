"use client";
/* PARKLY mobile · MobileShell — the persistent native-app shell (prototype mobile.html "NAVIGATION", "swipe back",
   "status bar + tab bar", "compare tray", "BOOT").

   Mounted once by app/providers.tsx (DeviceChrome) while the device is "mobile"; it survives route changes so the
   old screen can animate out. It renders the screen for the URL itself (SCREENS below → components/mobile/index.tsx
   exports) inside a stack of layers, each with its route frozen (ScreenRouteProvider); ScreenSwitch renders nothing
   on mobile while the shell is active.

   DOM: div.device[.no-tabbar] > .screens > main.screen[data-name]…  + nav.tabbar + .floating (compare tray) + .edge-swipe
   Stack rules (onRoute): tab roots/welcome reset the stack (dir "tab", or "pop" when going back down to them);
   a key already in the stack pops to it; anything else pushes. Outgoing layer stays 330 ms with nav-push-out /
   nav-pop-out (hidden for a tab switch); incoming gets nav-push-in / nav-pop-in / nav-tab-in. Reduced motion → none.
   Onboarding gate: !state.onboarded → /welcome. "/" → /explore. Unknown paths (/_dev, 404) → the shell steps aside. */
import { Suspense, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ComponentType } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/lib/store";
import { bookingStatus } from "@/lib/engine";
import Icon from "@/components/shared/Icon";
import * as M from "./index";
import { CompareTray, RM, closeTopSheet, swallow } from "./kit";
import { SheetHost } from "./sheets";
import {
  LayerCtx, NavCtx, PARENT, ROOTS, ScreenRouteProvider, TABS, TAB_OF, TITLES, buildKey, parseKey, parseRoute,
} from "./route";
import type { LayerInfo, Nav, NavDir, QueryInit, RouteName, ScreenChrome, ScreenRoute } from "./route";

const SCREENS: Record<RouteName, ComponentType> = {
  welcome: M.Welcome, explore: M.Explore, map: M.MapScreen, parking: M.Facility, reserve: M.Reserve, checkout: M.Checkout,
  confirmation: M.Confirmation, bookings: M.Bookings, booking: M.BookingDetail, arrive: M.Arrive, saved: M.Saved,
  compare: M.Compare, notifications: M.Notifications, profile: M.Profile, landing: M.Home,
};
const ANIM = 330;

type Phase = "top" | "out" | "under";
interface Layer {
  id: number;
  key: string;
  route: ScreenRoute;
  phase: Phase;
  /** animation / swipe classes */
  cls: string;
  hidden: boolean;
  first: boolean;
  backLabel: string;
}

const backLabelFor = (stack: string[], idx: number, route: ScreenRoute) => {
  const prev = idx > 0 ? parseKey(stack[idx - 1]) : null;
  if (prev) return TITLES[prev.name];
  const p = PARENT[route.name];
  const pr = p ? parseKey(p(route)) : null;
  return pr ? TITLES[pr.name] : TITLES.explore;
};

export default function MobileShell() {
  return <Suspense fallback={null}><Shell /></Suspense>;
}

function Shell() {
  const pathname = usePathname() || "/";
  const sp = useSearchParams();
  const search = sp ? sp.toString() : "";
  const route = useMemo(() => parseRoute(pathname, search), [pathname, search]);
  const key = route ? route.key : null;
  const router = useRouter();
  const { state } = useApp();

  const [layers, setLayers] = useState<Layer[]>([]);
  const layersRef = useRef<Layer[]>([]);
  layersRef.current = layers;
  const stack = useRef<string[]>([]);
  const hist = useRef(new Map<string, boolean>()); // key → the browser history entry below it is stack[idx-1]
  const lastNav = useRef<{ kind: "push" | "replace" | "back"; key?: string; inherit?: boolean } | null>(null);
  const pendingDir = useRef<NavDir | null>(null);
  const adopt = useRef<number | null>(null); // under-layer id to adopt after a successful swipe
  const els = useRef(new Map<number, HTMLElement>());
  const seq = useRef(0);
  const timers = useRef<number[]>([]);
  const [chromes, setChromes] = useState<Record<number, ScreenChrome>>({});
  const [edgeOn, setEdgeOn] = useState(false);
  const screensRef = useRef<HTMLDivElement>(null);
  const deviceRef = useRef<HTMLDivElement>(null);

  const later = (fn: () => void, ms: number) => { const t = window.setTimeout(fn, ms); timers.current.push(t); };
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const top = () => layersRef.current.filter((l) => l.phase === "top").pop() || null;

  /* ── navigation primitives ── */
  const push = useCallback((k: string) => { lastNav.current = { kind: "push", key: k }; router.push(k, { scroll: false }); }, [router]);
  const replace = useCallback((k: string, inherit = false) => { lastNav.current = { kind: "replace", key: k, inherit }; router.replace(k, { scroll: false }); }, [router]);
  const goBackTo = useCallback((prevKey: string) => {
    const t = top();
    if (t && hist.current.get(t.key)) { lastNav.current = { kind: "back", key: prevKey }; router.back(); }
    else replace(prevKey);
  }, [router, replace]);

  const nav = useMemo<Nav>(() => ({
    go: (path, query?: QueryInit) => push(buildKey(path, query)),
    back: () => {
      if (closeTopSheet()) return;
      const s = stack.current, t = top();
      if (s.length > 1) { goBackTo(s[s.length - 2]); return; }
      const p = t && PARENT[t.route.name];
      if (t && p) { const pk = p(t.route); stack.current = [pk, t.key]; replace(pk); }
    },
    reset: (base, target, dir = "push") => { stack.current = base.slice(); pendingDir.current = dir; replace(target); },
    replaceTop: (path, query) => {
      const k = buildKey(path, query), s = stack.current;
      if (s.length) s[s.length - 1] = k; else s.push(k);
      pendingDir.current = "push";
      replace(k, true);
    },
    stack: () => stack.current.slice(),
  }), [push, replace, goBackTo]);

  /* ── route change → stack + layers (prototype onRoute + show) ── */
  useLayoutEffect(() => {
    if (!route || !key) return;
    if (!state.onboarded && route.name !== "welcome") { stack.current = []; replace("/welcome"); return; }
    if (route.name === "landing") { replace("/explore"); return; }
    const cur = top();
    if (cur && cur.key === key) return;
    const ln = lastNav.current;
    lastNav.current = null;
    // history bookkeeping (so back() can use router.back() when the entry below really is the previous screen)
    const prevTopKey = cur ? cur.key : null;
    const forced = pendingDir.current;
    pendingDir.current = null;
    let dir: NavDir = forced || "push";
    const s = stack.current, idx = s.indexOf(key);
    if (ROOTS.has(route.name)) {
      dir = forced || (idx >= 0 && idx < s.length - 1 ? "pop" : "tab");
      stack.current = [key];
    } else if (idx >= 0) { dir = forced || "pop"; stack.current = s.slice(0, idx + 1); }
    else stack.current = [...s, key];
    if (ln && ln.key === key && ln.kind === "replace") hist.current.set(key, ln.inherit && prevTopKey ? !!hist.current.get(prevTopKey) : false);
    else if (!(idx >= 0 && hist.current.has(key))) hist.current.set(key, true); // push, link or browser forward
    if (!cur) dir = "none";
    setEdgeOn(stack.current.length > 1 || !!PARENT[route.name]);

    const sIdx = stack.current.indexOf(key);
    const adoptId = adopt.current;
    adopt.current = null;
    const adopted = adoptId !== null ? layersRef.current.find((l) => l.id === adoptId && l.key === key) : undefined;
    if (adopted) {
      setLayers((ls) => ls.filter((l) => l.id === adopted.id || l.phase === "out")
        .map((l) => (l.id === adopted.id ? { ...l, phase: "top", cls: "", hidden: false, backLabel: backLabelFor(stack.current, sIdx, l.route) } : l)));
      // the swipe left it at translateX(0)/brightness(1) — drop the inline styles once the classes are gone
      requestAnimationFrame(() => { const el = els.current.get(adopted.id); if (el) { el.style.transform = ""; el.style.filter = ""; } });
      return;
    }
    const entry: Layer = { id: ++seq.current, key, route, phase: "top", cls: "", hidden: false, first: true, backLabel: backLabelFor(stack.current, sIdx, route) };
    if (!cur || dir === "none" || RM()) {
      setLayers((ls) => [...ls.filter((l) => l.phase === "out"), entry]);
      return;
    }
    const [outCls, inCls] = ({ push: ["nav-push-out", "nav-push-in"], pop: ["nav-pop-out", "nav-pop-in"], tab: ["", "nav-tab-in"] } as Record<string, string[]>)[dir] || ["", "nav-tab-in"];
    entry.cls = inCls;
    setLayers((ls) => [
      ...ls.filter((l) => l.phase === "out" || l.id === cur.id).map((l) => (l.id === cur.id ? { ...l, phase: "out" as Phase, cls: outCls, hidden: !outCls } : l)),
      entry,
    ]);
    later(() => setLayers((ls) => ls.filter((l) => l.id !== cur.id).map((l) => (l.id === entry.id ? { ...l, cls: "" } : l))), ANIM);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, state.onboarded]);

  /* ── layer handshake ── */
  const setEl = useCallback((id: number, el: HTMLElement | null) => { if (el) els.current.set(id, el); else els.current.delete(id); }, []);
  const setChrome = useCallback((id: number, c: ScreenChrome) => {
    setChromes((m) => (m[id] && m[id].tab === c.tab && m[id].tray === c.tray ? m : { ...m, [id]: c }));
  }, []);
  // forget chrome of removed layers
  useEffect(() => {
    setChromes((m) => { const ids = new Set(layers.map((l) => l.id)); const keys = Object.keys(m).map(Number); return keys.some((k) => !ids.has(k)) ? Object.fromEntries(keys.filter((k) => ids.has(k)).map((k) => [k, m[k]])) : m; });
  }, [layers]);

  /* ── edge swipe back (prototype swipeBack) ── */
  const sw = useRef<{ x0: number; t0: number; underId: number; prevKey: string; w: number; dx: number; topId: number } | null>(null);
  const onEdgeDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const t = top();
    if (!t || sw.current || closeTopSheet()) return;
    const s = stack.current;
    const p = PARENT[t.route.name];
    const prevKey = s.length > 1 ? s[s.length - 2] : p ? p(t.route) : null;
    const r = prevKey ? parseKey(prevKey) : null;
    if (!prevKey || !r) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const under: Layer = { id: ++seq.current, key: prevKey, route: r, phase: "under", cls: "is-under", hidden: false, first: false, backLabel: backLabelFor(s, s.length - 2, r) };
    setLayers((ls) => {
      const i = ls.findIndex((l) => l.id === t.id);
      return [...ls.slice(0, i).filter((l) => l.phase !== "under"), under, ...ls.slice(i).map((l) => (l.id === t.id ? { ...l, cls: "is-swiping" } : l))];
    });
    sw.current = { x0: e.clientX, t0: performance.now(), underId: under.id, prevKey, w: screensRef.current?.clientWidth || window.innerWidth, dx: 0, topId: t.id };
  };
  const onEdgeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = sw.current;
    if (!st) return;
    st.dx = Math.max(0, e.clientX - st.x0);
    const k = st.dx / st.w, topEl = els.current.get(st.topId), underEl = els.current.get(st.underId);
    if (topEl) topEl.style.transform = `translateX(${st.dx}px)`;
    if (underEl) { underEl.style.transform = `translateX(${-28 * (1 - k)}%)`; underEl.style.filter = `brightness(${0.6 + 0.4 * k})`; }
  };
  const onEdgeEnd = () => {
    const st = sw.current;
    if (!st) return;
    sw.current = null;
    const v = st.dx / Math.max(1, performance.now() - st.t0), done = st.dx > st.w * 0.33 || (v > 0.5 && st.dx > 30);
    setLayers((ls) => ls.map((l) => (l.id === st.topId ? { ...l, cls: "is-swiping is-settling" } : l.id === st.underId ? { ...l, cls: "is-under is-settling" } : l)));
    requestAnimationFrame(() => {
      const topEl = els.current.get(st.topId), underEl = els.current.get(st.underId);
      if (topEl) topEl.style.transform = done ? "translateX(100%)" : "";
      if (underEl) { underEl.style.transform = done ? "translateX(0)" : ""; underEl.style.filter = done ? "none" : ""; }
    });
    later(() => {
      if (done) {
        adopt.current = st.underId;
        const t = layersRef.current.find((l) => l.id === st.topId);
        if (stack.current.length < 2 && t) stack.current = [st.prevKey, t.key];
        goBackTo(st.prevKey);
      } else {
        setLayers((ls) => ls.filter((l) => l.id !== st.underId).map((l) => (l.id === st.topId ? { ...l, cls: "" } : l)));
        const topEl = els.current.get(st.topId);
        if (topEl) topEl.style.transform = "";
      }
    }, 250);
  };

  /* ── delegated taps: data-go / data-back, click swallowing after a mouse pull ── */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (Date.now() < swallow.until) { e.preventDefault(); e.stopPropagation(); return; }
      const t = (e.target as HTMLElement | null)?.closest?.<HTMLElement>("[data-go],[data-back]");
      if (!t || (t as HTMLButtonElement).disabled) return;
      if (!deviceRef.current?.contains(t) && !t.closest(".overlay")) return;
      if (t.hasAttribute("data-back")) { e.preventDefault(); nav.back(); return; }
      const go = t.getAttribute("data-go");
      if (go) { e.preventDefault(); nav.go(go); }
    };
    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, [nav]);
  // overflow:hidden boxes can still be scrolled by focus(); keep the device pinned
  useEffect(() => {
    const d = deviceRef.current;
    if (!d) return;
    const fix = () => { if (d.scrollTop || d.scrollLeft) { d.scrollTop = 0; d.scrollLeft = 0; } };
    d.addEventListener("scroll", fix);
    return () => d.removeEventListener("scroll", fix);
  }, [route !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!route) return null;
  const t = layers.filter((l) => l.phase === "top").pop();
  const tRoute = t ? t.route : route;
  const chrome = (t && chromes[t.id]) || { tab: ROOTS.has(tRoute.name) && tRoute.name !== "welcome", tray: false };
  const active = chrome.tab ? tRoute.name : TAB_OF[tRoute.name];
  const live = state.bookings.filter((b) => ["active", "upcoming", "pending"].includes(bookingStatus(b))).length;
  const showTray = chrome.tray && state.compareIds.length > 0 && tRoute.name !== "map";
  const tapTab = (k: RouteName) => {
    if (t && t.route.name === k) { els.current.get(t.id)?.scrollTo({ top: 0, behavior: RM() ? "auto" : "smooth" }); return; }
    nav.go("/" + k);
  };

  return (
    <NavCtx.Provider value={nav}>
      <SheetHost>
        <div className={`device${chrome.tab ? "" : " no-tabbar"}`} ref={deviceRef}>
          <div className="screens" ref={screensRef}>
            {layers.map((l) => <LayerView key={l.id} layer={l} setEl={setEl} setChrome={setChrome} />)}
          </div>
          <nav className="tabbar" aria-label="Main">
            {TABS.map(([k, label, ic]) => (
              <a key={k} className={`tab${k === active ? " is-on" : ""}`} role="button" tabIndex={0} aria-label={label} aria-current={k === active ? "page" : undefined}
                onClick={() => tapTab(k)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tapTab(k); } }}>
                <span className="tab-ico"><Icon name={ic} size={21} />{k === "bookings" && live ? <span className="tab-badge">{live}</span> : null}</span>{label}
              </a>
            ))}
          </nav>
          <div className="floating" hidden={!showTray}>{showTray ? <CompareTray /> : null}</div>
          <div className="edge-swipe" hidden={!edgeOn} onPointerDown={onEdgeDown} onPointerMove={onEdgeMove} onPointerUp={onEdgeEnd} onPointerCancel={onEdgeEnd} />
        </div>
      </SheetHost>
    </NavCtx.Provider>
  );
}

/** One stack layer. Memoised: the screen re-renders from its own hooks (store, route, layer context) only —
    shell renders (swipe classes, chrome) never cascade into the screen's tree. */
const LayerView = memo(function LayerView({ layer: l, setEl, setChrome }: { layer: Layer; setEl: LayerInfo["setEl"]; setChrome: LayerInfo["setChrome"] }) {
  const info = useMemo<LayerInfo>(() => ({ id: l.id, cls: l.cls, top: l.phase === "top", hidden: l.hidden, first: l.first, backLabel: l.backLabel, setEl, setChrome }),
    [l.id, l.cls, l.phase, l.hidden, l.first, l.backLabel, setEl, setChrome]);
  const Comp = SCREENS[l.route.name] || M.Explore;
  const screen = useMemo(() => <Comp />, [Comp]);
  return (
    <LayerCtx.Provider value={info}>
      <ScreenRouteProvider value={l.route}>{screen}</ScreenRouteProvider>
    </LayerCtx.Provider>
  );
});
