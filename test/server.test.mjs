// Server API testləri: demo rejimdə (MOCK=1), Claude çağırılmadan.
//   npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PIPE, START_STAFF, PUBLIC_EXCLUDED } from '../public/team.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function startServer(outDir, delay = 0, extra = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['server.mjs'], {
      cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, MOCK: '1', PORT: '0', OUT_DIR: outDir, MEMORY_DIR: path.join(outDir, 'yaddas'), PC_DIR: path.join(outDir, 'pc'), MOCK_DELAY: String(delay), MEMORY_RUFLO: '0', ...extra },
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

test('kampaniya sona qədər gedir, vəziyyət diskdə saxlanılır', async () => {
  const dir = await tmp(); const s = await startServer(dir);
  try {
    const done = waitEvent(s.base, ev => ev.type === 'campaign' && ev.phase === 'done');
    const { campaignId } = await post(s.base, '/api/campaign', { name: 'Test kampaniyası' }).then(r => r.json());
    await done;
    const [c] = await fetch(s.base + '/api/campaigns').then(r => r.json());
    assert.equal(c.id, campaignId);
    assert.equal(c.status, 'done');
    assert.equal(c.steps.length, PIPE.length);
    const [sub] = await readdir(path.join(dir, 'kampaniyalar'));
    const files = await readdir(path.join(dir, 'kampaniyalar', sub));
    assert.ok(files.includes('00-tam-kampaniya.md') && files.includes('state.json'));
    // yalnız işçisi olan addımların faylı yazılır, qalanları keçilir
    const working = PIPE.filter(p => START_STAFF.includes(p.id)).length;
    assert.equal(files.filter(f => /^\d\d-/.test(f)).length, working + 1);
    assert.equal(c.steps.filter(x => x.file).length, working);
  } finally { await s.stop(); await rm(dir, { recursive: true, force: true }); }
});

test('server dayansa kampaniya yarımçıq qalır və qaldığı addımdan davam edir', async () => {
  const dir = await tmp();
  let s = await startServer(dir, 15);
  let campaignId;
  try {
    const twoDone = waitEvent(s.base, ev => ev.type === 'campaign' && ev.phase === 'step-done' && ev.step === 1);
    ({ campaignId } = await post(s.base, '/api/campaign', { name: 'Novruz 2027' }).then(r => r.json()));
    assert.equal((await post(s.base, '/api/campaign', { name: 'İkinci' })).status, 409, 'eyni anda ikinci kampaniya olmaz');
    await twoDone;
    // yenidən qoşulan brauzer gedən kampaniyanı görür
    const hello = await waitEvent(s.base, ev => ev.type === 'hello');
    assert.equal(hello.campaign?.id, campaignId);
    assert.ok(hello.campaign.steps.length >= 2);
  } finally { await s.stop(); }

  s = await startServer(dir, 0);
  try {
    const [c] = await fetch(s.base + '/api/campaigns').then(r => r.json());
    assert.equal(c.id, campaignId);
    assert.equal(c.status, 'interrupted');
    const from = c.steps.length;
    assert.ok(from >= 2 && from < PIPE.length);

    const start = waitEvent(s.base, ev => ev.type === 'campaign' && ev.phase === 'start');
    const done = waitEvent(s.base, ev => ev.type === 'campaign' && ev.phase === 'done');
    const r = await post(s.base, '/api/campaign/resume', { campaignId }).then(r => r.json());
    assert.equal(r.from, from);
    const st = await start;
    assert.equal(st.from, from);
    assert.equal(st.done.length, from);
    await done;
    const [after] = await fetch(s.base + '/api/campaigns').then(r => r.json());
    assert.equal(after.status, 'done');
    assert.equal(after.steps.length, PIPE.length);
    const state = JSON.parse(await readFile(path.join(dir, 'kampaniyalar', (await readdir(path.join(dir, 'kampaniyalar')))[0], 'state.json'), 'utf8'));
    assert.equal(state.status, 'done');
    assert.equal((await post(s.base, '/api/campaign/resume', { campaignId })).status, 409, 'bitmiş kampaniya davam etdirilmir');
  } finally { await s.stop(); await rm(dir, { recursive: true, force: true }); }
});

