"use client";
import ScreenSwitch from "@/components/ScreenSwitch";
import { Explore as Mobile } from "@/components/mobile";
import { Explore as Desktop } from "@/components/desktop";

export default function Page() {
  return <ScreenSwitch mobile={<Mobile />} desktop={<Desktop />} />;
}
