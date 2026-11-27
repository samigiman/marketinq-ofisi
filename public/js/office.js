// Ofis: köhnə sənaye binasında açıq loft. Cilalanmış beton, çuqun sütunlar, şimal divarı boyu fabrik pəncərələri.
// Mərkəzdə dörd uzun ortaq masa (şöbələr), qərbdə Elvinin otağı, telefon kabinələri və dəyirmi görüş otağı,
// şərqdə səs studiyası, mətbəx adası və launj, cənub divarında lövhə, ekran və kitab rəfi.
// Koordinatlar naviqasiya ilə bağlıdır: oturacaq və fasilə yerləri buradan gəlir. Otaq: x -20..20, z -14..14.
import { THREE, office, M, box, cyl, sph, canvasTex, basicPlane, FONT } from './kit.js';
import { block, unblock, addCost } from './nav.js';
import { PI, pick, seeded, hash } from './util.js';
import { DEPTS, TEAM, WORLD } from '../team.js';
import { K, kenneyReady, footprint } from './kenney.js';
await kenneyReady; // mebel modelləri (Kenney Furniture Kit) hazır olmalıdır
// Kenney modellərinin "üzü" bizim oxlarla uyğun gəlsin deyə düzəliş (radian)
const FIX = { chairDesk: PI, loungeSofa: PI, loungeChair: PI, desk: PI, bookcaseOpen: PI, kitchenCabinet: PI, kitchenFridge: PI, kitchenCoffeeMachine: PI, stoolBar: 0, tableCoffee: 0 };
// model qoy + keçilməz sahə
function KB(name, x, z, rot = 0, o = {}) { const m = K(P, name, x, z, rot + (FIX[name] || 0), o); if (o.block !== false) B(...footprint(name, x, z, rot, o.s || 1), o.pad ?? 0.08); return m; }

export const ROOM = { x0: -20, x1: 20, z0: -14, z1: 14 };

// Qurulan əşyanın hansı qrupa (mərhələyə) düşdüyü və keçilməz sahələrin reyestri: mərhələ dəyişəndə naviqasiya yenidən qurulur.
let P = office, BUILD_STAGE = 1;
const BLOCKS = []; // { r: [x0,z0,x1,z1,pad], stage, vis? }
const B = (x0, z0, x1, z1, pad = 0.2, vis = null) => { BLOCKS.push({ r: [x0, z0, x1, z1, pad], stage: BUILD_STAGE, vis }); block(x0, z0, x1, z1, pad); };

/* ---------------- palitra ---------------- */
export const C = {
  oak: '#b8936b', oakDark: '#8c6a4a', walnut: '#5b4232', iron: '#2b2d2f', steel: '#3a3d40',
  plaster: '#ece8e1', felt: '#5d6b74', feltDark: '#3f4a52', terracotta: '#b4643f', concrete: '#b9b3a8',
  leaf: '#4f6b48', leaf2: '#647f56', fabric: '#4b5157', sage: '#8fa39a', linen: '#d9d1c2', ink: '#2d2f2c', blue: '#36546b',
};
const leafM = M(C.leaf, { r: 0.9 }), leaf2M = M(C.leaf2, { r: 0.9 });

/* ---------------- teksturlar ---------------- */
const woodTex = canvasTex(1024, 1024, (g, w, h) => {
  g.fillStyle = '#8a6440'; g.fillRect(0, 0, w, h);
  const R = seeded(31), ph = 64;
  for (let y = 0; y < h; y += ph) {
    let x = -R() * 300;
    while (x < w) {
      const pw = 240 + R() * 300, l = R();
      g.fillStyle = `hsl(${26 + l * 7},${38 + l * 10}%,${44 + l * 12}%)`; g.fillRect(x + 1.5, y + 1.5, pw - 3, ph - 3);
      g.strokeStyle = 'rgba(60,35,15,.1)'; g.lineWidth = 1.2;
      for (let k = 0; k < 7; k++) { const yy = y + 5 + R() * (ph - 10); g.beginPath(); g.moveTo(x, yy); g.bezierCurveTo(x + pw * .3, yy + (R() - .5) * 6, x + pw * .7, yy + (R() - .5) * 6, x + pw, yy); g.stroke(); }
      x += pw;
    }
  }
});
woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping; woodTex.repeat.set(5, 3.5);
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
function chair(x, z, rot) { return K(P, 'chairDesk', x, z, rot + FIX.chairDesk); }
export function plant(x, z, s = 1, tall = false) {
  const m = K(P, tall ? 'pottedPlant' : pick(['plantSmall1', 'plantSmall2', 'plantSmall3']), x, z, (x * 7 + z * 3) % 6, { s: tall ? 1.5 * s : 2.2 * s });
  B(x - 0.3 * s, z - 0.3 * s, x + 0.3 * s, z + 0.3 * s, 0.1);
  return m;
}
function rug(x, z, w, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.015, d), M(color, { r: 1 }));
  m.position.set(x, 0.008, z); m.receiveShadow = true; P.add(m); return m;
}
function floorPatch(x, z, w, d, tex, rep, parent = P) {
  const t = tex.clone(); t.needsUpdate = true; t.repeat.set(w / rep, d / rep);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: t, roughness: 0.75 }));
  m.rotation.x = -PI / 2; m.position.set(x, 0.006, z); m.receiveShadow = true; parent.add(m);
}
function wallText(text, x, y, z, rotY, w, size = 64, color = '#34312b', parent = P) {
  const tex = canvasTex(1024, 180, (g, W, H) => { g.clearRect(0, 0, W, H); g.textAlign = 'center'; g.fillStyle = color; g.font = `600 ${size}px ${FONT}`; g.letterSpacing = '10px'; g.fillText(text, W / 2, H / 2 + size / 3); });
  const m = basicPlane(w, w * 180 / 1024, tex, true); m.position.set(x, y, z); m.rotation.y = rotY; parent.add(m);
}

