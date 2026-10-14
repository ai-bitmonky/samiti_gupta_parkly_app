/* Mobile screen registry. MobileShell renders these by route name; app/<route>/page.tsx keeps the same names.
   Replace each stub with the real screen component (same export name), built on ./kit (<Screen>, <Topbar>, …). */
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

interface StubProps { name: RouteName; title?: string; root?: boolean; tab?: boolean; tray?: boolean; ptr?: boolean; fixed?: boolean; large?: boolean; children?: ReactNode }
function Stub({ name, title, root, tab, tray, ptr, fixed, large, children }: StubProps) {
  const r = useScreenRoute();
  return (
    <Screen tab={tab} tray={tray} ptr={ptr} fixed={fixed}>
      <Topbar title={title || TITLES[name]} large={large} back={!root} actions={root && name !== "welcome" ? <Bell /> : undefined} />
      <div className="page stack-16">
        <div className="row gap-12"><Logo size={28} word={false} /><p className="muted small">Mobile · {name}{r.params.id ? ` · ${r.params.id}` : ""} (coming next)</p></div>
        {children}
      </div>
    </Screen>
  );
}

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
