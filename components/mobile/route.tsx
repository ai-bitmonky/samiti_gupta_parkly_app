"use client";
/* PARKLY mobile · route.tsx — the route model of the mobile screen stack (prototype mobile.html "NAVIGATION").
   Mobile screens read route data ONLY through useScreenRoute(): every stack layer gets its route frozen at the
   moment it was pushed, so a screen that is animating out (or lying under an edge swipe) never shows the next
   route's params. Never call useParams / useSearchParams / usePathname inside a mobile screen.

     const { name, params, query, path, key } = useScreenRoute();
       name    "explore" | "parking" | "booking" | …  (prototype names, see RouteName)
       params  { id } for /parking/:id, /reserve/:id, /checkout/:id, /confirmation/:id, /bookings/:id(/arrive)
       query   URLSearchParams (read-only by convention)
       path    pathname, e.g. "/reserve/khan"
       key     pathname + "?query" — the stack key

   Also: TITLES (back-button labels), TABS / ROOTS / TAB_OF / PARENT (stack rules), parseRoute(), buildKey().
   Internal contexts used by MobileShell ↔ kit (NavCtx, LayerCtx, ShellActiveCtx) live here too so the kit,
   the sheets and the shell never import each other in a cycle through the shell. */
import { createContext, useContext } from "react";

export type RouteName =
  | "welcome" | "explore" | "map" | "parking" | "reserve" | "checkout" | "confirmation" | "bookings" | "booking"
  | "arrive" | "saved" | "compare" | "notifications" | "profile" | "landing";

export interface ScreenRoute {
  name: RouteName;
  params: Record<string, string>;
  query: URLSearchParams;
  path: string;
  key: string;
}

/** Back-button labels (prototype TITLES). */
export const TITLES: Record<RouteName, string> = {
  welcome: "Welcome", explore: "Explore", map: "Map", parking: "Details", reserve: "Reserve", checkout: "Checkout",
  confirmation: "Booked", bookings: "Bookings", booking: "Booking", arrive: "Arriving", saved: "Saved", compare: "Compare",
  notifications: "Alerts", profile: "Profile", landing: "Explore",
};

/** Tab bar: [route name, label, icon]. */
export const TABS: [RouteName, string, string][] = [
  ["explore", "Explore", "compass"], ["map", "Map", "map"], ["bookings", "Bookings", "calendar-check"], ["saved", "Saved", "heart"], ["profile", "Profile", "user"],
];
/** Screens that reset the stack (tab roots + welcome). */
export const ROOTS = new Set<RouteName>(["explore", "map", "bookings", "saved", "profile", "welcome"]);
/** Which tab is lit for a pushed screen. */
export const TAB_OF: Partial<Record<RouteName, RouteName>> = {
  parking: "explore", reserve: "explore", checkout: "explore", confirmation: "bookings", booking: "bookings", arrive: "bookings",
  compare: "saved", notifications: "explore",
};
/** Where "back" goes when the stack has nothing below (deep links). */
export const PARENT: Partial<Record<RouteName, (r: ScreenRoute) => string>> = {
  parking: () => "/explore", reserve: (r) => "/parking/" + r.params.id, checkout: (r) => "/reserve/" + r.params.id,
  booking: () => "/bookings", arrive: (r) => "/bookings/" + r.params.id, compare: () => "/saved", notifications: () => "/explore",
  confirmation: () => "/bookings",
};

const SIMPLE: Record<string, RouteName> = {
  "/welcome": "welcome", "/explore": "explore", "/map": "map", "/bookings": "bookings", "/saved": "saved", "/compare": "compare",
  "/notifications": "notifications", "/profile": "profile", "/": "landing",
};
const WITH_ID: Record<string, RouteName> = { parking: "parking", reserve: "reserve", checkout: "checkout", confirmation: "confirmation", bookings: "booking" };

