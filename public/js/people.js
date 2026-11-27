// İnsanlar: Quaternius "Universal Base Characters" (CC0) skeletli modelləri.
// Pulsuz versiyada paltar yoxdur: geyimi şeyderdə bədənin üstünə "rəngləyirik" (köynək/sviter, şalvar, ayaqqabı),
// üz, boyun və əllər öz dəri teksturasında qalır. Saç düzümləri baş sümüyünə bağlanır.
// Animasiya faylı yoxdur: sümükləri kodla hərəkət etdiririk (applyPose).
import { THREE, M } from './kit.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { hash } from './util.js';

const loader = new GLTFLoader();
const load = url => new Promise((res, rej) => loader.load(url, res, undefined, rej));
const BASE = {}; const HAIR = {};
const HAIRS = ['Hair_Buns', 'Hair_Buzzed', 'Hair_BuzzedFemale', 'Hair_Long', 'Hair_SimpleParted', 'Hair_Beard'];

export const FEMALE = new Set(['marketer', 'brand', 'artdir', 'junior', 'uiux', 'smm', 'smmcopy', 'strateg', 'pr', 'digital', 'crm']);

// T-pozada (bind) sərhədlər: kişi və qadın modelində bir az fərqlidir.
const CUT = {
  male:   { neck: 1.475, wrist: 0.665, waist: 0.975, ankle: 0.115, short: 0.36 },
  female: { neck: 1.44,  wrist: 0.60,  waist: 0.955, ankle: 0.105, short: 0.33 },
};

let ready = null;
export function loadPeople() {
  return (ready ||= (async () => {
    const [m, f, ...hs] = await Promise.all([
      load('models/Superhero_Male_FullBody.gltf'), load('models/Superhero_Female_FullBody.gltf'),
      ...HAIRS.map(h => load(`models/hair/${h}.gltf`)),
    ]);
    BASE.male = m.scene; BASE.female = f.scene;
    HAIRS.forEach((h, i) => { HAIR[h] = hs[i].scene; });
    return true;
  })());
}

