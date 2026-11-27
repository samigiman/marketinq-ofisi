// İş yaddaşı: hər personajın yalnız ofisdəki xatirələri.
// Əsas mənbə Ruflo-nun yaddaşıdır (AgentDB, semantik axtarış). Hər xatirə həm də yerli JSONL-ə yazılır,
// ona görə Ruflo işləməsə də son xatirələr itmir; axtarışdan sonra tam mətn də oradan götürülür.
//
// Model: Ruflo-nun standart modeli (all-MiniLM-L6-v2) yalnız ingiliscədir və Azərbaycan dilində mənanı tutmur.
// Biz multilingual-e5-small (384 ölçü, ~118 MB, 8-bit) qoşuruq: Ruflo modeli işlədiyi qovluqdakı
// .claude-flow/embeddings.json-dan oxuyur. e5 mətndən əvvəl "passage: " / "query: " istəyir — bunu burada əlavə edirik.
// MEMORY_MODEL=minilm köhnə modelə qaytarır.
//
// Unudaraq öyrənmə (forget.mjs): iş xatirələri tam qalır, gündəlik xatirələr zamanla solur və unudulur,
// yada düşən xatirə möhkəmlənir. Möhkəmlik <id>.guc.json-da saxlanır; JSONL arxivdir, heç nə silinmir.

import { spawn } from 'node:child_process';
import { appendFile, readFile, writeFile, mkdir, rename, link, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { classify, initialStrength, reinforce, view } from './forget.mjs';

const MODELS = {
  e5: { id: 'Xenova/multilingual-e5-small', passage: 'passage: ', query: 'query: ' },
  minilm: { id: 'Xenova/all-MiniLM-L6-v2', passage: '', query: '' },
};
const HF = 'https://huggingface.co';
const MODEL_FILES = ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'onnx/model_quantized.onnx'];
// Ruflo ilə eyni keş qovluğu (memory/model-cache-dir.js).
const cacheDir = () => process.env.TRANSFORMERS_CACHE || process.env.HF_HOME || path.join(os.homedir(), '.cache', 'ruflo', 'models');

