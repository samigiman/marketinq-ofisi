// Personajların kompüterləri: hər birinin öz iş qovluğu, alətlə işləyən agent (Claude və ya Codex)
// və monitorda görünən jurnal (hansı əmr, hansı fayl).
//
// Təhlükəsizlik sərhədi (Claude):
//   - qovluqlar ev qovluğundan kənardadır (macOS: /Users/Shared/...), çünki sandbox-da bütün ev qovluğu
//     oxumağa bağlanır: layihə faylları, ~/.ssh, açarlar agentə görünmür;
//   - qonşu agentlərin qovluqları və jurnal da oxumağa bağlıdır;
//   - yazmaq yalnız öz qovluğunda (sandbox), internet bağlıdır, istifadəçi ayarları/hook/MCP yüklənmir.
// Codex: öz sandbox-u (workspace-write) yazmağı qovluqla məhdudlaşdırır, amma oxumağı yox.
// Ona görə Codex yalnız CODEX=1 ilə açılır; yoxsa engine: 'codex' olan personaj da Claude ilə işləyir.

import { spawn } from 'node:child_process';
import { mkdir, readdir, stat, readFile, writeFile, appendFile, realpath } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HOME = os.homedir();
const inside = (p, dir) => p === dir || p.startsWith(dir + path.sep);
const defaultRoot = () => (process.platform === 'darwin' ? '/Users/Shared/marketinq-ofisi/kompyuterler' : path.join('/var/tmp', 'marketinq-ofisi', 'kompyuterler'));