// Bədən materialı: dəri teksturası + şeyderdə geyim zonaları.
function clothMaterial(src, o) {
  const mat = src.clone();
  mat.roughness = 0.88; mat.metalness = 0;
  mat.userData.u = {
    uTop: { value: new THREE.Color(o.top) }, uPants: { value: new THREE.Color(o.pants) }, uShoe: { value: new THREE.Color(o.shoe) },
    uSkin: { value: new THREE.Color(o.skin) }, uCut: { value: new THREE.Vector4(o.cut.neck, o.cut.wrist, o.cut.waist, o.cut.ankle) },
    uSleeve: { value: o.sleeve },
  };
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, mat.userData.u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vBind;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBind = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vBind; uniform vec3 uTop, uPants, uShoe, uSkin; uniform vec4 uCut; uniform float uSleeve;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
      {
        float ax = abs(vBind.x);
        bool arm = vBind.y > uCut.z + 0.2 && ax > 0.2;
        // baş və boyun: yaxalıqdan yuxarı yalnız ortadakı boyun sütunu, çiyinlər köynəkdə qalır
        bool neck = vBind.y > uCut.x + 0.075 || (vBind.y > uCut.x && ax < 0.085);
        bool skin = neck || (arm && ax > uCut.y) || (arm && ax > uSleeve);
        vec3 c = diffuseColor.rgb;
        float shade = 0.82 + 0.18 * dot(c, vec3(0.33));
        if (skin) diffuseColor.rgb = c * uSkin;
        else if (vBind.y < uCut.w) diffuseColor.rgb = uShoe * shade;
        else if (vBind.y < uCut.z) diffuseColor.rgb = uPants * shade;
        else diffuseColor.rgb = uTop * shade;
      }`);
  };
  mat.customProgramCacheKey = () => 'ofis-cloth';
  return mat;
}

const HAIR_OF = { short: 'Hair_SimpleParted', long: 'Hair_Long', bun: 'Hair_Buns', curly: 'Hair_Buzzed', cap: 'Hair_Buzzed' };
const BEARD = new Set(['cmo', 'composer', 'account', 'video']);
const SHORT_SLEEVES = new Set(['smm', 'video', 'community', 'motion']);
const PANTS = ['#2b2e33', '#3b3a36', '#2f3a44', '#4a4136', '#1f2124', '#3c4a5a'];

// Bir personajın modelini qurur. Qaytarır: { root, bones, rest } — sümüklər applyPose üçün.
export function buildPerson(def, top) {
  const sex = FEMALE.has(def.id) ? 'female' : 'male';
  const root = SkeletonUtils.clone(BASE[sex]);
  const L = def.look, h = hash(def.id);
  // dəri tonu: personajın look.skin rəngindən yumşaq bir tint
  const skinTint = new THREE.Color(L.skin).lerp(new THREE.Color('#ffffff'), 0.55);
  const opts = {
    top, pants: L.pants || PANTS[h % PANTS.length], shoe: h % 3 ? '#1e1f21' : '#5a4434', skin: skinTint, cut: CUT[sex],
    sleeve: SHORT_SLEEVES.has(def.id) ? CUT[sex].short : 9,
  };
  const bones = {};
  root.traverse(o => {
    if (o.isBone) bones[o.name] = o;
    if (o.isMesh) {
      o.castShadow = true; o.frustumCulled = false;
      const n = o.material.name || '';
      if (/Superhero/.test(n)) o.material = clothMaterial(o.material, opts);
      else if (/Hair/.test(n)) { o.material = o.material.clone(); o.material.color = new THREE.Color(L.hair).multiplyScalar(1.6); } // qaşlar
    }
  });
  // saç: "Origin at 0" mesh-i bind pozasında baş sümüyünə bağlanır
  const head = bones.Head;
  root.updateMatrixWorld(true);
  const headInv = new THREE.Matrix4().copy(head.matrixWorld).invert();
  const addHair = name => {
    const src = HAIR[name]; if (!src) return;
    src.traverse(o => {
      if (!o.isMesh) return;
      const m = new THREE.Mesh(o.geometry, o.material.clone());
      m.material.color = new THREE.Color(L.hair).multiplyScalar(1.7); m.material.roughness = 0.8;
      m.castShadow = true;
      // modelin öz koordinatından baş sümüyünün koordinatına; qadın başı bir az aşağıdadır
      const world = o.matrixWorld.clone();
      if (sex === 'female') world.premultiply(new THREE.Matrix4().makeTranslation(0, -0.045, 0.004));
      m.applyMatrix4(new THREE.Matrix4().multiplyMatrices(headInv, world));
      head.add(m);
    });
  };
  addHair(sex === 'female' ? (L.style === 'bun' ? 'Hair_Buns' : 'Hair_Long') : (HAIR_OF[L.style] || 'Hair_SimpleParted'));
  if (sex === 'male' && BEARD.has(def.id)) addHair('Hair_Beard');
  // dinclik pozasını yadda saxla
  const rest = {};
  for (const [k, b] of Object.entries(bones)) rest[k] = { q: b.quaternion.clone(), char: new THREE.Quaternion() };
  for (const [k, b] of Object.entries(bones)) { b.getWorldQuaternion(rest[k].char); }
  const rootQ = new THREE.Quaternion(); root.getWorldQuaternion(rootQ); rootQ.invert();
  for (const k in rest) rest[k].char.premultiply(rootQ);
  return { root, bones, rest, sex, head };
}

/* ---------------- poza: sümükləri kodla ---------------- */
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const tq = new THREE.Quaternion(), tq2 = new THREE.Quaternion(), tv = new THREE.Vector3(), inv = new THREE.Quaternion();
// bone-u personajın koordinatındakı oxlar ətrafında fırladır (bind pozasına nisbətən). rots: [[axis, angle], ...] — sonuncu birinci tətbiq olunur.
function rot(P, name, rots) {
  const b = P.bones[name], r = P.rest[name]; if (!b) return;
  b.quaternion.copy(r.q);
  inv.copy(r.char).invert();
  for (const [ax, ang] of rots) { if (!ang) continue; tv.copy(ax).applyQuaternion(inv); tq.setFromAxisAngle(tv, ang); b.quaternion.multiply(tq); }
}
// p: { legL, legR, kneeL, kneeR, aL, aR, zL, zR, eL, eR, hx, hy, hz, lean }
export function applyPose(P, p) {
  rot(P, 'thigh_l', [[X, p.legL]]); rot(P, 'thigh_r', [[X, p.legR]]);
  rot(P, 'calf_l', [[X, p.kneeL]]); rot(P, 'calf_r', [[X, p.kneeR]]);
  rot(P, 'foot_l', [[X, -(p.legL + p.kneeL) * 0.8]]); rot(P, 'foot_r', [[X, -(p.legR + p.kneeR) * 0.8]]);
  rot(P, 'spine_02', [[X, p.lean || 0]]);
  // qollar: əvvəl aşağı (T-pozadan), sonra irəli/yuxarı
  rot(P, 'upperarm_l', [[X, p.aL], [Z, -1.38 - p.zL]]);
  rot(P, 'upperarm_r', [[X, p.aR], [Z, 1.38 - p.zR]]);
  // dirsək: T-pozada qol x boyuncadır, irəli bükülmə Y oxu ətrafındadır
  rot(P, 'lowerarm_l', [[Y, p.eL]]); rot(P, 'lowerarm_r', [[Y, -p.eR]]);
  rot(P, 'Head', [[Y, p.hy], [X, p.hx], [Z, p.hz]]);
}
