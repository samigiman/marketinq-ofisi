// Ofisin kitabı: oyunun içində oxunan hekayə və bələdçi. Stil: css/ofis.css (#book).
// Fəsillər sadə HTML-dir; komanda fəsli team.js-dən avtomatik qurulur.

import { DEPTS, TEAM, PIPE, PERSONAS, WORLD } from './team.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const teamChapter = () => Object.entries(DEPTS).map(([k, d]) => `
  <h3>${esc(d.name)}</h3>
  <div class="bk-team">${TEAM.filter(t => t.dept === k).map(t => {
    const p = PERSONAS[t.id] || {};
    return `<div class="bk-person"><div>
      <b>${esc(t.name)}</b>, ${p.age} · ${esc(p.from || '')}<br><small>${esc(t.role)}</small>
      <p>${esc(p.bio || '')}</p><p><i>${esc(p.view || '')}</i></p><p>${esc(p.ties || '')}</p></div></div>`;
  }).join('')}</div>`).join('');

export const CHAPTERS = [
  { id: 'xos', title: 'Xoş gəlmisiniz', html: () => `
    <p class="bk-lead">${esc(WORLD.company)} kiçik bir reklam agentliyidir. ${TEAM.length} nəfər burada işləyir, siz isə onun rəhbərisiniz.</p>
    <p>Hər masada oturan adamın öz tarixi var: haradan gəlib, bu işə necə düşüb, evdə onu kim gözləyir, iki ildən sonra harada olmaq istəyir.
    Hərənin iş haqqında öz fikri var. Siz zəif ideya təklif etsəniz, bunu deyəcəklər. Kimin kimlə dost olduğunu, kimin kimlə mübahisə etdiyini söhbətlərdə görəcəksiniz.</p>
    <p>Kameranı istədiyiniz yerə aparın, kiminsə yanına gedin və danışın. Ona tapşırıq verin və ya bütün komandanı bir kampaniyaya qoşun.
    Gördükləri iş və sizinlə söhbətlər yaddaşlarında qalır.</p>
    <div class="bk-note">Bu kitabı yuxarı sağdakı <b>Kitab</b> düyməsi ilə yenidən aça bilərsiniz.</div>` },

  { id: 'agentlik', title: 'Agentlik', html: () => `
    <p class="bk-lead">${esc(WORLD.place)}.</p>
    ${WORLD.story.map(p => `<p>${esc(p)}</p>`).join('')}` },

  { id: 'komanda', title: 'Komanda', html: () => `
    <p class="bk-lead">${TEAM.length} nəfər, ${Object.keys(DEPTS).length} şöbə.</p>${teamChapter()}` },

  { id: 'gun', title: 'Bir iş günü', html: () => `
    <p class="bk-lead">Saat 09:00-dan 19:00-a qədər. Sürəti yuxarıdakı 1×, 2×, 4× düymələri ilə dəyişə bilərsiniz.</p>
    <ul>
      <li><b>Masada iş:</b> hər kəs öz işini görür. Adının üstündə nə etdiyi və irəliləyiş xətti görünür.</li>
      <li><b>Həmkara sual:</b> durub başqasının masasına gedir, sual verir, cavab alır.</li>
      <li><b>Fasilə:</b> mətbəx, divan, pəncərə önü.</li>
      <li><b>Görüş:</b> vaxtaşırı Elvin komandanı görüş otağına çağırır. Siz də soldakı <b>Görüş</b> düyməsi ilə çağıra bilərsiniz.</li>
      <li><b>Kompüter:</b> tapşırıq alan personaj öz kompüterində işləyir. Masasındakı monitorda terminalı görünür.</li>
    </ul>
    <p>Arxa divarda tapşırıq lövhəsi (Plan, İcrada, Hazır) və ekran var. Lövhə real işlərdən qurulur, ekrandakı rəqəmlər isə nümunədir.</p>` },

  { id: 'rehber', title: 'Necə idarə etməli', html: () => `
    <h3>Kamera</h3>
    <ul><li>Siçanla sürüşdürün: fırlanır. Sağ düymə: hərəkət. Təkər: yaxınlaşma.</li><li>Yuxarıdakı <b>Görünüş</b> düyməsi hazır bucaqlar arasında keçir.</li></ul>
    <h3>Komanda</h3>
    <p>Soldakı siyahıda hər kəsin nə etdiyi yazılıb. Ada klikləyin: kamera ona keçir, sağda paneli açılır. Ofisdə personajın özünə və ya adına klikləmək də olar.
    Kameranı kiminsə yanına gətirsəniz, aşağıda <b>Danış</b> çıxır (<kbd>Enter</kbd>).</p>
    <h3>Personaj paneli</h3>
    <ul>
      <li><b>Söhbət:</b> canlı yazışma.</li>
      <li><b>Tapşırıq:</b> iş vermək, bu gün görülən işlər, hazır nəticələr.</li>
      <li><b>Kompüter:</b> onun faylları və terminalı. Masasındakı monitora klik etsəniz böyük pəncərədə açılır.</li>
      <li><b>Yaddaş:</b> sizinlə söhbətlərdən və işlərdən yadında qalanlar.</li>
    </ul>
    <p><kbd>Esc</kbd> paneli bağlayır.</p>` },

  { id: 'kampaniya', title: 'Kampaniya', html: () => `
    <p class="bk-lead">Soldakı <b>Kampaniya başlat</b> düyməsi ilə ad yazırsınız və ${PIPE.length} nəfər işi bir-birinə təhvil verir.</p>
    <ol class="bk-pipe">${PIPE.map(s => { const t = TEAM.find(x => x.id === s.id); return `<li><b>${esc(t.name)}</b> (${esc(t.role)}): ${esc(s.task)}, nəticə: ${esc(s.out)}</li>`; }).join('')}</ol>
    <p>Gedişat sağ paneldə görünür. Sonda yekun sənəd <code>outputs/kampaniyalar/</code> qovluğuna yazılır.</p>` },

  { id: 'perde', title: 'Pərdə arxası', html: () => `
    <p class="bk-lead">Bu hissə oyunçu üçündür, personajlar bundan xəbərsizdir: hər biri dil modeli ilə işləyir.</p>
    <ul>
      <li>Brauzer yalnız animasiya və interfeysi çəkir. Gəzmək, söhbət balonları, görüşlər <b>pulsuzdur</b>: heç bir model çağırılmır.</li>
      <li>Siz danışanda, tapşırıq verəndə və ya kampaniya başladanda kiçik Node server (<code>server.mjs</code>) <code>claude -p</code> çağırır.</li>
      <li>Söhbət sürətli və ucuz modellə (<code>haiku</code>), iş daha güclü modellə (<code>sonnet</code>) gedir.</li>
      <li>Söhbət alətsizdir. Tapşırıqda personaj öz kompüterində (sandbox qovluğunda) fayl yaradır və əmr işlədir: yalnız öz qovluğuna yazır, ev qovluğunuzu və başqalarının qovluğunu görmür, internet bağlıdır.</li>
      <li>Server yalnız <code>127.0.0.1</code>-də dinləyir. İstifadəçi hook-ları, plugin-ləri və MCP serverləri yüklənmir.</li>
    </ul>
    <p>Rejimlər (yuxarıda): <b>Canlı</b> (Claude), <b>Demo</b> (Claude çağırılmır, nümunə cavablar), <b>Simulyasiya</b> (server yoxdur, yalnız animasiya).</p>` },

  { id: 'yaddas', title: 'Yaddaş və Ruflo', html: () => `
    <p class="bk-lead">Personajların xatirələri <b>Ruflo</b>-nun yaddaşında (AgentDB) saxlanır.</p>
    <ul>
      <li>Hər söhbətdən və hər bitən işdən sonra personajın öz bölməsinə (<code>ofis-&lt;ad&gt;</code>) qısa xatirə yazılır.</li>
      <li>Danışanda mövzuya uyğun xatirələr <b>semantik axtarışla</b> tapılır və personaja "yadına düşür".</li>
      <li>Ehtiyat üçün hər xatirə <code>yaddas/&lt;ad&gt;.jsonl</code> faylına da yazılır.</li>
      <li>Yaddaşı silmək ofisi "ilk günə" qaytarır: <code>yaddas/</code> qovluğunu silin.</li>
    </ul>
    <div class="bk-note">Ofis Ruflo-nu yalnız yaddaş üçün işlədir: o, <code>yaddas/</code> qovluğunda, Claude mühit dəyişənləri olmadan işə salınır,
    ona görə başqa layihələrin Ruflo qurulumuna qarışmır.</div>` },

  { id: 'qaydalar', title: 'Hüdudlar', html: () => `
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
document.body.insertAdjacentHTML('beforeend', `<div id="book"><div class="bk"><nav><h2>Ofisin kitabı<small>${esc(WORLD.company)} · ${esc(WORLD.floor)}</small></h2>
  ${CHAPTERS.map(c => `<button data-ch="${c.id}">${esc(c.title)}</button>`).join('')}</nav><article id="bkBody"></article></div></div>`);

const root = document.getElementById('book'), body = document.getElementById('bkBody');
function show(id) {
  const i = Math.max(0, CHAPTERS.findIndex(c => c.id === id)), c = CHAPTERS[i];
  root.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.ch === c.id));
  const prev = CHAPTERS[i - 1], next = CHAPTERS[i + 1];
  body.innerHTML = `<button class="bk-x iconbtn" id="bkX" aria-label="Bağla"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button><h1>${esc(c.title)}</h1>${c.html()}
    <div class="bk-foot"><span>${prev ? `<button class="btn" data-go="${prev.id}">← ${esc(prev.title)}</button>` : ''}</span>
    <span>${next ? `<button class="btn" data-go="${next.id}">${esc(next.title)} →</button>` : '<button class="btn primary" id="bkDone">Ofisə qayıt</button>'}</span></div>`;
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
