"use client";
/* 6. CONFIRMATION (prototype Views.confirmation): check pop, "You're booked" / "Booking received", printing pass,
   paid (count-up) + breakdown, entry steps, actions (View booking / Directions / Add to calendar / Book another).
   A pending (owner-confirms) booking flips to confirmed live and posts a notification. */
import { useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useApp, useNow } from "@/lib/store";
import { bookingStatus, facilityOrThrow, mapsUrl } from "@/lib/engine";
import Icon from "@/components/shared/Icon";
import Badge from "@/components/shared/Badge";
import Bill from "@/components/shared/Bill";
import Pass from "@/components/shared/Pass";
import { useToast } from "@/components/shared/ToastProvider";
import DesktopShell, { useModal, useTitle } from "./DesktopShell";
import { CalendarModal, CountRup, EmptyState, Topbar, methodLabel } from "./common";

function ConfirmationView() {
  useTitle("You're booked · PARKLY");
  const { id } = useParams<{ id: string }>();
  const { state, actions } = useApp();
  const toast = useToast();
  const openModal = useModal();
  const t = useNow(1000);
  const b = state.bookings.find((x) => x.id === id);
  const status = b ? bookingStatus(b, t) : null;
  const was = useRef(status);
  useEffect(() => {
    if (!b || !status || was.current === status) return;
    const prev = was.current;
    was.current = status;
    if (prev === "pending" && status === "upcoming") {
      const f = facilityOrThrow(b.facilityId);
      toast(`${f.name} confirmed your booking`, "ok");
      actions.notify({ kind: "confirmed", title: "Booking confirmed", body: `${f.name} confirmed. Your pass is ready.`, bookingId: b.id });
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!b) return (<><Topbar title="Booking" /><div className="page"><EmptyState ico="calendar-check" title="Booking not found" action={<Link className="btn btn-primary btn-md" href="/bookings">My bookings</Link>}>It may have been reset. Check your bookings list.</EmptyState></div></>);
  const f = facilityOrThrow(b.facilityId), pending = status === "pending";
  return (
    <>
      <Topbar title={pending ? "Booking received" : "You're booked"} sub={b.ref} />
      <div className="page"><div className="conf">
        <div className="conf-head">
          <div className="check-badge" style={pending ? { background: "var(--warn)" } : undefined}><Icon name={pending ? "clock" : "check"} size={36} /></div>
          <h1 className="h1d">{pending ? "Booking received" : "You're booked"}</h1>
          <p className="ink-2" style={{ maxWidth: 520 }}>{pending ? `${f.name} will confirm within a minute. We'll notify you. If they decline, you get a full refund.` : `Your space at ${f.name} is held for you. Show this pass at the entry.`}</p>
        </div>
        <div className="two-col" style={{ gridTemplateColumns: "minmax(0,560px) minmax(300px,1fr)", justifyContent: "center" }}>
          <div className="conf-pass"><Pass booking={b} facility={f} now={t} printing variant="desktop" /></div>
          <div className="stack-16">
            <section className="card sec-card">
              <div className="row-between mb-12"><span className="lbl">Paid</span><Badge>{methodLabel(b.payment.method)}</Badge></div>
              <CountRup to={b.payment.amount} style={{ fontSize: 36 }} />
              <div className="tiny muted mono mt-8">Txn {b.payment.txnId}</div>
              <details className="faq mt-8"><summary>Price breakdown <Icon name="chevron-down" size={16} /></summary><Bill quote={b.price} totalLabel="Paid" /></details>
            </section>
            <section className="card sec-card"><h2 className="card-title mb-12">When you arrive</h2><ol className="steps-ol">{f.entry.map((x) => <li key={x}>{x}</li>)}</ol></section>
            <div className="grid-2" style={{ gap: 8 }}>
              <Link className="btn btn-primary btn-md is-mag" href={`/bookings/${b.id}`}>View booking</Link>
              <a className="btn btn-secondary btn-md" href={mapsUrl(f)} target="_blank" rel="noopener noreferrer"><Icon name="navigation" size={16} />Directions</a>
              <button type="button" className="btn btn-secondary btn-md" onClick={() => openModal(({ open, close }) => <CalendarModal open={open} close={close} booking={b} facility={f} />)}><Icon name="calendar-plus" size={16} />Add to calendar</button>
              <Link className="btn btn-ghost btn-md" href="/explore"><Icon name="search" size={16} />Book another</Link>
            </div>
          </div>
        </div>
      </div></div>
    </>
  );
}

export default function Confirmation() { return <DesktopShell><ConfirmationView /></DesktopShell>; }
