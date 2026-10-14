/* Temporary placeholder frame for screens not yet ported. Delete once every screen is real. */
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
export function Stub({ name, title, root, tab, tray, ptr, fixed, large, children }: StubProps) {
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