/* İş yeri ortaq masada: monitor, klaviatura, kiçik əşyalar, stul. facing=+1 → işçi +z istiqamətinə baxır. */
// Hər masanın şəxsi əşyaları: yalnız sahibi işləyəndə görünür (boş masa təmizdir, monitor sönülüdür).
export const DESKS = {}; // id → { items: Group, draw: () => void }
const NOTE = ['#f3d36b', '#f2a7a0', '#a9d3b0', '#a8c6e8'];
function clutter(g, def, R) {
  const it = new THREE.Group(); g.add(it);
  const p = (geo, col, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, M(col)); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; it.add(m); return m; };
  // monitorun kənarında stikerlər
  for (let i = 0; i < 1 + (R() * 3 | 0); i++) p(new THREE.BoxGeometry(0.07, 0.07, 0.004), NOTE[i % 4], -0.36 + i * 0.08, 1.06 - (i % 2) * 0.09, 0.2, 0);
  // kağız yığını və dəftər
  for (let i = 0; i < 3 + (R() * 5 | 0); i++) p(new THREE.BoxGeometry(0.21, 0.004, 0.29), i % 3 ? '#f7f4ee' : '#ece6d8', 0.5, 0.778 + i * 0.005, -0.18, (R() - 0.5) * 0.2);
  p(new THREE.BoxGeometry(0.15, 0.015, 0.21), ['#36546b', '#7a3e33', '#3f5a4a', '#2f3640'][hash(def.id) % 4], -0.42, 0.785, -0.22, 0.3);
  p(new THREE.CylinderGeometry(0.006, 0.006, 0.14, 6), '#c9b48a', -0.38, 0.795, -0.2, 0).rotation.z = Math.PI / 2;
  // çərçivəli şəkil (ailə, pişik, dəniz)
  if (R() < 0.6) { const f = p(new THREE.BoxGeometry(0.13, 0.17, 0.015), '#3a2d22', 0.62, 0.86, 0.2, -0.4); f.rotation.x = -0.15; p(new THREE.BoxGeometry(0.1, 0.13, 0.004), ['#9cb8c9', '#d9b48a', '#a9c49b'][R() * 3 | 0], 0.615, 0.862, 0.19, -0.4).rotation.x = -0.15; }
  // masa lampası
  if (R() < 0.35) { p(new THREE.CylinderGeometry(0.06, 0.07, 0.02, 14), C.iron, -0.72, 0.78, 0.2); p(new THREE.CylinderGeometry(0.008, 0.008, 0.36, 6), C.iron, -0.72, 0.96, 0.2); p(new THREE.ConeGeometry(0.08, 0.1, 14, 1, true), C.iron, -0.66, 1.14, 0.2).rotation.z = 0.9; }
  // qəlyanaltı, su şüşəsi
  if (R() < 0.4) p(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 10), '#bcd6dc', 0.32, 0.87, 0.05);
  if (R() < 0.3) { p(new THREE.CylinderGeometry(0.07, 0.05, 0.04, 14), '#efece6', -0.5, 0.79, 0.05); for (let i = 0; i < 4; i++) p(new THREE.SphereGeometry(0.02, 8, 6), i % 2 ? '#c8742f' : '#8b9a3e', -0.5 + (i - 1.5) * 0.02, 0.815, 0.05); }
  // stulun arxasında pencək, yerdə çanta
  if (R() < 0.55) { const jc = ['#5a4a3a', '#2f3a44', '#7a3e33', '#4a5a4a'][R() * 4 | 0]; const j = p(new THREE.BoxGeometry(0.5, 0.42, 0.06), jc, 0, 0.82, -1.27); j.rotation.x = 0.12; }
  if (R() < 0.5) p(new THREE.BoxGeometry(0.32, 0.26, 0.14), ['#6b4a30', '#2a2c2e', '#8a7a62'][R() * 3 | 0], 0.45, 0.13, -1.05, 0.3);
  // şəxsi əşya: personajın xarakterinə görə
  const extra = { junior: () => p(new THREE.SphereGeometry(0.05, 10, 8), '#f2a7a0', 0.7, 0.83, -0.05), composer: () => p(new THREE.BoxGeometry(0.2, 0.03, 0.1), '#2a2a2a', 0.6, 0.79, -0.05),
    copy: () => { for (let i = 0; i < 3; i++) p(new THREE.BoxGeometry(0.16, 0.04, 0.23), ['#7a3e33', '#36546b', '#c9b48a'][i], -0.68, 0.8 + i * 0.042, 0.02, i * 0.2); },
    analyst: () => p(new THREE.BoxGeometry(0.1, 0.014, 0.07), '#1d1d1d', 0.25, 0.779, -0.28), artdir: () => { for (let i = 0; i < 5; i++) p(new THREE.CylinderGeometry(0.006, 0.006, 0.15, 6), ['#b4643f', '#36546b', '#e2b23a', '#3f5a4a', '#2a2a2a'][i], -0.6 + i * 0.02, 0.86, -0.02); } };
  extra[def.id]?.();
  return it;
}
function station(x, dz, facing, def) {
  const g = new THREE.Group(); g.position.set(x, 0, dz); g.rotation.y = facing > 0 ? 0 : PI; office.add(g);
  const R = seeded(hash(def.id));
  const tex = canvasTex(384, 240, appScreen(def.screen, R));
  const scr = SCREENS[def.id] = { tex, ctx: tex.userData.ctx, type: def.screen, w: 384, h: 240 };
  const dual = def.prop === 'dual';
  const work = new THREE.Group(); g.add(work); // monitor, klaviatura: yalnız işçi olanda
  const m1 = monitor(work, dual ? -0.38 : 0, 0.77, 0.22, dual ? 0.12 : 0, 0.82, scr); m1.userData.agentId = def.id; screenMeshes.push(m1);
  if (dual) { const m2 = monitor(work, 0.44, 0.77, 0.18, -0.26, 0.74, { tex: canvasTex(384, 240, appScreen(def.screen === 'dash' ? 'text' : 'dash', R)) }); m2.userData.agentId = def.id; screenMeshes.push(m2); }
  box(work, 0.46, 0.018, 0.15, '#2b2d2f', 0, 0.778, -0.15, 0.004);
  box(work, 0.06, 0.02, 0.1, '#2b2d2f', 0.34, 0.778, -0.15, 0.008);
  cyl(g, 0.042, 0.038, 0.1, pick([C.terracotta, '#f1ede6', C.sage, C.blue]), -0.68, 0.82, -0.08, 12);
  if (def.prop === 'tablet') box(g, 0.36, 0.014, 0.26, '#1f2120', 0.6, 0.776, -0.1, 0.01);
  if (def.prop === 'books') for (let i = 0; i < 4; i++) box(g, 0.26, 0.05, 0.19, ['#7a3e33', '#36546b', '#c9b48a', '#2f3640'][i], -0.68, 0.795 + i * 0.054, 0.22, 0.005).rotation.y = (i - 1.5) * 0.1;
  if (def.prop === 'phone') box(g, 0.07, 0.01, 0.14, '#111', 0.58, 0.775, -0.08, 0.004);
  if (def.prop === 'ring') { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 8, 28), new THREE.MeshBasicMaterial({ color: '#fff8e8', toneMapped: false })); ring.position.set(0.72, 1.18, 0.12); g.add(ring); cyl(g, 0.01, 0.01, 0.42, C.iron, 0.72, 0.97, 0.12, 6); }
  if (def.prop === 'camera') box(g, 0.22, 0.14, 0.13, '#1b1b1b', 0.66, 0.84, 0.12, 0.02);
  if (R() < 0.3) { cyl(g, 0.065, 0.055, 0.1, C.terracotta, 0.72, 0.82, 0.25, 10); sph(g, 0.09, leafM, 0.72, 0.93, 0.25, 8); }
  registerDesk(def, clutter(g, def, seeded(hash(def.id) + 7)), scr, R);
  const seat = { x, z: dz - facing * 1.0, rot: facing > 0 ? 0 : PI, drop: -0.25 };
  const ch = chair(seat.x, seat.z, seat.rot);
  Object.assign(DESKS[def.id], { work, chair: ch, g });
  return seat;
}

