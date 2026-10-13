"use client";
import ScreenSwitch from "@/components/ScreenSwitch";
import { MapScreen as Mobile } from "@/components/mobile";
import { MapView as Desktop } from "@/components/desktop";

export default function Page() {
  return <ScreenSwitch mobile={<Mobile />} desktop={<Desktop />} />;
}
