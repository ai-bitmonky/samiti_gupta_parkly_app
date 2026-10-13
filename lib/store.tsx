"use client";
/* PARKLY · lib/store.tsx — the app store (client only).
   <AppProvider> holds AppState, persists it to localStorage `parkly.app.v1`, runs the 15-second tick and the
   test clock. Until the store has loaded on the client it renders a tiny splash (no hydration mismatch).
   useApp() → { state, actions, now, mounted }
     state    the whole AppState (lib/data.ts)
     actions  every A.* action of the prototype, same names, same return values (see `Actions` below)
     now      test-clock-aware "now" in ms; refreshes on every state change and every 15 s.
              For live second-by-second countdowns use useNow(1000).
   Every action applies synchronously (a ref holds the latest state), so a second call right after the first
   sees the first one's result — exactly like the prototype's S.set(). */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  MIN, STORE_KEY, STATE_VERSION, now as engineNow, setClockOffsetRaw, buildSeedState, bookingStatus, getBooking,
} from "./engine";
import { A, runTick, quoteExtension, previewModify, refundPreviewFor, exitPreview, loadState } from "./actions";
import type { CreateBookingInput, ModifyInput, SearchPatch, Result, ExtensionQuote, ModifyPreview } from "./actions";
import type {
  AppState, Booking, CustomPlace, DemoState, Filters, NotificationInput, NotifyPrefs, Prefs, User, Vehicle,
} from "./data";
import type { RefundPreview } from "./engine";
import { useToast } from "@/components/shared/ToastProvider";
import Logo from "@/components/shared/Logo";

export interface Actions {
  // profile & prefs (no login anywhere — guest/named is a local switch)
  completeOnboarding(guest?: boolean): void;
  signOut(): void;
  setUser(u: Partial<User>): void;
  setPrefs(p: Partial<Prefs>): void;
  setNotify(p: Partial<NotifyPrefs>): void;
  // search
  setSearch(p: SearchPatch): void; // start/end as ISO or ms
  setFilters(filters: Filters): void;
  resetFilters(): void;
  setDestination(destId: string): void;
  setCustomDestination(c: CustomPlace): void;
  nearMe(): void; // simulated location (Mandi House)
  viewed(fid: string): void;
  setSavedPlace(id: string, destId: string): void;
  // lists
  toggleSaved(fid: string): void;
  toggleCompare(fid: string): Result; // max 3
  clearCompare(): void;
  upsertVehicle(v: Omit<Vehicle, "id"> & { id?: string }): Result<Vehicle>; // validates plate
  removeVehicle(id: string): Result;
  setDefaultVehicle(id: string): void;
  // bookings
  createBooking(o: CreateBookingInput): Result<Booking>;
  modifyBooking(id: string, o: ModifyInput): Result<{ diff: number }>;
  previewModify(id: string, o: ModifyInput): Result<ModifyPreview>; // live diff, no save
  quoteExtension(id: string, min: number): ExtensionQuote;
  extendBooking(id: string, min: number): Result<{ extra: number }>;
  refundPreview(id: string): RefundPreview;
  cancelBooking(id: string): Result<{ refund: number }>;
  exitPreview(id: string): { overMs: number; fee: number };
  markArrived(id: string): void;
  markExited(id: string, fee?: number): void;
  // notifications
  notify(n: NotificationInput): void;
  markRead(nid: string): void;
  markAllRead(): void;
  removeNotification(nid: string): void;
  clearNotifications(): void;
  // saved searches
  saveSearch(label: string, alerts?: boolean): void;
  toggleSearchAlert(sid: string): void;
  removeSearch(sid: string): void;
  runSavedSearch(sid: string): void;
  checkAlerts(): number;
  refreshAvailability(): void;
  // demo / developer options
  setDemo(p: Partial<DemoState>): void;
  setClockOffset(min: number): void;
  advanceClock(min: number): void;
  jumpToNextEvent(): string | null;
  runTick(): void;
  resetDemo(): void;
  /** dev/testing only: replace the whole state (e.g. restore a snapshot) */
  replaceState(st: AppState): void;
}

