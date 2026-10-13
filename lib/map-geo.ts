/* PARKLY · lib/map-geo.ts — projection + static geometry for the schematic Delhi map (engine.js §12).
   World units: x = (lng - lng0) * kx * scale, y = (lat0 - lat) * ky * scale; 1 km ≈ scale (40) units. */
import D from "./data";
import type { LatLng, MapPoint } from "./data";

export const MAPG = D.map;
export const PJ = MAPG.projection;
/** map units per km */
export const KM = PJ.scale;

export const project = (p: LatLng) => ({ x: (p.lng - PJ.lng0) * PJ.kx * PJ.scale, y: (PJ.lat0 - p.lat) * PJ.ky * PJ.scale });
export const unproject = (x: number, y: number): LatLng => ({ lng: x / (PJ.kx * PJ.scale) + PJ.lng0, lat: PJ.lat0 - y / (PJ.ky * PJ.scale) });
export const pathOf = (pts: MapPoint[], close = false) =>
  pts.map((p, i) => { const q = project({ lat: p[0], lng: p[1] }); return `${i ? "L" : "M"}${q.x.toFixed(1)},${q.y.toFixed(1)}`; }).join("") + (close ? "Z" : "");

export const MAP_COL = { bg: "#0E1511", road: "#2B3A31", minor: "#1E2A23", water: "#13303A", park: "#17301F", runway: "#1E2A23", centre: "rgba(245,244,239,.10)" };

export interface BaseShape { d: string; fill?: string; stroke?: string; width?: number; dash?: string }
let base: { bg: { x: number; y: number; w: number; h: number }; shapes: BaseShape[] } | null = null;
/** Static base layer (built once): background rect + parks, river, runways, roads. */
export function mapBase() {
  if (base) return base;
  const far = project({ lat: 28.45, lng: 77.33 });
  const shapes: BaseShape[] = [
    ...MAPG.parks.map((p) => ({ d: pathOf(p, true), fill: MAP_COL.park })),
    { d: pathOf(MAPG.river), stroke: MAP_COL.water, width: 26 },
    ...MAPG.runways.map((p) => ({ d: pathOf(p, true), fill: MAP_COL.runway })),
    ...MAPG.minorRoads.map((p) => ({ d: pathOf(p), stroke: MAP_COL.minor, width: 5 })),
    ...MAPG.roads.map((p) => ({ d: pathOf(p), stroke: MAP_COL.road, width: 11 })),
    ...MAPG.roads.map((p) => ({ d: pathOf(p), stroke: MAP_COL.centre, width: 1.2, dash: "10 14" })),
  ];
  base = { bg: { x: -2000, y: -2000, w: far.x + 4000, h: far.y + 4000 }, shapes };
  return base;
}

/** Round scale-bar distance (km) about 80px long at zoom z. */
export function scaleKm(z: number) {
  const target = 80 / (KM * z);
  return [0.25, 0.5, 1, 2, 5, 10, 20].find((k) => k >= target * 0.6) || 20;
}
