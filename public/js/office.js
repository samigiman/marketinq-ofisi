// Ofis: köhnə binanın 3-cü mərtəbəsi. Palıd döşəmə, ağardılmış kərpic, qara metal çərçivəli iri pəncərələr.
// Koordinatlar naviqasiya ilə bağlıdır: masa, oturacaq və fasilə yerləri buradan gəlir.
import { THREE, office, M, box, cyl, sph, canvasTex, basicPlane, FONT } from './kit.js';
import { block, addCost } from './nav.js';
import { PI, pick, seeded, hash } from './util.js';
import { DEPTS, TEAM, WORLD } from '../team.js';

/* ---------------- palitra ---------------- */
export const C = {
  oak: '#b58c62', oakDark: '#8c6a4a', walnut: '#5b4232', steel: '#26282a', steelSoft: '#3a3c3d',
  brick: '#ebe5da', plaster: '#f1ede6', felt: '#46514c', feltDark: '#363e3a', terracotta: '#b4643f',
  leaf: '#4f6b48', leaf2: '#647f56', fabric: '#3f423e', sage: '#9aa58f', linen: '#d9d1c2', ink: '#2d2f2c',
};
const leafM = M(C.leaf, { r: 0.9 }), leaf2M = M(C.leaf2, { r: 0.9 });

/* ---------------- teksturlar ---------------- */
const floorTex = canvasTex(1024, 1024, (g, w, h) => {
  g.fillStyle = '#9c7752'; g.fillRect(0, 0, w, h);
  const R = seeded(11), ph = 56;
  for (let y = 0; y < h; y += ph) {
    let x = -R() * 300;
    while (x < w) {
      const pw = 260 + R() * 260, l = R();
      g.fillStyle = `hsl(${28 + l * 6},${34 + l * 8}%,${52 + l * 10}%)`; g.fillRect(x + 1.5, y + 1.5, pw - 3, ph - 3);
      g.strokeStyle = 'rgba(70,45,25,.08)'; g.lineWidth = 1.2;
      for (let k = 0; k < 6; k++) { const yy = y + 6 + R() * (ph - 12); g.beginPath(); g.moveTo(x, yy); g.bezierCurveTo(x + pw * .3, yy + (R() - .5) * 6, x + pw * .7, yy + (R() - .5) * 6, x + pw, yy); g.stroke(); }
      x += pw;
    }
  }
});
floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(4, 3);

const brickTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#d8d0c3'; g.fillRect(0, 0, w, h);
  const R = seeded(5), bh = 32, bw = 96;
  for (let r = 0; r * bh < h; r++) {
    const off = r % 2 ? bw / 2 : 0;
    for (let x = -off; x < w; x += bw) {
      const l = 88 + R() * 6;
      g.fillStyle = `hsl(36,${14 + R() * 8}%,${l}%)`; g.fillRect(x + 2, r * bh + 2, bw - 4, bh - 4);
    }
  }
});
brickTex.wrapS = brickTex.wrapT = THREE.RepeatWrapping;

const tileTex = canvasTex(256, 256, (g, w, h) => {
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#e9e3d6' : '#cdc3b2'; g.fillRect(x * 32, y * 32, 32, 32); }
});
tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping; tileTex.repeat.set(3, 3);

