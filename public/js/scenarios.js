// Ssenarilər: görüş, kampaniya, tapşırıq; divardakı lövhə və ekran.
import { THREE, FONT } from './kit.js';
import { kanbanTex, dashTex, meetingSpots } from './office.js';
import { AGENTS, byId, gsleep, sideSpot, DONE, BACKLOG } from './agents.js';
const nextHired = i => { for (let k = i + 1; k < PIPE.length; k++) if (byId(PIPE[k].id).hired) return k; return -1; };
import { rand, pick, clamp, shuffle, esc, hooks, fileLink } from './util.js';
import { PIPE, DEPTS } from '../team.js';
import { live } from '../live.js';

const PRESENT_LINES = ['Bu həftənin gündəliyi', 'Klinikanın yeni xidməti: brif cümə gəlir', 'Büdcə: Meta 40%, Google 30%, qalanı test', 'Mebel kampaniyası: çəkiliş çərşənbə', 'Sual, fikir?'];
const COMMENTS = ['Razıyam', 'Reels formatı da əlavə edək', 'TikTok-u sınayaq', 'Dizaynı mən götürürəm', 'Jingle yazaram', 'Rəqəmləri izləyəcəm', 'Bloqerlərlə danışaram', 'Landing-i yeniləyək', 'Bu büdcəyə sığmaz'];

/* ---------------- divar: ekran (nümunə rəqəmlər) ---------------- */
const KPI = { reach: 1.24e6, ctr: 2.6, roas: 3.8, leads: 1280, hist: Array.from({ length: 16 }, () => rand(35, 70)) };
const fmt = n => (n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : Math.round(n) + '');
export function drawDash() {
  const g = dashTex.userData.ctx, w = 1024, h = 444;
  g.fillStyle = '#1b1e1c'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#ece7dc'; g.font = `600 30px ${FONT}`; g.fillText('Kampaniya göstəriciləri', 32, 52);
  g.fillStyle = '#8a8f8a'; g.font = `400 20px ${FONT}`; g.fillText('nümunə rəqəmlər, real data qoşulmayıb', 32, 82);
  const tiles = [['Əhatə', fmt(KPI.reach)], ['CTR', KPI.ctr.toFixed(2) + '%'], ['ROAS', KPI.roas.toFixed(1) + '×'], ['Lead', fmt(KPI.leads)]];
  tiles.forEach(([l, v], i) => {
    const x = 32 + i * 244; g.fillStyle = '#262a27'; g.fillRect(x, 104, 228, 100);
    g.fillStyle = '#8a8f8a'; g.font = `500 20px ${FONT}`; g.fillText(l, x + 16, 136);
    g.fillStyle = '#ece7dc'; g.font = `600 40px ${FONT}`; g.fillText(v, x + 16, 186);
  });
  g.fillStyle = '#262a27'; g.fillRect(32, 222, 960, 194);
  const H = KPI.hist, bw = 960 / H.length;
  H.forEach((v, i) => { const bh = v * 2.2; g.fillStyle = '#5f7f6c'; g.fillRect(32 + i * bw + 14, 404 - bh, bw - 28, bh); });
  dashTex.needsUpdate = true;
}
export function tickKPI(boost = 0) {
  KPI.reach *= 1 + rand(0.0005, 0.004) + boost * 0.12;
  KPI.ctr = clamp(KPI.ctr + rand(-0.04, 0.05) + boost * 0.4, 1.2, 6.5);
  KPI.roas = clamp(KPI.roas + rand(-0.05, 0.06) + boost * 0.6, 2, 9);
  KPI.leads += rand(0, 6) + boost * 260;
  KPI.hist.shift(); KPI.hist.push(clamp(KPI.hist[KPI.hist.length - 1] + rand(-8, 10) + boost * 25, 15, 78));
  drawDash();
}

