/* Shimmer placeholders. <Skeleton width="70%" height={14} />  ·  <SkeletonCard /> (result-card shaped) */
import type { CSSProperties } from "react";

export default function Skeleton({ width = "100%", height = 14, radius, className = "", style }: { width?: number | string; height?: number | string; radius?: number; className?: string; style?: CSSProperties }) {
  return <div className={`skeleton ${className}`.trim()} aria-hidden="true" style={{ width, height, borderRadius: radius, ...style }} />;
}

export function SkeletonCard() {
  return (
    <div className="card card-pad stack-12" aria-busy="true" aria-label="Loading">
      <div className="row gap-12"><Skeleton width={64} height={64} radius={14} /><div className="grow stack-8"><Skeleton width="70%" /><Skeleton width="45%" height={12} /></div></div>
      <Skeleton height={6} radius={6} />
      <div className="row-between"><Skeleton width={80} height={24} /><Skeleton width={96} height={36} radius={11} /></div>
    </div>
  );
}
