// Personajlar: görünüş, gündəlik həyat (iş, fikir, həmkara sual, fasilə) və kadr yeniləməsi.
import { THREE, scene, camera, M, box, cyl, sph } from './kit.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { findPath } from './nav.js';
import { SEATS, POIS } from './office.js';
import { PI, rand, pick, lerp, clamp, wrapA, hash, esc, clockStr, hooks, fileLink, shuffle } from './util.js';
import { TEAM, DEPTS } from '../team.js';
import { loadPeople, buildPerson, applyPose } from './people.js';

// skeletli modellər; yüklənməsə köhnə sadə fiqurlar qalır
const RIGGED = await loadPeople().then(() => true, e => { console.warn('Modellər yüklənmədi, sadə fiqurlar işlənir', e); return false; });

export const STATUS = {
  work:     ['İşləyir', '#2f7d5b'],
  think:    ['Düşünür', '#a1791f'],
  walk:     ['Yolda', '#4a6fa5'],
  break:    ['Fasilədə', '#7d6b98'],
  chat:     ['Söhbətdə', '#3b8a96'],
  meeting:  ['Görüşdə', '#b2622f'],
  campaign: ['Kampaniyada', '#a33a2e'],
  assigned: ['Tapşırıqda', '#1f5f4a'],
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
    const d = this.def, L = d.look;
    const g = this.group = new THREE.Group(); scene.add(g);
    if (RIGGED) {
      this.rig = buildPerson(d, this.color); g.add(this.rig.root);
      this.eyes = []; this.mouth = null;
      const hb = new THREE.Mesh(hitGeo, hitMat); hb.position.y = 1.1; hb.userData.agent = this; g.add(hb); hitboxes.push(hb);
      return;
    }
    const top = M(this.color, { r: 0.9 }), skin = M(L.skin, { r: 0.7 }), hair = M(L.hair, { r: 0.85 });
    const pants = M(L.pants || PANTS[hash(d.id) % PANTS.length]), shoe = M('#1d1e1f');
    const hip = 0.92;
    const leg = x => { const p = new THREE.Group(); p.position.set(x, hip, 0); box(p, 0.17, 0.86, 0.2, pants, 0, -0.43, 0, 0.04); box(p, 0.18, 0.08, 0.3, shoe, 0, -0.88, 0.04, 0.03); g.add(p); return p; };
    this.legL = leg(-0.1); this.legR = leg(0.1);
    box(g, 0.5, 0.66, 0.3, top, 0, hip + 0.33, 0, 0.08);
    const arm = x => { const p = new THREE.Group(); p.position.set(x, hip + 0.6, 0); box(p, 0.12, 0.58, 0.14, top, 0, -0.27, 0, 0.05); box(p, 0.1, 0.1, 0.11, skin, 0, -0.61, 0, 0.03); g.add(p); return p; };
    this.armL = arm(-0.32); this.armR = arm(0.32);
    box(g, 0.12, 0.1, 0.12, skin, 0, hip + 0.71, 0, 0.02);
    const h = this.head = new THREE.Group(); h.position.set(0, hip + 0.92, 0); g.add(h);
    box(h, 0.3, 0.34, 0.3, skin, 0, 0, 0, 0.1);
    const eyeD = M('#2a2826', { r: 0.4 });
    this.eyes = [];
    for (const sx of [-0.065, 0.065]) { const e = new THREE.Group(); e.position.set(sx, 0.02, 0.151); h.add(e); box(e, 0.035, 0.035, 0.01, eyeD, 0, 0, 0, 0.01, false); this.eyes.push(e); }
    box(h, 0.05, 0.012, 0.01, M(L.hair, { r: 0.9 }), -0.065, 0.065, 0.151, 0, false); box(h, 0.05, 0.012, 0.01, M(L.hair, { r: 0.9 }), 0.065, 0.065, 0.151, 0, false);
    this.mouth = box(h, 0.07, 0.012, 0.01, M('#7a4a40'), 0, -0.08, 0.151, 0, false);
    const st = L.style;
    if (st !== 'cap') box(h, 0.32, 0.09, 0.32, hair, 0, 0.17, -0.005, 0.04);
    if (st === 'short') { box(h, 0.32, 0.22, 0.08, hair, 0, 0.05, -0.13, 0.03); }
    if (st === 'long') { box(h, 0.34, 0.5, 0.09, hair, 0, -0.08, -0.13, 0.04); box(h, 0.05, 0.38, 0.22, hair, -0.16, -0.02, -0.03, 0.02); box(h, 0.05, 0.38, 0.22, hair, 0.16, -0.02, -0.03, 0.02); }
    if (st === 'bun') { box(h, 0.32, 0.24, 0.08, hair, 0, 0.04, -0.13, 0.03); sph(h, 0.09, hair, 0, 0.24, -0.1, 10); }
    if (st === 'curly') { for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) sph(h, 0.08, hair, -0.1 + i * 0.1, 0.19, -0.1 + j * 0.1, 7); box(h, 0.32, 0.2, 0.08, hair, 0, 0.04, -0.13, 0.03); }
    if (st === 'cap') { box(h, 0.33, 0.1, 0.32, '#3f4a44', 0, 0.17, 0, 0.04); box(h, 0.26, 0.02, 0.13, '#3f4a44', 0, 0.13, 0.2, 0.005); box(h, 0.32, 0.14, 0.06, hair, 0, 0.03, -0.13, 0.02); }
    if (L.acc === 'glasses') { const fr = M('#1f1f1f'); for (const sx of [-0.065, 0.065]) box(h, 0.08, 0.06, 0.01, M('#cfe0e6', { o: 0.35 }), sx, 0.02, 0.158, 0, false); box(h, 0.24, 0.012, 0.012, fr, 0, 0.05, 0.16, 0, false); }
    if (L.acc === 'headphones') { const band = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.02, 8, 18, PI), M('#222')); band.position.set(0, 0.02, 0); h.add(band); for (const sx of [-0.17, 0.17]) cyl(h, 0.06, 0.06, 0.05, '#2a2a2a', sx, 0, 0, 14).rotation.z = PI / 2; }
    if (L.acc === 'beret') { const b = cyl(h, 0.18, 0.17, 0.05, '#4a2e2a', 0.02, 0.22, -0.01, 16); b.rotation.z = -0.2; }
    if (L.acc === 'tie') { box(g, 0.05, 0.36, 0.015, '#5a2a26', 0, hip + 0.42, 0.155, 0); box(g, 0.18, 0.05, 0.015, '#f1ede6', 0, hip + 0.63, 0.153, 0); }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    const hb = new THREE.Mesh(hitGeo, hitMat); hb.position.y = 1.1; hb.userData.agent = this; g.add(hb); hitboxes.push(hb);
  }
  buildLabel() {
    const el = document.createElement('div'); el.className = 'lbl';
    el.innerHTML = `<div class="inner"><div class="bubble hide"><div class="bt"></div><div class="pbar"><i></i></div></div>
      <button class="tag" type="button"><span class="sdot"></span><span class="nm">${esc(this.def.name)}</span><span class="rl">${esc(this.def.role)}</span></button></div>`;
    this.el = el; this.elBubble = el.querySelector('.bubble'); this.elBT = el.querySelector('.bt');
    this.elBar = el.querySelector('.pbar'); this.elBarI = this.elBar.querySelector('i'); this.elDot = el.querySelector('.sdot');
    el.querySelector('.tag').addEventListener('pointerdown', e => { e.stopPropagation(); hooks.select(this, true); });
    const obj = new CSS2DObject(el); obj.position.set(0, 2.35, 0); this.group.add(obj);
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
  async routine() {
    if (!this.atHome()) await this.goHome();
    this.sitTarget = 1;
    while (true) {
      const r = Math.random();
      if (r < 0.5) await this.doWork();
      else if (r < 0.63) await this.doThink();
      else if (r < 0.8) await this.doCollab();
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
    this.status = 'think'; this.anim = 'think'; this.say(pick(THOUGHTS));
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
    const opts = POIS.filter(p => !p.busy && !(p.id === 'studio' && this.id === 'composer'));
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
    if (this.rig) { this.updateRig(dt, s, walking, sw, bob); if (this.flashT > 0) this.flashT -= dt; this.updateLabel(); return; }
    this.legL.rotation.x = lerp(sw, -1.45, s); this.legR.rotation.x = lerp(-sw, -1.45, s);
    this.group.position.set(this.pos.x, this.sitDrop * s + bob, this.pos.z);

    let aL = 0, aR = 0, zL = -0.05, zR = 0.05, hx = 0, hy = Math.sin(this.t * 0.4 + this.seed) * 0.12, hz = 0;
    if (walking) { aL = -sw * 0.8; aR = sw * 0.8; }
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
    const k = Math.min(1, dt * 10);
    this.armL.rotation.x += (aL - this.armL.rotation.x) * k; this.armR.rotation.x += (aR - this.armR.rotation.x) * k;
    this.armL.rotation.z += (zL - this.armL.rotation.z) * k; this.armR.rotation.z += (zR - this.armR.rotation.z) * k;
    this.head.rotation.x += (hx - this.head.rotation.x) * k; this.head.rotation.y += (hy - this.head.rotation.y) * k; this.head.rotation.z += (hz - this.head.rotation.z) * k;
    if (this.flashT > 0) this.flashT -= dt;
    this.updateLabel();
  }
  // Skeletli model: hər kadr sümük pozası. Dəyərlər hamar keçidlə (this.P) hədəfə yaxınlaşır.
  updateRig(dt, s, walking, sw, bob) {
    const t = this.t;
    const T = { aL: 0.05, aR: 0.05, zL: 0, zR: 0, eL: -0.15, eR: -0.15, hx: 0, hy: Math.sin(t * 0.4 + this.seed) * 0.12, hz: 0, lean: 0 };
    if (walking) { T.aL = -sw * 0.6; T.aR = sw * 0.6; T.eL = T.eR = -0.25; }
    else switch (this.anim) {
      case 'type': T.aL = T.aR = -0.55; T.eL = T.eR = -1.15; T.zL = T.zR = 0.05; T.eL += Math.sin(t * 16) * 0.05; T.eR += Math.sin(t * 16 + 2) * 0.05; T.hx = 0.12; T.hy *= 0.3; T.lean = 0.08; break;
      case 'think': T.aR = -0.9; T.eR = -2.3; T.zR = 0.25; T.aL = -0.35; T.eL = -1.4; T.hz = 0.08; T.hx = -0.06; break;
      case 'talk': T.aL = -0.3 + Math.sin(t * 3) * 0.25; T.eL = -0.9 + Math.sin(t * 2.4) * 0.3; T.aR = -0.4 + Math.sin(t * 3.7 + 1) * 0.3; T.eR = -1.0 + Math.sin(t * 2.9) * 0.3; T.hy = Math.sin(t * 1.5) * 0.18; break;
      case 'present': T.aR = -1.3 + Math.sin(t * 1.8) * 0.25; T.eR = -0.4; T.zR = -0.3; T.aL = -0.2; break;
      case 'drink': T.aR = -0.7 + Math.sin(t * 0.8) * 0.1; T.eR = -2.0; T.zR = 0.15; break;
      case 'phone': T.aR = -0.5; T.eR = -2.1; T.zR = 0.3; T.aL = -0.4; T.eL = -1.3; T.hx = 0.3; T.hy = 0; break;
    }
    if (this.waveT > 0) { this.waveT -= dt; T.aR = -2.6; T.zR = -0.5; T.eR = -0.6 + Math.sin(t * 12) * 0.35; }
    const P = (this.P ||= { ...T }), k = Math.min(1, dt * 10);
    for (const key in T) P[key] += (T[key] - P[key]) * k;
    applyPose(this.rig, {
      legL: lerp(sw, -1.5, s), legR: lerp(-sw, -1.5, s),
      kneeL: lerp(Math.max(0, sw) * 0.9, 1.5, s), kneeR: lerp(Math.max(0, -sw) * 0.9, 1.5, s),
      ...P,
    });
    // oturanda omba oturacağa düşür (model hündür: köhnə fiqurdan bir az aşağı)
    this.group.position.set(this.pos.x, (this.sitDrop - 0.12) * s + bob, this.pos.z);
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
export const byId = id => AGENTS.find(a => a.id === id);
export { DEPTS };
