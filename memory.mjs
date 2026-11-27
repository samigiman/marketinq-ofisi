// İş yaddaşı: hər personajın yalnız ofisdəki xatirələri.
// Əsas mənbə Ruflo-nun yaddaşıdır (AgentDB, semantik axtarış). Hər xatirə həm də yerli JSONL-ə yazılır,
// ona görə Ruflo işləməsə də son xatirələr itmir; axtarışdan sonra tam mətn də oradan götürülür.
//
// Model: Ruflo-nun standart modeli (all-MiniLM-L6-v2) yalnız ingiliscədir və Azərbaycan dilində mənanı tutmur.
// Biz multilingual-e5-small (384 ölçü, ~118 MB, 8-bit) qoşuruq: Ruflo modeli işlədiyi qovluqdakı
// .claude-flow/embeddings.json-dan oxuyur. e5 mətndən əvvəl "passage: " / "query: " istəyir — bunu burada əlavə edirik.
// MEMORY_MODEL=minilm köhnə modelə qaytarır.

import { spawn } from 'node:child_process';
import { appendFile, readFile, writeFile, mkdir, rename, link, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const MODELS = {
  e5: { id: 'Xenova/multilingual-e5-small', passage: 'passage: ', query: 'query: ' },
  minilm: { id: 'Xenova/all-MiniLM-L6-v2', passage: '', query: '' },
};
const HF = 'https://huggingface.co';
const MODEL_FILES = ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'onnx/model_quantized.onnx'];
// Ruflo ilə eyni keş qovluğu (memory/model-cache-dir.js).
const cacheDir = () => process.env.TRANSFORMERS_CACHE || process.env.HF_HOME || path.join(os.homedir(), '.cache', 'ruflo', 'models');

