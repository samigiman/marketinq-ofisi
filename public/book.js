// 📖 Ofisin kitabı: oyunun içində oxunan hekayə və bələdçi.
// Fəsillər sadə HTML-dir; komanda fəsli team.js-dən avtomatik qurulur.

import { DEPTS, TEAM, PIPE, PERSONAS, WORLD } from './team.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const teamChapter = () => Object.entries(DEPTS).map(([k, d]) => `
  <h3><span class="bk-dot" style="background:${d.color}"></span>${esc(d.name)}</h3>
  <div class="bk-team">${TEAM.filter(t => t.dept === k).map(t => {
    const p = PERSONAS[t.id] || {};
    return `<div class="bk-person"><div class="bk-av" style="--c:${d.color}">${t.emoji}</div><div>
      <b>${esc(t.name)}</b>, ${p.age} · ${esc(p.from || '')}<br><small>${esc(t.role)}</small>
      <p>${esc(p.bio || '')}</p><p><i>${esc(p.view || '')}</i></p><p>${esc(p.ties || '')}</p></div></div>`;
  }).join('')}</div>`).join('');

export const CHAPTERS = [
  { id: 'xos', icon: '✦', title: 'Xoş gəlmisiniz', html: () => `
    <p class="bk-lead">${esc(WORLD.company)} kiçik bir reklam agentliyidir. ${TEAM.length} nəfər burada işləyir, siz isə onun rəhbərisiniz.</p>
    <p>Hər masada oturan adamın öz tarixi var: haradan gəlib, bu işə necə düşüb, evdə onu kim gözləyir, iki ildən sonra harada olmaq istəyir.
    Hərənin iş haqqında öz fikri var. Siz zəif ideya təklif etsəniz, bunu deyəcəklər. Kimin kimlə dost olduğunu, kimin kimlə mübahisə etdiyini söhbətlərdə görəcəksiniz.</p>
    <p>Kameranı istədiyiniz yerə aparın, kiminsə yanına gedin və danışın. Ona tapşırıq verin və ya bütün komandanı bir kampaniyaya qoşun.
    Gördükləri iş və sizinlə söhbətlər yaddaşlarında qalır.</p>
    <div class="bk-note">Bu kitabı aşağıdakı paneldə <b>Hekayə</b> düyməsi ilə yenidən aça bilərsiniz.</div>` },

  { id: 'agentlik', icon: '🏢', title: 'Agentlik', html: () => `
    <p class="bk-lead">${esc(WORLD.place)}.</p>
    ${WORLD.story.map(p => `<p>${esc(p)}</p>`).join('')}` },

  { id: 'komanda', icon: '👥', title: 'Komanda', html: () => `
    <p class="bk-lead">${TEAM.length} nəfər, ${Object.keys(DEPTS).length} şöbə.</p>${teamChapter()}` },

  { id: 'gun', icon: '🕘', title: 'Bir iş günü', html: () => `
    <p class="bk-lead">Saat 09:00-dan 19:00-a qədər. Sürəti aşağıdakı paneldən 1×, 2× və ya 4× edə bilərsiniz.</p>
    <ul>
      <li><b>Masada iş:</b> hər kəs öz rolundakı işləri görür. Başının üstündə nə etdiyi və irəliləyiş xətti görünür.</li>
      <li><b>Düşünmək:</b> bəzən dayanıb fikrə gedirlər 💭.</li>
      <li><b>Həmkara sual:</b> durub başqasının masasına gedir, sual verir, cavab alır.</li>
      <li><b>Fasilə:</b> qəhvə maşını, divan, oyun guşəsi, pəncərə önü.</li>
      <li><b>Görüş:</b> vaxtaşırı CMO Elvin komandanı görüş otağına çağırır. Siz də <b>📅 Görüş</b> ilə çağıra bilərsiniz.</li>
      <li><b>Kampaniya:</b> <b>🚀 Kampaniya</b> ilə bütün xətt işə düşür (aşağıdakı fəsil).</li>
    </ul>
    <p>Divardakı ekranlar: soldakı <b>tapşırıq lövhəsi</b> (Plan, İcrada, Hazır) və <b>kampaniya paneli</b> (əhatə, CTR, ROAS, lead).
    Lövhə real işlərdən qurulur; panel rəqəmləri isə hələlik nümunədir.</p>` },

  { id: 'rehber', icon: '🎮', title: 'Rəhbər kimi idarə', html: () => `
    <h3>Kamera</h3>
    <ul><li>Sol düymə ilə sürüşdürün: fırlanır.</li><li>Sağ düymə: kameranı hərəkət etdirir.</li><li>Təkər: yaxınlaşır və uzaqlaşır.</li><li><b>🎥 Görünüş</b>: hazır bucaqlar arasında keçid.</li></ul>
    <h3>Danışmaq</h3>
    <p>Kameranı kiminsə yanına gətirin. Aşağıda <b>💬 Danış</b> çıxacaq; klikləyin və ya <kbd>Enter</kbd> basın. Personajın özünə klikləmək də olar.
    Personaj sizə dönür, əl yelləyir və sağda kartı açılır.</p>
    <h3>Personaj kartı</h3>
    <ul>
      <li><b>💬 Söhbət</b>: canlı yazışma. Hazır suallar da var.</li>
      <li><b>📋 İş</b>: tapşırıq vermək, bacarıqlar, bu gün görülən işlər. Hazır işin yanında <b>📄 bax</b> linki çıxır.</li>
      <li><b>🧠 Yaddaş</b>: onun ofisdəki xatirələri.</li>
    </ul>
    <h3>Aşağıdakı panel</h3>
    <p>👥 Komanda · 🚀 Kampaniya · 📅 Görüş · 📂 İşlər · 📖 Hekayə · 🎥 Görünüş · 🏷️ Adlar · sürət. <kbd>Esc</kbd> hər şeyi bağlayır.</p>` },

  { id: 'kampaniya', icon: '🚀', title: 'Kampaniya xətti', html: () => `
    <p class="bk-lead">Bir ad yazırsınız və ${PIPE.length} nəfər növbə ilə işləyir. Hər biri əvvəlkinin nəticəsini alır.</p>
    <ol class="bk-pipe">${PIPE.map(s => { const t = TEAM.find(x => x.id === s.id); return `<li>${t.emoji} <b>${esc(t.name)}</b> (${esc(t.role)}): ${esc(s.task)} → <i>${esc(s.out)}</i></li>`; }).join('')}</ol>
    <p>İşini bitirən personaj masasından qalxıb növbətinin yanına gedir və "${'📦 hazırdır!'}" deyir. Sonda yekun sənəd <code>outputs/kampaniyalar/</code> qovluğuna yazılır.</p>` },

  { id: 'perde', icon: '⚙️', title: 'Pərdə arxası', html: () => `
    <p class="bk-lead">Bu hissə oyunçu üçündür, personajlar bundan xəbərsizdir: hər biri dil modeli ilə işləyir.</p>
    <ul>
      <li>Brauzer yalnız animasiya və interfeysi çəkir. Gəzmək, söhbət balonları, görüşlər <b>pulsuzdur</b>: heç bir model çağırılmır.</li>
      <li>Siz danışanda, tapşırıq verəndə və ya kampaniya başladanda kiçik Node server (<code>server.mjs</code>) <code>claude -p</code> çağırır.</li>
      <li>Söhbət sürətli və ucuz modellə (<code>haiku</code>), iş daha güclü modellə (<code>sonnet</code>) gedir.</li>
      <li>Agentlərin <b>heç bir aləti yoxdur</b>: fayl oxuya, əmr işlədə, internetə və ya reklam kabinetinə girə bilməzlər. Yalnız mətn yazırlar.</li>
      <li>Server yalnız <code>127.0.0.1</code>-də dinləyir. İşçi qovluq boşdur, istifadəçi hook-ları, plugin-ləri və MCP serverləri yüklənmir.</li>
    </ul>
    <p>Rejimlər (yuxarı sol küncdə): <b>🟢 Canlı Claude</b>, <b>🟡 Demo</b> (Claude yoxdur, nümunə cavablar), <b>⚪ Simulyasiya</b> (server yoxdur).</p>` },

  { id: 'yaddas', icon: '🧠', title: 'Yaddaş və Ruflo', html: () => `
    <p class="bk-lead">Personajların xatirələri <b>Ruflo</b>-nun yaddaşında (AgentDB) saxlanır.</p>
    <ul>
      <li>Hər söhbətdən və hər bitən işdən sonra personajın öz bölməsinə (<code>ofis-&lt;ad&gt;</code>) qısa xatirə yazılır.</li>
      <li>Danışanda mövzuya uyğun xatirələr <b>semantik axtarışla</b> tapılır və personaja "yadına düşür".</li>
      <li>Ehtiyat üçün hər xatirə <code>yaddas/&lt;ad&gt;.jsonl</code> faylına da yazılır.</li>
      <li>Yaddaşı silmək ofisi "ilk günə" qaytarır: <code>yaddas/</code> qovluğunu silin.</li>
    </ul>
    <div class="bk-note">Ofis Ruflo-nu yalnız yaddaş üçün işlədir: o, <code>yaddas/</code> qovluğunda, Claude mühit dəyişənləri olmadan işə salınır,
    ona görə başqa layihələrin Ruflo qurulumuna qarışmır.</div>` },

  { id: 'qaydalar', icon: '📜', title: 'Hüdudlar', html: () => `
    <ul>
      <li>Dizayn, video və musiqi personajları hələ real fayl yaratmır: texniki tapşırıq, ssenari və struktur yazırlar.</li>
      <li>Dashboard rəqəmləri hələlik nümunədir; real reklam datası qoşulmayıb.</li>
      <li>Personajlar rəqəm uydurmamağa çalışır, data yoxdursa bunu deyirlər. Yenə də nəticələri yoxlayın.</li>
      <li>Canlı rejim sizin Claude hesabınızdan istifadə edir. Bir kampaniya ${PIPE.length} çağırışdır.</li>
      <li><code>company.md</code> faylına şirkət məlumatını yazsanız, bütün komanda onu bilər.</li>
    </ul>
    <p>Layihə açıq mənbəlidir. Töhfə vermək istəyirsinizsə, <code>CONTRIBUTING.md</code> faylına baxın.</p>` },
];

/* ---------------- pəncərə ---------------- */
const css = `
#book{position:fixed;inset:0;z-index:60;display:none;place-items:center;background:rgba(30,24,50,.42);backdrop-filter:blur(4px)}
#book.show{display:grid}
#book .bk{width:min(920px,calc(100% - 28px));height:min(640px,calc(100% - 40px));display:flex;background:#fffaf3;border-radius:22px;
  box-shadow:0 30px 80px rgba(30,20,60,.35);overflow:hidden;font-family:"Iowan Old Style","Palatino Linotype",Georgia,serif;color:#2d2a3a}