test('kompüter: tapşırıq personajın qovluğunda fayl yaradır, monitor jurnalı yazılır, qovluqdan çıxmaq olmur', async () => {
  const dir = await tmp(); const s = await startServer(dir);
  try {
    const events = [];
    const done = waitEvent(s.base, ev => { if (ev.type === 'pc') events.push(ev); return ev.type === 'job' && ev.phase === 'done'; });
    await post(s.base, '/api/staff/hire', { id: 'analyst' });
    await post(s.base, '/api/task', { agentId: 'analyst', text: 'Aylıq ROMI hesabatı' });
    await done;
    assert.ok(events.some(e => e.agentId === 'analyst' && e.kind === 'cmd'), 'terminal əmri jurnala düşür');
    assert.ok(events.some(e => e.kind === 'file' && /isler\/.*romi.*\.md/.test(e.text)), 'fayl yazılır: ' + events.map(e => e.text).join(' | '));

    const info = await fetch(s.base + '/api/pc?id=analyst').then(r => r.json());
    assert.equal(info.engine, 'codex');
    assert.equal(info.runs, 'claude', 'CODEX=1 olmadan Codex personajı da Claude ilə işləyir');
    const file = info.files.find(f => /romi/.test(f.f));
    assert.ok(file, 'fayl siyahıda var');
    assert.ok(info.log.some(l => l.kind === 'file'));

    const r = await fetch(s.base + `/api/pc/file?id=analyst&f=${encodeURIComponent(file.f)}`).then(r => r.json());
    assert.match(r.text, /Aylıq ROMI hesabatı/);

    // qovluqdan çıxış: ../, mütləq yol, simlink — hamısı 404
    await symlink('/etc/hosts', path.join(dir, 'pc', 'analyst', 'qacis'));
    for (const f of ['../cmo/README.txt', '/etc/hosts', 'qacis', '']) {
      assert.equal((await fetch(s.base + `/api/pc/file?id=analyst&f=${encodeURIComponent(f)}`)).status, 404, f);
    }
    assert.equal((await fetch(s.base + '/api/pc?id=yoxdur')).status, 404);
  } finally { await s.stop(); await rm(dir, { recursive: true, force: true }); }
});

test('heyət: kiçik başlayır, işə götürmək və çıxarmaq; işləməyənə tapşırıq verilmir', async () => {
  const dir = await tmp(); const s = await startServer(dir);
  try {
    let st = await fetch(s.base + '/api/staff').then(r => r.json());
    assert.equal(st.edition, 'private');
    assert.deepEqual(st.hired, START_STAFF);
    assert.ok(st.candidates.includes('analyst') && st.candidates.includes('target'));
    assert.equal((await post(s.base, '/api/task', { agentId: 'analyst', text: 'ROMI' })).status, 409, 'işə götürülməyənə tapşırıq olmaz');
    assert.equal((await post(s.base, '/api/chat', { agentId: 'analyst', message: 'salam' })).status, 409);

    assert.equal((await post(s.base, '/api/staff/hire', { id: 'analyst' })).status, 200);
    assert.equal((await post(s.base, '/api/staff/hire', { id: 'analyst' })).status, 409);
    assert.equal((await post(s.base, '/api/task', { agentId: 'analyst', text: 'ROMI' })).status, 200);

    assert.equal((await post(s.base, '/api/staff/fire', { id: 'cmo' })).status, 409, 'direktoru çıxarmaq olmaz');
    st = await post(s.base, '/api/staff/fire', { id: 'copy' }).then(r => r.json());
    assert.ok(!st.hired.includes('copy') && st.candidates.includes('copy'));
    assert.equal(st.left.at(-1).id, 'copy');
  } finally { await s.stop(); }
  // vəziyyət diskdə qalır
  const s2 = await startServer(dir);
  try {
    const st = await fetch(s2.base + '/api/staff').then(r => r.json());
    assert.ok(st.hired.includes('analyst') && !st.hired.includes('copy'));
  } finally { await s2.stop(); await rm(dir, { recursive: true, force: true }); }
});

test('ictimai versiya: dijital marketoloq və reklam verənlər heç cür işə götürülmür', async () => {
  const dir = await tmp(); const s = await startServer(dir, 0, { EDITION: 'public' });
  try {
    const st = await fetch(s.base + '/api/staff').then(r => r.json());
    assert.equal(st.edition, 'public');
    for (const id of PUBLIC_EXCLUDED) {
      assert.ok(!st.candidates.includes(id), id + ' namizəd siyahısında olmamalıdır');
      assert.equal((await post(s.base, '/api/staff/hire', { id })).status, 403, id);
    }
  } finally { await s.stop(); await rm(dir, { recursive: true, force: true }); }
});

