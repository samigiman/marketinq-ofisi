// Səhifə ilə körpü server arasında əlaqə: SSE hadisələri, tapşırıq/kampaniya sorğuları və nəticə pəncərəsi.

const listeners = {};
export const live = {
  mode: 'offline',          // offline (server yoxdur → köhnə simulyasiya) | mock (demo) | live (Claude)
  detail: '',
  jobs: new Map(),          // jobId → { agentId, text, chars, tail, done, error, output, file }
  // { id, name, auto, status, ended, error, file, steps: [{ status, agentId, chars, tail, file, notes, review }] }
  // addım statusu: pending | running | review | awaiting | done | error
  // kampaniya statusu: running | awaiting | done | error | paused | interrupted; ended = artıq getmir
  camp: null,
  get on() { return this.mode !== 'offline'; },
  sub(type, fn) { (listeners[type] ||= []).push(fn); },
};
const fire = (type, ev) => (listeners[type] || []).forEach(fn => { try { fn(ev); } catch (e) { console.error(e); } });

const badge = () => document.getElementById('liveBadge');
function paintBadge() {
  const b = badge(); if (!b) return;
  const map = {
    live: ['🟢', 'Canlı Claude'],
    mock: ['🟡', 'Demo rejim'],
    offline: ['⚪', 'Simulyasiya'],
  };
  const [d, t] = map[live.mode];
  b.innerHTML = `${d} <b>${t}</b>`;
  b.title = live.mode === 'offline' ? 'Körpü server işləmir — `node server.mjs` ilə başladın' : live.detail;
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
live.campaign = async (name, auto = false) => post('/api/campaign', { name, auto });
live.resume = async (campaignId) => post('/api/campaign/resume', { campaignId });
live.pause = async (campaignId) => post('/api/campaign/pause', { campaignId });
live.approve = async (campaignId, step) => post('/api/campaign/approve', { campaignId, step });
live.revise = async (campaignId, step, note) => post('/api/campaign/revise', { campaignId, step, note });
live.campaigns = async () => fetch('/api/campaigns', { cache: 'no-store' }).then(r => (r.ok ? r.json() : []));

const ENDED = ['done', 'error', 'paused', 'interrupted'];
// Serverin campSummary-sindən brauzerdəki kampaniya obyekti.
const campFrom = sum => ({
  id: sum.id, name: sum.name, auto: !!sum.auto, status: sum.status, ended: ENDED.includes(sum.status), error: sum.error, file: sum.file,
  steps: sum.steps.map(d => ({ status: d.status, agentId: d.agentId, chars: 0, tail: '', file: d.file, notes: d.notes || [], review: null })),
});
// Snapshot-dakı addım statusunu yerliyə köçürür; dəyişən hər addım üçün uyğun hadisəni yenidən yayır,
// ki, animasiya qoşulma kəsiləndə buraxdığı keçidləri də görsün.
const PHASE_OF = { running: 'step-start', review: 'step-review', awaiting: 'step-awaiting', done: 'step-done' };
function syncSteps(c, sum) {
  for (const d of sum.steps) {
    const s = c.steps[d.step];
    s.notes = d.notes || s.notes;
    if (s.status === d.status) continue;
    s.status = d.status; if (d.file) s.file = d.file;
    if (d.status === 'running') { s.chars = 0; s.tail = ''; }
    if (PHASE_OF[d.status]) fire('campaign', { type: 'campaign', phase: PHASE_OF[d.status], campaignId: c.id, step: d.step, agentId: d.agentId, file: d.file, camp: c, synced: true });
  }
}
function endCamp(c, status, extra = {}) {
  c.status = status; c.ended = true; Object.assign(c, extra);
  const phase = status === 'done' ? 'done' : status === 'paused' ? 'paused' : 'error';
  fire('campaign', { type: 'campaign', phase, campaignId: c.id, name: c.name, file: c.file, error: c.error, camp: c, synced: true });
}

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
    live.camp = campFrom(sc);
    fire('campaign', { phase: 'rejoin', campaignId: sc.id, name: sc.name, camp: live.camp });
    return;
  }
  if (!c || c.ended) return;
  if (sc) { // hələ gedir: buraxılmış keçidləri əlavə et
    syncSteps(c, sc);
    if (c.status !== sc.status) { c.status = sc.status; if (sc.status === 'awaiting') fire('campaign', { type: 'campaign', phase: 'awaiting', campaignId: c.id, camp: c, synced: true }); }
    return;
  }
  // kampaniya snapshot-da yoxdur: bitib, dayanıb və ya server yenidən başlayıb — dəqiq vəziyyəti soruşuruq
  live.campaigns().then(list => {
    if (c.ended || live.camp !== c) return;
    const s = list.find(x => x.id === c.id);
    if (s) syncSteps(c, s);
    if (s && ENDED.includes(s.status)) endCamp(c, s.status, { file: s.file, error: s.error });
    else endCamp(c, 'interrupted', { error: 'Server yenidən başladı — kampaniya yarımçıq qaldı' });
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
    if (ev.type === 'job') {
      let j = live.jobs.get(ev.jobId);
      if (!j) live.jobs.set(ev.jobId, (j = { agentId: ev.agentId, text: ev.text, chars: 0, tail: '', done: false }));
      if (ev.phase === 'delta') { j.chars = ev.chars; j.tail = ev.tail; }
      if (ev.phase === 'done') { j.done = true; j.output = ev.output; j.file = ev.file; }
      if (ev.phase === 'error') { j.done = true; j.error = ev.error; }
      fire('job', { ...ev, job: j });
    }
    if (ev.type === 'campaign') {
      if (ev.phase === 'start' || ev.phase === 'resume') live.camp = campFrom(ev.snapshot);
      const c = live.camp; if (!c || c.id !== ev.campaignId) return;
      const s = ev.step != null ? c.steps[ev.step] : null;
      switch (ev.phase) {
        case 'step-start': s.status = 'running'; s.chars = 0; s.tail = ''; s.review = null; c.status = 'running'; break;
        case 'delta': s.chars = ev.chars; s.tail = ev.tail; break;
        case 'step-review': s.status = 'review'; break;
        case 'step-reviewed': s.review = { ok: ev.ok, forced: ev.forced, note: ev.note }; if (!ev.ok || ev.forced) s.notes.push({ by: 'cmo', note: ev.note, accepted: ev.forced }); break;
        case 'step-awaiting': s.status = 'awaiting'; s.file = ev.file; break;
        case 'step-revise': s.status = 'pending'; s.notes.push({ by: 'boss', note: ev.note }); c.status = 'running'; break;
        case 'step-done': s.status = 'done'; s.file = ev.file; break;
        case 'awaiting': c.status = 'awaiting'; break;
        case 'done': c.status = 'done'; c.ended = true; c.file = ev.file; break;
        // dayandırılanda yarımçıq addımlar serverdə pending-ə qayıdır (ayrıca hadisəsiz)
        case 'paused': c.status = 'paused'; c.ended = true; c.error = ev.error; c.steps.forEach(x => { if (['running', 'review'].includes(x.status)) x.status = 'pending'; }); break;
        case 'error': c.status = 'error'; c.ended = true; c.error = ev.error; if (s && s.status !== 'done') s.status = 'error'; break;
      }
      fire('campaign', { ...ev, camp: c });
    }
  };
  es.onerror = () => { if (es.readyState === 2) { live.mode = 'offline'; paintBadge(); } };
};

