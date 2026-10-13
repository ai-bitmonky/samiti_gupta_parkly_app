"use client";
/* Odometer number: when `value` changes, only the changed characters roll (180ms, PLAN §7).
   <RollNumber value={money(total)} className="price" />
   <CountUp to={136} format={money} ms={700} /> — count-up on first paint (skipped with reduced motion). */
import { useEffect, useState } from "react";
import { reducedMotion } from "@/lib/engine";

export default function RollNumber({ value, className = "" }: { value: string | number; className?: string }) {
  const text = String(value);
  const [st, setSt] = useState({ cur: text, old: text, n: 0 });
  if (st.cur !== text) setSt({ cur: text, old: st.cur, n: st.n + 1 }); // render-phase update (React "previous value" pattern)
  const old = st.cur !== text ? st.cur : st.old;
  const n = st.cur !== text ? st.n + 1 : st.n;
  const shift = text.length - old.length; // align from the right (digits, not the ₹ sign)
  return (
    <span className={`odo ${className}`.trim()}>
      <span className="sr-only">{text}</span>
      <span className="odo" aria-hidden="true">
        {Array.from(text).map((ch, i) => {
          const oi = i - shift, och = oi >= 0 && oi < old.length ? old[oi] : "";
          if (n > 0 && ch !== och)
            return <span className="odo-ch" key={`${i}-${n}`}><span className="roll-old">{och || " "}</span><span className="roll-new">{ch}</span></span>;
          return <span key={i}>{ch}</span>;
        })}
      </span>
    </span>
  );
}

export function CountUp({ to, format = (n: number) => String(Math.round(n)), ms = 700, className = "" }: { to: number; format?: (n: number) => string; ms?: number; className?: string }) {
  const [v, setV] = useState(to);
  useEffect(() => {
    if (reducedMotion() || ms <= 0) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      setV(to * e);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return <span className={className}>{format(v)}</span>;
}
