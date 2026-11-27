// Personajlar: görünüş, gündəlik həyat (iş, fikir, həmkara sual, fasilə) və kadr yeniləməsi.
import { THREE, scene, camera, M, box, cyl, sph } from './kit.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { findPath } from './nav.js';
import { SEATS, POIS, setDesk, assignSeat, releaseSeat, poiOpen, setStage, stageFor, STAGE } from './office.js';
import { PI, rand, pick, lerp, clamp, wrapA, hash, esc, clockStr, hooks, fileLink, shuffle } from './util.js';
import { TEAM, DEPTS, PERSONAS } from '../team.js';
import { buildCute } from './cute.js';

export const STATUS = {
  work:     ['İşləyir', '#2f7d5b'],
  think:    ['Düşünür', '#a1791f'],
  walk:     ['Yolda', '#4a6fa5'],
  break:    ['Fasilədə', '#7d6b98'],
  chat:     ['Söhbətdə', '#3b8a96'],
  meeting:  ['Görüşdə', '#b2622f'],
  campaign: ['Kampaniyada', '#a33a2e'],
  assigned: ['Tapşırıqda', '#1f5f4a'],
  away:     ['Bizdə işləmir', '#9a9a95'],
};

const ASK = {
  cmo: ['büdcəni bu gün təsdiqləyək?', 'bu konsepsiyaya baxa bilərsən?'],
  marketer: ['brif hazırdır?', 'hədəf auditoriyanı dəqiqləşdirək'],
  brand: ['bu rəng brendbuka uyğundur?', 'loqonun yeri düzdür?'],
  pm: ['deadline-ı bir gün uzada bilərik?', 'tapşırığı lövhəyə yazdın?'],
  account: ['müştəri nə dedi?', 'rəy gəldi?'],
  artdir: ['konsepsiyaya bir baxarsan?', 'hansı variant güclüdür?'],
  designer: ['banneri bu gün bitirə bilərsən?', 'başlığı bir az böyüdək?'],
  junior: ['ölçüləri hazırladın?', 'story şablonu hazırdır?'],
  motion: ['animasiya 15 saniyəyə sığır?', 'loqo animasiyası necə gedir?'],
  video: ['çəkiliş sabahdır?', 'montajın ilk versiyası var?'],
  uiux: ['düyməni yuxarı qaldıraq?', 'prototip linkini atarsan?'],
  smm: ['bu postu nə vaxt paylaşırıq?', 'kontent planda yer var?'],
  smmcopy: ['caption-u qısaldaq?', 'hashtag-ları əlavə etdin?'],
  copy: ['sloqana bir variant da?', 'başlıq beş sözə sığsın'],
  strateg: ['bu trend bizə uyğundur?', 'rubrikanı təsdiqləyək'],
  community: ['şərhlərdə nə var?', 'mənfi rəy gəlib?'],
  pr: ['bloqer razılaşdı?', 'press-reliz hazırdır?'],
  target: ['CPM niyə artıb?', 'yeni auditoriyanı yoxladın?'],
  ppc: ['CPC-ni azalda bilərik?', 'açar sözləri genişləndirək?'],
  digital: ['funnel-də itki haradadır?', 'UTM-ləri yoxladın?'],
  seo: ['bu səhifə indekslənib?', 'meta başlığı yazdın?'],
  analyst: ['dünənki ROAS neçədir?', 'rəqəmləri hesabata salarsan?'],
  crm: ['email açılma faizi necədir?', 'seqmenti ayırdın?'],
  composer: ['jingle-ın demosu var?', 'musiqi bir az sürətli olsun'],
};
const REPLIES = ['Hə, indi baxıram', 'Bir saata hazırdır', 'Yaxşı fikirdir', 'Razıyam, edək', 'Artıq hazırdır', 'Bir az vaxt ver', 'Qeyd etdim', 'Sabaha qalsın?'];
const WORRIES = ['Növbəti mən olmayım…', 'Rəhbər məndən razıdır görəsən?', 'Bu gün diqqətimi toplaya bilmirəm', 'Başqa yerə CV göndərim?', 'Ofis əvvəlki kimi deyil'];
const THOUGHTS = ['Daha güclü ideya lazımdır', 'Insight axtarıram', 'Bunu necə sadələşdirim?', 'Auditoriya nə istəyir?', 'Başqa tərəfdən baxım'];