function registerDesk(def, items, scr, R) {
  const on = () => { appScreen(def.screen, seeded(hash(def.id)))(scr.ctx, scr.w, scr.h); scr.tex.needsUpdate = true; };
  const off = () => { scr.ctx.fillStyle = '#0f1110'; scr.ctx.fillRect(0, 0, scr.w, scr.h); scr.tex.needsUpdate = true; };
  DESKS[def.id] = { items, on, off, scr };
}
// masanı aktiv/boş et: əşyalar və monitor
export function setDesk(id, active) {
  const d = DESKS[id]; if (!d) return;
  d.items.visible = active; active ? d.on() : d.off(); d.scr.active = active;
  if (d.work) { d.g.visible = active; d.chair.visible = active; }
}


/* =====================================================================
   BİNA: üç mərhələ. Ofis komanda ilə böyüyür (bax docs/plans).
     1-ci mərhələ (≤7 nəfər):  x -20..-4,  z -2..14   — kiçik otaq
     2-ci mərhələ (≤13 nəfər): x -20..8,   z -14..14  — divar sökülür, yan otaqlar
     3-cü mərhələ (24-ə qədər): x -20..20, z -14..14  — bütün mərtəbə
   Kamera cənub-şərqdən baxır: cənub və şərq tərəfi açıq (alçaq kəsik divar), şimal və qərb tam divar.
===================================================================== */
export const STAGE = { cur: 1, targets: { 1: [-12, 0, 6], 2: [-6, 0, 0], 3: [0, 0, 0] }, dist: { 1: 22, 2: 32, 3: 46 } };
const S1 = new THREE.Group(), S2 = new THREE.Group(), S3 = new THREE.Group(), PART1 = new THREE.Group(), PART2 = new THREE.Group();
office.add(S1, S2, S3, PART1, PART2);
const STAGE_G = { 1: S1, 2: S2, 3: S3 };
const at = (g, n) => { P = g; BUILD_STAGE = n; };
const glass = new THREE.MeshPhysicalMaterial({ color: '#dfe8ea', transparent: true, opacity: 0.16, roughness: 0.05, depthWrite: false });
const wallH = 4.2;
function wall(x, z, w, d, h = wallH) {
  const t = plasterTex.clone(); t.needsUpdate = true; t.repeat.set(Math.max(w, d) / 4, h / 4);
  const m = box(P, w, h, d, new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }), x, h / 2, z, 0, false); m.receiveShadow = true;
  if (h > 1) box(P, w + 0.02, 0.12, d + 0.02, C.iron, x, 0.06, z, 0, false);
}
function floorRect(x0, z0, x1, z1) {
  const w = x1 - x0, d = z1 - z0, t = woodTex.clone(); t.needsUpdate = true; t.repeat.set(w / 8, d / 8);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
  m.rotation.x = -PI / 2; m.position.set((x0 + x1) / 2, 0.001, (z0 + z1) / 2); m.receiveShadow = true; P.add(m);
  box(P, w + 0.2, 0.4, d + 0.2, '#c9c2b6', (x0 + x1) / 2, -0.21, (z0 + z1) / 2, 0.02, false).receiveShadow = true;
}
function steelGlass(x0, z0, x1, z1, h = 3.0, mat = glass) {
  const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0);
  const g = new THREE.Group(); g.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); g.rotation.y = -ang; P.add(g);
  const p = new THREE.Mesh(new THREE.BoxGeometry(len, h, 0.04), mat); p.position.y = h / 2; g.add(p);
  box(g, len, 0.05, 0.07, C.iron, 0, h, 0, 0); box(g, len, 0.05, 0.07, C.iron, 0, 0.025, 0, 0); box(g, len, 0.03, 0.07, C.iron, 0, h * 0.7, 0, 0);
  for (let i = 0; i <= Math.ceil(len / 1.0); i++) box(g, 0.03, h, 0.07, C.iron, -len / 2 + Math.min(len, i * 1.0), h / 2, 0, 0);
  B(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), 0.22);
}
const skyMat = new THREE.MeshBasicMaterial({ color: '#e2eaec', toneMapped: false });
function factoryWindow(x, w, z = -14.1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); P.add(g);
  const H = 3.4, y0 = 0.6;
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, H), skyMat); pane.position.y = y0 + H / 2; g.add(pane);
  const f = (bw, bh, fx, fy) => box(g, bw, bh, 0.05, C.iron, fx, fy, 0.03, 0, false);
  f(w, 0.08, 0, y0); f(w, 0.08, 0, y0 + H);
  for (let i = 0; i <= 4; i++) f(0.04, H, -w / 2 + i * w / 4, y0 + H / 2);
  for (let j = 1; j < 5; j++) f(w, 0.03, 0, y0 + j * H / 5);
  box(g, w, y0, 0.3, C.plaster, 0, y0 / 2, 0, 0, false);
}
function poster(x, y, z, rotY, w, h, bg, title, sub, accent) {
  const tex = canvasTex(400, 560, (g, W, H) => {
    g.fillStyle = bg; g.fillRect(0, 0, W, H); g.fillStyle = accent; g.beginPath(); g.arc(W * 0.68, H * 0.36, 120, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(36, H * 0.62, W - 150, 10);
    g.fillStyle = '#fff'; g.font = `600 46px ${FONT}`; g.fillText(title, 36, H * 0.78); g.font = `400 24px ${FONT}`; g.fillText(sub, 36, H * 0.86);
  });
  const fr = box(P, rotY ? 0.03 : w + 0.06, h + 0.06, rotY ? w + 0.06 : 0.03, '#2a2420', x, y, z, 0, false);
  const m = basicPlane(w, h, tex); m.position.set(x + (rotY ? 0.02 : 0), y, z + (rotY ? 0 : 0.02)); m.rotation.y = rotY; P.add(m);
}
const lampMat = new THREE.MeshBasicMaterial({ color: '#fff2da', toneMapped: false });
function sofa(x, z, rot, w = 4.0) {
  const n = Math.max(1, Math.round(w / 1.9)), ux = Math.cos(rot), uz = -Math.sin(rot);
  for (let i = 0; i < n; i++) { const o = (i - (n - 1) / 2) * 1.9; K(P, 'loungeSofa', x + ux * o, z + uz * o, rot + FIX.loungeSofa); }
  K(P, 'pillowBlue', x - ux * (w / 2 - 0.5), z - uz * (w / 2 - 0.5), rot, { y: 0.45 });
}
function armchair(x, z, rot) { KB('loungeChair', x, z, rot); }
function shelf(x, z, rotY, w, seed, h = 2.0) {
  const n = Math.max(1, Math.round(w / 0.78)), ux = Math.cos(rotY), uz = -Math.sin(rotY);
  for (let i = 0; i < n; i++) { const o = (i - (n - 1) / 2) * 0.78; K(P, h < 1.5 ? 'bookcaseOpenLow' : 'bookcaseOpen', x + ux * o, z + uz * o, rotY + FIX.bookcaseOpen); }
  if (seeded(seed)() < 0.7) K(P, 'plantSmall2', x + ux * (w / 2 - 0.3), z + uz * (w / 2 - 0.3), 0, { y: h < 1.5 ? 0.95 : 1.72, s: 1.6 });
}

/* ---------------- uzun ortaq masalar ---------------- */
export const SEATS = {};
const defOf = id => TEAM.find(t => t.id === id);
const TABLES = [], SLOTS = [];
function table(cx, z, n, stage) {
  const L = n * 1.5 + 0.1;
  const tg = new THREE.Group(); tg.visible = false; P.add(tg);
  floorPatch(cx, z, L + 2.6, 4.8, parquetTex, 1.6, tg);
  box(tg, L - 0.6, 0.06, 0.14, C.iron, cx, 3.3, z, 0.01, false);
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(L - 0.7, 0.08), lampMat); strip.rotation.x = PI / 2; strip.position.set(cx, 3.265, z); tg.add(strip);
  for (const sx of [-1, 1]) cyl(tg, 0.005, 0.005, 0.9, C.iron, cx + sx * (L / 2 - 0.6), 3.75, z, 4, false);
  const T = { tg, stage, rect: [cx - L / 2, z - 1.08, cx + L / 2, z + 1.08], slots: [] };
  BLOCKS.push({ r: [...T.rect, 0.12], stage, vis: () => T.tg.visible });
  for (let i = 0; i < n * 2; i++) {
    const side = i % 2 ? -1 : 1, k = i >> 1, x = cx + (k - (n - 1) / 2) * 1.5;
    K(tg, 'desk', x, z - side * 0.54, (side > 0 ? 0 : PI) + FIX.desk); // hər yerin öz masası (Kenney)
    const spare = new THREE.Group(); spare.position.set(x, 0, z - side * 0.48); spare.rotation.y = side > 0 ? 0 : PI; tg.add(spare);
    const RS = seeded(TABLES.length * 17 + i + 3), kind = RS() * 4 | 0;
    const sp = (geo, col, px, py, pz, ry = 0) => { const m = new THREE.Mesh(geo, M(col)); m.position.set(px, py, pz); m.rotation.y = ry; m.castShadow = true; spare.add(m); return m; };
    if (kind === 0) { sp(new THREE.BoxGeometry(0.34, 0.02, 0.24), '#b9bcc0', 0, 0.785, 0, 0.3); sp(new THREE.CylinderGeometry(0.04, 0.035, 0.09, 10), '#f1ede6', 0.3, 0.82, 0.1); }
    if (kind === 1) { cyl(spare, 0.12, 0.1, 0.2, C.terracotta, 0, 0.87, 0.05, 12); sph(spare, 0.17, leafM, 0, 1.05, 0.05, 10).scale.set(1, 0.8, 1); }
    if (kind === 2) for (let j = 0; j < 4; j++) sp(new THREE.BoxGeometry(0.22, 0.012, 0.3), ['#e2b23a', '#36546b', '#f1ede6', '#7a3e33'][j], (j - 1.5) * 0.06, 0.785 + j * 0.013, 0, j * 0.25);
    if (kind === 3) sp(new THREE.BoxGeometry(0.4, 0.26, 0.3), '#b8936b', 0, 0.9, 0.05, 0.1);
    const slot = { table: T, x, dz: z - side * 0.48, side, spare, who: null };
    T.slots.push(slot); SLOTS.push(slot);
  }
  TABLES.push(T);
}