/* ---------------- monitorlar ---------------- */
// Hər personajın əsas monitoru öz kanvasıdır: monitors.js oraya terminal jurnalını çəkir.
export const SCREENS = {};       // agentId → { tex, ctx, type }
export const screenMeshes = [];  // klik üçün
function appScreen(type, R) {
  return (g, w, h) => {
    const dark = type === 'dash' || type === 'video' || type === 'daw';
    g.fillStyle = dark ? '#1f2320' : '#f3f1ec'; g.fillRect(0, 0, w, h);
    g.fillStyle = dark ? '#2c312d' : '#e3dfd6'; g.fillRect(0, 0, w, 18);
    if (type === 'design') {
      g.fillStyle = '#e3dfd6'; g.fillRect(0, 18, 34, h); g.fillStyle = '#fff'; g.fillRect(52, 32, w - 104, h - 52);
      g.fillStyle = C.terracotta; g.fillRect(72, 52, 110, 70); g.fillStyle = C.ink; g.fillRect(72, 136, 160, 10); g.fillStyle = '#a8a294'; g.fillRect(72, 154, 120, 7);
    } else if (type === 'text' || type === 'social') {
      g.fillStyle = '#fff'; g.fillRect(48, 28, w - 96, h - 36); g.fillStyle = C.ink; g.fillRect(70, 44, 150, 10);
      for (let i = 0; i < 10; i++) { g.fillStyle = '#c9c3b6'; g.fillRect(70, 66 + i * 14, 120 + R() * 140, 5); }
    } else if (type === 'dash') {
      for (let i = 0; i < 3; i++) { g.fillStyle = '#2c312d'; g.fillRect(14 + i * 120, 30, 108, 46); g.fillStyle = ['#8fc7a6', '#d9c08f', '#c7d1d8'][i]; g.fillRect(24 + i * 120, 56, 50, 8); }
      g.fillStyle = '#2c312d'; g.fillRect(14, 86, w - 28, h - 100);
      for (let i = 0; i < 18; i++) { const bh = 20 + R() * 80; g.fillStyle = '#5f7f6c'; g.fillRect(28 + i * 18, h - 20 - bh, 10, bh); }
    } else {
      for (let t = 0; t < 6; t++) { g.strokeStyle = ['#8fc7a6', '#d9c08f', '#c7d1d8'][t % 3]; g.lineWidth = 1.4; g.beginPath(); for (let x = 50; x < w - 10; x += 3) g.lineTo(x, 34 + t * 34 + Math.sin(x * (0.15 + t * 0.04)) * (5 + R() * 6)); g.stroke(); }
    }
  };
}
function monitor(p, x, y, z, rotY, w, screen) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; p.add(g);
  box(g, 0.05, 0.3, 0.05, C.steel, 0, 0.15, 0.05, 0.01);
  box(g, 0.28, 0.015, 0.2, C.steel, 0, 0.008, 0.05, 0.005);
  box(g, w, 0.56, 0.03, '#161716', 0, 0.56, 0, 0.01);
  const s = basicPlane(w - 0.04, 0.52, screen.tex); s.position.set(0, 0.56, -0.017); s.rotation.y = PI; g.add(s);
  return s;
}
function chair(x, z, rot, color = C.fabric) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; office.add(g);
  box(g, 0.54, 0.08, 0.52, color, 0, 0.47, 0, 0.03);
  box(g, 0.5, 0.56, 0.06, color, 0, 0.84, -0.27, 0.03);
  cyl(g, 0.03, 0.03, 0.4, C.steel, 0, 0.24, 0, 8);
  for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2; const leg = box(g, 0.04, 0.03, 0.3, C.steel, Math.sin(a) * 0.14, 0.04, Math.cos(a) * 0.14, 0); leg.rotation.y = a; }
  return g;
}
export function plant(x, z, s = 1, tall = false) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); office.add(g);
  cyl(g, 0.3, 0.22, 0.5, C.terracotta, 0, 0.25, 0, 16);
  if (tall) { cyl(g, 0.03, 0.03, 1.3, C.oakDark, 0, 1.1, 0, 6); for (let i = 0; i < 7; i++) sph(g, 0.22, i % 2 ? leafM : leaf2M, Math.sin(i * 1.7) * 0.25, 1.35 + i * 0.12, Math.cos(i * 1.7) * 0.25, 8).scale.set(1, 0.6, 1); }
  else for (let i = 0; i < 6; i++) { const m = sph(g, 0.24, i % 2 ? leafM : leaf2M, Math.sin(i) * 0.18, 0.72 + (i % 3) * 0.12, Math.cos(i) * 0.18, 8); m.scale.set(1, 0.75, 1); }
  block(x - 0.3 * s, z - 0.3 * s, x + 0.3 * s, z + 0.3 * s, 0.1);
}
function rug(x, z, w, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.015, d), M(color, { r: 1 }));
  m.position.set(x, 0.008, z); m.receiveShadow = true; office.add(m); return m;
}
function floorLabel(text, x, z, w = 3.2, rot = 0) {
  const tex = canvasTex(640, 96, (g, W, H) => {
    g.clearRect(0, 0, W, H); g.font = `600 44px ${FONT}`; g.letterSpacing = '6px';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(60,52,40,.55)'; g.fillText(text.toUpperCase(), W / 2, H / 2 + 2);
  });
  const m = basicPlane(w, w * 96 / 640, tex, true); m.material.depthWrite = false;
  m.rotation.x = -PI / 2; m.rotation.z = rot; m.position.set(x, 0.02, z); office.add(m);
}

