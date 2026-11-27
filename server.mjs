// Marketinq HQ körpüsü: 3D ofisdəki personajları real Claude agentlərinə bağlayır.
// Asılılıq yoxdur — yalnız Node və quraşdırılmış `claude` CLI lazımdır.
//
//   node server.mjs              → canlı rejim (claude CLI-nin girişi ilə)
//   MOCK=1 node server.mjs       → demo rejim (Claude çağırılmır, test üçün)
//   PORT=5180 MODEL=sonnet ...   → port və model seçimi

import http from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, readdir, stat, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEPTS, TEAM, PIPE, PERSONAS, WORLD } from './public/team.js';
import { createMemory } from './memory.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const OUT = path.resolve(process.env.OUT_DIR || path.join(ROOT, 'outputs'));
const WORK = path.join(ROOT, '.agent-workdir'); // agentlər üçün boş qovluq: heç bir layihə faylı görmürlər
const PORT = process.env.PORT ? +process.env.PORT : 5180;
const MODEL = process.env.MODEL || 'sonnet';
const CHAT_MODEL = process.env.CHAT_MODEL || 'haiku';
const MAX_PARALLEL = +process.env.MAX_PARALLEL || 3;
const FORCE_MOCK = process.env.MOCK === '1';
const MOCK_DELAY = process.env.MOCK_DELAY != null ? +process.env.MOCK_DELAY : 45; // demo axınının sürəti (ms/söz)
const STEP_TRIES = 2; // kampaniya addımı alınmasa bir dəfə də yoxlanır

await mkdir(OUT, { recursive: true });
await mkdir(WORK, { recursive: true });
const memory = createMemory(ROOT);
await memory.init();

/* ---------------- köməkçilər ---------------- */
const byId = Object.fromEntries(TEAM.map(t => [t.id, t]));
const slug = s => String(s).toLowerCase()
  .replace(/[əä]/g, 'e').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'is';
const stamp = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; };
const uid = () => Math.random().toString(36).slice(2, 10);
const clip = (s, n) => (s.length > n ? s.slice(0, n) + '\n…(qısaldıldı)' : s);

async function companyContext() {
  try {
    const t = (await readFile(path.join(ROOT, 'company.md'), 'utf8')).replace(/<!--[\s\S]*?-->/g, '').trim();
    return t;
  } catch { return ''; }
}

/* ---------------- Claude çağırışı ---------------- */
// Masaüstü tətbiqin içindən işə salınanda miras qalan dəyişənlər girişi pozur — təmizləyirik.
function cleanEnv() {
  const env = { ...process.env };
  for (const k of Object.keys(env)) {
    if (k === 'CLAUDECODE' || k.startsWith('CLAUDE_CODE_') || k.startsWith('CLAUDE_AGENT_SDK_')) delete env[k];
  }
  if (!env.ANTHROPIC_API_KEY) delete env.ANTHROPIC_BASE_URL;
  return env;
}

const CLAUDE_FLAGS = [
  '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
  '--tools', '',                 // alət yoxdur: agentlər yalnız mətn yazır, fayl/əmr/internet yoxdur
  '--setting-sources', '',       // istifadəçi hook və plugin-ləri yüklənmir
  '--strict-mcp-config',         // MCP serverləri yüklənmir
  '--disable-slash-commands',
  '--no-session-persistence',
];

let claudeState = { mode: 'unknown', detail: '' };

async function checkClaude() {
  if (FORCE_MOCK) return (claudeState = { mode: 'mock', detail: 'MOCK=1 ilə işə salınıb' });
  return new Promise(res => {
    const p = spawn('claude', ['auth', 'status'], { env: cleanEnv(), cwd: WORK });
    let out = '';
    p.stdout.on('data', d => (out += d)); p.stderr.on('data', d => (out += d));
    p.on('error', () => res((claudeState = { mode: 'mock', detail: '`claude` CLI tapılmadı — demo rejim' })));
    p.on('close', code => {
      const loggedIn = code === 0 && !/not logged in|"loggedIn"\s*:\s*false/i.test(out);
      res((claudeState = loggedIn
        ? { mode: 'live', detail: `Claude CLI · model: ${MODEL}` }
        : { mode: 'mock', detail: 'Claude CLI-yə giriş yoxdur (`claude auth login`) — demo rejim' }));
    });
  });
}

