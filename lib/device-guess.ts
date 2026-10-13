/* Server-safe device guess from request headers (used by app/layout.tsx for the first paint).
   `sec-ch-ua-mobile: ?1` (Chromium client hint) or a mobile user-agent → 'mobile'; else 'desktop'.
   The client then confirms by width with matchMedia('(min-width: 900px)') in lib/device.tsx. */
export type Device = "mobile" | "desktop";

export function guessDevice(h: { get(name: string): string | null }): Device {
  const hint = h.get("sec-ch-ua-mobile");
  if (hint === "?1") return "mobile";
  if (hint === "?0") return "desktop";
  const ua = h.get("user-agent") || "";
  if (/Mobi|Android(?!.*Tablet)|iPhone|iPod|IEMobile|Opera Mini|BlackBerry|webOS/i.test(ua)) return "mobile";
  return "desktop";
}
