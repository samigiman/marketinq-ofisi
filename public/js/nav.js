// Naviqasiya: 0.5 m-lik grid üzərində A*, sonra görmə xətti ilə yol hamarlanır.
import { THREE } from './kit.js';
import { clamp } from './util.js';

// Otaq: x -20..20, z -14..14
export const GX0 = -20, GZ0 = -14, CS = 0.5, GW = 80, GH = 56;
const blocked = new Uint8Array(GW * GH);
const cost = new Float32Array(GW * GH).fill(1);
const cellOf = (x, z) => [Math.floor((x - GX0) / CS), Math.floor((z - GZ0) / CS)];
const free = (c, r) => c >= 0 && r >= 0 && c < GW && r < GH && !blocked[r * GW + c];
export function block(x0, z0, x1, z1, pad = 0.2) {
  const [c0, r0] = cellOf(Math.min(x0, x1) - pad, Math.min(z0, z1) - pad);
  const [c1, r1] = cellOf(Math.max(x0, x1) + pad, Math.max(z0, z1) + pad);
  for (let r = Math.max(0, r0); r <= Math.min(GH - 1, r1); r++)
    for (let c = Math.max(0, c0); c <= Math.min(GW - 1, c1); c++) blocked[r * GW + c] = 1;
}
// Yığışdırılan mebel üçün: sahəni yenidən keçilən et
export function unblock(x0, z0, x1, z1, pad = 0.2) {
  const [c0, r0] = cellOf(Math.min(x0, x1) - pad, Math.min(z0, z1) - pad);
  const [c1, r1] = cellOf(Math.max(x0, x1) + pad, Math.max(z0, z1) + pad);
  for (let r = Math.max(0, r0); r <= Math.min(GH - 1, r1); r++)
    for (let c = Math.max(0, c0); c <= Math.min(GW - 1, c1); c++) blocked[r * GW + c] = 0;
}
export function addCost(x, z, rad, v) {
  for (let r = 0; r < GH; r++) for (let c = 0; c < GW; c++) {
    const cx = GX0 + (c + 0.5) * CS, cz = GZ0 + (r + 0.5) * CS;
    if (Math.hypot(cx - x, cz - z) < rad) cost[r * GW + c] = Math.max(cost[r * GW + c], v);
  }
}
function nearestFree(c, r) {
  c = clamp(c, 0, GW - 1); r = clamp(r, 0, GH - 1);
  if (free(c, r)) return [c, r];
  for (let rad = 1; rad < 16; rad++) {
    let best = null, bd = 1e9;
    for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
      if (free(c + dx, r + dy)) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = [c + dx, r + dy]; } }
    }
    if (best) return best;
  }
  return [c, r];
}
class Heap {
  constructor() { this.a = []; this.f = []; }
  get size() { return this.a.length; }
  push(i, f) {
    const a = this.a, F = this.f; a.push(i); F.push(f); let n = a.length - 1;
    while (n > 0) { const p = (n - 1) >> 1; if (F[p] <= F[n]) break; [a[p], a[n]] = [a[n], a[p]]; [F[p], F[n]] = [F[n], F[p]]; n = p; }
  }
  pop() {
    const a = this.a, F = this.f, top = a[0], la = a.pop(), lf = F.pop();
    if (a.length) {
      a[0] = la; F[0] = lf; let n = 0;
      for (;;) {
        const l = 2 * n + 1, r = l + 1; let m = n;
        if (l < a.length && F[l] < F[m]) m = l;
        if (r < a.length && F[r] < F[m]) m = r;
        if (m === n) break;
        [a[m], a[n]] = [a[n], a[m]]; [F[m], F[n]] = [F[n], F[m]]; n = m;
      }
    }
    return top;
  }
}
const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
const gS = new Float32Array(GW * GH), came = new Int32Array(GW * GH), closed = new Uint8Array(GW * GH);
export function findPath(sx, sz, tx, tz) {
  let [sc, sr] = nearestFree(...cellOf(sx, sz));
  let [tc, tr] = nearestFree(...cellOf(tx, tz));
  const s = sr * GW + sc, t = tr * GW + tc;
  gS.fill(Infinity); came.fill(-1); closed.fill(0);
  const h = (c, r) => { const dx = Math.abs(c - tc), dy = Math.abs(r - tr); return dx + dy - 0.586 * Math.min(dx, dy); };
  const heap = new Heap(); gS[s] = 0; heap.push(s, h(sc, sr));
  let found = false;
  while (heap.size) {
    const cur = heap.pop(); if (closed[cur]) continue; closed[cur] = 1;
    if (cur === t) { found = true; break; }
    const cc = cur % GW, cr = (cur / GW) | 0;
    for (const [dx, dy, w] of DIRS) {
      const nc = cc + dx, nr = cr + dy;
      if (!free(nc, nr)) continue;
      if (dx && dy && (!free(cc + dx, cr) || !free(cc, cr + dy))) continue;
      const n = nr * GW + nc; if (closed[n]) continue;
      const ng = gS[cur] + w * cost[n];
      if (ng < gS[n]) { gS[n] = ng; came[n] = cur; heap.push(n, ng + h(nc, nr)); }
    }
  }
  const pts = [];
  if (found) {
    const cells = []; let c = t; while (c !== -1) { cells.push(c); c = came[c]; }
    cells.reverse();
    for (const ci of cells) pts.push({ x: GX0 + ((ci % GW) + 0.5) * CS, z: GZ0 + (((ci / GW) | 0) + 0.5) * CS });
  }
  const start = { x: sx, z: sz }, goal = { x: tx, z: tz };
  const all = [...pts, goal];
  const los = (a, b) => {
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), n = Math.ceil(d / 0.2);
    for (let i = 1; i < n; i++) {
      const x = a.x + dx * i / n, z = a.z + dz * i / n;
      const near = Math.hypot(x - start.x, z - start.z) < 0.75 || Math.hypot(x - goal.x, z - goal.z) < 0.75;
      if (near) continue;
      const [c, r] = cellOf(x, z);
      if (c < 0 || r < 0 || c >= GW || r >= GH) return false;
      const idx = r * GW + c;
      if (blocked[idx] || cost[idx] > 1.5) return false;
    }
    return true;
  };
  const out = []; let anchor = start, k = 0;
  while (k < all.length) {
    let j = all.length - 1;
    while (j > k && !los(anchor, all[j])) j--;
    out.push(all[j]); anchor = all[j]; k = j + 1;
  }
  return out.map(p => new THREE.Vector2(p.x, p.z));
}