#book nav{width:230px;flex:none;background:linear-gradient(180deg,#2d2546,#3b2f5c);color:#efe8ff;padding:18px 10px;overflow:auto;font-family:ui-rounded,-apple-system,sans-serif}
#book nav h2{font-size:15px;margin:2px 10px 14px;letter-spacing:.3px}
#book nav h2 small{display:block;font-weight:500;opacity:.7;font-size:11px;margin-top:2px}
#book nav button{display:flex;gap:9px;align-items:center;width:100%;text-align:left;color:#e6defa;padding:8px 10px;border-radius:10px;font-size:13px}
#book nav button:hover{background:rgba(255,255,255,.08)} #book nav button.on{background:rgba(255,255,255,.16);color:#fff;font-weight:700}
#book article{flex:1;overflow:auto;padding:30px 38px 40px;position:relative;line-height:1.7;font-size:15.5px}
#book article h1{font-size:27px;margin:0 0 6px} #book article h3{font-family:ui-rounded,-apple-system,sans-serif;font-size:14px;margin:20px 0 8px;display:flex;align-items:center;gap:7px}
#book .bk-lead{font-size:17.5px;color:#4b4462;font-style:italic;margin-top:4px}
#book .bk-note{background:#f3ecff;border-left:4px solid #8c6cf2;padding:10px 14px;border-radius:10px;font-size:14px;font-family:ui-rounded,-apple-system,sans-serif}
#book .bk-note.warn{background:#fff3e6;border-color:#ff9a3c}
#book code,#book kbd{font:12.5px ui-monospace,Menlo,monospace;background:#f1ebe2;padding:1px 5px;border-radius:5px}
#book .bk-team{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}
#book .bk-person{display:flex;gap:10px;background:#fff;border:1px solid #efe6da;border-radius:14px;padding:10px;font-family:ui-rounded,-apple-system,sans-serif;font-size:12.5px;line-height:1.45}
#book .bk-person p{margin:4px 0 0;color:#5a5570} #book .bk-person small{color:#8a8499}
#book .bk-av{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;font-size:19px;flex:none;background:#fff;box-shadow:0 0 0 2.5px var(--c)}
#book .bk-dot{width:10px;height:10px;border-radius:50%;display:inline-block}
#book .bk-pipe li{margin:3px 0}
#book .bk-x{position:sticky;top:0;float:right;margin:-14px -20px 0 0;background:#fff;border:1px solid #eee;border-radius:10px;padding:5px 10px;font-family:ui-rounded,sans-serif}
#book .bk-foot{display:flex;justify-content:space-between;margin-top:28px;font-family:ui-rounded,-apple-system,sans-serif}
#book .bk-foot button{background:#fff;border:1px solid #e9dfd2;border-radius:12px;padding:8px 14px}
@media (max-width:700px){ #book nav{display:none} #book article{padding:22px} }
`;
document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`);
document.body.insertAdjacentHTML('beforeend', `<div id="book"><div class="bk"><nav><h2>📖 Ofisin kitabı<small>${esc(WORLD.company)} · ${esc(WORLD.floor)}</small></h2>
  ${CHAPTERS.map(c => `<button data-ch="${c.id}"><span>${c.icon}</span>${esc(c.title)}</button>`).join('')}</nav><article id="bkBody"></article></div></div>`);

