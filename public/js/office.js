// Ofis: köhnə sənaye binasında açıq loft. Cilalanmış beton, çuqun sütunlar, şimal divarı boyu fabrik pəncərələri.
// Mərkəzdə dörd uzun ortaq masa (şöbələr), qərbdə Elvinin otağı, telefon kabinələri və dəyirmi görüş otağı,
// şərqdə səs studiyası, mətbəx adası və launj, cənub divarında lövhə, ekran və kitab rəfi.
// Koordinatlar naviqasiya ilə bağlıdır: oturacaq və fasilə yerləri buradan gəlir. Otaq: x -20..20, z -14..14.
import { THREE, office, M, box, cyl, sph, canvasTex, basicPlane, FONT } from './kit.js';
import { block, addCost } from './nav.js';
import { PI, pick, seeded, hash } from './util.js';
import { DEPTS, TEAM, WORLD } from '../team.js';

export const ROOM = { x0: -20, x1: 20, z0: -14, z1: 14 };

/* ---------------- palitra ---------------- */
export const C = {
  oak: '#b8936b', oakDark: '#8c6a4a', walnut: '#5b4232', iron: '#2b2d2f', steel: '#3a3d40',
  plaster: '#ece8e1', felt: '#5d6b74', feltDark: '#3f4a52', terracotta: '#b4643f', concrete: '#b9b3a8',
  leaf: '#4f6b48', leaf2: '#647f56', fabric: '#4b5157', sage: '#8fa39a', linen: '#d9d1c2', ink: '#2d2f2c', blue: '#36546b',
};
const leafM = M(C.leaf, { r: 0.9 }), leaf2M = M(C.leaf2, { r: 0.9 });

