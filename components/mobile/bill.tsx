"use client";
/* Mobile bill (prototype engine bill(q, {totalLabel})): itemised lines + total. Unlike the shared desktop <Bill>
   (per-character odometer), the mobile prototype either repaints the total (Reserve summary) or rolls the whole
   amount once (Checkout, P.rollNumber 340 ms) — `roll` picks the latter. */
import { useEffect, useState } from "react";
import type { Quote } from "@/lib/data";
import { money, reducedMotion } from "@/lib/engine";

/** Whole-value roll (P.rollNumber): old slides out, new slides in, 360 ms, then plain text. */
export function RollText({ text, className = "" }: { text: string; className?: string }) {
  const [st, setSt] = useState<{ cur: string; old: string | null; k: number }>({ cur: text, old: null, k: 0 });
  if (st.cur !== text) setSt({ cur: text, old: st.cur, k: st.k + 1 });
  const k = st.k;
  useEffect(() => {
    if (!k) return;
    const t = window.setTimeout(() => setSt((s) => (s.k === k ? { ...s, old: null } : s)), 360);
    return () => window.clearTimeout(t);
  }, [k]);
  if (st.old !== null && st.cur === text && !reducedMotion())
    return <span key={"r" + k} className={`${className} roll`.trim()}><span className="roll-old">{st.old}</span><span className="roll-new">{text}</span></span>;
  return <span key={"t" + k} className={className}>{text}</span>;
}

export function MBill({ quote: q, totalLabel = "Total", roll = false }: { quote: Pick<Quote, "lines" | "total">; totalLabel?: string; roll?: boolean }) {
  return (
    <div className="bill">
      {q.lines.map((l, i) => (
        <div key={l.label + i} className={`bill-row${l.amount < 0 ? " is-neg" : ""}`}>
          <div><div className="bill-label">{l.label}</div>{l.hint ? <div className="bill-hint">{l.hint}</div> : null}</div>
          <div className="bill-amt">{l.amount < 0 ? "− " + money(-l.amount) : money(l.amount)}</div>
        </div>
      ))}
      <div className="bill-total"><span>{totalLabel}</span>{roll ? <RollText className="bill-amt" text={money(q.total)} /> : <span className="bill-amt">{money(q.total)}</span>}</div>
    </div>
  );
}
