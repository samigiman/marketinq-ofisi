// Kenney Furniture Kit (CC0, kenney.nl): hazır 3D mebel. Hər model yüklənir, mərkəzə gətirilir (alt səthi y=0)
// və bizim dünyanın ölçüsünə böyüdülür (Kenney-də masa 0.38, bizdə 0.75 → ~1.95 dəfə).
import { THREE } from './kit.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const KS = 1.95;
const NAMES = ['desk', 'deskCorner', 'chairDesk', 'chair', 'chairCushion', 'chairModernCushion', 'chairRounded', 'computerKeyboard', 'computerMouse', 'computerScreen', 'laptop',
  'loungeSofa', 'loungeSofaLong', 'loungeSofaCorner', 'loungeChair', 'loungeChairRelax', 'loungeDesignSofa', 'loungeSofaOttoman', 'tableCoffee', 'tableCoffeeGlass', 'tableRound', 'table', 'tableCross',
  'pottedPlant', 'plantSmall1', 'plantSmall2', 'plantSmall3', 'bookcaseOpen', 'bookcaseOpenLow', 'bookcaseClosedWide', 'books',
  'kitchenCabinet', 'kitchenCabinetDrawer', 'kitchenCabinetUpper', 'kitchenSink', 'kitchenFridge', 'kitchenFridgeLarge', 'kitchenCoffeeMachine', 'kitchenMicrowave', 'kitchenBar', 'kitchenBarEnd', 'kitchenBlender', 'toaster',
  'stoolBar', 'stoolBarSquare', 'rugRectangle', 'rugRound', 'rugRounded', 'rugSquare', 'rugDoormat', 'lampRoundFloor', 'lampSquareFloor', 'lampRoundTable', 'lampSquareCeiling', 'lampWall',
  'coatRackStanding', 'cardboardBoxClosed', 'cardboardBoxOpen', 'trashcan', 'televisionModern', 'speaker', 'speakerSmall', 'sideTable', 'sideTableDrawers', 'radio',
  'pillow', 'pillowBlue', 'pillowLong', 'ceilingFan', 'bench', 'benchCushion', 'cabinetTelevision', 'bear'];
const SRC = {}; // ad → { scene, size: Vector3 } (mərkəzlənmiş, KS ilə böyüdülmüş)
const loader = new GLTFLoader();

export const kenneyReady = Promise.all(NAMES.map(n => new Promise(res => loader.load(`models/kenney/${n}.glb`, g => {
  const s = g.scene; s.scale.multiplyScalar(KS); s.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(s), c = b.getCenter(new THREE.Vector3());
  const wrap = new THREE.Group(); s.position.sub(new THREE.Vector3(c.x, b.min.y, c.z)); wrap.add(s);
  s.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  SRC[n] = { scene: wrap, size: b.getSize(new THREE.Vector3()) };
  res();
}, undefined, () => { console.warn('Kenney modeli yüklənmədi:', n); res(); })))).then(() => true);

// Model nüsxəsi: parent-ə əlavə olunur. o.color: əsas materialı rəngləmək (məs. divan parçası), o.s: əlavə miqyas.
export function K(parent, name, x, z, rot = 0, o = {}) {
  const src = SRC[name]; if (!src) return null;
  const m = src.scene.clone(true);
  if (o.color) m.traverse(c => { if (c.isMesh && (!o.only || o.only.test(c.material.name || ''))) { c.material = c.material.clone(); c.material.color = new THREE.Color(o.color); } });
  m.position.set(x, o.y || 0, z); m.rotation.y = rot; if (o.s) m.scale.setScalar(o.s);
  parent.add(m);
  return m;
}
// fırlanmadan sonra modelin yerdə tutduğu sahə: [x0, z0, x1, z1]
export function footprint(name, x, z, rot = 0, s = 1) {
  const sz = SRC[name]?.size; if (!sz) return [x, z, x, z];
  const c = Math.abs(Math.cos(rot)), sn = Math.abs(Math.sin(rot));
  const w = (sz.x * c + sz.z * sn) * s / 2, d = (sz.x * sn + sz.z * c) * s / 2;
  return [x - w, z - d, x + w, z + d];
}
export const sizeOf = name => SRC[name]?.size;