/* İş masası: palıd üst, qara metal ayaqlar. facing=+1 → işçi +z istiqamətinə baxır. Oturacaq nöqtəsini qaytarır. */
const deskTops = ['#b58c62', '#a98157', '#bb9369'];
function desk(x, dz, facing, def, o = {}) {
  const g = new THREE.Group(); g.position.set(x, 0, dz); g.rotation.y = facing > 0 ? 0 : PI; office.add(g);
  const W = o.w || 2.0, D = o.d || 0.95, R = seeded(hash(def.id));
  box(g, W, 0.045, D, o.top || deskTops[hash(def.id) % 3], 0, 0.75, 0, 0.01);
  for (const sx of [-1, 1]) { box(g, 0.04, 0.72, 0.04, C.steel, sx * (W / 2 - 0.08), 0.36, D / 2 - 0.08, 0); box(g, 0.04, 0.72, 0.04, C.steel, sx * (W / 2 - 0.08), 0.36, -D / 2 + 0.08, 0); box(g, 0.04, 0.04, D - 0.16, C.steel, sx * (W / 2 - 0.08), 0.06, 0, 0); }
  const tex = canvasTex(384, 240, appScreen(def.screen, R));
  const scr = SCREENS[def.id] = { tex, ctx: tex.userData.ctx, type: def.screen, w: 384, h: 240 };
  const mesh = monitor(g, def.prop === 'dual' ? -0.4 : 0, 0.775, 0.24, def.prop === 'dual' ? 0.1 : 0, 0.86, scr);
  mesh.userData.agentId = def.id; screenMeshes.push(mesh);
  if (def.prop === 'dual') { const t2 = canvasTex(384, 240, appScreen(def.screen === 'dash' ? 'text' : 'dash', R)); const m2 = monitor(g, 0.46, 0.775, 0.2, -0.26, 0.8, { tex: t2 }); m2.userData.agentId = def.id; screenMeshes.push(m2); }
  box(g, 0.5, 0.02, 0.16, '#d9d5cc', 0, 0.78, -0.17, 0.005);
  box(g, 0.06, 0.025, 0.1, '#d9d5cc', 0.38, 0.78, -0.16, 0.01);
  cyl(g, 0.045, 0.04, 0.1, pick([C.terracotta, '#f1ede6', C.sage, C.ink]), -0.7, 0.825, -0.1, 12);
  const prop = def.prop;
  if (prop === 'tablet') box(g, 0.38, 0.015, 0.27, '#1f2120', 0.6, 0.78, -0.1, 0.01);
  if (prop === 'books') for (let i = 0; i < 4; i++) box(g, 0.28, 0.05, 0.2, ['#7a3e33', '#3f5a4a', '#c9b48a', '#2f3640'][i], -0.7, 0.8 + i * 0.055, 0.24, 0.005).rotation.y = (i - 1.5) * 0.1;
  if (prop === 'phone') box(g, 0.075, 0.01, 0.15, '#111', 0.6, 0.778, -0.08, 0.004);
  if (prop === 'ring') { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.02, 8, 28), new THREE.MeshBasicMaterial({ color: '#fff8e8', toneMapped: false })); ring.position.set(0.78, 1.2, 0.15); g.add(ring); cyl(g, 0.01, 0.01, 0.45, C.steel, 0.78, 0.98, 0.15, 6); }
  if (prop === 'camera') {
    const cg = new THREE.Group(); cg.position.set(-1.3, 0, -0.6); g.add(cg);
    for (let i = 0; i < 3; i++) { const l = cyl(cg, 0.012, 0.012, 1.25, C.steel, Math.sin(i * 2.1) * 0.18, 0.6, Math.cos(i * 2.1) * 0.18, 6); l.rotation.set(Math.cos(i * 2.1) * -0.28, 0, Math.sin(i * 2.1) * 0.28); }
    box(cg, 0.24, 0.16, 0.14, '#1b1b1b', 0, 1.27, 0, 0.02);
  }
  if (o.plant !== false && R() < 0.35) { cyl(g, 0.07, 0.06, 0.11, C.terracotta, 0.8, 0.83, 0.28, 10); sph(g, 0.1, leafM, 0.8, 0.95, 0.28, 8); }
  const seat = { x, z: dz - facing * 1.05, rot: facing > 0 ? 0 : PI, drop: -0.25 };
  chair(seat.x, seat.z, seat.rot, o.chair || C.fabric);
  addCost(seat.x, seat.z, 0.5, 5);
  return seat;
}

/* ---------------- otaq ---------------- */
box(office, 45.2, 0.4, 33.2, '#cfc8bc', 0, -0.21, 0, 0.05, false).receiveShadow = true;
const floor = new THREE.Mesh(new THREE.PlaneGeometry(44, 32), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.7 }));
floor.rotation.x = -PI / 2; floor.receiveShadow = true; office.add(floor);

const wallH = 3.8;
function wall(x, z, w, d) {
  const t = brickTex.clone(); t.needsUpdate = true; t.repeat.set(Math.max(w, d) / 3, wallH / 3);
  const m = box(office, w, wallH, d, new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }), x, wallH / 2, z, 0, false); m.receiveShadow = true;
  box(office, w + 0.02, 0.14, d + 0.02, '#2f302d', x, 0.07, z, 0, false); // plintus
}
wall(0, -16.15, 44.6, 0.3); wall(-22.15, 0, 0.3, 32.6); wall(22.15, 0, 0.3, 32.6);

