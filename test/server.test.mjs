// Server API testləri: demo rejimdə (MOCK=1), Claude çağırılmadan.
//   npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PIPE } from '../public/team.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function startServer(outDir, delay = 0) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['server.mjs'], {
      cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, MOCK: '1', PORT: '0', OUT_DIR: outDir, MOCK_DELAY: String(delay) },
    });
    let out = '';
    const t = setTimeout(() => { p.kill(); reject(new Error('server başlamadı: ' + out)); }, 15000);
    p.stdout.on('data', d => {
      out += d; const m = out.match(/localhost:(\d+)/);
      if (m) { clearTimeout(t); resolve({ p, base: `http://127.0.0.1:${m[1]}`, stop: () => new Promise(r => { p.once('close', r); p.kill('SIGKILL'); }) }); }
    });
    p.stderr.on('data', d => (out += d));
    p.on('error', reject);
  });
}

const post = (base, url, data, raw) => fetch(base + url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: raw ?? JSON.stringify(data) });

// SSE axınını oxuyur; pred(ev) true qaytaranda həmin hadisə ilə bitir.
async function waitEvent(base, pred, timeoutMs = 30000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(base + '/api/events', { signal: ac.signal });
    const dec = new TextDecoder(); let buf = '';
    for await (const chunk of r.body) {
      buf += dec.decode(chunk, { stream: true }); let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, i); buf = buf.slice(i + 2);
        if (!block.startsWith('data: ')) continue;
        const ev = JSON.parse(block.slice(6));
        if (pred(ev)) return ev;
      }
    }
    throw new Error('SSE bağlandı');
  } finally { clearTimeout(t); ac.abort(); }
}

// Bir SSE axını açır və bütün hadisələri yığır; wait(pred) artıq gəlmiş və ya gələcək hadisəni qaytarır.
async function collect(base) {
  const ac = new AbortController();
  const all = [], waiters = [];
  const r = await fetch(base + '/api/events', { signal: ac.signal });
  (async () => {
    const dec = new TextDecoder(); let buf = '';
    try {
      for await (const chunk of r.body) {
        buf += dec.decode(chunk, { stream: true }); let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, i); buf = buf.slice(i + 2);
          if (!block.startsWith('data: ')) continue;
          const ev = JSON.parse(block.slice(6)); all.push(ev);
          for (const w of [...waiters]) if (w.pred(ev)) { waiters.splice(waiters.indexOf(w), 1); w.resolve(ev); }
        }
      }
    } catch { /* bağlandı */ }
  })();
  return {
    all, close: () => ac.abort(),
    wait(pred, timeoutMs = 30000) {
      const hit = all.find(pred); if (hit) return Promise.resolve(hit);
      return new Promise((resolve, reject) => {
        const w = { pred, resolve }; waiters.push(w);
        setTimeout(() => { if (waiters.includes(w)) reject(new Error('hadisə gəlmədi')); }, timeoutMs);
      });
    },
  };
}
const camp = (id, phase, more = {}) => ev => ev.type === 'campaign' && ev.campaignId === id && ev.phase === phase && Object.entries(more).every(([k, v]) => ev[k] === v);
const idx = id => PIPE.findIndex(p => p.id === id);
const campaignsOf = base => fetch(base + '/api/campaigns').then(r => r.json());

const tmp = () => mkdtemp(path.join(tmpdir(), 'ofis-test-'));

test('health demo rejimi göstərir, yanlış sorğular rədd olunur', async () => {
  const dir = await tmp(); const s = await startServer(dir);
  try {
    const h = await fetch(s.base + '/api/health').then(r => r.json());
    assert.equal(h.mode, 'mock');
    assert.equal((await post(s.base, '/api/task', null, '{yox')).status, 400);
    assert.equal((await post(s.base, '/api/task', { agentId: 'cmo', text: '' })).status, 400);
    assert.equal((await post(s.base, '/api/campaign/resume', { campaignId: 'yoxdur' })).status, 404);
    assert.equal((await fetch(s.base + '/api/output?f=../server.mjs')).status, 404);
  } finally { await s.stop(); await rm(dir, { recursive: true, force: true }); }
});

