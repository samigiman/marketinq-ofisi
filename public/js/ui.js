// İnterfeys: yuxarı zolaq, komanda siyahısı, sağ panel (ofis və ya personaj), dialoqlar, kompüter pəncərəsi.
import { THREE, scene, camera, controls } from './kit.js';
import { STAGE } from './office.js';
import { AGENTS, STATUS, byId, setSelectedAgent, topColor } from './agents.js';
import { JOURNAL, onJournal } from './monitors.js';
import { camp, startCampaign, callMeeting, assignTask, resumeLink } from './scenarios.js';
import { PI, pick, esc, initials, clockStr, hooks, icon, fileLink } from './util.js';
import { TEAM, DEPTS, PERSONAS, PIPE, WORLD } from '../team.js';
import { live } from '../live.js';
import { openBook } from '../book.js';

const $ = id => document.getElementById(id);
const mobile = () => matchMedia('(max-width:900px)').matches;

/* ---------------- lent və bildiriş ---------------- */
const feed = [];
export function log(agent, html) {
  feed.unshift(`<div><span class="tm">${clockStr()}</span>${agent ? `<b>${esc(agent.def.name)}</b> ` : ''}${html}</div>`);
  if (feed.length > 60) feed.pop();
  if (!selected) { const f = $('feed'); if (f) f.innerHTML = feed.join(''); }
}
let toastT;
export function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }

/* ---------------- yuxarı: üzən şüşə zolaqlar və aşağıda dok ---------------- */
$('hud-l').innerHTML = `<div class="brand"><b>${esc(WORLD.company)}</b><span>${esc(WORLD.floor)}</span></div>
  <span id="clock">09:00</span><span id="liveBadge" class="mode off"><i></i>Simulyasiya</span>`;
$('hud-r').innerHTML = `
  <button class="iconbtn desk-only" id="btnCam" title="Kamera bucağı" aria-label="Kamera bucağı">${icon('video')}</button>
  <button class="iconbtn on desk-only" id="btnNames" title="Adları göstər" aria-label="Adları göstər">${icon('tag')}</button>
  <button class="iconbtn" id="btnBook" title="Ofisin kitabı" aria-label="Ofisin kitabı">${icon('book')}</button>`;
$('dock').innerHTML = `
  <button id="dTeam" type="button">${icon('users')}Komanda</button>
  <button id="dLog" type="button">${icon('terminal')}Jurnal</button>
  <span class="sep"></span>
  <button id="btnCamp" type="button">${icon('rocket')}Kampaniya</button>
  <button id="btnMeet" type="button">${icon('calendar')}Görüş</button>
  <button id="btnOut" type="button">${icon('folder')}İşlər</button>
  <button id="btnSocial" type="button">${icon('phone')}Sosial</button>`;

/* ---------------- sol: komanda (üzən panel) ---------------- */
const rowEls = {};
$('left').innerHTML = `
  <div class="side-h"><h2>Komanda</h2><span class="small muted" id="teamCount"></span><button class="iconbtn" id="lX" aria-label="Bağla">${icon('x')}</button></div>
  <div id="team"></div>`;
const setLeft = open => { $('left').classList.toggle('open', open); $('dTeam').classList.toggle('on', open); if (open && mobile()) setRight(false); };
const setRight = open => { $('right').classList.toggle('open', open); $('dLog').classList.toggle('on', open && !selected); if (open && mobile()) setLeft(false); };
$('lX').onclick = () => setLeft(false);
$('dTeam').onclick = () => setLeft(!$('left').classList.contains('open'));
$('dLog').onclick = () => { if (selected) { select(null); setRight(true); } else setRight(!$('right').classList.contains('open')); };
// Komanda: işləyənlər şöbələr üzrə, aşağıda namizədlər (işə götür düyməsi ilə).
let staffInfo = null;
export async function renderTeam(st) {
  if (st) staffInfo = st; else if (live.on) staffInfo = await live.staff().catch(() => staffInfo);
  const hired = AGENTS.filter(a => a.hired);
  const cands = staffInfo ? staffInfo.candidates.map(byId).filter(Boolean) : AGENTS.filter(a => !a.hired);
  for (const k of Object.keys(rowEls)) delete rowEls[k];
  const box = $('team'); box.innerHTML = '';
  for (const [k, dp] of Object.entries(DEPTS)) {
    const list = hired.filter(a => a.def.dept === k); if (!list.length) continue;
    const h = document.createElement('div'); h.className = 'dept'; h.textContent = dp.name; box.appendChild(h);
    for (const a of list) {
      const r = document.createElement('button'); r.type = 'button'; r.className = 'row' + (selected === a ? ' sel' : '');
      r.innerHTML = `<span class="av" style="--c:${a.color}">${esc(initials(a.def.name))}</span><span class="info"><span class="n">${esc(a.def.name)}<small>${esc(a.def.role)}</small></span>
        <span class="st"><i class="sdot"></i><span class="tx"></span></span></span>`;
      r.onclick = () => { select(a, true); if (mobile()) setLeft(false); };
      box.appendChild(r);
      rowEls[a.id] = { r, dot: r.querySelector('.sdot'), tx: r.querySelector('.tx') };
    }
  }
  if (cands.length) {
    const h = document.createElement('div'); h.className = 'dept'; h.textContent = 'İşə götürmək olar'; box.appendChild(h);
    for (const a of cands) {
      const p = PERSONAS[a.id] || {};
      const r = document.createElement('div'); r.className = 'cand';
      const past = staffInfo?.past?.includes(a.id), ex = staffInfo?.exp?.[a.id];
      r.innerHTML = `<span class="av" style="--c:${a.color}">${esc(initials(a.def.name))}</span><span class="info"><span class="n">${esc(a.def.name)}<small>${esc(a.def.role)}</small></span>
        ${past ? `<span class="tagx">əvvəl burada işləyib${ex?.n ? ` · ${ex.n} iş görüb` : ''}</span>` : ''}
        <span class="small muted">${p.age}, ${esc(p.from || '')}. ${esc(p.bio || '')}</span></span><button class="btn sm" type="button">${past ? 'Geri götür' : 'İşə götür'}</button>`;
      r.querySelector('button').onclick = () => hire(a);
      box.appendChild(r);
    }
  }
  if (staffInfo?.edition === 'public') box.insertAdjacentHTML('beforeend', '<p class="hint" style="padding:8px">Bu versiyada dijital marketinq və reklam yerləşdirmə vəzifələri yoxdur.</p>');
  $('teamCount').textContent = `${hired.length} nəfər`;
  if (selected) renderMeta(selected);
}
async function hire(a) {
  if (!live.on) { toast('İşə götürmək üçün server lazımdır'); return; }
  try { await live.hire(a.id); } catch (e) { toast(e.message); }
}
async function fire(a) {
  if (!live.on) { toast('Bunun üçün server lazımdır'); return; }
  if (!confirm(`${a.def.name} işdən çıxarılsın? Komandada hamı bunu biləcək.`)) return;
  try { await live.fire(a.id); } catch (e) { toast(e.message); }
}

