"use client";
import ScreenSwitch from "@/components/ScreenSwitch";
import { Saved as Mobile } from "@/components/mobile";
import { Saved as Desktop } from "@/components/desktop";

export default function Page() {
  return <ScreenSwitch mobile={<Mobile />} desktop={<Desktop />} />;
}
