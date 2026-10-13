/* Star rating "★ 4.6 (1,284)". <Stars rating={4.6} count={1284} row /> — row shows 5 stars. */
export default function Stars({ rating, count, row }: { rating: number; count?: number; row?: boolean }) {
  const full = Math.round(rating);
  return (
    <span className="stars">
      {row ? (
        <span className="stars-row">{[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= full ? "on" : ""}>★</i>)}</span>
      ) : <i className="on">★</i>}
      <b>{rating.toFixed(1)}</b>
      {count !== undefined && <span className="muted">({Number(count).toLocaleString("en-IN")})</span>}
    </span>
  );
}