// Geyim: hər personaja öz rəngi (departament rəngi yox). Bəzilərinə xüsusi.
const TOPS = ['#4a5a6a', '#6b4e3d', '#3f5a4a', '#8a6f4e', '#2f3640', '#7a3e33', '#b9ab95', '#55606e', '#9a8a6a', '#dcd5c8', '#5c4a5e', '#46606a'];
const PANTS = ['#2b2e33', '#3b3a36', '#2f3a44', '#4a4136', '#1f2124'];
const TOP_OVERRIDE = { cmo: '#2b2f36', account: '#e4ddd0', artdir: '#2a2a2a', video: '#5d6b4f', composer: '#4a3b33', junior: '#c9b8a3' };
export const topColor = id => TOP_OVERRIDE[id] || TOPS[hash(id + 'top') % TOPS.length];

export const CANCEL = Symbol('cancel');
export const timers = new Set();
export const gsleep = sec => new Promise(res => timers.add({ t: sec, res, agent: null }));
export const AGENTS = [];
export const hitboxes = [];
export const DONE = [];
export const BACKLOG = shuffle(TEAM.flatMap(t => t.tasks.map(x => ({ text: x, dept: t.dept })))).slice(0, 6);
const hitMat = new THREE.MeshBasicMaterial({ visible: false });
const hitGeo = new THREE.CylinderGeometry(0.5, 0.5, 2.2, 8);
export let selectedAgent = null;
export const setSelectedAgent = a => { selectedAgent = a; };