/** "/reserve/khan" + "s=…&e=…" → ScreenRoute, or null for a path the mobile shell does not own (404s). */
export function parseRoute(pathname: string, search = ""): ScreenRoute | null {
  const path = (pathname || "/").replace(/\/+$/, "") || "/";
  const qs = search.replace(/^\?/, "");
  const mk = (name: RouteName, params: Record<string, string> = {}): ScreenRoute => ({ name, params, query: new URLSearchParams(qs), path, key: buildKey(path, qs) });
  if (SIMPLE[path]) return mk(SIMPLE[path]);
  const seg = path.split("/").filter(Boolean).map((s) => { try { return decodeURIComponent(s); } catch { return s; } });
  if (seg.length === 2 && WITH_ID[seg[0]]) return mk(WITH_ID[seg[0]], { id: seg[1] });
  if (seg.length === 3 && seg[0] === "bookings" && seg[2] === "arrive") return mk("arrive", { id: seg[1] });
  return null;
}
/** Parse a stack key ("/reserve/khan?s=…"). */
export const parseKey = (key: string) => { const i = key.indexOf("?"); return i < 0 ? parseRoute(key) : parseRoute(key.slice(0, i), key.slice(i + 1)); };

export type QueryInit = Record<string, string | number | boolean | null | undefined> | URLSearchParams | string;
/** path + query → stack key / URL ("/reserve/khan?s=1&e=2"); null/undefined values are dropped. */
export function buildKey(path: string, query?: QueryInit): string {
  let qs = "";
  if (typeof query === "string") qs = query.replace(/^\?/, "");
  else if (query instanceof URLSearchParams) qs = query.toString();
  else if (query) {
    const u = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => { if (v !== undefined && v !== null) u.set(k, String(v)); });
    qs = u.toString();
  }
  return path + (qs ? "?" + qs : "");
}

/* ── frozen route per layer ── */
const RouteCtx = createContext<ScreenRoute | null>(null);
export const ScreenRouteProvider = RouteCtx.Provider;
/** The route this screen was pushed with (frozen). Outside the shell it falls back to the live location. */
export function useScreenRoute(): ScreenRoute {
  const r = useContext(RouteCtx);
  if (r) return r;
  const loc = typeof window !== "undefined" ? window.location : null;
  return parseRoute(loc ? loc.pathname : "/explore", loc ? loc.search : "") || { name: "explore", params: {}, query: new URLSearchParams(), path: "/explore", key: "/explore" };
}

/* ── navigation (implemented by MobileShell; kit re-exports useNav) ── */
export type NavDir = "push" | "pop" | "tab" | "none";
export interface Nav {
  /** push a screen (router.push) */
  go(path: string, query?: QueryInit): void;
  /** close the top sheet; else pop the stack; else go to the PARENT screen */
  back(): void;
  /** reset the stack to `base` keys, then show `target` with `dir` (replaces the current history entry) */
  reset(base: string[], target: string, dir?: NavDir): void;
  /** swap the top of the stack for another screen (no way back to it) */
  replaceTop(path: string, query?: QueryInit): void;
  /** current stack keys, root first (read-only copy) */
  stack(): string[];
}
export const NavCtx = createContext<Nav | null>(null);

/* ── layer ↔ <Screen> handshake (internal) ── */
export interface ScreenChrome { tab: boolean; tray: boolean }
export interface LayerInfo {
  id: number;
  /** classes the shell puts on main.screen: nav-push-in, nav-pop-out, is-under, is-swiping, is-settling… */
  cls: string;
  /** true for the one interactive (top) layer */
  top: boolean;
  /** hidden while a tab switch animates the new tab in */
  hidden: boolean;
  /** first paint of this layer (false for an under-layer built by an edge swipe → no count-up) */
  first: boolean;
  /** label for the back button: TITLES of the screen below */
  backLabel: string;
  setEl(id: number, el: HTMLElement | null): void;
  setChrome(id: number, c: ScreenChrome): void;
}
export const LayerCtx = createContext<LayerInfo | null>(null);

/** true when the persistent MobileShell renders the screens for this URL (ScreenSwitch then renders nothing). */
export const ShellActiveCtx = createContext(false);
export const useShellActive = () => useContext(ShellActiveCtx);