/* ---------------- sağ panel ---------------- */
const right = $('right');
export let selected = null;
let follow = false, curTab = 'chat';
const teamsView = new Map(); // komanda işləri (renderOffice ilk yüklənmədə də istifadə edir)
const selRing = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.68, 40), new THREE.MeshBasicMaterial({ color: '#1f5f4a', transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }));
selRing.rotation.x = -PI / 2; selRing.visible = false; scene.add(selRing);
export const followState = () => follow;
export const stopFollow = () => { follow = false; };

function renderOffice() {
  right.innerHTML = `<div class="side-h"><h2>Ofis</h2><button class="iconbtn" id="rX" aria-label="Bağla">${icon('x')}</button></div><div class="scroll"><section class="sec" id="campSec"></section>
    <section class="sec" id="teamSec"></section>
    <section class="sec"><h3 class="lab">Ofis jurnalı</h3><div class="feed" id="feed">${feed.join('') || '<div class="empty">Hələ heç nə olmayıb.</div>'}</div></section>
    <section class="sec"><h3 class="lab">Ortaq yaddaş</h3><p class="hint" style="margin:0 0 8px">Ofisdə hamının bildiyi: sizin iradlarınız heç vaxt unudulmur, ofis xəbərləri isə zamanla solur.</p><div class="feed" id="sharedList"><div class="empty">Yüklənir…</div></div></section>
    <section class="sec"><h3 class="lab">Təcrübə kitabı</h3><p class="hint" style="margin:0 0 8px">Bitən hər iş buraya yazılır. Hər kəs işə başlayanda öz sahəsinə aid olanı oxuyur.</p><div class="feed" id="bookList"><div class="empty">Yüklənir…</div></div></section></div>`;
  loadBook(); loadShared(); renderTeams();
  $('rX').onclick = () => setRight(false);
  renderCampaign();
}

// kampaniya: sağ paneldə addımlar, yuxarıda qısa vəziyyət
export function renderCampaign() {
  const c = camp.cur, chip = $('campChip');
  if (!c) { chip.className = ''; chip.innerHTML = ''; } else {
    chip.className = 'show';
    chip.innerHTML = `${icon('rocket', 16)}<span>«${esc(c.name)}» · ${c.done ? 'hazırdır' : c.error ? 'dayandı' : `${Math.min(c.step + 1, PIPE.length)}/${PIPE.length}`}</span>`;
    chip.onclick = () => { select(null); setRight(true); };
  }
  const sec = $('campSec'); if (!sec) return;
  if (!c) { sec.innerHTML = `<h3 class="lab">Kampaniya</h3><div class="empty">Gedən kampaniya yoxdur. Aşağıdakı <b>Kampaniya</b> düyməsi ilə başladın.</div>`; return; }
  sec.innerHTML = `<h3 class="lab">Kampaniya: «${esc(c.name)}»</h3>
    ${c.error ? `<p class="small" style="color:var(--err)">${esc(c.error)} ${c.id ? resumeLink(c.id, c.name) : ''}</p>` : ''}
    ${c.done && c.file ? `<p class="small">${fileLink(c.file, `Kampaniya: ${c.name}`, 'Yekun sənədi aç')}</p>` : ''}
    <div class="steps">${PIPE.map((s, i) => {
      const a = byId(s.id), state = i < c.step || c.done ? 'done' : i === c.step ? (c.error ? 'err' : 'run') : '';
      const txt = state === 'done' ? 'hazırdır' : state === 'run' ? 'işləyir' : state === 'err' ? 'alınmadı' : 'gözləyir';
      return `<div class="step ${state}"><span class="ix">${String(i + 1).padStart(2, '0')}</span><span class="b"><b>${esc(a.def.name)}</b> · ${esc(s.task)}<div class="s">${txt}</div></span></div>`;
    }).join('')}</div>`;
}
hooks.renderCampaign = renderCampaign;

