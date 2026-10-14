"use client";
/* 8 · CONFIRMATION (prototype Screens.confirmation): "You're booked" (lime check badge pops in) or "Booking received"
   (amber clock badge, operator confirms within a minute; flips live with a toast when they do), the boarding pass
   printing out (slide up, perforation draws, QR fades in, scan sweep), what was paid (+ promo saving), entry steps,
   View booking / Directions / Calendar / Back to Explore. No back button: Done returns to Explore. */
import { useEffect, useRef } from "react";
import { useApp, useNow } from "@/lib/store";
import { D, bookingStatus, facility, getBooking, mapsUrl, money } from "@/lib/engine";
import Icon from "@/components/shared/Icon";
import { useToast } from "@/components/shared/ToastProvider";
import { Empty, Screen, Topbar, useNav } from "./kit";
import { CalendarSheet, useSheet } from "./sheets";
import { useScreenRoute } from "./route";
import { useScreenTitle } from "./title";
import { PassView } from "./pass";

export default function Confirmation() {
  const { params } = useScreenRoute();
  const { state } = useApp();
  const nav = useNav();
  const toast = useToast();
  const openSheet = useSheet();
  const t = useNow(1000);
  const b = getBooking(state, params.id);
  const f = b ? facility(b.facilityId) : undefined;
  const pending = b ? bookingStatus(b, t) === "pending" : false;
  useScreenTitle(b ? (pending ? "Booking received · PARKLY" : "You're booked · PARKLY") : "Booking · PARKLY");
  const was = useRef(pending);
  useEffect(() => {
    if (was.current && !pending && b) toast("The operator confirmed your booking", "ok");
    was.current = pending;
  }, [pending]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!b || !f) return (
    <Screen>
      <Topbar title="Booking" />
      <Empty ico="search-x" title="Booking not found" text="It may have been removed." />
    </Screen>
  );
  const done = () => nav.reset([], "/explore", "pop");
  const paidWith = (D.paymentMethods.find((m) => m.id === b.payment.method) || { label: b.payment.method }).label;
  return (
    <Screen>
      <Topbar title={pending ? "Booking received" : "You're booked"} back={false} actions={<button type="button" className="btn btn-ghost btn-sm" onClick={done}>Done</button>} />
      <div className="page center-col">
        <div className={`check-badge${pending ? " is-pend" : ""}`} style={{ margin: "8px auto 0" }}><Icon name={pending ? "clock" : "check"} size={36} /></div>
        <h1 className="h1 center mt-16">{pending ? "Booking received" : "You're booked"}</h1>
        <p className="small muted center mt-4">{pending ? `${f.name} confirms private spaces by hand. We'll tell you within a minute.` : `Your space at ${f.name} is held for you.`}</p>
        <div className="pass-slot mt-24"><PassView booking={b} now={t} print /></div>
        <div className="card card-pad mt-24">
          <div className="row-between"><span className="small muted">Paid via {paidWith}</span><b className="mono">{money(b.payment.amount)}</b></div>
          {b.price.discount ? <div className="tiny t-ok mt-4">You saved {money(b.price.discount)} with {b.price.promo}</div> : null}
        </div>
        <div className="sec" style={{ marginTop: 28 }}><div className="sec-head"><h2>When you get there</h2></div><ol className="steps">{f.entry.map((x) => <li key={x}>{x}</li>)}</ol></div>
        <div className="stack-8 mt-24">
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => nav.reset(["/bookings"], "/bookings/" + b.id, "push")}>View booking</button>
          <div className="row gap-8">
            <a className="btn btn-secondary btn-md" style={{ flex: 1 }} href={mapsUrl(f)} target="_blank" rel="noopener noreferrer"><Icon name="navigation" size={17} />Directions</a>
            <button type="button" className="btn btn-secondary btn-md" style={{ flex: 1 }} onClick={() => openSheet(({ open, close }) => <CalendarSheet open={open} onClose={close} booking={b} />)}><Icon name="calendar-plus" size={17} />Calendar</button>
          </div>
          <button type="button" className="btn btn-ghost btn-md btn-block" onClick={done}>Back to Explore</button>
        </div>
      </div>
    </Screen>
  );
}