export class Agent {
  constructor(def, seat) {
    this.def = def; this.id = def.id; this.seat = seat;
    this.pos = new THREE.Vector3(seat.x, 0, seat.z);
    this.rot = this.targetRot = seat.rot;
    this.sit = 1; this.sitTarget = 1; this.sitDrop = seat.drop;
    this.path = []; this.gen = 0; this.mode = 'free';
    this.anim = 'type'; this.t = Math.random() * 10; this.seed = Math.random() * 10; this.walkPhase = 0;
    this.status = 'work'; this.task = ''; this.bubbleText = ''; this.flashText = ''; this.flashT = 0;
    this.progTimer = null; this.history = []; this.poi = null; this.meetSeat = null;
    this.color = topColor(def.id);
    this.build(); this.buildLabel();
  }
  build() {
    const g = this.group = new THREE.Group(); scene.add(g);
    const parts = buildCute(this.def, this.color);
    g.add(parts.root);
    Object.assign(this, { legL: parts.legL, legR: parts.legR, armL: parts.armL, armR: parts.armR, head: parts.head, eyes: parts.eyes, mouth: parts.mouth });
    const hb = new THREE.Mesh(hitGeo, hitMat); hb.position.y = 0.9; hb.userData.agent = this; g.add(hb); hitboxes.push(hb);
    // işdən çıxanda əlində apardığı qutu
    this.boxMesh = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.3, 0.34), M('#b8936b')); this.boxMesh.position.set(0, 0.92, 0.34); this.boxMesh.visible = false; this.boxMesh.castShadow = true; g.add(this.boxMesh);
  }
  buildLabel() {
    const el = document.createElement('div'); el.className = 'lbl';
    el.innerHTML = `<div class="inner"><div class="bubble hide"><div class="bt"></div><div class="pbar"><i></i></div></div>
      <button class="tag" type="button"><span class="sdot"></span><span class="nm">${esc(this.def.name)}</span><span class="rl">${esc(this.def.role)}</span></button></div>`;
    this.el = el; this.elBubble = el.querySelector('.bubble'); this.elBT = el.querySelector('.bt');
    this.elBar = el.querySelector('.pbar'); this.elBarI = this.elBar.querySelector('i'); this.elDot = el.querySelector('.sdot');
    el.querySelector('.tag').addEventListener('pointerdown', e => { e.stopPropagation(); hooks.select(this, true); });
    const obj = this.labelObj = new CSS2DObject(el); obj.position.set(0, 1.95, 0); this.group.add(obj);
  }

  /* --- asinxron primitivlər --- */
  sleep(sec, progress = false) {
    return new Promise((res, rej) => { const tm = { t: sec, dur: sec, res, rej, agent: this }; timers.add(tm); if (progress) this.progTimer = tm; });
  }
  walkTo(x, z, rot = null, drop = null) {
    return new Promise((res, rej) => {
      this.path = findPath(this.pos.x, this.pos.z, x, z);
      this.arriveRot = rot; this.arriveDrop = drop; this.sitTarget = 0;
      this.status = 'walk'; this.anim = 'idle';
      this.walkRes = res; this.walkRej = rej;
      if (!this.path.length) this.arrive();
    });
  }
  arrive() {
    if (this.arriveRot != null) this.targetRot = this.arriveRot;
    if (this.arriveDrop != null) { this.sitDrop = this.arriveDrop; this.sitTarget = 1; }
    const r = this.walkRes; this.walkRes = this.walkRej = null; r && r();
  }
  interrupt() {
    this.gen++;
    for (const tm of [...timers]) if (tm.agent === this) { timers.delete(tm); tm.rej(CANCEL); }
    this.progTimer = null;
    if (this.walkRej) { const r = this.walkRej; this.walkRes = this.walkRej = null; this.path = []; r(CANCEL); }
    if (this.poi) { this.poi.busy = null; this.poi = null; }
    if (this.meetSeat) { this.meetSeat.busy = null; this.meetSeat = null; }
    this.bubbleText = '';
  }
  async run(script, mode = 'task') {
    this.interrupt(); const g = this.gen; this.mode = mode;
    try { await script(); } catch (e) { if (e !== CANCEL) console.error(e); return; }
    if (g === this.gen) this.startLife();
  }
  startLife() { this.run(() => this.routine(), 'free'); }
  atHome() { return Math.hypot(this.pos.x - this.seat.x, this.pos.z - this.seat.z) < 0.15; }
  goHome() { return this.walkTo(this.seat.x, this.seat.z, this.seat.rot, this.seat.drop); }
  say(t) { this.bubbleText = t; }
  flash(t, sec = 3) { this.flashText = t; this.flashT = sec; }
  completed(task, loud = false, file = null) {
    const tm = clockStr();
    this.history.unshift(file ? { s: `${tm} · ${task}`, file, title: `${this.def.name}: ${task}` } : `${tm} · ${task}`); if (this.history.length > 12) this.history.pop();
    DONE.unshift({ text: task, dept: this.def.dept, who: this.def.name }); if (DONE.length > 10) DONE.pop();
    if (file) hooks.log(this, `“${esc(task)}” hazırdır. ${fileLink(file, `${this.def.name}: ${task}`)}`);
    else if (loud || Math.random() < 0.3) hooks.log(this, `“${esc(task)}” işini bitirdi`);
  }

  /* --- gündəlik həyat --- */
  // əhval: 0..1 (serverdən); pis əhvalda az işləyir, çox fasilə verir və fikrə gedir
  get moodV() { return this.mood?.v ?? 0.7; }
  async routine() {
    if (!this.atHome()) await this.goHome();
    this.sitTarget = 1;
    while (true) {
      const r = Math.random(), low = this.moodV < 0.45, high = this.moodV > 0.8;
      const W = low ? 0.33 : high ? 0.56 : 0.5, T = W + (low ? 0.22 : 0.13), Co = T + (low ? 0.12 : 0.17);
      if (r < W) await this.doWork(low ? rand(8, 16) : undefined);
      else if (r < T) await this.doThink();
      else if (r < Co) await this.doCollab();
      else await this.doBreak();
    }
  }
  async doWork(dur) {
    const task = pick(this.def.tasks); this.task = task;
    this.status = 'work'; this.anim = 'type'; this.say(task);
    await this.sleep(dur ?? rand(12, 26), true);
    this.completed(task);
  }
  async doThink() {
    const low = this.moodV < 0.45;
    this.status = 'think'; this.anim = 'think'; this.say(low ? pick(WORRIES) : pick(THOUGHTS));
    await this.sleep(rand(4, 7));
  }
  async doCollab() {
    const others = AGENTS.filter(a => a !== this && a.mode === 'free' && a.atHome());
    if (!others.length) return this.doWork();
    const same = others.filter(a => a.def.dept === this.def.dept);
    const b = same.length && Math.random() < 0.55 ? pick(same) : pick(others);
    const sp = sideSpot(b);
    await this.walkTo(sp.x, sp.z, sp.rot);
    this.status = 'chat'; this.anim = 'talk';
    const q = pick(ASK[b.id] || ['bir dəqiqən var?']);
    this.say(`${b.def.name}, ${q}`);
    await this.sleep(2.6);
    if (b.mode === 'free') b.flash(pick(REPLIES), 3.4);
    if (Math.random() < 0.3) hooks.log(this, `${esc(b.def.name)}-dan soruşdu: “${esc(q)}”`);
    await this.sleep(3.4);
    await this.goHome();
  }
  async doBreak() {
    const opts = POIS.filter(p => !p.busy && poiOpen(p));
    if (!opts.length) return this.doThink();
    const p = pick(opts); p.busy = this; this.poi = p;
    await this.walkTo(p.x, p.z, p.rot, p.drop ?? null);
    this.status = p.status || 'break'; this.anim = p.anim || 'idle'; this.say(p.text);
    await this.sleep(rand(6, 12));
    p.busy = null; this.poi = null;
    await this.goHome();
  }

  /* --- kadr yeniləməsi --- */
  update(dt) {
    this.t += dt;
    if (this.path.length) {
      if (this.sit > 0.15) this.sitTarget = 0;
      else {
        const tg = this.path[0], dx = tg.x - this.pos.x, dz = tg.y - this.pos.z, d = Math.hypot(dx, dz), step = 2.2 * dt;
        if (d > 0.001) this.targetRot = Math.atan2(dx, dz);
        if (d <= step) { this.pos.x = tg.x; this.pos.z = tg.y; this.path.shift(); if (!this.path.length) this.arrive(); }
        else { this.pos.x += dx / d * step; this.pos.z += dz / d * step; }
        this.walkPhase += dt * 9;
      }
    }
    this.sit += clamp(this.sitTarget - this.sit, -dt * 4, dt * 4);
    const s = this.sit, walking = this.path.length > 0 && s <= 0.15;
    const sw = walking ? Math.sin(this.walkPhase) * 0.5 : 0;
    const bob = walking ? Math.abs(Math.cos(this.walkPhase)) * 0.035 : 0;
    this.rot += wrapA(this.targetRot - this.rot) * Math.min(1, dt * 9);
    this.group.rotation.y = this.rot;
    if (this.faceBoss && !walking) {
      const tgt = Math.atan2(camera.position.x - this.pos.x, camera.position.z - this.pos.z);
      this.targetRot = this.rot + wrapA(tgt - this.rot) * 0.6;
    }
    this.legL.rotation.x = lerp(sw, -1.45, s); this.legR.rotation.x = lerp(-sw, -1.45, s);
    // yumru fiqurun ombası alçaqdır: oturacağa uyğunlaşdırırıq
    this.group.position.set(this.pos.x, (this.sitDrop + 0.22) * s + bob, this.pos.z);

    let aL = 0, aR = 0, zL = -0.05, zR = 0.05, hx = 0, hy = Math.sin(this.t * 0.4 + this.seed) * 0.12, hz = 0;
    this.boxMesh.visible = !!this.carry;
    if (this.carry) { aL = aR = -1.35; zL = 0.32; zR = -0.32; }
    else if (walking) { aL = -sw * 0.8; aR = sw * 0.8; }
    else switch (this.anim) {
      case 'type': aL = -1.2 + Math.sin(this.t * 16) * 0.05; aR = -1.2 + Math.sin(this.t * 16 + 2) * 0.05; zL = 0.15; zR = -0.15; hx = 0.1; hy *= 0.3; break;
      case 'think': aR = -2.3; zR = -0.4; aL = -0.5; zL = 0.3; hz = 0.1; hx = -0.08; break;
      case 'talk': aL = -0.45 + Math.sin(this.t * 3) * 0.3; aR = -0.6 + Math.sin(this.t * 3.7 + 1) * 0.35; hy = Math.sin(this.t * 1.5) * 0.18; break;
      case 'present': aR = -1.7 + Math.sin(this.t * 1.8) * 0.3; zR = 0.25; aL = -0.3; break;
      case 'drink': aR = -2.1 + Math.sin(this.t * 0.8) * 0.12; zR = -0.3; break;
      case 'phone': aR = -1.5; zR = -0.4; aL = -1.3; zL = 0.35; hx = 0.28; hy = 0; break;
      default: aL = Math.sin(this.t * 1.2) * 0.03; aR = -aL;
    }
    if (this.waveT > 0) { this.waveT -= dt; aR = -2.8 + Math.sin(this.t * 12) * 0.2; zR = -0.3; }
    this.blinkT = (this.blinkT ?? rand(1, 4)) - dt;
    let ey = 1; if (this.blinkT < 0) { ey = 0.1; if (this.blinkT < -0.12) this.blinkT = rand(2.5, 6); }
    const kk = Math.min(1, dt * 22);
    for (const e of this.eyes) e.scale.y += (ey - e.scale.y) * kk;
    const talking = this.speaking || (this.anim === 'talk' && !walking);
    this.mouth.scale.set(1, talking ? 1 + Math.abs(Math.sin(this.t * 12)) * 2.5 : 1, 1);
    this.mouth.rotation.z = this.moodV < 0.45 && !talking ? 0 : Math.PI; // pis əhvalda qaşqabaq
    const k = Math.min(1, dt * 10);
    this.armL.rotation.x += (aL - this.armL.rotation.x) * k; this.armR.rotation.x += (aR - this.armR.rotation.x) * k;
    this.armL.rotation.z += (zL - this.armL.rotation.z) * k; this.armR.rotation.z += (zR - this.armR.rotation.z) * k;
    this.head.rotation.x += (hx - this.head.rotation.x) * k; this.head.rotation.y += (hy - this.head.rotation.y) * k; this.head.rotation.z += (hz - this.head.rotation.z) * k;
    if (this.flashT > 0) this.flashT -= dt;
    this.updateLabel();
  }
  progress() { if (this.liveProg != null) return this.liveProg; return this.progTimer ? clamp(1 - this.progTimer.t / this.progTimer.dur, 0, 1) : null; }
  updateLabel() {
    const txt = this.flashT > 0 ? this.flashText : this.bubbleText;
    if (txt !== this._lt) { this._lt = txt; this.elBT.textContent = txt; this.elBubble.classList.toggle('hide', !txt); }
    const p = this.flashT > 0 ? null : this.progress();
    const sb = p != null;
    if (sb !== this._sb) { this._sb = sb; this.elBar.style.display = sb ? 'block' : 'none'; }
    if (sb) { const w = Math.round(p * 100); if (w !== this._pw) { this._pw = w; this.elBarI.style.width = w + '%'; } }
    if (this.status !== this._ls) { this._ls = this.status; this.elDot.style.background = STATUS[this.status][1]; }
    // masada sakit işləyəndə balon gizlənir: yalnız ad görünür
    const calm = this.flashT <= 0 && (this.status === 'work' || this.status === 'think') && this !== selectedAgent;
    if (calm !== this._calm) { this._calm = calm; this.el.classList.toggle('calm', calm); }
  }
}

