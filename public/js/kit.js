// Three.js əsasları: renderer, səhnə, kamera, işıq, material və geometriya köməkçiləri.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export { THREE };
const stage = document.getElementById('stage');
const size = () => { const r = stage.getBoundingClientRect(); return [Math.max(1, r.width), Math.max(1, r.height)]; };

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
stage.appendChild(renderer.domElement);

export const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.className = 'labels';
stage.appendChild(labelRenderer.domElement);

export const scene = new THREE.Scene();
scene.background = new THREE.Color('#e4e0d8');
scene.fog = new THREE.Fog('#e4e0d8', 90, 180);

export const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 400);
camera.position.set(33, 40, 44);
export const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = 1.36;
controls.minDistance = 6;
controls.maxDistance = 95;

export function resize() {
  const [w, h] = size();
  renderer.setSize(w, h); labelRenderer.setSize(w, h);
  camera.aspect = w / h; camera.fov = w / h < 0.8 ? 52 : 36; camera.updateProjectionMatrix(); // dar ekranda ofis bütöv görünsün
}
new ResizeObserver(resize).observe(stage);
resize();

// İşıq: pəncərələrdən (şərq, +x) düşən səhər günəşi + yumşaq ambient.
scene.add(new THREE.HemisphereLight('#fbf5ea', '#bfb2a0', 1.05));
export const sun = new THREE.DirectionalLight('#ffeedd', 1.9);
sun.position.set(34, 26, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 26, bottom: -26, near: 1, far: 100 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun);
const fill = new THREE.DirectionalLight('#dfe6ee', 0.35);
fill.position.set(-20, 18, -10);
scene.add(fill);

/* materiallar və geometriya keşi */
const matCache = new Map();
export function M(color, o = {}) {
  const k = color + JSON.stringify(o);
  if (!matCache.has(k)) {
    matCache.set(k, new THREE.MeshStandardMaterial({
      color, roughness: o.r ?? 0.8, metalness: o.m ?? 0,
      transparent: o.o != null, opacity: o.o ?? 1,
      emissive: o.e || '#000000', emissiveIntensity: o.ei ?? 1,
      depthWrite: o.o == null || o.o > 0.6, map: o.map || null,
    }));
  }
  return matCache.get(k);
}
const geoCache = new Map();
export function RB(w, h, d, r = 0.02) {
  r = Math.min(r, Math.min(w, h, d) / 2 - 0.001);
  const k = `${w}|${h}|${d}|${r.toFixed(3)}`;
  if (!geoCache.has(k)) geoCache.set(k, r > 0.006 ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d));
  return geoCache.get(k);
}
export function box(p, w, h, d, mat, x, y, z, r = 0.02, shadow = true) {
  const m = new THREE.Mesh(RB(w, h, d, r), typeof mat === 'string' ? M(mat) : mat);
  m.position.set(x, y, z);
  if (shadow) { m.castShadow = true; m.receiveShadow = true; }
  p.add(m); return m;
}
export function cyl(p, rt, rb, h, mat, x, y, z, seg = 18, shadow = true) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof mat === 'string' ? M(mat) : mat);
  m.position.set(x, y, z);
  if (shadow) { m.castShadow = true; m.receiveShadow = true; }
  p.add(m); return m;
}
export function sph(p, r, mat, x, y, z, seg = 14) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.7 | 0)), typeof mat === 'string' ? M(mat) : mat);
  m.position.set(x, y, z); m.castShadow = true; p.add(m); return m;
}
export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  t.userData = { canvas: c, ctx: g }; return t;
}
export function basicPlane(w, h, tex, transparent = false) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent, toneMapped: false }));
}

// Kanvasda istifadə olunan şriftlər (CSS ilə eyni).
export const FONT = '"IBM Plex Sans", system-ui, sans-serif';
export const MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace';

export const office = new THREE.Group();
scene.add(office);
