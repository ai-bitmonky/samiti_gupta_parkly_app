"use client";
import ScreenSwitch from "@/components/ScreenSwitch";
import { Welcome as Mobile } from "@/components/mobile";
import { Welcome as Desktop } from "@/components/desktop";

export default function Page() {
  return <ScreenSwitch mobile={<Mobile />} desktop={<Desktop />} />;
}
