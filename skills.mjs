// İş metodikası: Rəhbərin quraşdırdığı marketinq skill-ləri (SKILL.md) hər rola uyğun olaraq agentin promptuna əlavə olunur.
// Fayllar repoda saxlanmır: server SKILLS_DIR (default ~/.claude/plugins) qovluğunda adlarına görə tapır.
// Agentlər AI olduqlarını bilmədiyi üçün "Claude", "skill", "tool", "MCP" kimi sətirlər çıxarılır.
import { readdir, readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const ROLE_SKILLS = {
  cmo: ['campaign-plan', 'performance-report'], marketer: ['competitive-brief', 'campaign-plan'], account: ['competitive-brief'],
  brand: ['brand-review', 'brand-voice-enforcement'], pm: ['campaign-plan'],
  artdir: ['design-critique', 'brand-review'], designer: ['design-critique'], junior: ['design-critique'], uiux: ['ux-copy', 'user-research'],
  motion: ['content-creation'], video: ['content-creation'], composer: ['content-creation'],
  copy: ['content-creation', 'brand-voice-enforcement'], smmcopy: ['draft-content', 'brand-voice-enforcement'],
  smm: ['content-creation', 'draft-content'], strateg: ['content-creation', 'campaign-plan'], community: ['draft-content'], pr: ['draft-content', 'competitive-brief'],
  seo: ['seo-audit'], analyst: ['performance-report'], digital: ['performance-report', 'campaign-plan'], target: ['performance-report'], ppc: ['performance-report'], crm: ['email-sequence'],
};
const roots = [process.env.SKILLS_DIR, path.join(os.homedir(), '.claude', 'plugins')].filter(Boolean);
let index = null; // ad → SKILL.md yolu

async function walk(dir, depth, out) {
  if (depth > 7) return;
  let names; try { names = await readdir(dir); } catch { return; }
  for (const n of names) {
    const f = path.join(dir, n);
    if (n === 'SKILL.md') { const name = path.basename(dir); if (!out[name]) out[name] = f; continue; }
    if (n.startsWith('.') || n === 'node_modules') continue;
    try { if ((await stat(f)).isDirectory()) await walk(f, depth + 1, out); } catch {}
  }
}
async function getIndex() { if (!index) { index = {}; for (const r of roots) await walk(r, 0, index); } return index; }

const BAD = /claude|anthropic|\bskill|\bmcp\b|connector|plugin|\btool|~~|subagent|\bagent\b|\bLLM\b|\bAI\b|süni intellekt/i;
function clean(md) {
  return md.replace(/^---[\s\S]*?---\s*/, '').split('\n').filter(l => !BAD.test(l)).join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 2600);
}
const cache = new Map();
export async function skillBlock(agentId) {
  if (cache.has(agentId)) return cache.get(agentId);
  const idx = await getIndex(), parts = [];
  for (const name of ROLE_SKILLS[agentId] || []) {
    if (!idx[name]) continue;
    try { parts.push(`### ${name.replace(/-/g, ' ')}\n${clean(await readFile(idx[name], 'utf8'))}`); } catch {}
  }
  const block = parts.length ? `\nAgentliyin iş metodikası (sənin işinə aid; buna əsaslan, amma kor-koranə köçürmə):\n${parts.join('\n\n')}` : '';
  cache.set(agentId, block);
  return block;
}
export async function skillsFound() { const idx = await getIndex(); return [...new Set(Object.values(ROLE_SKILLS).flat())].filter(n => idx[n]); }