/* ---------------- divar: mantar lövhə ---------------- */
function note(g, x, y, w, text, dept, R) {
  g.save(); g.translate(x + w / 2, y + 20); g.rotate((R - 0.5) * 0.03);
  g.fillStyle = '#f6f1e4'; g.shadowColor = 'rgba(0,0,0,.18)'; g.shadowBlur = 4; g.shadowOffsetY = 2; g.fillRect(-w / 2, -20, w, 40); g.shadowColor = 'transparent';
  g.fillStyle = DEPTS[dept].color; g.fillRect(-w / 2, -20, 4, 40);
  g.fillStyle = '#2d2f2c'; g.font = `500 18px ${FONT}`;
  let t = text; while (g.measureText(t).width > w - 24 && t.length > 3) t = t.slice(0, -2);
  if (t !== text) t = t.trimEnd() + '…';
  g.fillText(t, -w / 2 + 14, 7); g.restore();
}
let lastKanban = '';
export function drawKanban(force) {
  const doing = AGENTS.filter(a => ['work', 'campaign', 'assigned'].includes(a.status) && a.task).slice(0, 7).map(a => ({ text: `${a.def.name}: ${a.task}`, dept: a.def.dept }));
  const key = doing.map(d => d.text).join('|') + DONE.map(d => d.text).join('|');
  if (!force && key === lastKanban) return; lastKanban = key;
  const g = kanbanTex.userData.ctx, w = 1024, h = 446;
  g.fillStyle = '#b8936a'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(80,50,20,${Math.random() * 0.12})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  const cols = [['Plan', BACKLOG], ['İcrada', doing], ['Hazır', DONE.slice(0, 7).map(d => ({ text: `${d.who}: ${d.text}`, dept: d.dept }))]];
  cols.forEach(([title, items], i) => {
    const x = 20 + i * 334;
    g.fillStyle = '#2d2f2c'; g.font = `600 22px ${FONT}`; g.fillText(`${title}  ${items.length}`, x + 10, 38);
    items.slice(0, 7).forEach((it, j) => note(g, x + 6, 54 + j * 54, 306, it.text, it.dept, ((j * 7 + i * 3) % 10) / 10));
  });
  kanbanTex.needsUpdate = true;
}

/* ---------------- görüş ---------------- */
export let meeting = null;
export async function callMeeting() {
  if (meeting) { hooks.toast('Görüş artıq gedir'); return; }
  const cmo = byId('cmo');
  const parts = shuffle(AGENTS.filter(a => a.mode === 'free' && a.hired && a !== cmo)).slice(0, 6);
  const m = meeting = { arrived: 0, done: false };
  const spots = meetingSpots(), PRESENT = spots.present;
  const seats = spots.seats.map(s => ({ ...s, busy: null }));
  hooks.log(null, '<b>Planlaşdırma görüşü</b> başlayır, komanda görüş otağına keçir');
  const cmoIn = cmo.mode !== 'campaign';
  if (cmoIn) cmo.run(async () => {
    await cmo.walkTo(PRESENT.x, PRESENT.z, PRESENT.rot);
    cmo.status = 'meeting'; cmo.anim = 'present'; cmo.say('Deməli belə, başlayaq'); m.arrived++;
    while (!m.done) await cmo.sleep(0.5);
  }, 'meeting');
  parts.forEach((a, i) => {
    const seat = seats[i]; seat.busy = a;
    a.run(async () => {
      a.meetSeat = seat;
      await a.walkTo(seat.x, seat.z, seat.rot, seat.drop);
      a.status = 'meeting'; a.anim = 'idle'; a.say('Qeyd götürür'); m.arrived++;
      while (!m.done) await a.sleep(0.5);
      a.meetSeat = null; seat.busy = null;
    }, 'meeting');
  });
  const expected = parts.length + (cmoIn ? 1 : 0);
  let t = 0; while (m.arrived < expected && t < 28) { await gsleep(0.5); t += 0.5; }
  for (const line of PRESENT_LINES) {
    if (cmo.mode === 'meeting') cmo.say(line);
    await gsleep(3.2);
    const p = pick(parts); if (p.mode === 'meeting') p.flash(pick(COMMENTS), 3);
    await gsleep(1.6);
  }
  m.done = true;
  hooks.log(null, 'Görüş bitdi, hamı masasına qayıdır');
  await gsleep(1); meeting = null;
}