// iri pəncərələr: qara metal çərçivə, 3×4 şüşə
const skyMat = new THREE.MeshBasicMaterial({ color: '#e4ecef', toneMapped: false });
function windowOn(side, z, w = 3.0) {
  const g = new THREE.Group(); g.position.set(side * 21.98, 1.9, z); g.rotation.y = side > 0 ? -PI / 2 : PI / 2; office.add(g);
  const H = 2.9;
  g.add(new THREE.Mesh(new THREE.PlaneGeometry(w, H), skyMat));
  const f = (bw, bh, x, y) => box(g, bw, bh, 0.05, C.steel, x, y, 0.025, 0, false);
  f(w + 0.1, 0.07, 0, H / 2); f(w + 0.1, 0.07, 0, -H / 2); f(0.07, H, -w / 2, 0); f(0.07, H, w / 2, 0);
  for (let i = 1; i < 3; i++) f(0.035, H, -w / 2 + i * w / 3, 0);
  for (let j = 1; j < 4; j++) f(w, 0.035, 0, -H / 2 + j * H / 4);
  box(g, w + 0.3, 0.06, 0.25, C.plaster, 0, -H / 2 - 0.05, 0.12, 0, false); // pəncərə altı
}
[-5, 1, 7].forEach(z => windowOn(1, z));
[-4.5, 1.5].forEach(z => windowOn(-1, z));

/* ---- komanda masa qrupları ---- */
const PODS = [
  { cx: -7, cz: -4, n: 3, dept: 'creative', ids: ['artdir', 'designer', 'junior', 'motion', 'video', 'uiux'] },
  { cx: 7,  cz: -4, n: 3, dept: 'content',  ids: ['smm', 'smmcopy', 'copy', 'strateg', 'community', 'pr'] },
  { cx: 7,  cz: 5,  n: 3, dept: 'perf',     ids: ['target', 'ppc', 'digital', 'seo', 'analyst', 'crm'] },
  { cx: -7, cz: 5,  n: 2, dept: 'lead',     ids: ['marketer', 'brand', 'pm', 'account'] },
];
export const SEATS = {};
const defOf = id => TEAM.find(t => t.id === id);
const lampMat = new THREE.MeshBasicMaterial({ color: '#fff3dc', toneMapped: false });
for (const pod of PODS) {
  const half = pod.n * 2.2 / 2;
  rug(pod.cx, pod.cz, half * 2 + 1.6, 5.0, new THREE.Color(DEPTS[pod.dept].color).lerp(new THREE.Color(C.linen), 0.88).getStyle());
  // masaların arasında alçaq palıd yeşik və bitkilər
  box(office, half * 2 - 0.2, 0.3, 0.12, C.oakDark, pod.cx, 0.93, pod.cz, 0.01);
  for (let k = 0; k < pod.n; k++) sph(office, 0.16, k % 2 ? leafM : leaf2M, pod.cx - half + 1.1 + k * 2.2, 1.12, pod.cz, 8).scale.set(1.6, 0.7, 0.6);
  pod.ids.forEach((id, i) => {
    const side = i < pod.n ? 1 : -1, k = i % pod.n;
    const x = pod.cx + (k - (pod.n - 1) / 2) * 2.2;
    SEATS[id] = desk(x, pod.cz - side * 0.52, side, defOf(id));
  });
  block(pod.cx - half, pod.cz - 1.04, pod.cx + half, pod.cz + 1.04, 0.15);
  for (let k = -1; k <= 1; k += 2) {
    const lx = pod.cx + k * half * 0.5;
    cyl(office, 0.006, 0.006, 1.6, C.steel, lx, 4.5, pod.cz, 4, false);
    cyl(office, 0.08, 0.36, 0.26, C.steel, lx, 3.6, pod.cz, 24, false);
    const d = new THREE.Mesh(new THREE.CircleGeometry(0.34, 24), lampMat); d.rotation.x = PI / 2; d.position.set(lx, 3.47, pod.cz); office.add(d);
  }
  floorLabel(DEPTS[pod.dept].name, pod.cx, pod.cz < 0 ? pod.cz - 2.95 : pod.cz + 2.95, 4.4);
}

