"use client";
/* PARKLY mobile · pass.tsx — the mobile boarding pass (prototype mobile.html passHTML(b, o)).
   Shared by builder A (Confirmation) and builder B (BookingDetail, Arrive). Keep this signature stable.

     <PassView booking={b} />                 static pass
     <PassView booking={b} print />           print animation (slides up, perforation draws in, QR fades, one scan sweep)
     <PassView booking={b} now={t} />         status / step rail evaluated at `t` (e.g. useNow(1000)); default = store `now`
     className                                extra classes on article.pass

   Markup = article.pass.m-pass[.is-printing] > .pass-top.grain (brand + status badge, bay, red/white barrier that lifts
   after check-in, facility · level, entry / exit by / plate / ref-or-gate-code grid, Drive→Enter→Park→Exit rail)
   + .pass-tear (perforation) + .pass-bottom.pass-qr (real QR "PARKLY|ref|plate" + scan line, "Scan at entry").
   Rendering is delegated to components/shared/Pass (variant "mobile"), which is the 1:1 port of passHTML. */
import type { Booking } from "@/lib/data";
import { useApp } from "@/lib/store";
import Pass from "@/components/shared/Pass";

export interface PassViewProps {
  booking: Booking;
  /** play the print animation (prototype o.print) */
  print?: boolean;
  /** evaluate status / step rail at this time (ms); defaults to the store's now */
  now?: number;
  className?: string;
}

export function PassView({ booking, print = false, now, className = "" }: PassViewProps) {
  const app = useApp();
  return <Pass booking={booking} now={now ?? app.now} printing={print} variant="mobile" className={className} />;
}

export default PassView;
