// Səhifə ilə körpü server arasında əlaqə: SSE hadisələri, tapşırıq/kampaniya sorğuları və nəticə pəncərəsi.

const listeners = {};
export const live = {
  mode: 'offline',          // offline (server yoxdur → köhnə simulyasiya) | mock (demo) | live (Claude)
  detail: '',
  jobs: new Map(),          // jobId → { agentId, text, chars, tail, done, error, output, file }
  camp: null,               // { id, name, step, steps: [{done, chars, tail, output, file}], done, error, file }
  get on() { return this.mode !== 'offline'; },
  sub(type, fn) { (listeners[type] ||= []).push(fn); },
};
const fire = (type, ev) => (listeners[type] || []).forEach(fn => { try { fn(ev); } catch (e) { console.error(e); } });

const badge = () => document.getElementById('liveBadge');
function paintBadge() {
  const b = badge(); if (!b) return;
  const map = { live: ['live', 'Canlı'], mock: ['mock', 'Demo'], offline: ['off', 'Simulyasiya'] };
  const [cls, t] = map[live.mode];
  b.className = 'mode ' + cls;
  b.innerHTML = `<i></i>${t}`;
  b.title = live.mode === 'offline' ? 'Server işləmir: npm start ilə başladın. Yalnız animasiya gedir.'
    : live.mode === 'mock' ? 'Server işləyir, Claude çağırılmır: cavablar nümunədir.' : live.detail;
}