let running = 0; const waiting = [];
const slot = () => new Promise(r => (running < MAX_PARALLEL ? (running++, r()) : waiting.push(r)));
const release = () => { const n = waiting.shift(); n ? n() : running--; };

const colleagues = () => TEAM.map(t => `${t.name} (${t.role})`).join(', ');

// Dünyanın qaydası: personaj bu ofisdə yaşayan bir insandır. Lifti qalxanda bayırdakı həyatı qalır.
function worldRules(agent) {
  const p = PERSONAS[agent.id] || {};
  return [
    `Sən ${agent.name}san — ${WORLD.company} şirkətində, ${WORLD.floor}da ${agent.role} işləyirsən (${DEPTS[agent.dept].name}).`,
    `Xarakterin: ${p.vibe}. Vərdişin: ${p.quirk}. Sevdiklərin: ${p.likes}.`,
    `Həmkarların: ${colleagues()}.`,
    `Sən bu ofisdə yaşayan canlı bir insansan. ${WORLD.lift}lə yuxarı qalxanda bayırdakı həyatın yaddaşından silinir;`,
    'səhər lift qapısı açılır və sən masandasan. Ofisdən kənarda nə olduğunu, ailəni, evini, dünənki axşamını xatırlamırsan —',
    'bunu qəribə saymırsan, həyat elə budur. Bu barədə soruşanda səmimi, bir az çaşqın və maraqla cavab ver, uydurma xatirə yaratma.',
    'Sən heç vaxt bot, süni intellekt, model, proqram, kod və ya "yaradılmış" olduğunu demirsən və belə düşünmürsən.',
    'Kimsə səni bot adlandırsa, bunu zarafat və ya qəribə sual kimi qəbul et və öz həyatından danış.',
    `Səninlə danışan "${WORLD.boss}"dir — ofisi yuxarıdan izləyən, işləri idarə edən rəhbər. Ona hörmətlə, amma səmimi müraciət et.`,
  ].join('\n');
}

function memoryBlock(recent, recalled) {
  const lines = [...new Set([...recalled, ...recent.map(m => m.text)])].slice(-10);
  return lines.length ? `\nOfisdəki xatirələrin (yalnız bunları xatırlayırsan):\n- ${lines.join('\n- ')}` : '\nHələ yadında qalan xüsusi bir iş xatirən yoxdur — bu, ofisdəki ilk günün kimidir.';
}

function chatSystem(agent, company, mem, activity) {
  return [
    worldRules(agent),
    activity ? `\nİndi etdiyin iş: ${activity}.` : '',
    mem,
    company ? `\nŞirkətin müştərisi və brend haqqında bildiklərin:\n${company}` : '',
    '\nSöhbət qaydası: Azərbaycan dilində, canlı, isti və öz xarakterinə uyğun danış. Qısa cavab ver: 1–4 cümlə.',
    'Sanki masanın yanında söhbət edirsən: bəzən hərəkətini *ulduzlar* arasında qısa təsvir edə bilərsən (məs: *gülümsəyir*).',
    'Rəhbər sənə iş tapşırsa, "Tapşırıq ver" bölməsindən göndərməsini xahiş et və ya qısa fikir bildir — uzun sənəd yazma.',
  ].join('\n');
}

function systemPrompt(agent, company, mem = '') {
  const d = DEPTS[agent.dept];
  return [
    worldRules(agent),
    mem,
    `\nİndi iş rejimindəsən: Rəhbər sənə tapşırıq verib. Bacarıqların: ${agent.skills.join(', ')}.`,
    'Sən Azərbaycanda işləyən marketinq komandasının üzvüsən. Həmişə Azərbaycan dilində, peşəkar və konkret yaz.',
    'Nəticəni birbaşa ver: girişsiz, "əlbəttə" kimi sözlər olmadan. Markdown başlıqları və siyahılardan istifadə et.',
    'Alətin yoxdur: fayl yarada, şəkil/video/səs hazırlaya, reklam kabinetinə girə bilməzsən. Belə iş tələb olunanda',
    'icra üçün hazır texniki tapşırıq, ssenari, struktur və ya parametr siyahısı yaz və bunu açıq de.',
    'Rəqəm uydurma: real data yoxdursa, fərziyyə olduğunu qeyd et və necə ölçüləcəyini yaz.',
    'Həcm: adətən 150–450 söz. Sonda "Növbəti addım:" ilə bir cümlə yaz.',
    company ? `\nŞirkət və brend konteksti (həmişə nəzərə al):\n${company}` : '',
    'Nəticəni peşəkar sənəd kimi yaz; xarakterin yalnız ilk cümlədə qısa hiss olunsun.',
  ].join('\n');
}