/* ---------------- nəticə pəncərəsi ---------------- */
const css = `
#outModal{position:fixed;inset:0;z-index:50;display:none;place-items:center;background:rgba(20,28,45,.38);backdrop-filter:blur(3px)}
#outModal.show{display:grid}
#outModal .box{width:min(760px,calc(100% - 32px));max-height:calc(100% - 48px);display:flex;flex-direction:column;background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(20,30,60,.3);overflow:hidden}
#outModal .hd{display:flex;gap:8px;align-items:center;padding:12px 16px;border-bottom:1px solid rgba(20,30,50,.08)}
#outModal .hd b{flex:1;font-size:14px}
#outModal .hd small{color:#6b7487;font:11px ui-monospace,Menlo,monospace}
#outModal .bd{overflow:auto;padding:14px 20px 20px;font-size:13.5px;line-height:1.55;white-space:pre-wrap;color:#1d2433}
#outModal .bd h1,#outModal .bd h2,#outModal .bd h3{margin:.6em 0 .2em;line-height:1.25}
#outModal .bd h1{font-size:18px}#outModal .bd h2{font-size:16px}#outModal .bd h3{font-size:14px}
#outModal .bd hr{border:0;border-top:1px solid #e5e8ee;margin:10px 0}
.flink{color:#3d6fb6;cursor:pointer;text-decoration:underline;white-space:nowrap}
`;
document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`);
document.body.insertAdjacentHTML('beforeend', `<div id="outModal"><div class="box"><div class="hd"><b id="outT"></b><small id="outF"></small><button id="outCopy">📋 Kopyala</button><button id="outX">✕</button></div><div class="bd" id="outB"></div></div></div>`);
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
document.getElementById('outCopy').onclick = async () => { try { await navigator.clipboard.writeText(rawText); document.getElementById('outCopy').textContent = '✅ Kopyalandı'; setTimeout(() => (document.getElementById('outCopy').textContent = '📋 Kopyala'), 1500); } catch {} };
// hər yerdə [data-file] linkinə klik → nəticəni aç
document.addEventListener('click', e => { const l = e.target.closest('[data-file]'); if (l) { e.preventDefault(); live.open(l.dataset.file, l.dataset.title || ''); } });
