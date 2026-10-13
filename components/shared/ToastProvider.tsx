"use client";
/* Toasts. Wrap the app in <ToastProvider>; then
     const toast = useToast();
     toast("Saved", "ok");                                  // tone: info | ok | warn | danger
     toast("Booking cancelled", "info", { label: "Undo", onClick: () => … }, 5000);
   Returns a close() function. Host sits above the mobile tab bar / centred in the desktop content area. */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Icon from "./Icon";

export type ToastTone = "info" | "ok" | "warn" | "danger";
export interface ToastAction { label: string; onClick: () => void }
type ToastFn = (text: string, tone?: ToastTone, action?: ToastAction, ms?: number) => () => void;
interface ToastItem { id: number; text: string; tone: ToastTone; action?: ToastAction; out: boolean }

const Ctx = createContext<ToastFn>(() => () => {});
const ICON: Record<ToastTone, string> = { ok: "circle-check", warn: "triangle-alert", danger: "circle-x", info: "info" };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const close = useCallback((id: number) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, out: true } : x)));
    window.setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 240);
  }, []);
  const toast = useCallback<ToastFn>((text, tone = "info", action, ms = 3200) => {
    const id = ++seq.current;
    setItems((xs) => [...xs.slice(-3), { id, text, tone, action, out: false }]);
    const t = window.setTimeout(() => close(id), ms);
    return () => { window.clearTimeout(t); close(id); };
  }, [close]);
  const value = useMemo(() => toast, [toast]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toast-host" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}${t.out ? " is-out" : ""}`} role="status">
            <Icon name={ICON[t.tone]} size={18} />
            <span className="toast-text">{t.text}</span>
            {t.action && <button type="button" className="toast-act" onClick={() => { t.action?.onClick(); close(t.id); }}>{t.action.label}</button>}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
export default ToastProvider;