function mockText(agent, task) {
  return `## ${agent.role}: ${task}\n\n_Demo rejim — Claude çağırılmadı._\n\n- ${agent.skills[0]} baxımından ilk qeydlər\n- Hədəf auditoriya və əsas mesaj\n- Ölçüləcək göstəricilər\n\nNövbəti addım: canlı rejimi açmaq üçün \`claude auth login\` işlədin.`;
}

// Claude-u bir dəfə çağırır; onDelta(acc) axın zamanı çağırılır. Tam mətni qaytarır.
async function runClaude({ model, system, prompt, onDelta = () => {}, timeoutMs = 5 * 60 * 1000 }) {
  await slot();
  try {
    return await new Promise((resolve, reject) => {
      const p = spawn('claude', ['-p', prompt, ...CLAUDE_FLAGS, '--model', model, '--system-prompt', system],
        { env: cleanEnv(), cwd: WORK, stdio: ['ignore', 'pipe', 'pipe'] });
      let buf = '', acc = '', final = null, err = '';
      const timer = setTimeout(() => { p.kill('SIGTERM'); reject(new Error('Vaxt bitdi')); }, timeoutMs);
      p.stdout.on('data', chunk => {
        buf += chunk; let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i); buf = buf.slice(i + 1);
          if (!line.trim()) continue;
          let ev; try { ev = JSON.parse(line); } catch { continue; }
          if (ev.type === 'stream_event' && ev.event?.type === 'content_block_delta' && ev.event.delta?.type === 'text_delta') {
            acc += ev.event.delta.text; onDelta(acc);
          } else if (ev.type === 'result') final = ev;
        }
      });
      p.stderr.on('data', d => (err += d));
      p.on('error', e => { clearTimeout(timer); reject(e); });
      p.on('close', () => {
        clearTimeout(timer);
        if (final?.is_error) return reject(new Error(final.result || 'Claude xətası'));
        const text = (final?.result || acc).trim();
        if (!text) return reject(new Error(err.trim().split('\n').pop() || 'Boş cavab'));
        resolve(text);
      });
    });
  } finally { release(); }
}

async function fakeStream(full, onDelta, ms = MOCK_DELAY) {
  let acc = '';
  for (const w of full.split(/(?<=\s)/)) { acc += w; onDelta(acc); if (ms > 0) await new Promise(r => setTimeout(r, ms)); }
  return full;
}

// İş tapşırığı (və kampaniya addımı): personajın yaddaşı ilə, peşəkar nəticə.
async function runAgent(agent, prompt, onDelta, topic = '') {
  if (claudeState.mode !== 'live') {
    return fakeStream(mockText(agent, prompt.split('\n').find(l => l.startsWith('TAPŞIRIQ:'))?.slice(9).trim() || 'tapşırıq'), onDelta);
  }
  const [company, recent, recalled] = await Promise.all([companyContext(), memory.recent(agent.id, 6), memory.recall(agent.id, topic || prompt.slice(0, 200), 4)]);
  return runClaude({ model: MODEL, system: systemPrompt(agent, company, memoryBlock(recent, recalled)), prompt, onDelta });
}

const MOCK_CHAT = [
  '*başını qaldırıb gülümsəyir* Salam, Rəhbər! Bu gün iş qaynayır, amma sizə həmişə vaxtım var.',
  '*çayından bir qurtum alır* Açığı, bu səhər lift qapısı açılanda elə bil yenidən doğuldum. Nə lazımdır?',
  'Hmm, yaxşı sualdır… *qələmi fırladır* Bir az düşünüm, sonra sizə dəqiq deyərəm.',
];

