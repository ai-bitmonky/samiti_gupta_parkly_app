"use client";
import ScreenSwitch from "@/components/ScreenSwitch";
import { Profile as Mobile } from "@/components/mobile";
import { Profile as Desktop } from "@/components/desktop";

export default function Page() {
  return <ScreenSwitch mobile={<Mobile />} desktop={<Desktop />} />;
}
