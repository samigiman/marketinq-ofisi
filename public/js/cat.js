// Ofis pişiyi Mırmır: ofisdə gəzir, yatağında yatır, bəzən kiminsə masasının yanında oturur.
import { THREE, scene } from './kit.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { findPath } from './nav.js';
import { CAT_BED, POIS, poiOpen } from './office.js';
import { toon } from './cute.js';
import { AGENTS } from './agents.js';
import { rand, pick, wrapA, hooks } from './util.js';

const fur = toon('#d98c4a'), light = toon('#f3d9b8'), dark = toon('#2a2522'), pink = toon('#e8a3a0');
const g = new THREE.Group(); scene.add(g);
const add = (p, geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; p.add(m); return m; };
const S = r => new THREE.SphereGeometry(r, 16, 12);
const body = add(g, new THREE.CapsuleGeometry(0.11, 0.22, 6, 12), fur, 0, 0.2, 0); body.rotation.x = Math.PI / 2;
add(g, S(0.09), light, 0, 0.17, 0.12, 1, 0.8, 0.7);
const head = new THREE.Group(); head.position.set(0, 0.32, 0.2); g.add(head);
add(head, S(0.11), fur, 0, 0, 0, 1.1, 0.95, 1);
add(head, S(0.05), light, 0, -0.035, 0.08, 1.2, 0.8, 0.7);
for (const sx of [-1, 1]) {
  add(head, new THREE.ConeGeometry(0.04, 0.08, 8), fur, sx * 0.07, 0.1, 0, 1, 1, 0.6).rotation.z = -sx * 0.25;
  add(head, S(0.016), dark, sx * 0.045, 0.02, 0.1, 1, 1.3, 0.6);
}
add(head, S(0.012), pink, 0, -0.01, 0.115);
const legs = [];
for (const [x, z] of [[-0.06, 0.12], [0.06, 0.12], [-0.06, -0.12], [0.06, -0.12]]) { const l = add(g, new THREE.CapsuleGeometry(0.03, 0.08, 4, 8), fur, x, 0.07, z); legs.push(l); }
const tail = new THREE.Group(); tail.position.set(0, 0.24, -0.2); g.add(tail);
for (let i = 0; i < 6; i++) add(tail, S(0.032 - i * 0.002), i > 3 ? dark : fur, 0, i * 0.045, -i * 0.025);
const hit = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 0.2; g.add(hit);
export const catHit = hit;

const el = document.createElement('div'); el.className = 'lbl';
el.innerHTML = '<div class="inner"><div class="bubble hide"><div class="bt"></div></div><span class="tag" style="pointer-events:none"><span class="nm">Mırmır</span></span></div>';
const lbl = new CSS2DObject(el); lbl.position.set(0, 0.75, 0); g.add(lbl);
const bubble = el.querySelector('.bubble'), bt = el.querySelector('.bt');
let sayT = 0;
export function meow(t = pick(['Miyav', 'Mrrr…', 'Miyaaav?'])) { bt.textContent = t; bubble.classList.remove('hide'); sayT = 2.5; }

const pos = new THREE.Vector2(CAT_BED.x, CAT_BED.z);
let rot = 0, path = [], state = 'sit', timer = 3, t = 0, near = null, slept = true;
function go(x, z) { path = findPath(pos.x, pos.y, x, z); state = 'walk'; }
function decide() {
  const r = Math.random();
  const people = AGENTS.filter(a => a.hired && a.mode === 'free');
  if (r < 0.3 && !slept) { go(CAT_BED.x, CAT_BED.z); near = 'bed'; slept = true; return; }
  slept = false;
  if (r < 0.3) { const p = pick(POIS.filter(poiOpen)); near = null; go(p.x, p.z); }
  else if (r < 0.65 && people.length) { const a = pick(people); near = a; go(a.seat.x + rand(-0.6, 0.6), a.seat.z + (a.seat.rot === 0 ? -0.7 : 0.7)); }
  else { const p = pick(POIS.filter(poiOpen)); near = null; go(p.x + rand(-0.6, 0.6), p.z + rand(-0.6, 0.6)); }
}
export function updateCat(dt) {
  t += dt;
  if (sayT > 0 && (sayT -= dt) <= 0) bubble.classList.add('hide');
  if (state === 'walk') {
    if (!path.length) { state = near === 'bed' ? 'sleep' : 'sit'; timer = state === 'sleep' ? rand(25, 50) : rand(8, 16);
      if (near && near !== 'bed') { near.flash(pick(['Mırmır, yenə gəldin?', 'Pişik, klaviaturama çıxma', 'Gəl, gəl…']), 3); meow(); } }
    else {
      const tg = path[0], dx = tg.x - pos.x, dz = tg.y - pos.y, d = Math.hypot(dx, dz), step = 1.1 * dt;
      if (d > 0.001) rot += wrapA(Math.atan2(dx, dz) - rot) * Math.min(1, dt * 8);
      if (d <= step) { pos.set(tg.x, tg.y); path.shift(); } else pos.add(new THREE.Vector2(dx / d * step, dz / d * step));
    }
  } else if ((timer -= dt) <= 0) decide();
  const walking = state === 'walk' && path.length;
  legs.forEach((l, i) => { l.rotation.x = walking ? Math.sin(t * 12 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.5 : 0; });
  const lying = state === 'sleep';
  g.position.set(pos.x, lying ? -0.08 : 0, pos.y);
  g.rotation.y = rot;
  body.scale.y = lying ? 1.1 : 1;
  head.position.y = lying ? 0.2 : 0.32 + (state === 'sit' ? 0.04 : 0);
  head.rotation.x = lying ? 0.4 : Math.sin(t * 0.7) * 0.08;
  tail.rotation.x = lying ? 1.2 : -0.4 + Math.sin(t * (walking ? 5 : 2)) * 0.35;
  tail.rotation.z = Math.sin(t * 1.3) * 0.3;
}
hooks.meow = meow;