/* ---------------- kampaniya ---------------- */
export const camp = { cur: null }; // { id, name, step, error, done, file }
const render = () => hooks.renderCampaign();

async function handoff(a, i, name) {
  const st = PIPE[i], k = nextHired(i), nx = k >= 0 ? byId(PIPE[k].id) : byId('cmo');
  if (nx === a || !nx.hired) return;
  if (k >= 0) nx.run(async () => {
    if (!nx.atHome()) await nx.goHome();
    nx.status = 'campaign'; nx.anim = 'idle'; nx.say('Təhvil gözləyir');
    await nx.sleep(9999);
  }, 'campaign');
  const sp = sideSpot(nx);
  await a.walkTo(sp.x, sp.z, sp.rot);
  a.anim = 'talk'; a.say(`${st.out} hazırdır`);
  nx.flash(k >= 0 ? 'Aldım, başlayıram' : 'Yaxşı iş, komanda', 3);
  await a.sleep(2.6);
}

async function startCampaignLive(name) {
  if (camp.cur) { hooks.toast('Bir kampaniya artıq gedir'); return; }
  let cid;
  try { ({ campaignId: cid } = await live.campaign(name)); } catch (e) { hooks.toast(e.message); return; }
  hooks.log(null, `<b>«${esc(name)}»</b> kampaniyası başladı${live.mode === 'live' ? '' : ' (demo)'}`);
  return followCampaign(cid, name, 0);
}
export async function resumeCampaign(cid, name) {
  if (camp.cur) { hooks.toast('Bir kampaniya artıq gedir'); return; }
  let from;
  try { ({ from } = await live.resume(cid)); } catch (e) { hooks.toast(e.message); return; }
  hooks.log(null, `<b>«${esc(name)}»</b> ${from + 1}-ci addımdan davam edir`);
  return followCampaign(cid, name, from);
}
export const resumeLink = (id, name) => `<a href="#" class="flink" data-resume="${esc(id)}" data-name="${esc(name)}">davam et</a>`;
document.addEventListener('click', e => { const l = e.target.closest('[data-resume]'); if (l) { e.preventDefault(); resumeCampaign(l.dataset.resume, l.dataset.name); } });

// Serverdəki kampaniyanı izləyir: from-dan əvvəlki addımlar artıq hazırdır.
export async function followCampaign(cid, name, from) {
  if (camp.cur) return;
  camp.cur = { id: cid, name, step: from }; render();
  const C = () => (live.camp && live.camp.id === cid ? live.camp : null);
  const stepOf = i => C()?.steps[i];
  for (let i = from; i < PIPE.length; i++) {
    if (C()?.error) break;
    camp.cur.step = i; render();
    const st = PIPE[i], a = byId(st.id);
    if (!a.hired) { while (!stepOf(i)?.done && !C()?.error) await gsleep(0.4); continue; } // bu rolda işçi yoxdur
    await a.run(async () => {
      a.task = `${st.task} («${name}»)`; a.say(st.task);
      if (!a.atHome()) { await a.goHome(); a.say(st.task); }
      a.status = 'campaign'; a.anim = 'type';
      try {
        while (!stepOf(i)?.done && !C()?.error) {
          const s = stepOf(i); a.liveProg = s ? Math.min(0.95, 0.04 + s.chars / 1800) : 0.04;
          if (s?.tail) a.say('…' + s.tail.replace(/\s+/g, ' ').slice(-70));
          await a.sleep(0.4);
        }
      } finally { a.liveProg = null; }
      if (C()?.error) { a.anim = 'idle'; a.say('Addım alınmadı'); await a.sleep(3); return; }
      a.completed(`${st.task}: «${name}»`, false, stepOf(i).file);
      await handoff(a, i, name);
    }, 'campaign');
    while (!stepOf(i)?.done && !C()?.error) await gsleep(0.4);
  }
  if (C()?.error) {
    camp.cur.error = C().error; render();
    hooks.log(null, `<b>«${esc(name)}»</b> dayandı: ${esc(C().error)}. ${resumeLink(cid, name)}`); hooks.toast('Kampaniya dayandı');
    await gsleep(4); camp.cur = null; render(); return;
  }
  while (!C()?.done) await gsleep(0.4);
  camp.cur.step = PIPE.length; camp.cur.done = true; camp.cur.file = C().file; render();
  for (let k = 0; k < 4; k++) tickKPI(1);
  hooks.log(null, `<b>«${esc(name)}»</b> hazırdır. ${fileLink(C().file, `Kampaniya: ${name}`, 'yekun sənəd')}`);
  hooks.toast(`«${name}» hazırdır`);
  await gsleep(8); camp.cur = null; render();
}

