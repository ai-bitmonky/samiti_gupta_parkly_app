"use client";
import ScreenSwitch from "@/components/ScreenSwitch";
import { Compare as Mobile } from "@/components/mobile";
import { Compare as Desktop } from "@/components/desktop";

export default function Page() {
  return <ScreenSwitch mobile={<Mobile />} desktop={<Desktop />} />;
}
