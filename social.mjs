// Ofisin öz sosial şəbəkəsi: Ulduzgram (lent: post, şəkil-kart, bəyənmə, şərh) və Ulduz Chat (qruplar və şəxsi yazışmalar).
// Aktivlik hər personajın xasiyyətindən, əhvalından və iş yükündən asılıdır; hadisələr (işə götürmə, çıxarma, bitən iş) də yazdırır.
// Canlı rejimdə mətnləri ucuz model yazır, saatlıq limitlə (SOCIAL_MAX_PER_HOUR). Demo rejimdə hazır şablonlar.
import { readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

// sosial şəbəkəyə meyl (0..1): xasiyyətdən
const TRAIT = { smm: 0.9, pr: 0.8, smmcopy: 0.7, community: 0.7, junior: 0.6, account: 0.6, video: 0.6, motion: 0.5, strateg: 0.5, artdir: 0.5,
  composer: 0.45, marketer: 0.45, brand: 0.4, digital: 0.4, copy: 0.35, uiux: 0.35, target: 0.35, crm: 0.35, designer: 0.3, pm: 0.3, cmo: 0.25, ppc: 0.25, analyst: 0.2, seo: 0.15 };
export const PHOTOS = ['coffee', 'desk', 'cat', 'city', 'food', 'notes', 'plant', 'sunset', 'screen'];
const MOCK_POST = {
  coffee: ['Səhər qəhvəsiz başlamır', 'Üçüncü fincan. Kim sayır ki?'], desk: ['Masam bu gün nizamlıdır, bu nadir hadisədir', 'Yeni stiker gətirdim'],
  cat: ['Mırmır yenə klaviaturamın üstündə yatıb', 'Ofisin əsl rəhbəri Mırmırdır'], city: ['Pəncərədən Bakı bu gün çox gözəldir', 'Fəvvarələr meydanında axşam'],
  food: ['Nahar: dolma. Danışmağa ehtiyac yoxdur', 'Mətbəxdə şəkərbura var, tələsin'], notes: ['Ağ lövhədə yeni ideyalar', 'Bu həftənin planı hazırdır'],
  plant: ['Masamdakı bitki böyüyür, mən də böyüyürəm', 'Kim bitkiləri sulayır?'], sunset: ['İş günü bitdi, gün batımı başladı', 'Belə axşamlar üçün işləyirik'],
  screen: ['Bu gün rəqəmlər yaxşıdır', 'Render bitdi, nəhayət'],
};
const MOCK_CHAT = ['Kim qəhvəyə gedir?', 'Bu gün görüş neçədədir?', 'Rəhbər bu gün yaxşı əhvaldadır deyəsən', 'Mırmır mənim stulumu tutub', 'Nahara nə sifariş edək?', 'Brifi kim göndərəcək?', 'Mən bir az gecikəcəm', 'Bu həftə çox iş var', 'Ha ha, doğrudur'];
const MOCK_SAD = ['Eşitdiniz? Çox qəribə oldu', 'Növbəti kim olacaq görəsən', 'Bunu gözləmirdim', 'Əhvalım yoxdur bu gün'];

export function createSocial({ OUT, TEAM, PERSONAS, emit, isHired, hired, moodNow, worldRules, llm, mode }) {
  const FILE = path.join(OUT, 'sosial.json');
  const MAX_PER_HOUR = +process.env.SOCIAL_MAX_PER_HOUR || 40;
  const TICK = (+process.env.SOCIAL_TICK || 25) * 1000;
  const db = { posts: [], chats: {}, stats: {} };
  const byId = Object.fromEntries(TEAM.map(t => [t.id, t]));
  const name = id => byId[id]?.name || id;
  const uid = () => Math.random().toString(36).slice(2, 10);
  let llmCalls = [];
  let saveT = null;
  const save = () => { clearTimeout(saveT); saveT = setTimeout(async () => { try { await writeFile(FILE + '.tmp', JSON.stringify(db)); await rename(FILE + '.tmp', FILE); } catch {} }, 800); };
  const pick = a => a[Math.floor(Math.random() * a.length)];

  function thread(id, title, members) { const t = (db.chats[id] ||= { id, title, members, messages: [] }); if (members) t.members = members; return t; }
  const dmId = (a, b) => 'dm:' + [a, b].sort().join('-');
  function stat(id, k, min) {
    const s = (db.stats[id] ||= { minutes: 0, posts: 0, comments: 0, messages: 0, likes: 0, today: {}, last: 0 });
    const d = new Date().toISOString().slice(0, 10);
    s.today[d] ||= { minutes: 0, posts: 0, comments: 0, messages: 0, likes: 0 };
    s[k]++; s.minutes += min; s.today[d][k]++; s.today[d].minutes += min; s.last = Date.now();
    for (const old of Object.keys(s.today)) if (old < d && Object.keys(s.today).length > 14) delete s.today[old];
  }
  const canLLM = () => { const now = Date.now(); llmCalls = llmCalls.filter(t => now - t < 3600e3); return mode() === 'live' && llmCalls.length < MAX_PER_HOUR; };

  // model ilə qısa mətn; alınmasa və ya limit dolubsa şablon
  async function write(agentId, task, fallback) {
    if (!canLLM()) return fallback;
    llmCalls.push(Date.now());
    try {
      const sys = `${worldRules(byId[agentId])}\nİndi telefonunda ofis işçilərinin öz sosial şəbəkəsindəsən (Ulduzgram və Ulduz Chat). Öz danışıq tərzində, qısa və canlı yaz. Emoji az işlət. Yalnız mətni ver, izahat yox.`;
      const t = (await llm(sys, task)).trim().replace(/^["«]|["»]$/g, '');
      return t.slice(0, 300) || fallback;
    } catch { return fallback; }
  }

  async function post(agentId, why = '') {
    const photo = pick(PHOTOS);
    const text = await write(agentId, `Ulduzgram-a yeni post yaz (1-2 cümlə). Şəkil mövzusu: ${photo}.${why ? ` Səbəb: ${why}.` : ''} Əhvalın: ${moodNow(agentId).toFixed(2)} (0 pis, 1 yaxşı).`, pick(MOCK_POST[photo]));
    const p = { id: uid(), at: Date.now(), author: agentId, text, photo, likes: [], comments: [] };
    db.posts.unshift(p); if (db.posts.length > 300) db.posts.pop();
    stat(agentId, 'posts', 5); save();
    emit({ type: 'social', kind: 'post', agentId, post: p });
    return p;
  }
  async function comment(agentId) {
    const p = db.posts.slice(0, 12).filter(x => x.author !== agentId && isHired(x.author))[0 + Math.floor(Math.random() * 3)];
    if (!p) return;
    const text = await write(agentId, `${name(p.author)} Ulduzgram-da yazıb: "${p.text}". Ona qısa şərh yaz (bir cümlə).`, pick(['Çox gözəl', 'Ha ha', 'Mən də istəyirəm', 'Haqlısan', 'Bəs mənə niyə demədin?']));
    p.comments.push({ author: agentId, text, at: Date.now() });
    stat(agentId, 'comments', 2); save();
    emit({ type: 'social', kind: 'comment', agentId, postId: p.id, text });
  }
  function like(agentId) {
    const p = db.posts.slice(0, 20).find(x => x.author !== agentId && !x.likes.includes(agentId));
    if (!p) return;
    p.likes.push(agentId); stat(agentId, 'likes', 0.5); save();
    emit({ type: 'social', kind: 'like', agentId, postId: p.id });
  }
  async function chat(agentId, opts = {}) {
    const me = byId[agentId], team = hired();
    let th;
    if (opts.thread) th = opts.thread;
    else {
      const friends = team.filter(o => o !== agentId && ((PERSONAS[agentId]?.ties || '').includes(name(o)) || (PERSONAS[o]?.ties || '').includes(me.name)));
      const r = Math.random(), low = moodNow(agentId) < 0.45;
      if ((low || r < 0.3) && friends.length) { const f = pick(friends); th = thread(dmId(agentId, f), null, [agentId, f]); }
      else if (r < 0.55) { const dept = team.filter(o => byId[o].dept === me.dept); th = thread('dept:' + me.dept, null, dept); th.members = dept; }
      else { th = thread('ofis', 'Ofis', team); th.members = team; }
    }
    const recent = th.messages.slice(-8).map(m => `${name(m.author)}: ${m.text}`).join('\n');
    const where = th.id === 'ofis' ? 'bütün ofisin qrupu' : th.id.startsWith('dept:') ? 'şöbənizin qrupu' : `${name(th.members.find(x => x !== agentId))} ilə şəxsi yazışma`;
    const text = await write(agentId, `Ulduz Chat-da yazırsan: ${where}.${recent ? `\nSon mesajlar:\n${recent}` : ''}${opts.why ? `\nNə baş verib: ${opts.why}` : ''}\nNövbəti mesajını yaz (1-2 cümlə). Əhvalın: ${moodNow(agentId).toFixed(2)}.`, opts.fallback || (opts.why ? pick(MOCK_SAD) : pick(MOCK_CHAT)));
    const m = { at: Date.now(), author: agentId, text };
    th.messages.push(m); if (th.messages.length > 200) th.messages.shift();
    stat(agentId, 'messages', 1); save();
    emit({ type: 'social', kind: 'message', agentId, thread: th.id, text });
  }

  // davranış: hər tick-də hər işçi üçün ehtimal = meyl × əhval × iş yükü
  let busyFn = () => false;
  async function tick() {
    const team = hired(); let acts = 0;
    for (const id of team.sort(() => Math.random() - 0.5)) {
      if (acts >= 2) break;
      const mood = moodNow(id), busy = busyFn(id);
      const p = (TRAIT[id] ?? 0.3) * 0.12 * (busy ? 0.25 : 1) * (mood < 0.45 ? 1.4 : mood > 0.8 ? 1.15 : 1);
      if (Math.random() > p) continue;
      acts++;
      const r = Math.random();
      try {
        if (r < 0.35) like(id);
        else if (r < 0.55) await chat(id);
        else if (r < 0.75 && mood >= 0.45) await post(id);
        else if (r < 0.9) await comment(id);
        else await chat(id);
      } catch {}
    }
  }
  let timer = null;
  async function start(isBusy) {
    busyFn = isBusy || busyFn;
    try { Object.assign(db, JSON.parse(await readFile(FILE, 'utf8'))); } catch {}
    timer = setInterval(() => tick().catch(() => {}), TICK);
  }
  function stop() { clearInterval(timer); }

  // hadisələr
  async function onHire(id, back) {
    const host = hired().find(x => x === 'cmo') || hired()[0];
    if (host && host !== id) await chat(host, { thread: thread('ofis', 'Ofis', hired()), why: back ? `${name(id)} yenidən işə qayıtdı` : `${name(id)} bu gün komandaya qoşuldu, onu salamla`,
      fallback: back ? `${name(id)} yenidən bizimlədir. Xoş gördük.` : `Komandaya xoş gəldin, ${name(id)}!` });
    setTimeout(() => post(id, back ? 'ofisə geri qayıtdın' : 'bu gün yeni işə başladın').catch(() => {}), 4000);
  }
  async function onFire(id) {
    const friends = hired().filter(o => (PERSONAS[o]?.ties || '').includes(name(id)) || (PERSONAS[id]?.ties || '').includes(name(o)));
    const who = friends[0] || hired().find(x => x !== 'cmo');
    if (who) await chat(who, { thread: thread('ofis', 'Ofis', hired()), why: `${name(id)} bu gün işdən çıxarıldı` });
    if (friends[0]) await chat(friends[0], { thread: thread(dmId(friends[0], id), null, [friends[0], id]), why: `sən işdən çıxarıldın, dostun sənə yazır` }).catch(() => {});
  }
  async function onWorkDone(id, task) { if (Math.random() < (TRAIT[id] ?? 0.3) * 0.6) await post(id, `bu gün "${task}" işini bitirdin`); }

  // oxu
  const feed = (n = 50) => db.posts.slice(0, n).map(p => ({ ...p, name: name(p.author), role: byId[p.author]?.role, comments: p.comments.map(c => ({ ...c, name: name(c.author) })), likeNames: p.likes.map(name) }));
  const chats = () => Object.values(db.chats).map(c => ({ id: c.id, title: c.title || (c.id.startsWith('dept:') ? `Şöbə: ${c.id.slice(5)}` : c.members.map(name).join(' və ')), members: c.members.map(name), last: c.messages.at(-1) ? { ...c.messages.at(-1), name: name(c.messages.at(-1).author) } : null, count: c.messages.length }))
    .sort((a, b) => (b.last?.at || 0) - (a.last?.at || 0));
  const chatOf = id => { const c = db.chats[id]; return c ? { ...c, messages: c.messages.map(m => ({ ...m, name: name(m.author) })) } : null; };
  const report = () => TEAM.map(t => {
    const s = db.stats[t.id] || { minutes: 0, posts: 0, comments: 0, messages: 0, likes: 0, today: {} };
    const d = new Date().toISOString().slice(0, 10);
    return { id: t.id, name: t.name, role: t.role, hired: isHired(t.id), trait: TRAIT[t.id] ?? 0.3, total: { minutes: Math.round(s.minutes), posts: s.posts, comments: s.comments, messages: s.messages, likes: s.likes }, today: s.today?.[d] || { minutes: 0, posts: 0, comments: 0, messages: 0, likes: 0 }, last: s.last || 0 };
  }).sort((a, b) => b.total.minutes - a.total.minutes);
  const usage = () => ({ llmLastHour: llmCalls.filter(t => Date.now() - t < 3600e3).length, max: MAX_PER_HOUR });

  return { start, stop, tick, post, chat, comment, like, onHire, onFire, onWorkDone, feed, chats, chatOf, report, usage };
}
