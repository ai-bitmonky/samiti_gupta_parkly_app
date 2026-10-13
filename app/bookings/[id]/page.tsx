"use client";
import ScreenSwitch from "@/components/ScreenSwitch";
import { BookingDetail as Mobile } from "@/components/mobile";
import { BookingDetail as Desktop } from "@/components/desktop";

export default function Page() {
  return <ScreenSwitch mobile={<Mobile />} desktop={<Desktop />} />;
}
