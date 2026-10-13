"use client";
/* Renders the mobile or the desktop version of a screen, live on resize/rotate.
   Usage in app/<route>/page.tsx:  <ScreenSwitch mobile={<MobileExplore />} desktop={<DesktopExplore />} /> */
import type { ReactNode } from "react";
import { useDevice } from "@/lib/device";

export default function ScreenSwitch({ mobile, desktop }: { mobile: ReactNode; desktop: ReactNode }) {
  return <>{useDevice() === "desktop" ? desktop : mobile}</>;
}
