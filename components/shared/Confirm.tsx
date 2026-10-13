"use client";
/* Promise-based confirm dialog (prototype confirmDialog). Wrap the app in <ConfirmProvider>; then
     const confirm = useConfirm();
     if (await confirm({ title: "Cancel booking?", body: <>You get ₹106 back.</>, confirm: "Cancel booking", tone: "danger", cancel: "Keep it" })) …
   Small sheet on mobile, small modal on desktop. Esc / backdrop / "Go back" resolve false. */
import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Sheet } from "./Overlay";

export interface ConfirmOptions { title: string; body?: ReactNode; confirm?: string; cancel?: string; tone?: "primary" | "danger" | "secondary" | "forest" }
type ConfirmFn = (o: ConfirmOptions) => Promise<boolean>;
const Ctx = createContext<ConfirmFn>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [open, setOpen] = useState(false);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const confirm = useCallback<ConfirmFn>((o) => new Promise<boolean>((res) => {
    resolver.current?.(false);
    resolver.current = res;
    setOpts(o);
    setOpen(true);
  }), []);
  const done = (v: boolean) => { resolver.current?.(v); resolver.current = null; setOpen(false); };
  return (
    <Ctx.Provider value={confirm}>
      {children}
      <Sheet open={open} onClose={() => done(false)} title={opts?.title} size="sm"
        footer={opts && <>
          <button type="button" className="btn btn-secondary btn-md" onClick={() => done(false)}>{opts.cancel || "Go back"}</button>
          <button type="button" className={`btn btn-${opts.tone || "primary"} btn-md`} onClick={() => done(true)}>{opts.confirm || "Confirm"}</button>
        </>}>
        {opts?.body && <div className="confirm-body">{opts.body}</div>}
      </Sheet>
    </Ctx.Provider>
  );
}

export const useConfirm = () => useContext(Ctx);
