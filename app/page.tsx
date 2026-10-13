"use client";
import ScreenSwitch from "@/components/ScreenSwitch";
import { Home as Mobile } from "@/components/mobile";
import { Landing as Desktop } from "@/components/desktop";

export default function Page() {
  return <ScreenSwitch mobile={<Mobile />} desktop={<Desktop />} />;
}
