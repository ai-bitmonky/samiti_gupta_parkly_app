/* Screen registry. Replace each stub with the real screen component (same export name). */
"use client";
import Logo from "@/components/shared/Logo";

function Stub({ name }: { name: string }) {
  return (<main className="page" style={{ padding: 24 }}><Logo size={32} /><p className="muted" style={{ marginTop: 12 }}>Mobile · {name} (coming next)</p></main>);
}

export function Home() { return <Stub name="Home" />; }
export function Welcome() { return <Stub name="Welcome" />; }
export function Explore() { return <Stub name="Explore" />; }
export function MapScreen() { return <Stub name="MapScreen" />; }
export function Facility() { return <Stub name="Facility" />; }
export function Reserve() { return <Stub name="Reserve" />; }
export function Checkout() { return <Stub name="Checkout" />; }
export function Confirmation() { return <Stub name="Confirmation" />; }
export function Bookings() { return <Stub name="Bookings" />; }
export function BookingDetail() { return <Stub name="BookingDetail" />; }
export function Arrive() { return <Stub name="Arrive" />; }
export function Saved() { return <Stub name="Saved" />; }
export function Compare() { return <Stub name="Compare" />; }
export function Notifications() { return <Stub name="Notifications" />; }
export function Profile() { return <Stub name="Profile" />; }