const SUGG = ['Bu gün nə üzərində işləyirsən?', 'Bu işə necə gəlmisən?', 'Komandada kimlə yaxşı işləyirsən?', 'Hazırkı işimizdə nəyi bəyənmirsən?'];
const CHATS = (() => { try { return JSON.parse(localStorage.getItem('ofis-chats') || '{}'); } catch { return {}; } })();
const saveChats = () => { try { localStorage.setItem('ofis-chats', JSON.stringify(CHATS)); } catch {} };
const rich = t => esc(t).replace(/\*([^*\n]{1,120})\*/g, '<em>$1</em>').replace(/_\(([^)]*)\)_/g, '<em>($1)</em>');
const activityOf = a => `${STATUS[a.status][0]}: ${a.task || a.bubbleText || 'masasında'}`;

export function select(a, focus = false) {
  if (selected) { selected.el.classList.remove('sel'); rowEls[selected.id]?.r.classList.remove('sel'); selected.faceBoss = false; }
  selected = a; setSelectedAgent(a);
  if (!a) { selRing.visible = false; follow = false; renderOffice(); $('dLog').classList.toggle('on', right.classList.contains('open')); return; }
  a.el.classList.add('sel'); rowEls[a.id]?.r.classList.add('sel');
  rowEls[a.id]?.r.scrollIntoView({ block: 'nearest' });
  selRing.visible = true;
  a.faceBoss = true; a.waveT = 1.2;
  renderPerson(a);
  setRight(true); $('dLog').classList.remove('on');
  if (focus) { follow = true; focusOn(a, 12); }
}
hooks.select = select;

function renderPerson(a) {
  const d = a.def, p = PERSONAS[a.id] || {};
  const modeHint = live.mode === 'live' ? `Tapşırıq ${d.name}-ın kompüterində real agentlə gedir.` : live.mode === 'mock' ? 'Demo rejim: model çağırılmır, nəticə nümunədir.' : 'Server qoşulu deyil: yalnız animasiya gedir.';
  right.innerHTML = `
    <div class="p-head"><span class="av lg" style="--c:${a.color}">${esc(initials(d.name))}</span>
      <div class="who"><h2>${esc(d.name)}</h2><div class="role">${esc(d.role)} · ${p.age}, ${esc(p.from || '')}</div><p class="p-bio">${esc(p.view || '')}</p></div>
      <button class="iconbtn" id="pX" aria-label="Bağla">${icon('x')}</button></div>
    <div class="p-now"><i class="sdot" id="nowDot"></i><span class="t" id="nowT"></span></div>
    <div class="p-meta" id="pMeta"></div>
    <div class="bar" style="margin:0 16px"><i id="nowP"></i></div>
    <div class="tabs" role="tablist"><button data-tab="chat">Söhbət</button><button data-tab="work">Tapşırıq</button><button data-tab="pc">Kompüter</button><button data-tab="mem">Yaddaş</button></div>
    <div class="pane" data-pane="chat">
      <div id="chatLog"></div>
      <div class="sugg">${SUGG.map(s => `<button type="button">${esc(s)}</button>`).join('')}</div>
      <form class="composer" id="chatForm"><input type="text" id="chatIn" maxlength="500" placeholder="${esc(d.name)} ilə danışın" autocomplete="off"><button class="btn primary" aria-label="Göndər">${icon('send', 16)}</button></form>
    </div>
    <div class="pane" data-pane="work"><div class="scroll">
      <h3 class="lab">Tapşırıq ver</h3>
      <form class="inline" id="taskForm"><input type="text" id="taskIn" maxlength="300" placeholder="məs: ${esc(pick(d.tasks))}" autocomplete="off"><button class="btn primary">Göndər</button></form>
      <label class="check"><input type="checkbox" id="taskDocs"> Ortaq qovluqdan material götür (Drive, Canva)</label>
      <p class="hint">${modeHint} Material götürüləndə yalnız oxunur, heç nə dəyişdirilmir; bu tapşırıqda internet bağlı olur.</p>
      <h3 class="lab" style="margin-top:20px">Bacarıqlar</h3><div class="skills">${d.skills.map(s => `<span class="chip">${esc(s)}</span>`).join('')}</div>
      <h3 class="lab" style="margin-top:20px">Bu gün görülən işlər</h3><div class="hist" id="dH"></div>
      <h3 class="lab" style="margin-top:20px">Qorxusu</h3><p class="small muted" style="margin:0">${esc(p.fear || '')}</p>
      ${a.id !== 'cmo' ? '<p style="margin-top:20px"><button class="btn sm danger" id="fireBtn" type="button">İşdən çıxar</button></p>' : ''}
    </div></div>
    <div class="pane" data-pane="pc"><div class="scroll" id="pcBox"></div></div>
    <div class="pane" data-pane="mem"><div class="scroll" id="memBox"></div></div>`;
  $('pX').onclick = () => { select(null); setRight(false); };
  right.querySelectorAll('.tabs button').forEach(b => (b.onclick = () => setTab(b.dataset.tab)));
  right.querySelectorAll('.sugg button').forEach(b => (b.onclick = () => sendChat(a, b.textContent)));
  $('chatForm').onsubmit = e => { e.preventDefault(); const i = $('chatIn'); const v = i.value.trim(); if (v) { i.value = ''; sendChat(a, v); } };
  $('fireBtn') && ($('fireBtn').onclick = () => fire(a));
  $('taskForm').onsubmit = e => { e.preventDefault(); const i = $('taskIn'); const v = i.value.trim() || i.placeholder.replace(/^məs: /, ''); i.value = ''; assignTask(a, v, { docs: $('taskDocs').checked }); };
  renderChat(a); setTab(curTab); refreshDetail(true); renderMeta(a);
}
// əhval və təcrübə səviyyəsi
const MOOD_TXT = { yaxşı: 'Əhvalı yaxşıdır', normal: 'Əhvalı normaldır', narahat: 'Narahatdır', pis: 'Əhvalı pisdir' };
function renderMeta(a) {
  const el = $('pMeta'); if (!el) return;
  const m = a.mood, ex = staffInfo?.exp?.[a.id];
  el.innerHTML = `<span class="meter" title="Əhval"><i style="width:${Math.round((m?.v ?? 0.7) * 100)}%;background:${(m?.v ?? 0.7) < 0.45 ? 'var(--err)' : (m?.v ?? 0.7) < 0.6 ? 'var(--wait)' : 'var(--acc)'}"></i></span>
    <span>${esc(MOOD_TXT[m?.label] || 'Əhvalı normaldır')}${m?.why && m.label !== 'normal' ? `: ${esc(m.why)}` : ''}</span>
    <span class="lvl">${ex ? `${esc(ex.level)} · ${ex.n} iş` : ''}</span>`;
}

