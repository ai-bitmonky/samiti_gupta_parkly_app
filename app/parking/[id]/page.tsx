"use client";
import ScreenSwitch from "@/components/ScreenSwitch";
import { Facility as Mobile } from "@/components/mobile";
import { Facility as Desktop } from "@/components/desktop";

export default function Page() {
  return <ScreenSwitch mobile={<Mobile />} desktop={<Desktop />} />;
}