test('əhval, təcrübə kitabı, səviyyə və yenidən işə götürmə', async () => {
  const dir = await tmp(); const s = await startServer(dir);
  try {
    let st = await fetch(s.base + '/api/staff').then(r => r.json());
    assert.equal(st.mood.copy.label, 'normal');
    assert.equal(st.exp.copy.level, 'yeni');

    // iş bitəndə təcrübə artır və kitaba düşür
    const done = waitEvent(s.base, ev => ev.type === 'job' && ev.phase === 'done');
    await post(s.base, '/api/task', { agentId: 'copy', text: 'Novruz sloqanı' });
    await done;
    st = await fetch(s.base + '/api/staff').then(r => r.json());
    assert.equal(st.exp.copy.n, 1);
    const book = await fetch(s.base + '/api/experience').then(r => r.json());
    assert.equal(book[0].agentId, 'copy'); assert.match(book[0].task, /Novruz/);

    // çıxarmaq hamının əhvalını düşürür, dostlarınkını daha çox
    st = await post(s.base, '/api/staff/fire', { id: 'copy' }).then(r => r.json());
    assert.ok(st.mood.smm.v < 0.6, 'komanda narahatdır');
    assert.ok(st.mood.artdir.v < st.mood.smm.v, 'Leyla Muradın yaxın dostudur, daha çox sarsılır');
    assert.ok(st.past.includes('copy'));

    // geri götürülən küskün başlayır
    st = await post(s.base, '/api/staff/hire', { id: 'copy' }).then(r => r.json());
    assert.ok(st.mood.copy.v < 0.6);
    assert.equal(st.exp.copy.n, 1, 'təcrübə itmir');
  } finally { await s.stop(); await rm(dir, { recursive: true, force: true }); }
});

import http from 'node:http';
const rawGet = (base, p, headers = {}) => new Promise((res, rej) => {
  const u = new URL(base + p);
  http.get({ host: u.hostname, port: u.port, path: u.pathname, headers }, r => { let b = ''; r.on('data', d => (b += d)); r.on('end', () => res({ status: r.statusCode, body: b })); }).on('error', rej);
});

test('sosial şəbəkə: işə götürmə yazışma yaradır, hesabat; internetdən yalnız şifrə ilə və yalnız sosial', async () => {
  const dir = await tmp(); const s = await startServer(dir, 0, { SOCIAL_TICK: '3600', SOCIAL_PASSWORD: 'gizli' });
  try {
    await post(s.base, '/api/staff/hire', { id: 'analyst' });
    await new Promise(r => setTimeout(r, 300));
    const chats = await fetch(s.base + '/api/social/chats').then(r => r.json());
    const ofis = chats.find(c => c.id === 'ofis');
    assert.ok(ofis && ofis.count >= 1, 'Ofis qrupunda salamlama mesajı');
    const rep = await fetch(s.base + '/api/social/report').then(r => r.json());
    assert.ok(rep.people.some(p => p.total.messages >= 1));
    assert.equal(rep.usage.llmLastHour, 0, 'demo rejimdə model çağırılmır');

    const ext = { host: 'ulduz.trycloudflare.com' };
    assert.equal((await rawGet(s.base, '/api/social/feed', ext)).status, 401, 'şifrəsiz bağlı');
    const auth = { ...ext, authorization: 'Basic ' + Buffer.from('rehber:gizli').toString('base64') };
    assert.equal((await rawGet(s.base, '/api/social/feed', auth)).status, 200);
    assert.equal((await rawGet(s.base, '/sosial.html', auth)).status, 200);
    assert.equal((await rawGet(s.base, '/api/staff', auth)).status, 403, 'ofisin idarəsi internetdən bağlıdır');
    assert.equal((await rawGet(s.base, '/index.html', auth)).status, 403);
  } finally { await s.stop(); await rm(dir, { recursive: true, force: true }); }
});

test('ortaq arxiv: tapşırıq Drive/Canva materialı ilə gedir, DOCS=0 olanda rədd olunur', async () => {
  const dir = await tmp(); const s = await startServer(dir);
  try {
    const started = waitEvent(s.base, ev => ev.type === 'job' && ev.phase === 'start');
    const done = waitEvent(s.base, ev => ev.type === 'job' && ev.phase === 'done');
    const r = await post(s.base, '/api/task', { agentId: 'cmo', text: 'Brend qaydalarına görə post', docs: true });
    assert.equal(r.status, 200);
    assert.equal((await started).docs, true);
    await done;
    assert.ok((await fetch(s.base + '/api/health').then(r => r.json())).docs > 0);
  } finally { await s.stop(); await rm(dir, { recursive: true, force: true }); }
  const dir2 = await tmp(); const s2 = await startServer(dir2, 0, { DOCS: '0' });
  try {
    assert.equal((await post(s2.base, '/api/task', { agentId: 'cmo', text: 'x', docs: true })).status, 409);
    assert.equal((await post(s2.base, '/api/task', { agentId: 'cmo', text: 'x' })).status, 200);
  } finally { await s2.stop(); await rm(dir2, { recursive: true, force: true }); }
});