export function sideSpot(b) {
  const s = b.seat, fx = Math.sin(s.rot), fz = Math.cos(s.rot), px = Math.cos(s.rot), pz = -Math.sin(s.rot);
  let best = null, bd = -1;
  for (const sg of [1, -1]) {
    const x = s.x + px * 0.95 * sg - fx * 0.1, z = s.z + pz * 0.95 * sg - fz * 0.1;
    const d = Math.min(...AGENTS.filter(a => a !== b).map(a => Math.hypot(a.seat.x - x, a.seat.z - z)));
    if (d > bd) { bd = d; best = { x, z }; }
  }
  best.rot = Math.atan2(s.x - best.x, s.z - best.z);
  return best;
}

for (const def of TEAM) AGENTS.push(new Agent(def, SEATS[def.id]));

/* ---------------- heyət: kim ofisdədir ---------------- */
export const ENTRY = { x: -14, z: 13.3 }; // giriş: kiçik otağın cənubunda
export const isHired = id => AGENTS.find(a => a.id === id)?.hired;
function show(a, on) {
  if (on) a.seat = assignSeat(a.id); else releaseSeat(a.id); // masa yeri: ilk boş yer
  a.group.visible = on; a.labelObj.visible = on; setDesk(a.id, on);
}
// ilk yükləmədə: animasiyasız
// ofisin mərhələsi işçi sayına görə; böyüyəndə hooks.onStage xəbər verir
function fitStage(count, animate) { const prev = STAGE.cur; if (setStage(stageFor(count), animate) && animate) hooks.onStage?.(STAGE.cur, prev); }
export function initStaff(ids) {
  fitStage(ids.length, false);
  for (const a of AGENTS) if (!ids.includes(a.id)) { a.hired = false; show(a, false); a.interrupt(); a.mode = 'away'; a.status = 'away'; a.task = ''; }
  for (const id of ids) { const a = byId(id); if (!a) continue; a.hired = true; show(a, true); a.pos.set(a.seat.x, 0, a.seat.z); a.rot = a.targetRot = a.seat.rot; }
}
// serverdən gələn siyahı ilə tutuşdur (animasiyasız)
export function syncStaff(ids) {
  fitStage(ids.length, false);
  for (const a of AGENTS) if (!ids.includes(a.id) && a.hired) { a.hired = false; a.interrupt(); show(a, false); a.mode = 'away'; a.status = 'away'; a.task = ''; }
  for (const id of ids) {
    const a = byId(id); if (!a || a.hired) continue;
    a.hired = true; show(a, true); a.pos.set(a.seat.x, 0, a.seat.z); a.rot = a.targetRot = a.seat.rot; a.sit = a.sitTarget = 1; a.startLife();
  }
}
// işə götürüldü: girişdən içəri girir və masasına keçir
// yaxınlar: münasibətlərində bir-birinin adı keçənlər, sonra eyni şöbə
const closeTo = a => AGENTS.filter(o => o !== a && o.hired && ((PERSONAS[o.id]?.ties || '').includes(a.def.name) || (PERSONAS[a.id]?.ties || '').includes(o.def.name)));
export function setMoods(m) { for (const a of AGENTS) if (m?.[a.id]) a.mood = m[a.id]; }