interface AppCtx { state: AppState; actions: Actions; now: number; mounted: boolean }
const Ctx = createContext<AppCtx | null>(null);

function persist(st: AppState) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(st)); } catch { /* private mode / quota */ }
}
function applyPrefsToDom(p: Prefs) {
  const r = document.documentElement;
  if (p.largeText) r.setAttribute("data-text", "large"); else r.removeAttribute("data-text");
  if (p.reduceMotion) r.setAttribute("data-motion", "reduce"); else r.removeAttribute("data-motion");
}

export function AppProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const ref = useRef<AppState | null>(null);
  const [state, setState] = useState<AppState | null>(null);
  const [nowMs, setNowMs] = useState(0);

  const commit = useCallback((next: AppState) => {
    if (next === ref.current) return;
    ref.current = next;
    persist(next);
    setState(next);
    setNowMs(engineNow());
  }, []);
  const tick = useCallback(() => {
    const s = ref.current;
    if (!s) return;
    const d = runTick(s);
    if (d !== s) {
      commit(d);
      const n = d.notifications[0];
      if (n) toast(n.title, n.kind === "ending" ? "warn" : "info");
    } else setNowMs(engineNow());
  }, [commit, toast]);

  // Load once on the client (localStorage + Date only after mount).
  useEffect(() => {
    const st = loadState(STORE_KEY, STATE_VERSION, setClockOffsetRaw);
    setClockOffsetRaw(st.demo.clockOffsetMin);
    ref.current = st;
    persist(st);
    setState(st);
    setNowMs(engineNow());
  }, []);
  // 15-second tick: "Starts soon" / "ends in 15 minutes" notifications + refresh `now`.
  const ready = state !== null;
  useEffect(() => {
    if (!ready) return;
    const id = window.setInterval(tick, 15000);
    return () => window.clearInterval(id);
  }, [ready, tick]);
  // Mirror display prefs onto <html> (larger text, reduce motion).
  const prefs = state?.prefs;
  useEffect(() => { if (prefs) applyPrefsToDom(prefs); }, [prefs]);

  const actions = useMemo<Actions>(() => {
    const cur = () => ref.current as AppState;
    // run a pure transform, commit, return its result
    const run = <R,>(step: [AppState, R]): R => { commit(step[0]); return step[1]; };
    const setDemo = (p: Partial<DemoState>) => {
      run(A.setDemo(cur(), p));
      if (p.clockOffsetMin !== undefined) { setClockOffsetRaw(p.clockOffsetMin); setNowMs(engineNow()); tick(); }
    };
    const setClockOffset = (min: number) => setDemo({ clockOffsetMin: Math.round(min) });
    return {
      completeOnboarding: (guest = false) => run(A.completeOnboarding(cur(), guest)),
      signOut: () => run(A.signOut(cur())),
      setUser: (u) => run(A.setUser(cur(), u)),
      setPrefs: (p) => run(A.setPrefs(cur(), p)),
      setNotify: (p) => run(A.setNotify(cur(), p)),
      setSearch: (p) => run(A.setSearch(cur(), p)),
      setFilters: (f) => run(A.setFilters(cur(), f)),
      resetFilters: () => run(A.resetFilters(cur())),
      setDestination: (id) => run(A.setDestination(cur(), id)),
      setCustomDestination: (c) => run(A.setCustomDestination(cur(), c)),
      nearMe: () => run(A.nearMe(cur())),
      viewed: (fid) => run(A.viewed(cur(), fid)),
      setSavedPlace: (id, destId) => run(A.setSavedPlace(cur(), id, destId)),
      toggleSaved: (fid) => run(A.toggleSaved(cur(), fid)),
      toggleCompare: (fid) => run(A.toggleCompare(cur(), fid)),
      clearCompare: () => run(A.clearCompare(cur())),
      upsertVehicle: (v) => run(A.upsertVehicle(cur(), v)),
      removeVehicle: (id) => run(A.removeVehicle(cur(), id)),
      setDefaultVehicle: (id) => run(A.setDefaultVehicle(cur(), id)),
      createBooking: (o) => run(A.createBooking(cur(), o)),
      modifyBooking: (id, o) => run(A.modifyBooking(cur(), id, o)),
      previewModify: (id, o) => previewModify(cur(), id, o),
      quoteExtension: (id, min) => quoteExtension(cur(), id, min),
      extendBooking: (id, min) => run(A.extendBooking(cur(), id, min)),
      refundPreview: (id) => refundPreviewFor(cur(), id),
      cancelBooking: (id) => run(A.cancelBooking(cur(), id)),
      exitPreview: (id) => exitPreview(cur(), id),
      markArrived: (id) => run(A.markArrived(cur(), id)),
      markExited: (id, fee = 0) => run(A.markExited(cur(), id, fee)),
      notify: (n) => run(A.notify(cur(), n)),
      markRead: (nid) => run(A.markRead(cur(), nid)),
      markAllRead: () => run(A.markAllRead(cur())),
      removeNotification: (nid) => run(A.removeNotification(cur(), nid)),
      clearNotifications: () => run(A.clearNotifications(cur())),
      saveSearch: (label, alerts = true) => run(A.saveSearch(cur(), label, alerts)),
      toggleSearchAlert: (sid) => run(A.toggleSearchAlert(cur(), sid)),
      removeSearch: (sid) => run(A.removeSearch(cur(), sid)),
      runSavedSearch: (sid) => run(A.runSavedSearch(cur(), sid)),
      checkAlerts: () => run(A.checkAlerts(cur())),
      refreshAvailability: () => run(A.refreshAvailability(cur())),
      setDemo,
      setClockOffset,
      advanceClock: (min) => setClockOffset(cur().demo.clockOffsetMin + min),
      // Jump to 10 min before the next entry (upcoming) or exit (active). Returns a label or null.
      jumpToNextEvent: () => {
        const s = cur();
        const b = s.bookings.find((x) => ["active", "upcoming"].includes(bookingStatus(x)));
        if (!b) return null;
        const up = bookingStatus(b) === "upcoming";
        const target = new Date(up ? b.start : b.end).getTime() - 10 * MIN;
        setClockOffset(s.demo.clockOffsetMin + Math.round((target - engineNow()) / MIN));
        return `Jumped to 10 min before ${up ? "entry" : "exit"}`;
      },
      runTick: tick,
      resetDemo: () => {
        setClockOffsetRaw(0);
        try { localStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
        commit({ ...buildSeedState(Date.now()), onboarded: true });
      },
      replaceState: (st) => { setClockOffsetRaw(st.demo.clockOffsetMin); commit(st); },
    };
  }, [commit, tick]);

  const value = useMemo<AppCtx | null>(() => (state ? { state, actions, now: nowMs, mounted: true } : null), [state, actions, nowMs]);
  if (!value) return <Splash />;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Tiny splash shown until the client store is ready. */
export function Splash() {
  return <div className="splash" aria-label="Loading PARKLY" role="status"><Logo size={44} word={false} /></div>;
}

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp() must be used inside <AppProvider>");
  return c;
}

/** Live clock (test-clock aware) that re-renders every `interval` ms — for countdowns and rings. */
export function useNow(interval = 1000): number {
  const { now: base } = useApp();
  const [t, setT] = useState(() => engineNow());
  useEffect(() => {
    setT(engineNow());
    const id = window.setInterval(() => setT(engineNow()), interval);
    return () => window.clearInterval(id);
  }, [interval, base]);
  return t;
}

/** Convenience: a booking by id from the live state (undefined if missing). */
export function useBooking(id: string | undefined): Booking | undefined {
  const { state } = useApp();
  return id ? getBooking(state, id) : undefined;
}