function setTab(t) {
  curTab = t;
  right.querySelectorAll('.tabs button').forEach(b => { b.classList.toggle('on', b.dataset.tab === t); b.setAttribute('aria-selected', b.dataset.tab === t); });
  right.querySelectorAll('.pane').forEach(p => p.classList.toggle('on', p.dataset.pane === t));
  if (t === 'mem' && selected) loadMemories(selected);
  if (t === 'pc' && selected) loadComputer(selected);
  if (t === 'chat' && !mobile()) setTimeout(() => $('chatIn')?.focus(), 50);
}

function renderChat(a) {
  const el = $('chatLog'); if (!el) return;
  const msgs = CHATS[a.id] || [];
  el.innerHTML = (msgs.length ? '' : `<div class="empty">${esc(a.def.name)} ilə hələ danışmamısınız.</div>`) +
    msgs.map(m => `<div class="msg ${m.role === 'me' ? 'me' : 'them'}">${rich(m.text)}</div>`).join('');
  el.scrollTop = el.scrollHeight;
}

const busyChat = new Set();
async function sendChat(a, text) {
  if (busyChat.has(a.id)) return;
  if (!live.on) { toast('Söhbət üçün server lazımdır: npm start'); return; }
  const msgs = (CHATS[a.id] ||= []);
  msgs.push({ role: 'me', text }); saveChats();
  const isOpen = () => selected === a && curTab === 'chat';
  if (isOpen()) renderChat(a);
  const logEl = () => (isOpen() ? $('chatLog') : null);
  const bubble = document.createElement('div'); bubble.className = 'msg them typing'; bubble.textContent = 'yazır…';
  logEl()?.appendChild(bubble); if (logEl()) logEl().scrollTop = logEl().scrollHeight;
  busyChat.add(a.id); a.speaking = true; a.faceBoss = true;
  let reply = '';
  try {
    const r = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agentId: a.id, message: text, history: msgs.slice(0, -1).slice(-10), activity: activityOf(a) }) });
    if (!r.ok || !r.body) throw new Error((await r.json().catch(() => ({}))).error || 'Cavab gəlmədi');
    const rd = r.body.getReader(), dec = new TextDecoder();
    for (;;) {
      const { value, done } = await rd.read(); if (done) break;
      reply += dec.decode(value, { stream: true });
      bubble.classList.remove('typing'); bubble.innerHTML = rich(reply);
      if (logEl()) logEl().scrollTop = logEl().scrollHeight;
      const clean = reply.replace(/\*[^*]*\*/g, '').trim();
      if (clean) a.say(clean.length > 70 ? '…' + clean.slice(-68) : clean);
    }
  } catch (e) { reply = `Xəta: ${e.message}`; }
  busyChat.delete(a.id); a.speaking = false;
  reply = reply.trim() || '…';
  msgs.push({ role: 'them', text: reply }); if (msgs.length > 40) msgs.splice(0, msgs.length - 40); saveChats();
  const clean = reply.replace(/\*[^*]*\*/g, '').replace(/\s+/g, ' ').trim();
  a.flash(clean.length > 80 ? clean.slice(0, 78) + '…' : clean, 5);
  if (isOpen()) renderChat(a); else log(a, 'sizə cavab yazdı');
}

