"use client";
/* PARKLY · lib/device.tsx — which version to show: 'mobile' (< 900px) or 'desktop' (≥ 900px).
   The first value comes from the server (app/layout.tsx reads `sec-ch-ua-mobile` / user-agent) so the first paint
   is right; on the client matchMedia('(min-width: 900px)') confirms it and keeps it live on resize/rotate.
   Also sets <body class="m"> or <body class="d"> so the core.css shells apply. */
import { createContext, useContext, useEffect, useLayoutEffect, useState } from "react";
import type { ReactNode } from "react";

import type { Device } from "./device-guess";

export type { Device };
export const DESKTOP_QUERY = "(min-width: 900px)";
const Ctx = createContext<Device>("desktop");
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function DeviceProvider({ initial, children }: { initial: Device; children: ReactNode }) {
  const [device, setDevice] = useState<Device>(initial);
  useIsoLayoutEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const apply = () => setDevice(mq.matches ? "desktop" : "mobile");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  useIsoLayoutEffect(() => {
    const b = document.body;
    b.classList.toggle("m", device === "mobile");
    b.classList.toggle("d", device === "desktop");
  }, [device]);
  return <Ctx.Provider value={device}>{children}</Ctx.Provider>;
}

/** 'mobile' | 'desktop' */
export const useDevice = () => useContext(Ctx);
export const useIsDesktop = () => useContext(Ctx) === "desktop";
