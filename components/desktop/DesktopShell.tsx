"use client";
/* Desktop shell (prototype desktop.html "shell: sidebar" + "global keys + magnetic buttons").
   <DesktopShell>            → sidebar (nav + badges + test clock + user) and <main>
   <DesktopShell landing>    → no sidebar (the landing has its own marketing nav)
   Also provides useModal(): openModal(({open, close}) => <SomeModal open={open} close={close}/>) for centred modals,
   the `/` shortcut (focus search), arrow / + / - forwarding to the main map, and magnetic primary buttons. */
import { Fragment, Suspense, createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useApp, useNow } from "@/lib/store";
import { bookingStatus, durationShort, reducedMotion, timeLabel, unreadCount } from "@/lib/engine";
import Icon from "@/components/shared/Icon";
import Logo from "@/components/shared/Logo";
import { useToast } from "@/components/shared/ToastProvider";

/* ── modal host ── */
export type ModalRender = (p: { open: boolean; close: () => void }) => ReactNode;
type OpenModal = (r: ModalRender) => () => void;
const ModalCtx = createContext<OpenModal>(() => () => {});
export const useModal = () => useContext(ModalCtx);

function ModalHost({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; render: ModalRender; open: boolean }[]>([]);
  const seq = useRef(0);
  const close = useCallback((id: number) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, open: false } : x)));
    window.setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 280);
  }, []);
  const open = useCallback<OpenModal>((render) => {
    const id = ++seq.current;
    setItems((xs) => [...xs, { id, render, open: true }]);
    return () => close(id);
  }, [close]);
  return (
    <ModalCtx.Provider value={open}>
      {children}
      {items.map((it) => <Fragment key={it.id}>{it.render({ open: it.open, close: () => close(it.id) })}</Fragment>)}
    </ModalCtx.Provider>
  );
}

/* ── sidebar ── */
const NAV: [string, string, string, string][] = [
  ["explore", "Explore", "compass", "/explore"], ["map", "Map", "map", "/map"], ["bookings", "Bookings", "calendar-check", "/bookings"],
  ["saved", "Saved", "heart", "/saved"], ["compare", "Compare", "columns", "/compare"], ["notifications", "Notifications", "bell", "/notifications"], ["profile", "Profile", "user", "/profile"],
];
const GROUP: Record<string, string> = { parking: "explore", reserve: "explore", checkout: "explore", confirmation: "bookings" };

function Sidebar() {
  const { state, actions } = useApp();
  const toast = useToast();
  const pathname = usePathname() || "/";
  const t = useNow(5000);
  const seg = pathname.split("/")[1] || "";
  const on = GROUP[seg] || seg;
  const live = state.bookings.filter((b) => ["upcoming", "active", "pending"].includes(bookingStatus(b))).length;
  const counts: Record<string, number> = { bookings: live, saved: state.savedIds.length, compare: state.compareIds.length, notifications: unreadCount(state) };
  const off = state.demo.clockOffsetMin;
  const adv = (n: number) => {
    if (n) actions.advanceClock(n); else actions.setClockOffset(0);
    toast(n ? `Clock moved ${durationShort(n)} ahead` : "Back to real time", "info");
  };
  return (
    <aside className="sidebar">
      <Link className="sidebar-logo" href="/" aria-label="PARKLY home"><Logo size={30} /></Link>
      <nav className="nav" aria-label="Main">
        {NAV.map(([k, label, ic, href]) => (
          <Link key={k} className={`nav-item${on === k ? " is-on" : ""}`} href={href} title={label} aria-current={on === k ? "page" : undefined}>
            <Icon name={ic} size={19} /><span className="nav-label">{label}</span>{counts[k] ? <span className="nav-badge">{counts[k]}</span> : null}
          </Link>
        ))}
      </nav>
      <div className="sidebar-foot sb-clock" title="Test clock">
        <div className="row-between"><span className="lbl">Test clock</span><Icon name="clock" size={14} className="muted" /></div>
        <div className="sb-time">{timeLabel(t)}</div>
        <div className={`sb-off${off ? " is-shift" : ""}`}>{off ? `${off > 0 ? "+" : "−"}${durationShort(Math.abs(off))} ahead of real time` : "Real time"}</div>
        <div className="sb-btns">
          <button type="button" onClick={() => adv(30)} title="Move the clock 30 minutes ahead">+30m</button>
          <button type="button" onClick={() => adv(60)} title="Move the clock 1 hour ahead">+1h</button>
          <button type="button" onClick={() => adv(0)} title="Back to real time">Now</button>
        </div>
      </div>
      <Link className="sb-user" href="/profile">
        <span className="avatar">{state.user.name[0]}</span>
        <span className="sb-user-txt small"><b>{state.user.name}</b><br /><span className="muted tiny">{state.user.guest ? "Guest" : "Signed in"}</span></span>
      </Link>
    </aside>
  );
}

/* ── global keys + magnetic buttons ── */
const MAP_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-"];
function useDesktopKeys() {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement, tag = (t.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || t.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector(".overlay")) return;
      if (e.key === "/") {
        e.preventDefault();
        const i = document.querySelector<HTMLInputElement>("main .js-where");
        if (i) i.focus(); else router.push("/explore");
        return;
      }
      const mp = document.querySelector<HTMLElement>(".js-keymap");
      if (mp && MAP_KEYS.includes(e.key) && !t.closest(".dial,.map")) {
        e.preventDefault();
        mp.dispatchEvent(new KeyboardEvent("keydown", { key: e.key, bubbles: true }));
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router]);
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (reducedMotion()) return;
      document.querySelectorAll<HTMLButtonElement>(".btn.is-mag").forEach((b) => {
        const r = b.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        const near = Math.abs(dx) < r.width / 2 + 30 && Math.abs(dy) < r.height / 2 + 30;
        const cl = (v: number) => Math.max(-6, Math.min(6, v)).toFixed(1);
        b.style.translate = near && !b.disabled ? `${cl(dx * 0.12)}px ${cl(dy * 0.25)}px` : "";
      });
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => document.removeEventListener("pointermove", onMove);
  }, []);
}

/** Sets document.title while the view is shown. */
export function useTitle(title: string) {
  useEffect(() => { document.title = title; }, [title]);
}

export default function DesktopShell({ children, landing = false }: { children: ReactNode; landing?: boolean }) {
  useDesktopKeys();
  return (
    <div className={`app${landing ? " no-sidebar" : ""}`}>
      {!landing && <Sidebar />}
      <main className="main">
        <Suspense fallback={null}><ModalHost>{children}</ModalHost></Suspense>
      </main>
    </div>
  );
}
