// Sevimli personajlar: kodla qurulan yumru fiqurlar (iri baş, kapsul bədən, cizgi filmi kölgələməsi).
// Qaytarılan hissələr agents.js-in animasiyası ilə uyğundur: legL/legR və armL/armR çiyin-omba nöqtəsindən fırlanır,
// head başın altından, eyes göz qırpanda, mouth danışanda dəyişir.
import { THREE } from './kit.js';
import { hash } from './util.js';

export const FEMALE = new Set(['marketer', 'brand', 'artdir', 'junior', 'uiux', 'smm', 'smmcopy', 'strateg', 'pr', 'digital', 'crm']);
export const SKIRT = new Set(['brand', 'junior', 'pr', 'crm', 'strateg']);
export const BEARD = new Set(['cmo', 'composer', 'account', 'video']);
const SHORT_SLEEVES = new Set(['smm', 'video', 'community', 'motion']);
const PANTS = ['#2f3640', '#3b3a36', '#34495e', '#4a4136', '#283040', '#5b4a3a'];
const SHOES = ['#2a2523', '#5a4434', '#e9e4da', '#1f2124'];

// 3 pilləli cizgi kölgəsi
const grad = (() => { const d = new Uint8Array([90, 170, 255]); const t = new THREE.DataTexture(d, 3, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const cache = new Map();
export function toon(color, o = {}) {
  const k = color + JSON.stringify(o);
  if (!cache.has(k)) cache.set(k, new THREE.MeshToonMaterial({ color, gradientMap: grad, transparent: o.o != null, opacity: o.o ?? 1 }));
  return cache.get(k);
}
const add = (p, geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; p.add(m); return m;
};
const sphere = r => new THREE.SphereGeometry(r, 20, 14);
const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 6, 14);

export function buildCute(def, top) {
  const L = def.look, id = def.id, h = hash(id), fem = FEMALE.has(id);
  const root = new THREE.Group();
  const skin = toon(L.skin), hair = toon(L.hair), shirt = toon(top);
  const pants = toon(L.pants || PANTS[h % PANTS.length]), shoe = toon(SHOES[h % SHOES.length]);
  const hipY = 0.6;

  // ayaqlar
  const leg = x => {
    const p = new THREE.Group(); p.position.set(x, hipY, 0); root.add(p);
    add(p, capsule(0.085, 0.34), pants, 0, -0.26, 0);
    add(p, sphere(0.1), shoe, 0, -0.54, 0.04, 1.05, 0.6, 1.45);
    return p;
  };
  const legL = leg(0.1), legR = leg(-0.1);

  // bədən
  add(root, capsule(0.205, 0.28), shirt, 0, hipY + 0.3, 0, 1, 1, 0.85);
  if (SKIRT.has(id)) add(root, new THREE.CylinderGeometry(0.21, 0.31, 0.36, 20), pants, 0, hipY - 0.02, 0);
  else add(root, capsule(0.19, 0.04), pants, 0, hipY + 0.02, 0, 1.03, 1, 0.86); // kəmər/omba
  if (L.acc === 'tie') { add(root, new THREE.BoxGeometry(0.06, 0.26, 0.02), toon('#5a2a26'), 0, hipY + 0.42, 0.172); add(root, new THREE.BoxGeometry(0.16, 0.05, 0.02), toon('#f1ede6'), 0, hipY + 0.58, 0.165); }
  else add(root, new THREE.TorusGeometry(0.09, 0.022, 8, 20), shirt, 0, hipY + 0.6, 0.02, 1, 1, 1).rotation.x = Math.PI / 2; // yaxalıq

  // qollar: çiyindən asılır
  const short = SHORT_SLEEVES.has(id);
  const arm = x => {
    const p = new THREE.Group(); p.position.set(x, hipY + 0.52, 0); root.add(p);
    if (short) { add(p, capsule(0.068, 0.12), shirt, 0, -0.1, 0); add(p, capsule(0.058, 0.14), skin, 0, -0.27, 0); }
    else add(p, capsule(0.066, 0.3), shirt, 0, -0.2, 0);
    add(p, sphere(0.07), skin, 0, -0.43, 0.01);
    return p;
  };
  const armL = arm(0.255), armR = arm(-0.255);

  // baş
  const head = new THREE.Group(); head.position.set(0, hipY + 0.66, 0); root.add(head);
  add(head, new THREE.CylinderGeometry(0.06, 0.07, 0.1, 12), skin, 0, 0.02, 0);
  const C = 0.27; // başın mərkəzi
  add(head, sphere(0.26), skin, 0, C, 0, 1, 0.96, 0.95);
  for (const sx of [-1, 1]) add(head, sphere(0.05), skin, sx * 0.25, C - 0.01, 0, 0.5, 1, 0.8); // qulaqlar
  add(head, sphere(0.022), toon(new THREE.Color(L.skin).multiplyScalar(0.92).getStyle()), 0, C - 0.04, 0.25);
  // gözlər: qara, parlaq nöqtə ilə
  const eyes = [];
  for (const sx of [-1, 1]) {
    const e = new THREE.Group(); e.position.set(sx * 0.085, C + 0.02, 0.222); head.add(e);
    add(e, sphere(0.04), toon('#1d1b1a'), 0, 0, 0, 0.9, 1.2, 0.5);
    add(e, sphere(0.012), toon('#ffffff'), 0.012, 0.018, 0.02);
    eyes.push(e);
    add(head, capsule(0.011, 0.05), hair, sx * 0.088, C + 0.105, 0.228).rotation.z = Math.PI / 2 + sx * 0.12; // qaş
    add(head, sphere(0.034), toon('#e8a3a0', { o: 0.55 }), sx * 0.15, C - 0.06, 0.205, 1, 0.7, 0.4); // yanaq
  }
  const mouth = add(head, new THREE.TorusGeometry(0.028, 0.008, 6, 12, Math.PI), toon('#7a3e3a'), 0, C - 0.1, BEARD.has(id) ? 0.255 : 0.236);
  mouth.rotation.z = Math.PI; mouth.castShadow = false;

  // saç
  const cap = (r = 0.275, tilt = -0.32) => { const m = add(head, new THREE.SphereGeometry(r, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.52), hair, 0, C, -0.005); m.rotation.x = tilt; return m; };
  const style = L.style;
  if (style === 'cap') {
    const hat = toon('#3f4a44');
    add(head, new THREE.SphereGeometry(0.28, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), hat, 0, C + 0.01, 0).rotation.x = -0.15;
    add(head, new THREE.CylinderGeometry(0.17, 0.17, 0.02, 20, 1, false, -Math.PI / 2, Math.PI), hat, 0, C + 0.1, 0.17).rotation.x = 0.1;
  } else {
    cap();
    if (style === 'short') add(head, sphere(0.12), hair, 0.03, C + 0.2, 0.13, 1.6, 0.4, 0.8);
    if (style === 'long') {
      add(head, capsule(0.2, 0.22), hair, 0, C - 0.1, -0.11, 1.25, 1, 0.6);
      for (const sx of [-1, 1]) add(head, capsule(0.06, 0.24), hair, sx * 0.22, C - 0.07, 0.05);
      add(head, sphere(0.14), hair, -0.04, C + 0.19, 0.12, 1.5, 0.45, 0.7);
    }
    if (style === 'bun') { add(head, sphere(0.11), hair, 0, C + 0.27, -0.1); add(head, sphere(0.12), hair, 0, C + 0.19, 0.13, 1.6, 0.4, 0.7); }
    if (style === 'curly') for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; add(head, sphere(0.075), hair, Math.sin(a) * 0.2, C + 0.17 + Math.cos(a * 2) * 0.03, Math.cos(a) * 0.18 - 0.03); }
    if (fem && style === 'short') add(head, capsule(0.18, 0.08), hair, 0, C - 0.05, -0.12, 1.3, 1, 0.6); // qısa qadın saçı: arxadan bob
  }
  if (BEARD.has(id)) add(head, sphere(0.17), hair, 0, C - 0.13, 0.1, 1.15, 0.62, 0.72);

  // aksesuarlar
  if (L.acc === 'glasses') {
    const fr = toon('#2a2826');
    for (const sx of [-1, 1]) add(head, new THREE.TorusGeometry(0.048, 0.008, 6, 20), fr, sx * 0.085, C + 0.02, 0.245);
    add(head, new THREE.BoxGeometry(0.06, 0.01, 0.01), fr, 0, C + 0.03, 0.25);
  }
  if (L.acc === 'headphones') {
    const band = add(head, new THREE.TorusGeometry(0.28, 0.022, 8, 24, Math.PI), toon('#2a2a2a'), 0, C + 0.01, 0);
    for (const sx of [-1, 1]) add(head, new THREE.CylinderGeometry(0.075, 0.075, 0.05, 16), toon('#2a2a2a'), sx * 0.27, C, 0).rotation.z = Math.PI / 2;
    band.castShadow = false;
  }
  if (L.acc === 'beret') add(head, sphere(0.2), toon('#5a2e2a'), 0.04, C + 0.25, -0.02, 1.25, 0.35, 1.2).rotation.z = -0.25;

  return { root, legL, legR, armL, armR, head, eyes, mouth };
}