/* ---- CMO otağı: qara çərçivəli şüşə ---- */
const glass = new THREE.MeshPhysicalMaterial({ color: '#dfe8ea', transparent: true, opacity: 0.18, roughness: 0.05, depthWrite: false });
function steelGlass(x0, z0, x1, z1, h = 2.8, dark = false) {
  const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0);
  const g = new THREE.Group(); g.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); g.rotation.y = -ang; office.add(g);
  const p = new THREE.Mesh(new THREE.BoxGeometry(len, h, 0.04), dark ? M('#2f3a36', { o: 0.45, r: 0.1 }) : glass); p.position.y = h / 2; g.add(p);
  box(g, len, 0.05, 0.07, C.steel, 0, h, 0, 0); box(g, len, 0.05, 0.07, C.steel, 0, 0.025, 0, 0); box(g, len, 0.03, 0.07, C.steel, 0, h * 0.66, 0, 0);
  for (let i = 0; i <= Math.ceil(len / 1.1); i++) box(g, 0.035, h, 0.07, C.steel, -len / 2 + Math.min(len, i * 1.1), h / 2, 0, 0);
  block(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), 0.22);
}
rug(-18, -12.5, 7.6, 6.6, '#cfc6b4');
steelGlass(-22, -9, -16, -9); steelGlass(-14, -16, -14, -9);
floorLabel('Elvin', -18, -9.7, 2.0);
SEATS.cmo = desk(-18, -13.1, 1, defOf('cmo'), { w: 2.6, d: 1.15, top: C.walnut, chair: '#2b2c2a', plant: false });
block(-19.3, -13.7, -16.7, -12.5, 0.15);
chair(-18.8, -11.65, PI, '#6b5a48'); chair(-17.2, -11.65, PI, '#6b5a48');
addCost(-18.8, -11.65, 0.45, 5); addCost(-17.2, -11.65, 0.45, 5);
{
  const g = new THREE.Group(); g.position.set(-21.7, 0, -13); office.add(g);
  box(g, 0.42, 2.4, 2.6, C.oak, 0, 1.2, 0, 0.01);
  const R = seeded(3), spines = ['#7a3e33', '#3f5a4a', '#c9b48a', '#2f3640', '#8a7a62', '#e1dbcf'];
  for (let s = 0; s < 4; s++) for (let i = 0; i < 9; i++) { if (R() < 0.2) continue; box(g, 0.28, 0.3 + R() * 0.12, 0.1 + R() * 0.06, spines[(i + s) % spines.length], 0.06, 0.36 + s * 0.56, -1.1 + i * 0.26, 0.005); }
  block(-22, -14.3, -21.45, -11.7, 0.1);
}
plant(-21, -10, 1.1, true);

/* ---- Səs studiyası ---- */
{
  rug(18, -12.5, 7.6, 6.6, '#3e4542');
  steelGlass(14, -16, 14, -9, 2.8, true); steelGlass(15.8, -9, 22, -9, 2.8, true);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) box(office, 0.9, 0.55, 0.06, (i + j) % 2 ? C.felt : C.feltDark, 15.2 + i * 1.15, 0.9 + j * 0.65, -15.95, 0.02, false);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) box(office, 0.06, 0.55, 0.9, (i + j) % 2 ? C.felt : C.feltDark, 21.95, 0.9 + j * 0.65, -15 + i * 1.15, 0.02, false);
  SEATS.composer = desk(18.5, -13.4, -1, defOf('composer'), { w: 3.0, d: 1.1, top: C.walnut, chair: '#252625', plant: false });
  block(17, -13.95, 20, -12.85, 0.15);
  const kb = new THREE.Group(); kb.position.set(18.5, 0.79, -13.05); office.add(kb);
  box(kb, 1.3, 0.05, 0.32, '#1b1b1b', 0, 0, 0, 0.01);
  for (let i = 0; i < 24; i++) box(kb, 0.048, 0.02, 0.2, '#efece6', -0.6 + i * 0.052, 0.03, 0.04, 0, false);
  for (let i = 0; i < 24; i++) if ([1, 3, 6, 8, 10].includes(i % 12)) box(kb, 0.03, 0.03, 0.12, '#111', -0.574 + i * 0.052, 0.05, 0.0, 0, false);
  for (const sx of [17.2, 19.8]) { box(office, 0.32, 0.5, 0.32, '#202120', sx, 1.03, -13.7, 0.02); cyl(office, 0.09, 0.09, 0.02, '#585a57', sx, 0.98, -13.53, 16).rotation.x = PI / 2; }
  const mic = new THREE.Group(); mic.position.set(15.6, 0, -14.8); office.add(mic);
  cyl(mic, 0.24, 0.24, 0.03, '#222', 0, 0.02, 0, 16); cyl(mic, 0.014, 0.014, 1.6, '#333', 0, 0.8, 0, 6); sph(mic, 0.07, '#777', 0, 1.65, 0, 10);
  block(15.3, -15.1, 15.9, -14.5, 0.1);
  const gt = new THREE.Group(); gt.position.set(21.2, 0, -10.2); gt.rotation.set(0, -0.8, 0.15); office.add(gt);
  const body = sph(gt, 0.28, '#8a5a34', 0, 0.45, 0, 16); body.scale.set(1, 1.25, 0.35);
  box(gt, 0.07, 0.9, 0.04, '#3b2416', 0, 1.15, 0, 0);
  block(20.9, -10.5, 21.5, -9.9, 0.1);
  floorLabel('Səs studiyası', 18, -9.7, 3.0);
}

