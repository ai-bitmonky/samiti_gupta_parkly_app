"use client";
/* Client providers, outermost first: device (mobile/desktop) → toasts → app store (+ splash) → confirm dialog. */
import type { ReactNode } from "react";
import { DeviceProvider } from "@/lib/device";
import type { Device } from "@/lib/device-guess";
import { AppProvider } from "@/lib/store";
import { ToastProvider } from "@/components/shared/ToastProvider";
import { ConfirmProvider } from "@/components/shared/Confirm";

export default function Providers({ device, children }: { device: Device; children: ReactNode }) {
  return (
    <DeviceProvider initial={device}>
      <ToastProvider>
        <AppProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
        </AppProvider>
      </ToastProvider>
    </DeviceProvider>
  );
}
