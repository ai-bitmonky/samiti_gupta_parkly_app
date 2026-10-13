/* Facility illustration — the 3 SVG scenes ported from the prototype (Illus.facility), tinted with the facility hue.
   <FacilityIllustration facility={f} scene="entrance" | "bays" | "inside" | 0 | 1 | 2 className="" />
   Default scene: garage → inside, driveway → entrance, else bays. viewBox 160×110, fills its box (slice).
   Wrap it in .illus-frame (16:11) or .thumb to size it. */
import { useId } from "react";
import type { Facility } from "@/lib/data";

export type Scene = "entrance" | "bays" | "inside";
export const SCENES: Scene[] = ["entrance", "bays", "inside"];
export const defaultScene = (f: Facility): Scene => (f.type === "garage" ? "inside" : f.type === "driveway" ? "entrance" : "bays");

const CAR_COLS = ["#D9D6CC", "#6F827B", "#33423B", "#B9483A", "#3D5A80", "#D9B26F", "#8E9893"];
const carCol = (seed: number, i: number) => CAR_COLS[(seed * 7 + i * 3) % CAR_COLS.length];

/** top-down car */
function Car({ x, y, w, h, col }: { x: number; y: number; w: number; h: number; col: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={w * 0.28} fill={col} />
      <rect x={x + w * 0.14} y={y + h * 0.22} width={w * 0.72} height={h * 0.2} rx="3" fill="#06090A" opacity=".55" />
      <rect x={x + w * 0.14} y={y + h * 0.62} width={w * 0.72} height={h * 0.14} rx="3" fill="#06090A" opacity=".45" />
    </g>
  );
}