async function loadMemories(a) {
  const box = $('memBox'); if (!box) return;
  if (!live.on) { box.innerHTML = '<div class="empty">Yaddaş server işləyəndə görünür.</div>'; return; }
  box.innerHTML = '<div class="empty">Yüklənir…</div>';
  try {
    const j = await fetch('/api/agent?id=' + a.id).then(r => r.json());
    if (selected !== a) return;
    const when = t => new Date(t).toLocaleString('az-AZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    // İnsan yaddaşı: iş dəqiq qalır, gündəlik şeylər solur. Rəhbər həm indi necə xatırladığını, həm aslını görür.
    const ST = { is: 'İş · dəqiq', 'aydın': 'Aydın', 'dumanlı': 'Dumanlı', unudulub: 'Unudub' };
    const s = j.stages || {};
    const sum = Object.keys(ST).filter(k => s[k]).map(k => `${s[k]} ${ST[k].toLowerCase()}`).join(' · ');
    box.innerHTML = `<p class="hint" style="margin:0 0 4px">${j.count} xatirə${sum ? ' · ' + sum : ''}</p>
      <p class="hint" style="margin:0 0 12px">İşlə bağlı hər şey tam yadında qalır. Gündəlik hadisələr zamanla solur, yada düşəndə isə möhkəmlənir.</p>` +
      (j.memories.length ? j.memories.map(m => `<div class="mem st-${m.stage === 'is' ? 'is' : m.stage === 'aydın' ? 'aydin' : m.stage === 'dumanlı' ? 'duman' : 'unut'}">
        <small>${when(m.t)} <span class="stg">${ST[m.stage] || m.stage}</span>${m.stage !== 'is' ? `<span class="rb" title="Yadda qalma gücü"><i style="width:${Math.round(m.r * 100)}%"></i></span>` : ''}</small>
        ${m.stage === 'dumanlı' ? `${esc(m.shown)}<span class="orig">Əslində: ${esc(m.text)}</span>` : esc(m.text)}</div>`).join('')
        : `<div class="empty">${esc(a.def.name)} hələ sizinlə bağlı heç nə xatırlamır. Danışın və ya tapşırıq verin.</div>`);
  } catch { box.innerHTML = '<div class="empty">Yaddaş açılmadı.</div>'; }
}

/* ---------------- kompüter ---------------- */
const termHtml = lines => lines.slice(-80).map(l => `<span class="${esc(l.kind)}">${esc(l.text)}</span>`).join('\n');
const sizeStr = n => (n > 1024 ? (n / 1024).toFixed(1) + ' KB' : n + ' B');
const fileList = (files, cls = '') => files.length ? files.map(f => f.dir
  ? `<button type="button" class="dir" disabled>${icon('dir', 14)}${esc(f.f)}</button>`
  : `<button type="button" data-pcf="${esc(f.f)}">${icon('file', 14)}<span>${esc(f.f)}</span><span class="sz">${sizeStr(f.size)}</span></button>`).join('') : '<div class="empty">Qovluq boşdur.</div>';
const engineText = j => j.engine === 'codex' && j.runs !== 'codex' ? 'Codex (hələ söndürülüb, Claude işləyir)' : j.runs === 'codex' ? 'Codex' : 'Claude';

async function loadComputer(a) {
  const box = $('pcBox'); if (!box) return;
  if (!live.on) { box.innerHTML = '<div class="empty">Kompüter server işləyəndə açılır.</div>'; return; }
  try {
    const j = await fetch('/api/pc?id=' + a.id).then(r => r.json());
    if (selected !== a || curTab !== 'pc') return;
    JOURNAL[a.id] = j.log;
    box.innerHTML = `<div class="pc-st"><i class="sdot" style="background:${j.busy ? 'var(--acc)' : 'var(--ink-3)'}"></i>${j.busy ? 'İşləyir' : 'Boşdur'} · ${esc(engineText(j))}</div>
      <div class="term" id="pcTerm">${termHtml(j.log) || '<span class="note">Hələ heç nə işə salınmayıb.</span>'}</div>
      <div class="files"><h3 class="lab" style="margin-top:16px">Fayllar</h3>${fileList(j.files)}</div>
      <p style="margin-top:12px"><button class="btn sm" id="pcOpen">${icon('monitor', 16)}Böyük ekranda aç</button></p>`;
    const t = $('pcTerm'); t.scrollTop = t.scrollHeight;
    $('pcOpen').onclick = () => openComputer(a);
    box.querySelectorAll('[data-pcf]').forEach(b => (b.onclick = () => openComputer(a, b.dataset.pcf)));
  } catch { box.innerHTML = '<div class="empty">Kompüter açılmadı.</div>'; }
}
onJournal(id => {
  if (selected?.id === id && curTab === 'pc') { const t = $('pcTerm'); if (t) { t.innerHTML = termHtml(JOURNAL[id]); t.scrollTop = t.scrollHeight; } }
  if (pcOpenFor === id) { const t = $('pcDlgTerm'); if (t) { t.innerHTML = termHtml(JOURNAL[id]); t.scrollTop = t.scrollHeight; } }
});

let pcOpenFor = null;
export async function openComputer(a, file = null) {
  if (!live.on) { toast('Kompüter server işləyəndə açılır'); return; }
  pcOpenFor = a.id;
  const dlg = $('pcDlg');
  dlg.querySelector('h3').textContent = `${a.def.name}: kompüter`;
  dlg.classList.add('show');
  const j = await fetch('/api/pc?id=' + a.id).then(r => r.json()).catch(() => null);
  if (!j) return;
  JOURNAL[a.id] = j.log;
  $('pcTree').innerHTML = `<p class="hint" style="margin:4px 8px 8px">${esc(engineText(j))}</p>` + fileList(j.files);
  $('pcDlgTerm').innerHTML = termHtml(j.log) || '<span class="note">Hələ heç nə işə salınmayıb.</span>';
  $('pcDlgTerm').scrollTop = 1e6;
  const show = async f => {
    $('pcTree').querySelectorAll('[data-pcf]').forEach(b => b.classList.toggle('on', b.dataset.pcf === f));
    const r = await fetch(`/api/pc/file?id=${a.id}&f=${encodeURIComponent(f)}`).then(r => r.json()).catch(() => null);
    $('pcView').textContent = !r ? 'Fayl açılmadı.' : r.binary ? `Mətn faylı deyil (${sizeStr(r.size)}).` : r.tooBig ? `Fayl böyükdür (${sizeStr(r.size)}).` : r.text;
  };
  $('pcTree').querySelectorAll('[data-pcf]').forEach(b => (b.onclick = () => show(b.dataset.pcf)));
  const first = file || j.files.filter(f => !f.dir).sort((x, y) => y.t - x.t)[0]?.f;
  if (first) show(first); else $('pcView').textContent = 'Fayl seçin.';
}
hooks.openComputer = openComputer;

/* ---------------- yenilənmə ---------------- */
let lastHist = '';
function refreshDetail(force) {
  if (!selected) return;
  const a = selected, st = STATUS[a.status];
  const nd = $('nowDot'); if (!nd) return;
  nd.style.background = st[1];
  const cur = `${a.speaking ? 'Sizinlə danışır' : st[0]}${a.flashT > 0 ? ': ' + a.flashText : a.bubbleText || a.task ? ': ' + (a.bubbleText || a.task) : ''}`;
  const nt = $('nowT'); if (nt.textContent !== cur) nt.textContent = cur;
  const p = a.progress(); $('nowP').style.width = (p == null ? 0 : p * 100) + '%';
  const hs = a.history.slice(0, 8).map(h => h.s ?? h).join('|');
  if (force || hs !== lastHist) {
    lastHist = hs;
    const dH = $('dH'); if (dH) dH.innerHTML = a.history.length
      ? a.history.slice(0, 8).map(h => h.file ? `<div>${esc(h.s)} · ${fileLink(h.file, h.title)}</div>` : `<div>${esc(h)}</div>`).join('')
      : '<div class="empty">Bu gün hələ bir iş bitməyib.</div>';
  }
}
export function refreshPanels() {
  for (const a of AGENTS) {
    const re = rowEls[a.id], st = STATUS[a.status]; if (!re) continue;
    re.dot.style.background = st[1];
    const tx = `${st[0]}${a.task && ['work', 'assigned', 'campaign'].includes(a.status) ? ' · ' + a.task : ''}`;
    if (re.tx.textContent !== tx) re.tx.textContent = tx;
  }
  $('clock').textContent = clockStr();
  refreshDetail();
}

/* ---------------- yaxınlaşanda danışmaq ---------------- */
let nearAgent = null;
export const getNear = () => nearAgent;
export function updateNear() {
  let best = null;
  const camD = camera.position.distanceTo(controls.target);
  if (!selected && camD < 22) {
    let bd = 4.2;
    for (const a of AGENTS) { if (!a.hired) continue; const d = Math.hypot(a.pos.x - controls.target.x, a.pos.z - controls.target.z); if (d < bd) { bd = d; best = a; } }
  }
  if (best === nearAgent) return;
  nearAgent?.el.classList.remove('near');
  nearAgent = best;
  const el = $('near');
  if (best) {
    best.el.classList.add('near');
    el.innerHTML = `<span>${esc(best.def.name)} yaxınlıqdadır</span><button class="btn primary sm" id="nearGo">Danış</button><kbd>Enter</kbd>`;
    $('nearGo').onclick = () => select(best, true);
    el.classList.add('show');
  } else el.classList.remove('show');
}

/* ---------------- kamera ---------------- */
export let camAnim = null;
export const setCamAnim = v => { camAnim = v; };
function tweenCam(toP, toT, dur = 1.1) { camAnim = { fp: camera.position.clone(), ft: controls.target.clone(), tp: toP, tt: toT, t: 0, dur }; }
function focusOn(a, dist = 17) {
  const tt = new THREE.Vector3(a.pos.x, 1.1, a.pos.z);
  const dir = camera.position.clone().sub(controls.target).normalize();
  if (dir.y < 0.42) { dir.y = 0.42; dir.normalize(); }
  tweenCam(tt.clone().add(dir.multiplyScalar(dist)), tt);
}
// kamera: birinci görünüş həmişə indiki mərhələni bütöv göstərir
const stageView = () => { const t = STAGE.targets[STAGE.cur], d = STAGE.dist[STAGE.cur]; return { p: [t[0] + d * 0.5, d * 0.62, t[2] + d * 0.62], t }; };
hooks.onStage = (n, prev) => {
  const v = stageView(); follow = false; tweenCam(new THREE.Vector3(...v.p), new THREE.Vector3(...v.t), 1.8);
  log(null, n > prev ? (n === 2 ? '<b>Ofis genişləndi:</b> yan otaqlar icarəyə götürüldü, arakəsmə divar söküldü.' : '<b>Ofis genişləndi:</b> artıq bütün mərtəbə bizimdir.')
    : '<b>Ofis kiçildi:</b> boş qalan hissə bağlandı.');
  toast(n > prev ? 'Ofis genişləndi' : 'Ofis kiçildi');
};
const VIEWS = [null, { p: [33, 40, 44], t: [0, 0, 0] }, { p: [0, 58, 10], t: [0, 0, 1] }, { p: [-30, 28, 32], t: [-1, 0, 0] }, { p: [0, 12, 30], t: [0, 1, 4] }];
let viewIdx = 0;
controls.addEventListener('start', () => { follow = false; camAnim = null; });
export const selRingFollow = () => { if (selected) selRing.position.set(selected.pos.x, 0.03, selected.pos.z); };

/* ---------------- dialoqlar ---------------- */
document.body.insertAdjacentHTML('beforeend', `
  <div class="dlg" id="campDlg" role="dialog" aria-modal="true" aria-labelledby="campH"><div class="box"><div class="hd"><h3 id="campH">Böyük iş</h3><button class="iconbtn" data-close aria-label="Bağla">${icon('x')}</button></div>
    <form class="bd" id="campForm">
      <div class="seg" role="radiogroup" aria-label="İşin növü"><label><input type="radio" name="cmode" value="team" checked> Komanda işi</label><label><input type="radio" name="cmode" value="camp"> Kampaniya</label></div>
      <input type="text" id="campName" placeholder="məs: Yay endirimi üçün Instagram postu və slogan" autocomplete="off" maxlength="300">
      <p class="hint" id="campHint"></p><div class="route" id="campRoute"></div>
      <p style="margin:16px 0 0;display:flex;justify-content:flex-end;gap:8px"><button type="button" class="btn" data-close>Ləğv et</button><button class="btn primary">Başlat</button></p></form></div></div>
  <div class="dlg" id="outDlg" role="dialog" aria-modal="true" aria-labelledby="outH"><div class="box"><div class="hd"><h3 id="outH">Hazır işlər</h3><button class="iconbtn" data-close aria-label="Bağla">${icon('x')}</button></div><div class="bd outs" id="outItems"></div></div></div>
  <div class="dlg" id="pcDlg" role="dialog" aria-modal="true" aria-labelledby="pcH"><div class="box"><div class="hd"><h3 id="pcH">Kompüter</h3><button class="iconbtn" data-close aria-label="Bağla">${icon('x')}</button></div>
    <div class="bd"><div class="ftree files" id="pcTree"></div><div class="view" id="pcView"></div><div class="term" id="pcDlgTerm"></div></div></div></div>`);
const closeDlg = () => { document.querySelectorAll('.dlg.show').forEach(d => d.classList.remove('show')); pcOpenFor = null; };
document.querySelectorAll('.dlg').forEach(d => { d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) closeDlg(); }); });

