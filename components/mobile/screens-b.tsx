/* Mobile screens owned by builder B (see docs/MOBILE_PLAN.md phase 2). Re-exported by ./index. */
"use client";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { D, facility, searchFacilities } from "@/lib/engine";
import Logo from "@/components/shared/Logo";
import { useToast } from "@/components/shared/ToastProvider";
import { Bell, FilterRow, RCard, Screen, SearchBar, Skel, Topbar, WhenPill, useNav, useScreen } from "./kit";
import { TITLES, useScreenRoute } from "./route";
import type { RouteName } from "./route";

import { Stub } from "./stub";

export function Bookings() { return <Stub name="bookings" root tab ptr large />; }
export function BookingDetail() { return <Stub name="booking" />; }
export function Arrive() { return <Stub name="arrive" />; }
export function Saved() {
  const { state } = useApp();
  return (
    <Stub name="saved" root tab tray large>
      <button type="button" className="btn btn-secondary btn-md btn-block" data-go="/compare">Compare ({state.compareIds.length})</button>
      {state.savedIds.map((id) => D.facilities.find((f) => f.id === id)).filter(Boolean).map((f) => (
        <button type="button" key={f!.id} className="btn btn-outline btn-md btn-block" data-go={`/parking/${f!.id}`}>{f!.name}</button>
      ))}
    </Stub>
  );
}
export function Compare() { return <Stub name="compare" />; }
export function Notifications() { return <Stub name="notifications" />; }
export function Profile() { return <Stub name="profile" root tab large />; }