export function createComputers({ team, projectRoot, emit }) {
  const root = path.resolve(process.env.PC_DIR || defaultRoot());
  const journalDir = path.join(root, '.jurnal'); // agentin öz qovluğundan kənarda: jurnalı dəyişə bilməz
  const codexOn = process.env.CODEX === '1';
  const ids = team.map(t => t.id);
  const byId = Object.fromEntries(team.map(t => [t.id, t]));
  const dirOf = id => path.join(root, id);
  const logs = new Map(); // id → son 200 sətir
  const busy = new Map(); // id → hazırkı iş (monitor üçün)
  const homeInside = inside(root, HOME); // PC_DIR ev qovluğundadırsa, evi bütövlükdə bağlaya bilmərik

  async function ensure(id) {
    await mkdir(path.join(dirOf(id), 'isler'), { recursive: true });
    await mkdir(journalDir, { recursive: true });
    const readme = path.join(dirOf(id), 'README.txt');
    if (!existsSync(readme)) await writeFile(readme, `${byId[id].name} · ${byId[id].role}\n\nisler/  hazır işlər\n`);
  }

  function log(id, kind, text) {
    const line = { at: Date.now(), kind, text: String(text).slice(0, 400) };
    const arr = logs.get(id) || []; arr.push(line); if (arr.length > 200) arr.shift(); logs.set(id, arr);
    emit({ type: 'pc', agentId: id, ...line });
    appendFile(path.join(journalDir, `${id}.jsonl`), JSON.stringify(line) + '\n').catch(() => {});
  }

  async function journal(id, n = 120) {
    if (logs.has(id)) return logs.get(id).slice(-n);
    try {
      const lines = (await readFile(path.join(journalDir, `${id}.jsonl`), 'utf8')).trim().split('\n').filter(Boolean).slice(-200).map(l => JSON.parse(l));
      logs.set(id, lines); return lines.slice(-n);
    } catch { return []; }
  }

  // Claude sandbox ayarları: oxumaq üçün bağlı yerlər.
  function claudeSettings(id) {
    const others = ids.filter(x => x !== id).map(dirOf);
    const denyRead = [journalDir, ...others];
    if (!inside(root, projectRoot)) denyRead.push(projectRoot);
    if (!homeInside) denyRead.push('~/');
    else denyRead.push('~/.ssh', '~/.aws', '~/.gnupg', '~/.config', '~/.codex', '~/.claude', '~/Library', '~/Documents', '~/Desktop', '~/Downloads');
    return JSON.stringify({ sandbox: { enabled: true, autoAllowBashIfSandboxed: true, allowUnsandboxedCommands: false, filesystem: { denyRead } } });
  }

  const engineOf = id => (byId[id].engine === 'codex' && codexOn ? 'codex' : 'claude');

  // Alət çağırışını monitor sətrinə çevirir.
  const rel = (id, p) => { const r = path.relative(dirOf(id), String(p || '')); return r && !r.startsWith('..') ? r : String(p || ''); };
  const tail = (s, n = 6) => String(s || '').trim().split('\n').slice(-n).join('\n');
  function claudeTool(id, name, input = {}) {
    if (name === 'Bash') return ['cmd', `$ ${input.command}`];
    if (name === 'Write') return ['file', `yazdı  ${rel(id, input.file_path)}`];
    if (name === 'Edit') return ['file', `düzəltdi  ${rel(id, input.file_path)}`];
    if (name === 'Read') return ['file', `açdı  ${rel(id, input.file_path)}`];
    if (name === 'Glob' || name === 'Grep') return ['cmd', `axtarış: ${input.pattern || ''}`];
    if (name === 'WebSearch') return ['cmd', `brauzer: axtarış “${input.query || ''}”`];
    if (name === 'WebFetch') return ['cmd', `brauzer: ${input.url || ''}`];
    return ['cmd', name];
  }

  // Bir agent prosesi: JSON sətirlərini oxuyur, onLine(ev) hər sətir üçün.
  function spawnJsonl(cmd, args, { cwd, env, timeoutMs, signal, onLine }) {
    return new Promise((resolve, reject) => {
      const p = spawn(cmd, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
      let buf = '', err = '';
      const timer = setTimeout(() => { p.kill('SIGTERM'); reject(new Error('Vaxt bitdi')); }, timeoutMs);
      const onAbort = () => { p.kill('SIGTERM'); reject(Object.assign(new Error('Dayandırıldı'), { name: 'AbortError' })); };
      signal?.addEventListener('abort', onAbort, { once: true });
      p.stdout.on('data', chunk => {
        buf += chunk; let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i); buf = buf.slice(i + 1);
          if (!line.trim()) continue;
          let ev; try { ev = JSON.parse(line); } catch { continue; }
          onLine(ev);
        }
      });
      p.stderr.on('data', d => (err += d));
      p.on('error', e => { clearTimeout(timer); reject(e); });
      p.on('close', code => { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); resolve({ code, err }); });
    });
  }

  async function runClaudePc(id, { model, system, prompt, onDelta, env, timeoutMs, signal, web }) {
    const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
      '--restricted', '--tools', `Read,Write,Edit,Bash,Glob,Grep${web ? ',WebSearch,WebFetch' : ''}`, '--settings', claudeSettings(id),
      ...(web ? ['--allowedTools', 'WebSearch,WebFetch'] : []),
      '--permission-mode', 'acceptEdits', '--setting-sources', '', '--strict-mcp-config', '--disable-slash-commands',
      '--no-session-persistence', '--model', model, '--system-prompt', system];
    let acc = '', final = null;
    const { err } = await spawnJsonl('claude', args, {
      cwd: dirOf(id), env, timeoutMs, signal,
      onLine: ev => {
        if (ev.type === 'stream_event' && ev.event?.type === 'content_block_delta' && ev.event.delta?.type === 'text_delta') { acc += ev.event.delta.text; onDelta(acc); }
        else if (ev.type === 'assistant') for (const b of ev.message?.content || []) { if (b.type === 'tool_use') log(id, ...claudeTool(id, b.name, b.input)); }
        else if (ev.type === 'user') for (const b of ev.message?.content || []) {
          if (b.type !== 'tool_result') continue;
          const text = Array.isArray(b.content) ? b.content.map(c => c.text || '').join('\n') : b.content;
          if (b.is_error) log(id, 'err', tail(text, 3)); else if (text && !/^(The file|File created|Wrote)/.test(text)) log(id, 'out', tail(text));
        } else if (ev.type === 'result') final = ev;
      },
    });
    if (final?.is_error) throw new Error(final.result || 'Claude xətası');
    const text = (final?.result || '').trim();
    if (!text) throw new Error(err.trim().split('\n').pop() || 'Boş cavab');
    return text;
  }

  async function runCodexPc(id, { system, prompt, onDelta, env, timeoutMs, signal }) {
    const args = ['exec', '--json', '-C', dirOf(id), '--skip-git-repo-check', '-s', 'workspace-write', '-c', 'mcp_servers={}'];
    if (process.env.CODEX_MODEL) args.push('-m', process.env.CODEX_MODEL);
    args.push(`${system}\n\n---\n\n${prompt}`);
    let last = '', failure = '';
    await spawnJsonl('codex', args, {
      cwd: dirOf(id), env, timeoutMs, signal,
      onLine: ev => {
        const it = ev.item || {};
        if (ev.type === 'item.started' && it.type === 'command_execution') log(id, 'cmd', `$ ${it.command}`);
        if (ev.type === 'item.completed') {
          if (it.type === 'command_execution') log(id, it.exit_code ? 'err' : 'out', tail(it.aggregated_output));
          if (it.type === 'file_change') for (const c of it.changes || []) log(id, 'file', `${c.kind === 'add' ? 'yazdı' : 'düzəltdi'}  ${rel(id, c.path)}`);
          if (it.type === 'agent_message') { last = it.text || ''; onDelta(last); }
        }
        if (ev.type === 'turn.failed' || ev.type === 'error') failure = ev.error?.message || ev.message || 'Codex xətası';
      },
    });
    if (!last.trim()) throw new Error(failure || 'Codex boş cavab qaytardı');
    return last.trim();
  }

  // Alətli iş: personajın kompüterində. Uğursuz Codex → Claude ilə təkrar.
  async function run(id, opts) {
    await ensure(id);
    const engine = engineOf(id);
    busy.set(id, { since: Date.now(), engine });
    log(id, 'note', `iş başladı (${engine})`);
    try {
      if (engine === 'codex') {
        try { return await runCodexPc(id, opts); }
        catch (e) { if (e.name === 'AbortError') throw e; log(id, 'err', `Codex işləmədi: ${e.message}. Claude ilə davam edirəm.`); }
      }
      return await runClaudePc(id, opts);
    } finally { busy.delete(id); log(id, 'note', 'iş bitdi'); }
  }

  // Demo rejim: Claude çağırılmır, amma kompüterdə real fayl yaranır və monitor yazılır.
  async function runMock(id, { text, slugName, delay = 0, signal }) {
    await ensure(id);
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const check = () => { if (signal?.aborted) throw Object.assign(new Error('Dayandırıldı'), { name: 'AbortError' }); };
    busy.set(id, { since: Date.now(), engine: 'demo' });
    try {
      const file = `isler/${slugName}.md`;
      log(id, 'note', 'iş başladı (demo)'); check();
      log(id, 'cmd', '$ ls isler'); log(id, 'out', (await readdir(path.join(dirOf(id), 'isler'))).slice(-5).join('\n') || '(boş)');
      if (delay) await sleep(delay * 10); check();
      await writeFile(path.join(dirOf(id), file), text + '\n');
      log(id, 'file', `yazdı  ${file}`);
      log(id, 'cmd', `$ wc -w ${file}`); log(id, 'out', `${text.split(/\s+/).length} ${file}`);
      return file;
    } finally { busy.delete(id); log(id, 'note', 'iş bitdi'); }
  }

  // Fayl ağacı (monitor və pəncərə üçün).
  async function files(id) {
    const base = dirOf(id); if (!existsSync(base)) return [];
    const out = [];
    const walk = async (d, depth) => {
      if (depth > 4 || out.length >= 400) return;
      for (const n of (await readdir(d)).sort()) {
        if (n.startsWith('.')) continue;
        const f = path.join(d, n); const s = await stat(f);
        if (s.isDirectory()) { out.push({ f: path.relative(base, f) + '/', dir: true }); await walk(f, depth + 1); }
        else out.push({ f: path.relative(base, f), size: s.size, t: s.mtimeMs });
      }
    };
    await walk(base, 0);
    return out;
  }

  // Faylı oxu: yalnız agentin qovluğundan, simlink ilə çıxmaq olmaz, yalnız mətn.
  async function readText(id, rel) {
    const base = await realpath(dirOf(id)).catch(() => null); if (!base) return null;
    const full = await realpath(path.resolve(base, String(rel || ''))).catch(() => null);
    if (!full || !inside(full, base) || full === base) return null;
    const s = await stat(full); if (!s.isFile()) return null;
    if (s.size > 256 * 1024) return { tooBig: true, size: s.size };
    const buf = await readFile(full);
    if (buf.includes(0)) return { binary: true, size: s.size };
    return { text: buf.toString('utf8'), size: s.size };
  }

  const status = id => ({ engine: byId[id].engine, runs: engineOf(id), codexOn, busy: busy.get(id) || null, dir: dirOf(id) });

  return { root, ensure, run, runMock, files, readText, journal, status, log };
}