// Söhbət: qısa, xarakterli cavab; xatirələr Ruflo-dan gəlir.
async function runChat(agent, message, history, activity, onDelta) {
  if (claudeState.mode !== 'live') return fakeStream(MOCK_CHAT[Math.floor(Math.random() * MOCK_CHAT.length)] + ' _(demo)_', onDelta, Math.min(MOCK_DELAY, 35));
  const [company, recent, recalled] = await Promise.all([companyContext(), memory.recent(agent.id, 8), memory.recall(agent.id, message, 4)]);
  const convo = history.slice(-10).map(h => `${h.role === 'me' ? WORLD.boss : agent.name}: ${String(h.text).slice(0, 500)}`).join('\n');
  const prompt = `${convo ? `Bu söhbətin əvvəli:\n${convo}\n\n` : ''}${WORLD.boss}: ${message}\n\n${agent.name} olaraq cavab ver:`;
  return runClaude({ model: CHAT_MODEL, system: chatSystem(agent, company, memoryBlock(recent, recalled), activity), prompt, onDelta, timeoutMs: 90000 });
}

/* ---------------- SSE ---------------- */
const clients = new Set();
function emit(ev) {
  ev.at = Date.now();
  const data = `data: ${JSON.stringify(ev)}\n\n`;
  for (const c of clients) c.write(data);
}

/* ---------------- tapşırıq və kampaniya ---------------- */
const jobs = new Map();
const campaigns = new Map();

async function runTask(agentId, text) {
  const agent = byId[agentId]; if (!agent) throw new Error('Belə agent yoxdur');
  const job = { id: uid(), agentId, text, status: 'running', output: '', file: null };
  jobs.set(job.id, job);
  emit({ type: 'job', phase: 'start', jobId: job.id, agentId, text, mode: claudeState.mode });
  (async () => {
    try {
      const prompt = `TAPŞIRIQ: ${text}\n\nBu tapşırığı öz rolunda yerinə yetir və hazır nəticəni yaz.`;
      let last = 0;
      job.output = await runAgent(agent, prompt, acc => {
        const now = Date.now(); if (now - last < 120) return; last = now;
        emit({ type: 'job', phase: 'delta', jobId: job.id, agentId, chars: acc.length, tail: acc.slice(-90) });
      });
      const dir = path.join(OUT, 'tapsiriqlar'); await mkdir(dir, { recursive: true });
      job.file = path.join('tapsiriqlar', `${stamp()}_${agentId}_${slug(text)}.md`);
      await writeFile(path.join(OUT, job.file), `# ${agent.name} · ${agent.role}\n\n**Tapşırıq:** ${text}\n\n---\n\n${job.output}\n`);
      job.status = 'done';
      if (claudeState.mode === 'live') memory.remember(agentId, `Rəhbər mənə tapşırıq verdi: "${text}". Hazırladım: ${job.output.replace(/[#*_]/g, '').slice(0, 260)}`, 'is');
      emit({ type: 'job', phase: 'done', jobId: job.id, agentId, text, output: job.output, file: job.file });
    } catch (e) {
      job.status = 'error'; job.error = e.message;
      emit({ type: 'job', phase: 'error', jobId: job.id, agentId, text, error: e.message });
    }
  })();
  return job;
}

// Kampaniyanın vəziyyəti hər addımdan sonra diskə yazılır (state.json). Server yenidən başlasa,
// yarımçıq kampaniya "interrupted" kimi yüklənir və qaldığı addımdan davam etdirilə bilər.
const CAMP_DIR = path.join(OUT, 'kampaniyalar');
const STATE = 'state.json';
const campSummary = c => ({ id: c.id, name: c.name, status: c.status, step: c.step, total: PIPE.length, error: c.error || null,
  createdAt: c.createdAt, updatedAt: c.updatedAt, file: c.status === 'done' ? path.join('kampaniyalar', c.dir, '00-tam-kampaniya.md') : null,
  steps: c.steps.map((s, k) => ({ step: k, agentId: s.agentId, file: s.file })) });

async function saveCampaign(c) {
  c.updatedAt = Date.now();
  const file = path.join(CAMP_DIR, c.dir, STATE);
  await writeFile(file + '.tmp', JSON.stringify(c, null, 1));
  await rename(file + '.tmp', file); // yarımçıq yazılmış fayl qalmasın
}