// Komanda işi: CMO bölür, hissələr eyni vaxtda gedir. Kampaniya: hamı ardıcıl təhvil verir.
const cmode = () => document.querySelector('input[name=cmode]:checked')?.value || 'team';
function campHint() {
  $('campHint').textContent = cmode() === 'team'
    ? 'Elvin işi hissələrə bölür, ən uyğun 2–4 nəfər eyni vaxtda işləyir, sonra o birləşdirir. Kimin uyğun olduğu sizin qiymətlərinizdən öyrənilir.'
    : `${PIPE.length} nəfər işi bir-birinə təhvil verir: brifdən hesabata qədər. Ad yazın, məs: Novruz 2027.`;
  $('campRoute').innerHTML = ''; if (cmode() === 'team') routePreview();
}
let routeT = null;
function routePreview() {
  clearTimeout(routeT);
  routeT = setTimeout(async () => {
    const text = $('campName').value.trim();
    if (!live.on || cmode() !== 'team' || text.length < 4) { $('campRoute').innerHTML = ''; return; }
    const list = await live.route(text).catch(() => []);
    $('campRoute').innerHTML = list.length ? `<span>Bu iş üçün ən uyğun:</span> ${list.slice(0, 4).map(x => `<span class="chip" title="${esc(x.role)}${x.ok + x.redo ? ` · qəbul ${x.ok}, geri ${x.redo}` : ''}">${esc(x.name)} <b>${Math.round(x.score * 100)}</b></span>`).join('')}` : '';
  }, 350);
}
document.querySelectorAll('input[name=cmode]').forEach(r => (r.onchange = campHint));
$('campName').oninput = () => cmode() === 'team' && routePreview();
$('btnCamp').onclick = () => { $('campDlg').classList.add('show'); campHint(); setTimeout(() => $('campName').focus(), 50); };
$('campForm').onsubmit = async e => {
  e.preventDefault(); const i = $('campName'), v = i.value.trim();
  if (cmode() === 'team') {
    if (!live.on) { toast('Komanda işi server qoşulu olanda işləyir'); return; }
    if (!v) { i.focus(); return; }
    try { await live.team(v); } catch (err) { toast(err.message); return; }
  } else startCampaign(v || pick(['Novruz 2027', 'Yeni il endirimi', 'Yay kolleksiyası']));
  i.value = ''; closeDlg(); select(null); setRight(true);
};
$('btnMeet').onclick = () => callMeeting();
$('btnOut').onclick = async () => {
  $('outDlg').classList.add('show');
  const box = $('outItems');
  if (!live.on) { box.innerHTML = '<div class="empty">Server qoşulu deyil.</div>'; return; }
  box.innerHTML = '<div class="empty">Yüklənir…</div>';
  try {
    const list = await fetch('/api/outputs').then(r => r.json());
    box.innerHTML = list.length ? list.map(o => `<button type="button" data-file="${esc(o.f)}" data-title="${esc(o.f.split('/').pop())}"><span>${esc(o.f.replace(/^(tapsiriqlar|kampaniyalar)\//, ''))}</span><span>${new Date(o.t).toLocaleString('az-AZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></button>`).join('')
      : '<div class="empty">Hələ hazır iş yoxdur. Kiməsə tapşırıq verin və ya kampaniya başladın.</div>';
  } catch { box.innerHTML = '<div class="empty">Siyahı açılmadı.</div>'; }
};
$('btnBook').onclick = () => openBook();
$('btnSocial').onclick = () => window.open('/sosial.html', '_blank', 'noopener');
$('btnNames').onclick = e => { const off = document.body.classList.toggle('hide-names'); e.currentTarget.classList.toggle('on', !off); };
$('btnCam').onclick = () => { viewIdx = (viewIdx + 1) % VIEWS.length; const v = VIEWS[viewIdx] || stageView(); follow = false; tweenCam(new THREE.Vector3(...v.p), new THREE.Vector3(...v.t)); };
addEventListener('keydown', e => {
  const typing = /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '');
  if (e.key === 'Escape') { if (typing) document.activeElement.blur(); if (document.querySelector('.dlg.show')) closeDlg(); else if (selected) { select(null); setRight(false); } else { setLeft(false); setRight(false); } }
  if (e.key === 'Enter' && !typing && nearAgent && !selected) { e.preventDefault(); select(nearAgent, true); }
});

