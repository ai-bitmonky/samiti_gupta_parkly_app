/* Mobile screens owned by builder A (see docs/MOBILE_PLAN.md phase 2). Re-exported by ./index.
   Each screen lives in its own file; the shared boarding pass is ./pass (PassView). */
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export { default as Welcome } from "./Welcome";
export { default as Explore } from "./Explore";
export { default as MapScreen } from "./MapScreen";
export { default as Facility } from "./Facility";
export { default as Reserve } from "./Reserve";
export { default as Checkout } from "./Checkout";
export { default as Confirmation } from "./Confirmation";

/** "/" on mobile → Explore (the shell also redirects; this covers rendering outside the shell). */
export function Home() {
  const router = useRouter();
  useEffect(() => { router.replace("/explore"); }, [router]);
  return null;
}
