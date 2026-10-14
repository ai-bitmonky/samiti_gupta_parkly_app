"use client";
/* 1 · WELCOME (prototype Screens.welcome): forest gradient, "Your spot. / Before you arrive." rising in, a row of 12
   parking bays fading in one by one with our bay L2·14 lit and glowing, three swipeable value slides with dots that
   auto-advance every 4.2 s, and two ways in. No account, no OTP: "Find parking" and "Continue as guest" both just
   finish onboarding locally (guest flag) and land on Explore. */
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useApp } from "@/lib/store";
import Icon from "@/components/shared/Icon";
import Logo from "@/components/shared/Logo";
import { useToast } from "@/components/shared/ToastProvider";
import { RM, Screen, useNav } from "./kit";
import { useScreenTitle } from "./title";

const CAR_COLS = ["#33423B", "#6F827B", "#D9D6CC", "#3D5A80", "#B9483A", "#8E9893"];
const SLIDES: [string, string, string][] = [
  ["calendar-clock", "A space held for your hours", "Pick when you enter and when you leave. The space waits for you."],
  ["receipt", "Price fixed before you pay", "See the full bill, fees and GST included. No surprise at the gate."],
  ["qr-code", "Scan and park", "Show your pass at the barrier. Drive to your bay. That's it."],
];

export default function Welcome() {
  useScreenTitle("Welcome · PARKLY");
  const { actions } = useApp();
  const nav = useNav();
  const toast = useToast();
  const sl = useRef<HTMLDivElement>(null);
  const [dot, setDot] = useState(0);

  useEffect(() => {
    const el = sl.current;
    if (!el) return;
    const onScroll = () => setDot(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
    el.addEventListener("scroll", onScroll, { passive: true });
    const t = window.setInterval(() => {
      if (!el.isConnected) return;
      const i = (Math.round(el.scrollLeft / Math.max(1, el.clientWidth)) + 1) % SLIDES.length;
      el.scrollTo({ left: i * el.clientWidth, behavior: RM() ? "auto" : "smooth" });
    }, 4200);
    return () => { el.removeEventListener("scroll", onScroll); window.clearInterval(t); };
  }, []);

  const start = () => { actions.completeOnboarding(false); nav.reset([], "/explore", "push"); };
  const guest = () => { actions.completeOnboarding(true); nav.reset([], "/explore", "push"); toast("Browsing as a guest", "info"); };

  return (
    <Screen>
      <div className="welcome grain">
        <div className="wl-top"><span><Logo size={30} /></span><button type="button" className="btn btn-ghost btn-sm" onClick={guest}>Skip</button></div>
        <h1 className="wl-h"><span>Your spot.</span><span className="lime">Before you arrive.</span></h1>
        <div className="wl-bays" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className={`wb${i === 6 ? " is-lit" : ""}`} style={{ ["--d" as string]: `${i * 60}ms` } as CSSProperties}>
              {i === 6 ? <span>L2·14</span> : <i style={{ ["--c" as string]: CAR_COLS[i % 6] } as CSSProperties} />}
            </div>
          ))}
        </div>
        <div className="wl-slides" ref={sl}>
          {SLIDES.map(([ic, t, d]) => (
            <div className="wl-slide" key={t}><span className="wl-ico"><Icon name={ic} size={20} /></span><div><b>{t}</b><p>{d}</p></div></div>
          ))}
        </div>
        <div className="wl-dots">{SLIDES.map((s, i) => <i key={s[0]} className={i === dot ? "is-on" : ""} />)}</div>
        <div className="wl-cta">
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={start}>Find parking <Icon name="arrow-right" size={18} /></button>
          <button type="button" className="btn btn-ghost btn-lg btn-block" onClick={guest}>Continue as guest</button>
        </div>
      </div>
    </Screen>
  );
}