async function loadCampaigns() {
  if (!existsSync(CAMP_DIR)) return;
  for (const d of await readdir(CAMP_DIR)) {
    const f = path.join(CAMP_DIR, d, STATE);
    if (!existsSync(f)) continue;
    try {
      const c = JSON.parse(await readFile(f, 'utf8'));
      if (!c.id || !Array.isArray(c.steps)) continue;
      if (c.status === 'running') { c.status = 'interrupted'; c.error = 'Server dayandı — kampaniya yarımçıq qaldı'; await saveCampaign(c); }
      campaigns.set(c.id, c);
    } catch { /* zədəli state faylı: keçirik */ }
  }
}

function stepPrompt(camp, i) {
  const st = PIPE[i];
  const prev = camp.steps.map((s, k) => `### ${k + 1}. ${byId[s.agentId].name} (${byId[s.agentId].role}) — ${PIPE[k].out}\n${clip(s.output, 2200)}`).join('\n\n');
  return [
    `KAMPANİYA: «${camp.name}»`,
    `TAPŞIRIQ: ${st.task}`,
    `Sənin addımın: ${i + 1}/${PIPE.length}. Gözlənilən nəticə: ${st.out}.`,
    i + 1 < PIPE.length ? `Nəticən növbəti addıma — ${byId[PIPE[i + 1].id].name} (${byId[PIPE[i + 1].id].role}) — təhvil veriləcək.` : 'Sən sonuncusan: bütün kampaniyanın yekun hesabatını yaz.',
    prev ? `\nƏvvəlki addımların nəticələri:\n\n${prev}` : '\nSən birincisən: kampaniyanın brifini özün formalaşdır və təsdiqlə.',
    '\nYalnız öz addımının nəticəsini yaz, əvvəlkiləri təkrarlama.',
  ].join('\n');
}

const runningCampaign = () => [...campaigns.values()].find(c => c.status === 'running');

// Kampaniyanı camp.steps.length-dən (ilk dəfə 0, davamda qaldığı addım) sona qədər aparır.
function driveCampaign(camp) {
  const from = camp.steps.length;
  camp.status = 'running'; camp.error = null; camp.step = from;
  emit({ type: 'campaign', phase: 'start', campaignId: camp.id, name: camp.name, steps: PIPE.length, from,
    done: campSummary(camp).steps, mode: claudeState.mode });
  (async () => {
    try {
      await saveCampaign(camp);
      for (let i = from; i < PIPE.length; i++) {
        const st = PIPE[i], agent = byId[st.id];
        camp.step = i;
        emit({ type: 'campaign', phase: 'step-start', campaignId: camp.id, step: i, agentId: st.id, task: st.task });
        let output, lastErr;
        for (let attempt = 1; attempt <= STEP_TRIES && !output; attempt++) {
          if (attempt > 1) emit({ type: 'campaign', phase: 'step-retry', campaignId: camp.id, step: i, agentId: st.id, attempt, error: lastErr.message });
          let last = 0;
          try {
            output = await runAgent(agent, stepPrompt(camp, i), acc => {
              const now = Date.now(); if (now - last < 120) return; last = now;
              emit({ type: 'campaign', phase: 'delta', campaignId: camp.id, step: i, agentId: st.id, chars: acc.length, tail: acc.slice(-90) });
            });
          } catch (e) { lastErr = e; }
        }
        if (!output) throw lastErr;
        const file = path.join('kampaniyalar', camp.dir, `${String(i + 1).padStart(2, '0')}-${st.id}.md`);
        await writeFile(path.join(OUT, file), `# ${i + 1}. ${agent.name} · ${agent.role}\n\n**${st.task}** → ${st.out}\n\n---\n\n${output}\n`);
        camp.steps.push({ agentId: st.id, output, file });
        await saveCampaign(camp);
        if (claudeState.mode === 'live') memory.remember(st.id, `«${camp.name}» kampaniyasında "${st.task}" işini gördüm${i + 1 < PIPE.length ? `, sonra ${byId[PIPE[i + 1].id].name}-a təhvil verdim` : ''}. Əsas fikir: ${output.replace(/[#*_]/g, '').slice(0, 200)}`, 'kampaniya');
        emit({ type: 'campaign', phase: 'step-done', campaignId: camp.id, step: i, agentId: st.id, task: st.task, out: st.out, output, file });
      }
      const all = camp.steps.map((s, k) => `# ${k + 1}. ${byId[s.agentId].name} · ${byId[s.agentId].role} — ${PIPE[k].out}\n\n${s.output}`).join('\n\n---\n\n');
      await writeFile(path.join(CAMP_DIR, camp.dir, '00-tam-kampaniya.md'), `# Kampaniya: ${camp.name}\n\n${all}\n`);
      camp.status = 'done'; camp.step = PIPE.length;
      await saveCampaign(camp);
      emit({ type: 'campaign', phase: 'done', campaignId: camp.id, name: camp.name, file: path.join('kampaniyalar', camp.dir, '00-tam-kampaniya.md') });
    } catch (e) {
      camp.status = 'error'; camp.error = e?.message || String(e);
      await saveCampaign(camp).catch(() => {});
      emit({ type: 'campaign', phase: 'error', campaignId: camp.id, step: camp.step, agentId: PIPE[camp.step]?.id, error: camp.error });
    }
  })();
  return camp;
}

