// Ulduzgram səhifəsi: lent, chat, hesabat. Hər 5 saniyədən bir yenilənir. İnternetdən də (şifrə ilə) açıla bilər.
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const COLORS = ['#4a5a6a', '#6b4e3d', '#3f5a4a', '#8a6f4e', '#2f3640', '#7a3e33', '#9a8a6a', '#55606e', '#5c4a5e', '#46606a'];
const hash = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };
const av = (id, name) => `<span class="av" style="background:${COLORS[hash(id) % COLORS.length]}">${esc(String(name).slice(0, 1))}</span>`;
const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'indicə' : m < 60 ? `${m} dəq əvvəl` : m < 1440 ? `${Math.round(m / 60)} saat əvvəl` : new Date(t).toLocaleDateString('az-AZ'); };

// "Şəkil": mövzuya görə sadə illüstrasiya
function photo(kind, seed) {
  const r = n => ((hash(seed + n) % 1000) / 1000);
  const bg = { coffee: '#e9dcc6', desk: '#dfe6e3', cat: '#f1e4d2', city: '#cfdde6', food: '#f3e2cf', notes: '#f6f1e4', plant: '#e3ece0', sunset: '#f2c9a0', screen: '#20242a' }[kind] || '#e9e4da';
  let g = '';
  if (kind === 'coffee') g = `<ellipse cx="200" cy="230" rx="110" ry="22" fill="#c9b48a"/><rect x="140" y="120" width="120" height="110" rx="18" fill="#f7f4ee"/><ellipse cx="200" cy="124" rx="58" ry="12" fill="#6b4a30"/><path d="M260 145 q40 5 30 45 q-8 25 -32 22" fill="none" stroke="#f7f4ee" stroke-width="14"/><path d="M180 95 q10 -20 0 -40 M210 95 q10 -20 0 -40" stroke="#fff" stroke-width="5" fill="none" opacity=".7"/>`;
  else if (kind === 'desk') g = `<rect x="40" y="190" width="320" height="16" fill="#b8936b"/><rect x="130" y="90" width="150" height="95" rx="6" fill="#1f2320"/><rect x="140" y="100" width="130" height="75" fill="#36546b"/><rect x="190" y="185" width="30" height="8" fill="#1f2320"/><rect x="60" y="160" width="40" height="30" fill="#b4643f"/><circle cx="80" cy="148" r="20" fill="#4f6b48"/><rect x="300" y="170" width="16" height="20" fill="#f3d36b"/>`;
  else if (kind === 'cat') g = `<ellipse cx="200" cy="200" rx="110" ry="50" fill="#d98c4a"/><circle cx="290" cy="165" r="45" fill="#d98c4a"/><path d="M262 130 l10 -35 l20 30 Z M300 125 l18 -32 l10 38 Z" fill="#d98c4a"/><path d="M275 165 q6 6 12 0 M300 165 q6 6 12 0" stroke="#2a2522" stroke-width="4" fill="none"/><path d="M100 200 q-60 -10 -40 -60" stroke="#d98c4a" stroke-width="20" fill="none" stroke-linecap="round"/><rect x="40" y="240" width="320" height="20" fill="#2b2d2f"/>`;
  else if (kind === 'city') g = `${[0, 1, 2, 3, 4, 5, 6].map(i => `<rect x="${30 + i * 50}" y="${120 - r(i) * 70}" width="42" height="${160 + r(i) * 70}" fill="${['#8aa1b1', '#6f8797', '#a3b5c2'][i % 3]}"/>`).join('')}<path d="M260 60 q30 -50 60 0 q-10 70 -30 140 q-20 -70 -30 -140" fill="#5d7586"/><rect x="0" y="250" width="400" height="50" fill="#7fa2b4"/>`;
  else if (kind === 'food') g = `<circle cx="200" cy="170" r="105" fill="#f7f4ee"/><circle cx="200" cy="170" r="80" fill="#e9dcc6"/>${[0, 1, 2, 3, 4].map(i => `<ellipse cx="${160 + (i % 3) * 40}" cy="${145 + Math.floor(i / 3) * 45}" rx="26" ry="16" fill="#5f7a3a"/>`).join('')}`;
  else if (kind === 'notes') g = `<rect x="40" y="40" width="320" height="220" fill="#fbfbf8" stroke="#dcd8cf"/>${[0, 1, 2, 3, 4, 5].map(i => `<rect x="${60 + (i % 3) * 100}" y="${60 + Math.floor(i / 3) * 95}" width="80" height="70" fill="${['#f3d36b', '#f2a7a0', '#a9d3b0', '#a8c6e8'][i % 4]}" transform="rotate(${(r(i) - 0.5) * 8} ${100 + (i % 3) * 100} ${95 + Math.floor(i / 3) * 95})"/>`).join('')}`;
  else if (kind === 'plant') g = `<rect x="160" y="190" width="80" height="70" rx="8" fill="#b4643f"/>${[0, 1, 2, 3, 4, 5].map(i => `<ellipse cx="${200 + Math.sin(i) * 45}" cy="${150 - i * 12}" rx="38" ry="18" fill="${i % 2 ? '#4f6b48' : '#647f56'}" transform="rotate(${i * 30 - 75} ${200 + Math.sin(i) * 45} ${150 - i * 12})"/>`).join('')}`;
  else if (kind === 'sunset') g = `<circle cx="200" cy="190" r="70" fill="#e98a52"/><rect x="0" y="200" width="400" height="100" fill="#36546b"/>${[0, 1, 2].map(i => `<rect x="${60 + i * 25}" y="${215 + i * 18}" width="${280 - i * 50}" height="6" fill="#e98a52" opacity=".6"/>`).join('')}`;
  else g = `<rect x="30" y="30" width="340" height="240" rx="8" fill="#2a2e2b"/>${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<rect x="${60 + i * 38}" y="${240 - 40 - r(i) * 140}" width="24" height="${40 + r(i) * 140}" fill="#5f7f6c"/>`).join('')}`;
  return `<svg viewBox="0 0 400 300" role="img" aria-label="${esc(kind)}"><rect width="400" height="300" fill="${bg}"/>${g}</svg>`;
}

const get = u => fetch(u, { cache: 'no-store' }).then(r => (r.ok ? r.json() : Promise.reject(r.status)));
let view = 'feed', curThread = null;

async function renderFeed() {
  const posts = await get('/api/social/feed');
  $('#view').innerHTML = `<div class="feed">${posts.length ? posts.map(p => `<article class="post glass">
    <div class="hd">${av(p.author, p.name)}<div><b>${esc(p.name)}</b><small>${esc(p.role || '')} · ${ago(p.at)}</small></div></div>
    ${photo(p.photo, p.id)}
    <div class="tx">${esc(p.text)}</div>
    <div class="meta">${p.likes.length ? `${p.likes.length} bəyənmə: ${esc(p.likeNames.slice(0, 4).join(', '))}${p.likes.length > 4 ? '…' : ''}` : 'Hələ bəyənən yoxdur'}</div>
    ${p.comments.length ? `<div class="cm">${p.comments.slice(-4).map(c => `<div><b>${esc(c.name)}</b> ${esc(c.text)}</div>`).join('')}</div>` : ''}
  </article>`).join('') : '<div class="empty">Hələ post yoxdur. Komanda tezliklə nəsə paylaşacaq.</div>'}</div>`;
}
async function renderChat() {
  const list = await get('/api/social/chats');
  if (!curThread && list[0]) curThread = list[0].id;
  const c = curThread ? await get('/api/social/chat?id=' + encodeURIComponent(curThread)) : { messages: [] };
  const t = list.find(x => x.id === curThread);
  $('#view').innerHTML = `<div class="chat"><div class="threads glass">${list.length ? list.map(x => `<button data-t="${esc(x.id)}" class="${x.id === curThread ? 'on' : ''}">${av(x.id, x.title)}<span class="t"><b>${esc(x.title)}</b><small>${x.last ? `${esc(x.last.name)}: ${esc(x.last.text)}` : ''}</small></span></button>`).join('') : '<div class="empty">Yazışma yoxdur</div>'}</div>
    <div class="msgs glass"><div class="top">${esc(t?.title || '')}<span style="font-weight:400;color:var(--ink-2);font-size:12px"> ${t ? '· ' + esc(t.members.join(', ')) : ''}</span></div>
    <div class="list" id="ml">${c.messages.map(m => `<div class="bub"><small>${esc(m.name)}</small>${esc(m.text)}<i>${new Date(m.at).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })}</i></div>`).join('') || '<div class="empty">Mesaj yoxdur</div>'}</div></div></div>`;
  document.querySelectorAll('[data-t]').forEach(b => (b.onclick = () => { curThread = b.dataset.t; renderChat(); }));
  const ml = $('#ml'); if (ml) ml.scrollTop = ml.scrollHeight;
}
async function renderReport() {
  const { people, usage } = await get('/api/social/report');
  const max = Math.max(1, ...people.map(p => p.total.minutes));
  $('#view').innerHTML = `<div class="glass" style="padding:16px"><p class="note">Kim sosial şəbəkədə nə qədər vaxt keçirir: hər post ~5 dəq, şərh ~2, mesaj ~1, bəyənmə yarım dəqiqə sayılır. Model çağırışları son saatda: ${usage.llmLastHour}/${usage.max}.</p>
    <table><thead><tr><th>Ad</th><th>Bu gün</th><th>Cəmi vaxt</th><th></th><th>Post</th><th>Şərh</th><th>Mesaj</th><th>Bəyənmə</th><th>Son aktivlik</th></tr></thead><tbody>
    ${people.map(p => `<tr style="${p.hired ? '' : 'opacity:.5'}"><td>${esc(p.name)}<br><small style="color:var(--ink-2)">${esc(p.role)}${p.hired ? '' : ' · işləmir'}</small></td>
      <td class="num">${Math.round(p.today.minutes)} dəq</td><td class="num">${p.total.minutes} dəq</td><td><span class="bar"><i style="width:${Math.round(p.total.minutes / max * 100)}%"></i></span></td>
      <td class="num">${p.total.posts}</td><td class="num">${p.total.comments}</td><td class="num">${p.total.messages}</td><td class="num">${p.total.likes}</td><td>${p.last ? ago(p.last) : '—'}</td></tr>`).join('')}
    </tbody></table></div>`;
}
const render = () => (view === 'feed' ? renderFeed() : view === 'chat' ? renderChat() : renderReport()).catch(e => { $('#view').innerHTML = `<div class="empty">Açılmadı (${esc(e)}).</div>`; });
document.querySelectorAll('nav button').forEach(b => (b.onclick = () => { view = b.dataset.v; document.querySelectorAll('nav button').forEach(x => x.classList.toggle('on', x === b)); render(); }));
render();
setInterval(() => { if (!document.hidden && !(view === 'chat' && window.getSelection()?.toString())) render(); }, 5000);
