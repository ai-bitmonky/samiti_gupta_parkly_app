/* PARKLY · lib/qr.ts — compact QR encoder ported 1:1 from the prototype (engine.js §13).
   Byte mode, error correction M, versions 1–10 (up to 213 bytes), automatic mask choice.
   qrMatrix(text) → boolean[][] (true = dark). qrPath(text, margin) → {d, size} for an SVG <path>. */

// [ecPerBlock, blocksG1, dataG1, blocksG2, dataG2] for level M, v1..v10
const EC_M: (number[] | null)[] = [null, [10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0], [24, 2, 43, 0, 0],
  [16, 4, 27, 0, 0], [18, 4, 31, 0, 0], [22, 2, 38, 2, 39], [22, 3, 36, 2, 37], [26, 4, 43, 1, 44]];
const ALIGN: (number[] | null)[] = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
const gmul = (x: number, y: number) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z; };
function rsDivisor(deg: number) {
  const r: number[] = new Array(deg).fill(0); r[deg - 1] = 1; let root = 1;
  for (let i = 0; i < deg; i++) { for (let j = 0; j < deg; j++) { r[j] = gmul(r[j], root); if (j + 1 < deg) r[j] ^= r[j + 1]; } root = gmul(root, 2); }
  return r;
}
function rsRemainder(data: number[], div: number[]) {
  const r = div.map(() => 0);
  for (const b of data) { const f = b ^ (r.shift() as number); r.push(0); div.forEach((c, i) => (r[i] ^= gmul(c, f))); }
  return r;
}
const utf8 = (s: string) => Array.from(new TextEncoder().encode(s));
const bit = (x: number, i: number) => ((x >>> i) & 1) !== 0;

export function qrMatrix(text: string): boolean[][] {
  const bytes = utf8(text);
  let ver = 1;
  for (; ver <= 10; ver++) {
    const e = EC_M[ver] as number[], cap = e[1] * e[2] + e[3] * e[4];
    if (4 + (ver < 10 ? 8 : 16) + bytes.length * 8 <= cap * 8) break;
  }
  if (ver > 10) throw new Error("QR: text too long");
  const [ecLen, b1, d1, b2, d2] = EC_M[ver] as number[], dataCap = b1 * d1 + b2 * d2, size = ver * 4 + 17;
  // 1) bit stream
  const bits: number[] = [];
  const put = (val: number, n: number) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(4, 4); put(bytes.length, ver < 10 ? 8 : 16); bytes.forEach((b) => put(b, 8));
  put(0, Math.min(4, dataCap * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  for (let p = 0; data.length < dataCap; p++) data.push(p % 2 ? 0x11 : 0xec);
  // 2) blocks + error correction, interleaved
  const blocks: { d: number[]; e: number[] }[] = [], div = rsDivisor(ecLen);
  let k = 0;
  for (let i = 0; i < b1 + b2; i++) { const n = i < b1 ? d1 : d2; const d = data.slice(k, k + n); k += n; blocks.push({ d, e: rsRemainder(d, div) }); }
  const cw: number[] = [];
  for (let i = 0; i < Math.max(d1, d2); i++) blocks.forEach((b) => { if (i < b.d.length) cw.push(b.d[i]); });
  for (let i = 0; i < ecLen; i++) blocks.forEach((b) => cw.push(b.e[i]));
  // 3) function patterns
  const M: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const F: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const setF = (x: number, y: number, dark: boolean) => { M[y][x] = dark; F[y][x] = true; };
  for (let i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
      if (x >= 0 && y >= 0 && x < size && y < size) setF(x, y, d !== 2 && d !== 4);
    }
  };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  const al = ALIGN[ver] as number[], last = al.length - 1;
  al.forEach((ay, i) => al.forEach((ax, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setF(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));
  const drawFormat = (mask: number) => {
    const d = (0 << 3) | mask; // level M = 0b00
    let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((d << 10) | r) ^ 0x5412;
    for (let i = 0; i <= 5; i++) setF(8, i, bit(b, i));
    setF(8, 7, bit(b, 6)); setF(8, 8, bit(b, 7)); setF(7, 8, bit(b, 8));
    for (let i = 9; i < 15; i++) setF(14 - i, 8, bit(b, i));
    for (let i = 0; i < 8; i++) setF(size - 1 - i, 8, bit(b, i));
    for (let i = 8; i < 15; i++) setF(8, size - 15 + i, bit(b, i));
    setF(8, size - 8, true);
  };
  drawFormat(0);
  if (ver >= 7) {
    let r = ver; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const b = (ver << 12) | r;
    for (let i = 0; i < 18; i++) { const a = size - 11 + (i % 3), c = Math.floor(i / 3); setF(a, c, bit(b, i)); setF(c, a, bit(b, i)); }
  }
  // 4) data in zig-zag
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
      if (!F[y][x] && i < cw.length * 8) { M[y][x] = bit(cw[i >>> 3], 7 - (i & 7)); i++; }
    }
  }
  // 5) choose the mask with the lowest penalty
  const MASKS: ((x: number, y: number) => boolean)[] = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0];
  const applyMask = (m: number) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!F[y][x] && MASKS[m](x, y)) M[y][x] = !M[y][x]; };
  const penalty = () => {
    let p = 0, dark = 0;
    const line = (get: (a: number, b: number) => boolean) => {
      for (let a = 0; a < size; a++) { let run = 1; for (let b = 1; b <= size; b++) { if (b < size && get(a, b) === get(a, b - 1)) run++; else { if (run >= 5) p += run - 2; run = 1; } } }
    };
    line((a, b) => M[a][b]); line((a, b) => M[b][a]);
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const c = M[y][x]; if (c === M[y][x + 1] && c === M[y + 1][x] && c === M[y + 1][x + 1]) p += 3; }
    const pat = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], rev = [...pat].reverse();
    const match = (get: (x: number, y: number) => boolean, a: number, b: number, pt: number[]) => pt.every((v, kk) => get(a, b + kk) === !!v);
    for (let a = 0; a < size; a++) for (let b = 0; b + 11 <= size; b++) {
      const r = (x: number, y: number) => M[x][y], c = (x: number, y: number) => M[y][x];
      if (match(r, a, b, pat) || match(r, a, b, rev)) p += 40;
      if (match(c, a, b, pat) || match(c, a, b, rev)) p += 40;
    }
    M.forEach((row) => row.forEach((v) => (dark += v ? 1 : 0)));
    p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
    return p;
  };
  let best = 0, bestP = Infinity;
  for (let m = 0; m < 8; m++) { applyMask(m); drawFormat(m); const pv = penalty(); if (pv < bestP) { bestP = pv; best = m; } applyMask(m); }
  applyMask(best); drawFormat(best);
  return M;
}

/** SVG path data for the dark modules, plus the full side length in modules (incl. margin). */
export function qrPath(text: string, margin = 2): { d: string; size: number } {
  const M = qrMatrix(text), n = M.length;
  let d = "";
  M.forEach((row, y) => row.forEach((v, x) => { if (v) d += `M${x + margin},${y + margin}h1v1h-1z`; }));
  return { d, size: n + margin * 2 };
}

/** Text encoded in every PARKLY pass QR. */
export const passPayload = (ref: string, plate: string) => `PARKLY|${ref}|${plate}`;
