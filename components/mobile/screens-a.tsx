/* Mobile screens owned by builder A (see docs/MOBILE_PLAN.md phase 2). Re-exported by ./index. */
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

export function Home() {
  const router = useRouter();
  useEffect(() => { router.replace("/explore"); }, [router]);
  return null;
}

export function Welcome() {
  const { actions } = useApp();
  const nav = useNav();
  const toast = useToast();
  return (
    <Stub name="welcome" root>
      <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => { actions.completeOnboarding(false); nav.reset([], "/explore", "push"); }}>Find parking</button>
      <button type="button" className="btn btn-ghost btn-lg btn-block" onClick={() => { actions.completeOnboarding(true); nav.reset([], "/explore", "push"); toast("Browsing as a guest", "info"); }}>Continue as guest</button>
    </Stub>
  );
}

function Results() {
  const { state } = useApp();
  const { refreshing } = useScreen();
  const { results } = searchFacilities(state);
  if (refreshing) return <div className="rlist"><Skel n={3} /></div>;
  return <div className="rlist m-stagger">{results.slice(0, 8).map((r) => <RCard key={r.f.id} r={r} />)}</div>;
}
export function Explore() {
  return (
    <Stub name="explore" root tab tray ptr large>
      <div className="stack-12"><SearchBar /><WhenPill /></div>
      <FilterRow />
      <Results />
    </Stub>
  );
}
export function MapScreen() { return <Stub name="map" root tab fixed large />; }
export function Facility() {
  const { params } = useScreenRoute();
  const f = facility(params.id);
  return (
    <Stub name="parking" title={f ? f.name : TITLES.parking}>
      <button type="button" className="btn btn-primary btn-lg btn-block" data-go={`/reserve/${params.id}`}>Reserve</button>
    </Stub>
  );
}
export function Reserve() {
  const { params } = useScreenRoute();
  return <Stub name="reserve"><button type="button" className="btn btn-primary btn-lg btn-block" data-go={`/checkout/${params.id}`}>Continue to checkout</button></Stub>;
}
export function Checkout() { return <Stub name="checkout" />; }
export function Confirmation() { return <Stub name="confirmation" />; }
