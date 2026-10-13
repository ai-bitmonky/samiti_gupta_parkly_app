"use client";
/* Schematic Delhi map — full port of the prototype's SvgMap.render (engine.js §12).
   Give it a size (height) via className/style. Props mirror SvgMap.render options:
     items       [{f, free, rate}] e.g. searchFacilities(state).results (or measure(...) for one facility)
     dest        {lat, lng, name} — the destination marker (default: searchCenter(state.search) is up to the caller)
     radiusKm    dashed lime radius ring (0 = none); also sets the fit zoom
     selectedId  lime selected pin with 2s pulse ring (pans to it if it's near the edge)
     hotId       highlighted pin (list-card hover ↔ pin), = controller.highlight(id)
     routeTo     {lat,lng}: dashed walking route to dest + "N min walk" tag
     compact     static thumbnail: no pan/zoom/labels/controls, ≤4 non-overlapping pins, tap → onOpen
     onSelect(id), onSearchArea({lat,lng}), onOpen(), onPinHover(id|null)
   Interaction: drag to pan, pinch / wheel to zoom, +/− buttons, crosshair = back to destination,
   keyboard (focus the map): arrows pan, + / − zoom. "Search this area" appears after panning away.
   Imperative handle (ref): { select(id), highlight(id), recenter(), getCenter() }. */
import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, Ref } from "react";
import type { Facility, LatLng } from "@/lib/data";
import { availTone, distKm, walkMin } from "@/lib/engine";
import { KM, MAPG, MAP_COL, mapBase, project, scaleKm, unproject } from "@/lib/map-geo";
import Icon from "./Icon";

export interface MapItem { f: Facility; free: number; rate: number }
export interface MapDest extends LatLng { name?: string }
export interface SvgMapHandle { select(id: string): void; highlight(id: string | null): void; recenter(): void; getCenter(): LatLng }
export interface SvgMapProps {
  items?: MapItem[];
  dest: MapDest;
  radiusKm?: number;
  selectedId?: string | null;
  hotId?: string | null;
  routeTo?: LatLng | null;
  compact?: boolean;
  showControls?: boolean;
  onSelect?: (id: string) => void;
  onSearchArea?: (c: LatLng) => void;
  onOpen?: () => void;
  onPinHover?: (id: string | null) => void;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  ref?: Ref<SvgMapHandle>;
}
type View = { x: number; y: number; z: number };

