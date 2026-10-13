"use client";
import ScreenSwitch from "@/components/ScreenSwitch";
import { Notifications as Mobile } from "@/components/mobile";
import { Notifications as Desktop } from "@/components/desktop";

export default function Page() {
  return <ScreenSwitch mobile={<Mobile />} desktop={<Desktop />} />;
}
