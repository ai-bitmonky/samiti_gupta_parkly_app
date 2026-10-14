"use client";
/* useScreenTitle(title) — document.title for a mobile stack screen. Only the top (interactive) layer sets it, so a
   screen animating out or lying under an edge swipe never overrides the visible one. Next re-commits the metadata
   <title> after hydration / navigation, which would undo a one-off assignment (see desktop useTitle), so the title is
   re-applied whenever <head> changes while this screen is on top. */
import { useContext, useEffect } from "react";
import { LayerCtx } from "./route";

export function useScreenTitle(title: string) {
  const layer = useContext(LayerCtx);
  const top = layer ? layer.top : true;
  useEffect(() => {
    if (!top) return;
    const apply = () => { if (document.title !== title) document.title = title; };
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => mo.disconnect();
  }, [title, top]);
}
