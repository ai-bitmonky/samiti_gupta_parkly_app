"use client";
import ScreenSwitch from "@/components/ScreenSwitch";
import { Arrive as Mobile } from "@/components/mobile";
import { Arrive as Desktop } from "@/components/desktop";

export default function Page() {
  return <ScreenSwitch mobile={<Mobile />} desktop={<Desktop />} />;
}
