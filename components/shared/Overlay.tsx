"use client";
/* One overlay for both versions (prototype openSheet):
   mobile → bottom sheet (grabber, drag down to dismiss, slides up); desktop → centred modal (pop).
     <Sheet open={open} onClose={() => setOpen(false)} title="Filters" footer={<button className="btn btn-primary btn-md">Show 12</button>}>
       …body…
     </Sheet>
     <Modal …/>  = always a centred modal.  kind="sheet" forces a sheet.  size: "sm" | "md" | "lg".
   Closes on Esc (top-most only), backdrop tap (unless dismissable={false}), any [data-close] element, route change.
   Locks page scroll while open, focuses the panel, restores focus on close, plays the exit animation (220ms).
   Rendered through a portal into <body>. */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useDevice } from "@/lib/device";
import { reducedMotion } from "@/lib/engine";
import Icon from "./Icon";

const stack: string[] = []; // open overlay ids, top-most last
let locks = 0;
function lockScroll(on: boolean) {
  locks = Math.max(0, locks + (on ? 1 : -1));
  document.documentElement.classList.toggle("is-locked", locks > 0);
}

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  kind?: "auto" | "sheet" | "modal";
  size?: "sm" | "md" | "lg";
  dismissable?: boolean;
  className?: string;
  bodyClassName?: string;
  ariaLabel?: string;
}

export function Sheet(props: SheetProps) {
  const { open } = props;
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (open) { setMounted(true); setClosing(false); return; }
    if (!mounted) return;
    setClosing(true);
    const t = window.setTimeout(() => { setMounted(false); setClosing(false); }, reducedMotion() ? 0 : 220);
    return () => window.clearTimeout(t);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(<OverlayPanel {...props} closing={closing} />, document.body);
}

export function Modal(props: Omit<SheetProps, "kind">) {
  return <Sheet {...props} kind="modal" />;
}

function OverlayPanel({ onClose, title, footer, children, kind = "auto", size, dismissable = true, className = "", bodyClassName = "", ariaLabel, closing }: SheetProps & { closing: boolean }) {
  const device = useDevice();
  const k = kind === "auto" ? (device === "desktop" ? "modal" : "sheet") : kind;
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const pathname = usePathname();
  const firstPath = useRef(pathname);

  // stack, scroll lock, focus in/out
  useEffect(() => {
    stack.push(id);
    lockScroll(true);
    const prev = document.activeElement as HTMLElement | null;
    const raf = requestAnimationFrame(() => panel.current?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(raf);
      const i = stack.indexOf(id); if (i >= 0) stack.splice(i, 1);
      lockScroll(false);
      try { prev?.focus?.({ preventScroll: true }); } catch { /* element gone */ }
    };
  }, [id]);
  // Esc closes the top-most overlay only
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && stack[stack.length - 1] === id && !closing) { e.stopPropagation(); closeRef.current(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [id, closing]);
  // route change closes it (like the prototype Router)
  useEffect(() => { if (pathname !== firstPath.current) closeRef.current(); }, [pathname]);

  // [data-close] anywhere inside closes it
  const onPanelClick = (e: React.MouseEvent) => { if ((e.target as HTMLElement).closest("[data-close]")) onClose(); };

  // drag-to-dismiss (sheet): from the grabber or the header
  const drag = useRef<{ y: number; t: number; dy: number } | null>(null);
  const [dy, setDy] = useState(0);
  const [settling, setSettling] = useState(false);
  const [isDrag, setIsDrag] = useState(false);
  const onDragStart = useCallback((e: React.PointerEvent) => {
    if (k !== "sheet" || (e.target as HTMLElement).closest("button")) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, t: performance.now(), dy: 0 };
    setSettling(false);
    setIsDrag(true);
  }, [k]);
  const onDragMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const d = Math.max(0, e.clientY - drag.current.y);
    drag.current.dy = d;
    setDy(d);
  };
  const onDragEnd = () => {
    const d = drag.current;
    drag.current = null;
    setIsDrag(false);
    if (!d) return;
    const h = panel.current?.offsetHeight || 400, v = d.dy / Math.max(1, performance.now() - d.t);
    if (dismissable && (d.dy > Math.min(140, h * 0.3) || (v > 0.6 && d.dy > 30))) { setSettling(true); setDy(h + 40); window.setTimeout(() => closeRef.current(), 200); }
    else { setSettling(true); setDy(0); }
  };
  const dragProps = k === "sheet" ? { onPointerDown: onDragStart, onPointerMove: onDragMove, onPointerUp: onDragEnd, onPointerCancel: onDragEnd } : {};

  const panelCls = [k, size ? `${k}-${size}` : "", isDrag ? "is-dragging" : "", settling ? "is-settling" : "", className].filter(Boolean).join(" ");
  return (
    <div className={`overlay overlay-${k}${closing ? " is-closing" : ""}`} role="presentation">
      <div className="overlay-backdrop" onClick={dismissable ? onClose : undefined} style={dy && k === "sheet" ? { opacity: Math.max(0.2, 1 - dy / 500) } : undefined} />
      <div
        ref={panel}
        className={panelCls}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || (typeof title === "string" ? title : undefined)}
        tabIndex={-1}
        onClick={onPanelClick}
        style={dy ? { transform: `translateY(${dy}px)` } : undefined}
        onTransitionEnd={() => setSettling(false)}
      >
        {k === "sheet" && <div className="sheet-grip-hit" {...dragProps}><div className="sheet-grip" aria-hidden="true" /></div>}
        {title !== undefined && (
          <div className={`${k}-head`} {...dragProps}>
            <h2 className={`${k}-title`}>{title}</h2>
            <button type="button" className="btn btn-ghost btn-icon btn-sm" data-close aria-label="Close"><Icon name="x" size={18} /></button>
          </div>
        )}
        <div className={`${k}-body ${bodyClassName}`.trim()}>{children}</div>
        {footer && <div className={`${k}-foot`}>{footer}</div>}
      </div>
    </div>
  );
}

export default Sheet;
