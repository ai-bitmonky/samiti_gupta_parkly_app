/* Desktop screen registry (export names are used by app/<route>/page.tsx via <ScreenSwitch>). */
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LandingView from "./Landing";

export { Explore, MapView } from "./Explore";
export { default as Facility } from "./Facility";
export { Reserve, Checkout } from "./Reserve";
export { default as Confirmation } from "./Confirmation";
export { Bookings, BookingDetail, Arrive } from "./Bookings";
export { Saved, Compare, Notifications } from "./Lists";
export { default as Profile } from "./Profile";

export function Landing() { return <LandingView />; }

/** Desktop has no separate welcome screen: /welcome shows the landing (prototype: #/welcome → #/). */
export function Welcome() {
  const router = useRouter();
  useEffect(() => { router.replace("/"); }, [router]);
  return <LandingView />;
}