export function createMemory(root, dir = path.join(root, 'yaddas')) {
  const db = path.join(dir, 'ofis.db');
  const bin = path.join(root, 'node_modules', '.bin', 'ruflo');
  const model = MODELS[process.env.MEMORY_MODEL] || MODELS.e5;
  // available: Ruflo quraşdırılıb; ready: model yüklənib və baza bu modelə uyğundur.
  const ruflo = { available: existsSync(bin), ready: false, model: model.id, lastError: '' };
  let queue = Promise.resolve();
  let seq = 0; // eyni millisaniyədə yazılan xatirələrin açarı üst-üstə düşməsin

  const run = (args, timeoutMs = 60000) => new Promise((resolve, reject) => {
    // Claude Code-un içindən işə salınanda CLAUDE_PROJECT_DIR və s. miras qalır və Ruflo
    // özünü HƏMİN layihəyə quraşdırır (hook-lar, plugin-lər, CLAUDE.md). Bunların hamısını silirik;
    // Ruflo yalnız yaddas/ qovluğunu görür.
    const env = { npm_config_update_notifier: 'false', CLAUDE_FLOW_DB_PATH: db, CLAUDE_PROJECT_DIR: dir,
      RUFLO_NO_SKILLS_SH: '1', CLAUDE_FLOW_HOOKS_ENABLED: 'false' };
    for (const [k, v] of Object.entries(process.env)) {
      if (!/^(CLAUDE|ANTHROPIC|RUFLO|CLAUDE_FLOW)/.test(k) && !(k in env)) env[k] = v;
    }
    const p = spawn(bin, args, { cwd: dir, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    const t = setTimeout(() => { p.kill('SIGTERM'); reject(new Error('ruflo vaxt aşımı')); }, timeoutMs);
    p.stdout.on('data', d => (out += d)); p.stderr.on('data', d => (err += d));
    p.on('error', e => { clearTimeout(t); reject(e); });
    p.on('close', code => { clearTimeout(t); code === 0 ? resolve(out) : reject(new Error((err || out).trim().split('\n').pop() || `ruflo kod ${code}`)); });
  });

  const ns = id => `ofis-${id}`;
  const jsonl = id => path.join(dir, `${id}.jsonl`);
  const cfgFile = path.join(dir, '.claude-flow', 'embeddings.json');

  // Model faylları bir dəfə yüklənir. Ruflo 32-bit model.onnx (470 MB) axtarır; 8-bit variantı həmin adla bağlayırıq,
  // yoxsa hər Ruflo çağırışı böyük faylı yenidən yükləməyə başlayır və vaxt limitinə düşür.
  async function ensureModel() {
    if (!model.passage) return; // standart model Ruflo-nun öz paketindədir
    const base = path.join(cacheDir(), model.id);
    const full = path.join(base, 'onnx', 'model.onnx');
    if (existsSync(full)) return;
    await mkdir(path.join(base, 'onnx'), { recursive: true });
    for (const f of MODEL_FILES) {
      const dest = path.join(base, f);
      if (existsSync(dest)) continue;
      const r = await fetch(`${HF}/${model.id}/resolve/main/${f}`);
      if (!r.ok) throw new Error(`model yüklənmədi: ${f} (${r.status})`);
      const tmp = `${dest}.yuklenir`;
      await writeFile(tmp, Buffer.from(await r.arrayBuffer()));
      await rename(tmp, dest);
    }
    await link(path.join(base, 'onnx', 'model_quantized.onnx'), full).catch(async e => { if (e.code !== 'EEXIST') throw e; });
  }

  // Baza başqa modellə qurulubsa (və ya konfiqurasiya yoxdursa), köhnə vektorlar yeni modellə uyğun gəlmir:
  // bazanı kənara qoyub bütün xatirələri JSONL-dən yenidən yazırıq.
  async function ensureStore() {
    let cfg = null; try { cfg = JSON.parse(await readFile(cfgFile, 'utf8')); } catch {}
    if (cfg?.model === model.id) return false;
    await mkdir(path.dirname(cfgFile), { recursive: true });
    const old = (await readdir(dir)).filter(f => f.startsWith('ofis.db'));
    const stamp = Date.now();
    for (const f of old) await rename(path.join(dir, f), path.join(dir, `kohne-${stamp}-${f}`));
    await writeFile(cfgFile, JSON.stringify({ model: model.id, dimension: 384, hyperbolic: { enabled: false } }, null, 2));
    return old.length > 0;
  }

  function store(agentId, item) {
    queue = queue.then(() => run(['memory', 'store', '-k', `${agentId}-${item.id || item.t}`, '--value', model.passage + item.text,
      '-n', ns(agentId), '--path', db, '--tags', item.kind, '--provenance', 'agent_output'], 120000))
      .catch(e => { ruflo.lastError = e.message; });
  }

  async function init() {
    await mkdir(dir, { recursive: true });
    if (!ruflo.available) return;
    // Model yüklənənə qədər server gözləmir: xatirələr JSONL-ə yazılır, axtarış boş qaytarır.
    ruflo.lastError = 'model hazırlanır';
    (async () => {
      await ensureModel();
      const rebuilt = await ensureStore();
      ruflo.ready = true; ruflo.lastError = '';
      if (rebuilt) {
        const files = (await readdir(dir)).filter(f => f.endsWith('.jsonl'));
        for (const f of files) for (const item of await readAll(f.slice(0, -6))) store(f.slice(0, -6), item);
      }
    })().catch(e => { ruflo.lastError = e.message; });
  }

  async function readAll(agentId) {
    try { return (await readFile(jsonl(agentId), 'utf8')).trim().split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch { return []; }
  }

  // Xatirə yaz (növbəyə düşür, gözləmək lazım deyil). Model hələ hazır deyilsə, yalnız JSONL-ə düşür;
  // yenidən qurulma zamanı Ruflo-ya da köçürülür.
  function remember(agentId, text, kind = 'qeyd') {
    const t = Date.now();
    const item = { t, id: `${t}-${seq++}`, kind, text: String(text).replace(/\s+/g, ' ').trim().slice(0, 600) };
    const local = appendFile(jsonl(agentId), JSON.stringify(item) + '\n').catch(() => {});
    if (ruflo.available && ruflo.ready) store(agentId, item);
    return local;
  }

  async function recent(agentId, n = 8) { return (await readAll(agentId)).slice(-n); }
  async function count(agentId) { return (await readAll(agentId)).length; }

  // Mövzuya uyğun xatirələr (Ruflo semantik axtarışı), tam mətnlə. Alınmasa — boş siyahı.
  // e5-in balları sıxdır (adətən 0.75–0.9), ona görə sabit hədd yox, ən yaxşı nəticəyə nisbət işlədirik.
  async function recall(agentId, query, n = 4) {
    if (!ruflo.available || !ruflo.ready || !query) return [];
    try {
      const out = await run(['memory', 'search', '-q', model.query + String(query).slice(0, 200), '-n', ns(agentId), '--path', db,
        '-l', String(n), '--format', 'json'], 15000);
      const j = JSON.parse(out.slice(out.indexOf('{')));
      const res = j.results || [];
      if (!res.length) return [];
      const top = res[0].score, floor = model.passage ? Math.max(0.78, top - 0.02) : 0.35;
      const byId = new Map((await readAll(agentId)).map(x => [x.id || String(x.t), x.text]));
      return res.filter(r => r.score >= floor)
        .map(r => byId.get(String(r.key).slice(agentId.length + 1)) || String(r.preview || '').replace(model.passage, ''));
    } catch (e) { ruflo.lastError = e.message; return []; }
  }

  // Növbədəki bütün yazmalar bitənə qədər gözlə (test və bağlanış üçün).
  const flush = () => queue;
  // Model və baza hazır olana qədər gözlə (test üçün).
  async function whenReady(ms = 300000) {
    for (const end = Date.now() + ms; Date.now() < end; await new Promise(r => setTimeout(r, 300)))
      if (ruflo.ready || (ruflo.lastError && ruflo.lastError !== 'model hazırlanır')) break;
    return ruflo.ready;
  }

  return { init, remember, recent, recall, count, flush, whenReady, ruflo, dir };
}