/* ---------------- fasilə yerləri (hər birinin mərhələsi var) ---------------- */
export const POIS = [];
const poi = o => POIS.push({ stage: BUILD_STAGE, ...o });
export const poiOpen = p => p.stage <= STAGE.cur;

/* =============== 1-ci mərhələ: kiçik otaq =============== */
at(S1, 1);
floorRect(-20, -2, -4, 14);
// qərb divarı (cənub hissəsi) və cənubda alçaq kəsik divar
wall(-20.15, 6, 0.3, 16.3);
wall(-12, 14.15, 16.3, 0.3, 0.25);
// qərb divarında: lövhə, ad, ekran, təqvim, saat, afişa
export const kanbanTex = canvasTex(1024, 446, () => {});
{ const k = basicPlane(4.4, 1.92, kanbanTex); k.position.set(-19.97, 1.85, 0.9); k.rotation.y = PI / 2; P.add(k); box(P, 0.05, 2.1, 4.6, C.oak, -20.0, 1.85, 0.9, 0.01, false); }
wallText(WORLD.company.toUpperCase(), -19.97, 3.55, 3.2, PI / 2, 4.6, 72);
export const dashTex = canvasTex(1024, 444, () => {});
{ const d = basicPlane(3.4, 1.48, dashTex); d.position.set(-19.95, 1.95, 12.2); d.rotation.y = PI / 2; P.add(d); box(P, 0.08, 1.6, 3.55, '#141514', -20.0, 1.95, 12.2, 0.01, false); }
poster(-19.97, 2.0, 5.2, PI / 2, 0.8, 1.12, '#36546b', 'Çatdırılma', 'restoranlar · 2020', '#e2b23a');
{
  const cal = canvasTex(300, 400, (g, W, H) => { g.fillStyle = '#fbfaf7'; g.fillRect(0, 0, W, H); g.fillStyle = '#7a3e33'; g.fillRect(0, 0, W, 70); g.fillStyle = '#fff'; g.font = `600 34px ${FONT}`; g.fillText('Noyabr', 24, 48);
    g.fillStyle = '#5d635f'; g.font = `400 22px ${FONT}`; for (let i = 0; i < 30; i++) g.fillText(String(i + 1), 18 + (i % 7) * 40, 110 + Math.floor(i / 7) * 52);
    g.strokeStyle = '#b42318'; g.lineWidth = 3; g.beginPath(); g.arc(228, 258, 20, 0, 7); g.stroke(); });
  const cm = basicPlane(0.5, 0.66, cal); cm.position.set(-19.96, 1.9, 6.4); cm.rotation.y = PI / 2; P.add(cm);
}
// mətbəx küncü: qərb divarı boyu
for (let i = 0; i < 4; i++) KB(i === 3 ? 'kitchenSink' : 'kitchenCabinet', -19.55, 7.55 + i * 0.84, -PI / 2, { block: false });
K(P, 'kitchenCoffeeMachine', -19.55, 7.6, -PI / 2 + FIX.kitchenCoffeeMachine, { y: 0.88 });
K(P, 'kitchenMicrowave', -19.55, 9.3, -PI / 2, { y: 0.88 });
KB('kitchenFridge', -19.55, 11.1, -PI / 2, { block: false });
K(P, 'kitchenCabinetUpper', -19.75, 8.4, -PI / 2, { y: 1.75 }); K(P, 'kitchenCabinetUpper', -19.75, 9.25, -PI / 2, { y: 1.75 });
B(-20, 7.1, -19.05, 11.6, 0.05);
KB('tableRound', -16.6, 9.0, 0, { pad: 0.05 });
K(P, 'stoolBar', -17.6, 9.0, PI / 2); K(P, 'stoolBar', -15.6, 9.0, -PI / 2);
poi({ id: 'coffee', x: -18.9, z: 7.8, rot: -PI / 2, text: 'Qəhvə hazırlayır', anim: 'drink', status: 'break' });
poi({ id: 'tea', x: -18.9, z: 9.5, rot: -PI / 2, text: 'Çay dəmləyir', anim: 'drink', status: 'break' });
poi({ id: 'kt1', x: -17.5, z: 9.0, rot: PI / 2, drop: -0.1, text: 'Çay üstündə söhbət', anim: 'talk', status: 'break' });
poi({ id: 'kt2', x: -15.7, z: 9.0, rot: -PI / 2, drop: -0.1, text: 'Qısa fasilə', anim: 'drink', status: 'break' });
// Elvinin şüşə otağı (1-ci mərhələnin şimal-şərq küncü)
floorPatch(-6.75, 0.75, 5.5, 5.5, parquetTex, 1.6);
steelGlass(-9.5, -2, -9.5, 2.0); steelGlass(-9.5, 3.5, -5.6, 3.5);
{
  const g = new THREE.Group(); g.position.set(-6.75, 0, 0.6); P.add(g);
  box(g, 2.2, 0.05, 1.0, C.walnut, 0, 0.75, 0, 0.01); for (const sx of [-1, 1]) box(g, 0.06, 0.73, 0.9, C.iron, sx * 1.0, 0.365, 0, 0);
  const tex = canvasTex(384, 240, appScreen('dash', seeded(1)));
  const scr = SCREENS.cmo = { tex, ctx: tex.userData.ctx, type: 'dash', w: 384, h: 240 };
  const m = monitor(g, 0, 0.775, 0.25, 0, 0.9, scr); m.userData.agentId = 'cmo'; screenMeshes.push(m);
  registerDesk(defOf('cmo'), clutter(g, defOf('cmo'), seeded(5)), scr);
  SEATS.cmo = { x: -6.75, z: -0.45, rot: 0, drop: -0.25 }; chair(-6.75, -0.45, 0, '#2b2c2a'); addCost(-6.75, -0.45, 0.5, 5);
  B(-7.9, 0.1, -5.6, 1.1, 0.12);
  chair(-7.4, 2.2, PI, '#6b5a48'); chair(-6.1, 2.2, PI, '#6b5a48');
  shelf(-8.9, 1.8, PI / 2, 2.4, 7, 1.8); B(-9.3, 0.6, -8.7, 3.0, 0.05);
  poi({ id: 'cmo1', x: -7.4, z: 2.2, rot: PI, drop: -0.25, text: 'Elvinlə müzakirə', anim: 'talk', status: 'chat' });
  poi({ id: 'cmo2', x: -6.1, z: 2.2, rot: PI, drop: -0.25, text: 'Elvinə iş göstərir', anim: 'talk', status: 'chat' });
}
// birinci masa
table(-14.5, 3.2, 3, 1);
// ağ lövhə
{
  const wb = new THREE.Group(); wb.position.set(-11, 0, 7.6); wb.rotation.y = -0.3; P.add(wb);
  const tex = canvasTex(600, 400, (g, W, H) => {
    g.fillStyle = '#fbfbf8'; g.fillRect(0, 0, W, H); g.lineWidth = 4; g.lineCap = 'round';
    g.fillStyle = '#36546b'; g.font = `500 30px ${FONT}`; g.fillText('Novruz: ideyalar', 30, 50);
    g.strokeStyle = '#b4643f'; g.beginPath(); g.arc(150, 200, 70, 0, 7); g.stroke(); g.beginPath(); g.moveTo(220, 200); g.lineTo(330, 160); g.stroke();
    g.fillStyle = '#2b2d2f'; g.font = `400 24px ${FONT}`; ['səməni → yenilənmə', 'tonqal gecəsi?', 'şəkərbura qutusu'].forEach((t, i) => g.fillText('— ' + t, 340, 150 + i * 40));
  });
  box(wb, 1.9, 1.3, 0.04, '#dcd8cf', 0, 1.45, 0, 0.01);
  const sc = basicPlane(1.82, 1.22, tex); sc.position.set(0, 1.45, 0.025); wb.add(sc);
  for (const sx of [-0.85, 0.85]) { box(wb, 0.04, 1.4, 0.04, C.iron, sx, 0.7, 0, 0); box(wb, 0.05, 0.04, 0.5, C.iron, sx, 0.05, 0, 0); }
  B(-12, 7.2, -10, 8.0, 0.1);
  poi({ id: 'wb', x: -11.3, z: 8.6, rot: PI - 0.3, text: 'Ağ lövhəyə ideya yazır', anim: 'present', status: 'think' });
}
// divan küncü (cənub-şərq)
floorPatch(-7.5, 11.6, 6.4, 4.4, parquetTex, 1.6);
rug(-7.8, 11.4, 4.6, 3.2, '#c9bfae');
sofa(-8.2, 13.1, 0, 3.6); B(-10.1, 12.6, -6.3, 13.7, 0.05);
KB('tableCoffee', -8.2, 11.5, 0);
armchair(-5.2, 11.2, -PI / 2);
[[-9.4, 12.5], [-8.2, 12.5], [-7.0, 12.5]].forEach(([x, z], i) => poi({ id: 'sofa' + i, x, z, rot: PI, drop: -0.32, text: ['Divanda fikirləşir', 'Telefonda trendlərə baxır', 'Podkast dinləyir'][i], anim: 'phone', status: 'break' }));
poi({ id: 'arm1', x: -5.5, z: 11.2, rot: -PI / 2, drop: -0.32, text: 'Jurnal vərəqləyir', anim: 'phone', status: 'break' });
// döşəmə lampası
KB('lampRoundFloor', -4.8, 13.3, 0);
K(P, 'radio', -8.6, 11.5, 0.3, { y: 0.46 });
// pişik yatağı
export const CAT_BED = { x: -11.6, z: 12.9 };
{
  const bed = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.1, 10, 24), M('#a5583a', { r: 1 })); bed.rotation.x = -PI / 2; bed.position.set(CAT_BED.x, 0.08, CAT_BED.z); bed.castShadow = true; P.add(bed);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.04, 20), M('#e9dcc6', { r: 1 })); pad.position.set(CAT_BED.x, 0.03, CAT_BED.z); P.add(pad);
  cyl(P, 0.09, 0.08, 0.05, '#36546b', CAT_BED.x + 0.6, 0.025, CAT_BED.z - 0.1, 14);
}
// giriş: döşəkçə, asılqan, çətir
{
  const mat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.012, 1.1), M('#6b5a48', { r: 1 })); mat.position.set(-14, 0.006, 13.3); mat.receiveShadow = true; P.add(mat);
  KB('coatRackStanding', -16.4, 13.4, 0); K(P, 'trashcan', -17.3, 13.5, 0, { s: 0.7 });
  B(-17.5, 13.1, -16.1, 13.8, 0.05);
}
// printer
box(P, 0.9, 0.85, 0.65, '#dedad2', -12, 0.425, -1.4, 0.03); box(P, 0.6, 0.04, 0.4, '#2a2b2a', -12, 0.87, -1.4, 0.005); B(-12.45, -1.73, -11.55, -1.07, 0.12);
poi({ id: 'printer', x: -12, z: -0.6, rot: PI, text: 'Maketləri çap edir', anim: 'idle', status: 'work' });
poi({ id: 'board1', x: -18.8, z: 0.2, rot: -PI / 2, text: 'Lövhədə tapşırıqlara baxır', anim: 'think', status: 'think' });
poi({ id: 'board2', x: -18.8, z: 1.8, rot: -PI / 2, text: 'Lövhəyə qeyd yapışdırır', anim: 'present', status: 'think' });
poi({ id: 'screen1', x: -18.7, z: 12.0, rot: -PI / 2, text: 'Ekrandakı rəqəmlərə baxır', anim: 'think', status: 'think' });
[[-19.2, -1.2, 1, true], [-10.3, -1.3, 0.8], [-19.2, 4.6, 0.8], [-4.8, 10.0, 0.9, true], [-12.6, 13.3, 0.7]].forEach(([x, z, sc, tall]) => plant(x, z, sc, !!tall));