/* ---------------- teksturlar ---------------- */
const concreteTex = canvasTex(1024, 1024, (g, w, h) => {
  g.fillStyle = '#bdb7ac'; g.fillRect(0, 0, w, h);
  const R = seeded(21);
  for (let i = 0; i < 2600; i++) { const r = 8 + R() * 60; g.fillStyle = `rgba(${R() < 0.5 ? '90,85,78' : '235,230,220'},${0.02 + R() * 0.04})`; g.beginPath(); g.arc(R() * w, R() * h, r, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(70,65,60,.25)'; g.lineWidth = 2; // kəsik xətləri (plitələr)
  for (let x = 0; x <= w; x += 256) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  for (let y = 0; y <= h; y += 256) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
});
concreteTex.wrapS = concreteTex.wrapT = THREE.RepeatWrapping; concreteTex.repeat.set(5, 3.5);

const plasterTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#ebe6dd'; g.fillRect(0, 0, w, h);
  const R = seeded(8);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(120,110,95,${R() * 0.05})`; g.beginPath(); g.arc(R() * w, R() * h, 4 + R() * 30, 0, 7); g.fill(); }
});
plasterTex.wrapS = plasterTex.wrapT = THREE.RepeatWrapping;

const parquetTex = canvasTex(512, 512, (g, w, h) => {
  const R = seeded(4), s = 64;
  for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) {
    const vert = ((x + y) / s) % 2 === 0;
    for (let k = 0; k < 4; k++) {
      g.fillStyle = `hsl(${27 + R() * 6},${32 + R() * 8}%,${50 + R() * 10}%)`;
      if (vert) g.fillRect(x + k * 16 + 1, y + 1, 14, s - 2); else g.fillRect(x + 1, y + k * 16 + 1, s - 2, 14);
    }
  }
});
parquetTex.wrapS = parquetTex.wrapT = THREE.RepeatWrapping;

/* ---------------- monitorlar ---------------- */
// Hər personajın monitoru öz kanvasıdır: monitors.js oraya onun kompüter jurnalını çəkir.
export const SCREENS = {};
export const screenMeshes = [];
function appScreen(type, R) {
  return (g, w, h) => {
    const dark = type === 'dash' || type === 'video' || type === 'daw';
    g.fillStyle = dark ? '#1f2320' : '#f3f1ec'; g.fillRect(0, 0, w, h);
    g.fillStyle = dark ? '#2c312d' : '#e3dfd6'; g.fillRect(0, 0, w, 18);
    if (type === 'design') {
      g.fillStyle = '#e3dfd6'; g.fillRect(0, 18, 34, h); g.fillStyle = '#fff'; g.fillRect(52, 32, w - 104, h - 52);
      g.fillStyle = C.terracotta; g.fillRect(72, 52, 110, 70); g.fillStyle = C.ink; g.fillRect(72, 136, 160, 10);
    } else if (type === 'text' || type === 'social') {
      g.fillStyle = '#fff'; g.fillRect(48, 28, w - 96, h - 36); g.fillStyle = C.ink; g.fillRect(70, 44, 150, 10);
      for (let i = 0; i < 10; i++) { g.fillStyle = '#c9c3b6'; g.fillRect(70, 66 + i * 14, 120 + R() * 140, 5); }
    } else if (type === 'dash') {
      for (let i = 0; i < 3; i++) { g.fillStyle = '#2c312d'; g.fillRect(14 + i * 120, 30, 108, 46); g.fillStyle = ['#8fc7a6', '#d9c08f', '#c7d1d8'][i]; g.fillRect(24 + i * 120, 56, 50, 8); }
      for (let i = 0; i < 18; i++) { const bh = 20 + R() * 80; g.fillStyle = '#5f7f6c'; g.fillRect(28 + i * 18, h - 20 - bh, 10, bh); }
    } else {
      for (let t = 0; t < 6; t++) { g.strokeStyle = ['#8fc7a6', '#d9c08f', '#c7d1d8'][t % 3]; g.lineWidth = 1.4; g.beginPath(); for (let x = 50; x < w - 10; x += 3) g.lineTo(x, 34 + t * 34 + Math.sin(x * (0.15 + t * 0.04)) * (5 + R() * 6)); g.stroke(); }
    }
  };
}
function monitor(p, x, y, z, rotY, w, screen) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; p.add(g);
  box(g, 0.04, 0.32, 0.04, C.iron, 0, 0.16, 0.04, 0.01);
  box(g, 0.24, 0.012, 0.18, C.iron, 0, 0.006, 0.04, 0.004);
  box(g, w, 0.52, 0.025, '#141514', 0, 0.56, 0, 0.008);
  const s = basicPlane(w - 0.04, 0.48, screen.tex); s.position.set(0, 0.56, -0.014); s.rotation.y = PI; g.add(s);
  return s;
}
function chair(x, z, rot, color = C.fabric) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; office.add(g);
  box(g, 0.5, 0.07, 0.48, color, 0, 0.47, 0, 0.03);
  box(g, 0.46, 0.5, 0.05, color, 0, 0.82, -0.25, 0.03);
  cyl(g, 0.025, 0.025, 0.4, C.iron, 0, 0.24, 0, 8);
  for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2; const leg = box(g, 0.035, 0.025, 0.28, C.iron, Math.sin(a) * 0.13, 0.04, Math.cos(a) * 0.13, 0); leg.rotation.y = a; }
  return g;
}
export function plant(x, z, s = 1, tall = false) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); office.add(g);
  cyl(g, 0.28, 0.22, 0.5, C.terracotta, 0, 0.25, 0, 16);
  if (tall) { cyl(g, 0.03, 0.03, 1.4, C.oakDark, 0, 1.1, 0, 6); for (let i = 0; i < 8; i++) sph(g, 0.22, i % 2 ? leafM : leaf2M, Math.sin(i * 1.7) * 0.26, 1.3 + i * 0.13, Math.cos(i * 1.7) * 0.26, 8).scale.set(1, 0.6, 1); }
  else for (let i = 0; i < 6; i++) sph(g, 0.24, i % 2 ? leafM : leaf2M, Math.sin(i) * 0.18, 0.72 + (i % 3) * 0.12, Math.cos(i) * 0.18, 8).scale.set(1, 0.75, 1);
  block(x - 0.3 * s, z - 0.3 * s, x + 0.3 * s, z + 0.3 * s, 0.1);
}
function rug(x, z, w, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.015, d), M(color, { r: 1 }));
  m.position.set(x, 0.008, z); m.receiveShadow = true; office.add(m); return m;
}
function floorPatch(x, z, w, d, tex, rep) {
  const t = tex.clone(); t.needsUpdate = true; t.repeat.set(w / rep, d / rep);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: t, roughness: 0.75 }));
  m.rotation.x = -PI / 2; m.position.set(x, 0.006, z); m.receiveShadow = true; office.add(m);
}
function wallText(text, x, y, z, rotY, w, size = 64, color = '#34312b') {
  const tex = canvasTex(1024, 180, (g, W, H) => { g.clearRect(0, 0, W, H); g.textAlign = 'center'; g.fillStyle = color; g.font = `600 ${size}px ${FONT}`; g.letterSpacing = '10px'; g.fillText(text, W / 2, H / 2 + size / 3); });
  const m = basicPlane(w, w * 180 / 1024, tex, true); m.position.set(x, y, z); m.rotation.y = rotY; office.add(m);
}

/* İş yeri ortaq masada: monitor, klaviatura, kiçik əşyalar, stul. facing=+1 → işçi +z istiqamətinə baxır. */
function station(x, dz, facing, def) {
  const g = new THREE.Group(); g.position.set(x, 0, dz); g.rotation.y = facing > 0 ? 0 : PI; office.add(g);
  const R = seeded(hash(def.id));
  const tex = canvasTex(384, 240, appScreen(def.screen, R));
  const scr = SCREENS[def.id] = { tex, ctx: tex.userData.ctx, type: def.screen, w: 384, h: 240 };
  const dual = def.prop === 'dual';
  const m1 = monitor(g, dual ? -0.38 : 0, 0.77, 0.22, dual ? 0.12 : 0, 0.82, scr); m1.userData.agentId = def.id; screenMeshes.push(m1);
  if (dual) { const m2 = monitor(g, 0.44, 0.77, 0.18, -0.26, 0.74, { tex: canvasTex(384, 240, appScreen(def.screen === 'dash' ? 'text' : 'dash', R)) }); m2.userData.agentId = def.id; screenMeshes.push(m2); }
  box(g, 0.46, 0.018, 0.15, '#2b2d2f', 0, 0.778, -0.15, 0.004);
  box(g, 0.06, 0.02, 0.1, '#2b2d2f', 0.34, 0.778, -0.15, 0.008);
  cyl(g, 0.042, 0.038, 0.1, pick([C.terracotta, '#f1ede6', C.sage, C.blue]), -0.68, 0.82, -0.08, 12);
  if (def.prop === 'tablet') box(g, 0.36, 0.014, 0.26, '#1f2120', 0.6, 0.776, -0.1, 0.01);
  if (def.prop === 'books') for (let i = 0; i < 4; i++) box(g, 0.26, 0.05, 0.19, ['#7a3e33', '#36546b', '#c9b48a', '#2f3640'][i], -0.68, 0.795 + i * 0.054, 0.22, 0.005).rotation.y = (i - 1.5) * 0.1;
  if (def.prop === 'phone') box(g, 0.07, 0.01, 0.14, '#111', 0.58, 0.775, -0.08, 0.004);
  if (def.prop === 'ring') { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 8, 28), new THREE.MeshBasicMaterial({ color: '#fff8e8', toneMapped: false })); ring.position.set(0.72, 1.18, 0.12); g.add(ring); cyl(g, 0.01, 0.01, 0.42, C.iron, 0.72, 0.97, 0.12, 6); }
  if (def.prop === 'camera') box(g, 0.22, 0.14, 0.13, '#1b1b1b', 0.66, 0.84, 0.12, 0.02);
  if (R() < 0.3) { cyl(g, 0.065, 0.055, 0.1, C.terracotta, 0.72, 0.82, 0.25, 10); sph(g, 0.09, leafM, 0.72, 0.93, 0.25, 8); }
  const seat = { x, z: dz - facing * 1.0, rot: facing > 0 ? 0 : PI, drop: -0.25 };
  chair(seat.x, seat.z, seat.rot);
  addCost(seat.x, seat.z, 0.5, 5);
  return seat;
}

/* ---------------- bina ---------------- */
box(office, 41.2, 0.4, 29.2, '#c9c2b6', 0, -0.21, 0, 0.04, false).receiveShadow = true;
const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 28), new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.55, metalness: 0.02 }));
floor.rotation.x = -PI / 2; floor.receiveShadow = true; office.add(floor);

const wallH = 4.2;
function wall(x, z, w, d) {
  const t = plasterTex.clone(); t.needsUpdate = true; t.repeat.set(Math.max(w, d) / 4, wallH / 4);
  const m = box(office, w, wallH, d, new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }), x, wallH / 2, z, 0, false); m.receiveShadow = true;
  box(office, w + 0.02, 0.12, d + 0.02, C.iron, x, 0.06, z, 0, false);
}
// kamera cənubdan baxır: cənub tərəfi açıqdır (alçaq plintus), şimal, qərb, şərq divarları bütöv
wall(-20.15, 0, 0.3, 28.6);
box(office, 40.6, 0.25, 0.3, C.plaster, 0, 0.125, 14.15, 0, false);
box(office, 0.3, 0.25, 28.6, C.plaster, 20.15, 0.125, 0, 0, false); // şərq də açıqdır: kamera oradan baxır
wall(0, -14.25, 15.2, 0.3); // şimalın ortası: lövhə və ekran üçün
const skyMat = new THREE.MeshBasicMaterial({ color: '#e2eaec', toneMapped: false });
function factoryWindow(x, w) {
  const g = new THREE.Group(); g.position.set(x, 0, -14.1); office.add(g);
  const H = 3.4, y0 = 0.6;
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, H), skyMat); pane.position.y = y0 + H / 2; pane.rotation.y = 0; g.add(pane);
  const f = (bw, bh, fx, fy) => box(g, bw, bh, 0.05, C.iron, fx, fy, 0.03, 0, false);
  f(w, 0.08, 0, y0); f(w, 0.08, 0, y0 + H);
  for (let i = 0; i <= 4; i++) f(0.04, H, -w / 2 + i * w / 4, y0 + H / 2);
  for (let j = 1; j < 5; j++) f(w, 0.03, 0, y0 + j * H / 5);
  box(g, w, y0, 0.3, C.plaster, 0, y0 / 2, 0, 0, false);
}
[-16.5, -10.5, 10.5, 16.5].forEach(x => factoryWindow(x, 5.2));
for (const x of [-19.7, -13.5, -7.6, 7.6, 13.5, 19.7]) box(office, 0.8, wallH, 0.4, C.plaster, x, wallH / 2, -14.1, 0, false);
box(office, 40.6, 0.6, 0.4, C.plaster, 0, wallH - 0.3, -14.1, 0, false);

// çuqun sütunlar
const COLS = [];
for (const x of [-7, 5]) for (const z of [-5.5, 0.5, 6.5]) COLS.push([x, z]);
for (const [x, z] of COLS) { cyl(office, 0.16, 0.18, wallH, C.iron, x, wallH / 2, z, 16); cyl(office, 0.26, 0.26, 0.12, C.iron, x, wallH - 0.06, z, 16); block(x - 0.2, z - 0.2, x + 0.2, z + 0.2, 0.1); }

/* ---- dörd uzun ortaq masa ---- */
const TABLES = [
  { z: -8.5, dept: 'creative', ids: ['artdir', 'designer', 'junior', 'motion', 'video', 'uiux'] },
  { z: -2.5, dept: 'content',  ids: ['smm', 'smmcopy', 'copy', 'strateg', 'community', 'pr'] },
  { z: 3.5,  dept: 'perf',     ids: ['target', 'ppc', 'digital', 'seo', 'analyst', 'crm'] },
  { z: 9.5,  dept: 'lead',     ids: ['marketer', 'brand', 'pm', 'account'] },
];
export const SEATS = {};
const defOf = id => TEAM.find(t => t.id === id);
const lampMat = new THREE.MeshBasicMaterial({ color: '#fff2da', toneMapped: false });
for (const t of TABLES) {
  const n = t.ids.length / 2, L = n * 2.0 + 0.5, cx = -1;
  floorPatch(cx, t.z, L + 2.6, 4.6, parquetTex, 1.6);
  box(office, L, 0.05, 1.9, C.oak, cx, 0.75, t.z, 0.01);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(office, 0.06, 0.73, 0.06, C.iron, cx + sx * (L / 2 - 0.15), 0.365, t.z + sz * 0.8, 0);
  box(office, L - 0.3, 0.04, 0.04, C.iron, cx, 0.12, t.z, 0);
  t.ids.forEach((id, i) => {
    const side = i < n ? 1 : -1, k = i % n;
    const x = cx + (k - (n - 1) / 2) * 2.0;
    SEATS[id] = station(x, t.z - side * 0.48, side, defOf(id));
  });
  block(cx - L / 2, t.z - 0.95, cx + L / 2, t.z + 0.95, 0.12);
  // uzun xətti lampa
  box(office, L - 0.6, 0.06, 0.14, C.iron, cx, 3.3, t.z, 0.01, false);
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(L - 0.7, 0.08), lampMat); strip.rotation.x = PI / 2; strip.position.set(cx, 3.265, t.z); office.add(strip);
  for (const sx of [-1, 1]) cyl(office, 0.005, 0.005, 0.9, C.iron, cx + sx * (L / 2 - 0.6), 3.75, t.z, 4, false);
  // masanın ucunda kiçik şöbə lövhəsi
  wallText(DEPTS[t.dept].name.toUpperCase(), cx - L / 2 - 0.02, 0.95, t.z, -PI / 2, 1.6, 52, '#6a6458');
}

/* ---- Elvinin otağı (şimal-qərb), qara çərçivəli şüşə ---- */
const glass = new THREE.MeshPhysicalMaterial({ color: '#dfe8ea', transparent: true, opacity: 0.16, roughness: 0.05, depthWrite: false });
function steelGlass(x0, z0, x1, z1, h = 3.0, mat = glass) {
  const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0);
  const g = new THREE.Group(); g.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); g.rotation.y = -ang; office.add(g);
  const p = new THREE.Mesh(new THREE.BoxGeometry(len, h, 0.04), mat); p.position.y = h / 2; g.add(p);
  box(g, len, 0.05, 0.07, C.iron, 0, h, 0, 0); box(g, len, 0.05, 0.07, C.iron, 0, 0.025, 0, 0); box(g, len, 0.03, 0.07, C.iron, 0, h * 0.7, 0, 0);
  for (let i = 0; i <= Math.ceil(len / 1.0); i++) box(g, 0.03, h, 0.07, C.iron, -len / 2 + Math.min(len, i * 1.0), h / 2, 0, 0);
  block(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), 0.22);
}
floorPatch(-16, -10.3, 8, 7.4, parquetTex, 1.6);
steelGlass(-20, -6.6, -14.2, -6.6); steelGlass(-12, -14, -12, -8.4);
{
  const g = new THREE.Group(); g.position.set(-16, 0, -11); office.add(g);
  box(g, 2.4, 0.05, 1.1, C.walnut, 0, 0.75, 0, 0.01);
  for (const sx of [-1, 1]) box(g, 0.06, 0.73, 1.0, C.iron, sx * 1.1, 0.365, 0, 0);
  const tex = canvasTex(384, 240, appScreen('dash', seeded(1)));
  SEATS.cmo = { x: -16, z: -12.05, rot: 0, drop: -0.25 };
  const scr = SCREENS.cmo = { tex, ctx: tex.userData.ctx, type: 'dash', w: 384, h: 240 };
  const m = monitor(g, 0, 0.775, 0.25, 0, 0.9, scr); m.userData.agentId = 'cmo'; screenMeshes.push(m);
  chair(-16, -12.05, 0, '#2b2c2a'); addCost(-16, -12.05, 0.5, 5);
  block(-17.3, -11.6, -14.7, -10.4, 0.12);
  // qonaq kreslosu və kitab rəfi
  chair(-16.7, -9.6, PI, '#6b5a48'); chair(-15.3, -9.6, PI, '#6b5a48'); addCost(-16.7, -9.6, 0.45, 5); addCost(-15.3, -9.6, 0.45, 5);
  const sh = new THREE.Group(); sh.position.set(-19.7, 0, -10.5); office.add(sh);
  box(sh, 0.4, 2.4, 3.0, C.oak, 0, 1.2, 0, 0.01);
  const R = seeded(3), spines = ['#7a3e33', '#36546b', '#c9b48a', '#2f3640', '#8a7a62', '#e1dbcf'];
  for (let s = 0; s < 4; s++) for (let i = 0; i < 10; i++) { if (R() < 0.2) continue; box(sh, 0.26, 0.3 + R() * 0.12, 0.1 + R() * 0.06, spines[(i + s) % 6], 0.06, 0.36 + s * 0.56, -1.3 + i * 0.27, 0.005); }
  block(-20, -12.1, -19.45, -8.9, 0.1);
  plant(-13, -13, 1, true);
}

/* ---- telefon kabinələri (qərb divarı) ---- */
export const POIS = [];
for (const [i, z] of [[0, -3.6], [1, -0.4]]) {
  const g = new THREE.Group(); g.position.set(-19, 0, z); office.add(g);
  box(g, 1.9, 2.4, 0.08, C.feltDark, 0, 1.2, -1.2, 0.01); box(g, 1.9, 2.4, 0.08, C.feltDark, 0, 1.2, 1.2, 0.01);
  box(g, 1.9, 0.08, 2.48, C.feltDark, 0, 2.4, 0, 0.01);
  box(g, 0.5, 0.4, 0.9, C.felt, -0.55, 0.22, 0, 0.04);
  const dg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.3, 2.3), glass); dg.position.set(0.95, 1.15, 0); g.add(dg);
  block(-20, z - 1.25, -18.05, z - 1.15, 0.05); block(-20, z + 1.15, -18.05, z + 1.25, 0.05);
  POIS.push({ id: 'booth' + i, x: -19.3, z, rot: PI / 2, drop: -0.35, text: 'Kabinədə telefonla danışır', anim: 'phone', status: 'chat' });
}

/* ---- dəyirmi görüş otağı (cənub-qərb) ---- */
export const MEET_SEATS = [];
export const slideTex = canvasTex(640, 360, (g, w, h) => {
  g.fillStyle = '#f4f2ed'; g.fillRect(0, 0, w, h);
  g.fillStyle = C.ink; g.font = `600 40px ${FONT}`; g.fillText('Bu həftə', 40, 76);
  g.font = `400 24px ${FONT}`; g.fillStyle = '#4c4a44';
  ['Klinika: yeni xidmət kampaniyası', 'Mebel mağazası: yay endirimi', 'Restoranlar: çatdırılma menyusu', 'Tətbiq: oktyabr hesabatı'].forEach((t, i) => g.fillText('— ' + t, 44, 140 + i * 46));
});
export const PRESENT = { x: -18.6, z: 9.2, rot: PI / 2 };
{
  floorPatch(-16, 9.6, 8, 8.8, parquetTex, 1.6);
  steelGlass(-20, 5, -14.4, 5); steelGlass(-12, 7.4, -12, 14);
  rug(-15.6, 9.4, 4.6, 4.6, '#c9bfae');
  cyl(office, 1.25, 1.25, 0.05, C.oak, -15.4, 0.75, 9.4, 40); cyl(office, 0.12, 0.3, 0.73, C.iron, -15.4, 0.365, 9.4, 16);
  block(-16.7, 8.1, -14.1, 10.7, 0.1);
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * PI * 2 + 0.2, x = -15.4 + Math.sin(a) * 1.85, z = 9.4 + Math.cos(a) * 1.85;
    const rot = Math.atan2(-15.4 - x, 9.4 - z);
    MEET_SEATS.push({ x, z, rot, drop: -0.25 }); chair(x, z, rot, '#6b5a48'); addCost(x, z, 0.45, 5);
  }
  const tv = basicPlane(3.2, 1.8, slideTex); tv.position.set(-19.97, 1.8, 9.4); tv.rotation.y = PI / 2; office.add(tv);
  box(office, 0.06, 1.9, 3.3, '#141514', -19.99, 1.8, 9.4, 0.01, false);
  plant(-13, 13.2, 1, true);
}

/* ---- səs studiyası (şimal-şərq) ---- */
{
  const dark = M('#2f3a40', { o: 0.5, r: 0.1 });
  steelGlass(12, -14, 12, -8.2, 3.0, dark); steelGlass(13.8, -6.4, 20, -6.4, 3.0, dark);
  floorPatch(16, -10.3, 8, 7.4, parquetTex, 1.6);
  steelGlass(20, -14, 20, -6.4, 3.0, dark);
  const g = new THREE.Group(); g.position.set(16.5, 0, -11.5); office.add(g);
  box(g, 3.0, 0.05, 1.1, C.walnut, 0, 0.75, 0, 0.01);
  for (const sx of [-1, 1]) box(g, 0.06, 0.73, 1.0, C.iron, sx * 1.4, 0.365, 0, 0);
  const tex = canvasTex(384, 240, appScreen('daw', seeded(9)));
  const scr = SCREENS.composer = { tex, ctx: tex.userData.ctx, type: 'daw', w: 384, h: 240 };
  const m = monitor(g, 0, 0.775, -0.25, PI, 0.9, scr); m.userData.agentId = 'composer'; screenMeshes.push(m);
  const kb = new THREE.Group(); kb.position.set(0, 0.78, 0.12); g.add(kb);
  box(kb, 1.3, 0.05, 0.3, '#1b1b1b', 0, 0, 0, 0.01);
  for (let i = 0; i < 24; i++) box(kb, 0.048, 0.02, 0.19, '#efece6', -0.6 + i * 0.052, 0.03, 0.04, 0, false);
  for (const sx of [-1.2, 1.2]) box(g, 0.3, 0.48, 0.3, '#202120', sx, 1.02, -0.3, 0.02);
  SEATS.composer = { x: 16.5, z: -10.45, rot: PI, drop: -0.25 };
  chair(16.5, -10.45, PI, '#252625'); addCost(16.5, -10.45, 0.5, 5);
  block(14.9, -12.1, 18.1, -10.9, 0.12);
  const mic = new THREE.Group(); mic.position.set(13.2, 0, -12.8); office.add(mic);
  cyl(mic, 0.22, 0.22, 0.03, '#222', 0, 0.02, 0, 16); cyl(mic, 0.014, 0.014, 1.6, '#333', 0, 0.8, 0, 6); sph(mic, 0.07, '#777', 0, 1.65, 0, 10);
  block(12.9, -13.1, 13.5, -12.5, 0.1);
  POIS.push({ id: 'studio', x: 14.2, z: -8.6, rot: Math.atan2(16.5 - 14.2, -11.5 + 8.6), text: 'Jingle demosunu dinləyir', anim: 'idle', status: 'chat' });
}

/* ---- mətbəx adası (şərq) ---- */
{
  box(office, 0.7, 0.92, 7, C.sage, 19.6, 0.46, -1, 0.01); box(office, 0.74, 0.04, 7.04, '#2e2f2c', 19.6, 0.94, -1, 0.005);
  box(office, 0.45, 0.55, 0.4, '#262725', 19.6, 1.24, -3.6, 0.03);
  box(office, 0.9, 2.1, 0.8, '#e3e0d9', 19.5, 1.05, 3.2, 0.03);
  block(19.2, -4.5, 20, 3.7, 0.1);
  box(office, 3.6, 0.95, 1.1, C.oak, 15, 0.475, -1, 0.02); box(office, 3.7, 0.05, 1.2, '#efece6', 15, 0.97, -1, 0.01);
  cyl(office, 0.24, 0.15, 0.1, '#e9e4da', 15.6, 1.04, -1, 16); sph(office, 0.08, '#c8742f', 15.55, 1.12, -1.05, 8); sph(office, 0.08, '#8b9a3e', 15.68, 1.12, -0.95, 8);
  block(13.2, -1.55, 16.8, -0.45, 0.12);
  for (const sx of [13.9, 15, 16.1]) { cyl(office, 0.18, 0.18, 0.05, C.walnut, sx, 0.78, 0.15, 14); cyl(office, 0.025, 0.025, 0.76, C.iron, sx, 0.38, 0.15, 6); }
  POIS.push({ id: 'coffee1', x: 18.7, z: -3.6, rot: PI / 2, text: 'Qəhvə hazırlayır', anim: 'drink', status: 'break' });
  POIS.push({ id: 'coffee2', x: 18.7, z: -1, rot: PI / 2, text: 'Çay dəmləyir', anim: 'drink', status: 'break' });
  POIS.push({ id: 'fruit', x: 15.6, z: -2.2, rot: 0, text: 'Meyvə götürür', anim: 'idle', status: 'break' });
  POIS.push({ id: 'bar1', x: 13.9, z: 0.4, rot: PI, drop: -0.1, text: 'Çay üstündə söhbət', anim: 'talk', status: 'break' });
  POIS.push({ id: 'bar2', x: 16.1, z: 0.4, rot: PI, drop: -0.1, text: 'Qısa fasilə', anim: 'drink', status: 'break' });
  POIS.push({ id: 'fridge', x: 18.6, z: 3.2, rot: PI / 2, text: 'Soyuducuya baxır', anim: 'idle', status: 'break' });
}

/* ---- launj (cənub-şərq) ---- */
{
  floorPatch(15.8, 9.8, 8.4, 8.4, parquetTex, 1.6);
  rug(15.6, 10, 6, 4.4, '#c9bfae');
  const sc = C.blue;
  const sofa = new THREE.Group(); sofa.position.set(15.6, 0, 12.9); office.add(sofa);
  box(sofa, 4.8, 0.4, 1.1, sc, 0, 0.2, 0, 0.06); box(sofa, 4.8, 0.8, 0.28, sc, 0, 0.42, 0.45, 0.06);
  for (const sx of [-2.4, 2.4]) box(sofa, 0.28, 0.6, 1.2, sc, sx, 0.3, 0.05, 0.06);
  for (const cx of [-1.5, 0, 1.5]) box(sofa, 1.4, 0.12, 0.9, '#46647c', cx, 0.46, -0.1, 0.04);
  block(13.1, 12.3, 18.1, 13.6, 0.1);
  box(office, 1.8, 0.06, 0.9, C.walnut, 15.6, 0.42, 10.4, 0.01);
  for (const sx of [-0.8, 0.8]) cyl(office, 0.03, 0.03, 0.4, C.iron, 15.6 + sx, 0.2, 10.4, 6);
  block(14.7, 9.95, 16.5, 10.85, 0.12);
  for (const [x, rot] of [[12.6, PI / 2], [18.6, -PI / 2]]) {
    const ac = new THREE.Group(); ac.position.set(x, 0, 9.6); ac.rotation.y = rot; office.add(ac);
    box(ac, 1.0, 0.4, 0.9, C.terracotta, 0, 0.2, 0, 0.06); box(ac, 1.0, 0.66, 0.22, C.terracotta, 0, 0.5, -0.38, 0.05);
    block(x - 0.5, 9.1, x + 0.5, 10.1, 0.05);
  }
  [[14.1, 12.25], [15.6, 12.25], [17.1, 12.25]].forEach(([x, z], i) => POIS.push({ id: 'sofa' + i, x, z, rot: PI, drop: -0.32, text: pick(['Divanda fikirləşir', 'Telefonda trendlərə baxır', 'Podkast dinləyir']), anim: 'phone', status: 'break' }));
  POIS.push({ id: 'arm1', x: 13.3, z: 9.6, rot: PI / 2, drop: -0.32, text: 'Jurnal vərəqləyir', anim: 'phone', status: 'break' });
  POIS.push({ id: 'arm2', x: 17.9, z: 9.6, rot: -PI / 2, drop: -0.32, text: 'Eskiz dəftərinə çəkir', anim: 'think', status: 'break' });
  plant(19.2, 13.2, 1.1, true); plant(12.2, 13.2, 0.9);
}

/* ---- şimal divarının ortası: mantar lövhə, ekran, agentliyin adı ---- */
export const kanbanTex = canvasTex(1024, 446, () => {});
const kanban = basicPlane(4.8, 2.1, kanbanTex); kanban.position.set(-3, 1.8, -14.08); office.add(kanban);
box(office, 5.0, 2.3, 0.05, C.oak, -3, 1.8, -14.11, 0.01, false);
export const dashTex = canvasTex(1024, 444, () => {});
const dash = basicPlane(4.6, 2.0, dashTex); dash.position.set(3, 1.9, -14.05); office.add(dash);
box(office, 4.75, 2.15, 0.08, '#141514', 3, 1.9, -14.11, 0.01, false);
wallText(WORLD.company.toUpperCase(), 0, 3.55, -14.08, 0, 5.2, 72);
// launjun arxasında kitab rəfi
{
  const sh = new THREE.Group(); sh.position.set(8.6, 0, 13.6); office.add(sh);
  box(sh, 3.0, 2.0, 0.4, C.oak, 0, 1.0, 0, 0.01);
  const R = seeded(13), spines = ['#7a3e33', '#36546b', '#c9b48a', '#2f3640', '#8a7a62', '#e1dbcf'];
  for (let s = 0; s < 3; s++) for (let i = 0; i < 10; i++) { if (R() < 0.25) continue; box(sh, 0.1 + R() * 0.06, 0.3 + R() * 0.12, 0.26, spines[(i + s) % 6], -1.3 + i * 0.27, 0.36 + s * 0.56, -0.06, 0.005); }
  block(7.1, 13.4, 10.1, 13.9, 0.1);
}
// printer və su
box(office, 0.9, 0.85, 0.65, '#dedad2', -11, 0.425, 13.4, 0.03); box(office, 0.6, 0.04, 0.4, '#2a2b2a', -11, 0.87, 13.4, 0.005);
block(-11.45, 13.07, -10.55, 13.73, 0.12);
cyl(office, 0.22, 0.22, 0.95, '#eeebe5', 11.4, 0.475, -13.4, 16); cyl(office, 0.17, 0.15, 0.5, '#bcd6dc', 11.4, 1.2, -13.4, 16).material = M('#bcd6dc', { o: 0.7 });
block(11.1, -13.7, 11.7, -13.1, 0.12);

POIS.push({ id: 'printer', x: -11, z: 12.5, rot: 0, text: 'Maketləri çap edir', anim: 'idle', status: 'work' });
POIS.push({ id: 'water', x: 11.4, z: -12.5, rot: PI, text: 'Su içir', anim: 'drink', status: 'break' });
POIS.push({ id: 'board1', x: -4.2, z: -12.7, rot: PI, text: 'Lövhədə tapşırıqlara baxır', anim: 'think', status: 'think' });
POIS.push({ id: 'board2', x: -1.8, z: -12.7, rot: PI, text: 'Lövhəyə qeyd yapışdırır', anim: 'present', status: 'think' });
POIS.push({ id: 'screen1', x: 2.2, z: -12.6, rot: PI, text: 'Ekrandakı rəqəmlərə baxır', anim: 'think', status: 'think' });
POIS.push({ id: 'screen2', x: 3.8, z: -12.6, rot: PI, text: 'Rəqəmləri müzakirə edir', anim: 'talk', status: 'chat' });
POIS.push({ id: 'books', x: 8.6, z: 12.7, rot: PI, text: 'Rəfdən kitab götürür', anim: 'idle', status: 'break' });
POIS.push({ id: 'cmo1', x: -16.7, z: -9.6, rot: PI, drop: -0.25, text: 'Elvinlə müzakirə', anim: 'talk', status: 'chat' });
POIS.push({ id: 'cmo2', x: -15.3, z: -9.6, rot: PI, drop: -0.25, text: 'Elvinə iş göstərir', anim: 'talk', status: 'chat' });
for (const [i, x] of [[0, -10.5], [1, 10.5]]) POIS.push({ id: 'win' + i, x, z: -12.8, rot: PI, text: 'Pəncərədən baxır', anim: 'drink', status: 'break' });

// bitkilər: pəncərə boyu və künclərdə
[[-7, -13.3, 1, true], [7, -13.3, 1, true], [-19.2, 2.6, 1, true], [-19.2, -5.4], [11, 4.4, 1, true], [-9.6, 13.2], [5.8, 13.2, 1, true], [11, -5.4]]
  .forEach(([x, z, s, tall], i) => plant(x, z, s || 0.85 + (i % 3) * 0.1, !!tall));
