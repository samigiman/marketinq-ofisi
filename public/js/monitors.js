// Masadakı monitorlar: personaj kompüterində işləyəndə ekranda onun terminalı görünür
// (əmrlər, yazdığı fayllar, nəticələr). Mənbə: serverin 'pc' hadisələri və /api/pc jurnalı.
import { SCREENS } from './office.js';
import { MONO, FONT } from './kit.js';
import { live } from '../live.js';
import { TEAM } from '../team.js';

export const JOURNAL = {}; // agentId → [{at, kind, text}]
const dirty = new Set();
const KIND = { cmd: '#ece7dc', out: '#9fa79f', err: '#e39a8b', file: '#9cc9ad', note: '#7c847d' };
const listeners = new Set();
export const onJournal = fn => listeners.add(fn);

export function push(id, line) {
  const arr = (JOURNAL[id] ||= []); arr.push(line); if (arr.length > 200) arr.shift();
  dirty.add(id); listeners.forEach(fn => fn(id, line));
}

function draw(id) {
  const s = SCREENS[id]; if (!s || s.active === false) return; // boş masanın monitoru sönülüdür
  const g = s.ctx, w = s.w, h = s.h, lines = JOURNAL[id] || [];
  g.fillStyle = '#1b1e1c'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#2a2e2b'; g.fillRect(0, 0, w, 22);
  for (let i = 0; i < 3; i++) { g.fillStyle = '#4a4f4b'; g.beginPath(); g.arc(12 + i * 13, 11, 4, 0, 7); g.fill(); }
  g.fillStyle = '#9fa79f'; g.font = `500 12px ${FONT}`; g.fillText(`${TEAM.find(t => t.id === id)?.name || id} — terminal`, 56, 15);
  g.font = `400 12px ${MONO}`;
  // son sətirlər aşağıdan yuxarı: çox sətirli nəticəni bölürük
  const rows = [];
  for (const l of lines.slice(-30)) for (const part of String(l.text).split('\n')) rows.push([l.kind, part]);
  const max = Math.floor((h - 30) / 15);
  rows.slice(-max).forEach(([kind, text], i) => {
    g.fillStyle = KIND[kind] || KIND.out;
    let t = text; while (g.measureText(t).width > w - 16 && t.length > 4) t = t.slice(0, -2);
    g.fillText(t, 8, 38 + i * 15);
  });
  s.tex.needsUpdate = true;
}

// Kadrda bir dəfə: dəyişən ekranları yenidən çək.
export function flush() { for (const id of dirty) draw(id); dirty.clear(); }

live.sub('pc', ev => push(ev.agentId, { at: ev.at, kind: ev.kind, text: ev.text }));

// Server qoşulanda köhnə jurnalı monitorlara yüklə (yalnız jurnalı olanlar dəyişir).
export async function loadAll() {
  if (!live.on) return;
  await Promise.all(TEAM.map(async t => {
    try {
      const j = await fetch('/api/pc?id=' + t.id).then(r => r.json());
      if (j.log?.length) { JOURNAL[t.id] = j.log.slice(-200); dirty.add(t.id); }
    } catch { /* server yoxdur */ }
  }));
}