test('tapşırıq SSE ilə bitir və nəticə faylı yazılır', async () => {
  const dir = await tmp(); const s = await startServer(dir);
  try {
    const done = waitEvent(s.base, ev => ev.type === 'job' && ev.phase === 'done');
    const r = await post(s.base, '/api/task', { agentId: 'cmo', text: 'Yeni il üçün slogan' });
    assert.equal(r.status, 200);
    const ev = await done;
    const md = await fetch(s.base + '/api/output?f=' + encodeURIComponent(ev.file)).then(r => r.text());
    assert.match(md, /Yeni il üçün slogan/);
    // yenidən qoşulan brauzer buraxdığı "done"-u snapshot-dan bərpa edə bilir
    const hello = await waitEvent(s.base, ev => ev.type === 'hello');
    const j = hello.jobs.find(x => x.jobId === ev.jobId);
    assert.equal(j?.status, 'done');
    assert.equal(j.file, ev.file);
  } finally { await s.stop(); await rm(dir, { recursive: true, force: true }); }
});

test('avto kampaniya: paralel addımlar, CMO geri qaytarır, sona qədər gedir', async () => {
  const dir = await tmp(); const s = await startServer(dir);
  const ev = await collect(s.base);
  try {
    const { campaignId: id } = await post(s.base, '/api/campaign', { name: 'Test kampaniyası', auto: true }).then(r => r.json());
    await ev.wait(camp(id, 'done'));
    const c = (await campaignsOf(s.base))[0];
    assert.equal(c.status, 'done');
    assert.ok(c.steps.every(x => x.status === 'done'));

    // CMO kopirayterin ilk variantını qaytardı, ikinci variant qəbul olundu
    const reviews = ev.all.filter(e => e.phase === 'step-reviewed' && e.step === idx('copy'));
    assert.deepEqual(reviews.map(r => r.ok), [false, true]);
    assert.equal(c.steps[idx('copy')].notes[0].by, 'cmo');

    // konsepsiyadan sonra sloqan və jingle eyni vaxtda başlayır
    const order = ev.all.filter(e => e.campaignId === id && ['step-start', 'step-done'].includes(e.phase)).map(e => `${e.phase}:${e.agentId}`);
    const copyStart = order.indexOf('step-start:copy'), jingleStart = order.indexOf('step-start:composer');
    assert.ok(copyStart >= 0 && jingleStart >= 0);
    assert.ok(order.indexOf('step-done:copy') > jingleStart && order.indexOf('step-done:composer') > copyStart, 'paralel getməlidir: ' + order.join(' '));

    const files = await readdir(path.join(dir, 'kampaniyalar', (await readdir(path.join(dir, 'kampaniyalar')))[0]));
    assert.ok(files.includes('00-tam-kampaniya.md') && files.includes('state.json'));
    assert.equal(files.filter(f => /^\d\d-/.test(f)).length, PIPE.length + 1);
  } finally { ev.close(); await s.stop(); await rm(dir, { recursive: true, force: true }); }
});

test('Rəhbərin təsdiqi: brif gözləyir, düzəliş istənir, təsdiqdən sonra davam edir', async () => {
  const dir = await tmp(); const s = await startServer(dir);
  const ev = await collect(s.base);
  try {
    const { campaignId: id } = await post(s.base, '/api/campaign', { name: 'Novruz 2027' }).then(r => r.json());
    await ev.wait(camp(id, 'awaiting'));
    let c = (await campaignsOf(s.base))[0];
    assert.equal(c.status, 'awaiting');
    assert.equal(c.steps[0].status, 'awaiting');
    assert.equal(c.steps[1].status, 'pending', 'brif təsdiqlənməmiş insight başlamır');

    assert.equal((await post(s.base, '/api/campaign/approve', { campaignId: id, step: 1 })).status, 409);
    assert.equal((await post(s.base, '/api/campaign/revise', { campaignId: id, step: 0, note: '' })).status, 400);
    assert.equal((await post(s.base, '/api/campaign', { name: 'İkinci' })).status, 409, 'təsdiq gözləyən kampaniya da aktivdir');

    const n = ev.all.length;
    assert.equal((await post(s.base, '/api/campaign/revise', { campaignId: id, step: 0, note: 'Büdcəni 30% azalt' })).status, 200);
    await ev.wait(e => ev.all.indexOf(e) >= n && camp(id, 'step-awaiting', { step: 0 })(e));
    c = (await campaignsOf(s.base))[0];
    assert.deepEqual(c.steps[0].notes.map(x => [x.by, x.note]), [['boss', 'Büdcəni 30% azalt']]);

    await post(s.base, '/api/campaign/approve', { campaignId: id, step: 0 });
    await ev.wait(camp(id, 'step-awaiting', { step: idx('artdir') }));
    c = (await campaignsOf(s.base))[0];
    assert.equal(c.steps[idx('copy')].status, 'pending', 'konsepsiya təsdiqlənməmiş sloqan başlamır');

    await post(s.base, '/api/campaign/approve', { campaignId: id, step: idx('artdir') });
    await ev.wait(camp(id, 'done'));
    assert.equal((await campaignsOf(s.base))[0].status, 'done');
  } finally { ev.close(); await s.stop(); await rm(dir, { recursive: true, force: true }); }
});