hooks.log = log; hooks.toast = toast;
renderOffice();

// Hər kadr: kamera keçidi və ya seçilmiş personajı izləmə.
export function stepCamera(rdt) {
  if (camAnim) {
    camAnim.t += rdt / camAnim.dur; const e = 1 - Math.pow(1 - Math.min(1, camAnim.t), 3);
    camera.position.lerpVectors(camAnim.fp, camAnim.tp, e); controls.target.lerpVectors(camAnim.ft, camAnim.tt, e);
    if (camAnim.t >= 1) camAnim = null;
  } else if (follow && selected) {
    const want = new THREE.Vector3(selected.pos.x, 1, selected.pos.z), d = want.sub(controls.target).multiplyScalar(Math.min(1, rdt * 3));
    controls.target.add(d); camera.position.add(d);
  }
  selRingFollow();
}

// Ofisdə boş yerə klik: seçimi götür və personaj panelini bağla.
export function deselect() { if (!selected) return; select(null); $('right').classList.remove('open'); $('dLog').classList.remove('on'); }

renderTeam();

async function loadShared() {
  const el = $('sharedList'); if (!el) return;
  if (!live.on) { el.innerHTML = '<div class="empty">Server işləyəndə görünür.</div>'; return; }
  const list = (await fetch('/api/shared').then(r => r.json()).catch(() => [])).filter(m => m.stage !== 'unudulub');
  el.innerHTML = list.length ? list.slice(0, 12).map(m => `<div class="${m.stage === 'dumanlı' ? 'muted' : ''}">${m.kind === 'qayda' ? '<b>Qayda</b> · ' : ''}${esc(m.shown)}</div>`).join('')
    : '<div class="empty">Hələ ortaq heç nə yoxdur. İşə qiymət verib irad yazanda burada görünəcək.</div>';
}