test('yaddaş: eyni anda yazılan xatirələr ayrı açar alır', async () => {
  const { createMemory } = await import('../memory.mjs');
  const dir = await tmp();
  try {
    const m = createMemory(dir, path.join(dir, 'yaddas')); // dir-də ruflo yoxdur: yalnız JSONL
    await m.init();
    await Promise.all([m.remember('cmo', 'bir'), m.remember('cmo', 'iki'), m.remember('cmo', 'üç')]);
    const items = await m.recent('cmo', 10);
    assert.equal(items.length, 3);
    assert.equal(new Set(items.map(x => x.id)).size, 3);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('geri bildiriş: qəbul əhvalı qaldırır, yenidən et iradla yeni variant başladır, marşrut öyrənir, irad ortaq yaddaşa düşür', async () => {
  const dir = await tmp(); const s = await startServer(dir);
  try {
    const done1 = waitEvent(s.base, ev => ev.type === 'job' && ev.phase === 'done' && ev.agentId === 'copy');
    await post(s.base, '/api/task', { agentId: 'copy', text: 'Yeni il üçün slogan' });
    const f1 = (await done1).file;
    assert.equal((await fetch(s.base + '/api/rating?f=' + encodeURIComponent(f1)).then(r => r.json())).rateable, true);
    const before = (await fetch(s.base + '/api/route?text=' + encodeURIComponent('slogan yaz')).then(r => r.json())).find(x => x.id === 'copy').score;

    const redoDone = waitEvent(s.base, ev => ev.type === 'job' && ev.phase === 'done' && ev.agentId === 'copy' && /_duzelis/.test(ev.file || ''));
    const r = await post(s.base, '/api/feedback', { file: f1, verdict: 'redo', note: 'Çox uzundur, qısa yaz' }).then(r => r.json());
    assert.ok(r.jobId, 'yeni variant başlayır');
    assert.equal((await post(s.base, '/api/feedback', { file: f1, verdict: 'ok' })).status, 409, 'iki dəfə qiymət olmur');
    const f2 = (await redoDone).file;
    const after = (await fetch(s.base + '/api/route?text=' + encodeURIComponent('slogan yaz')).then(r => r.json())).find(x => x.id === 'copy').score;
    assert.ok(after < before, 'geri qaytarılan iş marşrut balını endirir');

    assert.equal((await post(s.base, '/api/feedback', { file: f2, verdict: 'ok', note: 'Belə yaxşıdır' })).status, 200);
    const shared = await fetch(s.base + '/api/shared').then(r => r.json());
    assert.ok(shared.some(x => /qısa yaz/.test(x.text) && x.stage === 'is'), 'irad ortaq yaddaşda daimi qalır');
    const mem = await fetch(s.base + '/api/agent?id=copy').then(r => r.json());
    assert.ok(mem.memories.some(m => /geri qaytardı/.test(m.text) && m.stage === 'is'));
    assert.equal((await post(s.base, '/api/feedback', { file: 'yoxdur.md', verdict: 'ok' })).status, 404);
  } finally { await s.stop(); await rm(dir, { recursive: true, force: true }); }
});

test('komanda tapşırığı: bölünür, hissələr paralel gedir, rəhbər birləşdirir', async () => {
  const dir = await tmp(); const s = await startServer(dir);
  try {
    const done = waitEvent(s.base, ev => ev.type === 'team' && (ev.phase === 'done' || ev.phase === 'error'), 60000);
    const r = await post(s.base, '/api/team', { text: 'Yay kampaniyası üçün Instagram post və slogan' }).then(r => r.json());
    assert.equal(r.lead, 'cmo');
    const ev = await done;
    assert.equal(ev.phase, 'done', ev.error);
    assert.ok(ev.parts.length >= 2 && ev.parts.every(p => p.agentId !== 'cmo' && p.file));
    const md = await fetch(s.base + '/api/output?f=' + encodeURIComponent(ev.file)).then(r => r.text());
    assert.match(md, /Marketinq Direktoru/);
    assert.match(md, /Yay kampaniyası üçün Instagram post və slogan/);
    assert.equal((await fetch(s.base + '/api/rating?f=' + encodeURIComponent(ev.file)).then(r => r.json())).rateable, true);

    // bir hissə geri qaytarılır → yeni variant → yekun avtomatik yenidən birləşdirilir
    const again = waitEvent(s.base, e => e.type === 'team' && e.teamId === r.teamId && e.phase === 'done' && e.again, 60000);
    const part = ev.parts[0];
    assert.equal((await post(s.base, '/api/feedback', { file: part.file, verdict: 'redo', note: 'Daha qısa' })).status, 200);
    const ev2 = await again;
    assert.notEqual(ev2.file, ev.file, 'yeni yekun faylı');
    assert.ok(ev2.parts.find(p => p.agentId === part.agentId).file !== part.file, 'yekunda yenilənmiş hissə');
    const teams = await fetch(s.base + '/api/teams').then(r => r.json());
    assert.equal(teams[0].file, ev2.file);
  } finally { await s.stop(); await rm(dir, { recursive: true, force: true }); }
});
