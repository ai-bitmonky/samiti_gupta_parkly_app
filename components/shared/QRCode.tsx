/* Real, scannable QR code (byte mode, EC level M) as crisp SVG.
   <QRCode text={passPayload(b.ref, b.vehicle.plate)} size={116} />  (size optional; CSS can size .qr instead) */
import { useMemo } from "react";
import { qrPath } from "@/lib/qr";

export default function QRCode({ text, size, margin = 2, dark = "#0A0F0C", light = "#F5F4EF", className = "" }: { text: string; size?: number; margin?: number; dark?: string; light?: string; className?: string }) {
  const { d, size: full } = useMemo(() => qrPath(text, margin), [text, margin]);
  return (
    <svg className={`qr ${className}`.trim()} width={size} height={size} viewBox={`0 0 ${full} ${full}`} shapeRendering="crispEdges" role="img" aria-label="Booking QR code">
      <rect width={full} height={full} fill={light} />
      <path d={d} fill={dark} />
    </svg>
  );
}
