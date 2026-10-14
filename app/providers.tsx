"use client";
/* Client providers, outermost first: device (mobile/desktop) → toasts → app store (+ splash) → confirm dialog
   → device chrome (on mobile: the persistent MobileShell that renders the screen stack). */
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DeviceProvider, useDevice } from "@/lib/device";
import type { Device } from "@/lib/device-guess";
import { AppProvider } from "@/lib/store";
import { ToastProvider } from "@/components/shared/ToastProvider";
import { ConfirmProvider } from "@/components/shared/Confirm";
import MobileShell from "@/components/mobile/MobileShell";
import { ShellActiveCtx, parseRoute } from "@/components/mobile/route";

/** Mobile: mounts the shell once (it survives route changes) next to the page tree; ScreenSwitch then renders
    nothing for the routes the shell owns. Desktop: just the page tree (DesktopShell lives in the desktop views). */
function DeviceChrome({ children }: { children: ReactNode }) {
  const mobile = useDevice() === "mobile";
  const pathname = usePathname() || "/";
  const owned = mobile && parseRoute(pathname) !== null;
  return (
    <ShellActiveCtx.Provider value={owned}>
      {mobile && <MobileShell />}
      {children}
    </ShellActiveCtx.Provider>
  );
}

export default function Providers({ device, children }: { device: Device; children: ReactNode }) {
  return (
    <DeviceProvider initial={device}>
      <ToastProvider>
        <AppProvider>
          <ConfirmProvider><DeviceChrome>{children}</DeviceChrome></ConfirmProvider>
        </AppProvider>
      </ToastProvider>
    </DeviceProvider>
  );
}