export default function SvgMap({
  items = [], dest, radiusKm = 0, selectedId = null, hotId = null, routeTo = null, compact = false, showControls,
  onSelect, onSearchArea, onOpen, onPinHover, className = "", style, ariaLabel, ref,
}: SvgMapProps) {
  const el = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ W: 0, H: 0 });
  const [v, setV] = useState<View>({ x: 0, y: 0, z: 1 });
  const vRef = useRef(v);
  const boxRef = useRef(box);
  const [moved, setMoved] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [sel, setSel] = useState<string | null>(selectedId);
  const [hot, setHot] = useState<string | null>(hotId);
  const [pop, setPop] = useState<{ id: string; n: number } | null>(null);
  const controls = showControls ?? !compact;
  const base = mapBase();

  const commitView = useCallback((nv: View) => { vRef.current = nv; setV(nv); }, []);
  const fitZoom = useCallback((W = boxRef.current.W, H = boxRef.current.H) =>
    Math.max(0.25, Math.min(3, Math.min(W, H) / (2 * Math.max(0.8, radiusKm || 4) * KM * 1.12))), [radiusKm]);
  const centerOn = useCallback((p: LatLng, z = vRef.current.z) => {
    const q = project(p), { W, H } = boxRef.current;
    commitView({ z, x: W / 2 - q.x * z, y: H / 2 - q.y * z });
  }, [commitView]);
  const toScreen = (p: LatLng, view = v) => { const q = project(p); return { x: q.x * view.z + view.x, y: q.y * view.z + view.y }; };
  const getCenter = useCallback((): LatLng => { const { W, H } = boxRef.current, c = vRef.current; return unproject((W / 2 - c.x) / c.z, (H / 2 - c.y) / c.z); }, []);
  const zoomBy = useCallback((k: number, cx?: number, cy?: number) => {
    const c = vRef.current, { W, H } = boxRef.current;
    const px = cx ?? W / 2, py = cy ?? H / 2;
    const z = Math.max(0.25, Math.min(4, c.z * k)), f = z / c.z;
    commitView({ z, x: px - (px - c.x) * f, y: py - (py - c.y) * f });
    setMoved(true);
  }, [commitView]);
  const recenter = useCallback(() => { centerOn(dest, fitZoom()); setMoved(false); }, [centerOn, dest, fitZoom]);

  // measure + first fit
  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    let first = true;
    const measure = () => {
      const W = node.clientWidth, H = node.clientHeight;
      if (W === boxRef.current.W && H === boxRef.current.H) return;
      boxRef.current = { W, H };
      setBox({ W, H });
      if (W && first) { first = false; centerOn(dest, fitZoom(W, H)); }
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(node);
    return () => ro?.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // re-centre when the destination or radius changes
  const destKey = `${dest.lat},${dest.lng},${radiusKm}`;
  const lastDest = useRef(destKey);
  useEffect(() => {
    if (lastDest.current === destKey) return;
    lastDest.current = destKey;
    if (boxRef.current.W) { centerOn(dest, fitZoom()); setMoved(false); }
  }, [destKey, centerOn, dest, fitZoom]);

  // selection: mark pin, pan to it if near the edge, pop animation
  const select = useCallback((id: string | null) => {
    setSel(id);
    if (!id) return;
    const it = items.find((x) => x.f.id === id);
    if (it) {
      const q = project(it.f), c = vRef.current, { W, H } = boxRef.current, s = { x: q.x * c.z + c.x, y: q.y * c.z + c.y }, m = 48;
      if (W && (s.x < m || s.y < m || s.x > W - m || s.y > H - m * 2.5)) { centerOn(it.f); setMoved(true); }
      setPop((p) => ({ id, n: (p?.n || 0) + 1 }));
    }
  }, [items, centerOn]);
  const lastSel = useRef(selectedId);
  useEffect(() => { if (lastSel.current !== selectedId) { lastSel.current = selectedId; select(selectedId); } }, [selectedId, select]);
  useEffect(() => { setHot(hotId); }, [hotId]);

  useImperativeHandle(ref, () => ({ select: (id) => select(id), highlight: (id) => setHot(id), recenter, getCenter }), [select, recenter, getCenter]);

  // pan / pinch / wheel / keys
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<null | { x?: number; y?: number; vx: number; vy: number; z?: number; dist?: number; cx?: number; cy?: number; moved: boolean }>(null);
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (compact || (e.target as HTMLElement).closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const c = vRef.current;
    if (ptrs.current.size === 1) drag.current = { x: e.clientX, y: e.clientY, vx: c.x, vy: c.y, moved: false };
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()], r = e.currentTarget.getBoundingClientRect();
      drag.current = { vx: c.x, vy: c.y, z: c.z, dist: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2 - r.left, cy: (a.y + b.y) / 2 - r.top, moved: true };
    }
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (compact || !ptrs.current.has(e.pointerId) || !d) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 2 && d.dist) {
      const [a, b] = [...ptrs.current.values()];
      const z = Math.max(0.25, Math.min(4, (d.z as number) * (Math.hypot(a.x - b.x, a.y - b.y) / d.dist))), f = z / (d.z as number);
      commitView({ z, x: (d.cx as number) - ((d.cx as number) - d.vx) * f, y: (d.cy as number) - ((d.cy as number) - d.vy) * f });
      setMoved(true);
      return;
    }
    const dx = e.clientX - (d.x as number), dy = e.clientY - (d.y as number);
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    if (d.moved) { commitView({ ...vRef.current, x: d.vx + dx, y: d.vy + dy }); setMoved(true); }
  };
  const onPointerUp = (e: React.PointerEvent) => { ptrs.current.delete(e.pointerId); if (!ptrs.current.size) { drag.current = null; setDragging(false); } };
  useEffect(() => { // wheel must be non-passive to stop page scroll
    const node = el.current;
    if (!node || compact) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); const r = node.getBoundingClientRect(); zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top); };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [compact, zoomBy]);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (compact || e.target !== el.current) return;
    const step = 60, c = vRef.current;
    const act: Record<string, () => void> = {
      ArrowLeft: () => commitView({ ...c, x: c.x + step }), ArrowRight: () => commitView({ ...c, x: c.x - step }),
      ArrowUp: () => commitView({ ...c, y: c.y + step }), ArrowDown: () => commitView({ ...c, y: c.y - step }),
      "+": () => zoomBy(1.25), "=": () => zoomBy(1.25), "-": () => zoomBy(0.8),
    };
    if (act[e.key]) { e.preventDefault(); act[e.key](); setMoved(true); }
    else if ((e.key === "Enter" || e.key === " ") && compact) onOpen?.();
  };

  // ── layout for the current view ──
  const { W, H } = box;
  const ds = toScreen(dest);
  const d = project(dest);
  const pinPos = useMemo(() => {
    const placed = compact ? [{ x: ds.x, y: ds.y + 10 }] : null; // compact: keep pins apart and off the destination dot
    return items.map((it) => {
      const s = toScreen(it.f);
      let off = s.x < -60 || s.y < -40 || s.x > W + 60 || s.y > H + 40;
      if (placed && !off && it.f.id !== sel)
        off = placed.length > 4 || s.x < 30 || s.x > W - 30 || s.y < 30 || s.y > H - 4 || placed.some((q) => Math.abs(q.x - s.x) < 62 && Math.abs(q.y - s.y) < 32);
      if (placed && !off) placed.push(s);
      return { it, s, off };
    });
  }, [items, v, W, H, compact, sel]); // eslint-disable-line react-hooks/exhaustive-deps
  const skm = scaleKm(v.z);
  const showSearch = !compact && moved && !!onSearchArea && W > 0 && distKm(getCenter(), dest) > Math.max(0.6, (radiusKm || 3) * 0.3);
  const walkTag = routeTo ? { s: toScreen(routeTo), min: walkMin(distKm(routeTo, dest)) } : null;
  const rt = routeTo ? project(routeTo) : null;

  return (
    <div
      ref={el}
      className={`map${compact ? " map-compact" : ""}${dragging ? " is-dragging" : ""} ${className}`.trim()}
      style={style}
      tabIndex={compact ? -1 : 0}
      role={compact ? "button" : "application"}
      aria-label={ariaLabel || (compact ? "Open the map" : "Map of parking near your destination. Use arrow keys to pan and plus or minus to zoom.")}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      onClick={compact ? () => onOpen?.() : undefined}
    >
      <svg className="map-svg" width={W || undefined} height={H || undefined} aria-hidden="true">
        <g className="map-world" transform={`translate(${v.x} ${v.y}) scale(${v.z})`}>
          <rect x={base.bg.x} y={base.bg.y} width={base.bg.w} height={base.bg.h} fill={MAP_COL.bg} />
          {base.shapes.map((s, i) => (
            <path key={i} d={s.d} fill={s.fill || "none"} stroke={s.stroke} strokeWidth={s.width} strokeDasharray={s.dash}
              strokeLinecap={s.stroke ? "round" : undefined} strokeLinejoin={s.stroke && !s.dash ? "round" : undefined} />
          ))}
          <g className="map-dyn">
            {radiusKm > 0 && <circle className="map-radius" cx={d.x} cy={d.y} r={radiusKm * KM} style={{ strokeWidth: 1.4 / v.z + "px", strokeDasharray: `${6 / v.z} ${5 / v.z}` }} />}
            {rt && <path className="map-route" d={`M${rt.x},${rt.y} L${rt.x},${d.y} L${d.x},${d.y}`} style={{ strokeWidth: 3.2 / v.z + "px", strokeDasharray: `${2 / v.z} ${6 / v.z}` }} />}
          </g>
        </g>
        <g className="map-labels">
          {!compact && MAPG.labels.filter((l) => l.big || v.z >= 0.7).map((l) => {
            const p = toScreen({ lat: l.at[0], lng: l.at[1] });
            return <text key={l.text} x={p.x.toFixed(1)} y={p.y.toFixed(1)} className={`map-label${l.big ? " is-big" : ""}`}>{l.text}</text>;
          })}
        </g>
      </svg>
      <div className="map-layer">
        <div className="map-dest" style={{ left: ds.x, top: ds.y }}>
          <div className="map-dest-name">{dest.name || "Destination"}</div>
          <div className="map-dest-dot" /><span className="map-dest-ring" />
        </div>
        {pinPos.map(({ it, s, off }, i) => {
          const tone = availTone(it.free, it.f.capacity), isSel = it.f.id === sel;
          return (
            <button
              key={it.f.id}
              className={`pin pin-${tone}${isSel ? " is-sel" : ""}${hot === it.f.id ? " is-hot" : ""}${pop && pop.id === it.f.id ? " is-pop" : ""}`}
              style={{ ["--i" as string]: i, left: s.x, top: s.y, visibility: off ? "hidden" : undefined } as CSSProperties}
              tabIndex={compact ? -1 : undefined}
              aria-pressed={isSel}
              aria-label={`${it.f.name}, ₹${it.rate} per hour, ${it.free > 0 ? it.free + " spaces free" : "full"}`}
              onClick={(e) => { e.stopPropagation(); if (compact) { onOpen?.(); return; } select(it.f.id); onSelect?.(it.f.id); }}
              onPointerEnter={() => onPinHover?.(it.f.id)}
              onPointerLeave={() => onPinHover?.(null)}
            >
              <span className="pin-pill" key={pop && pop.id === it.f.id ? pop.n : 0}>
                {tone === "ok" && <i className="pin-dot" />}₹{it.rate}{it.f.ev && <span className="pin-ev">EV</span>}
              </span>
              <span className="pin-tail" />
            </button>
          );
        })}
        {walkTag && (
          <div className="map-walk" style={{ left: walkTag.s.x + 8, top: ds.y + 6 }}><Icon name="footprints" size={12} />{walkTag.min} min walk</div>
        )}
      </div>
      {compact ? (
        <div className="map-open"><Icon name="map" size={13} /> Open map</div>
      ) : (
        <>
          {controls && (
            <div className="map-ctrls">
              <button type="button" className="map-ctrl" aria-label="Zoom in" onClick={(e) => { e.stopPropagation(); zoomBy(1.3); }}><Icon name="plus" size={16} /></button>
              <button type="button" className="map-ctrl" aria-label="Zoom out" onClick={(e) => { e.stopPropagation(); zoomBy(1 / 1.3); }}><Icon name="minus" size={16} /></button>
              <button type="button" className="map-ctrl" aria-label="Back to destination" title="Back to destination" onClick={(e) => { e.stopPropagation(); recenter(); }}><Icon name="crosshair" size={16} /></button>
            </div>
          )}
          {showSearch && (
            <button type="button" className="map-search-area" onClick={(e) => { e.stopPropagation(); const c = getCenter(); setMoved(false); onSearchArea?.(c); }}>
              <Icon name="search" size={14} /> Search this area
            </button>
          )}
        </>
      )}
      <div className="map-scale">
        <div className="map-scale-bar" style={{ width: skm * KM * v.z }} />
        <div className="map-scale-txt">{skm < 1 ? `${skm * 1000} m` : `${skm} km`}</div>
      </div>
    </div>
  );
}