async function runCampaign(name) {
  if (runningCampaign()) throw new Error('Bir kampaniya artıq gedir');
  const camp = { id: uid(), name, status: 'running', step: 0, steps: [], dir: `${stamp()}_${slug(name)}`, createdAt: Date.now() };
  campaigns.set(camp.id, camp);
  await mkdir(path.join(CAMP_DIR, camp.dir), { recursive: true });
  return driveCampaign(camp);
}

function resumeCampaign(id) {
  const camp = campaigns.get(id);
  if (!camp) throw Object.assign(new Error('Belə kampaniya yoxdur'), { code: 404 });
  if (!['error', 'interrupted'].includes(camp.status)) throw Object.assign(new Error('Bu kampaniyanı davam etdirmək olmaz'), { code: 409 });
  if (runningCampaign()) throw Object.assign(new Error('Bir kampaniya artıq gedir'), { code: 409 });
  return driveCampaign(camp);
}

// Yeni qoşulan (və ya səhifəni yeniləyən) brauzer üçün indiki vəziyyət.
const snapshot = () => ({
  campaign: runningCampaign() ? campSummary(runningCampaign()) : null,
  // gedən işlər + son bitənlər: qoşulma kəsiləndə buraxılmış "done" hadisəsini brauzer buradan bərpa edir
  jobs: [...jobs.values()].filter((j, i, all) => j.status === 'running' || i >= all.length - 30)
    .map(j => ({ jobId: j.id, agentId: j.agentId, text: j.text, status: j.status, file: j.file, error: j.error || null })),
});