// Komanda işləri: plan, hissələr, birləşdirmə. Server hadisələrindən yenilənir (teamsView faylın əvvəlində).
async function renderTeams() {
  const el = $('teamSec'); if (!el) return;
  if (live.on && !teamsView.size) for (const t of await fetch('/api/teams').then(r => r.json()).catch(() => [])) teamsView.set(t.id, t);
  const list = [...teamsView.values()].sort((a, b) => b.at - a.at).slice(0, 4);
  if (!list.length) { el.innerHTML = ''; return; }
  const ST = { planning: 'bölünür', running: 'işlənir', merging: 'birləşdirilir', done: 'hazırdır', error: 'alınmadı' };
  el.innerHTML = `<h3 class="lab">Komanda işləri</h3>` + list.map(t => `<div class="team-card">
      <div class="tc-h"><b>${esc(t.text)}</b><span class="stg">${ST[t.status] || t.status}</span></div>
      ${(t.parts || []).map(p => `<div class="tc-p"><span>${esc(byId(p.agentId)?.def.name || p.agentId)}</span><span class="muted">${esc(p.task)}</span>${p.file ? `<a href="#" data-file="${esc(p.file)}" data-title="${esc(p.task)}">aç</a>` : ''}</div>`).join('')}
      ${t.file ? `<p style="margin:8px 0 0"><button class="btn sm primary" type="button" data-file="${esc(t.file)}" data-title="${esc(t.text)}">Yekun nəticə</button></p>` : t.error ? `<p class="small muted">${esc(t.error)}</p>` : ''}
    </div>`).join('');
}
// Serverə qoşulanda (və yenidən qoşulanda) ofis panelinin server bölmələri təzələnir.
live.sub('hello', () => { if (!selected && $('teamSec')) { loadBook(); loadShared(); renderTeams(); } });
live.sub('team', ev => {
  const t = teamsView.get(ev.teamId) || { id: ev.teamId, text: ev.text, lead: ev.lead, status: 'planning', parts: [], at: Date.now() };
  if (ev.parts) t.parts = ev.parts;
  t.status = { start: 'planning', plan: 'running', merging: 'merging', done: 'done', error: 'error' }[ev.phase] || t.status;
  if (ev.file) t.file = ev.file; if (ev.error) t.error = ev.error;
  teamsView.set(t.id, t);
  const lead = byId(ev.lead);
  if (ev.phase === 'plan') log(lead, `komanda işini böldü: ${ev.parts.map(p => esc(byId(p.agentId)?.def.name || p.agentId)).join(', ')}`);
  if (ev.phase === 'done') { log(lead, `komanda işini birləşdirdi: “${esc(ev.text)}”`); toast('Komanda işi hazırdır'); }
  if (ev.phase === 'error') toast('Komanda işi alınmadı: ' + ev.error);
  renderTeams();
});
live.sub('job', ev => { if (ev.team && teamsView.has(ev.team)) { const t = teamsView.get(ev.team), p = t.parts.find(x => x.jobId === ev.jobId || (x.agentId === ev.agentId && !x.file)); if (p && ev.phase === 'done') { p.file = ev.file; renderTeams(); } } });
live.sub('feedback', ev => { const a = byId(ev.agentId); log(a, ev.verdict === 'ok' ? `işini bəyəndiniz: “${esc(ev.text)}”` : `işini geri qaytardınız: “${esc(ev.text)}”${ev.note ? ` (${esc(ev.note)})` : ''}`); a?.flash(ev.verdict === 'ok' ? 'Sağ olun!' : 'Başa düşdüm, düzəldirəm', 3); loadShared(); });

async function loadBook() {
  const el = $('bookList'); if (!el) return;
  if (!live.on) { el.innerHTML = '<div class="empty">Server işləyəndə görünür.</div>'; return; }
  const list = await fetch('/api/experience').then(r => r.json()).catch(() => []);
  el.innerHTML = list.length ? list.slice(0, 20).map(e => `<div><b>${esc(e.name)}</b> · ${esc(e.task)}<br><span class="small muted">${esc(e.summary.slice(0, 140))}…</span></div>`).join('')
    : '<div class="empty">Hələ bitən iş yoxdur. Kiməsə tapşırıq verin.</div>';
}