/* ---- Arxa divar: mantar lövhə, ekran, ad ---- */
export const kanbanTex = canvasTex(1024, 446, () => {});
const kanban = basicPlane(4.8, 2.1, kanbanTex); kanban.position.set(-7, 1.75, -15.97); office.add(kanban);
box(office, 5.0, 2.3, 0.05, C.oak, -7, 1.75, -16.0, 0.01, false);

export const dashTex = canvasTex(1024, 444, () => {});
const dash = basicPlane(5.6, 2.43, dashTex); dash.position.set(4, 1.9, -15.95); office.add(dash);
box(office, 5.75, 2.58, 0.08, '#141514', 4, 1.9, -16.0, 0.01, false);

const signTex = canvasTex(900, 200, (g, w, h) => {
  g.clearRect(0, 0, w, h); g.textAlign = 'center'; g.fillStyle = '#34312b';
  g.font = `600 72px ${FONT}`; g.letterSpacing = '10px'; g.fillText(WORLD.company.toUpperCase(), w / 2, 100);
  g.font = `400 34px ${FONT}`; g.letterSpacing = '4px'; g.fillStyle = '#6a6458'; g.fillText('2018 · BAKI', w / 2, 160);
});
const sign = basicPlane(4.2, 0.93, signTex, true); sign.position.set(-1.4, 3.0, -15.97); office.add(sign);

/* ---- printer və su ---- */
box(office, 0.9, 0.85, 0.65, '#dedad2', -13, 0.425, -1, 0.03); box(office, 0.6, 0.04, 0.4, '#2a2b2a', -13, 0.87, -1, 0.005);
block(-13.45, -1.33, -12.55, -0.67, 0.12);
cyl(office, 0.24, 0.24, 0.95, '#eeebe5', 13, 0.475, -1, 16); cyl(office, 0.19, 0.16, 0.5, '#bcd6dc', 13, 1.2, -1, 16).material = M('#bcd6dc', { o: 0.7 });
block(12.7, -1.3, 13.3, -0.7, 0.12);

/* ---- Görüş otağı ---- */
export const MEET_SEATS = [];
export const slideTex = canvasTex(640, 360, (g, w, h) => {
  g.fillStyle = '#f4f2ed'; g.fillRect(0, 0, w, h);
  g.fillStyle = C.ink; g.font = `600 40px ${FONT}`; g.fillText('Bu həftə', 40, 76);
  g.font = `400 24px ${FONT}`; g.fillStyle = '#4c4a44';
  ['Klinika: yeni xidmət kampaniyası', 'Mebel mağazası: yay endirimi', 'Restoranlar: çatdırılma menyusu', 'Tətbiq: oktyabr hesabatı'].forEach((t, i) => g.fillText('— ' + t, 44, 140 + i * 46));
  g.fillStyle = '#1f5f4a'; g.fillRect(40, 96, 64, 4);
});
{
  rug(-17, 11.5, 9, 7.6, '#cbc2b0');
  const tbl = new THREE.Group(); tbl.position.set(-16.5, 0, 11.5); office.add(tbl);
  box(tbl, 6, 0.06, 2, C.oak, 0, 0.75, 0, 0.01);
  for (const sx of [-2.3, 2.3]) box(tbl, 0.08, 0.72, 1.5, C.steel, sx, 0.36, 0, 0);
  block(-19.5, 10.5, -13.5, 12.5, 0.15);
  for (const x of [-18.5, -16.5, -14.5]) {
    MEET_SEATS.push({ x, z: 9.85, rot: 0, drop: -0.25 }); chair(x, 9.85, 0, '#6b5a48'); addCost(x, 9.85, 0.45, 5);
    MEET_SEATS.push({ x, z: 13.15, rot: PI, drop: -0.25 }); chair(x, 13.15, PI, '#6b5a48'); addCost(x, 13.15, 0.45, 5);
  }
  const tv = basicPlane(3.4, 1.9, slideTex); tv.position.set(-21.96, 1.8, 11.5); tv.rotation.y = PI / 2; office.add(tv);
  box(office, 0.06, 2.0, 3.5, '#141514', -21.99, 1.8, 11.5, 0.01, false);
  floorLabel('Görüş otağı', -17, 15.6, 3.2);
}
export const PRESENT = { x: -20.4, z: 11.5, rot: PI / 2 };

