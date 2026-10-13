/* Itemised bill from engine.quote().lines; the total rolls when it changes.
   <Bill quote={q} totalLabel="Total to pay" /> */
import type { Quote } from "@/lib/data";
import { money } from "@/lib/engine";
import RollNumber from "./RollNumber";

export default function Bill({ quote, totalLabel = "Total", className = "" }: { quote: Pick<Quote, "lines" | "total">; totalLabel?: string; className?: string }) {
  return (
    <div className={`bill ${className}`.trim()}>
      {quote.lines.map((l, i) => (
        <div key={l.label + i} className={`bill-row${l.amount < 0 ? " is-neg" : ""}`}>
          <div><div className="bill-label">{l.label}</div>{l.hint && <div className="bill-hint">{l.hint}</div>}</div>
          <div className="bill-amt">{l.amount < 0 ? "− " + money(-l.amount) : money(l.amount)}</div>
        </div>
      ))}
      <div className="bill-total"><span>{totalLabel}</span><RollNumber className="bill-amt" value={money(quote.total)} /></div>
    </div>
  );
}