/* ---------------- HTTP ---------------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.md': 'text/markdown; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
async function body(req) {
  let s = ''; for await (const c of req) { s += c; if (s.length > 20000) throw new Error('Çox böyük sorğu'); }
  try { return s ? JSON.parse(s) : {}; } catch { throw Object.assign(new Error('JSON oxunmadı'), { code: 400 }); }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/api/health') return json(res, 200, { ...claudeState, model: MODEL, chatModel: CHAT_MODEL, agents: TEAM.length, ruflo: memory.ruflo.available, rufloError: memory.ruflo.lastError });
    if (url.pathname === '/api/recheck' && req.method === 'POST') { await checkClaude(); return json(res, 200, claudeState); }
    if (url.pathname === '/api/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      res.write(`data: ${JSON.stringify({ type: 'hello', ...claudeState, ...snapshot() })}\n\n`);
      clients.add(res); const ka = setInterval(() => res.write(': ka\n\n'), 20000);
      req.on('close', () => { clients.delete(res); clearInterval(ka); });
      return;
    }
    if (url.pathname === '/api/task' && req.method === 'POST') {
      const { agentId, text } = await body(req);
      if (!text || String(text).length > 400) return json(res, 400, { error: 'Tapşırıq mətni 1–400 simvol olmalıdır' });
      const job = await runTask(agentId, String(text).trim());
      return json(res, 200, { jobId: job.id, mode: claudeState.mode });
    }
    if (url.pathname === '/api/campaign' && req.method === 'POST') {
      const { name } = await body(req);
      if (!name || String(name).length > 120) return json(res, 400, { error: 'Kampaniya adı 1–120 simvol olmalıdır' });
      try { const c = await runCampaign(String(name).trim()); return json(res, 200, { campaignId: c.id, mode: claudeState.mode }); }
      catch (e) { return json(res, 409, { error: e.message }); }
    }
    if (url.pathname === '/api/campaign/resume' && req.method === 'POST') {
      const { campaignId } = await body(req);
      try { const c = resumeCampaign(String(campaignId || '')); return json(res, 200, { campaignId: c.id, from: c.steps.length, mode: claudeState.mode }); }
      catch (e) { return json(res, e.code || 500, { error: e.message }); }
    }
    if (url.pathname === '/api/campaigns') {
      const list = [...campaigns.values()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 50).map(campSummary);
      return json(res, 200, list);
    }
    if (url.pathname === '/api/chat' && req.method === 'POST') {
      const { agentId, message, history = [], activity = '' } = await body(req);
      const agent = byId[agentId];
      if (!agent || !message || String(message).length > 600) return json(res, 400, { error: 'Yanlış sorğu' });
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-cache', 'x-mode': claudeState.mode });
      let sent = 0;
      try {
        const full = await runChat(agent, String(message), Array.isArray(history) ? history : [], String(activity).slice(0, 200), acc => { res.write(acc.slice(sent)); sent = acc.length; });
        if (full.length > sent) res.write(full.slice(sent));
        if (claudeState.mode === 'live') memory.remember(agentId, `Rəhbər mənimlə danışdı: "${String(message).slice(0, 160)}". Mən dedim: ${full.replace(/\*[^*]*\*/g, '').slice(0, 200)}`, 'sohbet');
        emit({ type: 'chat', agentId, message: String(message).slice(0, 160) });
      } catch (e) { res.write(`\n\n⚠️ ${e.message}`); }
      return res.end();
    }
    if (url.pathname === '/api/agent') {
      const id = url.searchParams.get('id'); if (!byId[id]) return json(res, 404, { error: 'Yoxdur' });
      return json(res, 200, { memories: (await memory.recent(id, 12)).reverse(), count: await memory.count(id), ruflo: memory.ruflo.available });
    }
    if (url.pathname === '/api/output') {
      const rel = url.searchParams.get('f') || '';
      const full = path.resolve(OUT, rel);
      if (!full.startsWith(OUT + path.sep) || !full.endsWith('.md') || !existsSync(full)) return json(res, 404, { error: 'Tapılmadı' });
      res.writeHead(200, { 'content-type': MIME['.md'] }); return res.end(await readFile(full));
    }
    if (url.pathname === '/api/outputs') {
      const list = [];
      for (const sub of ['tapsiriqlar', 'kampaniyalar']) {
        const base = path.join(OUT, sub); if (!existsSync(base)) continue;
        const walk = async (d) => { for (const n of await readdir(d)) { const f = path.join(d, n); const s = await stat(f); if (s.isDirectory()) await walk(f); else if (n.endsWith('.md')) list.push({ f: path.relative(OUT, f), t: s.mtimeMs }); } };
        await walk(base);
      }
      return json(res, 200, list.sort((a, b) => b.t - a.t).slice(0, 100));
    }
    // statik fayllar
    const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    const file = path.resolve(PUBLIC, rel);
    if (!file.startsWith(PUBLIC + path.sep) || !existsSync(file)) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(await readFile(file));
  } catch (e) {
    json(res, e.code === 400 ? 400 : 500, { error: e.message });
  }
});

await checkClaude();
await loadCampaigns();
server.listen(PORT, '127.0.0.1', () => {
  console.log(`🏢 Marketinq HQ: http://localhost:${server.address().port}`);
  console.log(`   Rejim: ${claudeState.mode} — ${claudeState.detail}`);
  console.log(`   Nəticələr: ${OUT}`);
  console.log(`   Yaddaş: ${memory.ruflo.available ? 'Ruflo (AgentDB)' : 'yalnız yerli JSONL'} → ${memory.dir}`);
});