/* ---- Launj ---- */
export const POIS = [];
{
  rug(5, 13.3, 7.4, 4.8, '#c9bfae');
  const sofa = new THREE.Group(); sofa.position.set(5, 0, 14.9); office.add(sofa);
  const sc = '#3f5a4a';
  box(sofa, 5.2, 0.42, 1.2, sc, 0, 0.21, -0.1, 0.08);
  box(sofa, 5.2, 0.85, 0.32, sc, 0, 0.45, 0.5, 0.08);
  box(sofa, 0.32, 0.64, 1.3, sc, -2.6, 0.32, 0, 0.08); box(sofa, 0.32, 0.64, 1.3, sc, 2.6, 0.32, 0, 0.08);
  for (const cx of [-1.6, 0, 1.6]) box(sofa, 1.5, 0.13, 1.0, '#4b6a58', cx, 0.48, -0.15, 0.05);
  box(sofa, 0.42, 0.42, 0.13, C.terracotta, -1.9, 0.74, 0.25, 0.04).rotation.z = 0.2;
  block(2.4, 15.05, 7.6, 15.6, 0.1); block(2.2, 14.2, 2.6, 15.6, 0.05); block(7.4, 14.2, 7.8, 15.6, 0.05);
  box(office, 2.0, 0.06, 0.9, C.walnut, 5, 0.42, 12.6, 0.01);
  cyl(office, 0.03, 0.03, 0.4, C.steel, 4.2, 0.2, 12.6, 6); cyl(office, 0.03, 0.03, 0.4, C.steel, 5.8, 0.2, 12.6, 6);
  box(office, 0.32, 0.025, 0.24, '#e9e4da', 4.7, 0.46, 12.5, 0.005); cyl(office, 0.05, 0.045, 0.09, '#fff', 5.4, 0.5, 12.7, 10);
  block(4, 12.15, 6, 13.05, 0.12);
  const ac = new THREE.Group(); ac.position.set(5, 0, 11.2); office.add(ac);
  box(ac, 1.05, 0.4, 0.9, C.terracotta, 0, 0.2, 0, 0.08); box(ac, 1.05, 0.68, 0.24, C.terracotta, 0, 0.5, -0.4, 0.06);
  block(4.45, 10.6, 5.55, 10.9, 0.05);
  [[3.6, 14.35], [5, 14.35], [6.4, 14.35]].forEach(([x, z], i) => POIS.push({ id: 'sofa' + i, x, z, rot: PI, drop: -0.32, text: pick(['Divanda fikirləşir', 'Telefonda trendlərə baxır', 'Podkast dinləyir']), anim: 'phone', status: 'break' }));
  POIS.push({ id: 'armchair', x: 5, z: 11.25, rot: 0, drop: -0.32, text: 'Jurnal vərəqləyir', anim: 'phone', status: 'break' });
  floorLabel('Launj', 5, 10.3, 1.8);
}

