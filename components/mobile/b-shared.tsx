"use client";
/* PARKLY mobile · b-shared.tsx — small pieces shared by builder B's screens (Bookings, Booking, Arrive, Saved,
   Compare, Alerts, Profile): per-screen document title, list rows and the
   "not found" frame. */
import { useContext, useEffect } from "react";
import type { ReactNode } from "react";
import Icon from "@/components/shared/Icon";
import { Empty, Topbar } from "./kit";
import { LayerCtx } from "./route";

/** Sets document.title while this screen is the top layer. Next re-commits its metadata <title> after
    hydration (and on navigation), so keep re-applying ours whenever the DOM changes while we're on top. */
export function useScreenTitle(title: string) {
  const layer = useContext(LayerCtx);
  const top = layer ? layer.top : true;
  useEffect(() => {
    if (!top) return;
    const apply = () => { if (document.title !== title) document.title = title; };
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    return () => mo.disconnect();
  }, [title, top]);
}

/** act-list row: icon tile, label (+ tiny sub), chevron */
export function ListRow({ ic, label, sub, className = "", onClick }: { ic: string; label: ReactNode; sub?: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <button type="button" className={`list-row ${className}`.trim()} onClick={onClick}>
      <span className="ico-wrap"><Icon name={ic} size={18} /></span>
      <span className="grow">{label}{sub ? <div className="tiny muted">{sub}</div> : null}</span>
      <Icon name="chevron-right" size={18} className="chev" />
    </button>
  );
}

/** topbar + empty state for a booking id that no longer exists */
export function NotFound({ title, text }: { title: string; text: string }) {
  return (<><Topbar title={title} /><Empty ico="search-x" title="Booking not found" text={text} /></>);
}

export const ms = (t: string | number) => +new Date(t);
