/* Badges. <Badge tone="ok" icon="zap">Instant</Badge>  ·  <StatusBadge booking={b} now={now} /> (Overstay → danger) */
import type { ReactNode } from "react";
import type { Booking, Tone } from "@/lib/data";
import { D, bookingStatus, isOverstay, statusTone } from "@/lib/engine";
import Icon from "./Icon";

export default function Badge({ tone = "neutral", icon, children, className = "" }: { tone?: Tone | "solid-lime"; icon?: string; children: ReactNode; className?: string }) {
  return <span className={`badge badge-${tone} ${className}`.trim()}>{icon && <Icon name={icon} size={13} />}{children}</span>;
}

export function StatusBadge({ booking, now }: { booking: Booking; now?: number }) {
  const st = bookingStatus(booking, now);
  return isOverstay(booking, now) ? <Badge tone="danger" icon="triangle-alert">Overstay</Badge> : <Badge tone={statusTone(st)}>{D.statusLabels[st]}</Badge>;
}