/* ---- Mətbəx ---- */
{
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 8.4), new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.6 }));
  fl.rotation.x = -PI / 2; fl.position.set(17.7, 0.009, 11.8); fl.receiveShadow = true; office.add(fl);
  box(office, 1.1, 0.92, 6.6, C.sage, 21.45, 0.46, 11.3, 0.01);
  box(office, 1.15, 0.05, 6.65, '#2e2f2c', 21.45, 0.95, 11.3, 0.005);
  box(office, 0.55, 0.75, 6.6, C.sage, 21.72, 2.4, 11.3, 0.01, false);
  box(office, 0.5, 0.6, 0.45, '#262725', 21.5, 1.28, 9.5, 0.03); box(office, 0.3, 0.04, 0.2, '#777', 21.3, 1.0, 9.5, 0);
  cyl(office, 0.045, 0.04, 0.09, '#fff', 21.2, 1.02, 9.35, 10); cyl(office, 0.045, 0.04, 0.09, C.terracotta, 21.2, 1.02, 9.65, 10);
  box(office, 0.55, 0.35, 0.7, '#cfccc5', 21.45, 1.15, 11.6, 0.02);
  cyl(office, 0.24, 0.15, 0.1, '#e9e4da', 21.4, 1.02, 13.4, 16); sph(office, 0.08, '#c8742f', 21.35, 1.1, 13.35, 8); sph(office, 0.08, '#8b9a3e', 21.48, 1.1, 13.45, 8);
  block(20.9, 8.0, 22, 14.6, 0.12);
  box(office, 1.0, 2.1, 0.9, '#e3e0d9', 21.4, 1.05, 15.3, 0.03); box(office, 0.03, 0.5, 0.05, '#8c8a85', 20.88, 1.3, 15.0, 0);
  block(20.9, 14.85, 22, 15.75, 0.1);
  cyl(office, 0.6, 0.6, 0.04, C.oak, 16.5, 1.05, 11, 28); cyl(office, 0.04, 0.04, 1.05, C.steel, 16.5, 0.52, 11, 8); cyl(office, 0.3, 0.3, 0.025, C.steel, 16.5, 0.02, 11, 16);
  for (const sx of [15.4, 17.6]) { cyl(office, 0.19, 0.19, 0.05, C.oak, sx, 0.78, 11, 14); cyl(office, 0.025, 0.025, 0.76, C.steel, sx, 0.38, 11, 6); }
  block(16.0, 10.5, 17.0, 11.5, 0.05);
  cyl(office, 0.21, 0.21, 0.9, '#eeebe5', 16.5, 0.45, 15.5, 14); cyl(office, 0.17, 0.17, 0.45, '#bcd6dc', 16.5, 1.12, 15.5, 14).material = M('#bcd6dc', { o: 0.7 });
  block(16.2, 15.2, 16.8, 15.8, 0.1);
  POIS.push({ id: 'coffee1', x: 20.15, z: 9.5, rot: PI / 2, text: 'Qəhvə hazırlayır', anim: 'drink', status: 'break' });
  POIS.push({ id: 'coffee2', x: 20.15, z: 11.6, rot: PI / 2, text: 'Çay dəmləyir', anim: 'drink', status: 'break' });
  POIS.push({ id: 'fruit', x: 20.15, z: 13.4, rot: PI / 2, text: 'Meyvə götürür', anim: 'idle', status: 'break' });
  POIS.push({ id: 'ht1', x: 15.4, z: 11.0, rot: PI / 2, text: 'Qısa fasilə', anim: 'drink', status: 'break' });
  POIS.push({ id: 'ht2', x: 17.6, z: 11.0, rot: -PI / 2, text: 'Çay üstündə söhbət', anim: 'talk', status: 'break' });
  POIS.push({ id: 'water', x: 16.5, z: 14.7, rot: 0, text: 'Su içir', anim: 'drink', status: 'break' });
  floorLabel('Mətbəx', 17.5, 7.9, 2.2);
}
POIS.push({ id: 'printer', x: -13, z: -0.15, rot: PI, text: 'Maketləri çap edir', anim: 'idle', status: 'work' });
POIS.push({ id: 'water2', x: 13, z: -0.15, rot: PI, text: 'Su içir', anim: 'drink', status: 'break' });
POIS.push({ id: 'board1', x: -8.2, z: -14.2, rot: PI, text: 'Lövhədə tapşırıqlara baxır', anim: 'think', status: 'think' });
POIS.push({ id: 'board2', x: -5.8, z: -14.2, rot: PI, text: 'Lövhəyə qeyd yapışdırır', anim: 'present', status: 'think' });
POIS.push({ id: 'screen1', x: 2.8, z: -13.6, rot: PI, text: 'Ekrandakı rəqəmlərə baxır', anim: 'think', status: 'think' });
POIS.push({ id: 'screen2', x: 5.2, z: -13.6, rot: PI, text: 'Rəqəmləri müzakirə edir', anim: 'talk', status: 'chat' });
POIS.push({ id: 'cmo1', x: -18.8, z: -11.65, rot: PI, drop: -0.25, text: 'Elvinlə müzakirə', anim: 'talk', status: 'chat' });
POIS.push({ id: 'cmo2', x: -17.2, z: -11.65, rot: PI, drop: -0.25, text: 'Elvinə iş göstərir', anim: 'talk', status: 'chat' });
POIS.push({ id: 'studio', x: 16.6, z: -11.2, rot: Math.atan2(18.5 - 16.6, -12.35 + 11.2), text: 'Jingle demosunu dinləyir', anim: 'idle', status: 'chat' });

[[-21, -7.8, 1, true], [-12.6, -8], [12.6, -8], [21, -7.8, 1, true], [-21, 7.5, 1, true], [-11.8, 15.2], [1.3, 15.2], [8.8, 15.2], [12.6, 15.2, 1, true], [-3.4, -15.2, 1.1, true], [10, -15.2], [-0.2, 9.5]]
  .forEach(([x, z, s, tall], i) => plant(x, z, s || 0.85 + (i % 3) * 0.12, !!tall));
