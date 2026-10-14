"use client";
/* Renders the mobile or the desktop version of a screen, live on resize/rotate.
   Usage in app/<route>/page.tsx:  <ScreenSwitch mobile={<MobileExplore />} desktop={<DesktopExplore />} />
   On mobile the persistent MobileShell (mounted in app/providers.tsx) renders the screen stack for every route it
   owns, so here the mobile element is only a fallback for when no shell is active. */
import type { ReactNode } from "react";
import { useDevice } from "@/lib/device";
import { useShellActive } from "@/components/mobile/route";

export default function ScreenSwitch({ mobile, desktop }: { mobile: ReactNode; desktop: ReactNode }) {
  const device = useDevice();
  const shell = useShellActive();
  return <>{device === "desktop" ? desktop : shell ? null : mobile}</>;
}