export default function FacilityIllustration({ facility: f, scene, className = "" }: { facility: Facility; scene?: Scene | 0 | 1 | 2; className?: string }) {
  const gid = "ig" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const name = scene === undefined || scene === null ? defaultScene(f) : typeof scene === "number" ? SCENES[scene] : scene;
  const seed = f.id.length + f.capacity, hue = f.hue;
  const tint = `hsl(${hue} 45% 42%)`, tintDim = `hsl(${hue} 30% 18%)`, tintGlow = `hsl(${hue} 60% 60%)`;
  let body: React.ReactNode;

  if (name === "bays") { // top-down lot at night, our lit bay in lime
    body = (
      <>
        <defs><radialGradient id={gid} cx=".46" cy=".3" r=".8"><stop offset="0" stopColor={tintGlow} stopOpacity=".18" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient></defs>
        <rect width="160" height="110" fill="#141B17" /><rect width="160" height="110" fill={`url(#${gid})`} />
        <rect y="50" width="160" height="12" fill="#1B2420" />
        {Array.from({ length: 8 }, (_, i) => (
          <g key={"l" + i}><rect x={6 + i * 19} y="4" width="1.6" height="40" fill="#F5F4EF" opacity=".28" /><rect x={6 + i * 19} y="66" width="1.6" height="40" fill="#F5F4EF" opacity=".28" /></g>
        ))}
        {Array.from({ length: 7 }, (_, i) => (i !== 3 ? <Car key={"t" + i} x={10 + i * 19} y={9} w={12} h={30} col={carCol(seed, i)} /> : null))}
        {Array.from({ length: 7 }, (_, i) => ((i + seed) % 3 !== 0 ? <Car key={"b" + i} x={10 + i * 19} y={71} w={12} h={30} col={carCol(seed, i + 4)} /> : null))}
        <rect x="65.5" y="8" width="16" height="33" rx="2" fill="#C6F432" opacity=".16" stroke="#C6F432" strokeWidth="1.4" />
        <text x="73.5" y="29" textAnchor="middle" fontSize="9" fontWeight="700" fill="#C6F432" fontFamily="JetBrains Mono, monospace">P</text>
        {f.type === "ev" && Array.from({ length: 7 }, (_, i) => <rect key={"e" + i} x={14 + i * 19} y="1" width="4" height="5" rx="1" fill="#C6F432" />)}
        {f.covered && <rect width="160" height="110" fill={tint} opacity=".10" />}
        <path d="M8 56h18M40 56h18M72 56h18M104 56h18M136 56h18" stroke="#E9C84A" strokeWidth="1.4" opacity=".75" />
      </>
    );
  } else if (name === "inside") { // garage ramp perspective
    body = (
      <>
        <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={tintDim} /><stop offset="1" stopColor="#0E1411" /></linearGradient></defs>
        <rect width="160" height="110" fill={`url(#${gid})`} /><polygon points="0,110 160,110 112,58 48,58" fill="#161E1A" />
        <rect x="48" y="30" width="64" height="28" fill="#0A0F0C" /><rect x="48" y="30" width="64" height="3" fill={tint} />
        {[0, 1].map((side) => [0, 1, 2].map((i) => (
          <rect key={`p${side}${i}`} x={side ? 160 - (14 + i * 22) - 8 : 14 + i * 22} y={8 + i * 12} width={8 - i * 2} height={102 - i * 34} fill="#26312C" />
        )))}
        <polygon points="56,110 66,58 70,58 64,110" fill="#F5F4EF" opacity=".22" /><polygon points="104,110 94,58 90,58 96,110" fill="#F5F4EF" opacity=".22" />
        <Car x={70} y={70} w={20} h={30} col={carCol(seed, 2)} />
        <rect x="62" y="40" width="36" height="10" rx="2" fill="#C6F432" />
        <text x="80" y="47.5" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#0F2A1F" fontFamily="JetBrains Mono, monospace">{(f.levels[1] || f.levels[0]) + " ▸"}</text>
        <circle cx="80" cy="18" r="6" fill="#C6F432" opacity=".85" /><circle cx="80" cy="18" r="14" fill="#C6F432" opacity=".10" />
      </>
    );
  } else { // ENTRANCE: street view at dusk
    body = (
      <>
        <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={tintDim} /><stop offset="1" stopColor="#121A15" /></linearGradient></defs>
        <rect width="160" height="110" fill={`url(#${gid})`} /><rect y="78" width="160" height="32" fill="#1B2420" />
        <path d="M0 94h160" stroke="#F5F4EF" strokeWidth="1.2" strokeDasharray="8 8" opacity=".25" />
        {f.type === "driveway" ? (
          <>
            <rect x="22" y="32" width="70" height="46" fill="#26312C" /><polygon points="16,34 57,12 98,34" fill={tint} />
            <rect x="34" y="48" width="14" height="14" fill="#E9C84A" opacity=".75" /><rect x="62" y="52" width="16" height="26" fill="#3A2E25" />
            <rect x="100" y="56" width="52" height="22" fill="none" stroke="#5A6B63" strokeWidth="2" />
            {Array.from({ length: 7 }, (_, i) => <rect key={"g" + i} x={102 + i * 7.5} y="56" width="1.6" height="22" fill="#5A6B63" />)}
            <Car x={112} y={84} w={26} h={18} col={carCol(seed, 1)} />
          </>
        ) : (
          <>
            <rect x="18" y="20" width="124" height="58" fill="#202B26" />
            {[0, 1, 2].map((i) => <rect key={"s" + i} x="18" y={30 + i * 16} width="124" height="3" fill={tint} opacity=".6" />)}
            <rect x="64" y="50" width="32" height="28" fill="#0A0F0C" /><rect x="64" y="50" width="32" height="28" fill="#C6F432" opacity=".06" />
            <rect x="96" y="70" width="40" height="3" rx="1.5" fill="#FF5A5F" /><rect x="94" y="64" width="6" height="14" fill="#3A4741" />
          </>
        )}
        <rect x="8" y="10" width="20" height="20" rx="4" fill="#0F2A1F" stroke="rgba(198,244,50,.35)" />
        <text x="18" y="25" textAnchor="middle" fontSize="14" fontWeight="800" fill="#F5F4EF" fontFamily="Schibsted Grotesk, sans-serif">P</text>
        <circle cx="24.5" cy="25.5" r="1.8" fill="#C6F432" />
      </>
    );
  }
  return (
    <svg className={`illus ${className}`.trim()} viewBox="0 0 160 110" preserveAspectRatio="xMidYMid slice" role="img" aria-label={`Illustration of ${f.name}`}>
      {body}
    </svg>
  );
}
