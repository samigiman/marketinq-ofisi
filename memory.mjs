// İş yaddaşı: hər personajın yalnız ofisdəki xatirələri.
// Əsas mənbə Ruflo-nun yaddaşıdır (AgentDB, semantik axtarış). Hər xatirə həm də yerli JSONL-ə yazılır,
// ona görə Ruflo işləməsə də son xatirələr itmir.

import { spawn } from 'node:child_process';
import { appendFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

export function createMemory(root) {
  const dir = path.join(root, 'yaddas');
  const db = path.join(dir, 'ofis.db');
  const bin = path.join(root, 'node_modules', '.bin', 'ruflo');
  const ruflo = { available: existsSync(bin), lastError: '' };
  let queue = Promise.resolve();

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

  async function init() {
    await mkdir(dir, { recursive: true });
  }

  // Xatirə yaz (növbəyə düşür, gözləmək lazım deyil).
  function remember(agentId, text, kind = 'qeyd') {
    const item = { t: Date.now(), kind, text: String(text).replace(/\s+/g, ' ').trim().slice(0, 600) };
    const local = appendFile(jsonl(agentId), JSON.stringify(item) + '\n').catch(() => {});
    if (!ruflo.available) return local;
    queue = queue.then(() => run(['memory', 'store', '-k', `${agentId}-${item.t}`, '--value', item.text,
      '-n', ns(agentId), '--path', db, '--tags', kind, '--provenance', 'agent_output'], 120000))
      .catch(e => { ruflo.lastError = e.message; });
    return local;
  }

  async function recent(agentId, n = 8) {
    try {
      const lines = (await readFile(jsonl(agentId), 'utf8')).trim().split('\n').filter(Boolean);
      return lines.slice(-n).map(l => JSON.parse(l));
    } catch { return []; }
  }

  async function count(agentId) {
    try { return (await readFile(jsonl(agentId), 'utf8')).trim().split('\n').filter(Boolean).length; } catch { return 0; }
  }

  // Mövzuya uyğun xatirələr (Ruflo semantik axtarışı). Alınmasa — boş siyahı.
  async function recall(agentId, query, n = 4) {
    if (!ruflo.available || !query) return [];
    try {
      const out = await run(['memory', 'search', '-q', String(query).slice(0, 200), '-n', ns(agentId), '--path', db,
        '-l', String(n), '--format', 'json'], 15000);
      const j = JSON.parse(out.slice(out.indexOf('{')));
      return (j.results || []).filter(r => r.score > 0.35).map(r => r.preview);
    } catch (e) { ruflo.lastError = e.message; return []; }
  }

  return { init, remember, recent, recall, count, ruflo, dir };
}
