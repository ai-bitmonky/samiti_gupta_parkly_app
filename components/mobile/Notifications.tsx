"use client";
/* PARKLY mobile · Notifications.tsx — 14 ALERTS: unread rows (lime wash + dot), tap opens the booking / place and
   marks it read, swipe a row left to reveal delete, "…" sheet → mark all read / clear all.
   Prototype mobile.html Screens.notifications. */
import { useRef } from "react";
import { useApp } from "@/lib/store";
import { ago, getBooking } from "@/lib/engine";
import type { Notification } from "@/lib/data";
import Icon from "@/components/shared/Icon";
import { Sheet } from "@/components/shared/Overlay";
import { useToast } from "@/components/shared/ToastProvider";
import { Empty, Screen, Topbar, swallow, useNav } from "./kit";
import { useSheet } from "./sheets";
import { useScreenTitle } from "./b-shared";

const NK: Record<string, [string, string]> = {
  confirmed: ["check", "lime"], reminder: ["alarm-clock", "warn"], ending: ["timer", "warn"], availability: ["refresh-cw", "info"],
  price: ["sparkles", "info"], cancelled: ["x", "danger"], modified: ["pencil", "neutral"], extended: ["plus", "ok"],
};

function NRow({ n }: { n: Notification }) {
  const { state, actions } = useApp();
  const nav = useNav();
  const toast = useToast();
  const btn = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ x0: number | null; dx: number }>({ x0: null, dx: 0 });
  const [ic, tone] = NK[n.kind] || ["bell", "neutral"];
  const down = (e: React.PointerEvent) => { drag.current = { x0: e.clientX, dx: 0 }; };
  const move = (e: React.PointerEvent) => {
    const d = drag.current, b = btn.current;
    if (d.x0 === null || !b) return;
    d.dx = Math.min(0, e.clientX - d.x0);
    if (d.dx < -8) b.style.transform = `translateX(${Math.max(-80, d.dx)}px)`;
  };
  const up = () => {
    const d = drag.current, b = btn.current;
    if (d.x0 === null || !b) return;
    d.x0 = null;
    const open = d.dx < -40;
    b.style.transition = "transform 200ms";
    b.style.transform = open ? "translateX(-76px)" : "";
    window.setTimeout(() => { if (btn.current) btn.current.style.transition = ""; }, 220);
    if (Math.abs(d.dx) > 8) swallow.until = Date.now() + 200;
  };
  const openN = () => {
    actions.markRead(n.id);
    if (n.bookingId && getBooking(state, n.bookingId)) nav.go("/bookings/" + n.bookingId);
    else if (n.facilityId) nav.go("/parking/" + n.facilityId);
  };
  return (
    <div className={`nrow${n.read ? "" : " is-unread"}`}>
      <button type="button" ref={btn} className="grow-row" onClick={openN}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}>
        <span className={`ri nk-${tone}`}><Icon name={ic} size={16} /></span>
        <span className="lbl"><b className="small">{n.title}</b><small>{n.body}</small><small className="mono">{ago(n.at)}</small></span>
        {n.read ? null : <i className="udot" aria-label="Unread" />}
      </button>
      <button type="button" className="nrow-del" aria-label="Delete" onClick={() => { actions.removeNotification(n.id); toast("Alert deleted", "info"); }}><Icon name="trash" size={16} /></button>
    </div>
  );
}

function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { actions } = useApp();
  return (
    <Sheet open={open} onClose={onClose} title="Alerts" kind="sheet">
      <div className="act-list">
        <button type="button" className="list-row" onClick={() => { onClose(); actions.markAllRead(); }}><span className="ico-wrap"><Icon name="check-check" size={18} /></span><span className="grow">Mark all as read</span></button>
        <button type="button" className="list-row t-danger" onClick={() => { onClose(); actions.clearNotifications(); }}><span className="ico-wrap"><Icon name="trash" size={18} /></span><span className="grow">Clear all</span></button>
      </div>
    </Sheet>
  );
}

export function Notifications() {
  useScreenTitle("Alerts · PARKLY");
  const { state } = useApp();
  const openSheet = useSheet();
  const ns = state.notifications;
  return (
    <Screen>
      <Topbar title="Alerts" large actions={ns.length
        ? <button type="button" className="btn btn-ghost btn-sm" aria-label="More" onClick={() => openSheet(({ open, close }) => <MoreSheet open={open} onClose={close} />)}><Icon name="more" size={20} /></button>
        : undefined} />
      <div className="page">
        {ns.length ? <>
          <div className="group">{ns.map((n) => <NRow key={n.id} n={n} />)}</div>
          <p className="tiny muted center mt-12">Swipe a row left to delete it.</p>
        </> : <Empty ico="bell-off" title="You're all caught up" text="Booking updates, reminders and price alerts show up here." />}
      </div>
    </Screen>
  );
}