const root = document.getElementById('book'), body = document.getElementById('bkBody');
function show(id) {
  const i = Math.max(0, CHAPTERS.findIndex(c => c.id === id)), c = CHAPTERS[i];
  root.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.ch === c.id));
  const prev = CHAPTERS[i - 1], next = CHAPTERS[i + 1];
  body.innerHTML = `<button class="bk-x" id="bkX">✕</button><h1>${c.icon} ${esc(c.title)}</h1>${c.html()}
    <div class="bk-foot"><span>${prev ? `<button data-go="${prev.id}">← ${esc(prev.title)}</button>` : ''}</span>
    <span>${next ? `<button data-go="${next.id}">${esc(next.title)} →</button>` : '<button id="bkDone">Ofisə qayıt ✦</button>'}</span></div>`;
  body.scrollTop = 0;
  body.querySelector('#bkX').onclick = closeBook;
  body.querySelectorAll('[data-go]').forEach(b => (b.onclick = () => show(b.dataset.go)));
  const d = body.querySelector('#bkDone'); if (d) d.onclick = closeBook;
}
root.querySelectorAll('nav button').forEach(b => (b.onclick = () => show(b.dataset.ch)));
root.onclick = e => { if (e.target === root) closeBook(); };
addEventListener('keydown', e => { if (e.key === 'Escape' && root.classList.contains('show')) closeBook(); });

export function openBook(id = 'xos') { show(id); root.classList.add('show'); try { localStorage.setItem('ofis-book-seen', '1'); } catch {} }
export function closeBook() { root.classList.remove('show'); }
export const bookSeen = () => { try { return localStorage.getItem('ofis-book-seen') === '1'; } catch { return true; } };
