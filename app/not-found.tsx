/* 404 for paths outside the app (the mobile shell and the desktop views own every real route; unknown ids inside
   a route show their own empty states). Uses the app's empty state so it reads on the dark theme on both devices. */
import Link from "next/link";
import { EmptyState } from "@/components/desktop/common";
import Logo from "@/components/shared/Logo";

export default function NotFound() {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: "24px 16px" }}>
      <Logo size={30} />
      <EmptyState ico="search-x" title="Page not found" action={<Link className="btn btn-primary btn-md" href="/" style={{ color: "var(--on-lime)" }}>Find parking</Link>}>
        This link doesn&apos;t go anywhere in PARKLY.
      </EmptyState>
    </div>
  );
}