export function createMemory(root, dir = path.join(root, 'yaddas'), { now = () => Date.now() } = {}) {
  const db = path.join(dir, 'ofis.db');
  const bin = path.join(root, 'node_modules', '.bin', 'ruflo');
  const model = MODELS[process.env.MEMORY_MODEL] || MODELS.e5;
  // available: Ruflo quraşdırılıb; ready: model yüklənib və baza bu modelə uyğundur.
  // MEMORY_RUFLO=0: yalnız yerli yaddaş (testlər və Ruflo-suz iş üçün).
  const ruflo = { available: process.env.MEMORY_RUFLO !== '0' && existsSync(bin), ready: false, model: model.id, lastError: '' };
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
    try {
      return (await readFile(jsonl(agentId), 'utf8')).trim().split('\n').filter(Boolean)
        .map(l => { const x = JSON.parse(l); x.id ||= String(x.t); x.cls ||= classify(x.kind, x.text); return x; });
    } catch { return []; }
  }

  // Möhkəmlik vəziyyəti: id → { s: möhkəmlik (gün), seen: son yada düşmə, hits: neçə dəfə, forgotten }.
  const guc = new Map(), gucFile = id => path.join(dir, `${id}.guc.json`), dirty = new Set();
  async function strengths(agentId) {
    if (!guc.has(agentId)) {
      let m = {}; try { m = JSON.parse(await readFile(gucFile(agentId), 'utf8')); } catch {}
      guc.set(agentId, m);
    }
    return guc.get(agentId);
  }
  let saveTimer = null;
  function markDirty(agentId) {
    dirty.add(agentId);
    saveTimer ||= setTimeout(async () => {
      saveTimer = null;
      for (const id of [...dirty]) { dirty.delete(id); await writeFile(gucFile(id), JSON.stringify(guc.get(id))).catch(() => {}); }
    }, 300);
  }
  async function saveNow() { clearTimeout(saveTimer); saveTimer = null; for (const id of [...dirty]) { dirty.delete(id); await writeFile(gucFile(id), JSON.stringify(guc.get(id))).catch(() => {}); } }

  // Xatirə yada düşdü: möhkəmlik artır, unutma saatı sıfırlanır. İş xatirələri onsuz da solmur.
  async function touch(agentId, items) {
    const st = await strengths(agentId), t = now();
    for (const it of items) {
      if (it.cls === 'is') continue;
      const cur = st[it.id] || { s: initialStrength(it.cls), hits: 0 };
      if (cur.forgotten) continue;
      st[it.id] = { s: Number(reinforce(cur.s, cur.hits).toFixed(2)), seen: t, hits: cur.hits + 1 };
    }
    markDirty(agentId);
  }

  // Bütün xatirələr indiki görünüşü ilə (Rəhbərin paneli üçün; unudulanlar da daxil).
  async function list(agentId) {
    const st = await strengths(agentId), t = now();
    return (await readAll(agentId)).map(x => view(x, st[x.id], t));
  }

  // Unudulmuş xatirələri qeyd et və Ruflo-dan sil: artıq axtarışda çıxmasınlar.
  async function sweep() {
    let forgotten = 0;
    const files = (await readdir(dir).catch(() => [])).filter(f => f.endsWith('.jsonl'));
    for (const f of files) {
      const agentId = f.slice(0, -6), st = await strengths(agentId);
      for (const v of await list(agentId)) {
        if (v.stage !== 'unudulub' || st[v.id]?.forgotten) continue;
        st[v.id] = { ...(st[v.id] || { s: initialStrength(v.cls), hits: 0 }), forgotten: true };
        forgotten++; markDirty(agentId);
        if (ruflo.available && ruflo.ready) queue = queue.then(() => run(['memory', 'delete', '-k', `${agentId}-${v.id}`, '-n', ns(agentId), '--path', db, '-f'], 30000)).catch(() => {});
      }
    }
    await saveNow();
    return forgotten;
  }

  // Xatirə yaz (növbəyə düşür, gözləmək lazım deyil). Model hələ hazır deyilsə, yalnız JSONL-ə düşür;
  // yenidən qurulma zamanı Ruflo-ya da köçürülür.
  function remember(agentId, text, kind = 'qeyd') {
    const t = now();
    const clean = String(text).replace(/\s+/g, ' ').trim().slice(0, 600);
    const item = { t, id: `${t}-${seq++}`, kind, cls: classify(kind, clean), text: clean };
    const local = appendFile(jsonl(agentId), JSON.stringify(item) + '\n').catch(() => {});
    if (ruflo.available && ruflo.ready) store(agentId, item);
    return local;
  }

  async function recent(agentId, n = 8) { return (await readAll(agentId)).slice(-n); }
  async function count(agentId) { return (await readAll(agentId)).length; }
  // Promptda yada düşənlər: son xatirələrdən unudulmayanlar, dumanlıların yalnız ümumi məzmunu.
  async function vivid(agentId, n = 8) { return (await list(agentId)).filter(v => v.stage !== 'unudulub').slice(-n); }

  // Mövzuya uyğun xatirələr (Ruflo semantik axtarışı), tam mətnlə. Alınmasa — boş siyahı.
  // e5-in balları sıxdır (adətən 0.75–0.9), ona görə sabit hədd yox, ən yaxşı nəticəyə nisbət işlədirik.
  async function recall(agentId, query, n = 4) {
    if (!ruflo.available || !ruflo.ready || !query) return [];
    try {
      const out = await run(['memory', 'search', '-q', model.query + String(query).slice(0, 200), '-n', ns(agentId), '--path', db,
        '-l', String(n), '--format', 'json'], 30000); // yük altında (paralel işlər + yazmalar) 15 saniyə çatmırdı
      const j = JSON.parse(out.slice(out.indexOf('{')));
      const res = j.results || [];
      if (!res.length) return [];
      const top = res[0].score, floor = model.passage ? Math.max(0.78, top - 0.02) : 0.35;
      const byId = new Map((await list(agentId)).map(v => [v.id, v]));
      const found = res.filter(r => r.score >= floor).map(r => byId.get(String(r.key).slice(agentId.length + 1))).filter(v => v && v.stage !== 'unudulub');
      await touch(agentId, found);
      return found;
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

  return { init, remember, recent, vivid, list, recall, count, sweep, touch, flush, whenReady, ruflo, dir };
}