/* 1-ci mərhələnin müvəqqəti arakəsmələri: şimal divarı (z=-2) və şərqdə alçaq divar (x=-4) */
at(PART1, 1);
wall(-12, -2.15, 16.3, 0.3);
wall(-4.0, 6, 0.3, 16.3, 0.25);
poster(-14, 2.0, -1.98, 0, 0.8, 1.12, '#7a3e33', 'Yay endirimi', 'mebel mağazası · 2024', '#f2c9a0');
poster(-16.6, 2.0, -1.98, 0, 0.8, 1.12, '#3f5a4a', 'Sağlam bahar', 'klinika · 2025', '#e8a3a0');
{ const clk = canvasTex(256, 256, (g) => { g.fillStyle = '#f7f4ee'; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.fill(); g.strokeStyle = '#2b2d2f'; g.lineWidth = 10; g.stroke(); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.fillStyle = '#2b2d2f'; g.fillRect(128 + Math.sin(a) * 96 - 3, 128 - Math.cos(a) * 96 - 3, 6, 6); } });
  const c = basicPlane(0.6, 0.6, clk, true); c.position.set(-18.5, 3.1, -1.97); P.add(c); }

/* =============== 2-ci mərhələ: divar sökülür, yan otaqlar =============== */
at(S2, 2);
floorRect(-20, -14, 8, -2); floorRect(-4, -2, 8, 14);
wall(-20.15, -8, 0.3, 12.3);
wall(2, 14.15, 12.3, 0.3, 0.25);
for (const [x, w] of [[-16.5, 5.0], [-10, 5.0], [-3.5, 5.0], [3, 5.0]]) factoryWindow(x, w);
for (const x of [-19.7, -13.25, -6.75, -0.25, 5.75, 7.85]) box(P, 0.6, wallH, 0.4, C.plaster, x, wallH / 2, -14.1, 0, false);
box(P, 28.4, 0.6, 0.4, C.plaster, -6, wallH - 0.3, -14.1, 0, false);
// sökülən divarın yerində çuqun sütunlar
for (const [x, z] of [[-4, -2], [-4, 6], [-12, -2]]) { cyl(P, 0.16, 0.18, wallH, C.iron, x, wallH / 2, z, 16); cyl(P, 0.26, 0.26, 0.12, C.iron, x, wallH - 0.06, z, 16); B(x - 0.2, z - 0.2, x + 0.2, z + 0.2, 0.1); }
// Elvinin otağına şimal və şərq şüşəsi
steelGlass(-9.5, -2, -4, -2); steelGlass(-4, -2, -4, 3.5);
// dəyirmi görüş otağı (şimal-qərb)
export const slideTex = canvasTex(640, 360, (g, w, h) => {
  g.fillStyle = '#f4f2ed'; g.fillRect(0, 0, w, h); g.fillStyle = C.ink; g.font = `600 40px ${FONT}`; g.fillText('Bu həftə', 40, 76);
  g.font = `400 24px ${FONT}`; g.fillStyle = '#4c4a44';
  ['Klinika: yeni xidmət kampaniyası', 'Mebel mağazası: yay endirimi', 'Restoranlar: çatdırılma menyusu', 'Tətbiq: oktyabr hesabatı'].forEach((t, i) => g.fillText('— ' + t, 44, 140 + i * 46));
});
const MEET2 = [];
{
  floorPatch(-16.5, -10.5, 7, 7, parquetTex, 1.6);
  steelGlass(-20, -7, -15, -7); steelGlass(-13, -14, -13, -9);
  rug(-16.5, -10.5, 4.4, 4.4, '#c9bfae');
  cyl(P, 1.2, 1.2, 0.05, C.oak, -16.5, 0.75, -10.5, 40); cyl(P, 0.12, 0.3, 0.73, C.iron, -16.5, 0.365, -10.5, 16); B(-17.7, -11.7, -15.3, -9.3, 0.1);
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * PI * 2 + 0.2, x = -16.5 + Math.sin(a) * 1.8, z = -10.5 + Math.cos(a) * 1.8;
    const rot = Math.atan2(-16.5 - x, -10.5 - z);
    MEET2.push({ x, z, rot, drop: -0.25 }); chair(x, z, rot, '#6b5a48'); addCost(x, z, 0.45, 5);
  }
  const tv = basicPlane(3.0, 1.7, slideTex); tv.position.set(-19.97, 1.8, -10.5); tv.rotation.y = PI / 2; P.add(tv);
  box(P, 0.06, 1.8, 3.1, '#141514', -19.99, 1.8, -10.5, 0.01, false);
}
// telefon kabinələri (x=7 boyunca, qapısı qərbə baxır)
for (const [i, z] of [[0, -12.4], [1, -9.6]]) {
  const g = new THREE.Group(); g.position.set(6.9, 0, z); g.rotation.y = PI; P.add(g);
  box(g, 1.9, 2.4, 0.08, C.feltDark, 0, 1.2, -1.2, 0.01); box(g, 1.9, 2.4, 0.08, C.feltDark, 0, 1.2, 1.2, 0.01); box(g, 1.9, 0.08, 2.48, C.feltDark, 0, 2.4, 0, 0.01);
  box(g, 0.5, 0.4, 0.9, C.felt, -0.55, 0.22, 0, 0.04);
  const dg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.3, 2.3), glass); dg.position.set(0.95, 1.15, 0); g.add(dg);
  B(5.95, z - 1.25, 7.85, z - 1.15, 0.05); B(5.95, z + 1.15, 7.85, z + 1.25, 0.05);
  poi({ id: 'booth' + i, x: 7.2, z, rot: PI / 2, drop: -0.35, text: 'Kabinədə telefonla danışır', anim: 'phone', status: 'chat' });
}
// ikinci masa və rəflər
table(2, 3.2, 3, 2);
shelf(-8.5, -13.6, 0, 3.6, 41); B(-10.3, -13.85, -6.7, -13.35, 0.05);
shelf(-1.5, -13.6, 0, 3.6, 43); B(-3.3, -13.85, 0.3, -13.35, 0.05);
poi({ id: 'books', x: -8.5, z: -12.7, rot: PI, text: 'Rəfdən kitab götürür', anim: 'idle', status: 'break' });
poi({ id: 'win1', x: -3.5, z: -12.6, rot: PI, text: 'Pəncərədən baxır', anim: 'drink', status: 'break' });
// ikinci divan küncü
sofa(2.0, 13.1, 0, 3.6, '#3f5a4a'); B(0.1, 12.6, 3.9, 13.7, 0.05);
[[0.8, 12.5], [2.0, 12.5], [3.2, 12.5]].forEach(([x, z], i) => poi({ id: 'sofb' + i, x, z, rot: PI, drop: -0.32, text: ['Kofe ilə dincəlir', 'Qeydlərinə baxır', 'Telefonda danışır'][i], anim: i === 2 ? 'phone' : 'drink', status: 'break' }));
poster(-19.97, 2.0, -4.4, PI / 2, 0.8, 1.12, '#2f3640', 'Tətbiq 2.0', 'mobil tətbiq · 2025', '#8fc7a6');
[[-11.2, -13.3, 1, true], [-5, -6, 0.9], [7.2, 6.5, 1, true], [-1.5, -6.5, 0.8], [6.8, -3.8, 0.8]].forEach(([x, z, sc, tall]) => plant(x, z, sc, !!tall));