test('dayandır və davam et', async () => {
  const dir = await tmp(); const s = await startServer(dir, 10);
  const ev = await collect(s.base);
  try {
    const { campaignId: id } = await post(s.base, '/api/campaign', { name: 'Fasilə', auto: true }).then(r => r.json());
    await ev.wait(camp(id, 'step-done', { step: 1 }));
    assert.equal((await post(s.base, '/api/campaign/pause', { campaignId: id })).status, 200);
    await ev.wait(camp(id, 'paused'));
    const c = (await campaignsOf(s.base))[0];
    assert.equal(c.status, 'paused');
    assert.ok(c.steps.every(x => ['done', 'pending'].includes(x.status)), 'yarımçıq addım pending-ə qayıdır');
    assert.equal((await post(s.base, '/api/campaign/pause', { campaignId: id })).status, 409);

    await post(s.base, '/api/campaign/resume', { campaignId: id });
    await ev.wait(camp(id, 'done'), 60000);
  } finally { ev.close(); await s.stop(); await rm(dir, { recursive: true, force: true }); }
});

test('server dayansa: gedən kampaniya yarımçıq qalır, təsdiq gözləyən isə gözləməyə davam edir', async () => {
  const dir = await tmp();
  let s = await startServer(dir, 15);
  let ev = await collect(s.base);
  let id;
  try {
    ({ campaignId: id } = await post(s.base, '/api/campaign', { name: 'Yay', auto: true }).then(r => r.json()));
    await ev.wait(camp(id, 'step-done', { step: 1 }));
    const hello = await collect(s.base).then(async e2 => { const h = await e2.wait(e => e.type === 'hello'); e2.close(); return h; });
    assert.equal(hello.campaign?.id, id, 'yenidən qoşulan brauzer gedən kampaniyanı görür');
  } finally { ev.close(); await s.stop(); }

  s = await startServer(dir, 0);
  ev = await collect(s.base);
  try {
    const c = (await campaignsOf(s.base))[0];
    assert.equal(c.status, 'interrupted');
    assert.ok(c.done >= 2 && c.done < PIPE.length);
    assert.ok(c.steps.every(x => ['done', 'pending'].includes(x.status)));
    await post(s.base, '/api/campaign/resume', { campaignId: id });
    await ev.wait(camp(id, 'done'));
    assert.equal((await post(s.base, '/api/campaign/resume', { campaignId: id })).status, 409, 'bitmiş kampaniya davam etdirilmir');

    // təsdiq gözləyən kampaniya
    const { campaignId: g } = await post(s.base, '/api/campaign', { name: 'Gözləyən' }).then(r => r.json());
    await ev.wait(camp(g, 'awaiting'));
  } finally { ev.close(); await s.stop(); }

  s = await startServer(dir, 0);
  ev = await collect(s.base);
  try {
    const list = await campaignsOf(s.base);
    const g = list.find(x => x.name === 'Gözləyən');
    assert.equal(g.status, 'awaiting');
    await post(s.base, '/api/campaign/approve', { campaignId: g.id, step: 0 });
    await ev.wait(camp(g.id, 'step-awaiting', { step: idx('artdir') }));
  } finally { ev.close(); await s.stop(); await rm(dir, { recursive: true, force: true }); }
});