async function post(url, data) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Xəta ${r.status}`);
  return j;
}

live.task = async (agentId, text) => {
  const { jobId } = await post('/api/task', { agentId, text });
  if (!live.jobs.has(jobId)) live.jobs.set(jobId, { agentId, text, chars: 0, tail: '', done: false });
  return jobId;
};
live.campaign = async (name) => post('/api/campaign', { name });
live.resume = async (campaignId) => post('/api/campaign/resume', { campaignId });
live.staff = async () => fetch('/api/staff', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null));
live.hire = async id => post('/api/staff/hire', { id });
live.fire = async id => post('/api/staff/fire', { id });
live.campaigns = async () => fetch('/api/campaigns', { cache: 'no-store' }).then(r => (r.ok ? r.json() : []));

// Kampaniya vəziyyətini (snapshot və ya davam) brauzerdə qurur: bitmiş addımlar "done" sayılır.
const campFrom = (id, name, done = []) => {
  const c = { id, name, step: done.length, steps: [], done: false };
  for (const d of done) c.steps[d.step] = { chars: 0, tail: '', done: true, file: d.file };
  return c;
};

// Hər (yenidən) qoşulmada serverin vəziyyəti ilə brauzerdəkini tutuşdurur. Qoşulma kəsiləndə
// buraxılmış `done` hadisələri təkrar gəlmir, ona görə bitmiş addım və tapşırıqları snapshot-dan götürürük.
function reconcile(ev) {
  for (const sj of ev.jobs || []) {
    let j = live.jobs.get(sj.jobId);
    if (!j) {
      if (sj.status !== 'running') continue; // bu səhifənin bilmədiyi köhnə iş
      live.jobs.set(sj.jobId, (j = { agentId: sj.agentId, text: sj.text, chars: 0, tail: '', done: false }));
    }
    if (j.done || sj.status === 'running') continue;
    j.done = true;
    if (sj.status === 'done') j.file = sj.file; else j.error = sj.error || 'Alınmadı';
    fire('job', { type: 'job', phase: sj.status === 'done' ? 'done' : 'error', jobId: sj.jobId, agentId: sj.agentId, text: sj.text, file: sj.file, error: j.error, job: j });
  }
  // serverin artıq unutduğu iş (məs. server yenidən başlayıb): sonsuz gözləməsin
  const known = new Set((ev.jobs || []).map(j => j.jobId));
  for (const [id, j] of live.jobs) if (!j.done && !known.has(id)) {
    j.done = true; j.error = 'Server yenidən başladı';
    fire('job', { type: 'job', phase: 'error', jobId: id, agentId: j.agentId, text: j.text, error: j.error, job: j });
  }

  const sc = ev.campaign, c = live.camp;
  if (sc && (!c || c.id !== sc.id)) {
    live.camp = campFrom(sc.id, sc.name, sc.steps);
    fire('campaign', { phase: 'rejoin', campaignId: sc.id, name: sc.name, from: sc.steps.length, camp: live.camp });
    return;
  }
  if (!c || c.done) return;
  const settle = (summary) => {
    for (const d of summary.steps) {
      const s = (c.steps[d.step] ||= { chars: 0, tail: '', done: false });
      if (!s.done) { s.done = true; s.file = d.file; fire('campaign', { type: 'campaign', phase: 'step-done', campaignId: c.id, step: d.step, agentId: d.agentId, file: d.file, camp: c }); }
    }
    c.step = Math.max(c.step, summary.steps.length);
  };
  if (sc) { settle(sc); return; } // hələ gedir: yalnız buraxılmış addımları əlavə et
  // kampaniya snapshot-da yoxdur: ya bitib, ya da dayanıb — dəqiq vəziyyəti soruşuruq
  live.campaigns().then(list => {
    if (c.done || live.camp !== c) return;
    const s = list.find(x => x.id === c.id);
    if (s) settle(s);
    c.done = true;
    if (s?.status === 'done') { c.file = s.file; fire('campaign', { type: 'campaign', phase: 'done', campaignId: c.id, name: c.name, file: s.file, camp: c }); }
    else {
      c.error = s?.error || 'Server yenidən başladı — kampaniya yarımçıq qaldı';
      fire('campaign', { type: 'campaign', phase: 'error', campaignId: c.id, error: c.error, camp: c });
    }
  }).catch(() => {});
}

live.init = async () => {
  paintBadge();
  try {
    const h = await fetch('/api/health', { cache: 'no-store' }).then(r => (r.ok ? r.json() : Promise.reject()));
    live.mode = h.mode; live.detail = h.detail;
  } catch { live.mode = 'offline'; paintBadge(); return; }
  paintBadge();
  const es = new EventSource('/api/events');
  es.onmessage = m => {
    const ev = JSON.parse(m.data);
    if (ev.type === 'hello') {
      live.mode = ev.mode; live.detail = ev.detail; paintBadge();
      reconcile(ev);
      fire('hello', ev);
      return;
    }
    if (ev.type === 'pc' || ev.type === 'chat' || ev.type === 'staff') { fire(ev.type, ev); return; }
    if (ev.type === 'job') {
      let j = live.jobs.get(ev.jobId);
      if (!j) live.jobs.set(ev.jobId, (j = { agentId: ev.agentId, text: ev.text, chars: 0, tail: '', done: false }));
      if (ev.phase === 'delta') { j.chars = ev.chars; j.tail = ev.tail; }
      if (ev.phase === 'done') { j.done = true; j.output = ev.output; j.file = ev.file; }
      if (ev.phase === 'error') { j.done = true; j.error = ev.error; }
      fire('job', { ...ev, job: j });
    }
    if (ev.type === 'campaign') {
      if (ev.phase === 'start') live.camp = campFrom(ev.campaignId, ev.name, ev.done);
      const c = live.camp; if (!c || c.id !== ev.campaignId) return;
      if (ev.step != null) { c.step = ev.step; c.steps[ev.step] ||= { chars: 0, tail: '', done: false }; }
      const s = ev.step != null ? c.steps[ev.step] : null;
      if (ev.phase === 'delta') { s.chars = ev.chars; s.tail = ev.tail; }
      if (ev.phase === 'step-done') { s.done = true; s.output = ev.output; s.file = ev.file; }
      if (ev.phase === 'done') { c.done = true; c.file = ev.file; }
      if (ev.phase === 'error') { c.done = true; c.error = ev.error; }
      fire('campaign', { ...ev, camp: c });
    }
  };
  es.onerror = () => { if (es.readyState === 2) { live.mode = 'offline'; paintBadge(); } };
};

/* ---------------- nəticə pəncərəsi ---------------- */
const css = `
#outModal{position:fixed;inset:0;z-index:50;display:none;place-items:center;background:rgba(29,33,31,.36)}
#outModal.show{display:grid}
#outModal .box{width:min(780px,calc(100% - 32px));max-height:calc(100% - 48px);display:flex;flex-direction:column;background:var(--bg-raised);border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--shadow-pop);overflow:hidden}
#outModal .hd{display:flex;gap:8px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--line)}
#outModal .hd b{flex:1;font-size:15px;font-weight:600}
#outModal .hd small{color:var(--ink-2);font:12px var(--mono)}
#outModal .bd{overflow:auto;padding:16px 22px 24px;font-size:14px;line-height:1.6;white-space:pre-wrap;color:var(--ink)}
#outModal .bd h1,#outModal .bd h2,#outModal .bd h3{margin:.7em 0 .2em;line-height:1.3;font-weight:600}
#outModal .bd h1{font-size:20px}#outModal .bd h2{font-size:17px}#outModal .bd h3{font-size:15px}
#outModal .bd hr{border:0;border-top:1px solid var(--line);margin:12px 0}
`;
document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`);
document.body.insertAdjacentHTML('beforeend', `<div id="outModal" role="dialog" aria-modal="true" aria-labelledby="outT"><div class="box"><div class="hd"><b id="outT"></b><small id="outF"></small><button id="outCopy" class="btn">Kopyala</button><button id="outX" class="iconbtn" aria-label="Bağla"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div><div class="bd" id="outB"></div></div></div>`);
const modal = document.getElementById('outModal');
const escH = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// sadə markdown: başlıqlar, qalın, xətt — qalanı olduğu kimi
const md = t => escH(t)
  .replace(/^### (.*)$/gm, '<h3>$1</h3>').replace(/^## (.*)$/gm, '<h2>$1</h2>').replace(/^# (.*)$/gm, '<h1>$1</h1>')
  .replace(/^---$/gm, '<hr>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n?(<\/?h\d>|<hr>)\n?/g, '$1');
let rawText = '';
live.open = async (file, title = '') => {
  document.getElementById('outT').textContent = title || file;
  document.getElementById('outF').textContent = 'outputs/' + file;
  document.getElementById('outB').textContent = 'Yüklənir…';
  modal.classList.add('show');
  try { rawText = await fetch('/api/output?f=' + encodeURIComponent(file)).then(r => (r.ok ? r.text() : Promise.reject())); document.getElementById('outB').innerHTML = md(rawText); }
  catch { document.getElementById('outB').textContent = 'Fayl açılmadı.'; }
};
document.getElementById('outX').onclick = () => modal.classList.remove('show');
modal.onclick = e => { if (e.target === modal) modal.classList.remove('show'); };
addEventListener('keydown', e => { if (e.key === 'Escape') modal.classList.remove('show'); });
document.getElementById('outCopy').onclick = async () => { try { await navigator.clipboard.writeText(rawText); document.getElementById('outCopy').textContent = 'Kopyalandı'; setTimeout(() => (document.getElementById('outCopy').textContent = 'Kopyala'), 1500); } catch {} };
// hər yerdə [data-file] linkinə klik → nəticəni aç
document.addEventListener('click', e => { const l = e.target.closest('[data-file]'); if (l) { e.preventDefault(); live.open(l.dataset.file, l.dataset.title || ''); } });
