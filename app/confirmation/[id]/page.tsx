"use client";
import ScreenSwitch from "@/components/ScreenSwitch";
import { Confirmation as Mobile } from "@/components/mobile";
import { Confirmation as Desktop } from "@/components/desktop";

export default function Page() {
  return <ScreenSwitch mobile={<Mobile />} desktop={<Desktop />} />;
}