// Server yoxdursa: yalnız animasiya.
export async function startCampaign(name) {
  if (live.on) return startCampaignLive(name);
  if (camp.cur) { hooks.toast('Bir kampaniya artıq gedir'); return; }
  camp.cur = { id: null, name, step: 0, sim: true }; render();
  hooks.log(null, `<b>«${esc(name)}»</b> kampaniyası başladı (simulyasiya)`);
  for (let i = 0; i < PIPE.length; i++) {
    camp.cur.step = i; render();
    const st = PIPE[i], a = byId(st.id);
    if (!a.hired) continue;
    await a.run(async () => {
      a.task = `${st.task} («${name}»)`; a.say(st.task);
      if (!a.atHome()) { await a.goHome(); a.say(st.task); }
      a.status = 'campaign'; a.anim = 'type';
      await a.sleep(rand(5, 7), true);
      a.completed(`${st.task}: «${name}»`, true);
      await handoff(a, i, name);
    }, 'campaign');
  }
  camp.cur.step = PIPE.length; camp.cur.done = true; render();
  for (let k = 0; k < 4; k++) tickKPI(1);
  hooks.log(null, `<b>«${esc(name)}»</b> bitdi (simulyasiya)`);
  await gsleep(8); camp.cur = null; render();
}

/* ---------------- tapşırıq ---------------- */
async function assignTaskLive(a, text, opts = {}) {
  let jobId;
  try { jobId = await live.task(a.id, text, opts.docs === true); }
  catch (e) { hooks.toast(e.message); return; }
  hooks.log(a, `tapşırıq aldı: “${esc(text)}”${live.mode === 'mock' ? ' (demo)' : ''}`);
  hooks.toast(`${a.def.name} tapşırığı aldı`);
  a.run(async () => {
    const job = () => live.jobs.get(jobId);
    a.task = text; a.say(text);
    if (!a.atHome()) { await a.goHome(); a.say(text); }
    a.status = 'assigned'; a.anim = 'type';
    try {
      while (!job()?.done) {
        const j = job(); a.liveProg = j ? Math.min(0.95, 0.04 + j.chars / 1800) : 0.04;
        if (j?.tail) a.say('…' + j.tail.replace(/\s+/g, ' ').slice(-70));
        await a.sleep(0.4);
      }
    } finally { a.liveProg = null; }
    a.anim = 'idle';
    a.say(job().error ? `Alınmadı: ${text}` : `Hazırdır: ${text}`);
    await a.sleep(3);
  }, 'task');
}
live.sub('job', ({ phase, agentId, text, file, error }) => {
  const a = byId(agentId); if (!a) return;
  if (phase === 'done') { a.completed(text, true, file); a.flash('Hazırdır', 2.5); }
  if (phase === 'error') { hooks.log(a, `“${esc(text)}” alınmadı: ${esc(error)}`); a.flash('Alınmadı', 3); }
});

export function assignTask(a, text, opts = {}) {
  if (live.on) return assignTaskLive(a, text, opts);
  hooks.log(a, `tapşırıq aldı: “${esc(text)}” (simulyasiya)`);
  a.run(async () => {
    a.task = text; a.say(text);
    if (!a.atHome()) { await a.goHome(); a.say(text); }
    a.status = 'assigned'; a.anim = 'type';
    await a.sleep(rand(10, 14), true);
    a.anim = 'idle'; a.say(`Hazırdır: ${text}`); a.completed(text, true);
    await a.sleep(3);
  }, 'task');
}