// işə götürüldü: girişdən içəri girir, masasına keçir, Elvin və bir-iki həmkarı qarşılayır
export function arrive(a, back = false) {
  if (a.hired) return;
  fitStage(AGENTS.filter(o => o.hired).length + 1, true);
  a.hired = true; a.pos.set(ENTRY.x, 0, ENTRY.z); a.sit = 0; a.sitTarget = 0; show(a, true);
  a.run(async () => {
    a.say(back ? 'Yenidən buradayam…' : 'Salam, bu gün ilk günümdür');
    await a.goHome(); a.anim = 'idle'; a.faceBoss = false;
    a.flash(back ? 'Bu dəfə özümü göstərəcəm' : 'Masam buradır?', 3); await a.sleep(9);
  }, 'free');
  const hosts = [AGENTS.find(o => o.id === 'cmo'), ...closeTo(a), ...shuffle(AGENTS.filter(o => o.hired && o.def.dept === a.def.dept && o !== a))]
    .filter((o, i, arr) => o && o.hired && o !== a && o.mode === 'free' && arr.indexOf(o) === i).slice(0, 3);
  hosts.forEach((o, i) => o.run(async () => {
    await o.sleep(2 + i * 1.5);
    const sp = sideSpot(a); await o.walkTo(sp.x + (i - 1) * 0.6, sp.z + (i - 1) * 0.3, sp.rot);
    o.status = 'chat'; o.anim = 'talk'; o.waveT = 1.2;
    o.say(back ? pick(['Xoş gördük yenidən', 'Qayıtdın? Yaxşı oldu', 'Səni darıxmışdıq']) : o.id === 'cmo' ? `Xoş gəldin, ${a.def.name}. Deməli belə, burada…` : pick(['Xoş gəldin!', 'Kömək lazım olsa, de', 'Qəhvə maşını oradadır']));
    await o.sleep(4); await o.goHome();
  }, 'free'));
}
// işdən çıxarıldı: əşyalarını qutuya yığır, dostları qapıya qədər ötürür, qalanlar sarsılır
export function leave(a) {
  if (!a.hired) return;
  a.hired = false;
  const friends = [...closeTo(a), ...shuffle(AGENTS.filter(o => o.hired && o !== a && o.def.dept === a.def.dept))].filter((o, i, arr) => o.mode === 'free' && arr.indexOf(o) === i).slice(0, 2);
  a.run(async () => {
    a.status = 'away'; a.anim = 'idle'; a.say('Əşyalarımı yığıram'); await a.sleep(3);
    setDesk(a.id, false); a.carry = true; a.anim = 'carry';
    a.say('Hamıya uğurlar…');
    await a.walkTo(ENTRY.x, ENTRY.z); a.carry = false; await a.sleep(2.5);
    show(a, false); a.mode = 'away'; a.task = '';
    fitStage(AGENTS.filter(o => o.hired).length, true);
    await a.sleep(1e9);
  }, 'away');
  friends.forEach((o, i) => o.run(async () => {
    await o.sleep(3.5);
    await o.walkTo(ENTRY.x + (i ? 1.2 : -1.2), ENTRY.z - 1.0, PI);
    o.status = 'chat'; o.anim = 'talk'; o.say(pick(['Səni darıxacağıq', 'Əlaqədə qalaq', 'Bu düzgün olmadı', 'Uğurlar, dostum']));
    await o.sleep(5); await o.goHome();
  }, 'free'));
  for (const o of AGENTS) if (o !== a && o.hired && o.mode === 'free' && !friends.includes(o) && Math.random() < 0.5) o.flash(pick(['Ciddi?', 'Növbəti kim olacaq…', 'Yazıq oldu', 'Bunu gözləmirdim']), 3.5);
}
export const byId = id => AGENTS.find(a => a.id === id);
export { DEPTS };
