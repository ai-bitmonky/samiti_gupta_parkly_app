"use client";
import ScreenSwitch from "@/components/ScreenSwitch";
import { Bookings as Mobile } from "@/components/mobile";
import { Bookings as Desktop } from "@/components/desktop";

export default function Page() {
  return <ScreenSwitch mobile={<Mobile />} desktop={<Desktop />} />;
}