// 2-ci mərhələnin müvəqqəti şərq divarı (x=8, alçaq)
at(PART2, 2);
wall(8.0, 0, 0.3, 28.3, 0.25);

/* =============== 3-cü mərhələ: bütün mərtəbə =============== */
at(S3, 3);
floorRect(8, -14, 20, 14);
wall(14, 14.15, 12.3, 0.3, 0.25); wall(20.15, 0, 0.3, 28.6, 0.25);
for (const x of [11, 17]) factoryWindow(x, 5.0);
for (const x of [8.15, 13.95, 19.7]) box(P, 0.6, wallH, 0.4, C.plaster, x, wallH / 2, -14.1, 0, false);
box(P, 12.4, 0.6, 0.4, C.plaster, 14, wallH - 0.3, -14.1, 0, false);
for (const [x, z] of [[8, -6], [8, 6]]) { cyl(P, 0.16, 0.18, wallH, C.iron, x, wallH / 2, z, 16); B(x - 0.2, z - 0.2, x + 0.2, z + 0.2, 0.1); }
// səs studiyası (şimal-şərq)
{
  const dark = M('#2f3a40', { o: 0.5, r: 0.1 });
  floorPatch(16.5, -10.75, 7, 6.5, parquetTex, 1.6);
  steelGlass(13, -14, 13, -7.5, 3.0, dark); steelGlass(14.4, -7.5, 20, -7.5, 3.0, dark);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) box(P, 0.9, 0.6, 0.06, (i + j) % 2 ? C.felt : C.feltDark, 15 + i * 1.15, 1.0 + j * 0.7, -13.95, 0.02, false);
  const g = new THREE.Group(); g.position.set(16.5, 0, -11.2); P.add(g);
  box(g, 2.8, 0.05, 1.0, C.walnut, 0, 0.75, 0, 0.01); for (const sx of [-1, 1]) box(g, 0.06, 0.73, 0.9, C.iron, sx * 1.3, 0.365, 0, 0);
  const kb = new THREE.Group(); kb.position.set(0, 0.78, 0.1); g.add(kb); box(kb, 1.3, 0.05, 0.3, '#1b1b1b', 0, 0, 0, 0.01);
  for (let i = 0; i < 24; i++) box(kb, 0.048, 0.02, 0.19, '#efece6', -0.6 + i * 0.052, 0.03, 0.04, 0, false);
  for (const sx of [-1.1, 1.1]) K(g, 'speakerSmall', sx, -0.3, 0, { y: 0.78 }); K(P, 'speaker', 19.2, -13.2, 0); K(P, 'speaker', 13.8, -13.2, 0);
  box(g, 0.9, 0.5, 0.03, '#161716', 0, 1.33, -0.35, 0.01);
  B(15.1, -11.7, 17.9, -10.7, 0.12);
  const gt = new THREE.Group(); gt.position.set(19, 0, -9); gt.rotation.set(0, -0.6, 0.15); P.add(gt);
  const gb = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), M('#8a5a34')); gb.scale.set(1, 1.25, 0.35); gb.position.y = 0.42; gt.add(gb);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.85, 0.04), M('#3b2416')); neck.position.y = 1.05; gt.add(neck); B(18.7, -9.3, 19.3, -8.7, 0.05);
  chair(16.5, -10.0, PI, '#252625');
  poi({ id: 'studio', x: 16.5, z: -10.0, rot: PI, drop: -0.25, text: 'Studiyada jingle dinləyir', anim: 'idle', status: 'work' });
}
// iki masa
table(12.5, -3.0, 3, 3);
table(12.5, 3.4, 3, 3);
// mətbəx: şərq kənarında
for (let i = 0; i < 6; i++) K(P, i === 2 ? 'kitchenSink' : 'kitchenCabinet', 19.55, -5.2 + i * 0.84, PI / 2);
K(P, 'kitchenCoffeeMachine', 19.55, -4.6, PI / 2 + FIX.kitchenCoffeeMachine, { y: 0.88 }); K(P, 'toaster', 19.55, -2.8, PI / 2, { y: 0.88 });
K(P, 'kitchenFridgeLarge', 19.5, 0.2, PI / 2);
B(19.2, -5.7, 20, 0.7, 0.1);
poi({ id: 'coffee3', x: 18.8, z: -4.6, rot: PI / 2, text: 'Qəhvə hazırlayır', anim: 'drink', status: 'break' });
poi({ id: 'fridge', x: 18.7, z: 0.2, rot: PI / 2, text: 'Soyuducuya baxır', anim: 'idle', status: 'break' });
// böyük launj (cənub-şərq) və stolüstü tennis
{
  floorPatch(16.5, 10.5, 7, 7, parquetTex, 1.6);
  rug(16.5, 10.5, 5, 4, '#c9bfae');
  sofa(16.5, 13.1, 0, 4.4); B(14.2, 12.6, 18.8, 13.7, 0.05);
  KB('tableCoffeeGlass', 16.5, 10.8, 0); KB('lampSquareFloor', 19.2, 12.8, 0); K(P, 'televisionModern', 16.5, 8.1, PI, { y: 0 }); KB('cabinetTelevision', 16.5, 8.1, PI);
  armchair(13.6, 10.4, PI / 2); armchair(19.3, 10.4, -PI / 2);
  [[15.2, 12.5], [16.5, 12.5], [17.8, 12.5]].forEach(([x, z], i) => poi({ id: 'sofc' + i, x, z, rot: PI, drop: -0.32, text: ['Divanda yarı uzanıb', 'Telefonda trendlərə baxır', 'Kitab oxuyur'][i], anim: 'phone', status: 'break' }));
  poi({ id: 'arm3', x: 13.9, z: 10.4, rot: PI / 2, drop: -0.32, text: 'Eskiz dəftərinə çəkir', anim: 'think', status: 'break' });
  shelf(19.8, 7.5, -PI / 2, 2.6, 51); B(19.4, 6.2, 20, 8.8, 0.05);
  // stolüstü tennis
  const pg = new THREE.Group(); pg.position.set(11.2, 0, 10.2); P.add(pg);
  box(pg, 2.6, 0.05, 1.45, '#2f5d4c', 0, 0.76, 0, 0.01); box(pg, 0.02, 0.15, 1.5, '#efece6', 0, 0.85, 0, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(pg, 0.05, 0.74, 0.05, C.iron, sx * 1.1, 0.37, sz * 0.6, 0);
  B(9.9, 9.45, 12.5, 10.95, 0.1);
  poi({ id: 'pong1', x: 9.5, z: 10.2, rot: PI / 2, text: 'Stolüstü tennis oynayır', anim: 'talk', status: 'break' });
  poi({ id: 'pong2', x: 12.9, z: 10.2, rot: -PI / 2, text: 'Stolüstü tennis oynayır', anim: 'talk', status: 'break' });
}
poster(19.97, 2.0, 4.0, -PI / 2, 0.8, 1.12, '#36546b', 'Yeni il', 'onlayn mağaza · 2025', '#f2c9a0');
[[8.8, -13.3, 1, true], [19.2, 5.2, 0.9], [8.8, 13.2, 1, true], [10, -6.5, 0.8]].forEach(([x, z, sc, tall]) => plant(x, z, sc, !!tall));

/* ---------------- hər personajın iş yeri: bir dəfə qurulur, oturanda yerinə köçür ---------------- */
P = office; BUILD_STAGE = 1;
for (const t of TEAM) if (t.id !== 'cmo') { SEATS[t.id] = station(SLOTS[0].x, SLOTS[0].dz, 1, t); DESKS[t.id].g.visible = false; DESKS[t.id].chair.visible = false; }

/* ---------------- mərhələ: göstər, gizlət, naviqasiyanı yenidən qur ---------------- */
const VOID = { 1: [[-3.8, -14, 20, 14], [-20, -14, -3.8, -2.2]], 2: [[8.2, -14, 20, 14]], 3: [] };
function rebuildNav() {
  unblock(-20, -14, 20, 14, 0.5);
  for (const b of BLOCKS) if (b.stage <= STAGE.cur && (!b.vis || b.vis())) block(...b.r);
  for (const r of VOID[STAGE.cur]) block(...r, 0);
}
const anims = [];
function grow(g, on) { g.visible = true; anims.push({ g, t: 0, from: on ? 0.02 : 1, to: on ? 1 : 0.02, hide: !on }); }
export function updateOffice(dt) {
  for (let i = anims.length - 1; i >= 0; i--) {
    const a = anims[i]; a.t = Math.min(1, a.t + dt / 1.4);
    const e = 1 - Math.pow(1 - a.t, 3); a.g.scale.y = a.from + (a.to - a.from) * e;
    if (a.t >= 1) { if (a.hide) a.g.visible = false; a.g.scale.y = 1; anims.splice(i, 1); }
  }
}
export const stageFor = n => (n <= 7 ? 1 : n <= 13 ? 2 : 3); // n = işçi sayı (Elvin daxil)
export function setStage(n, animate = true) {
  if (n === STAGE.cur && S1.visible) return false;
  const prev = STAGE.cur; STAGE.cur = n;
  for (const k of [2, 3]) { const on = k <= n; if (on !== (STAGE_G[k].visible && STAGE_G[k].scale.y > 0.5)) animate ? grow(STAGE_G[k], on) : (STAGE_G[k].visible = on); }
  const p1 = n === 1, p2 = n === 2;
  if (p1 !== PART1.visible) animate ? grow(PART1, p1) : (PART1.visible = p1);
  if (p2 !== PART2.visible) animate ? grow(PART2, p2) : (PART2.visible = p2);
  // mərhələdən kənar masada oturanlar içəridəki boş yerə köçür
  for (const sl of SLOTS) if (sl.who && sl.table.stage > n) { const who = sl.who; sl.who = null; assignSeat(who); }
  refreshTables(); rebuildNav();
  return prev !== n;
}
S1.visible = true; S2.visible = false; S3.visible = false; PART1.visible = true; PART2.visible = false;

function refreshTables() {
  for (const T of TABLES) {
    const used = T.stage <= STAGE.cur && T.slots.some(s => s.who);
    if (used !== T.tg.visible) T.tg.visible = used;
    for (const s of T.slots) s.spare.visible = !s.who;
  }
}
// İşə götürüləndə: açıq mərhələdəki ilk boş yer. Oturacaq nöqtəsini qaytarır.
export function assignSeat(id) {
  if (!DESKS[id]?.g) return SEATS[id];
  let slot = SLOTS.find(s => s.who === id) || SLOTS.find(s => !s.who && s.table.stage <= STAGE.cur) || SLOTS.find(s => !s.who);
  if (!slot) return SEATS[id];
  slot.who = id;
  const d = DESKS[id], rot = slot.side > 0 ? 0 : PI;
  d.g.position.set(slot.x, 0, slot.dz); d.g.rotation.y = rot;
  const seat = SEATS[id]; Object.assign(seat, { x: slot.x, z: slot.dz - slot.side * 1.0, rot });
  d.chair.position.set(seat.x, 0, seat.z); d.chair.rotation.y = rot;
  addCost(seat.x, seat.z, 0.5, 5);
  refreshTables(); rebuildNav();
  return seat;
}
export const tableState = () => TABLES.map(T => T.tg.visible);
export function releaseSeat(id) {
  const slot = SLOTS.find(s => s.who === id); if (slot) slot.who = null;
  refreshTables(); rebuildNav();
}
// görüş yerləri: kiçik ofisdə divan küncü, böyüyəndə dəyirmi görüş otağı
export function meetingSpots() {
  if (STAGE.cur >= 2) return { seats: MEET2, present: { x: -19.1, z: -10.5, rot: PI / 2 } };
  return { seats: [[-9.4, 12.5, PI], [-8.2, 12.5, PI], [-7.0, 12.5, PI], [-5.5, 11.2, -PI / 2], [-10.6, 10.6, PI / 2], [-10.6, 11.8, PI / 2]].map(([x, z, rot], i) => ({ x, z, rot, drop: i < 4 ? -0.32 : null })), present: { x: -8.2, z: 10.0, rot: 0 } };
}
rebuildNav();
